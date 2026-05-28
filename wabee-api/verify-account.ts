/**
 * Script para verificar cuentas de usuario en entorno local/dev.
 * Ejecutar con: npx tsx verify-account.ts <email>
 * 
 * Actualiza:
 * 1. core.profiles -> status = 'active', email_verified_at = NOW()
 * 2. auth.users (Supabase) -> email_confirmed_at = NOW()
 */
import { corePrisma } from './src/config/core/core.prisma';

const email = process.argv[2];

if (!email) {
    console.error('Usage: npx tsx verify-account.ts <email>');
    process.exit(1);
}

async function run() {
    try {
        console.log(`\n🔍 Buscando perfil para: ${email}`);

        // 1. Actualizar en core.profiles
        const profile = await corePrisma.profile.findUnique({
            where: { email }
        });

        if (!profile) {
            console.error(`❌ Perfil no encontrado para: ${email}`);
            process.exit(1);
        }

        console.log(`   Perfil encontrado: id=${profile.id}, status=${profile.status}`);

        const updated = await corePrisma.profile.update({
            where: { id: profile.id },
            data: {
                status: 'active',
                emailVerifiedAt: new Date()
            } as any
        });

        console.log(`✅ Profile actualizado: status=${updated.status}`);

        // 2. Actualizar en auth.users (requiere permisos de service_role)
        try {
            await corePrisma.$executeRaw`
                UPDATE auth.users
                SET email_confirmed_at = NOW(),
                    updated_at = NOW()
                WHERE email = ${email}
            `;
            console.log(`✅ auth.users actualizado: email_confirmed_at = NOW()`);
        } catch (authErr: any) {
            console.warn(`⚠️  No se pudo actualizar auth.users (puede requerir permisos adicionales): ${authErr.message}`);
            console.warn('   Ejecuta esto manualmente en el SQL Editor de Supabase:');
            console.warn(`   UPDATE auth.users SET email_confirmed_at = NOW() WHERE email = '${email}';`);
        }

        console.log(`\n🎉 Cuenta ${email} verificada correctamente. Puedes hacer login ahora.\n`);
    } catch (err: any) {
        console.error('❌ Error:', err.message);
    } finally {
        await corePrisma.$disconnect();
    }
}

run();
