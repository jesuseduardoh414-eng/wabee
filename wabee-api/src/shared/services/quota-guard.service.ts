import { prisma } from '../../config/core/core.prisma';

/**
 * QuotaGuardService — verifica los límites del plan antes de operaciones críticas.
 * Lanza un error HTTP 402 estandarizado si se excede el límite.
 */

interface PlanLimits {
    channels: number;
    contacts: number;
    campaignsPerMonth: number;
    automations: number;
    aiTokensPerMonth: number;
    storageMb: number;
}

interface QuotaError {
    httpStatus: 402 | 403;
    code: 'PLAN_LIMIT_REACHED' | 'FEATURE_DISABLED';
    resource: string;
    limit: number;
    used: number;
    upgradeHint: boolean;
    message: string;
}

// Helper para obtener los límites del plan activo de una organización
const getOrgLimits = async (orgId: string): Promise<PlanLimits> => {
    const org = await (prisma as any).organization.findUnique({
        where: { id: orgId },
        select: {
            planTemplate: {
                select: { limits: true }
            }
        }
    });

    const limits = (org?.planTemplate?.limits as any) || {};

    return {
        channels: limits.channels ?? 3,
        contacts: limits.contacts ?? 5000,
        campaignsPerMonth: limits.campaignsPerMonth ?? 10,
        automations: limits.automations ?? 5,
        aiTokensPerMonth: limits.aiTokensPerMonth ?? 100000,
        storageMb: limits.storageMb ?? 50,
    };
};

const buildQuotaError = (resource: string, limit: number, used: number): QuotaError => ({
    httpStatus: 402,
    code: 'PLAN_LIMIT_REACHED',
    resource,
    limit,
    used,
    upgradeHint: true,
    message: `Has alcanzado el límite de ${resource} para tu plan actual (${used}/${limit}). Mejora tu plan para continuar.`
});

export const quotaGuard = {
    /**
     * Verifica si la organización puede conectar un canal más.
     */
    checkChannelsLimit: async (orgId: string): Promise<void> => {
        const limits = await getOrgLimits(orgId);

        // Intentar contar canales activos (si la tabla existe)
        let channelsCount = 0;
        try {
            const tables = Object.keys(prisma as any).filter(k => k.toLowerCase().includes('channel'));
            for (const t of tables) {
                const count = await (prisma as any)[t]?.count?.({ where: { organizationId: orgId } });
                if (typeof count === 'number') { channelsCount = count; break; }
            }
        } catch { /* tabla no existe aún, ignorar */ }

        if (channelsCount >= limits.channels) {
            throw buildQuotaError('channels', limits.channels, channelsCount);
        }
    },

    /**
     * Verifica si la organización puede crear un contacto más.
     */
    checkContactsLimit: async (orgId: string): Promise<void> => {
        const limits = await getOrgLimits(orgId);

        let contactsCount = 0;
        try {
            contactsCount = await (prisma as any).contact?.count?.({
                where: { organizationId: orgId }
            }) ?? 0;
        } catch { /* tabla no existe aún */ }

        if (contactsCount >= limits.contacts) {
            throw buildQuotaError('contacts', limits.contacts, contactsCount);
        }
    },

    /**
     * Verifica si la organización puede crear una campaña más este mes.
     */
    checkCampaignsLimit: async (orgId: string): Promise<void> => {
        const limits = await getOrgLimits(orgId);

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        let campaignsCount = 0;
        try {
            campaignsCount = await (prisma as any).campaign?.count?.({
                where: { organizationId: orgId, createdAt: { gte: monthStart } }
            }) ?? 0;
        } catch { /* tabla no existe aún */ }

        if (campaignsCount >= limits.campaignsPerMonth) {
            throw buildQuotaError('campaigns', limits.campaignsPerMonth, campaignsCount);
        }
    },

    /**
     * Verifica si la organización puede crear una automatización más.
     */
    checkAutomationsLimit: async (orgId: string): Promise<void> => {
        const limits = await getOrgLimits(orgId);

        let autoCount = 0;
        try {
            autoCount = await (prisma as any).automationFlow?.count?.({
                where: { organizationId: orgId, isActive: true }
            }) ?? 0;
        } catch { /* tabla no existe aún */ }

        if (autoCount >= limits.automations) {
            throw buildQuotaError('automations', limits.automations, autoCount);
        }
    },

    /**
     * Verifica si la organización puede consumir N tokens de IA más este mes.
     */
    checkAITokensLimit: async (orgId: string, tokensToConsume: number): Promise<void> => {
        const limits = await getOrgLimits(orgId);

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const agg = await (prisma as any).resourceUsage.aggregate({
            where: {
                tenantId: orgId,
                resourceType: 'API_CALL',
                periodStart: { gte: monthStart },
                periodEnd: { lte: monthEnd }
            },
            _sum: { amount: true }
        }).catch(() => ({ _sum: { amount: 0 } }));

        const used = Number(agg._sum?.amount || 0);

        if (used + tokensToConsume > limits.aiTokensPerMonth) {
            throw buildQuotaError('ai_tokens', limits.aiTokensPerMonth, used);
        }
    },

    /**
     * Verifica si la organización puede subir N bytes más de almacenamiento.
     * @param newBytes - Bytes del archivo a subir
     */
    checkStorageLimit: async (orgId: string, newBytes: number): Promise<void> => {
        const limits = await getOrgLimits(orgId);
        const limitBytes = limits.storageMb * 1024 * 1024;

        const stats = await (prisma as any).tenantStorageStats.findUnique({
            where: { tenantId: orgId },
            select: { totalSizeBytes: true }
        });

        const usedBytes = Number(stats?.totalSizeBytes || 0);

        if (usedBytes + newBytes > limitBytes) {
            const usedMb = Math.round(usedBytes / (1024 * 1024));
            throw buildQuotaError('storage', limits.storageMb, usedMb);
        }
    },

    /**
     * Middleware de Express para validar cuotas.
     * Convierte el QuotaError al formato HTTP estándar.
     */
    handleQuotaError: (error: any, res: any): boolean => {
        if (error?.code === 'PLAN_LIMIT_REACHED' || error?.code === 'FEATURE_DISABLED') {
            res.status(error.httpStatus || 402).json({
                code: error.code,
                resource: error.resource,
                limit: error.limit,
                used: error.used,
                upgradeHint: error.upgradeHint,
                message: error.message,
            });
            return true;
        }
        return false;
    }
};
