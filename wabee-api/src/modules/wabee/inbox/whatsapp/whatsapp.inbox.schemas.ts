import { z } from 'zod';

export const ResolveThreadSchema = z.object({
    contactId: z.string().min(1, 'contactId is required'),
    channelId: z.string().uuid().optional().nullable(),
});

export const SendMessageSchema = z.object({
    text: z.string().min(1, 'El campo "text" es requerido.'),
});

export const ThreadStatusUpdateSchema = z.object({
    status: z.enum(['OPEN', 'CLOSED', 'SNOOZED', 'PENDING']),
});
