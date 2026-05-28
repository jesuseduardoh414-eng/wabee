import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
    SUPABASE_URL: z.string().url(),
    SUPABASE_SERVICE_KEY: z.string(),
    JWT_SECRET: z.string(),
    JWT_REFRESH_SECRET: z.string(),
    JWT_EXPIRES_IN: z.string().default('24h'),
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    FRONTEND_URL: z.string().url().optional(),
    SUPERADMIN_PLAN_MANAGEMENT: z.string().transform(v => v === 'true').default('false'),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.string().transform(Number).optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_FROM: z.string().optional(),
});

export const coreEnv = envSchema.parse(process.env);
