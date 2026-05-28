import { Request, Response } from 'express';
import { WhatsAppTemplatesService } from './whatsapp.templates.service';
import { ListTemplatesQuerySchema } from './whatsapp.templates.schemas';
import { tenancyAdapter } from '../../_adapters/tenancy.adapter';
import { GlobalAuditLogService } from '@/modules/audit/global-audit-log.service';
import { getAuditContext } from '@/shared/http/request-audit-context';

export const importTemplates = async (req: Request, res: Response) => {
    const tenantId = tenancyAdapter.getTenantId(req);
    const auditCtx = getAuditContext(req);
    const { channelId } = req.params;

    try {
        // Audit: Sync started
        await GlobalAuditLogService.logEvent({
            category: 'templates',
            eventType: 'template.sync.started',
            severity: 'info',
            outcome: 'success',
            message: `Sincronización de plantillas iniciada para el canal ${channelId}`,
            targetType: 'whatsapp_channel',
            targetId: channelId as string
        }, auditCtx);

        const result = await WhatsAppTemplatesService.importTemplates(tenantId, channelId as string);

        // Audit: Sync success
        await GlobalAuditLogService.logEvent({
            category: 'templates',
            eventType: 'template.sync.success',
            severity: 'success',
            outcome: 'success',
            message: `Sincronización de plantillas completada: ${result.imported} nuevas, ${result.updated} actualizadas`,
            targetType: 'whatsapp_channel',
            targetId: channelId as string,
            metadata: { ...result }
        }, auditCtx);

        return res.json(result);
    } catch (error: any) {
        const status = error.status || 500;
        
        // Audit: Sync failed
        await GlobalAuditLogService.logEvent({
            category: 'templates',
            eventType: 'template.sync.failed',
            severity: 'critical',
            outcome: 'failure',
            message: `Error al sincronizar plantillas: ${error.message || 'Error desconocido'}`,
            targetType: 'whatsapp_channel',
            targetId: channelId as string,
            metadata: { 
                error: error.message,
                detail: error.detail,
                status
            }
        }, auditCtx);

        console.error(`❌ [Templates] Import error:`, error);
        return res.status(status).json({
            error: error.message || 'Internal server error',
            detail: error.detail
        });
    }
};

export const listTemplates = async (req: Request, res: Response) => {
    try {
        const tenantId = tenancyAdapter.getTenantId(req);
        const { channelId } = req.params;

        // Normalize query params to handle possible string[] from Express
        const query = {
            ...req.query,
            status: (Array.isArray(req.query.status) ? req.query.status[0] : req.query.status) as any,
            language: (Array.isArray(req.query.language) ? req.query.language[0] : req.query.language) as any,
            category: (Array.isArray(req.query.category) ? req.query.category[0] : req.query.category) as any,
            q: (Array.isArray(req.query.q) ? req.query.q[0] : req.query.q) as any,
        };

        // Validate query params
        const validation = ListTemplatesQuerySchema.safeParse(query);
        if (!validation.success) {
            return res.status(400).json({ error: validation.error.errors });
        }

        const result = await WhatsAppTemplatesService.listTemplates(
            tenantId,
            channelId as string,
            validation.data as any
        );

        return res.json(result);
    } catch (error: any) {
        const status = error.status || 500;
        console.error(`❌ [Templates] List error:`, error);
        return res.status(status).json({
            error: error.message || 'Internal server error'
        });
    }
};
