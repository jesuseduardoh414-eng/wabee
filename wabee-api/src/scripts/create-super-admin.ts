import 'dotenv/config';
import { corePrisma as prisma } from '../config/core/core.prisma';
import { core } from '../config/core/core.infra';

async function main() {
    const args = process.argv.slice(2);
    const email = args[0];
    const password = args[1]; // Optional, only needed if user doesn't exist

    if (!email) {
        console.error('Uso: npx tsx src/scripts/create-super-admin.ts <email> [password]');
        process.exit(1);
    }

    try {
        console.log(`> Buscando usuario con email: ${email}`);
        let user = await prisma.profile.findUnique({
            where: { email }
        });

        if (user) {
            console.log('> Usuario encontrado. Elevando permisos a SUPER_ADMIN...');
            await prisma.profile.update({
                where: { email },
                data: { globalRoleId: '1a06fe45-9c4a-47aa-a59b-500add6c51e4' }
            });
            console.log('✓ Éxito: El usuario ahora es SUPER_ADMIN.');
        } else {
            console.log('> Usuario no encontrado. Creando nuevo usuario SUPER_ADMIN...');
            
            if (!password) {
                console.error('Error: Se requiere una contraseña para crear un nuevo usuario.');
                console.error('Uso: npx tsx src/scripts/create-super-admin.ts <email> <password>');
                process.exit(1);
            }

            // Register using core
            const regResult = await core.auth.register.execute({
                name: 'Super Admin',
                email: email,
                password: password,
            } as any);

            if (!(regResult as any).success) {
                console.error('X Error al crear usuario en core:', (regResult as any).message || regResult);
                process.exit(1);
            }

            const userId = (regResult as any).user.id;

            // Update platformRole to SUPER_ADMIN
            await prisma.profile.update({
                where: { id: userId },
                data: { globalRoleId: '1a06fe45-9c4a-47aa-a59b-500add6c51e4' }
            });
            
            // Generate a default organization / complete onboarding if needed
            // For a platform admin, they might not need a default organization, 
            // but the application might expect one. We will try to complete onboarding.
            try {
                // @ts-ignore - Importing coreAdapter to complete onboarding
                const { coreAdapter } = await import('../modules/core/core.adapter');
                await coreAdapter.auth.completeOnboarding(userId, email);
                console.log('> Onboarding básico completado para el nuevo usuario.');
            } catch (err: any) {
                console.warn('> No se pudo completar onboarding automático (no es crítico):', err.message);
            }

            console.log('✓ Éxito: Nuevo usuario creado como SUPER_ADMIN.');
        }

    } catch (err: any) {
        console.error('X Error inesperado:', err.message);
        if (err.stack) console.error(err.stack);
    } finally {
        await prisma.$disconnect();
    }
}

main();
