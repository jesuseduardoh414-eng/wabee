const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const profile = await prisma.aiProfile.findFirst();
        const tool = await prisma.aiTool.findFirst({ where: { name: 'lookupCustomer' } });
        if (!profile || !tool) return console.log('Profile or Tool missing');

        await prisma.aiProfileTool.upsert({
            where: { profileId_toolId: { profileId: profile.id, toolId: tool.id } },
            update: { isActive: true },
            create: { tenantId: profile.tenantId, profileId: profile.id, toolId: tool.id, isActive: true }
        });
        console.log(`Tool ${tool.name} linked to Profile ${profile.id}`);

        console.log(`TENANT_ID: ${profile.tenantId}`);
        console.log(`PROFILE_ID: ${profile.id}`);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
