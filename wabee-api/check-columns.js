const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const columns = await prisma.$queryRaw`SELECT column_name, is_nullable FROM information_schema.columns WHERE table_schema = 'wabee' AND table_name = 'global_audit_events'`;
    console.log(columns);
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
