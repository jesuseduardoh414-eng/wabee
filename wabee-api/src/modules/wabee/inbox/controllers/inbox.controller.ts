import { Response, NextFunction } from 'express';
import { prisma } from '@/lib/prisma';
import { coreAdapter } from '@/modules/core/core.adapter';
import { InboxContext } from '../types/inbox-role.types';
import { InboxService } from '../services/inbox.service';
import { replyThread } from '../use-cases/reply-thread.usecase';
import { assignThread } from '../use-cases/assign-thread.usecase';
import { takeThread } from '../use-cases/take-thread.usecase';
import { unassignThread } from '../use-cases/unassign-thread.usecase';
import { closeThread } from '../use-cases/close-thread.usecase';
import { reopenThread } from '../use-cases/reopen-thread.usecase';
import { addInternalNote } from '../use-cases/add-internal-note.usecase';
import { ThreadStateOrchestrator } from '../services/thread.state.orchestrator';
import { InboxAuditService } from '../../audit/inbox-audit.service';
import { GlobalAuditLogService } from '@/modules/audit/global-audit-log.service';
import { getAuditContext } from '@/shared/http/request-audit-context';

// ─── Helper: extraer inboxContext de forma segura ─────────────────────────────
// Los handlers usan `req: any` para ser compatibles con los tipos de Express,
// siguiendo el patrón establecido en el resto del proyecto (ver whatsapp.inbox.controller.ts).
function getCtx(req: any): InboxContext {
    if (!req.inboxContext) {
        throw { status: 500, code: 'MISSING_INBOX_CONTEXT', message: 'Contexto de inbox no resuelto. Falta resolveInboxContext middleware.' };
    }
    return req.inboxContext as InboxContext;
}

// ─── Handler: listar threads según rol ───────────────────────────────────────

/**
 * GET /threads
 * - Agent:      devuelve solo threads asignados a él
 * - Supervisor: devuelve todos los threads del tenant
 */
export async function getThreads(req: any, res: Response, next: NextFunction) {
    try {
        const ctx = getCtx(req);
        const limit = Math.min(Number(req.query.limit) || 30, 100);
        const cursor = req.query.cursor as string | undefined;

        const threads = await InboxService.getThreadsForUser(ctx, { limit, cursor });

        res.json({
            items: threads,
            total: threads.length,
            role: ctx.role,
            hasMore: threads.length === limit,
        });
    } catch (err: any) {
        next(err);
    }
}

// ─── Handler: responder mensaje ───────────────────────────────────────────────

/**
 * POST /threads/:id/reply
 * Body: { text: string }
 */
export async function replyThreadHandler(req: any, res: Response, next: NextFunction) {
    const threadId = req.params.id;
    const { text } = req.body;
    let ctx: any;
    try {
        ctx = getCtx(req);
        if (!text?.trim()) {
            return res.status(400).json({ code: 'INVALID_INPUT', message: 'El campo "text" es requerido.' });
        }

        const message = await replyThread(ctx, { threadId, text });
        res.json(message);
    } catch (err: any) {
        // Auditoría Global - Únicamente en caso de fallo crítico en el envío 
        // Solo intentamos auditar si capturamos el contexto
        await GlobalAuditLogService.logEvent({
            category: 'org',
            eventType: 'inbox.reply_failed',
            severity: 'critical',
            outcome: 'failure',
            message: `Error al responder en thread ${threadId}: ${err.message || 'Error desconocido'}`,
            tenantId: ctx?.tenantId || (req as any).tenantId,
            targetType: 'thread',
            targetId: threadId,
            metadata: { error: err.message, text: text?.substring(0, 50) } // Solo una muestra del texto por seguridad
        }, getAuditContext(req));

        next(err);
    }
}

// ─── Handler: asignar thread ──────────────────────────────────────────────────

/**
 * POST /threads/:id/assign
 * Body: { assignedUserId: string }
 */
export async function assignThreadHandler(req: any, res: Response, next: NextFunction) {
    try {
        const ctx = getCtx(req);
        const threadId = req.params.id;
        const { assignedUserId } = req.body;

        if (typeof assignedUserId !== 'string' || !assignedUserId) {
            return res.status(400).json({ code: 'INVALID_INPUT', message: '"assignedUserId" debe ser un string válido.' });
        }

        const thread = await assignThread(ctx, { threadId, assignedUserId });

        // Inbox Audit Context (Fetch prev data)
        const prevThread = await prisma.whatsappThread.findFirst({ where: { id: threadId }, select: { assignedUserId: true, channelId: true, contactId: true } });

        // Auditoría Global
        await GlobalAuditLogService.logEvent({
            category: 'org',
            eventType: prevThread?.assignedUserId ? 'inbox.reassign' : 'inbox.assign',
            severity: 'info',
            outcome: 'success',
            message: prevThread?.assignedUserId
                ? `Thread ${threadId} reasignado de ${prevThread.assignedUserId} a ${assignedUserId}`
                : `Thread ${threadId} asignado a ${assignedUserId}`,
            tenantId: ctx.tenantId,
            targetType: 'thread',
            targetId: threadId,
            newValues: { assignedUserId }
        }, getAuditContext(req));

        // Inbox Audit
        InboxAuditService.logWithSnapshots({
            tenantId: ctx.tenantId,
            threadId,
            channelId: prevThread?.channelId,
            contactId: prevThread?.contactId,
            actorType: 'human',
            actorUserId: ctx.userId,
            actorRole: ctx.role as any,
            eventType: prevThread?.assignedUserId ? 'THREAD_REASSIGNED' : 'THREAD_ASSIGNED',
            metadata: { assignedUserId },
        });

        res.json(thread);
    } catch (err: any) {
        next(err);
    }
}

// ─── Handler: liberar thread (unassign) ──────────────────────────────────────

/**
 * POST /threads/:id/unassign
 */
export async function unassignThreadHandler(req: any, res: Response, next: NextFunction) {
    try {
        const ctx = getCtx(req);
        const threadId = req.params.id;

        const thread = await unassignThread(ctx, { threadId });

        // Auditoría Global
        await GlobalAuditLogService.logEvent({
            category: 'org',
            eventType: 'inbox.unassign',
            severity: 'info',
            outcome: 'success',
            message: `Thread ${threadId} liberado (desasignado)`,
            tenantId: ctx.tenantId,
            targetType: 'thread',
            targetId: threadId
        }, getAuditContext(req));

        // Inbox Audit
        InboxAuditService.logWithSnapshots({
            tenantId: ctx.tenantId,
            threadId,
            actorType: 'human',
            actorUserId: ctx.userId,
            actorRole: ctx.role as any,
            eventType: 'THREAD_UNASSIGNED',
        });

        res.json(thread);
    } catch (err: any) {
        next(err);
    }
}

// ─── Handler: tomar thread (take) ───────────────────────────────────────────

/**
 * POST /threads/:id/take
 */
export async function takeThreadHandler(req: any, res: Response, next: NextFunction) {
    try {
        const ctx = getCtx(req);
        const threadId = req.params.id;

        const thread = await takeThread(ctx, { threadId });

        // Auditoría Global
        await GlobalAuditLogService.logEvent({
            category: 'org',
            eventType: 'inbox.take',
            severity: 'info',
            outcome: 'success',
            message: `Usuario ${ctx.userId} tomó el thread ${threadId}`,
            tenantId: ctx.tenantId,
            targetType: 'thread',
            targetId: threadId,
            newValues: { assignedUserId: ctx.userId }
        }, getAuditContext(req));

        res.json(thread);
    } catch (err: any) {
        next(err);
    }
}

// ─── Handler: cerrar thread ───────────────────────────────────────────────────

/**
 * POST /threads/:id/close
 */
export async function closeThreadHandler(req: any, res: Response, next: NextFunction) {
    try {
        const ctx = getCtx(req);
        const threadId = req.params.id;

        const thread = await closeThread(ctx, { threadId });

        // Auditoría Global
        await GlobalAuditLogService.logEvent({
            category: 'org',
            eventType: 'inbox.close',
            severity: 'success',
            outcome: 'success',
            message: `Thread ${threadId} cerrado correctamente`,
            tenantId: ctx.tenantId,
            targetType: 'thread',
            targetId: threadId
        }, getAuditContext(req));

        // Inbox Audit
        InboxAuditService.logWithSnapshots({
            tenantId: ctx.tenantId,
            threadId,
            actorType: 'human',
            actorUserId: ctx.userId,
            actorRole: ctx.role as any,
            eventType: 'THREAD_CLOSED',
        });

        res.json(thread);
    } catch (err: any) {
        next(err);
    }
}

// ─── Handler: reabrir thread ──────────────────────────────────────────────────

/**
 * POST /threads/:id/reopen
 */
export async function reopenThreadHandler(req: any, res: Response, next: NextFunction) {
    try {
        const ctx = getCtx(req);
        const threadId = req.params.id;

        const thread = await reopenThread(ctx, { threadId });

        // Auditoría Global
        await GlobalAuditLogService.logEvent({
            category: 'org',
            eventType: 'inbox.reopen',
            severity: 'info',
            outcome: 'success',
            message: `Thread ${threadId} reabierto`,
            tenantId: ctx.tenantId,
            targetType: 'thread',
            targetId: threadId
        }, getAuditContext(req));

        // Inbox Audit
        InboxAuditService.logWithSnapshots({
            tenantId: ctx.tenantId,
            threadId,
            actorType: 'human',
            actorUserId: ctx.userId,
            actorRole: ctx.role as any,
            eventType: 'THREAD_REOPENED',
        });

        res.json(thread);
    } catch (err: any) {
        next(err);
    }
}

// ─── Handler: agregar nota interna ───────────────────────────────────────────

/**
 * POST /threads/:id/notes
 * Body: { body: string }
 */
export async function addInternalNoteHandler(req: any, res: Response, next: NextFunction) {
    try {
        const ctx = getCtx(req);
        const threadId = req.params.id;
        const { body } = req.body;

        if (!body?.trim()) {
            return res.status(400).json({ code: 'INVALID_INPUT', message: 'El campo "body" es requerido.' });
        }

        const note = await addInternalNote(ctx, { threadId, body });

        // Auditoría Global
        await GlobalAuditLogService.logEvent({
            category: 'org',
            eventType: 'inbox.note_added',
            severity: 'info',
            outcome: 'success',
            message: `Nota interna agregada al thread ${threadId}`,
            tenantId: ctx.tenantId,
            targetType: 'thread',
            targetId: threadId
        }, getAuditContext(req));

        // Inbox Audit
        InboxAuditService.logWithSnapshots({
            tenantId: ctx.tenantId,
            threadId,
            actorType: 'human',
            actorUserId: ctx.userId,
            actorRole: ctx.role as any,
            eventType: 'INTERNAL_NOTE_ADDED',
        });

        res.json(note);
    } catch (err: any) {
        next(err);
    }
}

// ─── Handler: forzar takeover humano ─────────────────────────────────────────

/**
 * POST /threads/:id/takeover
 */
export async function forceHumanTakeoverHandler(req: any, res: Response, next: NextFunction) {
    try {
        const ctx = getCtx(req);
        const threadId = req.params.id;
        const tenantId = ctx.tenantId;
        const userId = ctx.userId;
        const reason = req.body?.reason || 'manual_intervention';

        if (!userId) {
            return res.status(401).json({ code: 'UNAUTHENTICATED', message: 'Usuario no autenticado.' });
        }

        // Ya fue validado el acceso por el requirePermission/requireRole en las rutas
        await ThreadStateOrchestrator.humanTakeover(threadId, tenantId, userId, reason);

        // Auditoría Global
        await GlobalAuditLogService.logEvent({
            category: 'org',
            eventType: 'inbox.human_takeover',
            severity: 'warning',
            outcome: 'success',
            message: `Takeover humano forzado en thread ${threadId}. Razón: ${reason}`,
            tenantId,
            targetType: 'thread',
            targetId: threadId,
            metadata: { reason }
        }, getAuditContext(req));

        // Inbox Audit
        InboxAuditService.logWithSnapshots({
            tenantId,
            threadId,
            actorType: 'human',
            actorUserId: userId,
            actorRole: ctx.role as any,
            eventType: 'HUMAN_TAKEOVER',
            description: reason,
        });

        const status = await ThreadStateOrchestrator.getHandlingStatus(threadId, tenantId);
        res.json(status);
    } catch (err: any) {
        next(err);
    }
}

// ─── Handler: leer estado de atención ────────────────────────────────────────

/**
 * GET /threads/:id/handling-status
 */
export async function handlingStatusHandler(req: any, res: Response, next: NextFunction) {
    try {
        const ctx = getCtx(req);
        const threadId = req.params.id;
        const tenantId = ctx.tenantId;

        // Ya fue validado el acceso en las rutas
        const status = await ThreadStateOrchestrator.getHandlingStatus(threadId, tenantId);
        res.json(status);
    } catch (err: any) {
        next(err);
    }
}

// ─── Handler: reanudar IA (V1 = 501 Not Implemented) ─────────────────────────

/**
 * POST /threads/:id/resume-ai
 */
export async function resumeAiHandler(req: any, res: Response, next: NextFunction) {
    try {
        const ctx = getCtx(req);
        const threadId = req.params.id;
        const tenantId = ctx.tenantId;
        const userId = ctx.userId;

        await ThreadStateOrchestrator.resumeAi(threadId, tenantId, userId);

        // Auditoría Global
        await GlobalAuditLogService.logEvent({
            category: 'org',
            eventType: 'inbox.resume_ai',
            severity: 'info',
            outcome: 'success',
            message: `IA reanudada en thread ${threadId}`,
            tenantId,
            targetType: 'thread',
            targetId: threadId
        }, getAuditContext(req));

        const status = await ThreadStateOrchestrator.getHandlingStatus(threadId, tenantId);
        res.json(status);
    } catch (err: any) {
        next(err);
    }
}

// ─── Handler: obtener asignables ─────────────────────────────────────────────

/**
 * GET /assignees
 * Retorna los usuarios disponibles para asignación (Agent, Supervisor, Admin)
 */
export async function getAssigneesHandler(req: any, res: Response, next: NextFunction) {
    try {
        const ctx = getCtx(req);
        const { tenantId } = ctx;

        const members = await coreAdapter.organizations.listAssignableMembers(tenantId);

        const formatted = members.map((m: any) => ({
            id: m.user?.id,
            name: m.user?.name,
            email: m.user?.email,
            avatar: m.user?.avatar,
            role: m.role?.slug || 'AGENT'
        }));

        res.json(formatted);
    } catch (err: any) {
        next(err);
    }
}
