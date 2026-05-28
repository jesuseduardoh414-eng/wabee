/**
 * Limpia los Stripe IDs de la BD para forzar una re-sincronización.
 * Útil cuando cambias de cuenta de Stripe.
 *
 * Uso: npx tsx src/scripts/clear-stripe-ids.ts
 */
import dotenv from 'dotenv';
dotenv.config();
import '../config/core/core.infra';
import { prisma } from '../config/core/core.prisma';

async function main() {
    console.log('🧹 Limpiando IDs de Stripe antiguos de la BD...\n');

    await (prisma as any).$executeRaw`
        UPDATE core.plan_versions
        SET stripe_price_monthly_id = NULL,
            stripe_price_annual_id  = NULL
        WHERE is_current = true
    `;

    await (prisma as any).$executeRaw`
        UPDATE core.plan_templates
        SET external_ids = external_ids - 'stripe'
        WHERE external_ids IS NOT NULL AND external_ids ? 'stripe'
    `;

    console.log('✅ Limpieza completada.');
    console.log('   Ahora corre: npm run sync:stripe\n');
    process.exit(0);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
