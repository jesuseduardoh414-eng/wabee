import { prisma, corePrisma } from '../../config/core/core.prisma';
import { startOfMonth, endOfMonth } from 'date-fns';

/**
 * Servicio para calcular el uso actual de recursos por organización.
 */
export class LimitsService {
    /**
     * Cuenta canales de WhatsApp activos (no archivados).
     */
    static async countChannels(tenantId: string): Promise<number> {
        return await (prisma as any).whatsappChannel.count({
            where: {
                tenantId,
                archivedAt: null
            }
        });
    }

    /**
     * Cuenta todos los contactos de la organización (excluyendo eliminados físicamente).
     */
    static async countContacts(tenantId: string): Promise<number> {
        return await (prisma as any).contact.count({
            where: {
                tenantId
            }
        });
    }

    /**
     * Cuenta agentes de IA creados.
     */
    static async countAiAgents(tenantId: string): Promise<number> {
        return await (prisma as any).aiProfile.count({
            where: {
                tenantId
            }
        });
    }

    /**
     * Cuenta campañas creadas en el mes actual.
     */
    static async countCampaignsThisMonth(tenantId: string): Promise<number> {
        const now = new Date();
        return await (prisma as any).whatsappCampaign.count({
            where: {
                tenantId,
                createdAt: {
                    gte: startOfMonth(now),
                    lte: endOfMonth(now)
                }
            }
        });
    }

    /**
     * Obtiene el uso de tokens de IA en el mes actual.
     * Nota: En el esquema actual no hay un campo directo de tokens en AiAuditLog, 
     * pero se asume que se guardará en metadata o un campo similar en el futuro.
     * Por ahora retornamos 0 o sumamos un campo 'tokens' si existe.
     */
    static async getAiTokensUsageThisMonth(tenantId: string): Promise<number> {
        // Implementación placeholder según disponibilidad de datos
        // Si no hay campo tokens, retornamos 0 para no bloquear erróneamente.
        return 0; 
    }

    /**
     * Cuenta ocupación del Team (Miembros activos/suspendidos + Invitaciones pendientes no expiradas).
     */
    static async countTeamMembers(tenantId: string): Promise<number> {
        const [membersCount, pendingInvites] = await Promise.all([
            // organizationMember e invitation son modelos del Core → usar corePrisma
            corePrisma.organizationMember.count({
                where: {
                    tenantId,
                    status: { in: ['active', 'suspended'] }
                }
            }),
            corePrisma.invitation.count({
                where: {
                    tenantId,
                    acceptedAt: null,
                    expiresAt: { gte: new Date() }
                }
            })
        ]);
        return membersCount + pendingInvites;
    }

    /**
     * Valida si se puede crear un recurso según el límite.
     * @param limit El valor del límite del plan (-1 para ilimitado, null para bloqueado)
     * @param current El uso actual
     */
    static check(limit: number | null | undefined, current: number): boolean {
        if (limit === null || limit === undefined) return false; // Bloqueado por defecto si es null
        if (limit === -1) return true; // Ilimitado
        return current < limit;
    }
}
