import { corePrisma as prisma } from '../config/core/core.prisma';

async function checkProfiles() {
    try {
        const profiles = await prisma.profile.findMany({
            orderBy: { createdAt: 'desc' },
            take: 10
        });
        console.log('Últimos 10 perfiles:', profiles.map(p => ({ id: p.id, email: p.email, createdAt: p.createdAt })));

        const orgs = await prisma.organization.findMany({
            orderBy: { createdAt: 'desc' },
            take: 10
        });
        console.log('Últimas 10 organizaciones:', orgs.map(o => ({ id: o.id, name: o.name, createdAt: o.createdAt })));
    } catch (error: any) {
        console.error('Error consultando DB:', error);
    } finally {
        await (prisma as any).$disconnect?.();
    }
}

checkProfiles();
