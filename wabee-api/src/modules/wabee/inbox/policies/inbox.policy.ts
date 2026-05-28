import { InboxRole } from '../types/inbox-role.types';

/**
 * InboxPolicy
 *
 * Sistema de políticas funcionales para el módulo de Inbox Conversacional.
 * Define qué capacidades puede ejecutar cada rol operativo (Agent, Supervisor, Admin).
 *
 * NO reimplementa Auth ni RBAC base del Core SaaS.
 * Opera sobre el slug de rol ya resuelto por la infraestructura del Core.
 */
export class InboxPolicy {

    // ─── Visibilidad del Inbox ────────────────────────────────────────────────

    /**
     * Ver inbox global (todos los threads del tenant, sin filtro de asignación)
     * - Agent: NO puede
     * - Supervisor / Admin: SÍ puede
     */
    static canViewGlobalInbox(role: InboxRole): boolean {
        return role === InboxRole.Supervisor || role === InboxRole.Admin;
    }

    /**
     * Ver threads propios (asignados al usuario)
     * - Cualquier rol puede ver sus propios threads
     */
    static canViewOwnThreads(_role: InboxRole): boolean {
        return true;
    }

    // ─── Operaciones de Mensajería ────────────────────────────────────────────

    /**
     * Responder mensajes en una conversación
     * - Agent: SÍ (solo threads asignados a él)
     * - Supervisor / Admin: SÍ (cualquier thread del tenant)
     */
    static canReply(role: InboxRole): boolean {
        return role === InboxRole.Agent ||
            role === InboxRole.Supervisor ||
            role === InboxRole.Admin;
    }

    // ─── Gestión de Asignación ────────────────────────────────────────────────

    /**
     * Asignar conversación a un agente
     * - Agent: NO puede
     * - Supervisor / Admin: SÍ puede
     */
    static canAssign(role: InboxRole): boolean {
        return role === InboxRole.Supervisor || role === InboxRole.Admin;
    }

    /**
     * Reasignar conversación (cambiar agente asignado)
     * - Agent: NO puede
     * - Supervisor / Admin: SÍ puede
     */
    static canReassign(role: InboxRole): boolean {
        return role === InboxRole.Supervisor || role === InboxRole.Admin;
    }

    // ─── Ciclo de Vida del Thread ─────────────────────────────────────────────

    /**
     * Cerrar conversación
     * - Agent: SÍ (solo threads asignados a él)
     * - Supervisor / Admin: SÍ (cualquier thread del tenant)
     */
    static canClose(role: InboxRole): boolean {
        return role === InboxRole.Agent ||
            role === InboxRole.Supervisor ||
            role === InboxRole.Admin;
    }

    /**
     * Reabrir conversación cerrada
     * - Agent: NO puede
     * - Supervisor / Admin: SÍ puede
     */
    static canReopen(role: InboxRole): boolean {
        return role === InboxRole.Supervisor || role === InboxRole.Admin;
    }

    // ─── Colaboración ─────────────────────────────────────────────────────────

    /**
     * Agregar nota interna (visible solo para el equipo)
     * - Agent: SÍ (solo en threads asignados a él)
     * - Supervisor / Admin: SÍ (cualquier thread del tenant)
     */
    static canAddNote(role: InboxRole): boolean {
        return role === InboxRole.Agent ||
            role === InboxRole.Supervisor ||
            role === InboxRole.Admin;
    }

    // ─── Gobernanza de IA ─────────────────────────────────────────────────────

    /**
     * Forzar takeover humano (pausar IA en el thread)
     * - Agent: NO puede
     * - Supervisor / Admin: SÍ puede
     */
    static canForceHumanTakeover(role: InboxRole): boolean {
        return role === InboxRole.Supervisor || role === InboxRole.Admin;
    }

    /**
     * Ver logs de auditoría de IA (ai_audit_logs)
     * - Agent: NO puede
     * - Supervisor / Admin: SÍ puede
     */
    static canViewAiLogs(role: InboxRole): boolean {
        return role === InboxRole.Supervisor || role === InboxRole.Admin;
    }

    // ─── Analytics ───────────────────────────────────────────────────────────

    /**
     * Ver analytics global del tenant
     * - Agent: NO puede
     * - Supervisor / Admin: SÍ puede
     */
    static canViewAnalytics(role: InboxRole): boolean {
        return role === InboxRole.Supervisor || role === InboxRole.Admin;
    }

    // ─── Helper de evaluación genérica ───────────────────────────────────────

    /**
     * Evalúa si el rol tiene al menos uno de los permisos especificados.
     * Útil para guards que validan múltiples acciones a la vez.
     */
    static check(role: InboxRole, action: keyof typeof InboxPolicy): boolean {
        const fn = InboxPolicy[action];
        if (typeof fn === 'function') {
            return (fn as (role: InboxRole) => boolean)(role);
        }
        return false;
    }
}
