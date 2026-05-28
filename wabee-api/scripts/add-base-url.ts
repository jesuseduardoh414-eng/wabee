import { prisma } from '../src/config/core/core.prisma';

async function main() {
    console.log('⏳ Altering table core.products to add base_url...');
    try {
        await prisma.$executeRawUnsafe(`ALTER TABLE "core"."products" ADD COLUMN IF NOT EXISTS "base_url" TEXT;`);
        console.log('✅ Successfully added base_url to core.products');
    } catch (e) {
        console.error('❌ Error adding column:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
