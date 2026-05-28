import { z } from 'zod';

// DTO Schemas
export const CreateAiProfileSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    tones: z.array(z.string()).default([]),
    systemPrompt: z.string().min(10, 'System prompt is required'),
    maxTokens: z.number().int().min(50).max(4000).default(512),
    fallbackMode: z.enum(['PRESET_A', 'PRESET_B', 'PRESET_C', 'CUSTOM']).default('CUSTOM'),
    fallbackCustomMessage: z.string().optional(),
    confidenceThreshold: z.number().min(0).max(1).default(0.6),
    channelType: z.enum(['WIDGET', 'WHATSAPP']).default('WIDGET'),
    greetingStyle: z.enum(['SHORT', 'MEDIUM', 'WARM']).default('WARM'),
    fallbackMessage: z.string().optional().nullable(),
    kbEnabled: z.boolean().default(true),
    agentName: z.string().optional().nullable(),
    roleTitle: z.string().optional().nullable(),
    personalityNotes: z.string().optional().nullable(),
    examples: z.array(z.object({
        user: z.string(),
        assistant: z.string()
    })).optional(),
});

export const UpdateAiProfileSchema = CreateAiProfileSchema.partial();

export const AiPauseThreadSchema = z.object({
    userId: z.string().uuid(),
});

export const AiAuditQuerySchema = z.object({
    widgetId: z.string().uuid().optional(),
    threadId: z.string().uuid().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
});

// Types
export type CreateAiProfileDTO = z.infer<typeof CreateAiProfileSchema>;
export type UpdateAiProfileDTO = z.infer<typeof UpdateAiProfileSchema>;
export type AiPauseThreadDTO = z.infer<typeof AiPauseThreadSchema>;
export type AiAuditQueryDTO = z.infer<typeof AiAuditQuerySchema>;
