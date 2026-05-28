import { Request } from 'express';

// ─── Slugs de rol que maneja el sistema de inbox ─────────────────────────────
// Los slugs deben coincidir exactamente con core.roles.slug en la BD
export enum InboxRole {
    Agent = 'agent',
    Supervisor = 'supervisor',
    Admin = 'admin',
}

// ─── Contexto resuelto del usuario para operaciones de inbox ─────────────────
export interface InboxContext {
    /** ID del usuario autenticado (req.user.sub desde JWT) */
    userId: string;
    /** ID del tenant (organización) resuelto por tenantMiddleware */
    tenantId: string;
    /** Rol funcional resuelto desde DB para este tenant */
    role: InboxRole;
}

// ─── Extensión del Request de Express para inyectar el contexto ──────────────
export interface InboxRequest extends Request {
    /** Tenant ID inyectado por tenantMiddleware */
    tenantId: string;
    /** Usuario decodificado del JWT por authMiddleware */
    user?: {
        sub: string;
        email?: string;
        [key: string]: any;
    };
    /** Contexto funcional resuelto por el guard de inbox (role.guard.ts) */
    inboxContext?: InboxContext;
}
