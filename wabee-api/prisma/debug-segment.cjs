const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const pg = require('pg');

const DATABASE_URL = 'postgresql://postgres.inyblrlxueigslayvduf:3UyvrJQsULboFD2N@aws-1-us-west-2.pooler.supabase.com:5432/postgres';

const pool = new pg.Pool({ connectionString: DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

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
  await pool.end();
}

run().catch(e => { console.error(e.message); process.exit(1); });
