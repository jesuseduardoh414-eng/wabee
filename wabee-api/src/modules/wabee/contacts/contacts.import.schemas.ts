import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
//  Schema de fila CSV
//  Formato soportado: name,phone,email,tags
// ─────────────────────────────────────────────────────────────────────────────
export const ImportRowSchema = z.object({
    // Requeridos
    name: z.string().min(1, 'El nombre es obligatorio'),
    phone: z.string().min(7, 'El teléfono debe tener al menos 7 caracteres'),

    // Opcionales — nunca causan error de validación si están ausentes o vacíos
    email: z.string().email('Formato de email inválido').optional().nullable().or(z.literal('')),
    tags: z.string().optional().nullable(),
});

export type ImportRowInput = z.infer<typeof ImportRowSchema>;

// ─────────────────────────────────────────────────────────────────────────────
//  Schema del resultado (incluye warnings)
// ─────────────────────────────────────────────────────────────────────────────
export const ImportResultSchema = z.object({
    created: z.number(),
    updated: z.number(),
    skipped: z.number(),
    errors: z.array(z.object({
        row: z.number(),
        phone: z.string().optional(),
        reason: z.string(),
    })),
    warnings: z.array(z.object({
        type: z.string(),
        detail: z.string(),
    })),
});
