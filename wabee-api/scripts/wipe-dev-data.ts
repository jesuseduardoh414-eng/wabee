/**
 * ═══════════════════════════════════════════════════════════════════
 * WIPE DEV DATA — Script de Limpieza Total (Solo Entornos No-Producción)
 * ═══════════════════════════════════════════════════════════════════
 *
 * SEGURIDAD:
 *   - Requiere NODE_ENV !== 'production'
 *   - Requiere WIPE_DEV_DATA=true (flag explícito)
 *
 * USO:
 *   pnpm wipe:dev        (desde apps/api)
 *   npm run wipe:dev     (desde apps/api)
 *
 * QUÉ BORRA:
 *   1. whatsapp_campaign_messages  (mensajes individuales de campañas)
 *   2. whatsapp_campaigns          (campañas)
 *   3. whatsapp_messages           (mensajes del inbox)
 *   4. whatsapp_threads            (hilos/conversaciones del inbox)
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Guards de seguridad ──────────────────────────────────────────────────────
function assertSafeToRun() {
    const env = process.env.NODE_ENV ?? 'development';
    const wipeFlag = process.env.WIPE_DEV_DATA;

    if (env === 'production') {
        console.error('\n❌ ABORTADO: NODE_ENV=production. Este script NO puede correr en producción.\n');
        process.exit(1);
    }

    if (wipeFlag !== 'true') {
        console.error('\n❌ ABORTADO: Se requiere WIPE_DEV_DATA=true para ejecutar la limpieza.');
        console.error('   Usa: WIPE_DEV_DATA=true npm run wipe:dev\n');
        process.exit(1);
    }

    console.log(`\n⚠️  MODO: ${env} — Iniciando limpieza de datos de desarrollo...`);
}

// ─── Limpieza principal ───────────────────────────────────────────────────────
async function wipeDevData() {
    assertSafeToRun();

    console.log('\n🗑️  Borrando en orden (respetando FK constraints):\n');

    // 1. Campaign messages (FK a campaigns)
    const campaignMessages = await prisma.whatsappCampaignMessage.deleteMany({});
    console.log(`   ✅ whatsapp_campaign_messages: ${campaignMessages.count} registros eliminados`);

    // 2. Campaigns
    const campaigns = await prisma.whatsappCampaign.deleteMany({});
    console.log(`   ✅ whatsapp_campaigns:         ${campaigns.count} registros eliminados`);

    // 3. Messages del inbox (FK a threads)
    const messages = await prisma.whatsappMessage.deleteMany({});
    console.log(`   ✅ whatsapp_messages:          ${messages.count} registros eliminados`);

    // 4. Threads/conversaciones del inbox
    const threads = await prisma.whatsappThread.deleteMany({});
    console.log(`   ✅ whatsapp_threads:           ${threads.count} registros eliminados`);

    const total = campaignMessages.count + campaigns.count + messages.count + threads.count;
    console.log(`\n✨ Limpieza completada. Total eliminados: ${total} registros.\n`);
}

// ─── Entry point ─────────────────────────────────────────────────────────────
wipeDevData()
    .catch((err) => {
        console.error('\n❌ Error durante la limpieza:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
