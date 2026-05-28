import dotenv from 'dotenv';
dotenv.config();
import '../config/core/core.infra';
import { prisma } from '../config/core/core.prisma';
import Stripe from 'stripe';

async function check() {
    const rows: any[] = await (prisma as any).$queryRaw`
        SELECT pv.stripe_price_monthly_id, pv.stripe_price_annual_id, pt.name
        FROM core.plan_versions pv
        JOIN core.plan_templates pt ON pt.id = pv.plan_template_id
        WHERE pv.is_current = true AND pv.stripe_price_monthly_id IS NOT NULL
    `;
    console.log('\n📋 IDs en BD:');
    rows.forEach(r => console.log(`  ${r.name}: monthly=${r.stripe_price_monthly_id} | annual=${r.stripe_price_annual_id}`));

    console.log('\n🔍 Verificando en Stripe...');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: '2025-02-24.acacia' as any });
    for (const row of rows) {
        try {
            await stripe.prices.retrieve(row.stripe_price_monthly_id);
            console.log(`✅ VÁLIDO: ${row.name} -> ${row.stripe_price_monthly_id}`);
        } catch(e: any) {
            console.log(`❌ INVÁLIDO: ${row.name} -> ${row.stripe_price_monthly_id} | ${e.message}`);
        }
    }
    process.exit(0);
}
check().catch(e => { console.error('Error:', e.message); process.exit(1); });
