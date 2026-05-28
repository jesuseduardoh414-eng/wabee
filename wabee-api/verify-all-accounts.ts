/**
 * Script: verify-all-accounts.ts
 * Busca todos los perfiles en core.profiles y verifica cada uno que esté bloqueado por:
 *   - status != 'active'
 *   - emailVerifiedAt = null
 *   - auth.users.email_confirmed_at = null
 * 
 * Ejecutar con: npx tsx verify-all-accounts.ts
 */
import { corePrisma } from './src/config/core/core.prisma';

async function run() {
    console.log('\n📋 Consultando todos los perfiles en core.profiles...\n');

    const profiles = await corePrisma.profile.findMany({
        orderBy: { createdAt: 'asc' },
        select: {
            id: true,
            email: true,
            status: true,
            emailVerifiedAt: true,
            createdAt: true,
        }
    } as any);

    console.log(`Total de perfiles encontrados: ${profiles.length}\n`);
    console.log('─'.repeat(80));

    // Consultar estado de auth.users para cada email
    const emails = profiles.map((p: any) => p.email).filter(Boolean);
    
    let authUsers: any[] = [];
    try {
        authUsers = await corePrisma.$queryRaw`
            SELECT email, email_confirmed_at, created_at, banned_until
            FROM auth.users
            WHERE email = ANY(${emails}::text[])
        `;
    } catch (e: any) {
        console.warn('⚠️  No se pudo consultar auth.users:', e.message);
    }

    const authMap = new Map(authUsers.map((u: any) => [u.email, u]));

    const needsFix: any[] = [];

    for (const profile of profiles as any[]) {
        const auth = authMap.get(profile.email);
        const profileOk = profile.status === 'active' && profile.emailVerifiedAt != null;
        const authOk = auth?.email_confirmed_at != null;
        const banned = auth?.banned_until != null;

        const status = profileOk && authOk && !banned ? '✅' : '❌';

        console.log(`${status} ${profile.email}`);
        console.log(`   Profile status: ${profile.status} | emailVerifiedAt: ${profile.emailVerifiedAt ?? 'NULL'}`);
        console.log(`   Auth confirmed: ${auth?.email_confirmed_at ?? 'NULL'} | Banned: ${banned ? auth.banned_until : 'No'}`);
        console.log('');

        if (!profileOk || !authOk) {
            needsFix.push({ profile, auth });
        }
    }

    console.log('─'.repeat(80));

    if (needsFix.length === 0) {
        console.log('\n🎉 Todas las cuentas ya están verificadas y pueden hacer login.\n');
        return;
    }

    console.log(`\n🔧 Corrigiendo ${needsFix.length} cuenta(s) bloqueadas...\n`);

    for (const { profile } of needsFix) {
        try {
            // 1. Actualizar core.profiles
            await corePrisma.profile.update({
                where: { id: profile.id },
                data: {
                    status: 'active',
                    emailVerifiedAt: new Date(),
                } as any
            });

            // 2. Actualizar auth.users
            try {
                await corePrisma.$executeRaw`
                    UPDATE auth.users
                    SET email_confirmed_at = NOW(), updated_at = NOW()
                    WHERE email = ${profile.email}
                `;
                console.log(`✅ ${profile.email} → verificada correctamente`);
            } catch (authErr: any) {
                console.log(`⚠️  ${profile.email} → profile OK, pero auth.users falló: ${authErr.message}`);
                console.log(`   SQL manual: UPDATE auth.users SET email_confirmed_at = NOW() WHERE email = '${profile.email}';`);
            }
        } catch (err: any) {
            console.error(`❌ ${profile.email} → ERROR: ${err.message}`);
        }
    }

    console.log('\n─'.repeat(80));
    console.log('\n✅ Proceso completado. Puedes hacer login con todas las cuentas.\n');
}

run().finally(() => corePrisma.$disconnect());
