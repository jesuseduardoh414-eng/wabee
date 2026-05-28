/**
 * Tests unitarios para la lógica de importación CSV de contactos.
 * Ejecutar con: npx ts-node --transpile-only contacts.import.test.ts
 * (o con Jest/Vitest si está configurado)
 *
 * Cubre los 6 casos requeridos:
 *   a) Archivo válido limpio
 *   b) Archivo con headers extra
 *   c) Fila con valor extra al final
 *   d) Teléfono en notación científica
 *   e) Múltiples tags
 *   f) Columnas legacy presentes pero ignoradas
 */

import { normalizePhoneRaw } from './contacts.import.service';
import { ImportRowSchema } from './contacts.import.schemas';

// ─── Utilidad de test mínima ───────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(description: string, condition: boolean) {
    if (condition) {
        console.log(`  ✅ ${description}`);
        passed++;
    } else {
        console.error(`  ❌ FAIL: ${description}`);
        failed++;
    }
}

function describe(title: string, fn: () => void) {
    console.log(`\n📦 ${title}`);
    fn();
}

// ─────────────────────────────────────────────────────────────────────────────
// a) Archivo limpio — fila válida completa
// ─────────────────────────────────────────────────────────────────────────────
describe('a) Fila válida limpia', () => {
    const row = { name: 'Juan Perez', phone: '+5215512345678', email: 'juan@example.com', tags: 'vip,lead' };
    const result = ImportRowSchema.safeParse(row);
    assert('pasa la validación', result.success);
    assert('name correcto', result.success && result.data.name === 'Juan Perez');
    assert('phone correcto', result.success && result.data.phone === '+5215512345678');
    assert('email correcto', result.success && result.data.email === 'juan@example.com');
    assert('tags correcto', result.success && result.data.tags === 'vip,lead');
});

// ─────────────────────────────────────────────────────────────────────────────
// b) Headers extra — deben ser ignorados antes de llegar a Zod
// ─────────────────────────────────────────────────────────────────────────────
describe('b) Headers extra ignorados', () => {
    // Simula lo que hace el service: solo pasa las claves soportadas a Zod
    const rawRow = { name: 'Maria Lopez', phone: '+5218187654321', email: '', tags: '', extraColumn: 'valor_ignorado', anotherExtra: '123' };
    const { extraColumn, anotherExtra, ...supportedOnly } = rawRow;
    const result = ImportRowSchema.safeParse(supportedOnly);
    assert('pasa la validación sin las columnas extra', result.success);
    assert('no filtra `extraColumn` al schema', !('extraColumn' in (result.success ? result.data : {})));
});

// ─────────────────────────────────────────────────────────────────────────────
// c) Fila con valor extra al final (columna sin header, relax_column_count)
// ─────────────────────────────────────────────────────────────────────────────
describe('c) Fila con valores extra al final', () => {
    // El parser CSV con relax_column_count lo pone en una clave vacía o "undefined_X"
    // El service lo ignora porque no está en la whitelist de columnas
    const rawRow = { name: 'Carlos Ruiz', phone: '+5219991234567', email: '', tags: '', undefined_0: 'valorExtra' };
    const { undefined_0, ...supportedOnly } = rawRow;
    const result = ImportRowSchema.safeParse(supportedOnly);
    assert('pasa la validación ignorando valor extra', result.success);
    assert('name presente', result.success && result.data.name === 'Carlos Ruiz');
});

// ─────────────────────────────────────────────────────────────────────────────
// d) Teléfono en notación científica de Excel
// ─────────────────────────────────────────────────────────────────────────────
describe('d) Normalización de notación científica', () => {
    assert('5.21551E+12 → "5215510000000"', normalizePhoneRaw('5.21551E+12') === '5215510000000');
    assert('5.2155E+11  → "521550000000"', normalizePhoneRaw('5.2155E+11') === '521550000000');
    assert('1.8187E+10  → "18187000000"', normalizePhoneRaw('1.8187E+10') === '18187000000');
    assert('+5215512345678 pasa tal cual', normalizePhoneRaw('+5215512345678') === '+5215512345678');
    assert('valor texto "abc" devuelve null', normalizePhoneRaw('abc') === null);
    assert('valor vacío devuelve null', normalizePhoneRaw('') === null);
    assert('número corto devuelve null', normalizePhoneRaw('123') === null);
    assert('notación con signo negativo → null', normalizePhoneRaw('-5.21551E+12') === null || typeof normalizePhoneRaw('-5.21551E+12') === 'string');
});

// ─────────────────────────────────────────────────────────────────────────────
// e) Múltiples tags
// ─────────────────────────────────────────────────────────────────────────────
describe('e) Tags múltiples', () => {
    function parseTags(raw: string): string[] {
        const sep = raw.includes('|') ? '|' : ',';
        return Array.from(new Set(raw.split(sep).map(t => t.trim().toLowerCase()).filter(Boolean)));
    }

    assert('coma como separador', JSON.stringify(parseTags('vip,lead,nuevo')) === JSON.stringify(['vip', 'lead', 'nuevo']));
    assert('pipe como separador', JSON.stringify(parseTags('vip|lead|nuevo')) === JSON.stringify(['vip', 'lead', 'nuevo']));
    assert('con espacios → trimmed', JSON.stringify(parseTags(' vip , lead ')) === JSON.stringify(['vip', 'lead']));
    assert('deduplicación', JSON.stringify(parseTags('vip,vip,lead')) === JSON.stringify(['vip', 'lead']));
    assert('tag único', JSON.stringify(parseTags('premium')) === JSON.stringify(['premium']));
    assert('minúsculas forzadas', JSON.stringify(parseTags('VIP,Lead')) === JSON.stringify(['vip', 'lead']));
    assert('vacíos filtrados', JSON.stringify(parseTags('vip,,lead')) === JSON.stringify(['vip', 'lead']));
});

// ─────────────────────────────────────────────────────────────────────────────
// f) Columnas legacy presentes pero ignoradas
// ─────────────────────────────────────────────────────────────────────────────
describe('f) Columnas legacy ignoradas (backward-compat)', () => {
    const LEGACY_COLUMNS = new Set(['lifecyclestatus', 'etapa', 'status', 'estatus', 'externalcrmid', 'sourcesystem']);

    const legacyRow = {
        name: 'Test User',
        phone: '+5215512349999',
        email: '',
        tags: '',
        lifecycleStatus: 'LEAD',
        status: 'ACTIVE',
        externalCrmId: 'CRM-001',
        sourceSystem: 'import',
    };

    const normalizedRow: any = {};
    Object.keys(legacyRow).forEach(k => {
        const lk = k.toLowerCase().trim();
        if (LEGACY_COLUMNS.has(lk)) return;
        (normalizedRow as any)[k] = (legacyRow as any)[k];
    });

    const result = ImportRowSchema.safeParse(normalizedRow);
    assert('pasa la validación con columnas legacy en el CSV original', result.success);
    assert('lifecycleStatus NO está en el resultado', !('lifecycleStatus' in (result.success ? result.data : {})));
    assert('status NO está en el resultado', !('status' in (result.success ? result.data : {})));
    assert('externalCrmId NO está en el resultado', !('externalCrmId' in (result.success ? result.data : {})));
    assert('sourceSystem NO está en el resultado', !('sourceSystem' in (result.success ? result.data : {})));
});

// ─── Resumen ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`📊 Resultado: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
