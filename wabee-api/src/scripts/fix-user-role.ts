import 'dotenv/config';
import { corePrisma as prisma } from '../config/core/core.prisma';
import { core } from '../config/core/core.infra';

async function fix() {
    console.log('> Core cargado:', !!core);
    try {
        console.log('> Buscando roles globales...');
        const roles = await prisma.role.findMany();
        console.log('Roles disponibles:', roles.map((r: any) => r.slug));

        let superAdmin = roles.find((r: any) => r.slug === 'superadmin');

        if (!superAdmin) {
            console.log('! No se encontró el rol "superadmin". Creándolo bajo el producto Wabee...');
            superAdmin = await prisma.role.create({
                data: {
                    name: 'Super Admin',
                    slug: 'superadmin',
                    description: 'Acceso total a la plataforma.',
                    productId: 'ebda5a05-fd05-440d-b9ca-c52f1bc35481'
                }
            });
            console.log('V Rol "superadmin" creado.');
        }

        console.log(`> Elevando privilegios de antigravityp5@gmail.com a SUPER_ADMIN...`);
        const update = await prisma.profile.update({
            where: { email: 'antigravityp5@gmail.com' },
            data: { globalRoleId: superAdmin!.id }
        });

        console.log('V Éxito: El usuario ahora es SUPER_ADMIN.');

    } catch (err: any) {
        console.error('X Error durante elevación de privilegios:', err.message);
        if (err.stack) console.error(err.stack);
    }
}

fix();
