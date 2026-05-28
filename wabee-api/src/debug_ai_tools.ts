
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debugTools() {
    console.log('--- DEBUG TOOLS AND PROFILE LINKS ---');
    
    const profiles = await prisma.aiProfile.findMany({
        take: 5
    });

    for (const profile of profiles) {
        console.log(`\nProfile: ${profile.name} (${profile.id})`);
        
        const links = await prisma.aiProfileTool.findMany({
            where: { profileId: profile.id, isActive: true },
            include: { tool: true }
        });

        console.log(`Active Tool Links: ${links.length}`);
        
        links.forEach(l => {
            console.log(`- Tool: ${l.tool.name} (isActive: ${l.tool.isActive})`);
            console.log(`  Description: ${l.tool.description}`);
            console.log(`  TriggerHints:`, l.tool.triggerHints);
            console.log(`  Type of TriggerHints:`, typeof l.tool.triggerHints);
            if (Array.isArray(l.tool.triggerHints)) {
                console.log(`  Is Array: Yes, Length: ${l.tool.triggerHints.length}`);
            } else {
                console.log(`  Is Array: No`);
            }
        });
    }
}

debugTools()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
