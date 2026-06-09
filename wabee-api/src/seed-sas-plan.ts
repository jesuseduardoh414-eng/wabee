import 'dotenv/config';
import { prisma } from './config/core/core.prisma';
import { core } from './config/core/core.infra';

async function seed() {
    console.log('--- Seeding WABEE SaaS Plan ---');
    try {
        // 0. Asegurar que el usuario es SUPER_ADMIN para poder registrar productos
        // NOTA: script legado. El rol de plataforma es `superadmin` (ver create-superadmin-role.ts).
        console.log('> Verificando permisos de SUPER_ADMIN...');
        let superAdminRole = await (prisma as any).role.findFirst({ where: { slug: 'superadmin' } });
        if (!superAdminRole) {
            superAdminRole = await (prisma as any).role.create({
                data: {
                    name: 'Super Admin',
                    slug: 'superadmin',
                    description: 'Acceso total a la plataforma.',
                    productId: 'ebda5a05-fd05-440d-b9ca-c52f1bc35481'
                }
            });
        }
        await (prisma as any).profile.update({
            where: { email: 'antigravityp5@gmail.com' },
            data: { globalRoleId: superAdminRole.id }
        });
        console.log('V Usuario antigravityp5@gmail.com elevado a SUPER_ADMIN.');

        // 1. Encontrar usuario para ser actor
        const user = await (prisma as any).profile.findFirst({
            where: { email: 'antigravityp5@gmail.com' },
            include: { memberships: true }
        });

        if (!user) {
            console.warn('! Usuario antigravityp5@gmail.com no encontrado. Buscando cualquier usuario...');
            const anyUser = await (prisma as any).profile.findFirst({ include: { memberships: true } });
            if (!anyUser) throw new Error('No hay usuarios en la BD para realizar el seed.');
            seedWithUser(anyUser);
        } else {
            await seedWithUser(user);
        }

    } catch (err: any) {
        console.error('X Error seeding:', err.message);
        if (err.stack) console.error(err.stack);
    }
}

async function seedWithUser(user: any) {
    const actor = { id: user.id, email: user.email };
    const tenantId = user.memberships[0]?.tenantId;

    if (!tenantId) throw new Error('El usuario seleccionado no tiene organización.');

    console.log(`> Usando actor: ${user.email} para la organización ${tenantId}`);

    // 2. Crear Producto
    console.log('> Claves Core:', Object.keys(core));
    console.log('> Claves Admin:', core.admin ? Object.keys(core.admin) : 'null');
    console.log('> Estructura admin.product:', core.admin?.product ? Object.keys(core.admin.product) : 'null');
    console.log('> Registrando Producto WABEE...');
    let product = await (prisma as any).product.findUnique({ where: { slug: 'wabee-saas' } });
    if (!product) {
        const productRes = await ((core.admin.product as any).registerProduct as any).execute(actor, {
            name: 'WABEE SaaS',
            slug: 'wabee-saas',
            description: 'Plataforma WABEE Core'
        });
        if (!productRes.success) throw new Error(`Error reg product: ${productRes.error}`);
        product = productRes.value;
        console.log('V Producto creado.');
    } else {
        console.log('V Producto ya existía.');
    }

    // 3. Crear Plan Template
    console.log('> Creando Plan Pro...');
    let plan = await (prisma as any).planTemplate.findFirst({ where: { slug: 'pro-plan' } });
    if (!plan) {
        const planRes = await ((core.admin.product as any).createPlan as any).execute(actor, {
            productId: product.id,
            name: 'Plan Pro Emprendedor',
            priceId: 'price_dummy',
            features: { media: true, storage: true },
            limits: {
                STORAGE: 500 * 1024 * 1024, // 500MB
                USER: 50
            }
        });
        if (!planRes.success) throw new Error(`Error create plan: ${planRes.error}`);
        plan = planRes.value;
        console.log('V Plan creado.');
    } else {
        console.log('V Plan ya existía.');
    }

    // 4. Aplicar Trial Plan a la organización
    console.log(`> Aplicando Plan de Prueba a la organización...`);
    const applyRes = await ((core.admin.product as any).applyTrialPlan as any).execute({
        tenantId,
        planTemplateId: plan.id,
        actorId: user.id
    });

    if (!applyRes.success) {
        console.warn(`! No se pudo aplicar el plan (quizás ya tenga uno): ${applyRes.error}`);
    } else {
        console.log('V Plan Pro aplicado con éxito como Trial!');
    }
}

seed();
