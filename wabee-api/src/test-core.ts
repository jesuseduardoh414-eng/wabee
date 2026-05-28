import 'dotenv/config';
import { core } from './config/core/core.infra';
import { prisma } from './config/core/core.prisma';

async function verify() {
    console.log('--- Verificando Datos de Suscripción ---');
    try {
        const user = await (prisma as any).profile.findFirst({
            where: { email: 'antigravityp5@gmail.com' },
            include: { memberships: true }
        });

        if (!user) throw new Error('User not found');
        const tenantId = user.memberships[0]?.tenantId;
        console.log('Tenant ID:', tenantId);

        // 1. Verificar Suscripción
        const subs = await (prisma as any).subscription.findMany({ where: { tenantId } });
        console.log('Suscripciones encontradas:', subs.length);
        subs.forEach((s: any) => console.log(`- ID: ${s.id}, Plan: ${s.planTemplateId}, Status: ${s.status}`));

        if (subs.length === 0) throw new Error('NO SUBSCRIPTION FOUND IN DB');

        // 2. Verificar Plan
        const plan = await (prisma as any).planTemplate.findUnique({
            where: { id: subs[0].planTemplateId }
        });
        console.log('Plan:', plan?.name);
        console.log('Límites del Plan:', JSON.stringify(plan?.limits, null, 2));

        // 3. Verificar Stats de Almacenamiento
        const stats = await (prisma as any).tenantStorageStats.findUnique({
            where: { tenantId }
        });
        console.log('Stats de Almacenamiento:', stats ? 'Presente' : 'No encontrado');
        if (stats) console.log('Bytes consumidos:', stats.totalSizeBytes.toString());

    } catch (err: any) {
        console.error('X Error:', err.message);
    }
}
verify();
