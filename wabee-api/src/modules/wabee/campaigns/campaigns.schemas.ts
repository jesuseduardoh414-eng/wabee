import { z } from 'zod';

export const CampaignAudienceTypeSchema = z.enum(['SEGMENT', 'GROUP', 'TAGS', 'ALL_ACTIVE']);

/**
 * Entrada de mapping de variable de template (hardened).
 * - mode: 'fixed' (valor literal) | 'contact_field' (campo del modelo Contact) | 'fixed_media' (archivo/handle media)
 * - value: el valor o el nombre del campo (ej: "contact.name")
 * - fallback: valor de respaldo si el campo de contacto está vacío
 * NOTE: "computed" deshabilitado en v1 por seguridad.
 */
export const InputMappingEntrySchema = z.object({
    mode: z.enum(['fixed', 'contact_field', 'fixed_media']),
    value: z.string().min(1, 'El valor no puede estar vacío'),
    fallback: z.string().optional(),
});

export const TemplateInputMappingSchema = z.record(InputMappingEntrySchema).nullable().optional();

export const CreateCampaignSchema = z.object({
    name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres').max(100),
    channelId: z.string().uuid('ID de canal inválido'),
    templateId: z.string().uuid('ID de plantilla inválido').nullable().optional(),
    audienceType: CampaignAudienceTypeSchema,
    audienceFilter: z.any().optional(),
    scheduledAt: z.string().nullable().refine(
        (val) => val === null || !isNaN(new Date(val).getTime()),
        { message: 'scheduledAt debe ser una fecha válida (ISO 8601 o datetime-local) o null' }
    ).optional(),
    templateInputMapping: TemplateInputMappingSchema,

});

export const UpdateCampaignSchema = CreateCampaignSchema.partial();

export const CampaignOperationSchema = z.object({
    action: z.enum(['START', 'PAUSE', 'RESUME', 'CANCEL']),
    pauseReason: z.string().optional(),
});

export type CreateCampaignInput = z.infer<typeof CreateCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof UpdateCampaignSchema>;
export type CampaignOperationInput = z.infer<typeof CampaignOperationSchema>;
