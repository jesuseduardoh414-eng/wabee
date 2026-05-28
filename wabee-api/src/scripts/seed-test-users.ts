/**
 * Crea 3 usuarios de prueba (Admin, Supervisor, Agente) dentro de una
 * organización de prueba "Wabee Demo", sin necesitar verificación de correo.
 *
 * Uso: npx ts-node -r dotenv/config src/scripts/seed-test-users.ts
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { prisma } from '../config/core/core.prisma';

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_KEY as string,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

const DEMO_ORG = {
    name: 'Wabee Demo',
    slug: 'wabee-demo',
    email: 'demo@wabee.local',
};

const TEST_USERS = [
    { name: 'Admin Demo',      email: 'admin@demo.wabee.local',      password: 'Admin.Demo.2026!',      roleSlug: 'admin' },
    { name: 'Supervisor Demo', email: 'supervisor@demo.wabee.local', password: 'Supervisor.Demo.2026!', roleSlug: 'supervisor' },
    { name: 'Agente Demo',     email: 'agente@demo.wabee.local',     password: 'Agente.Demo.2026!',     roleSlug: 'agent' },
];

async function createOrGetAuthUser(email: string, password: string, name: string) {
    const { data: list } = await supabaseAdmin.auth.admin.listUsers();
    const existing = list?.users.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (existing) {
        await supabaseAdmin.auth.admin.updateUserById(existing.id, {
            password,
            email_confirm: true,
        });
        console.log(`  [Auth] Ya existía: ${email}`);
        return existing.id;
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, productSlug: 'wabee' },
    });

    if (error || !data.user) throw new Error(`Error creando auth user ${email}: ${error?.message}`);
    console.log(`  [Auth] Creado: ${email}`);
    return data.user.id;
}

async function ensureProfile(authId: string, email: string, name: string) {
    const existing = await prisma.$queryRawUnsafe(
        `SELECT id FROM core.profiles WHERE id = $1::uuid OR email = $2 LIMIT 1`,
        authId, email
    ) as any[];

    if (existing.length > 0) {
        await prisma.$executeRawUnsafe(
            `UPDATE core.profiles SET id = $1::uuid, name = $2, status = 'active', email_verified_at = now(), updated_at = now() WHERE email = $3`,
            authId, name, email
        );
        console.log(`  [Profile] Actualizado: ${email}`);
    } else {
        await prisma.$executeRawUnsafe(
            `INSERT INTO core.profiles (id, email, name, status, has_2fa, preferences, email_verified_at, created_at, updated_at)
             VALUES ($1::uuid, $2, $3, 'active', false, '{}'::jsonb, now(), now(), now())`,
            authId, email, name
        );
        console.log(`  [Profile] Creado: ${email}`);
    }
}

async function ensureOrg() {
    const existing = await prisma.$queryRawUnsafe(
        `SELECT id FROM core.organizations WHERE slug = $1 LIMIT 1`,
        DEMO_ORG.slug
    ) as any[];

    if (existing.length > 0) {
        console.log(`  [Org] Ya existe: ${DEMO_ORG.name} (${existing[0].id})`);
        return existing[0].id as string;
    }

    const result = await prisma.$queryRawUnsafe(
        `INSERT INTO core.organizations (name, slug, email, status, settings, created_at, updated_at)
         VALUES ($1, $2, $3, 'active', '{}'::jsonb, now(), now())
         RETURNING id`,
        DEMO_ORG.name, DEMO_ORG.slug, DEMO_ORG.email
    ) as any[];

    const orgId = result[0].id as string;
    console.log(`  [Org] Creada: ${DEMO_ORG.name} (${orgId})`);
    return orgId;
}

async function ensureMembership(orgId: string, userId: string, email: string, roleSlug: string) {
    // Buscar el role en core.roles
    const roles = await prisma.$queryRawUnsafe(
        `SELECT id, slug FROM core.roles WHERE slug = $1 LIMIT 1`,
        roleSlug
    ) as any[];

    if (roles.length === 0) {
        console.warn(`  [Warning] Rol '${roleSlug}' no encontrado en core.roles. ¿Corriste seed-roles?`);
        return;
    }

    const roleId = roles[0].id;

    // Revisar si ya existe membresía
    const existing = await prisma.$queryRawUnsafe(
        `SELECT id FROM core.organization_members WHERE organization_id = $1::uuid AND user_id = $2::uuid LIMIT 1`,
        orgId, userId
    ) as any[];

    if (existing.length > 0) {
        await prisma.$executeRawUnsafe(
            `UPDATE core.organization_members SET role_id = $1::uuid, status = 'active', updated_at = now()
             WHERE organization_id = $2::uuid AND user_id = $3::uuid`,
            roleId, orgId, userId
        );
        console.log(`  [Member] Actualizado: ${email} → ${roleSlug}`);
    } else {
        await prisma.$executeRawUnsafe(
            `INSERT INTO core.organization_members (organization_id, user_id, role_id, status, created_at, updated_at)
             VALUES ($1::uuid, $2::uuid, $3::uuid, 'active', now(), now())`,
            orgId, userId, roleId
        );
        console.log(`  [Member] Agregado: ${email} → ${roleSlug}`);
    }
}

async function main() {
    console.log('\n🌱 Creando organización de prueba y usuarios de cada rol...\n');

    // 1. Crear / obtener organización de prueba
    console.log('📦 Organización:');
    const orgId = await ensureOrg();

    // 2. Crear usuarios
    const summary: any[] = [];
    for (const user of TEST_USERS) {
        console.log(`\n👤 ${user.name} (${user.roleSlug}):`);
        const authId = await createOrGetAuthUser(user.email, user.password, user.name);
        await ensureProfile(authId, user.email, user.name);
        await ensureMembership(orgId, authId, user.email, user.roleSlug);
        summary.push({
            rol: user.roleSlug,
            email: user.email,
            contraseña: user.password,
        });
    }

    console.log('\n✅ Listo. Credenciales de prueba:\n');
    console.table(summary);
    console.log('\nOrganización:', DEMO_ORG.name);
    console.log('URL login:    http://localhost:5173/login\n');
}

main()
    .catch(err => {
        console.error('\n❌ Error:', err.message);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
