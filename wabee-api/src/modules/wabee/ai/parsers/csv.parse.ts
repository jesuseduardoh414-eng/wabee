/**
 * CSV Parser for Knowledge Base ingestion.
 * Converts a CSV buffer into a structured plain-text string
 * that can be passed directly to chunkTextSentenceAware.
 *
 * NOTE: normalizeExtractedText (PDF-specific) is NOT applied here.
 * CSV data is already clean and structured.
 */

import { parse } from 'csv-parse/sync';

export interface CsvParseResult {
    text: string;
    meta: { rowCount: number };
}

/**
 * Parses a CSV buffer into structured text.
 *
 * Each row is formatted as:
 *   Campo: Valor | Campo2: Valor2
 *
 * Empty rows (all values empty) are ignored.
 *
 * @param buffer - Raw file buffer (UTF-8 encoded)
 * @returns text and meta information
 */
export function parseCsvToText(buffer: Buffer): CsvParseResult {
    const raw = buffer.toString('utf-8');

    let records: Record<string, string>[];

    try {
        records = parse(raw, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
            relax_quotes: true,
            relax_column_count: true,
            bom: true, // Strip BOM for UTF-8 files saved from Excel
        }) as Record<string, string>[];
    } catch (err: any) {
        throw new Error(`CSV parse error: ${err.message}`);
    }

    if (!records || records.length === 0) {
        throw new Error('CSV contains no data rows');
    }

    const lines: string[] = [];

    for (const row of records) {
        const entries = Object.entries(row);

        // Skip rows where ALL values are empty/whitespace
        const hasContent = entries.some(([, val]) => val != null && String(val).trim() !== '');
        if (!hasContent) continue;

        const formatted = entries
            .filter(([key]) => key != null && key.trim() !== '')
            .map(([key, val]) => `${key.trim()}: ${val != null ? String(val).trim() : ''}`)
            .join(' | ');

        if (formatted.trim()) {
            lines.push(formatted);
        }
    }

    if (lines.length === 0) {
        throw new Error('CSV contains no readable content after filtering empty rows');
    }

    const text = lines.join('\n');

    console.log(`[CsvParser] Parsed rows=${lines.length} chars=${text.length}`);

    return {
        text,
        meta: { rowCount: lines.length },
    };
}
