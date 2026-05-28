/**
 * ChannelAiConfigService
 * ======================
 * CRUD para la configuración IA por canal.
 * Siempre tenant-scoped. Validación de AI Profile pertenece al tenant.
 */

import { prisma } from '@/lib/prisma';
import { ChannelAiMode, HumanHandoffRole } from '@prisma/client';

export interface ChannelAiConfigDto {
    aiEnabled?: boolean;
    defaultAiProfileId?: string | null;
    humanHandoffEnabled?: boolean;
    humanHandoffRole?: HumanHandoffRole | null;
    humanTeamRef?: string | null;
    fallbackMessage?: string | null;
    aiMode?: ChannelAiMode;
}

export interface ChannelAiConfigResult {
    aiEnabled: boolean;
    defaultAiProfileId: string | null;
    humanHandoffEnabled: boolean;
    humanHandoffRole: HumanHandoffRole | null;
    humanTeamRef: string | null;
    fallbackMessage: string | null;
    aiMode: ChannelAiMode;
    /** Nombre del AI Profile asignado (si existe) */
    defaultAiProfileName?: string | null;
}

export class ChannelAiConfigService {

    /**
     * getConfig()
     * Devuelve la configuración IA del canal.
     * @throws 404 si el canal no existe o no pertenece al tenant
     */
    static async getConfig(
        channelId: string,
        tenantId: string,
    ): Promise<ChannelAiConfigResult> {
        const channel = await prisma.whatsappChannel.findFirst({
            where: { id: channelId, tenantId },
            select: {
                aiEnabled: true,
                defaultAiProfileId: true,
                humanHandoffEnabled: true,
                humanHandoffRole: true,
                humanTeamRef: true,
                fallbackMessage: true,
                aiMode: true,
                defaultAiProfile: {
                    select: { name: true },
                },
            },
        });

        if (!channel) {
            throw { status: 404, code: 'CHANNEL_NOT_FOUND', message: 'Canal no encontrado.' };
        }

        return {
            aiEnabled: channel.aiEnabled,
            defaultAiProfileId: channel.defaultAiProfileId,
            humanHandoffEnabled: channel.humanHandoffEnabled,
            humanHandoffRole: channel.humanHandoffRole,
            humanTeamRef: channel.humanTeamRef,
            fallbackMessage: channel.fallbackMessage,
            aiMode: channel.aiMode,
            defaultAiProfileName: channel.defaultAiProfile?.name ?? null,
        };
    }

    /**
     * updateConfig()
     * Actualiza la configuración IA del canal.
     * Valida que el AI Profile pertenezca al tenant antes de asignarlo.
     * @throws 404 si el canal no existe
     * @throws 400 si el AI Profile no pertenece al tenant
     */
    static async updateConfig(
        channelId: string,
        tenantId: string,
        dto: ChannelAiConfigDto,
    ): Promise<ChannelAiConfigResult> {
        // Verificar canal
        const channel = await prisma.whatsappChannel.findFirst({
            where: { id: channelId, tenantId },
            select: { id: true },
        });
        if (!channel) {
            throw { status: 404, code: 'CHANNEL_NOT_FOUND', message: 'Canal no encontrado.' };
        }

        // Validar AI Profile si se provee
        if (dto.defaultAiProfileId) {
            const profile = await prisma.aiProfile.findFirst({
                where: { id: dto.defaultAiProfileId, tenantId },
                select: { id: true },
            });
            if (!profile) {
                throw {
                    status: 400,
                    code: 'AI_PROFILE_NOT_FOUND',
                    message: 'El AI Profile no existe o no pertenece a este tenant.',
                };
            }
        }

        // Construir datos de actualización (solo campos presentes en el dto)
        const updateData: any = {};
        if (dto.aiEnabled !== undefined) updateData.aiEnabled = dto.aiEnabled;
        if (dto.defaultAiProfileId !== undefined) updateData.defaultAiProfileId = dto.defaultAiProfileId;
        if (dto.humanHandoffEnabled !== undefined) updateData.humanHandoffEnabled = dto.humanHandoffEnabled;
        if (dto.humanHandoffRole !== undefined) updateData.humanHandoffRole = dto.humanHandoffRole;
        if (dto.humanTeamRef !== undefined) updateData.humanTeamRef = dto.humanTeamRef;
        if (dto.fallbackMessage !== undefined) updateData.fallbackMessage = dto.fallbackMessage;
        if (dto.aiMode !== undefined) updateData.aiMode = dto.aiMode;

        const updated = await prisma.whatsappChannel.update({
            where: { id: channelId },
            data: updateData,
            select: {
                aiEnabled: true,
                defaultAiProfileId: true,
                humanHandoffEnabled: true,
                humanHandoffRole: true,
                humanTeamRef: true,
                fallbackMessage: true,
                aiMode: true,
                defaultAiProfile: { select: { name: true } },
            },
        });

        return {
            aiEnabled: updated.aiEnabled,
            defaultAiProfileId: updated.defaultAiProfileId,
            humanHandoffEnabled: updated.humanHandoffEnabled,
            humanHandoffRole: updated.humanHandoffRole,
            humanTeamRef: updated.humanTeamRef,
            fallbackMessage: updated.fallbackMessage,
            aiMode: updated.aiMode,
            defaultAiProfileName: updated.defaultAiProfile?.name ?? null,
        };
    }

    /**
     * resolveEffectiveAiProfile()
     * Determina qué AI Profile usar para un canal.
     * Prioridad: channel.defaultAiProfileId → WhatsappAgentBinding (legacy fallback)
     */
    static async resolveEffectiveAiProfile(
        channelId: string,
        tenantId: string,
    ): Promise<{ profileId: string | null; handoffKeys: string[]; source: 'channel' | 'binding_legacy' | 'none' }> {
        const channel = await prisma.whatsappChannel.findFirst({
            where: { id: channelId, tenantId },
            select: { aiEnabled: true, aiMode: true, defaultAiProfileId: true },
        });

        if (channel?.aiEnabled && channel.defaultAiProfileId) {
            return {
                profileId: channel.defaultAiProfileId,
                handoffKeys: ['asesor', 'humano', 'agente', 'ayuda'],
                source: 'channel',
            };
        }

        // Legacy fallback: WhatsappAgentBinding
        const binding = await prisma.whatsappAgentBinding.findFirst({
            where: { tenantId, channelId, isActive: true },
            select: { profileId: true, handoffToHumanKeys: true },
        });

        if (binding) {
            return {
                profileId: binding.profileId,
                handoffKeys: binding.handoffToHumanKeys,
                source: 'binding_legacy',
            };
        }

        return { profileId: null, handoffKeys: [], source: 'none' };
    }
}
