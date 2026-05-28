
import 'dotenv/config';
import { prisma } from '../config/core/core.prisma';

async function main() {
  const templates: any[] = await (prisma as any).planTemplate.findMany();
  
  const results = [];
  for (const pt of templates) {
    const versions: any[] = await (prisma as any).$queryRaw`
      SELECT id, version_number, is_published, is_current 
      FROM core.plan_versions 
      WHERE plan_template_id = ${pt.id}::UUID
      ORDER BY version_number DESC
    `;
    results.push({
      name: pt.name,
      status: pt.status, // might be undefined in prisma but let's see
      isActive: pt.isActive,
      isPublishedCurrent: versions.find(v => v.is_current)?.is_published
    });
  }
  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error).finally(() => (prisma as any).$disconnect());
