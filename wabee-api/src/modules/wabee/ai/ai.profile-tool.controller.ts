import { Request, Response } from 'express';
import { aiToolsService } from './ai.tools.service';
import { GlobalAuditLogService } from '@/modules/audit/global-audit-log.service';
import { getAuditContext } from '@/shared/http/request-audit-context';

export class AiProfileToolController {
    /**
     * GET /v1/ai-tools
     * Lista catálogo de todas las tools del tenant.
     */
    static async getTenantTools(req: Request, res: Response) {
        try {
            const tenantId = (req as any).tenantId;
            const tools = await aiToolsService.getTenantTools(tenantId);
            res.json(tools);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * GET /v1/ai-profiles/:id/tools
     * Lista tools consolidadas para el perfil.
     */
    static async getProfileTools(req: Request, res: Response) {
        try {
            const tenantId = (req as any).tenantId;
            const profileId = req.params.id;
            const tools = await aiToolsService.getProfileToolsConsolidated(tenantId, profileId);
            res.json(tools);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * POST /v1/ai-profiles/:id/tools/:toolId
     * Vincular herramienta a perfil.
     */
    static async linkTool(req: Request, res: Response) {
        const tenantId = (req as any).tenantId;
        const { id: profileId, toolId } = req.params;
        const auditCtx = getAuditContext(req);
        try {
            const result = await aiToolsService.linkToolToProfile(tenantId, profileId, toolId);

            await GlobalAuditLogService.logEvent({
                category: 'ai',
                eventType: 'ai_profile.tool.link',
                severity: 'info',
                outcome: 'success',
                message: `Herramienta vinculada al perfil de IA: ${toolId}`,
                targetType: 'ai_profile',
                targetId: profileId,
                metadata: { toolId }
            }, auditCtx);

            res.status(201).json(result);
        } catch (error: any) {
            await GlobalAuditLogService.logEvent({
                category: 'ai',
                eventType: 'ai_profile.tool.link.failed',
                severity: 'critical',
                outcome: 'failure',
                message: `Error al vincular herramienta ${toolId} al perfil ${profileId}: ${error.message}`,
                targetType: 'ai_profile',
                targetId: profileId
            }, auditCtx);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * DELETE /v1/ai-profiles/:id/tools/:toolId
     * Desvincular herramienta de perfil.
     */
    static async unlinkTool(req: Request, res: Response) {
        const tenantId = (req as any).tenantId;
        const { id: profileId, toolId } = req.params;
        const auditCtx = getAuditContext(req);
        try {
            await aiToolsService.unlinkToolFromProfile(tenantId, profileId, toolId);

            await GlobalAuditLogService.logEvent({
                category: 'ai',
                eventType: 'ai_profile.tool.unlink',
                severity: 'warning',
                outcome: 'success',
                message: `Herramienta desvinculada del perfil de IA: ${toolId}`,
                targetType: 'ai_profile',
                targetId: profileId,
                metadata: { toolId }
            }, auditCtx);

            res.json({ success: true });
        } catch (error: any) {
            await GlobalAuditLogService.logEvent({
                category: 'ai',
                eventType: 'ai_profile.tool.unlink.failed',
                severity: 'critical',
                outcome: 'failure',
                message: `Error al desvincular herramienta ${toolId} del perfil ${profileId}: ${error.message}`,
                targetType: 'ai_profile',
                targetId: profileId
            }, auditCtx);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * PATCH /v1/ai-profiles/:id/tools/:toolId
     * Toggle activación nivel perfil.
     */
    static async toggleProfileTool(req: Request, res: Response) {
        const tenantId = (req as any).tenantId;
        const { id: profileId, toolId } = req.params;
        const { isActive } = req.body;
        const auditCtx = getAuditContext(req);

        if (typeof isActive !== 'boolean') {
            return res.status(400).json({ error: 'isActive must be a boolean' });
        }

        try {
            const result = await aiToolsService.toggleProfileToolStatus(tenantId, profileId, toolId, isActive);

            await GlobalAuditLogService.logEvent({
                category: 'ai',
                eventType: 'ai_profile.tool.toggle',
                severity: 'info',
                outcome: 'success',
                message: `${isActive ? 'Activada' : 'Desactivada'} herramienta ${toolId} en perfil`,
                targetType: 'ai_profile',
                targetId: profileId,
                metadata: { toolId, isActive }
            }, auditCtx);

            res.json(result);
        } catch (error: any) {
            await GlobalAuditLogService.logEvent({
                category: 'ai',
                eventType: 'ai_profile.tool.toggle.failed',
                severity: 'critical',
                outcome: 'failure',
                message: `Error al cambiar estado de herramienta ${toolId} en perfil ${profileId}: ${error.message}`,
                targetType: 'ai_profile',
                targetId: profileId
            }, auditCtx);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * PATCH /v1/ai-tools/:id/status
     * Toggle activación nivel global (tenant).
     */
    static async toggleGlobalTool(req: Request, res: Response) {
        const tenantId = (req as any).tenantId;
        const toolId = req.params.id;
        const { isActive } = req.body;
        const auditCtx = getAuditContext(req);

        if (typeof isActive !== 'boolean') {
            return res.status(400).json({ error: 'isActive must be a boolean' });
        }

        try {
            const result = await aiToolsService.toggleGlobalToolStatus(tenantId, toolId, isActive);

            await GlobalAuditLogService.logEvent({
                category: 'ai',
                eventType: 'ai_profile.tool.toggle_global',
                severity: 'warning',
                outcome: 'success',
                message: `${isActive ? 'Activada' : 'Desactivada'} herramienta ${toolId} a nivel global`,
                metadata: { toolId, isActive }
            }, auditCtx);

            res.json(result);
        } catch (error: any) {
            await GlobalAuditLogService.logEvent({
                category: 'ai',
                eventType: 'ai_profile.tool.toggle_global.failed',
                severity: 'critical',
                outcome: 'failure',
                message: `Error al cambiar estado global de herramienta ${toolId}: ${error.message}`,
                metadata: { toolId, isActive }
            }, auditCtx);
            res.status(500).json({ error: error.message });
        }
    }
}
