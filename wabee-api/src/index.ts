import dotenv from 'dotenv';
dotenv.config();

// ── Redis resilience patch: must run BEFORE any module that imports @r4d-26/core ──
import { applyRedisPatch } from './config/core/redis.patch';
applyRedisPatch();

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import * as crypto from 'crypto';

import { authRoutes } from './modules/auth/auth.routes';
import { dashboardRoutes } from './modules/dashboard/dashboard.routes';
import { orgRoutes } from './modules/organizations/org.routes';
import { billingRoutes } from './modules/billing/billing.routes';
import { superAdminPlansRoutes } from './modules/billing/admin.routes';
import { stripeWebhookRoutes } from './modules/billing/stripe.webhook';
import { superAdminRoutes } from './modules/super-admin/super-admin.routes';
import { dataDeletionPublicRoutes, dataDeletionAdminRoutes } from './modules/super-admin/data-deletion.routes';

// --- WABEE LEGACY MODULES ---
import wabeeContactsRoutes from './modules/wabee/contacts/contacts.routes';
import wabeeInboxRoutes from './modules/wabee/inbox/whatsapp/whatsapp.inbox.routes';
import wabeeInboxRolesRoutes from './modules/wabee/inbox/inbox.routes';
import wabeeChannelsRoutes from './modules/wabee/channels/whatsapp/whatsapp.routes';
import wabeeWhatsappOutboundRoutes from './modules/wabee/whatsapp/outbound/whatsapp.outbound.routes';
import wabeeAiRoutes from './modules/wabee/ai/ai.routes';
import { publicRouter as wabeePublicWidgetRoutes, webWidgetAdminRouter as wabeeAdminWidgetRoutes, webWidgetPreviewRouter } from './modules/wabee/webwidget/webwidget.routes';
import metaOauthRoutes from './modules/oauth/meta/meta.oauth.routes';
import campaignsRoutes from './modules/wabee/campaigns/campaigns.routes';
import analyticsRoutes from './modules/wabee/analytics/analytics.routes';
import { notificationsRoutes } from './modules/wabee/notifications/notifications.routes';
import { auditRoutes } from './modules/wabee/audit/audit.routes';
import realtimeRoutes from './modules/wabee/realtime/realtime.routes';
import wabeeDashboardRoutes from './modules/wabee/dashboard/dashboard.routes';

import { CampaignWebhook } from './modules/wabee/campaigns/campaign.webhook';
import { CampaignWorker } from './modules/wabee/campaigns/campaign.worker';
import { AnalyticsAggregator } from './modules/wabee/analytics/analytics.aggregator';
import { prisma } from './config/core/core.prisma';
import { CoreInternalService } from './modules/core/core.internal.service';
import { DEFAULT_EMAIL_GLOBAL, DEFAULT_EMAIL_TEMPLATES } from './modules/wabee/email-customization/email-defaults';
import { env } from './config/env';
import { DatabaseBootstrap } from './config/core/db.bootstrap';
import { initStorage } from './lib/supabase-storage';

const app = express();
const port = Number(process.env.PORT) || 4000;

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Soporta múltiples orígenes separados por coma en CORS_ALLOWED_ORIGINS.
// En dev (NODE_ENV !== 'production') permite *, en prod requiere lista explícita.
const allowedOrigins: string[] = env.CORS_ALLOWED_ORIGINS
    ? env.CORS_ALLOWED_ORIGINS.split(',').map((o: string) => o.trim()).filter(Boolean)
    : [];

const corsStrictOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
        // Peticiones sin origin (curl, Postman, server-to-server) siempre permitidas
        if (!origin) return callback(null, true);
        if (allowedOrigins.length === 0 || allowedOrigins.includes('*')) {
            return callback(null, true);
        }
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
};

const corsPublicOptions: cors.CorsOptions = {
    origin: '*', // Permitir cualquier origen
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false // Rutas verdaderamente públicas no usan cookies/sesión
};

// ─── Stripe Webhook — MUST come BEFORE express.json (needs raw body) ──────────
app.use('/v1/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhookRoutes);

// ─── Meta WhatsApp Webhook — raw body capture para validar X-Hub-Signature-256 ─
// Capturamos el raw body de la petición y lo adjuntamos a req.rawBody (Buffer).
// Esto es necesario porque Meta firma el cuerpo original, no el JSON re-serializado.
// Solo se aplica a la ruta del webhook; el resto de endpoints usa express.json normal.
const captureRawBody = (req: Request, res: Response, next: NextFunction) => {
    express.raw({ type: 'application/json' })(req, res, (err) => {
        if (err) return next(err);
        if (Buffer.isBuffer(req.body)) {
            (req as any).rawBody = req.body;
            try {
                req.body = JSON.parse(req.body.toString('utf8'));
            } catch {
                req.body = {};
            }
        }
        next();
    });
};

// ─── Ruta canónica del webhook de Meta (URL que debes pegar en Developer Console)
// Usar: https://<RENDER_EXTERNAL_HOSTNAME>/webhooks/meta/whatsapp
app.get('/webhooks/meta/whatsapp', CampaignWebhook.verify.bind(CampaignWebhook));
app.post('/webhooks/meta/whatsapp', captureRawBody, CampaignWebhook.handle.bind(CampaignWebhook));

// ─── Alias legacy (compatibilidad con configuraciones anteriores) ──────────────
// Apunta al mismo handler. No uses esta URL para configurar nuevos webhooks en Meta.
app.get('/v1/webhooks/whatsapp', CampaignWebhook.verify.bind(CampaignWebhook));
app.post('/v1/webhooks/whatsapp', captureRawBody, CampaignWebhook.handle.bind(CampaignWebhook));

// ─── Global Middleware (CORS específico se aplica más abajo) ────────────────────
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ limit: '5mb', extended: true }));

// Global Request Logger for Debugging
app.use((req, res, next) => {
    console.log(`[HTTP] ${req.method} ${req.url}`);
    next();
});

// Serve static files (Widget Script)
const publicDir = path.resolve(__dirname, '..', 'public');
console.log(`[Static] Serving files from: ${publicDir}`);

// Archivos estáticos del widget (habilitado explícitamente con preflight)
app.use('/v1/wabee-widget.js', cors(corsPublicOptions));
app.use('/v1', express.static(publicDir, {
    setHeaders: (res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes cache for the loader script
    }
}));

// API pública del widget (habilitado explícitamente con preflight)
app.use('/v1/public/widgets', cors(corsPublicOptions), wabeePublicWidgetRoutes);
app.options('/v1/public/widgets/*', cors(corsPublicOptions));

// ─── Strict CORS para el resto de la aplicación (Admin / Dashboard) ────────────
app.use(cors(corsStrictOptions));

// ─── Health Check ──────────────────────────────────────────────────────────────
app.get('/health', async (_req, res) => {
    try {
        // DB ping rápido para verificar conectividad
        await prisma.$queryRaw`SELECT 1`;
        res.json({
            ok: true,
            uptime: Math.floor(process.uptime()),
            timestamp: new Date().toISOString(),
            env: env.NODE_ENV,
        });
    } catch (dbErr) {
        res.status(503).json({
            ok: false,
            error: 'Database unreachable',
            timestamp: new Date().toISOString(),
        });
    }
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/v1/wabee/dashboard', wabeeDashboardRoutes);
app.use('/v1/auth', authRoutes);
app.use('/v1/dashboard', dashboardRoutes);

app.use('/v1/orgs', (req: any, _res: any, next: any) => {
    const match = req.path.match(/^\/([0-9a-f-]{36})/i);
    if (match) req.tenantId = match[1];
    next();
}, orgRoutes);

// Core features (Media, etc.)
import { mediaRoutes } from './modules/core/media/media.routes';
app.use('/v1/core/media', mediaRoutes);
app.use('/oauth', metaOauthRoutes);

// Public routes (Widget) - Movidas arriba del CORS estricto

// Billing routes
app.use('/v1/billing', billingRoutes);

// Admin / Super Admin
app.use('/v1/super-admin/plans', superAdminPlansRoutes);
app.use('/v1/super-admin/data-deletion', dataDeletionAdminRoutes);
app.use('/v1/super-admin', superAdminRoutes);

// Public routes (Data Deletion)
app.use('/v1/public/data-deletion', dataDeletionPublicRoutes);

// --- WABEE DOMAIN ROUTES ---
import { authMiddleware } from './middleware/auth.middleware';
import { tenantMiddleware } from './middleware/tenant';
import { authGuardMiddleware } from './middleware/auth-guard.middleware';
import { planResolverMiddleware } from './middleware/plan.resolver.middleware';

app.use('/v1/wabee/contacts', authMiddleware, tenantMiddleware, planResolverMiddleware, authGuardMiddleware, wabeeContactsRoutes);
app.use('/v1/wabee/inbox', authMiddleware, tenantMiddleware, planResolverMiddleware, authGuardMiddleware, wabeeInboxRoutes);
app.use('/v1/wabee/inbox/roles', authMiddleware, tenantMiddleware, planResolverMiddleware, authGuardMiddleware, wabeeInboxRolesRoutes);
app.use('/v1/wabee/channels', authMiddleware, tenantMiddleware, planResolverMiddleware, authGuardMiddleware, wabeeChannelsRoutes);
app.use('/v1/wabee/whatsapp', authMiddleware, tenantMiddleware, planResolverMiddleware, authGuardMiddleware, wabeeWhatsappOutboundRoutes);
app.use('/v1/wabee/ai', authMiddleware, tenantMiddleware, planResolverMiddleware, authGuardMiddleware, wabeeAiRoutes);
app.use('/v1/wabee/web-widgets', authMiddleware, webWidgetPreviewRouter);
app.use('/v1/wabee/web-widgets', authMiddleware, tenantMiddleware, planResolverMiddleware, authGuardMiddleware, wabeeAdminWidgetRoutes);
app.use('/v1/wabee/campaigns', authMiddleware, tenantMiddleware, planResolverMiddleware, authGuardMiddleware, campaignsRoutes);
app.use('/v1/wabee/analytics', authMiddleware, tenantMiddleware, planResolverMiddleware, authGuardMiddleware, analyticsRoutes);
app.use('/v1/wabee/notifications', authMiddleware, tenantMiddleware, planResolverMiddleware, authGuardMiddleware, notificationsRoutes);
app.use('/v1/wabee/audit', authMiddleware, tenantMiddleware, planResolverMiddleware, authGuardMiddleware, auditRoutes);
app.use('/v1/wabee/realtime', realtimeRoutes); // SSE: auth incluido en el router

// ─── Global Error Handler ──────────────────────────────────────────────────────
// Captura errores de middlewares (multer, etc.) que llaman next(err)
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[GlobalErrorHandler]', err?.message || err);
    const status = err?.status || err?.statusCode || 500;
    res.status(status).json({ error: err?.message || 'Internal server error' });
});

// ─── Server Start ──────────────────────────────────────────────────────────────
// Escuchar en 0.0.0.0 es obligatorio en Render; localhost no es accesible externamente.
app.listen(port, '0.0.0.0', async () => {
    console.log(`🚀 WABEE API running on http://0.0.0.0:${port} [${env.NODE_ENV}]`);

    // ── Log de callback URL para Meta ──────────────────────────────────────────
    if (env.RENDER_EXTERNAL_HOSTNAME) {
        const callbackUrl = `https://${env.RENDER_EXTERNAL_HOSTNAME}/webhooks/meta/whatsapp`;
        console.log('');
        console.log('┌─────────────────────────────────────────────────────────────┐');
        console.log('│  📲 META WEBHOOK CALLBACK URL                               │');
        console.log(`│  ${callbackUrl.padEnd(61)}│`);
        console.log('│  Pega esta URL en Meta > Developer Console > WhatsApp >     │');
        console.log('│  Configuration > Webhook > Callback URL                     │');
        console.log('└─────────────────────────────────────────────────────────────┘');
        console.log('');
    } else if (env.APP_BASE_URL && env.APP_BASE_URL !== 'http://localhost:4000') {
        const callbackUrl = `${env.APP_BASE_URL}/webhooks/meta/whatsapp`;
        console.log(`📲 Meta Webhook URL: ${callbackUrl}`);
    } else if (env.NODE_ENV !== 'production') {
        const devPublicUrl = process.env.DEV_WEBHOOK_PUBLIC_URL;
        const devWarning = devPublicUrl
            ? `📲 Dev webhook URL: ${devPublicUrl}/webhooks/meta/whatsapp`
            : '⚠️  [DEV] Sin URL pública de webhook. Los mensajes de Meta NO llegarán localmente. Configura un tunnel o usa APP_BASE_URL.';
        console.warn(devWarning);
    }

    // ── Resiliencia de Infraestructura y Auto-migración ──────────────────────────
    // Se lanza de forma asíncrona para no bloquear el health check de HTTP (app.listen)
    const initDatabaseAndWorkers = async () => {
        const isDbReady = await DatabaseBootstrap.connectWithRetry();

        if (!isDbReady) {
            console.error('[Core] 🛑 AVISO CRÍTICO: La DB no se pudo alcanzar. Funciones de migración, AI y campañas (Workers) no se iniciarán para evitar casacadas de errores.');
            console.error('[Core] El servidor HTTP seguirá respondiendo en /health para monitoreo.');
            return;
        }

        // ── Auto-migración de tablas (SE REQUIERE LA DB) ───────────────────────
        try {
            console.log('[Migration] Verificando tablas de campañas...');
            await prisma.$executeRawUnsafe(`
                DO $$ BEGIN
                    CREATE TYPE wabee."WhatsappCampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'CANCELED', 'FAILED');
                EXCEPTION WHEN duplicate_object THEN null; END $$;

                DO $$ BEGIN
                    CREATE TYPE wabee."WhatsappCampaignMessageStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'CANCELED');
                EXCEPTION WHEN duplicate_object THEN null; END $$;

                CREATE TABLE IF NOT EXISTS wabee.whatsapp_campaigns (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    organization_id UUID NOT NULL,
                    channel_id UUID NOT NULL,
                    template_id UUID,
                    name TEXT NOT NULL,
                    status wabee."WhatsappCampaignStatus" NOT NULL DEFAULT 'DRAFT',
                    audience_type TEXT NOT NULL,
                    audience_filter JSONB,
                    template_input_mapping JSONB,
                    audience_snapshot_path TEXT,
                    audience_snapshot_hash TEXT,
                    scheduled_at TIMESTAMPTZ,
                    started_at TIMESTAMPTZ,
                    completed_at TIMESTAMPTZ,
                    estimated_recipients INTEGER NOT NULL DEFAULT 0,
                    pause_reason TEXT,
                    sent_count INTEGER NOT NULL DEFAULT 0,
                    delivered_count INTEGER NOT NULL DEFAULT 0,
                    read_count INTEGER NOT NULL DEFAULT 0,
                    failed_count INTEGER NOT NULL DEFAULT 0,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    UNIQUE(organization_id, name)
                );

                DO $$ BEGIN
                    ALTER TABLE wabee.whatsapp_campaigns ADD COLUMN template_input_mapping JSONB;
                EXCEPTION WHEN duplicate_column THEN null; END $$;

                CREATE TABLE IF NOT EXISTS wabee.whatsapp_campaign_messages (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    organization_id UUID NOT NULL,
                    campaign_id UUID NOT NULL REFERENCES wabee.whatsapp_campaigns(id) ON DELETE CASCADE,
                    contact_id UUID NOT NULL,
                    message_id UUID,
                    wa_message_id TEXT,
                    status wabee."WhatsappCampaignMessageStatus" NOT NULL DEFAULT 'PENDING',
                    variant TEXT,
                    attempts INTEGER NOT NULL DEFAULT 0,
                    next_attempt_at TIMESTAMPTZ,
                    error_code TEXT,
                    error_payload JSONB,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    UNIQUE(organization_id, campaign_id, contact_id)
                );

                DO $$ BEGIN
                    CREATE TYPE wabee."AnalyticsEventType" AS ENUM (
                        'THREAD_CREATED', 'THREAD_STATUS_CHANGED', 'THREAD_REOPENED',
                        'MESSAGE_INBOUND_USER', 'MESSAGE_OUTBOUND_HUMAN', 'MESSAGE_OUTBOUND_AI', 'MESSAGE_OUTBOUND_FLOW',
                        'AI_GATING_BLOCKED', 'AI_FALLBACK_TO_HUMAN', 'HUMAN_TAKEOVER', 'THREAD_ASSIGNED_TO_HUMAN',
                        'CAMPAIGN_MESSAGE_SENT', 'CAMPAIGN_MESSAGE_DELIVERED', 'CAMPAIGN_MESSAGE_READ', 'CAMPAIGN_MESSAGE_FAILED',
                        'CRM_EVENT'
                    );
                EXCEPTION WHEN duplicate_object THEN null; END $$;

                DO $$ BEGIN
                    CREATE TYPE wabee."AnalyticsActorType" AS ENUM ('HUMAN', 'AI', 'FLOW', 'SYSTEM');
                EXCEPTION WHEN duplicate_object THEN null; END $$;

                CREATE TABLE IF NOT EXISTS wabee.analytics_events (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    organization_id UUID NOT NULL,
                    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    event_type wabee."AnalyticsEventType" NOT NULL,
                    channel TEXT NOT NULL DEFAULT 'all',
                    thread_id UUID,
                    conversation_id UUID,
                    contact_id UUID,
                    campaign_id UUID,
                    campaign_message_id UUID,
                    variant TEXT,
                    actor_type wabee."AnalyticsActorType" NOT NULL DEFAULT 'SYSTEM',
                    actor_user_id UUID,
                    meta JSONB DEFAULT '{}'
                );
                CREATE INDEX IF NOT EXISTS idx_analytics_events_tenant_ts ON wabee.analytics_events(organization_id, occurred_at);
                CREATE INDEX IF NOT EXISTS idx_analytics_events_type_ts ON wabee.analytics_events(organization_id, event_type, occurred_at);
                CREATE INDEX IF NOT EXISTS idx_analytics_events_thread ON wabee.analytics_events(organization_id, thread_id);

                CREATE TABLE IF NOT EXISTS wabee.analytics_daily_rollups (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    organization_id UUID NOT NULL,
                    date DATE NOT NULL,
                    channel TEXT NOT NULL,
                    metrics JSONB DEFAULT '{}',
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    UNIQUE(organization_id, date, channel)
                );
                CREATE INDEX IF NOT EXISTS idx_analytics_rollup_date ON wabee.analytics_daily_rollups(organization_id, date);

                CREATE TABLE IF NOT EXISTS wabee.analytics_aggregation_cursors (
                    organization_id UUID PRIMARY KEY,
                    last_aggregated_at TIMESTAMPTZ NOT NULL DEFAULT '1970-01-01 00:00:00+00',
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );

                CREATE TABLE IF NOT EXISTS wabee.analytics_crm_events (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    organization_id UUID NOT NULL,
                    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    type TEXT NOT NULL,
                    provider TEXT NOT NULL,
                    external_id TEXT,
                    thread_id UUID,
                    contact_id UUID,
                    value FLOAT,
                    currency TEXT DEFAULT 'USD',
                    meta JSONB DEFAULT '{}'
                );
                CREATE INDEX IF NOT EXISTS idx_analytics_crm_ts ON wabee.analytics_crm_events(organization_id, occurred_at);

                DO $$ BEGIN
                    ALTER TABLE wabee.whatsapp_messages ADD COLUMN external_ref TEXT;
                EXCEPTION WHEN duplicate_column THEN null; END $$;

                DO $$ BEGIN
                    ALTER TABLE wabee.whatsapp_messages ADD COLUMN wa_message_id TEXT;
                EXCEPTION WHEN duplicate_column THEN null; END $$;

                DO $$ BEGIN
                    ALTER TABLE wabee.whatsapp_messages ADD COLUMN delivery_status TEXT;
                EXCEPTION WHEN duplicate_column THEN null; END $$;

                DROP INDEX IF EXISTS wabee.idx_whatsapp_messages_org_external_ref;
                DROP INDEX IF EXISTS wabee.idx_whatsapp_messages_org_wa_message_id;
                DROP INDEX IF EXISTS wabee.uq_whatsapp_messages_org_external_ref;

                CREATE UNIQUE INDEX IF NOT EXISTS uq_whatsapp_messages_org_external_ref
                ON wabee.whatsapp_messages (organization_id, external_ref)
                WHERE external_ref IS NOT NULL;

                CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_org_wa_message_id
                ON wabee.whatsapp_messages (organization_id, wa_message_id)
                WHERE wa_message_id IS NOT NULL;

                CREATE TABLE IF NOT EXISTS core.products (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    name TEXT NOT NULL,
                    slug TEXT NOT NULL UNIQUE,
                    description TEXT,
                    base_url TEXT,
                    status TEXT NOT NULL DEFAULT 'active',
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    deleted_at TIMESTAMPTZ
                );

                DO $$ BEGIN
                    ALTER TABLE core.organizations ADD COLUMN IF NOT EXISTS email TEXT NOT NULL DEFAULT '';
                EXCEPTION WHEN OTHERS THEN null; END $$;

                DO $$ BEGIN
                    ALTER TABLE core.organizations ADD COLUMN IF NOT EXISTS logo_url TEXT;
                EXCEPTION WHEN OTHERS THEN null; END $$;

                DO $$ BEGIN
                    ALTER TABLE core.organizations ADD COLUMN IF NOT EXISTS plan_template_id UUID;
                EXCEPTION WHEN OTHERS THEN null; END $$;

                DO $$ BEGIN
                    ALTER TABLE core.organizations ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES core.products(id);
                EXCEPTION WHEN OTHERS THEN null; END $$;

                DO $$ BEGIN
                    ALTER TABLE core.organizations ADD COLUMN IF NOT EXISTS external_customer_id TEXT;
                EXCEPTION WHEN OTHERS THEN null; END $$;

                DO $$ BEGIN
                    ALTER TABLE core.organizations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
                EXCEPTION WHEN OTHERS THEN null; END $$;

                DO $$ BEGIN
                    ALTER TABLE core.organizations ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}';
                EXCEPTION WHEN OTHERS THEN null; END $$;

                CREATE TABLE IF NOT EXISTS core.impersonation_sessions (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    organization_id UUID NOT NULL,
                    admin_user_id UUID NOT NULL,
                    target_user_id UUID NOT NULL,
                    reason TEXT,
                    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    ended_at TIMESTAMPTZ,
                    ended_by UUID,
                    is_active BOOLEAN NOT NULL DEFAULT true,
                    metadata JSONB DEFAULT '{}'
                );
                CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_tenant_admin
                    ON core.impersonation_sessions(organization_id, admin_user_id);
                CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_active
                    ON core.impersonation_sessions(is_active);

                CREATE TABLE IF NOT EXISTS core.data_deletion_requests (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    full_name TEXT NOT NULL,
                    email TEXT NOT NULL,
                    phone TEXT,
                    description TEXT,
                    status TEXT NOT NULL DEFAULT 'PENDING',
                    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    reviewed_at TIMESTAMPTZ,
                    reviewed_by UUID,
                    completed_at TIMESTAMPTZ,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );

                DO $$ BEGIN
                    ALTER TABLE core.data_deletion_requests ADD COLUMN IF NOT EXISTS has_match BOOLEAN DEFAULT false;
                    ALTER TABLE core.data_deletion_requests ADD COLUMN IF NOT EXISTS internal_note TEXT;
                EXCEPTION WHEN OTHERS THEN null; END $$;

                DO $$ BEGIN
                    ALTER TABLE core.organization_members ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
                EXCEPTION WHEN OTHERS THEN null; END $$;
                DO $$ BEGIN
                    ALTER TABLE core.organization_members ADD COLUMN IF NOT EXISTS suspended_by UUID;
                EXCEPTION WHEN OTHERS THEN null; END $$;
                DO $$ BEGIN
                    ALTER TABLE core.organization_members ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
                EXCEPTION WHEN OTHERS THEN null; END $$;

                -- ── Planes Versionados — Migración de tablas ─────────────────
                -- 1. Columna status explícita en plan_templates
                DO $$ BEGIN
                    ALTER TABLE core.plan_templates ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';
                EXCEPTION WHEN OTHERS THEN null; END $$;
                -- Soft Delete column
                DO $$ BEGIN
                    ALTER TABLE core.plan_templates ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
                    ALTER TABLE core.plan_templates ADD COLUMN IF NOT EXISTS price NUMERIC(12,2) DEFAULT 0;
                    ALTER TABLE core.plan_templates ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'mxn';
                    ALTER TABLE core.plan_templates ADD COLUMN IF NOT EXISTS interval TEXT DEFAULT 'month';
                    ALTER TABLE core.plan_templates ADD COLUMN IF NOT EXISTS price_id TEXT;
                    ALTER TABLE core.plan_templates ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '{}';
                    ALTER TABLE core.plan_templates ADD COLUMN IF NOT EXISTS limits JSONB DEFAULT '{}';
                    ALTER TABLE core.plan_templates ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
                EXCEPTION WHEN OTHERS THEN null; END $$;
                -- Migrar is_active → status
                UPDATE core.plan_templates
                SET status = CASE WHEN is_active = true THEN 'active' ELSE 'archived' END
                WHERE status = 'draft';

                -- 2. Tabla plan_versions
                CREATE TABLE IF NOT EXISTS core.plan_versions (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    plan_template_id UUID NOT NULL REFERENCES core.plan_templates(id) ON DELETE CASCADE,
                    version_number INT NOT NULL,
                    display_code TEXT,
                    price NUMERIC(12,2) NOT NULL DEFAULT 0,
                    currency TEXT NOT NULL DEFAULT 'mxn',
                    billing_interval TEXT NOT NULL DEFAULT 'month',
                    limits_json JSONB NOT NULL DEFAULT '{}',
                    features_json JSONB NOT NULL DEFAULT '{}',
                    capabilities_json JSONB NOT NULL DEFAULT '{}',
                    metadata_json JSONB NOT NULL DEFAULT '{}',
                    stripe_price_monthly_id TEXT,
                    stripe_price_annual_id TEXT,
                    is_published BOOLEAN NOT NULL DEFAULT false,
                    is_current BOOLEAN NOT NULL DEFAULT false,
                    effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    effective_to TIMESTAMPTZ,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    created_by UUID,
                    deleted_at TIMESTAMPTZ,
                    UNIQUE(plan_template_id, version_number)
                );
                -- Ensure deleted_at exists if table already existed without it
                DO $$ BEGIN
                    ALTER TABLE core.plan_versions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
                EXCEPTION WHEN OTHERS THEN null; END $$;
                CREATE INDEX IF NOT EXISTS idx_plan_versions_plan_current ON core.plan_versions(plan_template_id, is_current);
                CREATE INDEX IF NOT EXISTS idx_plan_versions_plan_id ON core.plan_versions(plan_template_id);
                CREATE INDEX IF NOT EXISTS idx_plan_versions_published ON core.plan_versions(is_published);
                
                -- 3. Suscripciones — Mejoras de trazabilidad y concurrencia
                DO $$ BEGIN
                    ALTER TABLE core.subscriptions ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;
                EXCEPTION WHEN OTHERS THEN null; END $$;
                -- Asegurar que existe el valor ENDED en el Enum (si no existe)
                -- Nota: ALTER TYPE ADD VALUE no puede ejecutarse dentro de una transacción en versiones antiguas de PG
                -- pero aquí suele funcionar si el bootstrap no está envuelto en un BEGIN/COMMIT explícito del driver
                -- Si falla, usaremos CANCELED como fallback en el código.
                DO $$ BEGIN
                    ALTER TYPE core."SubscriptionStatus" ADD VALUE 'ENDED';
                EXCEPTION WHEN OTHERS THEN null; END $$;

                DO $$ BEGIN
                    ALTER TYPE core."SubscriptionStatus" ADD VALUE 'PENDING';
                EXCEPTION WHEN OTHERS THEN null; END $$;

                -- Índice parcial de unicidad: solo 1 suscripción ACTIVE por organización
                -- Borrar primero por si ya existe con otro nombre
                DROP INDEX IF EXISTS core.idx_active_subscription_per_org;
                CREATE UNIQUE INDEX idx_active_subscription_per_org ON core.subscriptions (organization_id) WHERE status = 'ACTIVE';

                -- 3. Migrar PlanTemplates existentes → versión inicial (v1) si no tiene versiones aún
                INSERT INTO core.plan_versions (
                    plan_template_id, version_number, display_code,
                    price, currency, billing_interval,
                    limits_json, features_json, capabilities_json, metadata_json,
                    stripe_price_monthly_id, stripe_price_annual_id,
                    is_published, is_current, effective_from
                )
                SELECT
                    pt.id,
                    1,
                    CONCAT(COALESCE((pt.metadata->>'code')::TEXT, UPPER(pt.name)), '_V1'),
                    COALESCE(pt.price::NUMERIC(12,2), 0),
                    COALESCE(pt.currency, 'mxn'),
                    COALESCE(pt.interval, 'month'),
                    COALESCE(pt.limits, '{}'),
                    COALESCE(pt.features, '{}'),
                    '{}',
                    jsonb_build_object(
                        '_migrationBaseline', true,
                        '_migratedAt', NOW()::TEXT,
                        'originalMetadata', COALESCE(pt.metadata, '{}')
                    ),
                    pt.metadata->>'stripePriceMonthlyId',
                    pt.metadata->>'stripePriceAnnualId',
                    COALESCE(pt.is_active, false),
                    true,
                    pt.created_at
                FROM core.plan_templates pt
                WHERE NOT EXISTS (
                    SELECT 1 FROM core.plan_versions pv WHERE pv.plan_template_id = pt.id
                );

                -- 4. Columnas de snapshot en subscriptions
                DO $$ BEGIN ALTER TABLE core.subscriptions ADD COLUMN IF NOT EXISTS plan_version_id UUID REFERENCES core.plan_versions(id); EXCEPTION WHEN OTHERS THEN null; END $$;
                DO $$ BEGIN ALTER TABLE core.subscriptions ADD COLUMN IF NOT EXISTS snapshot_json JSONB NOT NULL DEFAULT '{}'; EXCEPTION WHEN OTHERS THEN null; END $$;
                DO $$ BEGIN ALTER TABLE core.subscriptions ADD COLUMN IF NOT EXISTS price_snapshot NUMERIC(12,2); EXCEPTION WHEN OTHERS THEN null; END $$;
                DO $$ BEGIN ALTER TABLE core.subscriptions ADD COLUMN IF NOT EXISTS currency_snapshot TEXT; EXCEPTION WHEN OTHERS THEN null; END $$;
                DO $$ BEGIN ALTER TABLE core.subscriptions ADD COLUMN IF NOT EXISTS billing_interval_snapshot TEXT; EXCEPTION WHEN OTHERS THEN null; END $$;
                DO $$ BEGIN ALTER TABLE core.subscriptions ADD COLUMN IF NOT EXISTS plan_code_snapshot TEXT; EXCEPTION WHEN OTHERS THEN null; END $$;
                DO $$ BEGIN ALTER TABLE core.subscriptions ADD COLUMN IF NOT EXISTS plan_name_snapshot TEXT; EXCEPTION WHEN OTHERS THEN null; END $$;
                DO $$ BEGIN ALTER TABLE core.subscriptions ADD COLUMN IF NOT EXISTS features_snapshot JSONB; EXCEPTION WHEN OTHERS THEN null; END $$;
                DO $$ BEGIN ALTER TABLE core.subscriptions ADD COLUMN IF NOT EXISTS limits_snapshot JSONB; EXCEPTION WHEN OTHERS THEN null; END $$;
                DO $$ BEGIN ALTER TABLE core.subscriptions ADD COLUMN IF NOT EXISTS capabilities_snapshot JSONB; EXCEPTION WHEN OTHERS THEN null; END $$;
                DO $$ BEGIN ALTER TABLE core.subscriptions ADD COLUMN IF NOT EXISTS version_number_snapshot INT; EXCEPTION WHEN OTHERS THEN null; END $$;
                DO $$ BEGIN ALTER TABLE core.subscriptions ADD COLUMN IF NOT EXISTS snapshot_created_at TIMESTAMPTZ; EXCEPTION WHEN OTHERS THEN null; END $$;
                CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_version ON core.subscriptions(plan_version_id);
                CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON core.subscriptions(status);

                -- 5. Baseline migration para suscripciones existentes sin snapshot (best effort legacy)
                UPDATE core.subscriptions sub
                SET
                    plan_version_id = pv.id,
                    plan_code_snapshot = COALESCE(pt.metadata->>'code', UPPER(pt.name)),
                    plan_name_snapshot = COALESCE(pt.metadata->>'displayName', pt.name),
                    version_number_snapshot = 1,
                    price_snapshot = COALESCE(pt.price::NUMERIC(12,2), 0),
                    currency_snapshot = COALESCE(pt.currency, 'mxn'),
                    billing_interval_snapshot = COALESCE(pt.interval, 'month'),
                    limits_snapshot = COALESCE(pt.limits, '{}'),
                    features_snapshot = COALESCE(pt.features, '{}'),
                    capabilities_snapshot = '{}',
                    snapshot_created_at = NOW(),
                    snapshot_json = jsonb_build_object(
                        '_isLegacyFallback', true,
                        '_migratedAt', NOW()::TEXT,
                        'planId', sub.plan_template_id::TEXT,
                        'versionNumber', 1,
                        'price', COALESCE(pt.price::NUMERIC(12,2), 0)::TEXT,
                        'currency', COALESCE(pt.currency, 'mxn'),
                        'billingInterval', COALESCE(pt.interval, 'month'),
                        'limits', COALESCE(pt.limits, '{}'),
                        'features', COALESCE(pt.features, '{}')
                    )
                FROM core.plan_templates pt
                JOIN core.plan_versions pv ON pv.plan_template_id = pt.id AND pv.version_number = 1
                WHERE sub.plan_template_id = pt.id
                  AND (sub.snapshot_json IS NULL OR sub.snapshot_json = '{}'::jsonb);

                -- 6. AI Canal - Columnas de configuración avanzada
                DO $$ BEGIN
                    ALTER TABLE wabee.ai_profiles ADD COLUMN IF NOT EXISTS handoff_aggressiveness VARCHAR(20) DEFAULT 'balanced';
                EXCEPTION WHEN OTHERS THEN null; END $$;

                DO $$ BEGIN
                    ALTER TABLE wabee.kb_files ADD COLUMN IF NOT EXISTS organization_id UUID;
                EXCEPTION WHEN OTHERS THEN null; END $$;
            `);
            console.log('[Migration] Tablas sincronizadas.');
        } catch (err) {
            console.error('[Migration] Error en auto-migración:', err);
        }

        // ── Migración: Auditoría Global Super Admin ────────────────────────────
        try {
            console.log('[Migration] Verificando tabla global_audit_events...');
            await prisma.$executeRawUnsafe(`
                CREATE TABLE IF NOT EXISTS wabee.global_audit_events (
                    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    tenant_id        UUID,
                    affected_tenant_id UUID,
                    actor_type       TEXT NOT NULL,
                    actor_user_id    UUID,
                    actor_email      TEXT,
                    actor_role       TEXT,
                    event_type       TEXT NOT NULL,
                    category         TEXT NOT NULL,
                    severity         TEXT NOT NULL,
                    outcome          TEXT NOT NULL,
                    target_type      TEXT,
                    target_id        TEXT,
                    target_label     TEXT,
                    ip_address       TEXT,
                    user_agent       TEXT,
                    request_id       TEXT,
                    correlation_id   TEXT,
                    message          TEXT NOT NULL,
                    old_values       JSONB,
                    new_values       JSONB,
                    metadata         JSONB,
                    is_sensitive     BOOLEAN NOT NULL DEFAULT false,
                    is_impersonation BOOLEAN NOT NULL DEFAULT false
                );

                CREATE INDEX IF NOT EXISTS idx_global_audit_events_created_at
                    ON wabee.global_audit_events(created_at DESC);
                CREATE INDEX IF NOT EXISTS idx_global_audit_events_severity_created
                    ON wabee.global_audit_events(severity, created_at);
                CREATE INDEX IF NOT EXISTS idx_global_audit_events_event_type_created
                    ON wabee.global_audit_events(event_type, created_at);
                CREATE INDEX IF NOT EXISTS idx_global_audit_events_tenant_created
                    ON wabee.global_audit_events(tenant_id, created_at);
                CREATE INDEX IF NOT EXISTS idx_global_audit_events_affected_tenant_created
                    ON wabee.global_audit_events(affected_tenant_id, created_at);
            `);
            console.log('[Migration] Tabla global_audit_events lista.');
        } catch (err) {
            console.error('[Migration] Error creando global_audit_events:', err);
        }

        // ── Migración: Plantilla de correo para Eliminación de Datos ────────────
        try {
            console.log('[Migration] Verificando plantilla DATA_DELETION_CONFIRMATION...');
            const EMAIL_TEMPLATES_KEY = 'email_customization_templates';
            
            // 1. Asegurar que el registro existe
            await prisma.$executeRawUnsafe(`
                INSERT INTO core.system_settings (key, value)
                VALUES ('${EMAIL_TEMPLATES_KEY}', '[]'::jsonb)
                ON CONFLICT (key) DO NOTHING;
            `);

            // 2. Leer configuraciones actuales
            const settings = await CoreInternalService.getSystemSetting(EMAIL_TEMPLATES_KEY);

            if (settings && Array.isArray(settings.value)) {
                const templates = settings.value as any[];
                const hasTemplate = templates.some(t => t.code === 'DATA_DELETION_CONFIRMATION');

                if (!hasTemplate) {
                    console.log('[Migration] Registrando plantilla DATA_DELETION_CONFIRMATION por defecto.');
                    const newTemplate = {
                        id: 'data-deletion-confirmation-tpl',
                        code: 'DATA_DELETION_CONFIRMATION',
                        name: 'Confirmación de Eliminación de Datos',
                        category: 'Seguridad',
                        status: 'published',
                        subject: 'Confirmación de solicitud de eliminación de información - WABEE',
                        title: 'Confirmación de Solicitud',
                        body: '<p>Hola {{fullName}},</p><p>Hemos recibido una solicitud para eliminar la información de su organización asociada a este contacto.</p><p>Por seguridad, le informamos que el administrador ya tiene esta solicitud <b>En Revisión</b>. Una vez completada, todos los datos personales del contacto serán anonimizados permanentemente.</p><p>Si usted no realizó esta solicitud, por favor contáctenos de inmediato.</p>',
                        cta: 'Ir al Formulario',
                        footer: 'Equipo de Soporte WABEE'
                    };

                    await CoreInternalService.upsertSystemSetting({
                        key: EMAIL_TEMPLATES_KEY,
                        value: [...templates, newTemplate]
                    });
                }
            }
        } catch (err) {
            console.error('[Migration] Error registrando plantilla de correo:', err);
        }

        // ── Seed: Plantillas de correo por defecto ─────────────────────────────
        try {
            console.log('[Seed] Verificando plantillas de correo por defecto...');
            const EMAIL_TEMPLATES_KEY = 'email_customization_templates';
            const EMAIL_GLOBAL_KEY = 'email_customization_global';

            // Asegurar que los registros existen en BD
            await prisma.$executeRawUnsafe(`
                INSERT INTO core.system_settings (key, value)
                VALUES ('${EMAIL_TEMPLATES_KEY}', '[]'::jsonb)
                ON CONFLICT (key) DO NOTHING;
            `);
            await prisma.$executeRawUnsafe(`
                INSERT INTO core.system_settings (key, value)
                VALUES ('${EMAIL_GLOBAL_KEY}', '{}'::jsonb)
                ON CONFLICT (key) DO NOTHING;
            `);

            const templatesSetting = await CoreInternalService.getSystemSetting(EMAIL_TEMPLATES_KEY);
            if (templatesSetting && Array.isArray(templatesSetting.value)) {
                const existing = templatesSetting.value as any[];
                const missing = DEFAULT_EMAIL_TEMPLATES.filter(
                    def => !existing.some((t: any) => t.code === def.code)
                );

                if (missing.length > 0) {
                    console.log(`[Seed] Registrando ${missing.length} plantillas de correo faltantes.`);
                    await CoreInternalService.upsertSystemSetting({
                        key: EMAIL_TEMPLATES_KEY,
                        value: [...existing, ...missing]
                    });
                } else {
                    console.log('[Seed] Todas las plantillas de correo ya existen.');
                }
            }

            const globalSetting = await CoreInternalService.getSystemSetting(EMAIL_GLOBAL_KEY);
            const globalValue = globalSetting?.value as Record<string, any> | null;
            if (!globalValue || Object.keys(globalValue).length === 0) {
                console.log('[Seed] Registrando configuración global de correos por defecto.');
                await CoreInternalService.upsertSystemSetting({
                    key: EMAIL_GLOBAL_KEY,
                    value: DEFAULT_EMAIL_GLOBAL
                });
            }
        } catch (err) {
            console.error('[Seed] Error al sembrar plantillas de correo:', err);
        }

        // ── Supabase Storage — inicializar buckets ─────────────────────────────
        await initStorage();

        // ── Workers (Sólo si la DB es persistente y segura) ────────────────────
        console.log('[Core] DB validada. Levantando Workers y Aggregators...');
        CampaignWorker.start();

        setInterval(() => {
            AnalyticsAggregator.aggregateAll().catch(err => console.error('[Analytics] Aggregator Error:', err));
        }, 1000 * 60 * 60);

        AnalyticsAggregator.aggregateAll().catch(err => console.error('[Analytics] Initial Aggregator Error:', err));
    };

    // Lanzar flujo sub-hilo (No hace await para mantener HTTP app.listen libre inmediatamente)
    initDatabaseAndWorkers();
});
