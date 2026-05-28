/**
 * =====================================================================
 * SEED SCRIPT: WhatsappAgentBinding
 * =====================================================================
 * Uso:
 *   npx ts-node -P tsconfig.json scripts/seed-whatsapp-binding.ts \
 *     --channelId=<uuid> \
 *     --profileId=<uuid> \
 *     [--handoffKeys=asesor,humano,agente] \
 *     [--disable]
 *
 * El script resuelve automáticamente el tenantId desde el channelId.
 * Si ya existe un binding para ese channelId lo ACTUALIZA (upsert).
 * =====================================================================
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ── Helpers de CLI ────────────────────────────────────────────────────
function getArg(name: string): string | undefined {
    const match = process.argv.find(a => a.startsWith(`--${name}=`));
    return match?.split('=').slice(1).join('=');
}

function requiredArg(name: string): string {
    const val = getArg(name);
    if (!val) {
        console.error(`\n❌  Argumento requerido faltante: --${name}\n`);
        process.exit(1);
    }
    return val;
}

// ── Main ──────────────────────────────────────────────────────────────
async function main() {
    const channelId = requiredArg('channelId');
    const profileId = requiredArg('profileId');
    const rawKeys = getArg('handoffKeys') ?? 'asesor,humano,agente,ayuda';
    const isActive = getArg('disable') === undefined; // --disable para desactivar

    const handoffKeys = rawKeys.split(',').map(k => k.trim()).filter(Boolean);

    console.log('\n🔍  Validando parámetros...\n');

    // 1. Resolver channelId -> canal y tenant
    const channel = await prisma.whatsappChannel.findUnique({
        where: { id: channelId },
        select: { id: true, tenantId: true, name: true, displayPhone: true, phoneNumberId: true }
    });

    if (!channel) {
        console.error(`❌  Canal no encontrado: channelId=${channelId}`);
        process.exit(1);
    }

    const tenantId = channel.tenantId;
    console.log(`✅  Canal encontrado: "${channel.name}" (${channel.displayPhone || channel.phoneNumberId})`);
    console.log(`   tenantId = ${tenantId}`);

    // 2. Validar que el profileId exista y pertenezca al MISMO tenant
    const profile = await prisma.aiProfile.findFirst({
        where: { id: profileId, tenantId },
        select: { id: true, name: true, kbEnabled: true, channelType: true }
    });

    if (!profile) {
        console.error(`\n❌  Perfil no encontrado o no pertenece al mismo tenant.`);
        console.error(`   profileId=${profileId}  tenantId_esperado=${tenantId}\n`);
        process.exit(1);
    }

    console.log(`✅  Perfil IA encontrado: "${profile.name}"`);
    console.log(`   channelType=${profile.channelType}  kbEnabled=${profile.kbEnabled}`);

    if (!profile.kbEnabled) {
        console.warn('\n⚠️   ADVERTENCIA: Este perfil tiene kbEnabled=false.');
        console.warn('   El agente responderá solo con la información del systemPrompt.');
        console.warn('   Para usar documentos (PDF, CSV), activa kbEnabled en el perfil.\n');
    }

    // 3. Upsert del binding (un channelId → 1 binding activo a la vez)
    const existing = await prisma.whatsappAgentBinding.findFirst({
        where: { tenantId, channelId }
    });

    let binding;
    if (existing) {
        binding = await prisma.whatsappAgentBinding.update({
            where: { id: existing.id },
            data: { profileId, isActive, handoffToHumanKeys: handoffKeys }
        });
        console.log('\n🔄  Binding ACTUALIZADO (ya existía)');
    } else {
        binding = await prisma.whatsappAgentBinding.create({
            data: { tenantId, channelId, profileId, isActive, handoffToHumanKeys: handoffKeys }
        });
        console.log('\n✅  Binding CREADO');
    }

    // 4. Output final
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  WhatsappAgentBinding — Estado Final');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  bindingId   : ${binding.id}`);
    console.log(`  tenantId    : ${binding.tenantId}`);
    console.log(`  channelId   : ${binding.channelId}  (${channel.name})`);
    console.log(`  profileId   : ${binding.profileId}  (${profile.name})`);
    console.log(`  isActive    : ${binding.isActive}`);
    console.log(`  handoffKeys : [${binding.handoffToHumanKeys.join(', ')}]`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (!binding.isActive) {
        console.warn('⚠️   BINDING INACTIVO — el agente NO responderá en este canal.\n');
    } else {
        console.log('🤖  El Agente IA está ACTIVO para este canal de WhatsApp.\n');
    }
}

main()
    .catch(err => {
        console.error('\n❌  Error fatal:', err.message || err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
