import { AuthFactory, CoreIamConfig } from '@r4d-26/core';
import { coreEnv } from './core.env';
import { applyNotificationPatch } from './core-notification.patch';

// Configuración tipada para v5.x
export const myConfig: CoreIamConfig = {
    supabase: {
        url: coreEnv.SUPABASE_URL,
        serviceKey: coreEnv.SUPABASE_SERVICE_KEY,
    },
    jwt: {
        secret: coreEnv.JWT_SECRET,
        refreshSecret: coreEnv.JWT_REFRESH_SECRET,
        expiresIn: coreEnv.JWT_EXPIRES_IN,
    },
    billing: coreEnv.STRIPE_SECRET_KEY ? {
        provider: 'stripe',
        secretKey: coreEnv.STRIPE_SECRET_KEY,
        webhookSecret: coreEnv.STRIPE_WEBHOOK_SECRET,
        returnUrl: `${coreEnv.FRONTEND_URL}/billing/callback`,
    } : undefined,
    emails: coreEnv.SMTP_HOST ? {
        provider: 'smtp',
        smtp: {
            host: coreEnv.SMTP_HOST,
            port: coreEnv.SMTP_PORT as number,
            user: coreEnv.SMTP_USER as string,
            pass: coreEnv.SMTP_PASS as string,
            from: coreEnv.SMTP_FROM as string,
        },
    } : undefined,
    storage: {
        provider: 'supabase',
        bucket: 'media'
    }
};

// initialize() without args — the package creates its own CorePrismaClient from DATABASE_URL
// and registers it via initPrisma(), making it accessible via getPrisma() everywhere.
export const core = AuthFactory.withConfig(myConfig).initialize();

// Inyectamos el motor de personalización de correos
applyNotificationPatch(core);
