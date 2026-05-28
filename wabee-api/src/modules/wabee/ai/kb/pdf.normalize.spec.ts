import { describe, it, expect } from 'vitest';
import { normalizeExtractedText, makeContentNorm } from './pdf.normalize';

describe('normalizeExtractedText', () => {

    it('should fix de-hyphenation', () => {
        const input = 'El transpor-\nte público es seguro.';
        const result = normalizeExtractedText(input);
        expect(result).toContain('transporte público');
    });

    it('should insert space between stuck emoji and word', () => {
        const input = '✅Seguridad las 24 horas';
        const result = normalizeExtractedText(input);
        expect(result).toMatch(/- Seguridad/);
    });

    it('should fix merged CamelCase words from PDF', () => {
        const input = 'MonterreyVeracruzTiempoEstimado';
        const result = normalizeExtractedText(input);
        expect(result).toContain('Monterrey');
        expect(result).toContain('Veracruz');
        expect(result).toContain('Tiempo');
    });

    it('should fix number stuck to word', () => {
        const input = '350pesos de tarifa10hrs';
        const result = normalizeExtractedText(input);
        expect(result).toContain('350 pesos');
        expect(result).toContain('tarifa 10');
    });

    it('should join paragraph lines correctly', () => {
        const input = 'Esta es una línea que\ncontinúa en la siguiente';
        const result = normalizeExtractedText(input);
        expect(result).toContain('línea que continúa');
    });

    it('should NOT join lines after sentence terminators', () => {
        const input = 'Primera oración.\nSegunda oración.';
        const result = normalizeExtractedText(input);
        // Should keep them on separate lines
        expect(result).toContain('Primera oración.');
        expect(result).toContain('Segunda oración.');
    });

    it('should remove null chars', () => {
        const input = 'Hola\u0000mundo';
        const result = normalizeExtractedText(input);
        expect(result).not.toContain('\u0000');
    });

    it('should collapse multiple spaces', () => {
        const input = 'Mucho    espacio   aquí';
        const result = normalizeExtractedText(input);
        expect(result).toBe('Mucho espacio aquí');
    });

    it('should preserve paragraph breaks', () => {
        const input = 'Párrafo uno.\n\nPárrafo dos.';
        const result = normalizeExtractedText(input);
        expect(result).toContain('\n\n');
    });
});

describe('makeContentNorm', () => {

    it('should lowercase', () => {
        expect(makeContentNorm('HOLA Mundo')).toBe('hola mundo');
    });

    it('should remove accents', () => {
        expect(makeContentNorm('Información básica')).toBe('informacion basica');
    });

    it('should keep numbers', () => {
        expect(makeContentNorm('Ruta 1 cuesta $350')).toBe('ruta 1 cuesta 350');
    });

    it('should collapse and trim', () => {
        expect(makeContentNorm('  mucho   espacio  ')).toBe('mucho espacio');
    });

    it('should handle empty string', () => {
        expect(makeContentNorm('')).toBe('');
    });
});
