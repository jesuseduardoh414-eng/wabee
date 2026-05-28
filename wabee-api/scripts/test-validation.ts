import { corePrisma as prisma } from '../src/config/core/core.prisma';
import { coreAdapter } from '../src/modules/core/core.adapter';

async function main() {
    console.log('🔍 Validating User Final State...');
    const latestProfile = await prisma.profile.findFirst({
        orderBy: { createdAt: 'desc' }
    });
    
    if (latestProfile) {
        console.log('✅ Latest Profile found:');
        console.log(`ID: ${latestProfile.id}`);
        console.log(`Email: ${latestProfile.email}`);
        console.log(`Status: ${latestProfile.status}`);
        console.log(`Preferences (Onboarding Intent):`, JSON.stringify(latestProfile.preferences));
    } else {
        console.log('❌ No profile found');
    }

    console.log('\n📧 Triggering real Notification Flow (Password Recovery)...');
    try {
        if(latestProfile?.email) {
            await coreAdapter.auth.recover({ email: latestProfile.email });
            console.log('✅ Recovery event successfully triggered! Mailer/Patch active.');
        } else {
            console.log('⚠️ Could not trigger recovery because no email was found.');
        }
    } catch (e: any) {
        console.error('❌ Error triggering notification:', e.message);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
