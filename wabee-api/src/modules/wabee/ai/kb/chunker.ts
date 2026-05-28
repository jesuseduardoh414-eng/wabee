/**
 * Sentence-Aware Text Chunker.
 * Splits text into chunks respecting sentence and paragraph boundaries.
 * Never cuts words or sentences in the middle.
 */

import { makeContentNorm } from './pdf.normalize';

export interface Chunk {
    idx: number;
    content: string;
    contentNorm: string;
    section?: string;
    charStart?: number;
    charEnd?: number;
}

export interface ChunkOptions {
    maxChars?: number;          // default 1200
    minChars?: number;          // default 300
    overlapSentences?: number;  // default 2
}

/**
 * Detects if a paragraph looks like a section header.
 * Short (<=80 chars), ends with ":" or is mostly uppercase.
 */
function detectHeader(paragraph: string): string | null {
    const trimmed = paragraph.trim();
    if (trimmed.length > 80 || trimmed.length < 2) return null;

    const endsWithColon = trimmed.endsWith(':');
    const uppercaseRatio = (trimmed.replace(/[^A-ZÁÉÍÓÚÑ]/g, '').length) / trimmed.replace(/\s/g, '').length;
    const isMostlyUpper = uppercaseRatio > 0.6 && trimmed.length > 3;

    if (endsWithColon || isMostlyUpper) {
        return trimmed.substring(0, 120);
    }
    return null;
}

/**
 * Splits text into sentences using heuristics.
 * Handles Spanish punctuation and bullet points.
 */
function splitSentences(text: string): string[] {
    if (!text.trim()) return [];

    // Split on sentence-ending punctuation followed by whitespace
    // Also split on bullet points "- "
    const raw = text
        .split(/(?<=[\.\?\!\:])\s+/)
        .flatMap(s => s.split(/(?=^- )/m));

    // Filter empty and trim
    return raw.map(s => s.trim()).filter(s => s.length > 0);
}

/**
 * Word-wraps a long sentence that exceeds maxChars.
 * Never breaks in the middle of a word.
 */
function wordWrap(sentence: string, maxChars: number): string[] {
    if (sentence.length <= maxChars) return [sentence];

    const words = sentence.split(/\s+/);
    const parts: string[] = [];
    let current = '';

    for (const word of words) {
        if (current.length + word.length + 1 > maxChars && current.length > 0) {
            parts.push(current.trim());
            current = word;
        } else {
            current += (current ? ' ' : '') + word;
        }
    }
    if (current.trim()) parts.push(current.trim());

    return parts;
}

/**
 * Main chunking function. Splits text into chunks respecting:
 * - Paragraph boundaries
 * - Sentence boundaries
 * - Never cuts words
 * - Supports overlap by sentences
 * - Detects section headers
 */
export function chunkTextSentenceAware(text: string, opts?: ChunkOptions): Chunk[] {
    const maxChars = opts?.maxChars ?? 1200;
    const minChars = opts?.minChars ?? 300;
    const overlapSentences = opts?.overlapSentences ?? 2;

    if (!text || text.trim().length === 0) return [];

    const paragraphs = text.split(/\n{2,}/);
    const chunks: Chunk[] = [];
    let currentSection: string | undefined;

    // Collect all sentences with their section context
    interface SentenceEntry {
        text: string;
        section?: string;
        charOffset: number; // approximate offset in original text
    }

    const allSentences: SentenceEntry[] = [];
    let charCursor = 0;

    for (const para of paragraphs) {
        const trimmed = para.trim();
        if (!trimmed) {
            charCursor += para.length + 2; // account for \n\n
            continue;
        }

        // Check if this paragraph is a header
        const header = detectHeader(trimmed);
        if (header) {
            currentSection = header;
            charCursor += para.length + 2;
            continue;
        }

        // Split paragraph into sentences
        const sentences = splitSentences(trimmed);
        for (const sent of sentences) {
            // If sentence is too long, word-wrap it
            const parts = wordWrap(sent, maxChars);
            for (const part of parts) {
                allSentences.push({
                    text: part,
                    section: currentSection,
                    charOffset: charCursor,
                });
            }
            charCursor += sent.length + 1;
        }
        charCursor += 2; // paragraph separator
    }

    if (allSentences.length === 0) return [];

    // Build chunks by accumulating sentences
    let idx = 0;
    let i = 0;

    while (i < allSentences.length) {
        let chunkText = '';
        let chunkSection = allSentences[i].section;
        const startOffset = allSentences[i].charOffset;
        let sentencesInChunk = 0;
        let j = i;

        // Accumulate sentences until maxChars
        while (j < allSentences.length) {
            const candidate = chunkText + (chunkText ? '\n' : '') + allSentences[j].text;

            if (candidate.length > maxChars && sentencesInChunk > 0) {
                break;
            }

            chunkText = candidate;
            if (allSentences[j].section) chunkSection = allSentences[j].section;
            sentencesInChunk++;
            j++;
        }

        const endOffset = j > i ? allSentences[j - 1].charOffset + allSentences[j - 1].text.length : startOffset;

        chunks.push({
            idx,
            content: chunkText.trim(),
            contentNorm: makeContentNorm(chunkText),
            section: chunkSection,
            charStart: startOffset,
            charEnd: endOffset,
        });

        idx++;

        // If we consumed all sentences, we're done
        if (j >= allSentences.length) break;

        // Advance with overlap
        const overlapStart = Math.max(i + 1, j - overlapSentences);
        i = sentencesInChunk === 0 ? j + 1 : overlapStart;

        // Safety: prevent infinite loop
        if (i <= (chunks[chunks.length - 1]?.charStart ?? -1) && i < allSentences.length) {
            i = j;
        }
    }

    return chunks;
}
