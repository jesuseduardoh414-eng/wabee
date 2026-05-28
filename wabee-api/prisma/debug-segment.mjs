import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  console.log('\n=== SEGMENTOS ===');
  const segments = await prisma.savedSegment.findMany({
    select: { id: true, name: true, filter: true, tenantId: true }
  });
  console.log(JSON.stringify(segments, null, 2));

  console.log('\n=== CONTACTOS ===');
  const contacts = await prisma.contact.findMany({
    select: { id: true, name: true, lifecycleStatus: true, tenantId: true }
  });
  console.log(JSON.stringify(contacts, null, 2));

  await prisma.$disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
