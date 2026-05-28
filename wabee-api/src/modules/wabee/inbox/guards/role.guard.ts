import { Response, NextFunction } from 'express';
import { coreAdapter } from '@/modules/core/core.adapter';
import { InboxRole, InboxContext } from '../types/inbox-role.types';
import { InboxPolicy } from '../policies/inbox.policy';

// ─── Resolución de rol (con caché por request) ────────────────────────────────
const ROLE_CACHE_KEY = '__inbox_resolved_role__';

/**
 * Resuelve el rol funcional del usuario autenticado dentro del tenant actual.
 * Consulta core.organization_members -> core.roles.slug
 * Cachea el resultado en req para evitar consultas repetidas por request.
 */
async function resolveUserRole(req: any): Promise<InboxRole> {
    if ((req as any)[ROLE_CACHE_KEY]) {
        return (req as any)[ROLE_CACHE_KEY] as InboxRole;
    }

    const userId = req.user?.id || req.user?.sub;
    const tenantId = req.tenantId;

    if (!userId) {
        throw { status: 401, code: 'UNAUTHORIZED', message: 'No hay usuario autenticado.' };
    }
    if (!tenantId) {
        throw { status: 401, code: 'UNAUTHORIZED', message: 'No hay tenant resuelto.' };
    }

    const membership = await coreAdapter.organizations.getMembership(tenantId, userId);

    if (!membership) {
        throw { status: 403, code: 'INBOX_PERMISSION_DENIED', message: 'El usuario no es miembro de esta organización.' };
    }

    const slug = membership.role?.slug?.toLowerCase() ?? '';
    let role: InboxRole;

    if (slug === InboxRole.Admin) role = InboxRole.Admin;
    else if (slug === InboxRole.Supervisor) role = InboxRole.Supervisor;
    else role = InboxRole.Agent;

    (req as any)[ROLE_CACHE_KEY] = role;
    return role;
}

// ─── Middleware principal: resolver contexto de inbox ─────────────────────────

/**
 * Middleware que resuelve el rol del usuario y construye el InboxContext.
 * Inyecta req.inboxContext para que controllers y use-cases lo consuman.
 *
 * Uso: aplicar en todas las rutas del submódulo de inbox roles.
 */
export async function resolveInboxContext(req: any, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.user?.id || req.user?.sub;
        const tenantId = req.tenantId;

        if (!userId || !tenantId) {
            res.status(401).json({ code: 'UNAUTHORIZED', message: 'Sesión inválida.' });
            return;
        }

        const role = await resolveUserRole(req);
        req.inboxContext = { userId, tenantId, role } as InboxContext;
        next();
    } catch (err: any) {
        res.status(err.status || 500).json({
            code: err.code || 'INTERNAL_ERROR',
            message: err.message || 'Error interno al resolver contexto de inbox.'
        });
    }
}

// ─── Factory: guard de permiso por acción ─────────────────────────────────────

/**
 * requirePermission(action)
 *
 * Middleware factory que verifica que el rol del usuario tenga capacidad funcional
 * para la acción solicitada usando InboxPolicy.
 *
 * Requiere que resolveInboxContext haya corrido antes.
 */
export function requirePermission(
    action: keyof Pick<typeof InboxPolicy,
        'canViewGlobalInbox' | 'canViewOwnThreads' | 'canReply' |
        'canAssign' | 'canReassign' | 'canClose' |
        'canReopen' | 'canAddNote' | 'canForceHumanTakeover' |
        'canViewAiLogs' | 'canViewAnalytics'
    >
) {
    return (req: any, res: Response, next: NextFunction): void => {
        const ctx = req.inboxContext as InboxContext | undefined;

        if (!ctx) {
            res.status(500).json({ code: 'MISSING_INBOX_CONTEXT', message: 'El contexto de inbox no fue resuelto.' });
            return;
        }

        const allowed = (InboxPolicy[action] as (role: InboxRole) => boolean)(ctx.role);

        if (!allowed) {
            res.status(403).json({
                code: 'INBOX_PERMISSION_DENIED',
                message: `El rol "${ctx.role}" no tiene permiso para ejecutar esta acción.`,
                action,
                role: ctx.role
            });
            return;
        }

        next();
    };
}

// ─── Factory: guard de rol específico ─────────────────────────────────────────

/**
 * requireRole(...roles)
 *
 * Middleware factory que restringe el acceso a uno o más roles.
 * Alternativa directa a requirePermission para endpoints exclusivos de un rol.
 */
export function requireRole(...allowedRoles: InboxRole[]) {
    return (req: any, res: Response, next: NextFunction): void => {
        const ctx = req.inboxContext as InboxContext | undefined;

        if (!ctx) {
            res.status(500).json({ code: 'MISSING_INBOX_CONTEXT', message: 'El contexto de inbox no fue resuelto.' });
            return;
        }

        if (!allowedRoles.includes(ctx.role)) {
            res.status(403).json({
                code: 'INBOX_PERMISSION_DENIED',
                message: `Esta acción requiere uno de los siguientes roles: ${allowedRoles.join(', ')}. Rol actual: "${ctx.role}".`,
                requiredRoles: allowedRoles,
                currentRole: ctx.role
            });
            return;
        }

        next();
    };
}
