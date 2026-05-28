import { NotificationService, WabeeNotificationType } from '@/modules/wabee/notifications/notifications.service';
import { coreAdapter } from '@/modules/core/core.adapter';
import { AuditService, CreateAuditLogInput } from '@/modules/wabee/audit/audit.service';

function isUuid(value: string | null | undefined): boolean {
    if (!value) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export type CampaignAction =
    | 'CAMPAIGN_CREATED'
    | 'CAMPAIGN_UPDATED'
    | 'CAMPAIGN_DELETED'
    | 'CAMPAIGN_SCHEDULED'
    | 'CAMPAIGN_STARTED'
    | 'CAMPAIGN_AUTO_STARTED'
    | 'CAMPAIGN_PAUSED'
    | 'CAMPAIGN_CANCELED'
    | 'CAMPAIGN_COMPLETED'
    | 'CAMPAIGN_FAILED'
    | 'CAMPAIGN_PARTIAL_FAILURE';

export interface LogCampaignEventParams {
    tenantId: string;
    actorUserId?: string | null;
    campaignId: string;
    campaignName: string;
    action: CampaignAction;
    metadata?: Record<string, any>;
}

export class CampaignEventsService {
    /**
     * Wrapper principal para registrar un evento de campaña (Notificación + Auditoría)
     */
    static async logCampaignEvent(params: LogCampaignEventParams) {
        // 1. Verificar idempotencia para evitar duplicados en un margen de 1 minuto
        const isDuplicate = await this.isDuplicateEvent(params);
        if (isDuplicate) {
            console.log(`[CampaignEventsService] Ignorando evento duplicado: ${params.action} para campaña ${params.campaignId}`);
            return;
        }

        const results = await Promise.allSettled([
            this.auditCampaignEvent(params),
            this.notifyCampaignEvent(params)
        ]);

        const [auditResult, notifyResult] = results;

        if (auditResult.status === 'rejected') {
            console.error(`[CampaignEventsService] ERROR CRÍTICO al auditar ${params.action} en campaña ${params.campaignId}:`, auditResult.reason);
        } else {
            console.log(`[CampaignEventsService] Auditoría exitosa: ${params.action}`);
        }

        if (notifyResult.status === 'rejected') {
            console.error(`[CampaignEventsService] Error en Notificación para ${params.action}:`, notifyResult.reason);
        }
    }

    private static async isDuplicateEvent(params: LogCampaignEventParams): Promise<boolean> {
        try {
            const thresholdDate = new Date(Date.now() - 60000); // 1 minuto

            const recentAudit = await coreAdapter.system.findFirstAuditLog({
                tenantId: params.tenantId,
                modelType: 'campaign',
                modelId: params.campaignId,
                action: params.action,
                createdAt: { gte: thresholdDate },
            });

            return !!recentAudit;
        } catch (error) {
            console.error('[CampaignEventsService] Error checking duplicate event:', error);
            return false; // En caso de duda, permitimos continuar
        }
    }

    /**
     * Registra en Auditoría de manera aislada
     */
    static async auditCampaignEvent(params: LogCampaignEventParams) {
        let finalUserId = params.actorUserId || null;
        if (finalUserId && !isUuid(finalUserId)) {
            console.warn(`[CampaignEventsService] actorUserId no es UUID válido: ${finalUserId}. Se usará null.`);
            finalUserId = null;
        }

        const newValues: Record<string, any> = { ...params.metadata };
        if (!finalUserId) {
            newValues.actorType = 'system';
        }

        const auditInput: CreateAuditLogInput = {
            tenantId: params.tenantId,
            userId: finalUserId,
            action: params.action,
            modelType: 'campaign',
            modelId: params.campaignId,
            description: `Evento de campaña: ${params.action} - ${params.campaignName}`,
            newValues,
        };

        try {
            await AuditService.log(auditInput);
        } catch (error) {
            console.error('[CampaignEventsService] Error en auditCampaignEvent:', error);
            throw error; // Propagar error a Promise.allSettled
        }
    }

    /**
     * Crea Notificaciones para los Admins de forma aislada
     */
    static async notifyCampaignEvent(params: LogCampaignEventParams) {
        let severity: 'info' | 'warning' | 'critical' = 'info';

        switch (params.action) {
            case 'CAMPAIGN_CREATED':
            case 'CAMPAIGN_UPDATED':
            case 'CAMPAIGN_SCHEDULED':
            case 'CAMPAIGN_STARTED':
            case 'CAMPAIGN_AUTO_STARTED':
            case 'CAMPAIGN_COMPLETED':
                severity = 'info';
                break;
            case 'CAMPAIGN_PAUSED':
            case 'CAMPAIGN_CANCELED':
            case 'CAMPAIGN_PARTIAL_FAILURE':
                severity = 'warning';
                break;
            case 'CAMPAIGN_FAILED':
                severity = 'critical';
                break;
        }

        const titleMap: Record<CampaignAction, string> = {
            CAMPAIGN_CREATED: 'Campaña creada',
            CAMPAIGN_UPDATED: 'Campaña actualizada',
            CAMPAIGN_DELETED: 'Campaña eliminada',
            CAMPAIGN_SCHEDULED: 'Campaña programada',
            CAMPAIGN_STARTED: 'Campaña iniciada',
            CAMPAIGN_AUTO_STARTED: 'Campaña iniciada automáticamente',
            CAMPAIGN_PAUSED: 'Campaña pausada',
            CAMPAIGN_CANCELED: 'Campaña cancelada',
            CAMPAIGN_COMPLETED: 'Campaña completada',
            CAMPAIGN_FAILED: 'Campaña fallida',
            CAMPAIGN_PARTIAL_FAILURE: 'Campaña completada con errores',
        };

        const scheduledDate = params.metadata?.scheduledAt ? new Date(params.metadata.scheduledAt).toLocaleString() : '';
        const messageMap: Record<CampaignAction, string> = {
            CAMPAIGN_CREATED: `La campaña '${params.campaignName}' fue creada correctamente.`,
            CAMPAIGN_UPDATED: `La campaña '${params.campaignName}' fue actualizada.`,
            CAMPAIGN_DELETED: `La campaña '${params.campaignName}' fue eliminada.`,
            CAMPAIGN_SCHEDULED: `La campaña '${params.campaignName}' se programó para ${scheduledDate}.`,
            CAMPAIGN_STARTED: `La campaña '${params.campaignName}' ha comenzado a enviarse.`,
            CAMPAIGN_AUTO_STARTED: `La campaña '${params.campaignName}' se inició automáticamente según su programación.`,
            CAMPAIGN_PAUSED: `La campaña '${params.campaignName}' ha sido pausada.`,
            CAMPAIGN_CANCELED: `La campaña '${params.campaignName}' ha sido cancelada.`,
            CAMPAIGN_COMPLETED: `La campaña '${params.campaignName}' finalizó con éxito.`,
            CAMPAIGN_FAILED: `La campaña '${params.campaignName}' presentó errores críticos durante el envío.`,
            CAMPAIGN_PARTIAL_FAILURE: `La campaña '${params.campaignName}' finalizó, pero algunos mensajes no pudieron enviarse.`,
        };

        try {
            await NotificationService.notifyAdmins(params.tenantId, {
                type: WabeeNotificationType.CAMPAIGN_ALERT,
                severity,
                title: titleMap[params.action] || 'Alerta de Campaña',
                message: messageMap[params.action] || `Evento ${params.action} en la campaña '${params.campaignName}'.`,
                relatedEntityId: params.campaignId,
            });
        } catch (error) {
            console.error('[CampaignEventsService] Error en notifyCampaignEvent:', error);
        }
    }
}
