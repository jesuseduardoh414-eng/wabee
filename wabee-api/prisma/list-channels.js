const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function run() {
  const list = await p.whatsappChannel.findMany({ select: { id: true, name: true, phoneNumberId: true, tenantId: true } });
  console.log('Canales encontrados:', JSON.stringify(list, null, 2));
  if (list.length > 0) {
    const del = await p.whatsappChannel.deleteMany({});
    console.log('Eliminados:', del.count);
  }
  await p.$disconnect();
}
run().catch(e => { console.error(e.message); process.exit(1); });
