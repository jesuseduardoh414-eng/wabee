/**
 * sync-stripe-plans.ts
 * Sincroniza los planes existentes con Stripe (crea productos y precios).
 * Usa las columnas reales de la BD:
 *   - plan_templates.external_ids (JSONB) → almacena { stripe: productId }
 *   - plan_versions.stripe_price_monthly_id
 *   - plan_versions.stripe_price_annual_id
 *
 * Uso:
 *   npm run sync:stripe
 */
import dotenv from 'dotenv';
dotenv.config();

import '../config/core/core.infra';
import { prisma } from '../config/core/core.prisma';
import Stripe from 'stripe';

async function main() {
    console.log('\n🚀 Iniciando sincronización de planes con Stripe...\n');

    if (!process.env.STRIPE_SECRET_KEY) {
        console.error('❌ STRIPE_SECRET_KEY no está configurada en .env');
        process.exit(1);
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2025-02-24.acacia' as any,
    });

    // 1. Obtener todas las versiones vigentes de planes con precio
    const versions: any[] = await (prisma as any).$queryRaw`
        SELECT
            pv.id         AS "versionId",
            pv.version_number,
            pv.monthly_price,
            pv.annual_price,
            pv.currency,
            pv.stripe_price_monthly_id AS "stripePriceMonthlyId",
            pv.stripe_price_annual_id  AS "stripePriceAnnualId",
            pt.id          AS "templateId",
            pt.name        AS "planName",
            pt.external_ids AS "externalIds",
            pt.metadata->>'code' AS "planCode"
        FROM core.plan_versions pv
        JOIN core.plan_templates pt ON pv.plan_template_id = pt.id
        WHERE pv.is_current = true
          AND pt.deleted_at IS NULL
        ORDER BY pt.name ASC
    `;

    console.log(`📋 Planes encontrados: ${versions.length}\n`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const v of versions) {
        const monthlyPrice = Number(v.monthly_price || 0);
        const annualPrice = Number(v.annual_price || 0);
        const currency = (v.currency || 'mxn').toLowerCase();
        const planLabel = v.planCode || v.planName;

        // Planes gratuitos no necesitan Stripe
        if (monthlyPrice === 0 && annualPrice === 0) {
            console.log(`⏭️  [${planLabel}] Plan gratuito → OMITIDO`);
            skipCount++;
            continue;
        }

        // Ya sincronizado (ambos IDs válidos)
        const hasMonthly = v.stripePriceMonthlyId?.startsWith('price_');
        const hasAnnual  = v.stripePriceAnnualId?.startsWith('price_');
        const needsMonthly = monthlyPrice > 0 && !hasMonthly;
        const needsAnnual  = annualPrice > 0 && !hasAnnual;

        if (!needsMonthly && !needsAnnual) {
            console.log(`✅ [${planLabel}] Ya sincronizado → OMITIDO`);
            skipCount++;
            continue;
        }

        console.log(`🔄 [${planLabel}] Sincronizando...`);
        console.log(`   💰 Mensual: $${monthlyPrice} ${currency.toUpperCase()} | Anual: $${annualPrice} ${currency.toUpperCase()}`);

        try {
            // 2. Obtener o crear Producto en Stripe
            const externalIds = v.externalIds || {};
            let stripeProductId: string = externalIds?.stripe;

            if (!stripeProductId) {
                console.log(`   📦 Creando producto en Stripe: "${v.planName}"`);
                const product = await stripe.products.create({
                    name: v.planName,
                    metadata: { planTemplateId: v.templateId, planCode: planLabel },
                });
                stripeProductId = product.id;

                // Guardar producto ID en external_ids del template
                const updatedExternalIds = { ...externalIds, stripe: stripeProductId };
                await (prisma as any).$executeRaw`
                    UPDATE core.plan_templates
                    SET external_ids = ${JSON.stringify(updatedExternalIds)}::jsonb
                    WHERE id = ${v.templateId}::uuid
                `;
                console.log(`   ✅ Producto creado: ${stripeProductId}`);
            } else {
                console.log(`   ♻️  Producto existente: ${stripeProductId}`);
            }

            // 3. Crear precios (solo los que faltan)
            let monthlyPriceId: string | null = v.stripePriceMonthlyId || null;
            let annualPriceId: string | null  = v.stripePriceAnnualId || null;

            if (needsMonthly) {
                console.log(`   💳 Creando precio mensual: ${monthlyPrice} ${currency.toUpperCase()}/mes`);
                const price = await stripe.prices.create({
                    product: stripeProductId,
                    unit_amount: Math.round(monthlyPrice * 100),
                    currency,
                    recurring: { interval: 'month' },
                    metadata: { planVersionId: v.versionId, planCode: planLabel, interval: 'month' },
                });
                monthlyPriceId = price.id;
                console.log(`   ✅ Precio mensual: ${monthlyPriceId}`);
            }

            if (needsAnnual) {
                console.log(`   💳 Creando precio anual: ${annualPrice} ${currency.toUpperCase()}/año`);
                const price = await stripe.prices.create({
                    product: stripeProductId,
                    unit_amount: Math.round(annualPrice * 100),
                    currency,
                    recurring: { interval: 'year' },
                    metadata: { planVersionId: v.versionId, planCode: planLabel, interval: 'year' },
                });
                annualPriceId = price.id;
                console.log(`   ✅ Precio anual: ${annualPriceId}`);
            }

            // 4. Guardar los IDs en plan_versions
            await (prisma as any).$executeRaw`
                UPDATE core.plan_versions
                SET stripe_price_monthly_id = ${monthlyPriceId},
                    stripe_price_annual_id  = ${annualPriceId}
                WHERE id = ${v.versionId}::uuid
            `;

            console.log(`   🎉 [${planLabel}] ¡Sincronizado con éxito!`);
            successCount++;

        } catch (err: any) {
            console.error(`   ❌ Error en [${planLabel}]: ${err.message}`);
            errorCount++;
        }

        await new Promise(r => setTimeout(r, 300));
    }

    console.log('\n─────────────────────────────────────────');
    console.log(`📊 Resultado:`);
    console.log(`   ✅ Sincronizados: ${successCount}`);
    console.log(`   ⏭️  Omitidos:     ${skipCount}`);
    console.log(`   ❌ Errores:      ${errorCount}`);
    console.log('─────────────────────────────────────────\n');

    if (successCount > 0) {
        console.log('🎉 ¡Los planes ya tienen Price IDs de Stripe!');
        console.log('   Ahora los usuarios pueden suscribirse sin el mensaje de "pendiente".\n');
    }

    process.exit(0);
}

main().catch(err => {
    console.error('❌ Error fatal:', err.message);
    process.exit(1);
});
