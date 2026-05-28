import 'dotenv/config';
import '../config/core/core.infra';

import { Prisma, PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import { corePrisma, prisma } from '../config/core/core.prisma';
import { coreEnv } from '../config/core/core.env';

type ModelName = keyof typeof Prisma.dmmf.datamodel.models;

const supabaseAdmin = createClient(coreEnv.SUPABASE_URL, coreEnv.SUPABASE_SERVICE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

function delegateName(modelName: string) {
    return modelName.charAt(0).toLowerCase() + modelName.slice(1);
}

function getTenantScopedModels() {
    const models = Prisma.dmmf.datamodel.models.filter((model) =>
        model.fields.some((field) => field.name === 'tenantId')
    );

    const dependencyMap = new Map<string, Set<string>>();
    models.forEach((model) => dependencyMap.set(model.name, new Set()));

    for (const model of models) {
        for (const field of model.fields) {
            if (field.kind !== 'object') continue;
            if (!field.relationFromFields || field.relationFromFields.length === 0) continue;
            if (!dependencyMap.has(model.name)) continue;
            if (!dependencyMap.has(field.type)) continue;
            dependencyMap.get(model.name)!.add(field.type);
        }
    }

    const visited = new Set<string>();
    const ordered: string[] = [];

    const visit = (name: string) => {
        if (visited.has(name)) return;
        visited.add(name);
        for (const dep of dependencyMap.get(name) || []) {
            visit(dep);
        }
        ordered.push(name);
    };

    for (const model of models) visit(model.name);

    return ordered.reverse();
}

async function deleteManyIfPossible(client: any, modelName: string, where: Record<string, any>) {
    const delegate = client[delegateName(modelName)];
    if (!delegate?.deleteMany) return 0;

    try {
        const result = await delegate.deleteMany({ where });
        return Number(result?.count || 0);
    } catch (error: any) {
        console.warn(`[delete-user] No se pudo limpiar ${modelName}: ${error.message}`);
        return 0;
    }
}

async function deleteTenantScopedData(tenantId: string) {
    const tenantModels = getTenantScopedModels();
    let deletedRows = 0;

    for (const modelName of tenantModels) {
        deletedRows += await deleteManyIfPossible(prisma as any, modelName, { tenantId });
    }

    return deletedRows;
}

async function main() {
    const email = (process.argv[2] || '').trim().toLowerCase();

    if (!email) {
        console.error('Uso: npx ts-node -r dotenv/config src/scripts/delete-user-completely.ts <email>');
        process.exit(1);
    }

    console.log(`[delete-user] Buscando usuario ${email}...`);

    const profile = await corePrisma.profile.findUnique({
        where: { email },
        select: { id: true, email: true, name: true }
    });

    if (!profile) {
        console.log('[delete-user] Usuario no encontrado en core.profiles.');
        return;
    }

    const memberships = await corePrisma.organizationMember.findMany({
        where: { userId: profile.id },
        select: { id: true, tenantId: true }
    });

    const tenantIds = [...new Set(memberships.map((membership: any) => String(membership.tenantId)))] as string[];
    console.log(`[delete-user] Membresías encontradas: ${memberships.length}. Tenants relacionados: ${tenantIds.length}.`);

    for (const tenantId of tenantIds) {
        const membersCount = await corePrisma.organizationMember.count({
            where: { tenantId }
        });

        if (membersCount === 1) {
            console.log(`[delete-user] Limpiando tenant exclusivo ${tenantId}...`);
            const appRows = await deleteTenantScopedData(tenantId);

            await corePrisma.subscription.deleteMany({ where: { tenantId } });
            await corePrisma.invitation.deleteMany({ where: { tenantId } });
            await corePrisma.organizationMember.deleteMany({ where: { tenantId } });
            await corePrisma.organization.deleteMany({ where: { id: tenantId } });

            console.log(`[delete-user] Tenant ${tenantId} limpiado. Filas Wabee eliminadas: ${appRows}.`);
        } else {
            console.log(`[delete-user] Tenant compartido ${tenantId}; solo se eliminarán datos directos del usuario.`);
            await corePrisma.organizationMember.deleteMany({
                where: { tenantId, userId: profile.id }
            });
        }
    }

    const profileScopedModels = Prisma.dmmf.datamodel.models.filter((model) =>
        model.fields.some((field) => field.name === 'profileId')
    );
    for (const model of profileScopedModels) {
        await deleteManyIfPossible(prisma as any, model.name, { profileId: profile.id });
    }

    const userScopedModels = Prisma.dmmf.datamodel.models.filter((model) =>
        model.fields.some((field) => field.name === 'userId')
    );
    for (const model of userScopedModels) {
        await deleteManyIfPossible(prisma as any, model.name, { userId: profile.id });
    }

    await prisma.impersonationSession.deleteMany({
        where: {
            OR: [
                { adminUserId: profile.id },
                { targetUserId: profile.id }
            ]
        }
    }).catch(() => null);

    await corePrisma.invitation.deleteMany({ where: { email } }).catch(() => null);
    await corePrisma.notification.deleteMany({ where: { userId: profile.id } }).catch(() => null);
    await corePrisma.auditTrail.deleteMany({ where: { userId: profile.id } }).catch(() => null);
    await corePrisma.profile.delete({ where: { id: profile.id } });

    const { error } = await supabaseAdmin.auth.admin.deleteUser(profile.id);
    if (error) {
        console.warn(`[delete-user] Perfil borrado en DB, pero Supabase devolvió error al borrar auth user: ${error.message}`);
    } else {
        console.log('[delete-user] Usuario eliminado también de Supabase Auth.');
    }

    console.log(`[delete-user] Eliminación completada para ${email}.`);
}

main()
    .catch((error: any) => {
        console.error('[delete-user] Error fatal:', error.message);
        if (error.stack) console.error(error.stack);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
        await corePrisma.$disconnect?.();
    });
