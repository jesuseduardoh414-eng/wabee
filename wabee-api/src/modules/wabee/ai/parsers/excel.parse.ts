/**
 * Excel Parser for Knowledge Base ingestion.
 * Converts an XLSX/XLS buffer into structured plain-text for chunking.
 *
 * NOTE: normalizeExtractedText (PDF-specific) is NOT applied here.
 * Excel data is already clean and structured.
 */

import * as XLSX from 'xlsx';

export interface ExcelSheetMeta {
    sheet: string;
    rows: number;
}

export interface ExcelParseResult {
    text: string;
    meta: { sheets: ExcelSheetMeta[] };
}

/**
 * Parses an XLSX/XLS buffer into structured text.
 *
 * Each sheet is prefixed with a [SHEET: NombreHoja] marker.
 * Each row is formatted as:
 *   Campo: Valor | Campo2: Valor2
 *
 * Empty sheets and empty rows are ignored.
 *
 * @param buffer - Raw file buffer
 * @returns text and meta information per sheet
 */
export function parseExcelToText(buffer: Buffer): ExcelParseResult {
    let workbook: XLSX.WorkBook;

    try {
        workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    } catch (err: any) {
        throw new Error(`Excel read error: ${err.message}`);
    }

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('Excel file contains no sheets');
    }

    const sections: string[] = [];
    const sheetsMeta: ExcelSheetMeta[] = [];

    for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;

        // Convert sheet to array of arrays (raw rows)
        const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, {
            header: 1,
            defval: '',
            raw: false, // Convert dates/numbers to strings
        });

        if (rawRows.length < 2) {
            // No data rows (only header or completely empty)
            continue;
        }

        // First row is headers
        const headers: string[] = rawRows[0].map((h: any) =>
            h != null ? String(h).trim() : ''
        );

        const dataRows = rawRows.slice(1);
        const lines: string[] = [];

        for (const row of dataRows) {
            // Check if row is completely empty
            const hasContent = row.some(
                (cell: any) => cell != null && String(cell).trim() !== ''
            );
            if (!hasContent) continue;

            const formatted = headers
                .map((header, idx) => {
                    if (!header) return null; // skip columns with no header
                    const cellValue = row[idx] != null ? String(row[idx]).trim() : '';
                    return `${header}: ${cellValue}`;
                })
                .filter(Boolean)
                .join(' | ');

            if (formatted.trim()) {
                lines.push(formatted);
            }
        }

        if (lines.length === 0) continue; // Skip sheet with no readable data

        // Add sheet marker + rows
        sections.push(`[SHEET: ${sheetName}]`);
        sections.push(...lines);
        sections.push(''); // blank line between sheets for paragraph separation

        sheetsMeta.push({ sheet: sheetName, rows: lines.length });
    }

    if (sections.length === 0) {
        throw new Error('Excel file contains no readable data in any sheet');
    }

    const text = sections.join('\n').trim();

    console.log(
        `[ExcelParser] Parsed sheets=${sheetsMeta.length} rows_total=${sheetsMeta.reduce((s, m) => s + m.rows, 0)} chars=${text.length}`
    );

    return {
        text,
        meta: { sheets: sheetsMeta },
    };
}
