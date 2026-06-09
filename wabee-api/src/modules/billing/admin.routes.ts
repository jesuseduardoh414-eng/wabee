/**
 * admin.routes.ts — Super Admin: Gestión de Planes Versionados
 * Montado en: /v1/super-admin/plans
 *
 * Regla de versionado: precio, moneda, periodicidad, límites, features,
 * capabilities o stripePriceId → nueva versión. Metadata visual no crea versión.
 */
import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, AuthRequest } from '../../middleware/auth.middleware';
import { prisma, corePrisma } from '../../config/core/core.prisma';
import { StripeSyncService } from './stripe-sync.service';

import { preventImpersonation } from '../../middleware/prevent-impersonation.middleware';
import { isSuperAdmin } from '../../middleware/auth-role.middleware';

const router = Router();

// ─── Middleware Super Admin ───────────────────────────────────────────────────
const requireSuperAdmin = async (req: AuthRequest, res: any, next: any) => {
    try {
        if (!isSuperAdmin(req.user)) {
            return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Solo super administradores de plataforma.' } });
        }
        next();
    } catch {
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Error validando permisos.' } });
    }
};

router.use(authMiddleware, requireSuperAdmin, preventImpersonation);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Campos que disparan nueva versión al editar */
const VERSION_TRIGGER_FIELDS = [
    'monthlyPrice', 'annualPrice', 'currency', 'limitsJson', 'featuresJson', 'capabilitiesJson', 'modulesJson'
];

const needsNewVersion = (patch: Record<string, any>): boolean =>
    VERSION_TRIGGER_FIELDS.some(f => patch[f] !== undefined);

const buildDisplayCode = (code: string, versionNumber: number) =>
    `${code.toUpperCase()}_V${versionNumber}`;

const getWabeeProductId = async (): Promise<string | null> => {
    const product = await corePrisma.product.findFirst({
        where: { slug: { equals: 'wabee', mode: 'insensitive' } },
        select: { id: true }
    });
    return product?.id || null;
};

/** Computa activeOrgsCount y determina el plan más popular */
const getActiveOrgsPerPlan = async (): Promise<Map<string, number>> => {
    const rows: any[] = await corePrisma.$queryRaw`
        SELECT pv.plan_template_id::TEXT as plan_id, COUNT(DISTINCT s.organization_id) as active_orgs
        FROM core.subscriptions s
        JOIN core.plan_versions pv ON pv.id = s.plan_version_id
        WHERE s.status IN ('ACTIVE', 'TRIAL_ACTIVE')
          AND (s.current_period_end IS NULL OR s.current_period_end > NOW())
        GROUP BY pv.plan_template_id
    `;
    const map = new Map<string, number>();
    rows.forEach((r: any) => map.set(r.plan_id, Number(r.active_orgs)));
    return map;
};

const formatPlan = (pt: any, currentVersion: any, activeOrgsCount: number, maxOrgs: number) => ({
    id: pt.id,
    name: pt.name,
    code: pt.metadata?.code || pt.name.toUpperCase(),
    description: pt.description,
    status: pt.status || (pt.isActive ? 'active' : 'archived'),
    isActive: pt.isActive,
    activeOrgsCount,
    isPopular: maxOrgs > 0 && activeOrgsCount === maxOrgs,
    currentVersion: currentVersion ? formatVersion(currentVersion) : null,
    versionsCount: pt._count?.versions ?? 0,
    createdAt: pt.createdAt,
    updatedAt: pt.updatedAt,
    deletedAt: pt.deletedAt || null,
    productId: pt.productId,
});

const formatVersion = (v: any) => ({
    id: v.id,
    versionNumber: v.versionNumber ?? v.version_number,
    displayCode: v.displayCode ?? v.display_code,
    price: Number(v.price), // Legacy
    monthlyPrice: Number(v.monthly_price ?? v.monthlyPrice ?? 0),
    annualPrice: Number(v.annual_price ?? v.annualPrice ?? 0),
    currency: v.currency,
    billingInterval: v.billingInterval ?? v.billing_interval,
    limitsJson: (v.limitsJson ?? v.limits_json) || {},
    featuresJson: (v.featuresJson ?? v.features_json) || {},
    capabilitiesJson: (v.capabilitiesJson ?? v.capabilities_json) || {},
    modulesJson: (v.modulesJson ?? v.modules_json) || {},
    metadataJson: (v.metadataJson ?? v.metadata_json) || {},
    stripePriceMonthlyId: v.stripePriceMonthlyId ?? v.stripe_price_monthly_id,
    stripePriceAnnualId: v.stripePriceAnnualId ?? v.stripe_price_annual_id,
    stripeSyncStatus: v.stripeSyncStatus ?? v.stripe_sync_status,
    stripeSyncError: v.stripeSyncError ?? v.stripe_sync_error,
    stripeSyncedAt: v.stripeSyncedAt ?? v.stripe_synced_at,
    isPublished: v.isPublished ?? v.is_published,
    isCurrent: v.isCurrent ?? v.is_current,
    effectiveFrom: v.effectiveFrom ?? v.effective_from,
    effectiveTo: v.effectiveTo ?? v.effective_to,
    createdAt: v.createdAt ?? v.created_at,
});

// ─── Schemas ──────────────────────────────────────────────────────────────────

const createPlanSchema = z.object({
    name: z.string().min(1),
    code: z.string().min(1).regex(/^[A-Z0-9_]+$/i, 'Código sin espacios ni caracteres especiales'),
    description: z.string().optional(),
    monthlyPrice: z.coerce.number().min(0, 'El precio debe ser un número igual o mayor a 0').default(0),
    annualPrice: z.coerce.number().min(0, 'El precio debe ser un número igual o mayor a 0').default(0),
    currency: z.string().default('mxn'),
    billingInterval: z.enum(['month', 'year']).default('month'),
    limitsJson: z.record(z.any()).default({}),
    featuresJson: z.record(z.any()).default({}),
    capabilitiesJson: z.record(z.any()).default({}),
    modulesJson: z.record(z.any()).default({}),
    metadataJson: z.record(z.any()).default({}),
    stripePriceMonthlyId: z.string().trim().optional().transform(v => !v ? null : v).nullable(),
    stripePriceAnnualId: z.string().trim().optional().transform(v => !v ? null : v).nullable(),
    isPublished: z.boolean().default(false),
    productId: z.string().uuid().optional(),
});

const patchPlanSchema = z.object({
    // Campos de Plan Base (no disparan versión)
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    status: z.enum(['draft', 'active', 'archived']).optional(),
    // Campos de Versión (disparan nueva versión si cambian)
    monthlyPrice: z.coerce.number().min(0).optional(),
    annualPrice: z.coerce.number().min(0).optional(),
    currency: z.string().optional(),
    limitsJson: z.record(z.any()).optional(),
    featuresJson: z.record(z.any()).optional(),
    capabilitiesJson: z.record(z.any()).optional(),
    modulesJson: z.record(z.any()).optional(),
    metadataJson: z.record(z.any()).optional(),
});

const assignPlanSchema = z.object({
    planId: z.string().uuid(),
    startedAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().optional().nullable(),
    notes: z.string().optional(),
});

// ─── GET /v1/super-admin/plans ────────────────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const includeDeleted = req.query.includeDeleted === 'true';
        const includeArchived = req.query.includeArchived === 'true';
        const wabeeProductId = await getWabeeProductId();
        if (!wabeeProductId) {
            return res.status(400).json({ error: { code: 'WABEE_PRODUCT_NOT_FOUND', message: 'No existe el producto Wabee en Core.' } });
        }
        const plans: any[] = await corePrisma.$queryRaw`
            SELECT
                pt.id,
                pt.name,
                pt.description,
                pt.status,
                pt.is_active  AS "isActive",
                pt.metadata,
                pt.product_id AS "productId",
                pt.created_at AS "createdAt",
                pt.updated_at AS "updatedAt",
                pt.deleted_at AS "deletedAt"
            FROM core.plan_templates pt
            WHERE pt.product_id = ${wabeeProductId}::uuid
              AND (${includeDeleted} = true OR pt.deleted_at IS NULL)
              AND (${includeArchived} = true OR COALESCE(pt.status, 'draft') <> 'archived')
            ORDER BY pt.created_at ASC
        `;

        // Obtener versiones vigentes en batch
        const planIds = plans.map((p: any) => p.id);
        const currentVersions: any[] = planIds.length ? await corePrisma.$queryRaw`
            SELECT * FROM core.plan_versions
            WHERE plan_template_id = ANY(${planIds}::UUID[])
              AND is_current = true
        ` : [];
        const cvMap = new Map<string, any>(currentVersions.map((v: any) => [v.plan_template_id, v]));

        // Popularidad por plan base
        const activeOrgsMap = await getActiveOrgsPerPlan();
        const maxOrgs = Math.max(0, ...Array.from(activeOrgsMap.values()));

        // Contar versiones por plan
        const versionCounts: any[] = planIds.length ? await corePrisma.$queryRaw`
            SELECT plan_template_id::TEXT as plan_id, COUNT(*) as cnt
            FROM core.plan_versions WHERE plan_template_id = ANY(${planIds}::UUID[])
            GROUP BY plan_template_id
        ` : [];
        const vcMap = new Map<string, number>(versionCounts.map((r: any) => [r.plan_id, Number(r.cnt)]));

        const result = plans.map((pt: any) => {
            const cv = cvMap.get(pt.id);
            const activeOrgs = activeOrgsMap.get(pt.id) || 0;
            const vc = vcMap.get(pt.id) || 0;
            return formatPlan({ ...pt, _count: { versions: vc } }, cv, activeOrgs, maxOrgs);
        });

        res.json({ plans: result });
    } catch (e: any) {
        console.error('[super-admin/plans] Error GET /', e.message);
        res.status(500).json({ error: { message: e.message } });
    }
});

// ─── GET /v1/super-admin/plans/:id ────────────────────────────────────────────
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const wabeeProductId = await getWabeeProductId();
        const pt = await corePrisma.planTemplate.findUnique({
            where: { id },
            include: { _count: { select: { subscriptions: true } } }
        });
        if (!pt || pt.productId !== wabeeProductId) return res.status(404).json({ error: { code: 'NOT_FOUND' } });

        const versions: any[] = await corePrisma.$queryRaw`
            SELECT * FROM core.plan_versions WHERE plan_template_id = ${id}::UUID ORDER BY version_number DESC
        `;
        const currentVersion = versions.find((v: any) => v.is_current);
        const activeOrgsMap = await getActiveOrgsPerPlan();
        const maxOrgs = Math.max(0, ...Array.from(activeOrgsMap.values()));

        res.json({
            plan: formatPlan({ ...pt, _count: { versions: versions.length } }, currentVersion, activeOrgsMap.get(id) || 0, maxOrgs),
            versions: versions.map(formatVersion),
        });
    } catch (e: any) {
        res.status(500).json({ error: { message: e.message } });
    }
});

// ─── POST /v1/super-admin/plans ───────────────────────────────────────────────
router.post('/', async (req: AuthRequest, res) => {
    try {
        const receivedPrice = req.body.price;
        const data = createPlanSchema.parse(req.body);
        console.log('[super-admin/plans] POST CREATE', {
            receivedPrice,
            parsedPrice: data.monthlyPrice,
            stripeMonthly: data.stripePriceMonthlyId,
            stripeAnnual: data.stripePriceAnnualId
        });
        const code = data.code.toUpperCase();

        // Verificar código único
        const existing = await corePrisma.planTemplate.findFirst({
            where: { metadata: { path: ['code'], equals: code } }
        });
        if (existing) return res.status(400).json({ error: { code: 'CODE_EXISTS', message: `El código "${code}" ya existe.` } });

        // Buscar un producto por defecto si no se provió uno (PlanTemplate requiere Product obligatorio)
        let pId = data.productId;
        if (!pId) {
            const wabeeProductId = await getWabeeProductId();
            if (!wabeeProductId) {
                return res.status(400).json({ error: { code: 'NO_PRODUCT_FOUND', message: 'No existe el producto Wabee para asociar este plan.' } });
            }
            pId = wabeeProductId;
        }

        // Crear PlanTemplate (plan base)
        const pt = await corePrisma.planTemplate.create({
            data: {
                name: data.name,
                description: data.description || null,
                price: data.monthlyPrice || data.annualPrice || 0, // Legacy fallback
                currency: data.currency,
                interval: data.monthlyPrice > 0 ? 'month' : 'year', // Legacy fallback
                isActive: false, // empieza como draft
                limits: data.limitsJson,
                features: data.featuresJson,
                metadata: {
                    code,
                    displayName: data.name,
                    isPublic: data.isPublished,
                    status: 'draft',
                    ...data.metadataJson,
                },
                productId: pId,
            }
        });

        // Crear versión inicial v1 usando SQL directo (tabla no en Prisma model)
        await corePrisma.$executeRaw`
            INSERT INTO core.plan_versions (
                plan_template_id, version_number, display_code,
                price, currency, billing_interval,
                monthly_price, annual_price,
                limits_json, features_json, capabilities_json, modules_json, metadata_json,
                is_published, is_current, stripe_sync_status
            ) VALUES (
                ${pt.id}::UUID, 1, ${buildDisplayCode(code, 1)},
                ${data.monthlyPrice || data.annualPrice || 0}::NUMERIC(12,2), 
                ${data.currency}, 
                ${data.monthlyPrice > 0 ? 'month' : 'year'},
                ${data.monthlyPrice}::NUMERIC(12,2),
                ${data.annualPrice}::NUMERIC(12,2),
                ${JSON.stringify(data.limitsJson)}::JSONB,
                ${JSON.stringify(data.featuresJson)}::JSONB,
                ${JSON.stringify(data.capabilitiesJson)}::JSONB,
                ${JSON.stringify(data.modulesJson)}::JSONB,
                ${JSON.stringify(data.metadataJson)}::JSONB,
                ${data.isPublished}, true, 'PENDING'
            )
        `;

        const versionData: any[] = await corePrisma.$queryRaw`
            SELECT * FROM core.plan_versions WHERE plan_template_id = ${pt.id}::UUID AND version_number = 1 LIMIT 1
        `;
        const version = versionData[0];

        // ─── Sincronización Stripe (No bloqueante) ───
        StripeSyncService.syncPlanVersion(version.id).catch(e => 
            console.error(`[Admin/Plans] Error disparando sync inicial:`, e.message)
        );

        res.status(201).json({
            plan: { id: pt.id, name: pt.name, code, status: 'draft' },
            version: formatVersion(version),
        });
    } catch (e: any) {
        if (e instanceof z.ZodError) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: e.errors } });
        console.error('[super-admin/plans] Error POST', e.message);
        res.status(500).json({ error: { message: e.message } });
    }
});

// ─── PATCH /v1/super-admin/plans/:id ─────────────────────────────────────────
router.patch('/:id', async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const receivedPrice = req.body.price;
        const patch = patchPlanSchema.parse(req.body);
        console.log('[super-admin/plans] PATCH UPDATE', {
            planId: id,
            receivedPrice,
            parsedPrice: patch.monthlyPrice
        });

        const pt = await corePrisma.planTemplate.findUnique({ where: { id } });
        if (!pt) return res.status(404).json({ error: { code: 'NOT_FOUND' } });

        // Obtener versión actual
        const currentVersions: any[] = await corePrisma.$queryRaw`
            SELECT * FROM core.plan_versions WHERE plan_template_id = ${id}::UUID AND is_current = true LIMIT 1
        `;
        const cv = currentVersions[0];

        let newVersion: any = null;
        let versionCreated = false;

        if (cv && needsNewVersion(patch)) {
            // Cerrar versión actual
            await corePrisma.$executeRaw`
                UPDATE core.plan_versions SET is_current = false, effective_to = NOW()
                WHERE id = ${cv.id}::UUID
            `;

            // Crear nueva versión
            const nextVersionNumber = (cv.version_number || 1) + 1;
            const code = (pt.metadata as any)?.code || pt.name.toUpperCase();

            const mPrice = patch.monthlyPrice !== undefined ? patch.monthlyPrice : Number(cv.monthly_price);
            const aPrice = patch.annualPrice !== undefined ? patch.annualPrice : Number(cv.annual_price);

            await corePrisma.$executeRaw`
                INSERT INTO core.plan_versions (
                    plan_template_id, version_number, display_code,
                    price, currency, billing_interval,
                    monthly_price, annual_price,
                    limits_json, features_json, capabilities_json, modules_json, metadata_json,
                    is_published, is_current, stripe_sync_status
                ) VALUES (
                    ${id}::UUID, ${nextVersionNumber}, ${buildDisplayCode(code, nextVersionNumber)},
                    ${mPrice || aPrice || 0}::NUMERIC(12,2),
                    ${patch.currency ?? cv.currency},
                    ${mPrice > 0 ? 'month' : 'year'},
                    ${mPrice}::NUMERIC(12,2),
                    ${aPrice}::NUMERIC(12,2),
                    ${JSON.stringify(patch.limitsJson ?? cv.limits_json)}::JSONB,
                    ${JSON.stringify(patch.featuresJson ?? cv.features_json)}::JSONB,
                    ${JSON.stringify(patch.capabilitiesJson ?? cv.capabilities_json)}::JSONB,
                    ${JSON.stringify(patch.modulesJson ?? cv.modules_json)}::JSONB,
                    ${JSON.stringify(patch.metadataJson ?? cv.metadata_json)}::JSONB,
                    ${cv.is_published}, true, 'PENDING'
                )
            `;
            versionCreated = true;

            const newVersionData: any[] = await corePrisma.$queryRaw`
                SELECT * FROM core.plan_versions WHERE plan_template_id = ${id}::UUID AND version_number = ${nextVersionNumber} LIMIT 1
            `;
            newVersion = newVersionData[0];

            // ─── Sincronización Stripe (No bloqueante) ───
            StripeSyncService.syncPlanVersion(newVersion.id).catch(e => 
                console.error(`[Admin/Plans] Error disparando sync de nueva versión:`, e.message)
            );
        }

        // Actualizar plan base (campos no versionados)
        const updateData: Record<string, any> = {};
        if (patch.name) { updateData.name = patch.name; }
        if (patch.description !== undefined) { updateData.description = patch.description; }
        if (patch.status) {
            updateData.isActive = patch.status === 'active';
        }

        if (Object.keys(updateData).length > 0) {
            await corePrisma.planTemplate.update({ where: { id }, data: updateData });
        }

        // status no existe en el modelo Prisma core → raw SQL
        if (patch.status) {
            await prisma.$executeRaw`UPDATE core.plan_templates SET status = ${patch.status} WHERE id = ${id}::UUID`;
        }

        res.json({
            versionCreated,
            message: versionCreated
                ? `Se creó una nueva versión. Los clientes actuales conservan su configuración anterior.`
                : `Metadatos del plan actualizados. Sin nueva versión.`,
            newVersion: newVersion ? formatVersion(newVersion) : null,
        });
    } catch (e: any) {
        if (e instanceof z.ZodError) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: e.errors } });
        res.status(500).json({ error: { message: e.message } });
    }
});

// ─── POST /v1/super-admin/plans/:id/publish ───────────────────────────────────
router.post('/:id/publish', async (req, res) => {
    try {
        const { id } = req.params;
        const { publish } = z.object({ publish: z.boolean() }).parse(req.body);

        const pt = await corePrisma.planTemplate.findUnique({ where: { id } });
        if (!pt) return res.status(404).json({ error: { code: 'NOT_FOUND' } });

        await prisma.$executeRaw`
            UPDATE core.plan_versions SET is_published = ${publish}
            WHERE plan_template_id = ${id}::UUID AND is_current = true
        `;
        await corePrisma.planTemplate.update({
            where: { id },
            data: {
                isActive: publish,
                metadata: { ...(pt.metadata as any), isPublic: publish, status: publish ? 'active' : 'draft' }
            }
        });
        await prisma.$executeRaw`
            UPDATE core.plan_templates SET status = ${publish ? 'active' : 'draft'}
            WHERE id = ${id}::UUID
        `;

        res.json({ success: true, published: publish });
    } catch (e: any) {
        if (e instanceof z.ZodError) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: e.errors } });
        res.status(500).json({ error: { message: e.message } });
    }
});

// ─── POST /v1/super-admin/plans/:id/archive ───────────────────────────────────
router.post('/:id/archive', async (req, res) => {
    try {
        const { id } = req.params;
        const pt = await corePrisma.planTemplate.findUnique({ where: { id } });
        if (!pt) return res.status(404).json({ error: { code: 'NOT_FOUND' } });

        await corePrisma.planTemplate.update({
            where: { id },
            data: {
                isActive: false,
                metadata: { ...(pt.metadata as any), status: 'archived', isPublic: false }
            }
        });
        await prisma.$executeRaw`
            UPDATE core.plan_versions SET is_published = false
            WHERE plan_template_id = ${id}::UUID
        `;
        await prisma.$executeRaw`
            UPDATE core.plan_templates SET status = 'archived'
            WHERE id = ${id}::UUID
        `;
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: { message: e.message } });
    }
});

// ─── GET /v1/super-admin/plans/:id/versions ───────────────────────────────────
router.get('/:id/versions', async (req, res) => {
    try {
        const { id } = req.params;
        const versions: any[] = await corePrisma.$queryRaw`
            SELECT * FROM core.plan_versions WHERE plan_template_id = ${id}::UUID ORDER BY version_number DESC
        `;
        res.json({ versions: versions.map(formatVersion) });
    } catch (e: any) {
        res.status(500).json({ error: { message: e.message } });
    }
});

// ─── DELETE /v1/super-admin/plans/:id (Soft Delete) ───────────────────────────
router.delete('/:id', async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const pt = await corePrisma.planTemplate.findUnique({ where: { id } });
        if (!pt) return res.status(404).json({ error: { code: 'NOT_FOUND' } });

        // Validate active subscriptions
        const activeSubs = await corePrisma.subscription.count({
            where: {
                planTemplateId: id,
                status: { in: ['ACTIVE', 'TRIAL_ACTIVE', 'PAST_DUE'] }
            }
        });

        if (activeSubs > 0) {
            return res.status(400).json({ error: { code: 'ACTIVE_SUBSCRIPTIONS', message: 'No se puede eliminar un plan con suscripciones activas. Por favor archívelo o asigne los clientes a otro plan.' } });
        }

        // Soft delete
        await corePrisma.planTemplate.update({
            where: { id },
            data: { deletedAt: new Date() }
        });

        // Audit Trail
        try {
            await corePrisma.auditTrail.create({
                data: {
                    userId: req.user?.id,
                    action: 'delete_plan',
                    modelType: 'PlanTemplate',
                    modelId: id,
                    description: `Plan ${pt.name} (${(pt.metadata as any)?.code}) eliminado lógicamente`,
                }
            });
        } catch (e) {
            console.error('Error logging audit for delete_plan:', e);
        }

        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: { message: e.message } });
    }
});

// ─── POST /v1/super-admin/plans/:id/restore ───────────────────────────────────
router.post('/:id/restore', async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const pt = await corePrisma.planTemplate.findUnique({ where: { id } });
        if (!pt) return res.status(404).json({ error: { code: 'NOT_FOUND' } });

        await corePrisma.planTemplate.update({
            where: { id },
            data: { deletedAt: null }
        });

        // Audit Trail
        try {
            await corePrisma.auditTrail.create({
                data: {
                    userId: req.user?.id,
                    action: 'restore_plan',
                    modelType: 'PlanTemplate',
                    modelId: id,
                    description: `Plan ${pt.name} (${(pt.metadata as any)?.code}) restaurado`,
                }
            });
        } catch (e) {
            console.error('Error logging audit for restore_plan:', e);
        }

        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: { message: e.message } });
    }
});

// ─── POST /v1/super-admin/organizations/:orgId/assign-plan ───────────────────
router.post('/organizations/:orgId/assign-plan', async (req: AuthRequest, res) => {
    try {
        const { orgId } = req.params;
        const data = assignPlanSchema.parse(req.body);

        const org = await corePrisma.organization.findUnique({ where: { id: orgId } });
        if (!org) return res.status(404).json({ error: { code: 'ORG_NOT_FOUND' } });

        // Obtener versión vigente del plan
        const versions: any[] = await corePrisma.$queryRaw`
            SELECT pv.*, pt.name as plan_name, pt.metadata as plan_metadata
            FROM core.plan_versions pv
            JOIN core.plan_templates pt ON pt.id = pv.plan_template_id
            WHERE pv.plan_template_id = ${data.planId}::UUID
              AND pv.is_current = true AND pv.is_published = true
            LIMIT 1
        `;
        const version = versions[0];
        if (!version) return res.status(400).json({ error: { code: 'NO_PUBLISHED_VERSION', message: 'El plan no tiene una versión vigente publicada.' } });

        const meta = version.plan_metadata || {};
        const now = new Date();
        const startedAt = data.startedAt ? new Date(data.startedAt) : now;
        // Por defecto periodo de 30 días si no se especifica
        const periodEnd = data.endsAt ? new Date(data.endsAt) : new Date(startedAt.getTime() + 30 * 24 * 60 * 60 * 1000);

        // Snapshot canónico e inmutable
        const snapshot = {
            planId: data.planId,
            planVersionId: version.id,
            planCode: meta.code || version.plan_name?.toUpperCase(),
            planName: meta.displayName || version.plan_name,
            displayCode: version.display_code,
            versionNumber: version.version_number,
            price: Number(version.price).toFixed(2),
            currency: version.currency,
            billingInterval: version.billing_interval,
            stripePriceMonthlyId: version.stripe_price_monthly_id || null,
            stripePriceAnnualId: version.stripe_price_annual_id || null,
            limits: version.limits_json,
            features: version.features_json,
            capabilities: version.capabilities_json,
            modules: version.modules_json,
            snapshotCreatedAt: now.toISOString(),
        };

        // Cancelar suscripción activa anterior si existe
        await corePrisma.subscription.updateMany({
            where: { tenantId: orgId, status: { in: ['ACTIVE', 'TRIAL_ACTIVE'] } },
            data: { status: 'CANCELED' }
        });

        // Crear nueva suscripción con snapshot completo
        const sub = await corePrisma.subscription.create({
            data: {
                tenantId: orgId,
                planTemplateId: data.planId,
                status: 'ACTIVE',
                currentPeriodStart: startedAt,
                currentPeriodEnd: periodEnd,
                planVersionId: version.id,
                planCodeSnapshot: snapshot.planCode,
                planNameSnapshot: snapshot.planName,
                versionNumberSnapshot: version.version_number,
                priceSnapshot: Number(version.price),
                currencySnapshot: version.currency,
                billingIntervalSnapshot: version.billing_interval,
                limitsSnapshot: version.limits_json,
                featuresSnapshot: version.features_json,
                capabilitiesSnapshot: version.capabilities_json,
                snapshotCreatedAt: now,
                snapshotJson: snapshot,
            }
        });

        // Actualizar planTemplateId en la organización
        await corePrisma.organization.update({
            where: { id: orgId },
            data: { planTemplateId: data.planId }
        });

        res.status(201).json({ subscription: sub, snapshot });
    } catch (e: any) {
        if (e instanceof z.ZodError) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: e.errors } });
        console.error('[super-admin/plans] Error assign-plan', e.message);
        res.status(500).json({ error: { message: e.message } });
    }
});

// ─── POST /v1/super-admin/plans/:id/sync-stripe ───────────────────────────────
// Fuerza la re-sincronización de la versión actual de un plan con Stripe.
router.post('/:id/sync-stripe', async (req, res) => {
    try {
        const { id } = req.params;
        const pt = await corePrisma.planTemplate.findUnique({ where: { id } });
        if (!pt) return res.status(404).json({ error: { code: 'NOT_FOUND' } });

        const currentVersions: any[] = await corePrisma.$queryRaw`
            SELECT id FROM core.plan_versions
            WHERE plan_template_id = ${id}::UUID AND is_current = true
            LIMIT 1
        `;
        const version = currentVersions[0];
        if (!version) return res.status(400).json({ error: { code: 'NO_CURRENT_VERSION', message: 'El plan no tiene una versión vigente.' } });

        // Disparar sincronización (await para devolver resultado inmediato)
        await StripeSyncService.syncPlanVersion(version.id);

        // Devolver estado actualizado
        const updated: any[] = await corePrisma.$queryRaw`
            SELECT stripe_price_monthly_id, stripe_price_annual_id, stripe_sync_status, stripe_sync_error, stripe_synced_at
            FROM core.plan_versions WHERE id = ${version.id}::uuid
        `;
        const result = updated[0];

        res.json({
            success: result?.stripe_sync_status === 'READY' || result?.stripe_sync_status === 'NOT_REQUIRED',
            versionId: version.id,
            stripeSyncStatus: result?.stripe_sync_status,
            stripePriceMonthlyId: result?.stripe_price_monthly_id,
            stripePriceAnnualId: result?.stripe_price_annual_id,
            syncError: result?.stripe_sync_error,
            syncedAt: result?.stripe_synced_at,
        });
    } catch (e: any) {
        console.error('[super-admin/plans] Error sync-stripe', e.message);
        res.status(500).json({ error: { message: e.message } });
    }
});

// ─── POST /v1/super-admin/plans/sync-all-stripe ───────────────────────────────
// Sincroniza TODOS los planes con precios con Stripe (útil para setup inicial).
router.post('/sync-all-stripe', async (req, res) => {
    try {
        const versions: any[] = await corePrisma.$queryRaw`
            SELECT pv.id, pt.name as plan_name, pt.metadata->>'code' as plan_code,
                   pv.monthly_price, pv.annual_price, pv.stripe_sync_status
            FROM core.plan_versions pv
            JOIN core.plan_templates pt ON pv.plan_template_id = pt.id
            WHERE pv.is_current = true AND pt.deleted_at IS NULL
        `;

        const results: any[] = [];
        for (const v of versions) {
            const monthlyPrice = Number(v.monthly_price || 0);
            const annualPrice = Number(v.annual_price || 0);
            if (monthlyPrice === 0 && annualPrice === 0) {
                results.push({ id: v.id, plan: v.plan_code || v.plan_name, status: 'NOT_REQUIRED' });
                continue;
            }
            try {
                await StripeSyncService.syncPlanVersion(v.id);
                const updated: any[] = await corePrisma.$queryRaw`
                    SELECT stripe_sync_status, stripe_price_monthly_id, stripe_price_annual_id
                    FROM core.plan_versions WHERE id = ${v.id}::uuid
                `;
                const r = updated[0];
                results.push({
                    id: v.id, plan: v.plan_code || v.plan_name,
                    status: r?.stripe_sync_status,
                    monthlyId: r?.stripe_price_monthly_id,
                    annualId: r?.stripe_price_annual_id,
                });
            } catch (err: any) {
                results.push({ id: v.id, plan: v.plan_code || v.plan_name, status: 'ERROR', error: err.message });
            }
        }

        const allReady = results.every(r => r.status === 'READY' || r.status === 'NOT_REQUIRED');
        res.json({ success: allReady, results });
    } catch (e: any) {
        res.status(500).json({ error: { message: e.message } });
    }
});

export { router as superAdminPlansRoutes };
