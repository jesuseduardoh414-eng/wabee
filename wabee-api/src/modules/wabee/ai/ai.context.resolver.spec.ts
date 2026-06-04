import { describe, it, expect } from 'vitest';
import {
    extractEntitiesFromText,
    resolveContextualReference,
    detectImplicitReference,
} from './ai.context.resolver';

describe('extractEntitiesFromText', () => {

    it('extrae una lista numerada a ordinalMap y orderedList', () => {
        const text = '1. Monterrey - Veracruz\n2. Monterrey - Hidalgo\n3. Monterrey - CDMX';
        const mem = extractEntitiesFromText(text);
        expect(mem.orderedList).toHaveLength(3);
        expect(mem.ordinalMap['1']).toContain('Veracruz');
        expect(mem.ordinalMap['2']).toContain('Hidalgo');
        expect(mem.ordinalMap['3']).toContain('CDMX');
    });

    it('devuelve memoria vacía para texto corto o vacío', () => {
        expect(extractEntitiesFromText('').orderedList).toHaveLength(0);
        expect(extractEntitiesFromText('   ').orderedList).toHaveLength(0);
    });

    it('construye keywordMap con palabras relevantes', () => {
        const mem = extractEntitiesFromText('1. Excavadora Hidráulica\n2. Retroexcavadora CAT');
        // keywords largas (>3 chars) deben mapear a su entidad
        expect(Object.keys(mem.keywordMap).length).toBeGreaterThan(0);
    });
});

describe('resolveContextualReference', () => {

    const memory = extractEntitiesFromText(
        '1. Monterrey - Veracruz\n2. Monterrey - Hidalgo\n3. Monterrey - CDMX'
    );

    it('resuelve referencia numérica explícita ("la opción 2")', () => {
        const res = resolveContextualReference('quiero la opción 2', memory);
        expect(res.detected).toBe(true);
        expect(res.resolvedTo).toContain('Hidalgo');
        expect(res.refType).toBe('ordinal_number');
    });

    it('resuelve ordinal textual ("la primera")', () => {
        const res = resolveContextualReference('me interesa la primera', memory);
        expect(res.detected).toBe(true);
        expect(res.resolvedTo).toContain('Veracruz');
        expect(res.refType).toBe('ordinal_word');
    });

    it('no detecta referencia cuando no hay lista en memoria', () => {
        const empty = extractEntitiesFromText('');
        const res = resolveContextualReference('la opción 2', empty);
        expect(res.detected).toBe(false);
    });

    it('no detecta referencia en un mensaje sin referencia', () => {
        const res = resolveContextualReference('hola buenos días', memory);
        expect(res.detected).toBe(false);
    });
});

describe('detectImplicitReference', () => {

    it('detecta preguntas de seguimiento de precio', () => {
        // Nota: los patrones esperan el mensaje normalizado sin "¿" inicial
        expect(detectImplicitReference('cuánto cuesta?')).toBe(true);
        expect(detectImplicitReference('y el precio?')).toBe(true);
    });

    it('no marca un mensaje normal como referencia implícita', () => {
        expect(detectImplicitReference('quiero rentar una excavadora para mi obra')).toBe(false);
    });
});
