import 'dotenv/config';
import { corePrisma as prisma } from '../config/core/core.prisma';

async function main() {
    try {
        const email = 'antigravityp5@gmail.com';
        const user = await prisma.profile.findUnique({ where: { email } });
        if (user) {
            const count = await prisma.organizationMember.deleteMany({
                where: { userId: user.id }
            });
            console.log(`Eliminadas ${count.count} membresías para el usuario ${email}. Ahora es SUPER_ADMIN puro.`);
        } else {
            console.log("Usuario no encontrado.");
        }
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
