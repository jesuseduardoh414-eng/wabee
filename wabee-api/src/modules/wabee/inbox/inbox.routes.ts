import { Router } from 'express';
import { tenantMiddleware } from '@/middleware/tenant';
import { resolveInboxContext, requirePermission, requireRole } from './guards/role.guard';
import { requireModule } from '@/middleware/modules.guard';
import { InboxRole } from './types/inbox-role.types';
import * as controller from './controllers/inbox.controller';

const router = Router();

// ─── Middlewares base para todas las rutas de este submódulo ──────────────────
// 1. tenantMiddleware → inyecta req.tenantId (authMiddleware ya corrió en index.ts)
// 2. resolveInboxContext → resuelve req.inboxContext con el rol del usuario desde DB
router.use(tenantMiddleware);
router.use(requireModule('inbox'));
router.use(resolveInboxContext as any);

// ─── Rutas ────────────────────────────────────────────────────────────────────

/**
 * GET /assignees
 * Retorna la lista de usuarios elegibles para asignar chats en el tenant actual.
 * Accesible para cualquier rol operativo del inbox.
 */
router.get(
    '/assignees',
    // Un Agent también necesita ver asignables si vamos a permitir transferencias, o al menos
    // solo Super/Admin para el selector. Según RBAC actual, Agent no tiene canAssign.
    // Lo dejaremos accesible vía InboxContext base (ya validado por tenantMiddleware + resolveInboxContext)
    controller.getAssigneesHandler as any
);

/**
 * GET /threads
 * Devuelve threads visibles según el rol del usuario:
 *   - Agent:      solo threads asignados a él
 *   - Supervisor: todos los threads del tenant (inbox global)
 */
router.get(
    '/threads',
    controller.getThreads as any
);

/**
 * POST /threads/:id/reply
 * Responder un mensaje en un thread.
 * Agent solo puede responder threads asignados a él (ownership check en caso de uso).
 */
router.post(
    '/threads/:id/reply',
    requirePermission('canReply'),
    controller.replyThreadHandler as any
);

/**
 * POST /threads/:id/assign
 * Asignación administrativa.
 * Solo Supervisor y Admin pueden.
 */
router.post(
    '/threads/:id/assign',
    requirePermission('canAssign'),
    controller.assignThreadHandler as any
);

/**
 * POST /threads/:id/unassign
 * Liberar un thread (quitar ownership).
 * Supervisor y Admin seguro pueden. Agents si es suyo (se validará en el caso de uso si queremos, pero de momento canAssign para simplificar o permitimos a Agent).
 * Decidiremos dar canAssign para unassign por ahora o crear canUnassign. Use allow all en route y check ownership en Usecase, // o usar requireRole?
 * Según el plan, Agents pueden liberar sus chats. Entonces requerimos 'canReply' que verifica ownership implícito para Agents.
 */
router.post(
    '/threads/:id/unassign',
    requirePermission('canReply'), // Agent (en los suyos), Super/Admin (en todos)
    controller.unassignThreadHandler as any
);

/**
 * POST /threads/:id/take
 * Toma real del chat por el usuario actual.
 * Agent puede tomar chats de human_queue.
 * No requiere canAssign. Solo requiere estar autenticado y en el tenant.
 */
router.post(
    '/threads/:id/take',
    // Todos los roles de Inbox pueden intentar tomar un chat
    controller.takeThreadHandler as any
);

/**
 * POST /threads/:id/close
 * Cerrar una conversación.
 * Agent puede cerrar sus threads; Supervisor puede cerrar cualquiera del tenant.
 */
router.post(
    '/threads/:id/close',
    requirePermission('canClose'),
    controller.closeThreadHandler as any
);

/**
 * POST /threads/:id/reopen
 * Reabrir una conversación cerrada.
 * Solo Supervisor y Admin.
 */
router.post(
    '/threads/:id/reopen',
    requirePermission('canReopen'),
    controller.reopenThreadHandler as any
);

/**
 * POST /threads/:id/notes
 * Agregar nota interna (visible solo para el equipo).
 * Agent solo en sus threads; Supervisor en cualquiera del tenant.
 */
router.post(
    '/threads/:id/notes',
    requirePermission('canAddNote'),
    controller.addInternalNoteHandler as any
);

/**
 * GET /threads/:id/handling-status
 * Estado del agente/IA para el thread.
 * Agent solo en sus threads; Supervisor en cualquiera del tenant.
 */
router.get(
    '/threads/:id/handling-status',
    requirePermission('canReply'), // 'canReply' ya verifica ownership de Agent
    controller.handlingStatusHandler as any
);

/**
 * POST /threads/:id/takeover
 * Forzar takeover humano (pausar IA en el thread).
 * Agent solo en sus threads; Supervisor en cualquiera del tenant.
 */
router.post(
    '/threads/:id/takeover',
    requirePermission('canReply'),
    controller.forceHumanTakeoverHandler as any
);

/**
 * POST /threads/:id/resume-ai
 * Reactiva la IA en el thread después de un takeover humano.
 * Agent solo en sus threads; Supervisor en cualquiera del tenant.
 */
router.post(
    '/threads/:id/resume-ai',
    requirePermission('canReply'),
    controller.resumeAiHandler as any
);

export default router;
