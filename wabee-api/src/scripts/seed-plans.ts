/**
 * Seed oficial de planes de Wabee.
 *
 * Crea o actualiza 3 planes:
 * - FREE: plan gratuito limitado para nuevos registros
 * - PLAN_BASICO: plan comercial de entrada
 * - PLAN_CRECIMIENTO: plan comercial de mayor capacidad
 *
 * Uso:
 *   npx ts-node -r dotenv/config src/scripts/seed-plans.ts
 */
import 'dotenv/config';
import '../config/core/core.infra';
import { corePrisma, prisma } from '../config/core/core.prisma';

type PlanSeed = {
    name: string;
    code: string;
    description: string;
    price: number;
    monthlyPrice: number;
    annualPrice: number;
    currency: string;
    interval: 'month' | 'year';
    status: 'active';
    isPublic: boolean;
    limits: Record<string, number>;
    modules: Record<string, boolean>;
};

const BASIC_MODULES = {
    dashboard: true,
    inbox: true,
    contacts: true,
    segments: true,
    groups: true,
    templatesHub: true,
    aiProfiles: false,
    webWidgets: false,
    integrationsTools: false,
    channels: true,
    campaigns: false,
    audit: false,
    team: true,
};

const COMMERCIAL_MODULES = {
    dashboard: true,
    inbox: true,
    contacts: true,
    segments: true,
    groups: true,
    templatesHub: true,
    aiProfiles: true,
    webWidgets: false,
    integrationsTools: true,
    channels: true,
    campaigns: true,
    audit: false,
    team: true,
};

const PLANS: PlanSeed[] = [
    {
        name: 'Plan Gratuito',
        code: 'FREE',
        description: 'Plan gratuito de entrada para nuevos usuarios registrados en Wabee.',
        price: 0,
        monthlyPrice: 0,
        annualPrice: 0,
        currency: 'mxn',
        interval: 'month',
        status: 'active',
        isPublic: false,
        limits: {
            users: 1,
            contacts: 250,
            channels: 1,
            storageMb: 256,
            aiTokensPerMonth: 1000,
            documents: 2,
            organizations: 1,
        },
        modules: BASIC_MODULES,
    },
    {
        name: 'Plan Básico',
        code: 'PLAN_BASICO',
        description: 'Plan comercial de entrada para PyMEs y equipos de soporte pequeños.',
        price: 2500,
        monthlyPrice: 2500,
        annualPrice: 30000,
        currency: 'mxn',
        interval: 'month',
        status: 'active',
        isPublic: true,
        limits: {
            users: 3,
            contacts: 5000,
            channels: 2,
            storageMb: 1024,
            aiTokensPerMonth: 10000,
            documents: 10,
            organizations: 1,
        },
        modules: BASIC_MODULES,
    },
    {
        name: 'Plan Crecimiento',
        code: 'PLAN_CRECIMIENTO',
        description: 'Plan comercial para equipos con mayor volumen y uso intensivo de IA.',
        price: 3000,
        monthlyPrice: 3000,
        annualPrice: 36000,
        currency: 'mxn',
        interval: 'month',
        status: 'active',
        isPublic: true,
        limits: {
            users: 10,
            contacts: 50000,
            channels: 10,
            storageMb: 5120,
            aiTokensPerMonth: 50000,
            documents: 50,
            organizations: 1,
        },
        modules: COMMERCIAL_MODULES,
    },
];

async function ensureSchema() {
    await prisma.$executeRawUnsafe(`
        ALTER TABLE core.plan_templates
        ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT false;
    `);
    await prisma.$executeRawUnsafe(`
        ALTER TABLE core.plan_versions
        ADD COLUMN IF NOT EXISTS modules_json JSONB NOT NULL DEFAULT '{}';
    `);
    await prisma.$executeRawUnsafe(`
        ALTER TABLE core.plan_versions
        ADD COLUMN IF NOT EXISTS monthly_price NUMERIC(12,2) NOT NULL DEFAULT 0;
    `);
    await prisma.$executeRawUnsafe(`
        ALTER TABLE core.plan_versions
        ADD COLUMN IF NOT EXISTS annual_price NUMERIC(12,2) NOT NULL DEFAULT 0;
    `);
    // Columnas de sincronizacion con Stripe (las usa el panel de admin y StripeSyncService).
    // Sin estas, crear un plan desde el panel falla con "column stripe_sync_status does not exist".
    await prisma.$executeRawUnsafe(`
        ALTER TABLE core.plan_versions
        ADD COLUMN IF NOT EXISTS stripe_sync_status TEXT NOT NULL DEFAULT 'PENDING';
    `);
    await prisma.$executeRawUnsafe(`
        ALTER TABLE core.plan_versions
        ADD COLUMN IF NOT EXISTS stripe_price_monthly_id TEXT;
    `);
    await prisma.$executeRawUnsafe(`
        ALTER TABLE core.plan_versions
        ADD COLUMN IF NOT EXISTS stripe_price_annual_id TEXT;
    `);
    await prisma.$executeRawUnsafe(`
        ALTER TABLE core.plan_versions
        ADD COLUMN IF NOT EXISTS stripe_sync_error TEXT;
    `);
    await prisma.$executeRawUnsafe(`
        ALTER TABLE core.plan_versions
        ADD COLUMN IF NOT EXISTS stripe_synced_at TIMESTAMPTZ;
    `);
    await prisma.$executeRawUnsafe(`
        ALTER TABLE core.subscriptions
        ADD COLUMN IF NOT EXISTS modules_snapshot JSONB;
    `);
}

async function ensureWabeeProduct() {
    const existing = await corePrisma.product.findFirst({
        where: { slug: { equals: 'wabee', mode: 'insensitive' } },
        select: { id: true, slug: true }
    });

    if (existing) return existing;

    return corePrisma.product.create({
        data: {
            name: 'Wabee',
            slug: 'wabee',
            description: 'Producto principal de Wabee',
            status: 'active',
        },
        select: { id: true, slug: true }
    });
}

async function upsertPlan(productId: string, plan: PlanSeed) {
    const metadata = {
        code: plan.code,
        displayName: plan.name,
        isPublic: plan.isPublic,
    };

    const existing = await prisma.$queryRawUnsafe(
        `SELECT id
         FROM core.plan_templates
         WHERE product_id = $1::uuid
           AND deleted_at IS NULL
           AND (name = $2 OR metadata->>'code' = $3)
         LIMIT 1`,
        productId,
        plan.name,
        plan.code
    ) as Array<{ id: string }>;

    let templateId: string;

    if (existing.length > 0) {
        templateId = existing[0].id;
        await prisma.$executeRawUnsafe(
            `UPDATE core.plan_templates
             SET product_id = $1::uuid,
                 name = $2,
                 description = $3,
                 price = $4,
                 currency = $5,
                 "interval" = $6,
                 status = $7,
                 is_active = true,
                 limits = $8::jsonb,
                 features = $9::jsonb,
                 metadata = $10::jsonb,
                 deleted_at = NULL,
                 updated_at = now()
             WHERE id = $11::uuid`,
            productId,
            plan.name,
            plan.description,
            plan.price,
            plan.currency,
            plan.interval,
            plan.status,
            JSON.stringify(plan.limits),
            JSON.stringify(plan.limits),
            JSON.stringify(metadata),
            templateId
        );
    } else {
        const created = await prisma.$queryRawUnsafe(
            `INSERT INTO core.plan_templates
                (product_id, name, description, price, currency, "interval", status, is_active, limits, features, metadata, created_at, updated_at)
             VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, true, $8::jsonb, $9::jsonb, $10::jsonb, now(), now())
             RETURNING id`,
            productId,
            plan.name,
            plan.description,
            plan.price,
            plan.currency,
            plan.interval,
            plan.status,
            JSON.stringify(plan.limits),
            JSON.stringify(plan.limits),
            JSON.stringify(metadata)
        ) as Array<{ id: string }>;
        templateId = created[0].id;
    }

    const existingVersion = await prisma.$queryRawUnsafe(
        `SELECT id
         FROM core.plan_versions
         WHERE plan_template_id = $1::uuid
           AND is_current = true
         LIMIT 1`,
        templateId
    ) as Array<{ id: string }>;

    let versionId: string;

    if (existingVersion.length > 0) {
        versionId = existingVersion[0].id;
        await prisma.$executeRawUnsafe(
            `UPDATE core.plan_versions
             SET display_code = $1,
                 price = $2,
                 currency = $3,
                 billing_interval = $4,
                 monthly_price = $5,
                 annual_price = $6,
                 limits_json = $7::jsonb,
                 features_json = $8::jsonb,
                 modules_json = $9::jsonb,
                 metadata_json = $10::jsonb,
                 is_current = true,
                 is_published = true,
                 deleted_at = NULL
             WHERE id = $11::uuid`,
            `${plan.code}_V1`,
            plan.price,
            plan.currency,
            plan.interval,
            plan.monthlyPrice,
            plan.annualPrice,
            JSON.stringify(plan.limits),
            JSON.stringify(plan.limits),
            JSON.stringify(plan.modules),
            JSON.stringify(metadata),
            versionId
        );
    } else {
        const createdVersion = await prisma.$queryRawUnsafe(
            `INSERT INTO core.plan_versions
                (plan_template_id, version_number, display_code, price, currency, billing_interval, monthly_price, annual_price, limits_json, features_json, capabilities_json, modules_json, metadata_json, is_published, is_current, effective_from, created_at)
             VALUES ($1::uuid, 1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, '{}'::jsonb, $10::jsonb, $11::jsonb, true, true, now(), now())
             RETURNING id`,
            templateId,
            `${plan.code}_V1`,
            plan.price,
            plan.currency,
            plan.interval,
            plan.monthlyPrice,
            plan.annualPrice,
            JSON.stringify(plan.limits),
            JSON.stringify(plan.limits),
            JSON.stringify(plan.modules),
            JSON.stringify(metadata)
        ) as Array<{ id: string }>;
        versionId = createdVersion[0].id;
    }

    return { templateId, versionId };
}

async function main() {
    console.log('\nConfigurando planes oficiales de Wabee...\n');

    await ensureSchema();
    const product = await ensureWabeeProduct();

    const officialPlanCodes = PLANS.map((plan) => plan.code.toUpperCase());
    const existingTemplates = await prisma.$queryRawUnsafe(
        `SELECT id, COALESCE(metadata->>'code', '') AS code
         FROM core.plan_templates
         WHERE product_id = $1::uuid
           AND deleted_at IS NULL`,
        product.id
    ) as Array<{ id: string; code: string }>;

    const templatesToDisable = existingTemplates.filter((template) => !officialPlanCodes.includes((template.code || '').toUpperCase()));
    for (const template of templatesToDisable) {
        await prisma.$executeRawUnsafe(
            `UPDATE core.plan_templates
             SET is_active = false,
                 status = 'archived',
                 updated_at = now()
             WHERE id = $1::uuid`,
            template.id
        );
        await prisma.$executeRawUnsafe(
            `UPDATE core.plan_versions
             SET is_published = false,
                 is_current = false,
                 effective_to = now()
             WHERE plan_template_id = $1::uuid
               AND deleted_at IS NULL`,
            template.id
        );
    }

    const results: Record<string, { templateId: string; versionId: string }> = {};

    for (const plan of PLANS) {
        console.log(`Procesando ${plan.code}...`);
        results[plan.code] = await upsertPlan(product.id, plan);
    }

    console.log('\nPlanes configurados:\n');
    console.table(PLANS.map((plan) => ({
        codigo: plan.code,
        nombre: plan.name,
        precio_mensual: plan.monthlyPrice === 0 ? 'Gratis' : `$${plan.monthlyPrice.toLocaleString()} MXN`,
        usuarios: plan.limits.users === -1 ? 'Ilimitado' : plan.limits.users,
        contactos: plan.limits.contacts === -1 ? 'Ilimitado' : plan.limits.contacts.toLocaleString(),
        canales: plan.limits.channels === -1 ? 'Ilimitado' : plan.limits.channels,
        ia_tokens: plan.limits.aiTokensPerMonth === -1 ? 'Ilimitado' : plan.limits.aiTokensPerMonth.toLocaleString(),
        publico: plan.isPublic ? 'Si' : 'No',
    })));

    console.log('\nFREE queda como plan inicial por defecto.');
    if (templatesToDisable.length > 0) {
        console.log(`Se desactivaron ${templatesToDisable.length} planes no oficiales de Wabee.`);
    }
}

main()
    .catch((err) => {
        console.error('\nError:', err.message);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
