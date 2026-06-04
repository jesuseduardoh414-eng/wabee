import dotenv from 'dotenv';
dotenv.config();

/**
 * Centralized environment configuration for WABEE API.
 * All values come from process.env — nothing hardcoded for production.
 *
 * Priority for WhatsApp tokens:
 *   WHATSAPP_ACCESS_TOKEN (canonical, production)
 *   > WHATSAPP_TEST_ACCESS_TOKEN (dev/test alias)
 *   > META_WHATSAPP_TOKEN (legacy alias)
 */
export const env = {
    // ─── Runtime ────────────────────────────────────────────────────────────────
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: process.env.PORT || '4000',
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',

    // ─── Public URL (used for logs + OAuth callbacks) ────────────────────────────
    // In Render, RENDER_EXTERNAL_HOSTNAME is injected automatically.
    // APP_BASE_URL overrides it if set explicitly.
    APP_BASE_URL: process.env.APP_BASE_URL
        || (process.env.RENDER_EXTERNAL_HOSTNAME
            ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}`
            : 'http://localhost:4000'),

    RENDER_EXTERNAL_HOSTNAME: process.env.RENDER_EXTERNAL_HOSTNAME || '',

    // ─── CORS ───────────────────────────────────────────────────────────────────
    // CORS_ALLOWED_ORIGINS: comma-separated list of allowed origins.
    // Example: "https://wabee.onrender.com,https://app.wabee.io"
    // Falls back to CORS_ORIGIN (legacy single-origin) then '*' in dev.
    CORS_ALLOWED_ORIGINS: process.env.CORS_ALLOWED_ORIGINS
        || process.env.CORS_ORIGIN
        || (process.env.NODE_ENV === 'production' ? '' : '*'),

    FRONTEND_PUBLIC_URL: process.env.FRONTEND_PUBLIC_URL
        || process.env.FRONTEND_URL
        || 'http://localhost:5173',

    FRONTEND_URL: process.env.FRONTEND_URL || process.env.FRONTEND_PUBLIC_URL || 'http://localhost:5173',

    // ─── Database ────────────────────────────────────────────────────────────────
    DATABASE_URL: process.env.DATABASE_URL || '',

    // ─── Auth / JWT ──────────────────────────────────────────────────────────────
    JWT_SECRET: process.env.JWT_SECRET || '',
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',

    // ─── Supabase ────────────────────────────────────────────────────────────────
    SUPABASE_URL: process.env.SUPABASE_URL || '',
    SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY || '',

    // ─── WhatsApp Cloud API (PRODUCTION — canonical vars) ────────────────────────
    // These are the vars to fill in Render. No defaults; must be set in production.
    WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN
        || process.env.META_WHATSAPP_TOKEN
        || process.env.WHATSAPP_TEST_ACCESS_TOKEN
        || '',
    WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID
        || process.env.META_WHATSAPP_PHONE_NUMBER_ID
        || process.env.WHATSAPP_TEST_PHONE_NUMBER_ID
        || '',
    WHATSAPP_BUSINESS_ACCOUNT_ID: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
    WHATSAPP_VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN || '',

    // ─── WhatsApp test/dev aliases (kept for dev compatibility) ─────────────────
    WHATSAPP_TEST_ACCESS_TOKEN: process.env.WHATSAPP_TEST_ACCESS_TOKEN || '',
    WHATSAPP_TEST_PHONE_NUMBER_ID: process.env.WHATSAPP_TEST_PHONE_NUMBER_ID || '',
    WHATSAPP_TEST_DEFAULT_TO: process.env.WHATSAPP_TEST_DEFAULT_TO || '',
    WHATSAPP_TEST_ALLOWED_RECIPIENTS: process.env.WHATSAPP_TEST_ALLOWED_RECIPIENTS || '',
    META_WHATSAPP_TOKEN: process.env.META_WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN || '',
    META_WHATSAPP_PHONE_NUMBER_ID: process.env.META_WHATSAPP_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_NUMBER_ID || '',

    // ─── Meta / OAuth ────────────────────────────────────────────────────────────
    META_APP_ID: process.env.META_APP_ID || '',
    META_APP_SECRET: process.env.META_APP_SECRET || '',
    META_REDIRECT_URI: process.env.META_REDIRECT_URI || '',
    META_GRAPH_VERSION: process.env.META_GRAPH_VERSION || 'v19.0',

    // ─── Token encryption (for OAuth session storage) ────────────────────────────
    // Must be a 64-char hex string (32 bytes) in production.
    TOKEN_ENC_KEY: process.env.TOKEN_ENC_KEY
        || '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff',

    // ─── Billing (Stripe) ────────────────────────────────────────────────────────
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',

    // ─── SMTP ────────────────────────────────────────────────────────────────────
    SMTP_HOST: process.env.SMTP_HOST || '',
    SMTP_PORT: process.env.SMTP_PORT || '587',
    SMTP_USER: process.env.SMTP_USER || '',
    SMTP_PASS: process.env.SMTP_PASS || '',
    SMTP_FROM: process.env.SMTP_FROM || '',

    // ─── CRM AI Tools (internal key for crm-tools endpoints) ─────────────────────
    CRM_TOOLS_INTERNAL_KEY: process.env.CRM_TOOLS_INTERNAL_KEY || '',

    // ─── HubSpot CRM ─────────────────────────────────────────────────────────────
    HUBSPOT_CLIENT_ID:     process.env.HUBSPOT_CLIENT_ID     || '',
    HUBSPOT_CLIENT_SECRET: process.env.HUBSPOT_CLIENT_SECRET || '',

    // ─── Zoho CRM ────────────────────────────────────────────────────────────────
    ZOHO_CLIENT_ID:     process.env.ZOHO_CLIENT_ID     || '',
    ZOHO_CLIENT_SECRET: process.env.ZOHO_CLIENT_SECRET || '',

    // ─── Salesforce CRM ──────────────────────────────────────────────────────────
    SALESFORCE_CLIENT_ID:     process.env.SALESFORCE_CLIENT_ID     || '',
    SALESFORCE_CLIENT_SECRET: process.env.SALESFORCE_CLIENT_SECRET || '',

    // ─── Dynamics 365 ────────────────────────────────────────────────────────────
    DYNAMICS365_CLIENT_ID:     process.env.DYNAMICS365_CLIENT_ID     || '',
    DYNAMICS365_CLIENT_SECRET: process.env.DYNAMICS365_CLIENT_SECRET || '',
    DYNAMICS365_TENANT_ID:     process.env.DYNAMICS365_TENANT_ID     || 'common',
    DYNAMICS365_ORG_URL:       process.env.DYNAMICS365_ORG_URL       || '',

    // ─── AI ──────────────────────────────────────────────────────────────────────
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
    GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
    ENABLE_AI_WIDGET: process.env.ENABLE_AI_WIDGET || '',
    AI_WIDGET_ALWAYS_RESPOND: process.env.AI_WIDGET_ALWAYS_RESPOND || '',
    KB_TOP_K: process.env.KB_TOP_K || '3',
    AI_REQUEST_TIMEOUT_MS: process.env.AI_REQUEST_TIMEOUT_MS || '15000',
    AI_DEBUG_LEVEL: process.env.AI_DEBUG_LEVEL || 'none',
} as const;

// ─── Production guards ────────────────────────────────────────────────────────
if (env.NODE_ENV === 'production') {
    const required = [
        'DATABASE_URL',
        'JWT_SECRET',
        'SUPABASE_URL',
        'SUPABASE_SERVICE_KEY',
        'WHATSAPP_ACCESS_TOKEN',
        'WHATSAPP_PHONE_NUMBER_ID',
        'WHATSAPP_VERIFY_TOKEN',
        'META_APP_SECRET',
    ];
    const missing = required.filter(k => !env[k as keyof typeof env]);
    if (missing.length > 0) {
        console.error(`[Config] ❌ Missing required env vars in production: ${missing.join(', ')}`);
        // Do not throw — let the service start and surface the error via health check.
        // Remove the comment above if you prefer a hard crash on startup.
    }
}

/**
 * Devuelve el JWT_SECRET validado. Lanza si no está configurado.
 * Reemplaza el antiguo fallback inseguro `'fallback-secret'`, que permitía
 * falsificar tokens si la variable de entorno faltaba.
 */
export function requireJwtSecret(): string {
    const secret = env.JWT_SECRET;
    if (!secret || secret.length < 16) {
        throw new Error('JWT_SECRET no está configurado (o es demasiado corto). Configúralo en las variables de entorno.');
    }
    return secret;
}

export default env;
