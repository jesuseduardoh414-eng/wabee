import { z } from 'zod';

export const MetaOAuthCallbackSchema = z.object({
    code: z.string().min(1, 'Authorisation code is required'),
    state: z.string().min(1, 'State is required'),
});

export type MetaOAuthCallbackInput = z.infer<typeof MetaOAuthCallbackSchema>;
