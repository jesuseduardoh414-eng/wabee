/**
 * plan-resolver.ts
 * Servicio central para resolver el plan efectivo de una organización.
 *
 * REGLA DE ENFORCEMENT:
 * Otros módulos NO deben leer plan_templates directamente para obtener
 * límites/features de una org. Siempre usar resolveOrganizationPlanSnapshot().
 */
import { CoreInternalService } from '../core/core.internal.service';

const INTERNAL_FULL_MODULES: Record<string, boolean> = {
    dashboard: true,
    inbox: true,
    contacts: true,
    segments: true,
    groups: true,
    templatesHub: true,
    aiProfiles: true,
    webWidgets: true,
    integrationsTools: true,
    channels: true,
    campaigns: true,
    audit: true,
    team: true,
};

function resolveTemplateModules(template: any, planCode: string): Record<string, any> {
    if (template?.modules && typeof template.modules === 'object' && Object.keys(template.modules).length > 0) {
        return template.modules as Record<string, any>;
    }

    if (planCode === 'TRIAL') {
        return INTERNAL_FULL_MODULES;
    }

    return {};
}

export interface PlanSnapshot {
    planId: string;
    tenantId: string;
    planVersionId: string | null;
    planCode: string;
    planName: string;
    displayCode: string | null;
    versionNumber: number;
    price: number;
    monthlyPrice: number;
    annualPrice: number;
    currency: string;
    billingInterval: string;
    limits: Record<string, any>;
    features: Record<string, any>;
    capabilities: Record<string, any>;
    modules: Record<string, any>;
    stripePriceMonthlyId: string | null;
    stripePriceAnnualId: string | null;
    snapshotCreatedAt: string | null;
    /** true si este snapshot fue reconstruido como baseline de migración, no es exacto históricamente */
    _isLegacyFallback: boolean;
}

/**
 * Resuelve el plan efectivo vigente de una organización.
 *
 * Prioridad:
 * 1. Suscripción activa con snapshot_json canónico → fuente de verdad
 * 2. Suscripción activa sin snapshot (legacy) → buscar versión actual -> fallback a template
 */
export async function resolveOrganizationPlanSnapshot(
    organizationId: string
): Promise<PlanSnapshot | null> {
    const sub = await CoreInternalService.getSubscriptionByTenant(organizationId);

    if (!sub) {
        // Fallback for organizations with no active subscription (e.g. native FREE plan)
        const org = await CoreInternalService.getOrganizationById(organizationId);
        const template: any = org?.planTemplate;
        
        if (template) {
            return {
                planId: template.id || 'none',
                tenantId: organizationId,
                planVersionId: null,
                planCode: template.metadata?.code || template.name?.toUpperCase() || 'FREE',
                planName: template.name || 'Plan Activo',
                displayCode: null,
                versionNumber: 1,
                price: Number(template.price ?? 0),
                monthlyPrice: Number(template.price ?? 0),
                annualPrice: Number((template.price ?? 0) * 12),
                currency: template.currency || 'mxn',
                billingInterval: template.interval || 'month',
                limits: (template.limits || {}) as Record<string, any>,
                features: (template.features || {}) as Record<string, any>,
                capabilities: {},
                modules: (template.modules || {}) as Record<string, any>,
                stripePriceMonthlyId: template.metadata?.stripePriceMonthlyId || null,
                stripePriceAnnualId: template.metadata?.stripePriceAnnualId || null,
                snapshotCreatedAt: null,
                _isLegacyFallback: true,
            };
        }

        const orgProductId = (org as any)?.productId;
        if (orgProductId) {
            const activePlans = await CoreInternalService.getActivePlanTemplates(orgProductId);
            const freePlan = activePlans.find((p: any) => ((p.metadata as any)?.code || '').toUpperCase() === 'FREE');

            if (freePlan) {
                const freeVersion = await CoreInternalService.getPlanVersion(freePlan.id);

                if (freeVersion) {
                    return {
                        planId: freePlan.id,
                        tenantId: organizationId,
                        planVersionId: freeVersion.id,
                        planCode: (freePlan.metadata as any)?.code || 'FREE',
                        planName: freePlan.name || 'Plan Gratuito',
                        displayCode: freeVersion.displayCode || null,
                        versionNumber: freeVersion.versionNumber || 1,
                        price: Number(freeVersion.monthlyPrice ?? freeVersion.price ?? 0),
                        monthlyPrice: Number(freeVersion.monthlyPrice ?? 0),
                        annualPrice: Number(freeVersion.annualPrice ?? 0),
                        currency: freeVersion.currency || 'mxn',
                        billingInterval: freeVersion.billingInterval || 'month',
                        limits: (freeVersion.limitsJson || {}) as Record<string, any>,
                        features: (freeVersion.featuresJson || {}) as Record<string, any>,
                        capabilities: (freeVersion.capabilitiesJson || {}) as Record<string, any>,
                        modules: (freeVersion.modulesJson || {}) as Record<string, any>,
                        stripePriceMonthlyId: freeVersion.stripePriceMonthlyId || null,
                        stripePriceAnnualId: freeVersion.stripePriceAnnualId || null,
                        snapshotCreatedAt: null,
                        _isLegacyFallback: true,
                    };
                }
            }
        }
        
        return null;
    }

    // snapshotJson no está en el modelo Prisma de @r4d-26/core v5.18 (compilado con schema antiguo).
    // Usamos planSnapshot como fallback — ambas columnas reciben el mismo valor en billing.service.ts.
    const snap = (sub as any).snapshotJson || (sub as any).planCodeSnapshot || (sub as any).planSnapshot;

    // Caso 1: snapshot canónico disponible
    if (snap && Object.keys(snap).length > 0) {
        const isNotEmpty = (obj: any) => obj && typeof obj === 'object' && Object.keys(obj).length > 0;

        // AUDITORÍA DE CONSISTENCIA (V3)
        // console.log(`[PlanResolver] 🔍 Snapshot para org ${organizationId}:`, JSON.stringify(snap, null, 2));

        return {
            planId: sub.planTemplateId,
            tenantId: sub.tenantId,
            planVersionId: sub.planVersionId || snap.planVersionId || null,
            planCode: sub.planCodeSnapshot || snap.planCode || sub.planTemplate?.metadata?.code || sub.planTemplate?.name?.toUpperCase() || 'PLAN',
            planName: sub.planNameSnapshot || snap.planName || sub.planTemplate?.name || 'Plan Activo',
            displayCode: snap.displayCode || null,
            versionNumber: sub.versionNumberSnapshot || snap.versionNumber || 1,
            price: Number(sub.priceSnapshot ?? snap.price ?? 0),
            monthlyPrice: Number(sub.monthlyPriceSnapshot ?? snap.monthlyPrice ?? 0),
            annualPrice: Number(sub.annualPriceSnapshot ?? snap.annualPrice ?? 0),
            currency: sub.currencySnapshot || snap.currency || 'mxn',
            billingInterval: sub.billingIntervalSnapshot || snap.billingInterval || 'month',
            
            // PRIORIDAD: 
            // 1. Columnas individuales si no están vacías
            // 2. Objeto snapshotJson si no está vacío
            // 3. Objeto vacío final (Bloqueado)
            limits:       (isNotEmpty(sub.limitsSnapshot)       ? sub.limitsSnapshot       : (isNotEmpty(snap.limits)       ? snap.limits       : {})) as Record<string, any>,
            features:     (isNotEmpty(sub.featuresSnapshot)     ? sub.featuresSnapshot     : (isNotEmpty(snap.features)     ? snap.features     : {})) as Record<string, any>,
            capabilities: (isNotEmpty(sub.capabilitiesSnapshot) ? sub.capabilitiesSnapshot : (isNotEmpty(snap.capabilities) ? snap.capabilities : {})) as Record<string, any>,
            modules:      (isNotEmpty(sub.modulesSnapshot)      ? sub.modulesSnapshot      : (isNotEmpty(snap.modules)      ? snap.modules      : {})) as Record<string, any>,

            stripePriceMonthlyId: snap.stripePriceMonthlyId || null,
            stripePriceAnnualId: snap.stripePriceAnnualId || null,
            snapshotCreatedAt: sub.snapshotCreatedAt?.toISOString() || null,
            _isLegacyFallback: snap._isLegacyFallback === true,
        };
    }

    // Caso 2: suscripción existente sin snapshot (fallback legacy)
    // Intentar buscar la versión actual
    const template = sub.planTemplate;
    const templateCode = (template?.metadata as any)?.code || template?.name?.toUpperCase() || 'PLAN';
    const templateModules = resolveTemplateModules(template, templateCode);

    if (template && (
        (template?.limits && Object.keys(template.limits).length > 0) ||
        (template?.features && Object.keys(template.features).length > 0) ||
        Object.keys(templateModules).length > 0
    )) {
        return {
            planId: sub.planTemplateId,
            tenantId: sub.tenantId,
            planVersionId: null,
            planCode: templateCode,
            planName: template?.name || 'Plan Activo',
            displayCode: null,
            versionNumber: 1,
            price: Number(template?.price ?? 0),
            monthlyPrice: Number(template?.price ?? 0),
            annualPrice: Number((template?.price ?? 0) * 12),
            currency: template?.currency || 'mxn',
            billingInterval: template?.interval || 'month',
            limits: (template?.limits || {}) as Record<string, any>,
            features: (template?.features || template?.limits || {}) as Record<string, any>,
            capabilities: {},
            modules: templateModules,
            stripePriceMonthlyId: (template?.metadata as any)?.stripePriceMonthlyId || null,
            stripePriceAnnualId: (template?.metadata as any)?.stripePriceAnnualId || null,
            snapshotCreatedAt: null,
            _isLegacyFallback: true,
        };
    }

    const planVersion = await CoreInternalService.getPlanVersion(sub.planTemplateId);


    if (planVersion) {
        const meta = planVersion.planTemplate?.metadata || {};
        return {
            planId: sub.planTemplateId,
            tenantId: sub.tenantId,
            planVersionId: planVersion.id,
            planCode: meta.code || planVersion.planTemplate?.name?.toUpperCase() || 'PLAN',
            planName: planVersion.planTemplate?.name || 'Plan Activo',
            displayCode: planVersion.displayCode || null,
            versionNumber: planVersion.versionNumber || 1,
            price: Number(planVersion.price),
            monthlyPrice: Number(planVersion.monthlyPrice),
            annualPrice: Number(planVersion.annualPrice),
            currency: planVersion.currency,
            billingInterval: planVersion.billingInterval,
            limits: (planVersion.limitsJson || {}) as Record<string, any>,
            features: (planVersion.featuresJson || {}) as Record<string, any>,
            capabilities: (planVersion.capabilitiesJson || {}) as Record<string, any>,
            modules: (planVersion.modulesJson || {}) as Record<string, any>,
            stripePriceMonthlyId: planVersion.stripePriceMonthlyId || null,
            stripePriceAnnualId: planVersion.stripePriceAnnualId || null,
            snapshotCreatedAt: null,
            _isLegacyFallback: true,
        };
    }

    return {
        planId: sub.planTemplateId,
        tenantId: sub.tenantId,
        planVersionId: null,
        planCode: templateCode,
        planName: template?.name || 'Plan Activo',
        displayCode: null,
        versionNumber: 1,
        price: Number(template?.price ?? 0),
        monthlyPrice: Number(template?.price ?? 0),
        annualPrice: Number((template?.price ?? 0) * 12),
        currency: template?.currency || 'mxn',
        billingInterval: template?.interval || 'month',
        limits: (template?.limits || {}) as Record<string, any>,
        features: (template?.features || {}) as Record<string, any>,
        capabilities: {},
        modules: templateModules,
        stripePriceMonthlyId: (template?.metadata as any)?.stripePriceMonthlyId || null,
        stripePriceAnnualId: (template?.metadata as any)?.stripePriceAnnualId || null,
        snapshotCreatedAt: null,
        _isLegacyFallback: true,
    };
}

/**
 * Retorna un plan vacío/bloqueado por defecto para organizaciones sin suscripción activa.
 */
export function getEmptyPlanSnapshot(): PlanSnapshot {
    return {
        planId: 'none',
        tenantId: 'none',
        planVersionId: null,
        planCode: 'NONE',
        planName: 'Sin Plan Activo',
        displayCode: 'N/A',
        versionNumber: 0,
        price: 0,
        monthlyPrice: 0,
        annualPrice: 0,
        currency: 'mxn',
        billingInterval: 'month',
        limits: {}, // Todo null/vacio -> Bloqueado
        features: {},
        capabilities: {},
        modules: {}, // Todo false -> Bloqueado
        stripePriceMonthlyId: null,
        stripePriceAnnualId: null,
        snapshotCreatedAt: null,
        _isLegacyFallback: false,
    };
}

/**
 * Helper para obtener límites efectivos de una organización.
 * Uso típico en módulos: canales, contactos, IA, campañas.
 */
export async function getOrganizationEffectiveLimits(
    organizationId: string
): Promise<Record<string, any>> {
    const snapshot = await resolveOrganizationPlanSnapshot(organizationId);
    return snapshot?.limits ?? {};
}

/**
 * Helper para obtener features efectivos de una organización.
 */
export async function getOrganizationEffectiveFeatures(
    organizationId: string
): Promise<Record<string, any>> {
    const snapshot = await resolveOrganizationPlanSnapshot(organizationId);
    return snapshot?.features ?? {};
}
