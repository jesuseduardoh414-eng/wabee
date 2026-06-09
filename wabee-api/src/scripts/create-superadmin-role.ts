import 'dotenv/config';
// Usamos el cliente `prisma` (con adapter pg ya configurado) y SQL crudo contra el schema `core`.
// Evita AuthFactory/Redis: este script solo necesita acceso directo a la base de datos.
import { prisma } from '../config/core/core.prisma';

/**
 * Crea (o asegura) el rol de plataforma `superadmin` y migra a los Super Admin actuales.
 *
 * Antes: el Super Admin de plataforma y el Administrador de organización compartían el mismo
 * rol Wabee `admin`. Se distinguían solo por dónde estaba enganchado el rol (global vs membresía),
 * lo cual es frágil. Este script introduce un rol global propio `superadmin` y re-apunta a él
 * todos los perfiles cuyo rol GLOBAL era el `admin` de Wabee.
 *
 * Idempotente: se puede correr varias veces sin efectos duplicados.
 */

const WABEE_PRODUCT_ID = 'ebda5a05-fd05-440d-b9ca-c52f1bc35481';
const WABEE_ADMIN_ROLE_ID = '1a06fe45-9c4a-47aa-a59b-500add6c51e4';

const SUPERADMIN = {
    name: 'Super Admin',
    slug: 'superadmin',
    description: 'Acceso total a la plataforma: organizaciones, planes, branding y auditoría global.'
};

async function ensureSuperadminRole(): Promise<string> {
    const existing = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `select id from core.roles where product_id = $1::uuid and slug = $2 limit 1`,
        WABEE_PRODUCT_ID,
        SUPERADMIN.slug
    );

    if (existing[0]) {
        await prisma.$executeRawUnsafe(
            `update core.roles set name = $1, description = $2, is_default = false, is_system = false, updated_at = now() where id = $3::uuid`,
            SUPERADMIN.name,
            SUPERADMIN.description,
            existing[0].id
        );
        console.log(`✓ Rol superadmin ya existía: ${existing[0].id}`);
        return existing[0].id;
    }

    const created = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `insert into core.roles (id, name, slug, description, product_id, is_default, is_system, created_at, updated_at)
         values (gen_random_uuid(), $1, $2, $3, $4::uuid, false, false, now(), now())
         returning id`,
        SUPERADMIN.name,
        SUPERADMIN.slug,
        SUPERADMIN.description,
        WABEE_PRODUCT_ID
    );
    console.log(`✓ Rol superadmin creado: ${created[0].id}`);
    return created[0].id;
}

async function main() {
    console.log('> Asegurando rol de plataforma "superadmin"...');
    const superadminRoleId = await ensureSuperadminRole();

    if (superadminRoleId === WABEE_ADMIN_ROLE_ID) {
        throw new Error('El rol superadmin coincide con el rol admin; aborta para no corromper datos.');
    }

    // Perfiles que hoy son Super Admin = los que tienen como rol GLOBAL el rol admin de Wabee.
    const affected = await prisma.$queryRawUnsafe<Array<{ id: string; email: string; name: string }>>(
        `select id, email, name from core.profiles where global_role_id = $1::uuid order by email`,
        WABEE_ADMIN_ROLE_ID
    );

    console.log(`\n> Perfiles a migrar (global_role_id = admin → superadmin): ${affected.length}`);
    for (const p of affected) console.log(`   - ${p.name} <${p.email}> (${p.id})`);

    if (affected.length > 0) {
        const updated = await prisma.$executeRawUnsafe(
            `update core.profiles set global_role_id = $1::uuid, updated_at = now() where global_role_id = $2::uuid`,
            superadminRoleId,
            WABEE_ADMIN_ROLE_ID
        );
        console.log(`\n✓ Perfiles migrados a superadmin: ${updated}`);
    } else {
        console.log('\n(No había perfiles con rol global admin; nada que migrar.)');
    }

    const remaining = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
        `select count(*)::bigint as count from core.profiles where global_role_id = $1::uuid`,
        WABEE_ADMIN_ROLE_ID
    );
    console.log(`\n> Perfiles que aún tienen rol global admin (debe ser 0): ${remaining[0]?.count ?? 0}`);
    console.log('> Nota: las membresías de organización (organization_members) NO se tocaron.');
}

main()
    .catch(err => {
        console.error('X Error:', err.message);
        if (err.stack) console.error(err.stack);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
