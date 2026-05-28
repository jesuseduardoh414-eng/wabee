import { z } from 'zod';

export const ImportTemplatesSchema = z.object({
    channelId: z.string().uuid()
});

export const ListTemplatesQuerySchema = z.object({
    status: z.enum(['APPROVED', 'PENDING', 'REJECTED', 'DISABLED']).optional(),
    language: z.string().optional(),
    category: z.enum(['MARKETING', 'UTILITY', 'AUTHENTICATION']).optional(),
    q: z.string().optional(), // Search by name
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20)
});

export type ImportTemplatesInput = z.infer<typeof ImportTemplatesSchema>;
export type ListTemplatesQuery = z.infer<typeof ListTemplatesQuerySchema>;
