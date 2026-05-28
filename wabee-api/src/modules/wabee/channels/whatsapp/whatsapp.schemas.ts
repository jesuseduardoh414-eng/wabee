import { z } from 'zod';

export const CreateWhatsAppChannelSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    purpose: z.enum(['SALES', 'SUPPORT', 'GENERAL']).default('GENERAL'),
    wabaId: z.string().min(1, 'WABA ID is required'),
    phoneNumberId: z.string().min(1, 'Phone Number ID is required'),
    metaAppId: z.string().optional(),  // FB App ID (troubleshooting)
    displayPhone: z.string().optional(),
    verifiedName: z.string().optional()
});

export const ConnectManualChannelSchema = CreateWhatsAppChannelSchema;

export const DetectChannelSchema = z.object({
    purpose: z.enum(['SALES', 'SUPPORT', 'GENERAL']).default('GENERAL'),
});

export const UpdateWhatsAppChannelSchema = z.object({
    name: z.string().optional(),
    purpose: z.enum(['SALES', 'SUPPORT', 'GENERAL']).optional(),
    status: z.enum(['CONNECTED', 'DISCONNECTED', 'ERROR', 'SUSPENDED', 'ARCHIVED']).optional(),
});

export const TestMessageSchema = z.object({
    to: z.string().min(1, 'Recipient (to) is required'),
    text: z.string().min(1, 'Message text is required'),
});

export type CreateWhatsAppChannelInput = z.infer<typeof CreateWhatsAppChannelSchema>;
export type ConnectManualChannelInput = z.infer<typeof ConnectManualChannelSchema>;
export type UpdateWhatsAppChannelInput = z.infer<typeof UpdateWhatsAppChannelSchema>;
export type TestMessageInput = z.infer<typeof TestMessageSchema>;
