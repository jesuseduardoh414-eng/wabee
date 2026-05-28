import { Request, Response } from 'express';
import { aiIntegrationService } from './ai.integration.service';
import { GlobalAuditLogService } from '@/modules/audit/global-audit-log.service';
import { getAuditContext } from '@/shared/http/request-audit-context';

const sanitizeSecrets = (obj: any) => {
    if (!obj || typeof obj !== 'object') return obj;
    const sanitized = { ...obj };
    const sensitiveKeys = ['credentials', 'secret', 'token', 'password', 'apiKey', 'accessToken'];
    sensitiveKeys.forEach(key => {
        if (key in sanitized) sanitized[key] = '[REDACTED]';
    });
    return sanitized;
};

export class AiIntegrationController {
    static async getIntegrations(req: Request, res: Response) {
        try {
            const tenantId = (req as any).tenantId;
            const data = await aiIntegrationService.getTenantIntegrations(tenantId);
            res.json(data);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    static async getIntegration(req: Request, res: Response) {
        try {
            const tenantId = (req as any).tenantId;
            const data = await aiIntegrationService.getIntegrationById(tenantId, req.params.id);
            res.json(data);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    static async createIntegration(req: Request, res: Response) {
        const tenantId = (req as any).tenantId;
        const auditCtx = getAuditContext(req);
        try {
            const data = await aiIntegrationService.createIntegration(tenantId, req.body);
            
            await GlobalAuditLogService.logEvent({
                category: 'integrations',
                eventType: 'integration.create',
                severity: 'success',
                outcome: 'success',
                message: `Integración creada: ${data.name}`,
                targetType: 'integration',
                targetId: data.id,
                newValues: sanitizeSecrets(req.body)
            }, auditCtx);

            (req as any)._parsedResponse = data;
            res.status(201).json(data);
        } catch (error: any) {
            await GlobalAuditLogService.logEvent({
                category: 'integrations',
                eventType: 'integration.create.failed',
                severity: 'critical',
                outcome: 'failure',
                message: `Fallo al crear integración: ${error.message}`,
                metadata: { body: sanitizeSecrets(req.body), error: error.message }
            }, auditCtx);
            res.status(400).json({ error: error.message });
        }
    }

    static async updateIntegration(req: Request, res: Response) {
        const tenantId = (req as any).tenantId;
        const id = req.params.id;
        const auditCtx = getAuditContext(req);
        try {
            const data = await aiIntegrationService.updateIntegration(tenantId, id, req.body);

            await GlobalAuditLogService.logEvent({
                category: 'integrations',
                eventType: 'integration.update',
                severity: 'success',
                outcome: 'success',
                message: `Integración actualizada: ${data.name}`,
                targetType: 'integration',
                targetId: id,
                newValues: sanitizeSecrets(req.body)
            }, auditCtx);

            (req as any)._parsedResponse = data;
            res.json(data);
        } catch (error: any) {
            await GlobalAuditLogService.logEvent({
                category: 'integrations',
                eventType: 'integration.update.failed',
                severity: 'critical',
                outcome: 'failure',
                message: `Fallo al actualizar integración (${id}): ${error.message}`,
                targetType: 'integration',
                targetId: id,
                metadata: { body: sanitizeSecrets(req.body), error: error.message }
            }, auditCtx);
            res.status(400).json({ error: error.message });
        }
    }

    static async deleteIntegration(req: Request, res: Response) {
        const tenantId = (req as any).tenantId;
        const id = req.params.id;
        const auditCtx = getAuditContext(req);
        try {
            await aiIntegrationService.deleteIntegration(tenantId, id);

            await GlobalAuditLogService.logEvent({
                category: 'integrations',
                eventType: 'integration.delete',
                severity: 'warning',
                outcome: 'success',
                message: `Integración eliminada: ${id}`,
                targetType: 'integration',
                targetId: id
            }, auditCtx);

            res.json({ success: true });
        } catch (error: any) {
            await GlobalAuditLogService.logEvent({
                category: 'integrations',
                eventType: 'integration.delete.failed',
                severity: 'critical',
                outcome: 'failure',
                message: `Fallo al eliminar integración (${id}): ${error.message}`,
                targetType: 'integration',
                targetId: id
            }, auditCtx);
            res.status(400).json({ error: error.message });
        }
    }
}
