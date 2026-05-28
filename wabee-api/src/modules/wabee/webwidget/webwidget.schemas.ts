import { z } from 'zod';

export const WebWidgetThemeSchema = z.object({
    primaryColor: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional(),
    position: z.enum(['bottom-right', 'bottom-left', 'right', 'left']).optional(),
    radius: z.union([z.number().min(0).max(32), z.string()]).optional(),
    headerStyle: z.string().optional(),
    bubbleStyle: z.string().optional()
}).partial();

export const WebWidgetContentSchema = z.object({
    title: z.string().optional(),
    subtitle: z.string().optional(),
    brandName: z.string().optional(),
    welcomeMessage: z.string().optional(),
    offlineMessage: z.string().optional(),
    fallbackMessage: z.string().optional(),
}).partial();

export const WebWidgetAiSchema = z.object({
    enabled: z.boolean().optional(),
    profileId: z.string().optional(),
    confidenceThreshold: z.number().min(0).max(100).optional(),
    takeoverEnabled: z.boolean().optional(),
}).partial();

export const WebWidgetFeaturesSchema = z.object({
    // Keep legacy or future flags here
    leadCaptureEnabled: z.boolean().optional(),
    attachmentsEnabled: z.boolean().optional(),
    poweredBy: z.boolean().optional()
}).partial();

export const CreateWebWidgetSchema = z.object({
    // Top-level legacy fields (optional, but good to have for initial create)
    title: z.string().min(1),
    subtitle: z.string().optional(),

    // New structured fields
    content: WebWidgetContentSchema.optional(),
    theme: WebWidgetThemeSchema.optional(),
    ai: WebWidgetAiSchema.optional(),
    features: WebWidgetFeaturesSchema.optional(),

    // Configuration
    domainAllowed: z.array(z.string()).optional(),
    welcomeMessage: z.string().optional(), // legacy
    aiEnabled: z.boolean().optional(), // legacy
});

export const UpdateWebWidgetSchema = CreateWebWidgetSchema.partial();

export const InboundMessageSchema = z.object({
    visitorId: z.string().min(1),
    sessionId: z.string().optional(),
    message: z.string().optional(),
    textBody: z.string().optional(),
    previewConfig: z.any().optional(), // Draft configuration for preview testing
}).transform((data) => {
    const text = (data.textBody || data.message || '').trim();
    return {
        ...data,
        textBody: text
    };
});

export type CreateWebWidgetInput = z.infer<typeof CreateWebWidgetSchema>;
export type UpdateWebWidgetInput = z.infer<typeof UpdateWebWidgetSchema>;
export type InboundMessageInput = z.infer<typeof InboundMessageSchema>;
