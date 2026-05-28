import { Request, Response } from 'express';
import { aiProfilesService } from './ai.profiles.service';
import { aiAuditService } from './ai.audit.service';
import { AiAuditQuerySchema, AiPauseThreadSchema } from './ai.schemas';
import { GlobalAuditLogService } from '@/modules/audit/global-audit-log.service';
import { getAuditContext } from '@/shared/http/request-audit-context';

export class AiProfilesController {

    /**
     * GET /api/v1/ai-profiles
     */
    static async getProfiles(req: Request, res: Response) {
        try {
            const tenantId = (req as any).tenantId;
            const profiles = await aiProfilesService.getProfiles(tenantId);
            res.json(profiles);
        } catch (error: any) {
            res.status(error.status || 500).json({ error: error.message });
        }
    }

    /**
     * GET /api/v1/ai-profiles/:id
     */
    static async getProfile(req: Request, res: Response) {
        try {
            const tenantId = (req as any).tenantId;
            const id = req.params.id as string;
            const profile = await aiProfilesService.getProfileById(tenantId, id);
            res.json(profile);
        } catch (error: any) {
            res.status(error.status || 500).json({ error: error.message });
        }
    }

    /**
     * POST /api/v1/ai-profiles
     */
    static async createProfile(req: Request, res: Response) {
        const tenantId = (req as any).tenantId;
        const auditCtx = getAuditContext(req);
        try {
            const profile = await aiProfilesService.createProfile(tenantId, req.body);

            await GlobalAuditLogService.logEvent({
                category: 'ai',
                eventType: 'ai_profile.create',
                severity: 'success',
                outcome: 'success',
                message: `Perfil de IA creado: ${profile.name}`,
                targetType: 'ai_profile',
                targetId: profile.id,
                newValues: req.body
            }, auditCtx);

            res.status(201).json(profile);
        } catch (error: any) {
            await GlobalAuditLogService.logEvent({
                category: 'ai',
                eventType: 'ai_profile.create.failed',
                severity: 'critical',
                outcome: 'failure',
                message: `Error al crear perfil de IA: ${error.message}`,
                metadata: { body: req.body, error: error.message }
            }, auditCtx);
            res.status(error.status || 400).json({ error: error.message });
        }
    }

    /**
     * PUT /api/v1/ai-profiles/:id
     */
    static async updateProfile(req: Request, res: Response) {
        const tenantId = (req as any).tenantId;
        const id = req.params.id as string;
        const auditCtx = getAuditContext(req);
        try {
            const profile = await aiProfilesService.updateProfile(tenantId, id, req.body);

            await GlobalAuditLogService.logEvent({
                category: 'ai',
                eventType: 'ai_profile.update',
                severity: 'success',
                outcome: 'success',
                message: `Perfil de IA actualizado: ${profile.name}`,
                targetType: 'ai_profile',
                targetId: id,
                newValues: req.body
            }, auditCtx);

            res.json(profile);
        } catch (error: any) {
            await GlobalAuditLogService.logEvent({
                category: 'ai',
                eventType: 'ai_profile.update.failed',
                severity: 'critical',
                outcome: 'failure',
                message: `Error al actualizar perfil de IA (${id}): ${error.message}`,
                targetType: 'ai_profile',
                targetId: id,
                metadata: { body: req.body, error: error.message }
            }, auditCtx);
            res.status(error.status || 400).json({ error: error.message });
        }
    }

    /**
     * DELETE /api/v1/ai-profiles/:id
     */
    static async deleteProfile(req: Request, res: Response) {
        const tenantId = (req as any).tenantId;
        const id = req.params.id as string;
        const auditCtx = getAuditContext(req);
        try {
            const result = await aiProfilesService.deleteProfile(tenantId, id);

            await GlobalAuditLogService.logEvent({
                category: 'ai',
                eventType: 'ai_profile.delete',
                severity: 'warning',
                outcome: 'success',
                message: `Perfil de IA eliminado: ${id}`,
                targetType: 'ai_profile',
                targetId: id
            }, auditCtx);

            res.json(result);
        } catch (error: any) {
            await GlobalAuditLogService.logEvent({
                category: 'ai',
                eventType: 'ai_profile.delete.failed',
                severity: 'critical',
                outcome: 'failure',
                message: `Error al eliminar perfil de IA (${id}): ${error.message}`,
                targetType: 'ai_profile',
                targetId: id
            }, auditCtx);
            res.status(error.status || 500).json({ error: error.message });
        }
    }

    /**
     * POST /api/v1/webwidgets/:widgetId/threads/:threadId/ai/pause
     */
    static async pauseThreadAI(req: Request, res: Response) {
        const tenantId = (req as any).tenantId;
        const widgetId = req.params.widgetId as string;
        const threadId = req.params.threadId as string;
        const auditCtx = getAuditContext(req);
        try {
            const body = req.body as any;
            const { userId } = AiPauseThreadSchema.parse(body);

            const thread = await aiProfilesService.pauseThreadAI(tenantId, widgetId, threadId, userId);

            await GlobalAuditLogService.logEvent({
                category: 'ai',
                eventType: 'ai_profile.chat.pause',
                severity: 'info',
                outcome: 'success',
                message: `Intervención humana: IA pausada en chat ${threadId}`,
                targetType: 'chat_thread',
                targetId: threadId,
                metadata: { widgetId, userId }
            }, auditCtx);

            res.json(thread);
        } catch (error: any) {
            await GlobalAuditLogService.logEvent({
                category: 'ai',
                eventType: 'ai_profile.chat.pause.failed',
                severity: 'critical',
                outcome: 'failure',
                message: `Error al pausar IA en chat ${threadId}: ${error.message}`,
                targetType: 'chat_thread',
                targetId: threadId
            }, auditCtx);
            res.status(error.status || 400).json({ error: error.message });
        }
    }

    /**
     * POST /api/v1/webwidgets/:widgetId/threads/:threadId/ai/resume
     */
    static async resumeThreadAI(req: Request, res: Response) {
        const tenantId = (req as any).tenantId;
        const widgetId = req.params.widgetId as string;
        const threadId = req.params.threadId as string;
        const auditCtx = getAuditContext(req);
        try {
            const thread = await aiProfilesService.resumeThreadAI(tenantId, widgetId, threadId);

            await GlobalAuditLogService.logEvent({
                category: 'ai',
                eventType: 'ai_profile.chat.resume',
                severity: 'info',
                outcome: 'success',
                message: `IA reactivada en chat ${threadId}`,
                targetType: 'chat_thread',
                targetId: threadId,
                metadata: { widgetId }
            }, auditCtx);

            res.json(thread);
        } catch (error: any) {
            await GlobalAuditLogService.logEvent({
                category: 'ai',
                eventType: 'ai_profile.chat.resume.failed',
                severity: 'critical',
                outcome: 'failure',
                message: `Error al reactivar IA en chat ${threadId}: ${error.message}`,
                targetType: 'chat_thread',
                targetId: threadId
            }, auditCtx);
            res.status(error.status || 500).json({ error: error.message });
        }
    }

    /**
     * GET /api/v1/ai-audit
     */
    static async getAuditLogs(req: Request, res: Response) {
        try {
            const tenantId = (req as any).tenantId;
            const query = AiAuditQuerySchema.parse(req.query) as any;

            const result = await aiAuditService.queryLogs({
                tenantId,
                widgetId: query.widgetId,
                threadId: query.threadId,
                page: query.page,
                limit: query.limit,
            });

            res.json(result);
        } catch (error: any) {
            res.status(error.status || 400).json({ error: error.message });
        }
    }

    // === KNOWLEDGE BASE (KB) ===

    /**
     * GET /api/v1/ai-profiles/:id/kb/files
     */
    static async getKbFiles(req: Request, res: Response) {
        try {
            const tenantId = (req as any).tenantId;
            const profileId = req.params.id as string;
            const files = await aiProfilesService.getKbFiles(tenantId, profileId);
            res.json(files);
        } catch (error: any) {
            res.status(error.status || 500).json({ error: error.message });
        }
    }

    /**
     * POST /api/v1/ai-profiles/:id/kb/files
     */
    static async uploadKbFile(req: Request, res: Response) {
        const tenantId = (req as any).tenantId;
        const profileId = req.params.id as string;
        const auditCtx = getAuditContext(req);
        console.log(`[uploadKbFile] tenantId=${tenantId} profileId=${profileId} file=${req.file?.originalname} mime=${req.file?.mimetype} size=${req.file?.size}`);
        try {
            const file = req.file;

            if (!file) {
                console.log('[uploadKbFile] No file in req.file — returning 400');
                return res.status(400).json({ error: 'No file uploaded' });
            }

            const kbFile = await aiProfilesService.uploadKbFile({
                tenantId,
                profileId,
                file: file as any
            });

            await GlobalAuditLogService.logEvent({
                category: 'ai',
                eventType: 'ai_profile.kb.upload',
                severity: 'success',
                outcome: 'success',
                message: `Archivo añadido a la base de conocimientos: ${kbFile.filename}`,
                targetType: 'ai_profile',
                targetId: profileId,
                metadata: { fileId: kbFile.id, fileName: kbFile.filename }
            }, auditCtx);

            res.status(201).json(kbFile);
        } catch (error: any) {
            console.error(`[uploadKbFile] ERROR: status=${error.status} message=${error.message}`, error.stack || '');
            await GlobalAuditLogService.logEvent({
                category: 'ai',
                eventType: 'ai_profile.kb.upload.failed',
                severity: 'critical',
                outcome: 'failure',
                message: `Error al subir archivo a KB (${profileId}): ${error.message}`,
                targetType: 'ai_profile',
                targetId: profileId
            }, auditCtx);
            res.status(error.status || 400).json({ error: error.message });
        }
    }

    /**
     * DELETE /api/v1/ai-profiles/:id/kb/files/:fileId
     */
    static async deleteKbFile(req: Request, res: Response) {
        const tenantId = (req as any).tenantId;
        const profileId = req.params.id as string;
        const fileId = req.params.fileId as string;
        const auditCtx = getAuditContext(req);
        try {
            const result = await aiProfilesService.deleteKbFile(tenantId, profileId, fileId);

            await GlobalAuditLogService.logEvent({
                category: 'ai',
                eventType: 'ai_profile.kb.delete',
                severity: 'warning',
                outcome: 'success',
                message: `Archivo eliminado de la base de conocimientos: ${fileId}`,
                targetType: 'ai_profile',
                targetId: profileId,
                metadata: { fileId }
            }, auditCtx);

            res.json(result);
        } catch (error: any) {
            await GlobalAuditLogService.logEvent({
                category: 'ai',
                eventType: 'ai_profile.kb.delete.failed',
                severity: 'critical',
                outcome: 'failure',
                message: `Error al eliminar archivo KB (${fileId}): ${error.message}`,
                targetType: 'ai_profile',
                targetId: profileId
            }, auditCtx);
            res.status(error.status || 500).json({ error: error.message });
        }
    }

    /**
     * POST /api/v1/ai-profiles/:id/kb/files/:fileId/reindex
     */
    static async reindexKbFile(req: Request, res: Response) {
        const tenantId = (req as any).tenantId;
        const profileId = req.params.id as string;
        const fileId = req.params.fileId as string;
        const auditCtx = getAuditContext(req);
        try {
            const result = await aiProfilesService.reindexKbFile(tenantId, profileId, fileId);

            await GlobalAuditLogService.logEvent({
                category: 'ai',
                eventType: 'ai_profile.kb.reindex',
                severity: 'info',
                outcome: 'success',
                message: `Reindexación automática de archivo KB: ${fileId}`,
                targetType: 'ai_profile',
                targetId: profileId,
                metadata: { fileId }
            }, auditCtx);

            res.json(result);
        } catch (error: any) {
            await GlobalAuditLogService.logEvent({
                category: 'ai',
                eventType: 'ai_profile.kb.reindex.failed',
                severity: 'critical',
                outcome: 'failure',
                message: `Error al reindexar archivo KB (${fileId}): ${error.message}`,
                targetType: 'ai_profile',
                targetId: profileId
            }, auditCtx);
            res.status(error.status || 500).json({ error: error.message });
        }
    }

    /**
     * GET /api/v1/ai-profiles/:id/kb/files/:fileId/view
     */
    static async viewKbFile(req: Request, res: Response) {
        try {
            const tenantId = (req as any).tenantId;
            const profileId = req.params.id as string;
            const fileId = req.params.fileId as string;

            const { path: filePath, mimeType, filename } = await aiProfilesService.getKbFileContent(tenantId, profileId, fileId);

            res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
            res.sendFile(filePath, {
                headers: {
                    'Content-Type': mimeType
                }
            });
        } catch (error: any) {
            res.status(error.status || 500).json({ error: error.message });
        }
    }
}
