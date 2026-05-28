
import 'dotenv/config';
import { prisma } from '../config/core/core.prisma';

async function main() {
  const plans: any[] = await (prisma as any).planTemplate.findMany({ take: 1 });
  if (plans.length === 0) return console.log('No plans');
  
  const pt = plans[0];
  const cvs: any[] = await (prisma as any).$queryRaw`
    SELECT * FROM core.plan_versions WHERE plan_template_id = ${pt.id}::UUID LIMIT 1
  `;
  
  console.log('Template ID key:', 'id');
  console.log('Template ID value:', pt.id);
  
  if (cvs.length > 0) {
    const v = cvs[0];
    console.log('Raw version keys:', Object.keys(v));
    console.log('Raw v.plan_template_id:', v.plan_template_id);
    console.log('Raw v.is_published:', v.is_published);
  }
}

main().catch(console.error).finally(() => (prisma as any).$disconnect());
