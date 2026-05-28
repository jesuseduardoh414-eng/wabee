import { corePrisma as prisma } from '../config/core/core.prisma';

async function listProducts() {
    try {
        const products = await prisma.product.findMany();
        console.log('Productos encontrados:', products);
    } catch (error: any) {
        console.error('Error:', error);
    } finally {
        await (prisma as any).$disconnect?.();
    }
}

listProducts();
