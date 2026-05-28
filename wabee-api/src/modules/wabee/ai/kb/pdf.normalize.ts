/**
 * PDF Text Normalization Utilities.
 * Fixes common extraction issues: merged text, bad hyphenation, bullet chars, etc.
 */

/**
 * Normalizes raw text extracted from a PDF.
 * Fixes spacing, de-hyphenation, bullet formatting, and paragraph merging.
 */
export function normalizeExtractedText(raw: string): string {
    if (!raw) return '';

    let text = raw;

    // 1. Remove null chars
    text = text.replace(/\u0000/g, '');

    // 2. Normalize line endings
    text = text.replace(/\r\n/g, '\n');

    // 3. De-hyphenation: "transpor-\nte" => "transporte"
    text = text.replace(/(\w)-\n(\w)/g, '$1$2');

    // 4. Fix emoji/bullet stuck to word: "✅Seguridad" => "✅ Seguridad"
    text = text.replace(/([\u2600-\u27BF\u2B50\u2714\u2705\u274C\u2764\uFE0F])\s*/g, '$1 ');
    // Normalize bullet chars at start of line
    text = text.replace(/^[✅•◆►▪▸→]\s*/gm, '- ');

    // 5. Fix merged words: insert space between lowercase→uppercase transitions
    //    e.g. "MonterreyVeracruz" => "Monterrey Veracruz" (CamelCase-like merges)
    text = text.replace(/([a-záéíóúñ])([A-ZÁÉÍÓÚÑ])/g, '$1 $2');

    // 6. Fix merged word after period/number: "10hrs.Salida" => "10hrs. Salida"
    text = text.replace(/([.!?;:])([A-ZÁÉÍÓÚÑa-záéíóúñ])/g, '$1 $2');

    // 7. Fix number stuck to word: "350pesos" => "350 pesos"
    text = text.replace(/(\d)([a-záéíóúñA-ZÁÉÍÓÚÑ])/g, '$1 $2');
    text = text.replace(/([a-záéíóúñA-ZÁÉÍÓÚÑ])(\d)/g, '$1 $2');

    // 8. Join lines within a paragraph:
    //    If line does NOT end with sentence-ender AND next line starts with lowercase/number => join
    const lines = text.split('\n');
    const joined: string[] = [];
    let accumulator = '';
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (trimmed === '') {
            if (accumulator) { joined.push(accumulator); accumulator = ''; }
            joined.push('');
            continue;
        }

        accumulator = accumulator ? accumulator + ' ' + trimmed : trimmed;

        const nextLine = (i + 1 < lines.length) ? lines[i + 1].trim() : '';
        const endsWithTerminator = /[.?!:;]$/.test(trimmed);
        const nextStartsLower = /^[a-záéíóúñ0-9]/.test(nextLine);
        const nextIsBlank = nextLine === '';
        const isBullet = /^[-•]/.test(trimmed);
        const nextIsBullet = /^[-•]/.test(nextLine);

        const shouldJoin = !endsWithTerminator && nextStartsLower && !nextIsBlank && !isBullet && !nextIsBullet;

        if (!shouldJoin) {
            joined.push(accumulator);
            accumulator = '';
        }
    }
    if (accumulator) joined.push(accumulator);
    text = joined.join('\n');

    // 9. Collapse multiple spaces (but not newlines)
    text = text.replace(/[ \t]{2,}/g, ' ');

    // 10. Collapse 3+ newlines into double (preserve paragraph breaks)
    text = text.replace(/\n{3,}/g, '\n\n');

    // 11. Final trim
    text = text.trim();

    return text;
}

/**
 * Creates a normalized string for fast keyword matching.
 * Lowercase, no accents, only alphanumeric + spaces.
 */
export function makeContentNorm(text: string): string {
    if (!text) return '';
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // strip accents
        .replace(/[^a-z0-9]+/g, ' ')     // only keep alphanumeric
        .replace(/\s{2,}/g, ' ')          // collapse spaces
        .trim();
}
