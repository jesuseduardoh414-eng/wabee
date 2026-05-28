/**
 * Safe PDF Parse wrapper — handles CJS/ESM import mismatch for pdf-parse.
 */

import pdfParseImport from 'pdf-parse';

export async function safePdfParse(buffer: Buffer): Promise<{ text: string; numpages: number; info: any }> {
    let fn: any = pdfParseImport;

    if (typeof fn !== 'function') {
        fn = fn?.default;
    }

    if (typeof fn !== 'function') {
        try {
            const req = require('pdf-parse');
            fn = typeof req === 'function' ? req : req.default;
        } catch (e) {
            // ignore
        }
    }

    if (typeof fn !== 'function') {
        throw new Error('pdf-parse import mismatch: no callable export found');
    }

    const data = await fn(buffer);

    const text = (data.text || '').trim();
    console.log(`[KbService] PDF_PARSE_OK chars=${text.length} pages=${data.numpages || '?'}`);

    if (!text || text.length < 10) {
        throw new Error('PDF contains no readable text (< 10 chars)');
    }

    return { text, numpages: data.numpages, info: data.info };
}
