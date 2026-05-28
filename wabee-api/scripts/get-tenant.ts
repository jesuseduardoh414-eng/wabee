import { corePrisma as p } from '../src/config/core/core.prisma';

async function main() {
    const orgs = await p.organization.findMany({ take: 1 });
    if (orgs.length > 0) {
        console.log("TENANT===>", orgs[0].id);
    } else {
        console.log("TENANT===> NO_TENANT");
    }
}

main().catch(console.error).finally(() => p.$disconnect());
