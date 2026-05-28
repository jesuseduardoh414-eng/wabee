import { corePrisma } from './src/config/core/core.prisma';

async function run() {
  try {
    const columns = await corePrisma.$queryRaw`SELECT column_name, is_nullable FROM information_schema.columns WHERE table_schema = 'wabee' AND table_name = 'global_audit_events'`;
    console.log(columns);
  } catch (err) {
    console.error(err);
  } finally {
    await corePrisma.$disconnect();
  }
}

run();
