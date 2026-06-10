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

export const CreateTemplateSchema = z.object({
    name: z
        .string()
        .min(1)
        .max(512)
        .regex(/^[a-z0-9_]+$/, 'Solo minúsculas, números y guiones bajos'),
    category: z.enum(['MARKETING', 'UTILITY', 'AUTHENTICATION']),
    language: z.string().min(2).max(10),
    headerText: z.string().max(60).optional(),
    body: z.string().min(1).max(1024),
    footer: z.string().max(60).optional(),
});

export type ImportTemplatesInput = z.infer<typeof ImportTemplatesSchema>;
export type ListTemplatesQuery = z.infer<typeof ListTemplatesQuerySchema>;
export type CreateTemplateInput = z.infer<typeof CreateTemplateSchema>;
