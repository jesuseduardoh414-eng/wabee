import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, AuthRequest } from '../../middleware/auth.middleware';
import { preventImpersonation } from '../../middleware/prevent-impersonation.middleware';
import { coreAdapter } from '../core/core.adapter';
import { prisma, corePrisma } from '../../config/core/core.prisma';
import Stripe from 'stripe';
import { coreEnv } from '../../config/core/core.env';
import { resolveOrganizationPlanSnapshot, getEmptyPlanSnapshot } from './plan-resolver';
import { normalizePeriod } from './billing.service';
import { LimitsService } from './limits.service';
import { tenancyAdapter } from '../wabee/_adapters/tenancy.adapter';
import { tenantMiddleware } from '../../middleware/tenant';
import { GlobalAuditLogService } from '@/modules/audit/global-audit-log.service';
import { getAuditContext } from '@/shared/http/request-audit-context';

const router = Router();

type PublicPlanResponse = {
    id: string;
    code: string;
    name: string;
    monthlyPrice: number;
    annualPrice: number;
    currency: string;
    activationMode: 'direct' | 'stripe';
    canActivateDirectly: boolean;
    canCheckoutMonthly: boolean;
    canCheckoutAnnual: boolean;
    checkoutStatus: string;
    checkoutMessage: string;
    isEnterprise: boolean;
    limits: {
        channels: number;
        contacts: number;
        aiTokensPerMonth: number;
        storageMb: number;
        users: number;
    };
    flags: Record<string, any>;
    description: string;
};

const getWabeeProductId = async (): Promise<string | null> => {
    const wabeeProduct = await corePrisma.product.findFirst({
        where: { slug: { equals: 'wabee', mode: 'insensitive' } },
        select: { id: true }
    });

    return wabeeProduct?.id || null;
};

const buildPublicPlansResponse = async (productId: string | null): Promise<PublicPlanResponse[]> => {
    const rawTemplates: any[] = await corePrisma.$queryRaw`
        SELECT id, name, description, metadata, deleted_at as "deletedAt", is_active as "isActive"
        FROM core.plan_templates
        WHERE deleted_at IS NULL
          AND is_active = true
          AND (${productId}::uuid IS NULL OR product_id = ${productId}::uuid)
    `;

    const plansWithVersions = await Promise.all(rawTemplates.map(async (template) => {
        const versions: any[] = await corePrisma.$queryRaw`
            SELECT monthly_price as "monthlyPrice",
                   annual_price as "annualPrice",
                   currency,
                   stripe_price_monthly_id as "stripePriceMonthlyId",
                   stripe_price_annual_id as "stripePriceAnnualId",
                   limits_json as "limitsJson",
                   features_json as "featuresJson",
                   is_published as "isPublished",
                   is_current as "isCurrent"
            FROM core.plan_versions
            WHERE plan_template_id = ${template.id}::uuid
              AND is_current = true
              AND deleted_at IS NULL
            LIMIT 1
        `;

        return { ...template, version: versions[0] || null };
    }));

    return plansWithVersions
        .filter((plan) => {
            const meta = (plan.metadata || {}) as Record<string, any>;
            const code = String(meta.code || plan.name || '').toUpperCase();

            if (plan.deletedAt || plan.isActive !== true) return false;
            if (meta.isPublic !== true) return false;
            if (code === 'TRIAL' || code === 'FREE') return false;
            if (!plan.version?.isPublished || !plan.version?.isCurrent) return false;

            return true;
        })
        .map((plan) => {
            const version = plan.version;
            const meta = (plan.metadata || {}) as Record<string, any>;
            const limits = (version.limitsJson || {}) as Record<string, any>;
            const monthlyPrice = Number(version.monthlyPrice ?? 0);
            const annualPrice = Number(version.annualPrice ?? 0);
            const isFree = monthlyPrice === 0 && annualPrice === 0;
            const monthlyStripePriceId = meta?.stripePriceMonthlyId || version.stripePriceMonthlyId || null;
            const annualStripePriceId = meta?.stripePriceAnnualId || version.stripePriceAnnualId || null;
            const canCheckoutMonthly = !!(monthlyStripePriceId && String(monthlyStripePriceId).startsWith('price_'));
            const canCheckoutAnnual = !!(annualStripePriceId && String(annualStripePriceId).startsWith('price_'));

            let checkoutStatus = 'incomplete';
            let checkoutMessage = 'Configuracion de Stripe pendiente';

            if (isFree) {
                checkoutStatus = 'free';
                checkoutMessage = 'Activacion directa disponible';
            } else if (canCheckoutMonthly && canCheckoutAnnual) {
                checkoutStatus = 'ready_both';
                checkoutMessage = 'Disponible mensual y anual';
            } else if (canCheckoutMonthly) {
                checkoutStatus = 'monthly_only';
                checkoutMessage = 'Disponible solo mensual';
            } else if (canCheckoutAnnual) {
                checkoutStatus = 'annual_only';
                checkoutMessage = 'Disponible solo anual';
            }

            return {
                id: plan.id,
                code: meta.code || plan.name,
                name: meta.displayName || plan.name,
                monthlyPrice,
                annualPrice,
                currency: String(version.currency || 'USD').toUpperCase(),
                activationMode: isFree ? 'direct' as const : 'stripe' as const,
                canActivateDirectly: isFree,
                canCheckoutMonthly,
                canCheckoutAnnual,
                checkoutStatus,
                checkoutMessage,
                isEnterprise: String(meta.code || '').toUpperCase() === 'ENTERPRISE',
                limits: {
                    channels: Number(limits.channels ?? 0),
                    contacts: Number(limits.contacts ?? 0),
                    aiTokensPerMonth: Number(limits.aiTokensPerMonth ?? 0),
                    storageMb: Number(limits.storageMb ?? 0),
                    users: Number(limits.users ?? 0),
                },
                flags: (version.featuresJson || {}) as Record<string, any>,
                description: String(plan.description || ''),
            };
        })
        .sort((a, b) => a.monthlyPrice - b.monthlyPrice);
};

router.get('/public-plans', async (_req, res) => {
    try {
        const productId = await getWabeeProductId();
        const plans = await buildPublicPlansResponse(productId);
        res.json({ plans });
    } catch (error: any) {
        console.error('[billing/public-plans] Error:', error.message);
        res.status(500).json({ error: { code: 'PUBLIC_PLANS_ERROR', message: 'Error al obtener planes publicos.' } });
    }
});

// Apply auth, tenant and prevent-impersonation middleware automatically to all billing routes
router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(preventImpersonation);

// ─── Stripe client (lazy init) ─────────────────────────────────────────────
let _stripe: Stripe | null = null;
const getStripe = (): Stripe => {
    if (!_stripe) {
        if (!coreEnv.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY no configurada.');
        _stripe = new Stripe(coreEnv.STRIPE_SECRET_KEY, { apiVersion: '2025-02-24.acacia' });
    }
    return _stripe;
};

// ─── Helpers ────────────────────────────────────────────────────────────────
const requireAdmin = async (req: AuthRequest, res: any, next: any) => {
    try {
        const orgId = tenancyAdapter.getTenantId(req);
        res.locals.orgId = orgId;
        // Super Admin siempre tiene acceso a billing
        if (req.user?.globalRole === 'admin') return next();
        // Usar coreAdapter — organizationMember pertenece al schema Core, no a WABEE
        const membership = await coreAdapter.organizations.getMembership(orgId, req.user.id);
        const role = ((membership as any)?.role?.slug || '').toUpperCase();
        if (role !== 'ADMIN') {
            return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Solo administradores pueden gestionar el billing.' } });
        }
        next();
    } catch {
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Error validando permisos.' } });
    }
};

// Obtener period en string para respuesta
const periodLabel = (interval: string) => {
    if (interval === 'year' || interval === 'annual') return 'annual';
    return 'monthly';
};

// GET /v1/billing/summary
router.get('/summary', requireAdmin, async (req: AuthRequest, res) => {
    try {
        const orgId = tenancyAdapter.getTenantId(req);

        // 1. Cargar Org y Suscripción para estados temporales
        // organization y subscription son modelos del Core → usar corePrisma
        const org = await corePrisma.organization.findUnique({
            where: { id: orgId },
            select: { id: true, externalCustomerIds: true }
        });

        if (!org) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Organización no encontrada.' } });

        // Cargar suscripción activa por separado para evitar conflictos de tipo
        const externalCustomerId =
            (org?.externalCustomerIds && typeof org.externalCustomerIds === 'object'
                ? (org.externalCustomerIds as any)?.stripe || null
                : null);

        const sub = await (corePrisma as any).subscription.findFirst({
            where: {
                tenantId: orgId,
                status: { in: ['ACTIVE', 'TRIAL_ACTIVE', 'PAST_DUE'] }
            },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                status: true,
                currentPeriodEnd: true,
                cancelAtPeriodEnd: true,
                externalIds: true,
                trialEndsAt: true,
                createdAt: true
            }
        });
        
        const externalSubscriptionId =
            (sub?.externalIds && typeof sub.externalIds === 'object'
                ? (sub.externalIds as any)?.stripe || null
                : null);

        // 2. Obtener el snapshot efectivo (congelado) del plan
        const snapshot = await resolveOrganizationPlanSnapshot(orgId) || getEmptyPlanSnapshot();

        const limits = snapshot.limits || {};
        const isTrial = snapshot.planCode === 'TRIAL' || sub?.status === 'TRIAL_ACTIVE';
        const now = new Date();

        // Calcular días restantes de trial
        let trialDaysRemaining: number | null = null;
        if (isTrial) {
            const trialEnd = sub?.trialEndsAt || sub?.currentPeriodEnd;
            if (trialEnd) {
                const diff = new Date(trialEnd).getTime() - now.getTime();
                trialDaysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
            }
        }

        // 3. Uso de Recursos (Real) usando LimitsService
        const [
            channelsCount, 
            contactsCount, 
            aiAgentsCount, 
            campaignsCount, 
            aiTokensUsed,
            usersCount,
            storageStats
        ] = await Promise.all([
            LimitsService.countChannels(orgId),
            LimitsService.countContacts(orgId),
            LimitsService.countAiAgents(orgId),
            LimitsService.countCampaignsThisMonth(orgId),
            LimitsService.getAiTokensUsageThisMonth(orgId),
            LimitsService.countTeamMembers(orgId),
            // tenantStorageStats es modelo del Core → usar corePrisma
            corePrisma.tenantStorageStats.findUnique({
                where: { tenantId: orgId },
                select: { totalSizeBytes: true }
            }),
        ]);

        const storageMbUsed = Math.round(Number(storageStats?.totalSizeBytes || 0) / (1024 * 1024));

        // 4. Actions
        const canCancel = sub?.status === 'ACTIVE' && !!externalSubscriptionId && !sub?.cancelAtPeriodEnd;
        const canUpgrade = true; 

        res.json({
            plan: {
                id: sub?.id || null,
                externalId: externalSubscriptionId,
                name: snapshot.planName,
                displayName: snapshot.planName,
                code: snapshot.planCode,
                period: snapshot.billingInterval === 'year' ? 'annual' : 'monthly',
                status: sub?.status || 'ACTIVE',
                price: Number(snapshot.price),
                monthlyPrice: Number(snapshot.monthlyPrice),
                annualPrice: Number(snapshot.annualPrice),
                currency: snapshot.currency.toUpperCase(),
                renewsAt: sub?.currentPeriodEnd || null,
                cancelAtPeriodEnd: sub?.cancelAtPeriodEnd || false,
                isTrial,
                trialDaysRemaining,
                version: snapshot.versionNumber,
                createdAt: sub?.createdAt || null,
            },
            limits: {
                channels: limits.channels ?? null,
                contacts: limits.contacts ?? null,
                aiAgents: limits.aiAgents ?? null,
                campaignsPerMonth: limits.campaignsPerMonth ?? null,
                aiTokensPerMonth: limits.aiTokensPerMonth ?? null,
                storageMb: limits.storageMb ?? null,
                users: limits.users ?? null,
            },
            modules: snapshot.modules || {},
            usage: {
                channels: channelsCount,
                contacts: contactsCount,
                aiAgents: aiAgentsCount,
                campaignsPerMonth: campaignsCount,
                aiTokensPerMonth: aiTokensUsed,
                users: usersCount,
                storageMb: storageMbUsed,
            },
            actions: { canUpgrade, canCancel, hasStripeCustomer: !!externalCustomerId }
        });
    } catch (error: any) {
        console.error('[billing/summary] Error:', error.message);
        res.status(500).json({ error: { code: 'SUMMARY_ERROR', message: 'Error al obtener resumen de billing.' } });
    }
});

import { BillingService } from './billing.service';

// ─── POST /v1/billing/subscribe ─────────────────────────────────────────────
const subscribeParamSchema = z.object({
    planTemplateCode: z.string(),
    period: z.enum(['monthly', 'annual']).default('monthly'),
    successUrl: z.string().url().optional(),
    cancelUrl: z.string().url().optional(),
    isDirect: z.boolean().optional(), // Si es true, intenta activación local si el plan lo permite
});

router.post('/subscribe', requireAdmin, async (req: AuthRequest, res) => {
    const auditCtx = getAuditContext(req);
    try {
        const orgId = res.locals.orgId;
        const { planTemplateCode, period, successUrl, cancelUrl, isDirect } = subscribeParamSchema.parse(req.body);

        // 1. DEBUG: Raw SQL para evadir mapping de Prisma
        console.log(`[DEBUG_SUBS] Buscando planTemplate con name: ${planTemplateCode} vía queryRaw`);
        const rawResults: any[] = await corePrisma.$queryRaw`
            SELECT id, name, product_id as "productId", status, metadata
            FROM core.plan_templates
            WHERE (name = ${planTemplateCode} OR metadata->>'code' = ${planTemplateCode}) AND deleted_at IS NULL
            LIMIT 1
        `;
        const planTemplate = rawResults[0];
        console.log(`[DEBUG_SUBS] Resultado Raw:`, planTemplate);

        if (!planTemplate) {
            return res.status(404).json({ error: { code: 'PLAN_NOT_FOUND', message: 'Plan no encontrado o no disponible para contratación.' } });
        }

        // 2. DEBUG: Obtener versión vía SQL
        const rawVersions: any[] = await corePrisma.$queryRaw`
            SELECT id, price, currency, billing_interval as "billingInterval", 
                   monthly_price as "monthlyPrice", annual_price as "annualPrice",
                   stripe_price_monthly_id as "stripePriceMonthlyId", 
                   stripe_price_annual_id as "stripePriceAnnualId"
            FROM core.plan_versions
            WHERE plan_template_id = ${planTemplate.id}::uuid 
              AND is_current = true AND is_published = true AND deleted_at IS NULL
            LIMIT 1
        `;
        const currentVersion = rawVersions[0];
        console.log(`[DEBUG_SUBS] Versión Raw:`, currentVersion);

        if (!currentVersion) {
            return res.status(400).json({ error: { code: 'NO_ACTIVE_VERSION', message: 'El plan no tiene una versión publicada y vigente actualmente.' } });
        }

        const priceIdRaw = period === 'annual' ? currentVersion.stripePriceAnnualId : currentVersion.stripePriceMonthlyId;
        const priceId = priceIdRaw ? String(priceIdRaw).trim() : null;
        const priceValue = period === 'annual' ? Number(currentVersion.annualPrice) : Number(currentVersion.monthlyPrice);
        const isFree = priceValue === 0;

        console.log(`[DEBUG_SUBS] Checkout Params:`, { period, planTemplateCode, planVersionId: currentVersion.id, priceId, isFree });

        // REGLA DE ORO: Si no es GRATIS, DEBE tener un Price ID válido que empiece con price_
        if (!isFree) {
            if (!priceId || !priceId.startsWith('price_')) {
                console.error(`[DEBUG_SUBS] Error: Stripe Price ID ausente o formato inválido ("${priceId}") para plan pagado.`);
                await GlobalAuditLogService.logEvent({
                    category: 'billing',
                    eventType: 'billing.subscribe.stripe_config_error',
                    severity: 'critical',
                    outcome: 'failure',
                    message: `Configuración inválida de Stripe para plan ${planTemplateCode} (${period}). PriceId: ${priceId}`,
                    metadata: { orgId, planTemplateCode, period, priceId }
                }, auditCtx);
                return res.status(400).json({ 
                    error: { 
                        code: 'INVALID_STRIPE_CONFIG', 
                        message: `El plan no está listo para cobro ${period === 'monthly' ? 'mensual' : 'anual'}. El ID de Stripe es inválido o no existe.` 
                    } 
                });
            }
        }

        // 3. Cargar Org con campos mínimos necesarios
        console.log(`[DEBUG_SUBS] Cargando organización: ${orgId}`);
        const org = await corePrisma.organization.findUnique({
            where: { id: orgId },
            select: { id: true, name: true, externalCustomerIds: true } as any
        });
        console.log(`[DEBUG_SUBS] Org cargada:`, { id: (org as any)?.id, name: (org as any)?.name, hasCustomerIds: !!(org as any)?.externalCustomerIds });

        if (!org) {
            return res.status(404).json({ error: { code: 'ORG_NOT_FOUND', message: 'Organización no encontrada.' } });
        }

        // Normalizar el periodo solicitado ANTES de cualquier comparación
        const normalizedPeriod = normalizePeriod(period);

        const rawSubs: any[] = await corePrisma.$queryRaw`
            SELECT id,
                   plan_version_id              AS "planVersionId",
                   external_ids                 AS "externalIds",
                   billing_interval_snapshot    AS "billingIntervalSnapshot",
                   status
            FROM core.subscriptions
            WHERE organization_id = ${orgId}::uuid
              AND status IN ('ACTIVE', 'TRIAL_ACTIVE')
            ORDER BY created_at DESC
            LIMIT 1
        `;
        const activeSub = rawSubs[0];
        console.log(`[DEBUG_SUBS] Sub Activa Raw:`, activeSub);

        const activeInterval = normalizePeriod(activeSub?.billingIntervalSnapshot);
        if (activeSub && activeSub.planVersionId === currentVersion.id && activeInterval === normalizedPeriod) {
            return res.status(400).json({ error: { code: 'ALREADY_ACTIVE', message: 'Ya tienes este plan activo con el mismo periodo de facturación.' } });
        }

        const shouldActivateDirect = isFree;

        if (shouldActivateDirect) {
            const subscription = await BillingService.activatePlan(orgId, currentVersion.id, { period });
            await GlobalAuditLogService.logEvent({
                category: 'billing',
                eventType: 'billing.plan.activated_direct',
                severity: 'success',
                outcome: 'success',
                message: `Plan gratuito activado directamente: ${planTemplateCode}`,
                targetType: 'subscription',
                targetId: subscription.id,
                metadata: { orgId, planTemplateCode, period }
            }, auditCtx);
            return res.json({
                success: true,
                mode: 'direct',
                message: 'Plan gratuito activado inmediatamente.',
                subscriptionId: subscription.id
            });
        }

        // 4. ACTIVACIÓN VÍA STRIPE (Checkout)
        const stripe = getStripe();
        // externalCustomerIds es un JSONB { stripe: 'cus_xxx', ... }
        const existingCustomerIds = (org as any).externalCustomerIds as Record<string, string> | null;
        let customerId: string | null = existingCustomerIds?.stripe || (org as any).externalCustomerId || null;

        if (!customerId) {
            const customer = await stripe.customers.create({
                name: org.name,
                email: (org as any).email || undefined,
                metadata: { orgId }
            });
            customerId = customer.id;
            // Guardar en externalCustomerIds JSONB (campo real del modelo)
            await corePrisma.organization.update({
                where: { id: orgId },
                data: { externalCustomerIds: { ...(existingCustomerIds || {}), stripe: customerId } } as any
            });
        }

        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [{ price: priceId || undefined, quantity: 1 }],
            success_url: successUrl || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/settings/plan?checkout=success`,
            cancel_url: cancelUrl || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/settings/plan?checkout=cancel`,
            metadata: { orgId, planVersionId: currentVersion.id, period },
            subscription_data: { metadata: { orgId, planVersionId: currentVersion.id, period } }
        });

        await GlobalAuditLogService.logEvent({
            category: 'billing',
            eventType: 'billing.checkout.session_created',
            severity: 'info',
            outcome: 'success',
            message: `Sesión de pago Stripe creada para plan ${planTemplateCode} (${period})`,
            metadata: { orgId, planTemplateCode, period, sessionId: session.id, sessionUrl: session.url }
        }, auditCtx);

        res.json({ url: session.url, mode: 'checkout' });

    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: error.errors } });
        }
        console.error('[billing/subscribe] Error:', error.message);
        await GlobalAuditLogService.logEvent({
            category: 'billing',
            eventType: 'billing.subscribe.failed',
            severity: 'critical',
            outcome: 'failure',
            message: `Error fatal al procesar suscripción: ${error.message}`,
            metadata: { orgId: res.locals.orgId, body: req.body, error: error.message }
        }, auditCtx);
        res.status(500).json({ error: { code: 'SUBSCRIBE_ERROR', message: error.message } });
    }
});

// ─── GET /v1/billing/plans (planes públicos para modal de upgrade) ───────────
router.get('/plans', async (req: AuthRequest, res) => {
    const debug: any = { steps: {} };
    try {
        debug.steps.start = 'Iniciado';
        const orgId = tenancyAdapter.getTenantId(req);
        const org = await corePrisma.organization.findUnique({
            where: { id: orgId },
            select: { productId: true }
        });
        const wabeeProduct = await corePrisma.product.findFirst({
            where: { slug: { equals: 'wabee', mode: 'insensitive' } },
            select: { id: true }
        });
        const targetProductId = org?.productId || wabeeProduct?.id || null;
        let totalTemplates = 0;
        try {
            totalTemplates = await corePrisma.planTemplate.count({
                where: {
                    deletedAt: null,
                    ...(targetProductId ? { productId: targetProductId } : {}),
                }
            });
            debug.totalTemplates_prisma = totalTemplates;
        } catch (e: any) { debug.steps.countTemplates_error = e.message; }

        let totalVersions: any = 0;
        try {
            totalVersions = await corePrisma.$queryRaw`SELECT COUNT(*) FROM core.plan_versions WHERE deleted_at IS NULL`;
            debug.totalVersions_prismaRaw = JSON.stringify(totalVersions);
        } catch (e: any) { debug.steps.countVersions_error = e.message; }

        // Intento con Raw SQL para asegurar que no es un tema de mapeo de Prisma
        let rawTemplates: any[] = [];
        try {
            rawTemplates = await corePrisma.$queryRaw`
                SELECT id, name, description, price, currency, interval, product_id as "productId", is_active as "isActive", limits, features, metadata, deleted_at as "deletedAt"
                FROM core.plan_templates
                WHERE deleted_at IS NULL
                  AND is_active = true
                  AND (${targetProductId}::uuid IS NULL OR product_id = ${targetProductId}::uuid)
            `;
            debug.rawTemplatesCount = rawTemplates.length;
            debug.allTemplatesFound = rawTemplates.map((t: any) => t.name);
        } catch (e: any) {
            debug.steps.rawTemplates_error = e.message;
            throw new Error(`Error en rawTemplates: ${e.message}`);
        }

        // Mapear a lo que espera el resto del código (inyectando versiones manualmente)
        const allPlans = [];
        for (const rt of rawTemplates) {
            try {
                const versions = await corePrisma.$queryRaw`
                    SELECT id, plan_template_id as "planTemplateId", version_number as "versionNumber", display_code as "displayCode", 
                           price, currency, billing_interval as "billingInterval", 
                           monthly_price as "monthlyPrice", annual_price as "annualPrice",
                           stripe_price_monthly_id as "stripePriceMonthlyId", stripe_price_annual_id as "stripePriceAnnualId",
                           limits_json as "limitsJson", features_json as "featuresJson", capabilities_json as "capabilitiesJson", metadata_json as "metadataJson",
                           is_published as "isPublished", is_current as "isCurrent"
                    FROM core.plan_versions
                    WHERE plan_template_id = ${rt.id}::UUID AND is_current = true
                `;
                allPlans.push({ ...rt, versions });
            } catch (e: any) {
                console.error(`Error obteniendo versiones para ${rt.id}:`, e.message);
                allPlans.push({ ...rt, versions: [] });
            }
        }
        debug.allPlansFinalCount = allPlans.length;

        // --- REPAIR LOGIC (Autocuración) ---
        for (const pt of allPlans) {
            if (pt.versions.length === 0) {
                console.log(`[billing/plans] REPAIR: Plan "${pt.name}" (${pt.id}) no tiene versión actual. Creándola...`);
                try {
                    const code = (pt.metadata as any)?.code || pt.name.toUpperCase();
                    await corePrisma.$executeRaw`
                        INSERT INTO core.plan_versions (
                            plan_template_id, version_number, display_code,
                            price, currency, billing_interval,
                            limits_json, features_json, capabilities_json, metadata_json,
                            is_published, is_current
                        ) VALUES (
                            ${pt.id}::UUID, 1, ${code + '_V1'},
                            ${pt.price}::NUMERIC(12,2), ${pt.currency}, ${pt.interval},
                            ${JSON.stringify(pt.limits)}::JSONB,
                            ${JSON.stringify(pt.features)}::JSONB,
                            '{}'::JSONB, 
                            ${JSON.stringify(pt.metadata)}::JSONB,
                            false, true
                        )
                    `;
                    const newV: any[] = await corePrisma.$queryRaw`SELECT * FROM core.plan_versions WHERE plan_template_id = ${pt.id}::UUID AND is_current = true LIMIT 1`;
                    if (newV && newV[0]) {
                        pt.versions = [newV[0]];
                    }
                } catch (err: any) {
                    console.error(`[billing/plans] REPAIR FAILED for ${pt.name}:`, err.message);
                }
            }
        }

        // Filtrar los que tienen versión PUBLICADA y VIGENTE, y que el plan esté ACTIVO (no borrador ni archivado)
        const publicPlans = allPlans.filter((p: any) => {
            const meta = (p as any).metadata || {};
            const itemCode = (meta.code || p.name || '').toUpperCase();
            
            // Ocultar Trial del modal de compra/upgrade y filtrar eliminados
            if (itemCode === 'TRIAL' || itemCode === 'FREE' || p.deletedAt) return false;
            
            // El plan DEBE estar marcado como activo en su plantilla (no archivado ni borrador)
            // Nota: Usamos p.isActive que viene del alias is_active as "isActive" en la query raw
            if (p.isActive !== true) return false;

            // Debe tener al menos una versión vigente que esté PUBLICADA
            const currentVersion = p.versions?.find((v: any) => v.isCurrent);
            return currentVersion && currentVersion.isPublished === true;
        });
        debug.publicPlansFinalCount = publicPlans.length;

        res.json({
            debug,
            plans: publicPlans.map((p: any) => {
                const version = p.versions[0];
                const meta = p.metadata as any;
                const limits = version.limitsJson as any;
                
                const monthlyPrice = Number(version.monthlyPrice ?? 0);
                const annualPrice = Number(version.annualPrice ?? 0);
                
                const hasMonthlyPrice = monthlyPrice > 0;
                const hasAnnualPrice = annualPrice > 0;
                const isFree = monthlyPrice === 0 && annualPrice === 0;

                const monthlyStripePriceId = version.stripePriceMonthlyId || meta?.stripePriceMonthlyId || null;
                const annualStripePriceId = version.stripePriceAnnualId || meta?.stripePriceAnnualId || null;
                const hasMonthlyStripe = !!(monthlyStripePriceId && String(monthlyStripePriceId).startsWith('price_'));
                const hasAnnualStripe = !!(annualStripePriceId && String(annualStripePriceId).startsWith('price_'));

                let checkoutStatus = 'incomplete';
                let checkoutMessage = 'Configuración de Stripe pendiente';

                if (isFree) {
                    checkoutStatus = 'free';
                    checkoutMessage = 'Activación directa disponible';
                } else {
                    const monthlyReady = !hasMonthlyPrice || hasMonthlyStripe;
                    const annualReady = !hasAnnualPrice || hasAnnualStripe;

                    if (monthlyReady && annualReady) {
                        checkoutStatus = 'ready_both';
                        checkoutMessage = 'Disponible mensual y anual';
                    } else if (hasMonthlyStripe) {
                        checkoutStatus = 'monthly_only';
                        checkoutMessage = 'Disponible solo suscripción mensual';
                    } else if (hasAnnualStripe) {
                        checkoutStatus = 'annual_only';
                        checkoutMessage = 'Disponible solo suscripción anual';
                    } else {
                        checkoutStatus = 'incomplete';
                        checkoutMessage = 'Este plan aún no está disponible para compra (sincronización con Stripe pendiente)';
                    }
                }

                return {
                    id: p.id,
                    code: meta?.code || p.name,
                    name: meta?.displayName || p.name,
                    monthlyPrice,
                    annualPrice,
                    currency: (version.currency || 'USD').toUpperCase(),
                    activationMode: isFree ? 'direct' : 'stripe',
                    canActivateDirectly: isFree,
                    canCheckoutMonthly: hasMonthlyStripe,
                    canCheckoutAnnual: hasAnnualStripe,
                    checkoutStatus,
                    checkoutMessage,
                    isEnterprise: meta?.code === 'ENTERPRISE',
                    limits: {
                        channels: limits?.channels ?? 0,
                        contacts: limits?.contacts ?? 0,
                        aiTokensPerMonth: limits?.aiTokensPerMonth ?? 0,
                        storageMb: limits?.storageMb ?? 0,
                    },
                    flags: version.featuresJson as any,
                };
            })
        });
    } catch (error: any) {
        console.error('[billing/plans] FATAL ERROR:', error.message);
        res.status(500).json({ 
            error: { code: 'PLANS_ERROR', message: error.message },
            debug 
        });
    }
});

// ─── GET /v1/billing/invoices ────────────────────────────────────────────────
router.get('/invoices', requireAdmin, async (req: AuthRequest, res) => {
    try {
        const orgId = res.locals.orgId;
        const { limit = '10', cursor } = req.query;
        const take = Math.min(Number(limit), 50);

        const invoices = await (corePrisma as any).invoice.findMany({
            where: { tenantId: orgId },
            take,
            ...(cursor ? { skip: 1, cursor: { id: cursor as string } } : {}),
            orderBy: { periodStart: 'desc' }
        });

        const lastItem = invoices[invoices.length - 1];
        const nextCursor = invoices.length === take ? lastItem?.id : null;

        res.json({
            items: invoices.map((inv: any) => ({
                id: (inv as any).id,
                externalId: (inv as any).externalId,
                month: new Date((inv as any).periodStart).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }),
                amount: (inv as any).amount,
                currency: ((inv as any).currency || 'USD').toUpperCase(),
                status: (inv as any).status,
                invoiceUrl: (inv as any).invoiceUrl,
                periodStart: (inv as any).periodStart,
                periodEnd: (inv as any).periodEnd,
                createdAt: (inv as any).createdAt,
            })),
            nextCursor
        });
    } catch (error: any) {
        console.error('[billing/invoices] Error:', error.message);
        res.status(500).json({ error: { code: 'INVOICES_ERROR', message: 'Error al obtener facturas.' } });
    }
});

// ─── POST /v1/billing/portal-session ────────────────────────────────────────
router.post('/portal-session', requireAdmin, async (req: AuthRequest, res) => {
    const auditCtx = getAuditContext(req);
    try {
        const orgId = res.locals.orgId;
        const stripe = getStripe();

        const org = await corePrisma.organization.findUnique({
            where: { id: orgId },
            select: { externalCustomerIds: true } as any
        });

        const stripeCustomerId = (org as any)?.externalCustomerIds?.stripe || (org as any)?.externalCustomerId || null;

        if (!stripeCustomerId) {
            return res.status(400).json({ error: { code: 'NO_CUSTOMER', message: 'La organización no tiene un cliente de Stripe vinculado. Realiza tu primera suscripción primero.' } });
        }

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const session = await stripe.billingPortal.sessions.create({
            customer: stripeCustomerId,
            return_url: `${frontendUrl}/settings/plan`,
        });

        await GlobalAuditLogService.logEvent({
            category: 'billing',
            eventType: 'billing.portal.session_created',
            severity: 'info',
            outcome: 'success',
            message: `Sesión del portal de facturación de Stripe abierta`,
            metadata: { orgId }
        }, auditCtx);

        res.json({ url: session.url });
    } catch (error: any) {
        console.error('[billing/portal-session] Error:', error.message);
        await GlobalAuditLogService.logEvent({
            category: 'billing',
            eventType: 'billing.portal.session_failed',
            severity: 'critical',
            outcome: 'failure',
            message: `Error al crear sesión del portal de Stripe: ${error.message}`,
            metadata: { orgId: res.locals.orgId, error: error.message }
        }, auditCtx);
        res.status(500).json({ error: { code: 'PORTAL_ERROR', message: error.message } });
    }
});

// ─── POST /v1/billing/cancel ────────────────────────────────────────────────
const cancelSchema = z.object({
    mode: z.enum(['end_of_period', 'immediate']).default('end_of_period'),
});

router.post('/cancel', requireAdmin, async (req: AuthRequest, res) => {
    const auditCtx = getAuditContext(req);
    try {
        const orgId = res.locals.orgId;
        const { mode } = cancelSchema.parse(req.body);
        const stripe = getStripe();

        const sub = await corePrisma.subscription.findFirst({
            where: { tenantId: orgId, status: { in: ['ACTIVE', 'TRIAL_ACTIVE'] } },
            orderBy: { createdAt: 'desc' }
        }) as any;

        const stripeSubId = sub?.externalId || (typeof sub?.external_ids === 'object' ? (sub?.external_ids as any)?.stripe : null);

        if (!stripeSubId) {
            return res.status(404).json({ error: { code: 'NO_SUBSCRIPTION', message: 'No hay suscripción activa para cancelar.' } });
        }

        if (mode === 'immediate') {
            await stripe.subscriptions.cancel(stripeSubId);
            await corePrisma.subscription.update({
                where: { id: sub.id },
                data: { status: 'CANCELED' }
            });
        } else {
            await stripe.subscriptions.update(stripeSubId, { cancel_at_period_end: true });
            await corePrisma.subscription.update({
                where: { id: sub.id },
                data: { cancelAtPeriodEnd: true }
            });
        }

        await GlobalAuditLogService.logEvent({
            category: 'billing',
            eventType: mode === 'immediate' ? 'billing.subscription.canceled_immediate' : 'billing.subscription.cancel_scheduled',
            severity: 'warning',
            outcome: 'success',
            message: mode === 'immediate'
                ? 'Suscripción cancelada inmediatamente por el administrador.'
                : 'Cancelación de suscripción programada para el fin del período.',
            targetType: 'subscription',
            targetId: sub.id,
            metadata: { orgId, mode, externalSubId: stripeSubId }
        }, auditCtx);

        res.json({
            success: true,
            mode,
            message: mode === 'immediate'
                ? 'Suscripción cancelada inmediatamente.'
                : 'La suscripción se cancelará al final del período actual.'
        });
    } catch (error: any) {
        console.error('[billing/cancel] Error:', error.message);
        if (error instanceof z.ZodError) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: error.errors[0].message } });
        await GlobalAuditLogService.logEvent({
            category: 'billing',
            eventType: 'billing.subscription.cancel_failed',
            severity: 'critical',
            outcome: 'failure',
            message: `Error al cancelar suscripción: ${error.message}`,
            metadata: { orgId: res.locals.orgId, mode: req.body.mode, error: error.message }
        }, auditCtx);
        res.status(500).json({ error: { code: 'CANCEL_ERROR', message: error.message } });
    }
});

export const billingRoutes = router;
