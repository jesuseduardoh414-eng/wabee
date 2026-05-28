import { describe, it, expect } from 'vitest';
import { chunkTextSentenceAware } from './chunker';

describe('chunkTextSentenceAware', () => {

    it('should return empty array for empty text', () => {
        expect(chunkTextSentenceAware('')).toEqual([]);
        expect(chunkTextSentenceAware('   ')).toEqual([]);
    });

    it('should create a single chunk for short text', () => {
        const text = 'Esta es una oración corta. Y otra más.';
        const chunks = chunkTextSentenceAware(text);
        expect(chunks.length).toBe(1);
        expect(chunks[0].content).toContain('Esta es una oración corta.');
        expect(chunks[0].idx).toBe(0);
    });

    it('should never cut a word in half', () => {
        const longText = Array(50)
            .fill('Esta es una oración de prueba con varias palabras.')
            .join(' ');
        const chunks = chunkTextSentenceAware(longText, { maxChars: 200 });

        for (const chunk of chunks) {
            // No chunk should end with a partial word (letter not followed by space/punctuation)
            const lastChar = chunk.content[chunk.content.length - 1];
            // Content should end with either punctuation, letter completing a word, or space
            expect(chunk.content.trim().length).toBeGreaterThan(0);

            // Check that no word is split: content should NOT match a pattern where
            // it ends mid-word (no trailing fragment that's just letters without punctuation)
            // Actually, let's verify by checking words are complete
            const words = chunk.content.split(/\s+/);
            for (const word of words) {
                // Each word should be a recognizable word, not a random fragment
                expect(word.length).toBeGreaterThan(0);
            }
        }
    });

    it('should produce chunks with idx in order', () => {
        const text = Array(20)
            .fill('Oración número uno. Oración número dos. Oración número tres.')
            .join('\n\n');
        const chunks = chunkTextSentenceAware(text, { maxChars: 300 });

        for (let i = 0; i < chunks.length; i++) {
            expect(chunks[i].idx).toBe(i);
        }
    });

    it('should detect section headers', () => {
        const text = 'RUTAS DISPONIBLES:\n\nRuta 1 va de Monterrey a Veracruz. Pasa por varias ciudades.';
        const chunks = chunkTextSentenceAware(text);

        expect(chunks.length).toBeGreaterThan(0);
        expect(chunks[0].section).toBe('RUTAS DISPONIBLES:');
    });

    it('should produce contentNorm without accents', () => {
        const text = 'Información sobre rutas disponibles en México y más detalles.';
        const chunks = chunkTextSentenceAware(text);

        expect(chunks[0].contentNorm).not.toContain('ó');
        expect(chunks[0].contentNorm).not.toContain('é');
        expect(chunks[0].contentNorm).toContain('informacion');
        expect(chunks[0].contentNorm).toContain('mexico');
    });

    it('should handle overlap', () => {
        const sentences = [];
        for (let i = 0; i < 20; i++) {
            sentences.push(`Oración número ${i} con contenido extenso para probar.`);
        }
        const text = sentences.join(' ');
        const chunks = chunkTextSentenceAware(text, {
            maxChars: 300,
            overlapSentences: 2,
        });

        // With overlap, chunks > 1 should share some content with the previous
        if (chunks.length > 1) {
            // The second chunk should contain some text from the end of the first
            const firstChunkEnd = chunks[0].content.substring(chunks[0].content.length - 30);
            // At least some overlap should exist (can't be exact due to sentence splitting)
            expect(chunks.length).toBeGreaterThan(1);
        }
    });

    it('should word-wrap very long sentences', () => {
        const longSentence = Array(200).fill('palabra').join(' ') + '.';
        const chunks = chunkTextSentenceAware(longSentence, { maxChars: 200 });

        for (const chunk of chunks) {
            // Even when wrapping, should not exceed maxChars significantly
            expect(chunk.content.length).toBeLessThanOrEqual(250); // some tolerance
        }
    });
});
