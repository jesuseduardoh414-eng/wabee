import { z } from 'zod';

export const ImportTemplatesSchema = z.object({
    channelId: z.string().uuid()
});

export const ListTemplatesQuerySchema = z.object({
    status: z.enum(['APPROVED', 'PENDING', 'REJECTED', 'DISABLED']).optional(),
    language: z.string().optional(),
    category: z.enum(['MARKETING', 'UTILITY', 'AUTHENTICATION']).optional(),
    q: z.string().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20)
});

const ButtonSchema = z.discriminatedUnion('type', [
    z.object({
        type: z.literal('QUICK_REPLY'),
        text: z.string().min(1).max(25),
    }),
    z.object({
        type: z.literal('URL'),
        text: z.string().min(1).max(25),
        url: z.string().url(),
    }),
    z.object({
        type: z.literal('PHONE_NUMBER'),
        text: z.string().min(1).max(25),
        phone: z.string().min(7).max(20),
    }),
]);

export const CreateTemplateSchema = z.discriminatedUnion('category', [
    // AUTHENTICATION — structure fija de Meta, sin cuerpo personalizado
    z.object({
        category: z.literal('AUTHENTICATION'),
        name: z.string().min(1).max(512).regex(/^[a-z0-9_]+$/, 'Solo minúsculas, números y guiones bajos'),
        language: z.string().min(2).max(10),
        addSecurityRecommendation: z.boolean().default(true),
        codeExpirationMinutes: z.coerce.number().int().min(1).max(90).optional(),
    }),
    // MARKETING / UTILITY — texto libre con botones opcionales
    z.object({
        category: z.enum(['MARKETING', 'UTILITY']),
        name: z.string().min(1).max(512).regex(/^[a-z0-9_]+$/, 'Solo minúsculas, números y guiones bajos'),
        language: z.string().min(2).max(10),
        headerText: z.string().max(60).optional(),
        body: z.string().min(1).max(1024),
        bodyExamples: z.array(z.string().max(100)).optional(),
        footer: z.string().max(60).optional(),
        buttons: z.array(ButtonSchema).max(3).optional(),
    }),
]);

export type ImportTemplatesInput = z.infer<typeof ImportTemplatesSchema>;
export type ListTemplatesQuery = z.infer<typeof ListTemplatesQuerySchema>;
export type CreateTemplateInput = z.infer<typeof CreateTemplateSchema>;
export type TemplateButton = z.infer<typeof ButtonSchema>;
