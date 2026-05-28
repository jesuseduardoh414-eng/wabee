import { corePrisma as prisma } from '../src/config/core/core.prisma';

async function main() {
    console.log('⏳ Seeding wabee product...');
    
    try {
        const product = await prisma.product.upsert({
            where: { slug: 'wabee' },
            update: {}, // No modificamos si ya existe
            create: {
                name: 'WABEE',
                slug: 'wabee',
                description: 'Producto WABEE',
                baseUrl: 'https://app.wabee.ai', // Placeholder controlado
            }
        });

        console.log('✅ Success! Product seeded:', product);
    } catch (e) {
        console.error('❌ Error seeding product:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
