import { prisma, corePrisma } from '../../config/core/core.prisma';

// ─── Normalización de periodos ─────────────────────────────────────────────────
// Fuente única de verdad para los valores de periodo.
// Entrada acepta 'monthly'|'annual'|'month'|'year'. Salida es siempre 'month'|'year'.
export type BillingPeriod = 'monthly' | 'annual' | 'month' | 'year';
export type NormalizedInterval = 'month' | 'year';

export function normalizePeriod(raw: BillingPeriod | string | undefined | null): NormalizedInterval {
    if (raw === 'annual' || raw === 'year') return 'year';
    return 'month'; // default: mensual
}

// ─── Interfaces ────────────────────────────────────────────────────────────────
export interface PlanActivationOptions {
    externalId?: string;
    status?: 'ACTIVE' | 'PENDING' | 'TRIAL_ACTIVE';
    periodStart?: Date;
    periodEnd?: Date;
    /** Periodo elegido por el usuario. Se usa para resolver precio e intervalo del snapshot. */
    period?: BillingPeriod;
}

export class BillingService {
    /**
     * Activa un plan para una organización (Directo o vía Webhook).
     * Aplica la regla de snapshot inmutable y cierre de planes anteriores.
     */
    static async activatePlan(organizationId: string, planVersionId: string, options: PlanActivationOptions = {}) {
        let {
            status = 'ACTIVE',
            externalId,
            periodStart = new Date(),
            period,
        } = options;

        // Defensa: Si periodStart es una fecha inválida (e.g. de un conversion error previo), usar Now.
        if (periodStart && isNaN(periodStart.getTime())) {
            console.warn(`[BillingService] Se recibió una fecha de periodStart inválida para ${organizationId}. Usando fecha actual.`);
            periodStart = new Date();
        }

        // Normalizar el intervalo elegido (fuente de verdad para precio y snapshot)
        const billingInterval: NormalizedInterval = normalizePeriod(period);

        // Calcular el periodEnd por defecto según el intervalo si no se proporciona
        const periodEnd = options.periodEnd ?? (() => {
            const d = new Date(periodStart);
            if (billingInterval === 'year') {
                d.setFullYear(d.getFullYear() + 1);
            } else {
                d.setMonth(d.getMonth() + 1);
            }
            return d;
        })();

        // 1. Resolver PlanVersion vía SQL (evita mapping issues de Prisma)
        const rawPVs: any[] = await (prisma as any).$queryRaw`
            SELECT pv.*,
                   pv.monthly_price  AS "monthly_price",
                   pv.annual_price   AS "annual_price",
                   pt.id             AS "pt_id",
                   pt.name           AS "pt_name",
                   pt.metadata       AS "pt_metadata"
            FROM core.plan_versions pv
            JOIN core.plan_templates pt ON pv.plan_template_id = pt.id
            WHERE pv.id = ${planVersionId}::uuid
            LIMIT 1
        `;
        const row = rawPVs[0];

        if (!row) throw new Error(`PlanVersion ${planVersionId} no encontrado.`);
        if (!row.is_published || !row.is_current) {
            throw new Error(`La versión ${row.version_number} del plan no está publicada o vigente.`);
        }

        const planVersion = {
            id:              row.id,
            monthlyPrice:    Number(row.monthly_price),
            annualPrice:     Number(row.annual_price),
            currency:        row.currency,
            limitsJson:      row.limits_json,
            featuresJson:    row.features_json,
            capabilitiesJson: row.capabilities_json,
            modulesJson:     row.modules_json,
            versionNumber:   row.version_number,
        };

        const template = {
            id:       row.pt_id,
            name:     row.pt_name,
            metadata: row.pt_metadata,
        };

        // 2. Precio efectivo: SIEMPRE desde el periodo elegido (no desde planVersion.billingInterval)
        const effectivePrice = billingInterval === 'year'
            ? planVersion.annualPrice
            : planVersion.monthlyPrice;

        // 3. Snapshot inmutable — billingInterval viene del periodo elegido
        const planCode = template.metadata?.code || template.name?.toUpperCase();
        const snapshot = {
            planId:        template.id,
            planVersionId: planVersion.id,
            planCode,
            planName:      template.name,
            price:         effectivePrice,
            monthlyPrice:  planVersion.monthlyPrice,
            annualPrice:   planVersion.annualPrice,
            currency:      planVersion.currency,
            billingInterval,
            limits:        planVersion.limitsJson,
            features:      planVersion.featuresJson,
            modules:       planVersion.modulesJson,
            capabilities:  planVersion.capabilitiesJson,
            versionNumber: planVersion.versionNumber,
        };

        const externalIdsValue = externalId
            ? { stripe: externalId }
            : { local: `local_${Date.now()}` };

        // 4. Ejecutar operaciones via raw SQL (el modelo Prisma del @r4d-26/core v5.18
        //    fue compilado con un schema antiguo y no expone los campos snapshot individuales).
        //    Usamos corePrisma.$transaction con raw SQL dentro para mantener atomicidad.
        return await (corePrisma as any).$transaction(async (tx: any) => {

            // A. Obtener subs previas para cancelar en Stripe (antes de cambiar estado en BD)
            const activeSubs: any[] = await tx.$queryRaw`
                SELECT id, external_ids
                FROM core.subscriptions
                WHERE organization_id = ${organizationId}::uuid
                  AND status IN ('ACTIVE', 'TRIAL_ACTIVE', 'PAST_DUE')
            `;

            // B. Cancelar en Stripe (no-bloqueante, fallo no aborta la transacción)
            for (const sub of activeSubs) {
                const stripeSubId = (sub.external_ids as any)?.stripe;
                if (stripeSubId && stripeSubId.startsWith('sub_')) {
                    try {
                        const StripeLib = require('stripe').default || require('stripe');
                        const stripeClient = new StripeLib(process.env.STRIPE_SECRET_KEY as string, { apiVersion: '2023-10-16' });
                        await stripeClient.subscriptions.cancel(stripeSubId);
                        console.log(`[BillingService] Sub previa Stripe cancelada: ${stripeSubId}`);
                    } catch (err: any) {
                        console.error(`[BillingService] Error cancelando sub previa Stripe (${stripeSubId}):`, err.message);
                    }
                }
            }

            // C. Cerrar subs previas en BD
            await tx.$executeRaw`
                UPDATE core.subscriptions
                SET status = 'CANCELED', updated_at = NOW()
                WHERE organization_id = ${organizationId}::uuid
                  AND status IN ('ACTIVE', 'TRIAL_ACTIVE', 'PAST_DUE')
            `;

            // D. Crear nueva suscripción via raw SQL con todas las columnas snapshot
            const newSubRows: any[] = await tx.$queryRaw`
                INSERT INTO core.subscriptions (
                    organization_id,
                    plan_template_id,
                    plan_version_id,
                    external_ids,
                    status,
                    current_period_start,
                    current_period_end,
                    snapshot_json,
                    plan_snapshot,
                    price_snapshot,
                    currency_snapshot,
                    billing_interval_snapshot,
                    plan_code_snapshot,
                    plan_name_snapshot,
                    limits_snapshot,
                    features_snapshot,
                    modules_snapshot,
                    capabilities_snapshot,
                    version_number_snapshot,
                    snapshot_created_at,
                    created_at,
                    updated_at
                ) VALUES (
                    ${organizationId}::uuid,
                    ${template.id}::uuid,
                    ${planVersion.id}::uuid,
                    ${JSON.stringify(externalIdsValue)}::jsonb,
                    ${status},
                    ${periodStart}::timestamptz,
                    ${periodEnd}::timestamptz,
                    ${JSON.stringify(snapshot)}::jsonb,
                    ${JSON.stringify(snapshot)}::jsonb,
                    ${effectivePrice},
                    ${planVersion.currency},
                    ${billingInterval},
                    ${planCode},
                    ${template.name},
                    ${JSON.stringify(planVersion.limitsJson || {})}::jsonb,
                    ${JSON.stringify(planVersion.featuresJson || {})}::jsonb,
                    ${JSON.stringify(planVersion.modulesJson || {})}::jsonb,
                    ${JSON.stringify(planVersion.capabilitiesJson || {})}::jsonb,
                    ${planVersion.versionNumber},
                    NOW(), NOW(), NOW()
                ) RETURNING id, status, current_period_end
            `;

            const subscription = newSubRows[0];
            if (!subscription) throw new Error('Error al crear suscripción en BD.');

            // E. Actualizar planTemplateId de la organización
            await tx.$executeRaw`
                UPDATE core.organizations
                SET plan_template_id = ${template.id}::uuid,
                    updated_at = NOW()
                WHERE id = ${organizationId}::uuid
            `;

            return subscription;
        });
    }

    /**
     * Resuelve la suscripción activa de una organización.
     */
    static async getActiveSubscription(organizationId: string) {
        const raw = await (prisma as any).$queryRaw`
            SELECT * FROM core.subscriptions
            WHERE organization_id = ${organizationId}::uuid
              AND status IN ('ACTIVE', 'TRIAL_ACTIVE', 'PAST_DUE')
            ORDER BY created_at DESC
            LIMIT 1
        `;
        return raw[0];
    }
}
