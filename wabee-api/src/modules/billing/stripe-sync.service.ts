import Stripe from 'stripe';
import { prisma } from '../../config/core/core.prisma';
import { coreEnv } from '../../config/core/core.env';

export class StripeSyncService {
    private static stripe: Stripe;

    private static getStripe(): Stripe {
        if (!this.stripe) {
            if (!coreEnv.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY no configurada.');
            this.stripe = new Stripe(coreEnv.STRIPE_SECRET_KEY, {
                apiVersion: '2025-02-24.acacia' as any,
            });
        }
        return this.stripe;
    }

    /**
     * Sincroniza una versión de plan con Stripe.
     * Crea el producto en Stripe (si no existe) y los precios mensual/anual.
     * Guarda los Price IDs en stripe_price_monthly_id / stripe_price_annual_id.
     *
     * Compatible con el schema real de la BD:
     *   - plan_templates.external_ids  (JSONB) → almacena { stripe: productId }
     *   - plan_versions.stripe_price_monthly_id (TEXT)
     *   - plan_versions.stripe_price_annual_id  (TEXT)
     */
    static async syncPlanVersion(versionId: string) {
        console.log(`[StripeSync] Iniciando sincronización para versión: ${versionId}`);

        try {
            // 1. Cargar versión y template
            const rawPVs: any[] = await (prisma as any).$queryRaw`
                SELECT
                    pv.id,
                    pv.monthly_price,
                    pv.annual_price,
                    pv.currency,
                    pv.stripe_price_monthly_id,
                    pv.stripe_price_annual_id,
                    pt.id         AS "pt_id",
                    pt.name       AS "pt_name",
                    pt.external_ids AS "pt_external_ids",
                    pt.metadata->>'code' AS "pt_code"
                FROM core.plan_versions pv
                JOIN core.plan_templates pt ON pv.plan_template_id = pt.id
                WHERE pv.id = ${versionId}::uuid
                LIMIT 1
            `;
            const version = rawPVs[0];

            if (!version) {
                console.error(`[StripeSync] Versión ${versionId} no encontrada.`);
                return;
            }

            const monthlyPrice = Number(version.monthly_price || 0);
            const annualPrice  = Number(version.annual_price  || 0);
            const currency = (version.currency || 'mxn').toLowerCase();

            // 2. Planes gratuitos: no requieren Stripe
            if (monthlyPrice === 0 && annualPrice === 0) {
                console.log(`[StripeSync] Plan ${version.pt_code || version.pt_name} es gratuito → sincronización no requerida.`);
                return;
            }

            const stripe = this.getStripe();

            // 3. Obtener o crear Producto en Stripe
            const externalIds = version.pt_external_ids || {};
            let stripeProductId: string = externalIds?.stripe;

            if (!stripeProductId) {
                console.log(`[StripeSync] Creando producto en Stripe: "${version.pt_name}"`);
                const product = await stripe.products.create({
                    name: version.pt_name,
                    metadata: {
                        planTemplateId: version.pt_id,
                        planCode: version.pt_code || version.pt_name,
                    },
                });
                stripeProductId = product.id;

                // Persistir en plan_templates.external_ids
                const updatedExternalIds = { ...externalIds, stripe: stripeProductId };
                await (prisma as any).$executeRaw`
                    UPDATE core.plan_templates
                    SET external_ids = ${JSON.stringify(updatedExternalIds)}::jsonb
                    WHERE id = ${version.pt_id}::uuid
                `;
                console.log(`[StripeSync] Producto creado: ${stripeProductId}`);
            }

            // 4. Sincronizar precios (solo los que faltan)
            let monthlyId: string | null = version.stripe_price_monthly_id || null;
            let annualId:  string | null  = version.stripe_price_annual_id  || null;

            if (monthlyPrice > 0 && !monthlyId?.startsWith('price_')) {
                monthlyId = await this.ensurePrice(stripeProductId, monthlyPrice, 'month', currency, versionId);
                console.log(`[StripeSync] Precio mensual creado: ${monthlyId}`);
            }

            if (annualPrice > 0 && !annualId?.startsWith('price_')) {
                annualId = await this.ensurePrice(stripeProductId, annualPrice, 'year', currency, versionId);
                console.log(`[StripeSync] Precio anual creado: ${annualId}`);
            }

            // 5. Persistir resultados en plan_versions
            await (prisma as any).$executeRaw`
                UPDATE core.plan_versions
                SET stripe_price_monthly_id = ${monthlyId},
                    stripe_price_annual_id  = ${annualId}
                WHERE id = ${versionId}::uuid
            `;

            console.log(`[StripeSync] Sincronización finalizada para ${versionId}. monthly: ${monthlyId}, annual: ${annualId}`);

        } catch (error: any) {
            console.error(`[StripeSync] Error en syncPlanVersion(${versionId}):`, error.message);
            throw error;
        }
    }

    private static async ensurePrice(
        productId: string,
        amount: number,
        interval: 'month' | 'year',
        currency: string,
        versionId: string,
    ): Promise<string> {
        const stripe = this.getStripe();
        console.log(`[StripeSync] Creando precio ${interval} de ${amount} ${currency.toUpperCase()} para producto ${productId}`);

        const price = await stripe.prices.create({
            product: productId,
            unit_amount: Math.round(amount * 100), // Stripe usa centavos
            currency: currency.toLowerCase(),
            recurring: { interval },
            metadata: { planVersionId: versionId, interval },
        });

        return price.id;
    }
}
