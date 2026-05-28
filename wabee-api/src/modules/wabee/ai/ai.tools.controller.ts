import { Request, Response } from 'express';
import { aiToolsService } from './ai.tools.service';
import { toolExecutorService } from './tools/tool.executor.service';
import { GlobalAuditLogService } from '@/modules/audit/global-audit-log.service';
import { getAuditContext } from '@/shared/http/request-audit-context';

export class AiToolsController {
    static async getTools(req: Request, res: Response) {
        try {
            const tenantId = (req as any).tenantId;
            const data = await aiToolsService.getTenantTools(tenantId);
            res.json(data);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    static async getTool(req: Request, res: Response) {
        try {
            const tenantId = (req as any).tenantId;
            const data = await aiToolsService.getToolById(tenantId, req.params.id);
            res.json(data);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    static async createTool(req: Request, res: Response) {
        const tenantId = (req as any).tenantId;
        const auditCtx = getAuditContext(req);
        try {
            const data = await aiToolsService.createTool(tenantId, req.body);
            
            await GlobalAuditLogService.logEvent({
                category: 'integrations',
                eventType: 'tool.create',
                severity: 'success',
                outcome: 'success',
                message: `Herramienta de IA creada: ${data.name}`,
                targetType: 'ai_tool',
                targetId: data.id,
                newValues: req.body
            }, auditCtx);

            (req as any)._parsedResponse = data;
            res.status(201).json(data);
        } catch (error: any) {
            await GlobalAuditLogService.logEvent({
                category: 'integrations',
                eventType: 'tool.create.failed',
                severity: 'critical',
                outcome: 'failure',
                message: `Fallo al crear herramienta: ${error.message}`,
                metadata: { body: req.body, error: error.message }
            }, auditCtx);
            res.status(400).json({ error: error.message });
        }
    }

    static async updateTool(req: Request, res: Response) {
        const tenantId = (req as any).tenantId;
        const id = req.params.id;
        const auditCtx = getAuditContext(req);
        try {
            const data = await aiToolsService.updateTool(tenantId, id, req.body);

            await GlobalAuditLogService.logEvent({
                category: 'integrations',
                eventType: 'tool.update',
                severity: 'success',
                outcome: 'success',
                message: `Herramienta de IA actualizada: ${data.name}`,
                targetType: 'ai_tool',
                targetId: id,
                newValues: req.body
            }, auditCtx);

            (req as any)._parsedResponse = data;
            res.json(data);
        } catch (error: any) {
            await GlobalAuditLogService.logEvent({
                category: 'integrations',
                eventType: 'tool.update.failed',
                severity: 'critical',
                outcome: 'failure',
                message: `Fallo al actualizar herramienta (${id}): ${error.message}`,
                targetType: 'ai_tool',
                targetId: id,
                metadata: { body: req.body, error: error.message }
            }, auditCtx);
            res.status(400).json({ error: error.message });
        }
    }

    static async deleteTool(req: Request, res: Response) {
        const tenantId = (req as any).tenantId;
        const id = req.params.id;
        const auditCtx = getAuditContext(req);
        try {
            await aiToolsService.deleteTool(tenantId, id);

            await GlobalAuditLogService.logEvent({
                category: 'integrations',
                eventType: 'tool.delete',
                severity: 'warning',
                outcome: 'success',
                message: `Herramienta de IA eliminada: ${id}`,
                targetType: 'ai_tool',
                targetId: id
            }, auditCtx);

            res.json({ success: true });
        } catch (error: any) {
            await GlobalAuditLogService.logEvent({
                category: 'integrations',
                eventType: 'tool.delete.failed',
                severity: 'critical',
                outcome: 'failure',
                message: `Fallo al eliminar herramienta (${id}): ${error.message}`,
                targetType: 'ai_tool',
                targetId: id
            }, auditCtx);
            res.status(400).json({ error: error.message });
        }
    }

    /**
     * Permite probar una tool sin depender del LLM
     */
    static async testTool(req: Request, res: Response) {
        const tenantId = (req as any).tenantId;
        const toolId = req.params.id;
        const payload = req.body;
        const auditCtx = getAuditContext(req);
        try {
            if (!toolId) {
                return res.status(400).json({ error: 'toolId is required' });
            }

            // Validar que la tool existe y es del tenant
            const tool = await aiToolsService.getToolById(tenantId, toolId);

            const executorResult = await toolExecutorService.execute({
                toolId,
                tenantId,
                payload: payload || {}
            });

            await GlobalAuditLogService.logEvent({
                category: 'integrations',
                eventType: 'tool.test',
                severity: executorResult.success ? 'success' : 'warning',
                outcome: executorResult.success ? 'success' : 'failure',
                message: `Prueba de herramienta ejecutada: ${tool.name}`,
                targetType: 'ai_tool',
                targetId: toolId,
                metadata: { 
                    payload, 
                    success: executorResult.success,
                    result: executorResult.output || executorResult.error
                }
            }, auditCtx);

            res.json(executorResult);
        } catch (error: any) {
            await GlobalAuditLogService.logEvent({
                category: 'integrations',
                eventType: 'tool.test.failed',
                severity: 'critical',
                outcome: 'failure',
                message: `Error fatal al probar herramienta (${toolId}): ${error.message}`,
                targetType: 'ai_tool',
                targetId: toolId,
                metadata: { payload, error: error.message }
            }, auditCtx);
            res.status(400).json({ error: error.message });
        }
    }
}
