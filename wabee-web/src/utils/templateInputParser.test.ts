/**
 * templateInputParser.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Smoke tests (sin framework pesado; se ejecutan con: npx ts-node --esm <file>
 * o con vitest si está disponible).
 *
 * Para correr: npx vitest run src/utils/templateInputParser.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
    hasTemplateInputs,
    getTemplateInputs,
    validateMapping,
    Template,
    TemplateInputMapping,
    tokenizeTemplateText
} from './templateInputParser';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const templateNoInputs: Template = {
    id: 'tmpl-001',
    name: 'static_hello',
    language: 'es',
    category: 'MARKETING',
    status: 'APPROVED',
    components: [
        { type: 'BODY', text: 'Hola, gracias por contactarnos.' },
        { type: 'FOOTER', text: 'WABEE Corp.' },
    ],
};

const templateWithBodyVar: Template = {
    id: 'tmpl-002',
    name: 'body_var',
    language: 'es',
    category: 'MARKETING',
    status: 'APPROVED',
    components: [
        { type: 'BODY', text: 'Hola {{1}}, tu pedido {{2}} está listo.' },
    ],
};

const templateWithUrlButton: Template = {
    id: 'tmpl-003',
    name: 'url_button',
    language: 'es',
    category: 'MARKETING',
    status: 'APPROVED',
    components: [
        { type: 'BODY', text: 'Visita nuestro sitio para más información.' },
        {
            type: 'BUTTONS',
            buttons: [
                { type: 'URL', text: 'Ver oferta', url: 'https://ejemplo.com/oferta/{{1}}' },
            ],
        },
    ],
};

const templateWithHeaderMedia: Template = {
    id: 'tmpl-004',
    name: 'header_media',
    language: 'es',
    category: 'MARKETING',
    status: 'APPROVED',
    components: [
        { type: 'HEADER', format: 'IMAGE' },
        { type: 'BODY', text: 'Mira nuestra imagen de hoy.' },
    ],
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('templateInputParser', () => {

    // Smoke test 1: Template sin placeholders → hasTemplateInputs false
    it('template sin inputs → hasTemplateInputs false', () => {
        expect(hasTemplateInputs(templateNoInputs)).toBe(false);
        expect(getTemplateInputs(templateNoInputs)).toHaveLength(0);
    });

    // Smoke test 2: Template BODY con {{1}} → true + descriptor "body_var_1"
    it('template con body {{1}} → true + descriptor body_var_1', () => {
        expect(hasTemplateInputs(templateWithBodyVar)).toBe(true);
        const inputs = getTemplateInputs(templateWithBodyVar);
        expect(inputs).toHaveLength(2);
        expect(inputs[0].id).toBe('body_var_1');
        expect(inputs[0].componentType).toBe('BODY');
        expect(inputs[0].kind).toBe('TEXT_VAR');
        expect(inputs[0].placeholderIndex).toBe(1);
        expect(inputs[0].required).toBe(true);
        expect(inputs[1].id).toBe('body_var_2');
    });

    // Smoke test 3: Template con URL button dinámico → URL_VAR
    it('template con URL button {{1}} → URL_VAR', () => {
        expect(hasTemplateInputs(templateWithUrlButton)).toBe(true);
        const inputs = getTemplateInputs(templateWithUrlButton);
        const urlVar = inputs.find((i) => i.kind === 'URL_VAR');
        expect(urlVar).toBeDefined();
        expect(urlVar?.id).toBe('button_url_0_var_1');
        expect(urlVar?.componentType).toBe('BUTTON');
    });

    // Smoke test 4: Template con header media → MEDIA
    it('template con header IMAGE → MEDIA descriptor', () => {
        expect(hasTemplateInputs(templateWithHeaderMedia)).toBe(true);
        const inputs = getTemplateInputs(templateWithHeaderMedia);
        expect(inputs[0].kind).toBe('MEDIA');
        expect(inputs[0].id).toBe('header_media');
        expect(inputs[0].componentType).toBe('HEADER');
        expect(inputs[0].placeholderIndex).toBeNull();
    });

    // Validación de mapping
    it('validateMapping detecta missing required', () => {
        const result = validateMapping(templateWithBodyVar, {});
        expect(result.valid).toBe(false);
        expect(result.missingRequired).toContain('body_var_1');
        expect(result.missingRequired).toContain('body_var_2');
    });

    it('validateMapping detecta unknown keys', () => {
        const mapping: TemplateInputMapping = {
            body_var_1: { mode: 'fixed', value: 'Juan' },
            body_var_2: { mode: 'fixed', value: 'ORD-123' },
            unknown_key: { mode: 'fixed', value: 'X' },
        };
        const result = validateMapping(templateWithBodyVar, mapping);
        expect(result.unknownKeys).toContain('unknown_key');
        expect(result.valid).toBe(false);
    });

    it('validateMapping rechaza contact_field no permitido', () => {
        const mapping: TemplateInputMapping = {
            body_var_1: { mode: 'contact_field', value: 'contact.internal_id' },
            body_var_2: { mode: 'fixed', value: 'ORD-123' },
        };
        const result = validateMapping(templateWithBodyVar, mapping);
        expect(result.invalidContactFields).toContain('body_var_1');
        expect(result.valid).toBe(false);
    });

    it('validateMapping acepta mapping completo y seguro', () => {
        const mapping: TemplateInputMapping = {
            body_var_1: { mode: 'contact_field', value: 'contact.name', fallback: 'Cliente' },
            body_var_2: { mode: 'fixed', value: 'ORD-456' },
        };
        const result = validateMapping(templateWithBodyVar, mapping);
        expect(result.valid).toBe(true);
        expect(result.missingRequired).toHaveLength(0);
        expect(result.unknownKeys).toHaveLength(0);
        expect(result.invalidContactFields).toHaveLength(0);
        expect(result.exceedsMaxLength).toHaveLength(0);
    });

    it('validateMapping detecta values excediendo maxLength', () => {
        const mapping: TemplateInputMapping = {
            body_var_1: { mode: 'fixed', value: 'a'.repeat(1025) },
            body_var_2: { mode: 'fixed', value: 'ORD-123' },
        };
        const result = validateMapping(templateWithBodyVar, mapping);
        expect(result.valid).toBe(false);
        expect(result.exceedsMaxLength).toContain('body_var_1');
    });
});

describe('tokenizador', () => {
    it('tokeniza texto simple sin vars', () => {
        const segments = tokenizeTemplateText('Hola pibe');
        expect(segments).toEqual([{ type: 'text', text: 'Hola pibe' }]);
    });

    it('tokeniza texto con múltiples vars', () => {
        const segments = tokenizeTemplateText('Hola {{1}}, pedido {{2}}.');
        expect(segments).toEqual([
            { type: 'text', text: 'Hola ' },
            { type: 'var', index: 1 },
            { type: 'text', text: ', pedido ' },
            { type: 'var', index: 2 },
            { type: 'text', text: '.' }
        ]);
    });

    it('tokeniza inicio y fin de vars', () => {
        const segments = tokenizeTemplateText('{{1}}{{1}}');
        expect(segments).toEqual([
            { type: 'var', index: 1 },
            { type: 'var', index: 1 }
        ]);
    });
});

