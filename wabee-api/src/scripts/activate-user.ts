import dotenv from 'dotenv';
dotenv.config();

import { corePrisma as prisma } from '../config/core/core.prisma';

async function verifyUser() {
    const email = 'reelsprueba1@gmail.com';
    try {
        const profile = await prisma.profile.findUnique({
            where: { email }
        });

        if (!profile) {
            console.log(`❌ No se encontró el perfil con email: ${email}`);
            return;
        }

        console.log('Perfil encontrado:', {
            id: profile.id,
            email: profile.email,
            status: profile.status
        });

        if ((profile.status as string) === 'pending_verification') {
            console.log('ACTUALIZANDO: Marcando como activo...');
            const updated = await prisma.profile.update({
                where: { email },
                data: { status: 'active' }
            });
            console.log('✅ Usuario activado:', updated.email, updated.status);
        } else {
            console.log('ℹ️ El usuario ya está activo o tiene otro estado.');
        }

    } catch (error: any) {
        console.error('Error:', error);
    } finally {
        await (prisma as any).$disconnect?.();
    }
}

verifyUser();
