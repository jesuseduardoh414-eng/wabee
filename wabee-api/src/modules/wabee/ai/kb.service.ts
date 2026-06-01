import { prisma } from '@/lib/prisma';
import { env } from '../../../config/env';
import { withDbRetry } from '@/utils/db.utils';
import { safePdfParse } from './kb/pdf.parse';
import { normalizeExtractedText, makeContentNorm } from './kb/pdf.normalize';
import { chunkTextSentenceAware } from './kb/chunker';
import { parseCsvToText } from './parsers/csv.parse';
import { parseExcelToText } from './parsers/excel.parse';
import { scrapeUrl } from './kb/url.scraper';
import { testConnection, listTables, scrapeDbColumns, DbConnectionConfig, ColumnMapping, DbTable } from './kb/db.connector';
import * as path from 'path';

/* ── Spanish Stopwords for keyword search ── */
const STOPWORDS = new Set([
    'de', 'la', 'el', 'y', 'en', 'por', 'para', 'un', 'una', 'con', 'a',
    'no', 'los', 'las', 'que', 'del', 'lo', 'como', 'es', 'son', 'se',
    'al', 'le', 'su', 'mas', 'si', 'ya', 'o', 'te', 'mi', 'tu', 'nos',
    'me', 'ha', 'este', 'esta', 'ese', 'esa', 'ser', 'hay',
]);

/* ── Supported file kinds ── */
type FileKind = 'pdf' | 'csv' | 'excel';

const ALLOWED_MIMES = new Set([
    'application/pdf',
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
]);

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export interface RetrievalResult {
    chunkId: string;
    score: number;
    content: string;
    section?: string | null;
    sourceName: string;
    sourceRef: string;
}

export class KbService {

    /* ═══════════════════════════════════════════
     *  FILE TYPE DETECTION
     * ═══════════════════════════════════════════ */

    /**
     * Detects the file kind by mimeType (primary) and file extension (fallback).
     * Throws if the type is not supported.
     */
    private detectKind(filename: string, mimeType: string): FileKind {
        const ext = path.extname(filename).toLowerCase();

        if (mimeType === 'application/pdf' || ext === '.pdf') return 'pdf';
        if (mimeType === 'text/csv' || ext === '.csv') return 'csv';
        if (
            mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            mimeType === 'application/vnd.ms-excel' ||
            ext === '.xlsx' ||
            ext === '.xls'
        ) return 'excel';

        throw new Error(
            `Unsupported file type: mimeType="${mimeType}" ext="${ext}". ` +
            `Allowed types: PDF, CSV, XLSX, XLS.`
        );
    }

    /**
     * Extracts plain text from a file buffer based on its type.
     *
     * - PDF:   safePdfParse → normalizeExtractedText (fixes PDF-specific artifacts)
     * - CSV:   parseCsvToText (already structured, no PDF normalize needed)
     * - Excel: parseExcelToText (already structured, no PDF normalize needed)
     */
    private async extractText(
        buffer: Buffer,
        filename: string,
        mimeType: string,
    ): Promise<string> {
        const kind = this.detectKind(filename, mimeType);

        if (kind === 'pdf') {
            const parsed = await safePdfParse(buffer);
            return normalizeExtractedText(parsed.text);
        }

        if (kind === 'csv') {
            const result = parseCsvToText(buffer);
            return result.text;
        }

        // excel
        const result = parseExcelToText(buffer);
        return result.text;
    }

    /* ═══════════════════════════════════════════
     *  INDEXING
     * ═══════════════════════════════════════════ */

    /**
     * Indexes a file (PDF, CSV, or Excel) into the knowledge base.
     * Replaces the previous indexPdfFile method with multi-format support.
     *
     * Maintains full backward compatibility:
     * - Same Prisma models (KbFile, KbChunk)
     * - Same chunking parameters
     * - Same multi-tenancy (tenantId scope)
     * - Same error handling (KbFile.status = ERROR)
     */
    async indexFile(params: {
        tenantId: string;
        profileId?: string;
        fileId: string;
        filename: string;
        mimeType: string;
        buffer: Buffer;
    }) {
        const { tenantId, profileId, fileId, filename, mimeType, buffer } = params;
        const t0 = Date.now();

        try {
            // Validate file type upfront
            if (!ALLOWED_MIMES.has(mimeType)) {
                const ext = path.extname(filename).toLowerCase();
                if (!['.pdf', '.csv', '.xlsx', '.xls'].includes(ext)) {
                    throw new Error(`Unsupported file type: ${mimeType}`);
                }
            }

            // Validate size
            if (buffer.length > MAX_FILE_SIZE_BYTES) {
                throw new Error(
                    `File too large: ${(buffer.length / 1024 / 1024).toFixed(1)}MB exceeds 25MB limit`
                );
            }

            console.log(
                `[KbService] INDEX_START file=${fileId} filename="${filename}" ` +
                `mime="${mimeType}" bytes=${buffer.length}`
            );

            // 1. Extract text (dispatches to pdf/csv/excel parser)
            const text = await this.extractText(buffer, filename, mimeType);
            console.log(`[KbService] EXTRACTED chars=${text.length}`);

            if (!text || text.trim().length < 10) {
                throw new Error('File contains no readable text (< 10 chars after extraction)');
            }

            // 2. Chunk (sentence-aware — unchanged)
            const chunks = chunkTextSentenceAware(text, {
                maxChars: 1200,
                minChars: 300,
                overlapSentences: 2,
            });
            console.log(`[KbService] CHUNKED count=${chunks.length}`);

            if (chunks.length === 0) {
                throw new Error('No chunks generated from file text');
            }

            // 3. Delete existing chunks for this file (tenantId scoped)
            await prisma.kbChunk.deleteMany({
                where: { tenantId, fileId },
            });

            // 4. Insert new chunks
            const chunkData = chunks.map(c => ({
                tenantId,
                fileId,
                profileId: profileId || null,
                idx: c.idx,
                section: c.section || null,
                content: c.content,
                contentNorm: c.contentNorm,
                charStart: c.charStart ?? null,
                charEnd: c.charEnd ?? null,
            }));

            await prisma.kbChunk.createMany({ data: chunkData as any });

            // 5. Mark as indexed
            await prisma.kbFile.update({
                where: { id: fileId },
                data: { status: 'INDEXED', error: null },
            });

            const duration = Date.now() - t0;
            console.log(
                `[KbService] INDEX_OK file=${fileId} chunks=${chunks.length} ms=${duration}`
            );

        } catch (error: any) {
            console.error(`[KbService] INDEX_ERR file=${fileId}: ${error.message}`);
            await prisma.kbFile.update({
                where: { id: fileId },
                data: { status: 'ERROR', error: error.message },
            });
        }
    }

    /* ═══════════════════════════════════════════
     *  URL SOURCE INDEXING
     * ═══════════════════════════════════════════ */

    /**
     * Scrapes a URL and indexes its content into the knowledge base.
     * Creates KbChunks linked to the KbSource (not to a KbFile).
     */
    async indexSource(params: {
        tenantId: string;
        profileId?: string;
        sourceId: string;
        url: string;
    }) {
        const { tenantId, profileId, sourceId, url } = params;
        const t0 = Date.now();

        try {
            await prisma.kbSource.update({
                where: { id: sourceId },
                data: { status: 'PROCESSING' },
            });

            console.log(`[KbService] SOURCE_INDEX_START sourceId=${sourceId} url=${url}`);

            const { text, title } = await scrapeUrl(url);
            console.log(`[KbService] SCRAPED title="${title}" chars=${text.length}`);

            const chunks = chunkTextSentenceAware(text, {
                maxChars: 1200,
                minChars: 300,
                overlapSentences: 2,
            });
            console.log(`[KbService] CHUNKED count=${chunks.length}`);

            if (chunks.length === 0) {
                throw new Error('No chunks generated from scraped content');
            }

            await prisma.kbChunk.deleteMany({ where: { tenantId, sourceId } });

            const chunkData = chunks.map(c => ({
                tenantId,
                sourceId,
                profileId: profileId || null,
                idx: c.idx,
                section: c.section || title || null,
                content: c.content,
                contentNorm: c.contentNorm,
                charStart: c.charStart ?? null,
                charEnd: c.charEnd ?? null,
            }));

            await prisma.kbChunk.createMany({ data: chunkData as any });

            await prisma.kbSource.update({
                where: { id: sourceId },
                data: { status: 'INDEXED', error: null, vectorSyncAt: new Date() },
            });

            console.log(`[KbService] SOURCE_INDEX_OK sourceId=${sourceId} chunks=${chunks.length} ms=${Date.now() - t0}`);

        } catch (error: any) {
            console.error(`[KbService] SOURCE_INDEX_ERR sourceId=${sourceId}: ${error.message}`);
            await prisma.kbSource.update({
                where: { id: sourceId },
                data: { status: 'ERROR', error: error.message },
            });
        }
    }

    /* ═══════════════════════════════════════════
     *  DATABASE SOURCE INDEXING
     * ═══════════════════════════════════════════ */

    /** Tests connectivity without indexing. Returns table list for column mapping UI. */
    async testDbSource(config: DbConnectionConfig): Promise<DbTable[]> {
        await testConnection(config);
        return listTables(config);
    }

    /**
     * Reads mapped columns from an external read-only DB and indexes them as KB chunks.
     * config.config must contain: { connection: DbConnectionConfig, mappings: ColumnMapping[] }
     */
    async indexDbSource(params: {
        tenantId: string;
        profileId?: string;
        sourceId: string;
        config: DbConnectionConfig;
        mappings: ColumnMapping[];
    }) {
        const { tenantId, profileId, sourceId, config, mappings } = params;
        const t0 = Date.now();

        try {
            await prisma.kbSource.update({
                where: { id: sourceId },
                data: { status: 'PROCESSING' },
            });

            console.log(`[KbService] DB_INDEX_START sourceId=${sourceId} tables=${mappings.map(m => m.table).join(',')}`);

            const { text, rowCount, tablesMapped } = await scrapeDbColumns(config, mappings);
            console.log(`[KbService] DB_SCRAPED rows=${rowCount} chars=${text.length}`);

            if (!text || text.trim().length < 10) {
                throw new Error('No readable content returned from database columns');
            }

            const chunks = chunkTextSentenceAware(text, {
                maxChars: 1200,
                minChars: 200,
                overlapSentences: 1,
            });
            console.log(`[KbService] CHUNKED count=${chunks.length}`);

            await prisma.kbChunk.deleteMany({ where: { tenantId, sourceId } });

            const chunkData = chunks.map(c => ({
                tenantId,
                sourceId,
                profileId: profileId || null,
                idx: c.idx,
                section: tablesMapped[0] || null,
                content: c.content,
                contentNorm: c.contentNorm,
                charStart: c.charStart ?? null,
                charEnd: c.charEnd ?? null,
            }));

            await prisma.kbChunk.createMany({ data: chunkData as any });

            await prisma.kbSource.update({
                where: { id: sourceId },
                data: {
                    status: 'INDEXED',
                    error: null,
                    vectorSyncAt: new Date(),
                    config: { ...(await prisma.kbSource.findUnique({ where: { id: sourceId }, select: { config: true } }))?.config as any, tablesMapped },
                },
            });

            console.log(`[KbService] DB_INDEX_OK sourceId=${sourceId} chunks=${chunks.length} ms=${Date.now() - t0}`);

        } catch (error: any) {
            console.error(`[KbService] DB_INDEX_ERR sourceId=${sourceId}: ${error.message}`);
            await prisma.kbSource.update({
                where: { id: sourceId },
                data: { status: 'ERROR', error: error.message },
            });
        }
    }

    /* ═══════════════════════════════════════════
     *  RETRIEVAL (Hybrid: Keyword + Embeddings)
     * ═══════════════════════════════════════════ */

    async retrieveTopChunks(params: {
        tenantId: string;
        profileId?: string;
        query: string;
        k?: number;
    }): Promise<RetrievalResult[]> {
        const { tenantId, profileId, query } = params;
        const k = params.k || parseInt(String(env.KB_TOP_K || '3'), 10);
        const t0 = Date.now();

        console.log(`[KbService] RETRIEVE_START profile=${profileId || 'GLOBAL'} qlen=${query.length}`);

        try {
            // Load chunks — include both file and source relations (either can be null)
            const chunks = await withDbRetry(async () => {
                return await prisma.kbChunk.findMany({
                    where: {
                        tenantId,
                        profileId: profileId || undefined,
                    },
                    select: {
                        id: true,
                        fileId: true,
                        sourceId: true,
                        content: true,
                        contentNorm: true,
                        section: true,
                        embedding: true,
                        file: { select: { filename: true, id: true } },
                        source: { select: { name: true, id: true } },
                    },
                });
            }, { label: 'KB_RETRIEVAL' });

            if (chunks.length === 0) {
                console.log('[KbService] RETRIEVE_DONE count=0 best=0');
                return [];
            }

            // Keyword scoring
            const queryNorm = makeContentNorm(query);
            const queryTokens = queryNorm
                .split(/\s+/)
                .filter(t => t.length > 2 && !STOPWORDS.has(t));

            let method = 'KEYWORD';
            const scored: (RetrievalResult & { keywordScore: number })[] = chunks
                .filter(chunk => chunk.file || chunk.source) // skip orphaned chunks
                .map(chunk => {
                const cn = chunk.contentNorm || makeContentNorm(chunk.content);
                let matchCount = 0;

                queryTokens.forEach(token => {
                    if (cn.includes(token)) matchCount++;
                });

                let score = queryTokens.length > 0
                    ? (matchCount / queryTokens.length) * 0.8
                    : 0;

                // Phrase bonus
                if (cn.includes(queryNorm) && queryNorm.length > 5) score += 0.25;

                // Section bonus: if query tokens match section
                if (chunk.section) {
                    const sectionNorm = makeContentNorm(chunk.section);
                    const sectionMatch = queryTokens.some(t => sectionNorm.includes(t));
                    if (sectionMatch) score += 0.15;
                }

                // Floor
                if (matchCount > 0 && score < 0.1) score = 0.1;

                const sourceName = chunk.file?.filename ?? chunk.source?.name ?? 'Unknown';
                const sourceRef  = chunk.file?.id ?? chunk.source?.id ?? '';

                return {
                    chunkId: chunk.id,
                    content: chunk.content,
                    section: chunk.section,
                    score,
                    keywordScore: score,
                    sourceName,
                    sourceRef,
                };
            });

            // Sort and take top K
            const results: RetrievalResult[] = scored
                .filter(c => c.score > 0)
                .sort((a, b) => b.score - a.score)
                .slice(0, k)
                .map(({ keywordScore, ...rest }) => rest);

            const bestScore = results[0]?.score || 0;
            const duration = Date.now() - t0;
            console.log(
                `[KbService] RETRIEVE_DONE method=${method} count=${results.length} ` +
                `best=${bestScore.toFixed(2)} ms=${duration}`
            );

            return results;

        } catch (error: any) {
            console.error('[KbService] RETRIEVE_ERR:', error.message);
            return [];
        }
    }

    /* ── Cosine Similarity ── */
    private cosineSimilarity(vecA: number[], vecB: number[]): number {
        if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) return 0;
        let dot = 0, normA = 0, normB = 0;
        for (let i = 0; i < vecA.length; i++) {
            dot += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }
        if (normA === 0 || normB === 0) return 0;
        return dot / (Math.sqrt(normA) * Math.sqrt(normB));
    }
}

export const kbService = new KbService();
