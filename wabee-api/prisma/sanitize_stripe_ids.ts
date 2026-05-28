import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning up empty stripe price IDs in core.plan_versions...');
  
  const mRes = await prisma.$executeRaw`UPDATE core.plan_versions SET stripe_price_monthly_id = NULL WHERE stripe_price_monthly_id = ''`;
  console.log(`Updated ${mRes} rows for monthly id`);
  
  const aRes = await prisma.$executeRaw`UPDATE core.plan_versions SET stripe_price_annual_id = NULL WHERE stripe_price_annual_id = ''`;
  console.log(`Updated ${aRes} rows for annual id`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
