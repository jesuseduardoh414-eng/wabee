import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { corePrisma as prisma } from '../config/core/core.prisma';

const WABEE_PRODUCT_ID = 'ebda5a05-fd05-440d-b9ca-c52f1bc35481';
const WABEE_PRODUCT_SLUG = 'wabee';

const supabase = createClient(
    process.env.SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_KEY as string,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

const ROLE_DEFINITIONS = [
    {
        name: 'Administrador',
        slug: 'admin',
        description: 'Acceso administrativo completo dentro de Wabee.',
        isDefault: false,
        user: {
            name: 'Wabee Admin',
            email: 'admin.seed@wabee.local',
            password: 'Wabee.Admin.2026!'
        }
    },
    {
        name: 'Supervisor',
        slug: 'supervisor',
        description: 'Supervisa conversaciones, metricas y operacion del equipo.',
        isDefault: false,
        user: {
            name: 'Wabee Supervisor',
            email: 'supervisor.seed@wabee.local',
            password: 'Wabee.Supervisor.2026!'
        }
    },
    {
        name: 'Agente',
        slug: 'agent',
        description: 'Atiende conversaciones y opera el inbox de Wabee.',
        isDefault: true,
        user: {
            name: 'Wabee Agent',
            email: 'agent.seed@wabee.local',
            password: 'Wabee.Agent.2026!'
        }
    }
] as const;

type RoleDef = typeof ROLE_DEFINITIONS[number];

async function ensureProduct() {
    const product = await prisma.product.findUnique({
        where: { id: WABEE_PRODUCT_ID }
    });

    if (!product) {
        throw new Error(`No existe el producto wabee con id ${WABEE_PRODUCT_ID}.`);
    }

    if (product.slug !== WABEE_PRODUCT_SLUG) {
        throw new Error(`El producto ${WABEE_PRODUCT_ID} existe pero su slug es ${product.slug}.`);
    }

    return product;
}

async function ensureRole(def: RoleDef) {
    const existing = await prisma.role.findFirst({
        where: {
            productId: WABEE_PRODUCT_ID,
            slug: def.slug
        }
    });

    if (existing) {
        return prisma.role.update({
            where: { id: existing.id },
            data: {
                name: def.name,
                description: def.description,
                isDefault: def.isDefault,
                isSystem: false
            }
        });
    }

    return prisma.role.create({
        data: {
            name: def.name,
            slug: def.slug,
            description: def.description,
            productId: WABEE_PRODUCT_ID,
            isDefault: def.isDefault,
            isSystem: false
        }
    });
}

async function listAuthUsersByEmail(email: string) {
    const { data, error } = await supabase.auth.admin.listUsers();
    if (error) throw error;
    return data.users.find(user => user.email?.toLowerCase() === email.toLowerCase()) || null;
}

async function ensureAuthUser(def: RoleDef) {
    const existing = await listAuthUsersByEmail(def.user.email);

    if (existing) {
        const { error } = await supabase.auth.admin.updateUserById(existing.id, {
            password: def.user.password,
            email_confirm: true,
            user_metadata: {
                name: def.user.name,
                productSlug: WABEE_PRODUCT_SLUG
            }
        });

        if (error) throw error;

        return {
            id: existing.id,
            email: existing.email || def.user.email
        };
    }

    const { data, error } = await supabase.auth.admin.createUser({
        email: def.user.email,
        password: def.user.password,
        email_confirm: true,
        user_metadata: {
            name: def.user.name,
            productSlug: WABEE_PRODUCT_SLUG
        }
    });

    if (error || !data.user) {
        throw new Error(error?.message || `No se pudo crear auth user para ${def.user.email}`);
    }

    return {
        id: data.user.id,
        email: data.user.email || def.user.email
    };
}

async function ensureCoreProfile(params: {
    authUserId: string;
    name: string;
    email: string;
    roleId: string;
}) {
    const byEmail = await prisma.$queryRawUnsafe<Array<{
        id: string;
        email: string;
        name: string;
    }>>(
        `
        select id, email, name
        from core.profiles
        where email = $1
        limit 1
        `,
        params.email
    );

    if (byEmail[0]) {
        await prisma.$executeRawUnsafe(
            `
            update core.profiles
            set
                id = $1::uuid,
                name = $2,
                status = 'active'::core."ProfileStatus",
                has_2fa = false,
                preferences = '{}'::jsonb,
                global_role_id = $3::uuid,
                email_verified_at = now(),
                updated_at = now(),
                deleted_at = null
            where email = $4
            `,
            params.authUserId,
            params.name,
            params.roleId,
            params.email
        );
    } else {
        await prisma.$executeRawUnsafe(
            `
            insert into core.profiles (
                id,
                email,
                name,
                status,
                has_2fa,
                preferences,
                created_at,
                updated_at,
                deleted_at,
                global_role_id,
                email_verified_at
            ) values (
                $1::uuid,
                $2,
                $3,
                'active'::core."ProfileStatus",
                false,
                '{}'::jsonb,
                now(),
                now(),
                null,
                $4::uuid,
                now()
            )
            `,
            params.authUserId,
            params.email,
            params.name,
            params.roleId
        );
    }

    return {
        id: params.authUserId,
        email: params.email,
        name: params.name
    };
}

async function main() {
    console.log('> Validando producto Wabee...');
    await ensureProduct();

    const summary: Array<Record<string, string | boolean>> = [];

    for (const def of ROLE_DEFINITIONS) {
        const role = await ensureRole(def);
        console.log(`✓ Rol listo: ${role.slug} (${role.id})`);

        const authUser = await ensureAuthUser(def);
        console.log(`✓ Auth user listo: ${authUser.email} (${authUser.id})`);

        const profile = await ensureCoreProfile({
            authUserId: authUser.id,
            name: def.user.name,
            email: def.user.email,
            roleId: role.id
        });

        console.log(`✓ Core profile listo: ${profile.email} (${profile.id})`);

        summary.push({
            role: role.slug,
            roleId: role.id,
            email: def.user.email,
            password: def.user.password,
            profileId: profile.id
        });
    }

    console.log('\nResumen final:');
    console.table(summary);
    console.log('\nNota: el usuario con rol admin disparara setup de 2FA en su primer login, segun LoginUseCase del core.');
}

main()
    .catch(err => {
        console.error('X Error:', err.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
