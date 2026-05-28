// @ts-ignore
import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import { prisma } from '../../../config/core/core.prisma';
import { normalizePhone, ContactsService } from './contacts.service';
import { LimitsService } from '../../billing/limits.service';
import { ImportRowSchema, ImportResultSchema } from './contacts.import.schemas';

// ─────────────────────────────────────────────────────────────────────────────
//  Columnas admitidas (whitelist)
// ─────────────────────────────────────────────────────────────────────────────
const SUPPORTED_COLUMNS = new Set(['phone', 'telefono', 'name', 'nombre', 'email', 'correo', 'tags', 'etiquetas']);

/** Columnas legacy que se descartan silenciosamente (backward-compat) */
const LEGACY_COLUMNS = new Set([
    'lifecyclestatus', 'etapa',
    'status', 'estatus',
    'externalcrmid',
    'sourcesystem',
]);

// ─────────────────────────────────────────────────────────────────────────────
//  Normalización de teléfono con soporte de notación científica de Excel
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Convierte valores como "5.21551E+12" → "5215510000000", y limpia formato.
 * Retorna null si el valor no puede normalizarse con seguridad.
 */
export function normalizePhoneRaw(raw: string): string | null {
    const trimmed = raw.trim();

    // Notación científica: e.g. "5.21551E+12" o "5.21551e+12"
    const scientificMatch = trimmed.match(/^([+\-]?\d+\.?\d*)[eE]([+\-]?\d+)$/);
    if (scientificMatch) {
        const num = Number(trimmed);
        if (!isFinite(num) || isNaN(num)) return null;
        // Convertir a entero string sin notación científica
        return Math.round(num).toString();
    }

    // Eliminar caracteres no numéricos excepto el "+" al inicio
    const cleaned = trimmed.replace(/\s/g, '');
    // Permitir: dígitos, "+" al inicio, "-", ".", "(", ")"
    const onlyDigitsAndPlus = cleaned.replace(/[^\d+]/g, '');

    if (onlyDigitsAndPlus.length < 8) return null;
    return onlyDigitsAndPlus;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Parse de tags
// ─────────────────────────────────────────────────────────────────────────────
function parseTags(raw: string | null | undefined): string[] | undefined {
    if (!raw) return undefined;
    const separator = raw.includes('|') ? '|' : ',';
    const parts = raw.split(separator)
        .map(t => t.trim().toLowerCase())
        .filter(Boolean);
    if (parts.length === 0) return undefined;
    return Array.from(new Set(parts)).slice(0, 100);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Resultado extendido con warnings
// ─────────────────────────────────────────────────────────────────────────────
export interface ImportResult {
    created: number;
    updated: number;
    skipped: number;
    errors: Array<{ row: number; phone?: string; reason: string }>;
    warnings: Array<{ type: string; detail: string }>;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Servicio principal
// ─────────────────────────────────────────────────────────────────────────────
export class ContactsImportService {
    static async processImport(tenantId: string, fileBuffer: Buffer, limit?: number | null): Promise<ImportResult> {
        // 1. Validar módulo/límite (null = bloqueado)
        if (limit === null || limit === undefined) {
             throw { status: 403, message: 'El módulo de contactos no está disponible en tu plan actual.' };
        }
        
        const fileContent = fileBuffer.toString('utf-8');

        // Auto-detect delimiter (coma o punto y coma)
        const firstLine = fileContent.split('\n')[0];
        const delimiter = firstLine.includes(';') ? ';' : ',';

        let records: any[];
        try {
            records = parse(fileContent, {
                columns: true,
                skip_empty_lines: true,
                trim: true,
                delimiter,
                relax_column_count: true,   // no fallar si falta/sobra alguna columna
                relax_quotes: true,          // tolerancia a comillas mal cerradas
                skip_records_with_empty_values: false,
            });
        } catch (parseError: any) {
            return {
                created: 0, updated: 0, skipped: 0,
                errors: [{ row: 0, reason: `Error al parsear el archivo CSV: ${parseError.message}` }],
                warnings: [],
            };
        }

        if (!records || records.length === 0) {
            return { created: 0, updated: 0, skipped: 0, errors: [], warnings: [{ type: 'EMPTY_FILE', detail: 'El archivo CSV no contiene filas de datos.' }] };
        }

        // ── Detectar columnas extra / legacy en el header ──────────────────────
        const fileHeaders = Object.keys(records[0]).map(h => h.toLowerCase().trim());
        const globalWarnings: ImportResult['warnings'] = [];

        const unknownHeaders = fileHeaders.filter(h => !SUPPORTED_COLUMNS.has(h) && !LEGACY_COLUMNS.has(h));
        const legacyHeaders = fileHeaders.filter(h => LEGACY_COLUMNS.has(h));

        if (legacyHeaders.length > 0) {
            globalWarnings.push({
                type: 'LEGACY_COLUMNS_IGNORED',
                detail: `Columnas antiguas ignoradas: ${legacyHeaders.join(', ')}`,
            });
        }
        if (unknownHeaders.length > 0) {
            globalWarnings.push({
                type: 'UNKNOWN_COLUMNS_IGNORED',
                detail: `Columnas desconocidas ignoradas: ${unknownHeaders.join(', ')}`,
            });
        }

        let created = 0;
        let updated = 0;
        let skipped = 0;
        const errors: ImportResult['errors'] = [];

        // Límite de 5000 filas por importación
        const rowsToProcess = records.slice(0, 5000);

        // ── PRE-VALIDACIÓN DE LÍMITES (TODO-O-NADA) ───────────────────────────
        if (limit !== -1) {
            const currentCount = await LimitsService.countContacts(tenantId);
            
            // Recolectar teléfonos únicos válidos del archivo
            const phonesInFile = new Set<string>();
            for (const row of rowsToProcess) {
                const rawPhone = row.phone || row.telefono;
                if (rawPhone) {
                    const normalized = normalizePhoneRaw(String(rawPhone));
                    if (normalized) {
                        try {
                            phonesInFile.add(normalizePhone(normalized));
                        } catch {}
                    }
                }
            }

            if (phonesInFile.size > 0) {
                // Consultar cuáles de estos ya existen en la DB
                const existingPhones = await prisma.contact.findMany({
                    where: {
                        tenantId,
                        phone: { in: Array.from(phonesInFile) }
                    },
                    select: { phone: true }
                });

                const existingCountInFile = existingPhones.length;
                const newContactsCount = phonesInFile.size - existingCountInFile;

                // Validar si la importación completa excede el límite
                if (currentCount + newContactsCount > limit) {
                    throw {
                        status: 422,
                        message: `La importación excede el límite de contactos de tu plan (Máximo: ${limit}). No se cargó ningún registro.`
                    };
                }
            }
        }
        // ─────────────────────────────────────────────────────────────────────

        for (const [index, row] of rowsToProcess.entries()) {
            const rowIndex = index + 1;

            // ── Normalizar claves y extraer solo columnas soportadas ────────────
            const normalizedRow: any = {};
            let rowHasExtraValues = false;

            Object.keys(row as any).forEach(k => {
                const lowerKey = k.toLowerCase().trim();
                const value = (row as any)[k];
                const cleanValue = typeof value === 'string' && value.trim() === '' ? undefined : value;

                if (LEGACY_COLUMNS.has(lowerKey)) return; // ignorar silenciosamente

                if (lowerKey === 'phone' || lowerKey === 'telefono') normalizedRow.phone = cleanValue;
                else if (lowerKey === 'name' || lowerKey === 'nombre') normalizedRow.name = cleanValue;
                else if (lowerKey === 'email' || lowerKey === 'correo') normalizedRow.email = cleanValue;
                else if (lowerKey === 'tags' || lowerKey === 'etiquetas') normalizedRow.tags = cleanValue;
                else if (!LEGACY_COLUMNS.has(lowerKey)) {
                    // Columna extra desconocida: marcar warning por fila pero no fallar
                    rowHasExtraValues = true;
                }
            });

            if (rowHasExtraValues) {
                globalWarnings.push({
                    type: 'ROW_EXTRA_COLUMNS',
                    detail: `Fila ${rowIndex}: contiene columnas extra que fueron ignoradas.`,
                });
            }

            // ── Normalizar teléfono (soporte notación científica) ───────────────
            if (normalizedRow.phone != null) {
                const normalized = normalizePhoneRaw(String(normalizedRow.phone));
                if (normalized === null) {
                    errors.push({
                        row: rowIndex,
                        phone: String(normalizedRow.phone),
                        reason: `phone: Valor de teléfono inválido o no normalizable: "${normalizedRow.phone}". Si viene de Excel, guárdalo como texto plano antes de exportar.`,
                    });
                    skipped++;
                    continue;
                }
                normalizedRow.phone = normalized;
            }

            // ── Validación Zod ──────────────────────────────────────────────────
            const validation = ImportRowSchema.safeParse(normalizedRow);
            if (!validation.success) {
                errors.push({
                    row: rowIndex,
                    phone: normalizedRow.phone || 'Desconocido',
                    reason: validation.error.issues
                        .map(i => `${i.path.join('.')}: ${i.message}`)
                        .join(', '),
                });
                skipped++;
                continue;
            }

            const data = validation.data;
            let phone: string;
            try {
                phone = normalizePhone(data.phone);
            } catch {
                errors.push({ row: rowIndex, phone: data.phone, reason: 'phone: No se pudo normalizar el número de teléfono.' });
                skipped++;
                continue;
            }

            // ── Parse de tags ───────────────────────────────────────────────────
            const tags = parseTags(data.tags);

            try {
                const existing = await prisma.contact.findUnique({
                    where: { tenantId_phone: { tenantId, phone } },
                });

                if (existing) {
                    // Actualización selectiva: solo campos presentes y no vacíos
                    const updateData: any = {};
                    if (data.name) updateData.name = data.name;
                    if (data.email) updateData.email = data.email;
                    if (tags) {
                        const existingTags = Array.isArray(existing.tags) ? existing.tags as string[] : [];
                        updateData.tags = Array.from(new Set([...existingTags, ...tags])).slice(0, 100);
                    }

                    if (Object.keys(updateData).length > 0) {
                        await prisma.contact.update({ where: { id: existing.id }, data: updateData });
                        updated++;
                    } else {
                        skipped++; // sin cambios detectados
                    }
                } else {
                    // Creación: campos eliminados del CSV usan defaults seguros
                    await prisma.contact.create({
                        data: {
                            tenantId,
                            phone,
                            name: data.name || undefined,
                            email: data.email || undefined,
                            tags: tags || [],
                            status: 'ACTIVE',
                            lifecycleStatus: 'NEW',
                            sourceSystem: 'import',
                        },
                    });
                    created++;
                }
            } catch (error: any) {
                errors.push({
                    row: rowIndex,
                    phone,
                    reason: error.message || 'Error de base de datos',
                });
                skipped++;
            }
        }

        return { created, updated, skipped, errors, warnings: globalWarnings };
    }
}
