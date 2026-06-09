import { Request, Response } from 'express';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignSchema, UpdateCampaignSchema, CampaignOperationSchema } from './campaigns.schemas';
import { tenancyAdapter } from '../_adapters/tenancy.adapter';
import { AuthRequest } from '@/middleware/auth.middleware';
import { coreAdapter } from '@/modules/core/core.adapter';
import { CampaignsAnalyticsService } from './services/campaigns.analytics.service';
import { GlobalAuditLogService } from '@/modules/audit/global-audit-log.service';
import { getAuditContext } from '@/shared/http/request-audit-context';
import { isSuperAdmin } from '@/middleware/auth-role.middleware';

/**
 * Middleware para verificar si el módulo de campañas está habilitado para el tenant.
 */
export const checkCampaignsFeatureFlag = async (req: AuthRequest, res: Response, next: any) => {
    // En una implementación real, esto consultaría a un servicio de Feature Flags.
    // Por ahora, lo dejamos pasar si el tenant existe, o lo vinculamos a un flag de sistema.
    next();
};

/**
 * Middleware genérico para validar roles en el contexto de la organización.
 */
export const requireCampaignRole = (allowedRoles: string[]) => {
    return async (req: AuthRequest, res: Response, next: any) => {
        try {
            // Super Admin global siempre tiene acceso completo (modo suplantación incluido)
            if (isSuperAdmin(req.user)) {
                return next();
            }

            const tenantId = tenancyAdapter.getTenantId(req);
            // En modo suplantación, el userId suplantado es el que tiene la membresía en el tenant
            const userId = req.user?.impersonatedUserId || req.user?.id;

            // Usar el coreAdapter para obtener la membresía — evita acceder a modelos Core directamente
            const membership = await coreAdapter.organizations.getMembership(tenantId, userId);
            const roleName = ((membership as any)?.role?.slug || 'AGENT').toUpperCase();

            // Admin siempre tiene acceso dentro del tenant
            if (roleName === 'ADMIN') {
                return next();
            }

            if (!allowedRoles.includes(roleName)) {
                return res.status(403).json({
                    error: {
                        code: 'FORBIDDEN',
                        message: `Tu rol (${roleName}) no tiene permisos para esta acción.`
                    }
                });
            }

            next();
        } catch (error) {
            console.error('[RBAC] Error validando rol:', error);
            res.status(500).json({ error: { code: 'RBAC_ERROR', message: 'Error validando permisos.' } });
        }
    };
};

export class CampaignsController {
    static async list(req: AuthRequest, res: Response) {
        try {
            const tenantId = tenancyAdapter.getTenantId(req);
            const campaigns = await CampaignsService.getCampaigns(tenantId);
            res.json(campaigns);
        } catch (error: any) {
            res.status(error.status || 500).json({
                code: error.code || 'LIST_ERROR',
                message: error.message || 'Error al listar campañas'
            });
        }
    }


    static async getDetail(req: AuthRequest, res: Response) {
        try {
            const tenantId = tenancyAdapter.getTenantId(req);
            const campaign = await CampaignsService.getCampaignById(tenantId, req.params.id);
            res.json(campaign);
        } catch (error: any) {
            res.status(error.status || 500).json({
                code: error.code || 'GET_ERROR',
                message: error.message || 'Error al obtener detalle de campaña'
            });
        }
    }


    static async create(req: AuthRequest, res: Response) {
        const auditCtx = getAuditContext(req);
        try {
            const tenantId = tenancyAdapter.getTenantId(req);
            const actorUserId = req.user.id;
            const validation = CreateCampaignSchema.safeParse(req.body);
            if (!validation.success) return res.status(400).json({ error: validation.error.format() });

            const campaign = await CampaignsService.createCampaign(tenantId, actorUserId, validation.data);
            
            await GlobalAuditLogService.logEvent({
                category: 'campaigns',
                eventType: 'campaign.create',
                severity: 'success',
                outcome: 'success',
                message: `Campaña creada: ${campaign.name}`,
                targetType: 'campaign',
                targetId: campaign.id,
                newValues: validation.data
            }, auditCtx);

            res.status(201).json(campaign);
        } catch (error: any) {
            await GlobalAuditLogService.logEvent({
                category: 'campaigns',
                eventType: 'campaign.create.failed',
                severity: 'critical',
                outcome: 'failure',
                message: `Error al crear campaña: ${error.message}`,
                metadata: { body: req.body, error: error.message }
            }, auditCtx);
            res.status(error.status || 500).json({
                code: error.code || 'CREATE_ERROR',
                message: error.message || 'Error al crear campaña'
            });
        }
    }


    static async update(req: AuthRequest, res: Response) {
        const auditCtx = getAuditContext(req);
        try {
            const tenantId = tenancyAdapter.getTenantId(req);
            const actorUserId = req.user.id;
            const validation = UpdateCampaignSchema.safeParse(req.body);
            if (!validation.success) return res.status(400).json({ error: validation.error.format() });

            const campaign = await CampaignsService.updateCampaign(tenantId, actorUserId, req.params.id, validation.data);
            
            await GlobalAuditLogService.logEvent({
                category: 'campaigns',
                eventType: 'campaign.update',
                severity: 'info',
                outcome: 'success',
                message: `Configuración de campaña actualizada: ${campaign.name}`,
                targetType: 'campaign',
                targetId: campaign.id,
                newValues: validation.data
            }, auditCtx);

            res.json(campaign);
        } catch (error: any) {
            console.error('[CampaignsController] Update Error:', error);
            await GlobalAuditLogService.logEvent({
                category: 'campaigns',
                eventType: 'campaign.update.failed',
                severity: 'critical',
                outcome: 'failure',
                message: `Error al actualizar campaña (${req.params.id}): ${error.message}`,
                targetType: 'campaign',
                targetId: req.params.id,
                metadata: { body: req.body, error: error.message }
            }, auditCtx);
            res.status(error.status || 500).json({
                code: error.code || 'UPDATE_ERROR',
                message: error.message || 'Error al actualizar campaña',
                details: error.details || error.toString() // Ver más info en frontend si es posible
            });
        }

    }

    static async operate(req: AuthRequest, res: Response) {
        const auditCtx = getAuditContext(req);
        try {
            const tenantId = tenancyAdapter.getTenantId(req);
            const actorUserId = req.user.id;
            const validation = CampaignOperationSchema.safeParse(req.body);
            if (!validation.success) return res.status(400).json({ error: validation.error.format() });

            const { action, pauseReason } = validation.data;
            const id = req.params.id;

            let result;
            let verb = '';
            switch (action) {
                case 'START':
                case 'RESUME':
                    result = await CampaignsService.startCampaign(tenantId, actorUserId, id);
                    verb = action === 'START' ? 'iniciada' : 'reanudada';
                    break;
                case 'PAUSE':
                    result = await CampaignsService.pauseCampaign(tenantId, actorUserId, id, pauseReason);
                    verb = 'pausada';
                    break;
                case 'CANCEL':
                    result = await CampaignsService.cancelCampaign(tenantId, actorUserId, id);
                    verb = 'cancelada';
                    break;
            }

            await GlobalAuditLogService.logEvent({
                category: 'campaigns',
                eventType: `campaign.operate.${action.toLowerCase()}`,
                severity: action === 'CANCEL' ? 'warning' : 'info',
                outcome: 'success',
                message: `Campaña ${verb}`,
                targetType: 'campaign',
                targetId: id,
                metadata: { action, pauseReason }
            }, auditCtx);

            res.json({ success: true, result });
        } catch (error: any) {
            const id = req.params.id;
            const action = req.body.action || 'UNKNOWN';
            await GlobalAuditLogService.logEvent({
                category: 'campaigns',
                eventType: `campaign.operate.${action.toLowerCase()}.failed`,
                severity: 'critical',
                outcome: 'failure',
                message: `Error al operar campaña (${action}): ${error.message}`,
                targetType: 'campaign',
                targetId: id,
                metadata: { action, error: error.message }
            }, auditCtx);
            res.status(error.status || 500).json({
                code: error.code || 'OPERATE_ERROR',
                message: error.message || 'Error al operar campaña'
            });
        }
    }


    static async delete(req: AuthRequest, res: Response) {
        const auditCtx = getAuditContext(req);
        try {
            const tenantId = tenancyAdapter.getTenantId(req);
            const actorUserId = req.user.id;
            const id = req.params.id;

            const result = await CampaignsService.deleteCampaign(tenantId, actorUserId, id);
            
            await GlobalAuditLogService.logEvent({
                category: 'campaigns',
                eventType: 'campaign.delete',
                severity: 'warning',
                outcome: 'success',
                message: `Campaña en borrador eliminada: ${id}`,
                targetType: 'campaign',
                targetId: id
            }, auditCtx);

            res.json(result);
        } catch (error: any) {
            await GlobalAuditLogService.logEvent({
                category: 'campaigns',
                eventType: 'campaign.delete.failed',
                severity: 'critical',
                outcome: 'failure',
                message: `Error al eliminar campaña (${req.params.id}): ${error.message}`,
                targetType: 'campaign',
                targetId: req.params.id,
                metadata: { error: error.message }
            }, auditCtx);
            res.status(error.status || 500).json({
                code: error.code || 'DELETE_ERROR',
                message: error.message || 'Error al eliminar campaña'
            });
        }
    }

    static async listErrors(req: AuthRequest, res: Response) {
        try {
            const tenantId = tenancyAdapter.getTenantId(req);
            const errors = await CampaignsService.getCampaignErrors(tenantId, req.params.id);
            res.json(errors);
        } catch (error: any) {
            res.status(error.status || 500).json({
                code: error.code || 'LIST_ERRORS_ERROR',
                message: error.message || 'Error al listar errores de campaña'
            });
        }
    }


    static async getMetrics(req: AuthRequest, res: Response) {
        try {
            const tenantId = tenancyAdapter.getTenantId(req);
            const metrics = await CampaignsService.getCampaignMetrics(tenantId, req.params.id);
            res.json(metrics);
        } catch (error: any) {
            res.status(error.status || 500).json({
                code: error.code || 'METRICS_ERROR',
                message: error.message || 'Error al obtener métricas'
            });
        }
    }

    static async getAnalyticsSummary(req: AuthRequest, res: Response) {
        try {
            const tenantId = tenancyAdapter.getTenantId(req);
            const summary = await CampaignsAnalyticsService.getSummary(tenantId, req.params.id);
            res.json(summary);
        } catch (error: any) {
            res.status(error.status || 500).json({ code: 'ANALYTICS_SUMMARY_ERROR', message: error.message });
        }
    }

    static async getAnalyticsTimeSeries(req: AuthRequest, res: Response) {
        try {
            const tenantId = tenancyAdapter.getTenantId(req);
            const period = req.query.period as string;
            const data = await CampaignsAnalyticsService.getTimeSeries(tenantId, req.params.id, period);
            res.json(data);
        } catch (error: any) {
            res.status(error.status || 500).json({ code: 'ANALYTICS_TIMESERIES_ERROR', message: error.message });
        }
    }

    static async getAnalyticsFunnel(req: AuthRequest, res: Response) {
        try {
            const tenantId = tenancyAdapter.getTenantId(req);
            const data = await CampaignsAnalyticsService.getFunnel(tenantId, req.params.id);
            res.json(data);
        } catch (error: any) {
            res.status(error.status || 500).json({ code: 'ANALYTICS_FUNNEL_ERROR', message: error.message });
        }
    }

    static async getAnalyticsErrors(req: AuthRequest, res: Response) {
        try {
            const tenantId = tenancyAdapter.getTenantId(req);
            const data = await CampaignsAnalyticsService.getErrors(tenantId, req.params.id);
            res.json(data);
        } catch (error: any) {
            res.status(error.status || 500).json({ code: 'ANALYTICS_ERRORS_ERROR', message: error.message });
        }
    }

    static async getAnalyticsRecipients(req: AuthRequest, res: Response) {
        try {
            const tenantId = tenancyAdapter.getTenantId(req);
            const page = Number(req.query.page) || 1;
            const limit = Number(req.query.limit) || 50;
            const data = await CampaignsAnalyticsService.getRecipients(tenantId, req.params.id, page, limit);
            res.json(data);
        } catch (error: any) {
            res.status(error.status || 500).json({ code: 'ANALYTICS_RECIPIENTS_ERROR', message: error.message });
        }
    }
}
