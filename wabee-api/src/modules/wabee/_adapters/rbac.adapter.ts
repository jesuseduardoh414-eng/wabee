import { Request, Response, NextFunction } from 'express';
import { coreAdapter } from '@/modules/core/core.adapter';
import { isSuperAdmin } from '@/middleware/auth-role.middleware';

// Estos tipos deben casar con lo que exista en el Core (member.role.name) o similar
export type OrgRoleType = 'Admin' | 'Supervisor' | 'Agent' | string;

/**
 * Adapter para verificar Roles a nivel de organización.
 *
 * El rol funcional del usuario vive en `core.organization_members -> core.roles.slug`
 * (mismo SSOT que usa el guard del inbox y `verifyAdminPrivileges`). Se consulta vía
 * `coreAdapter.organizations.getMembership(tenantId, userId)`.
 */
export const rbacAdapter = {
    /**
     * Middleware que protege rutas sensibles exigiendo uno de los roles indicados.
     *
     * IMPORTANTE: debe montarse DESPUÉS de `authMiddleware` y `tenantMiddleware`
     * (necesita `req.user` y `req.tenantId`). Antes este middleware era un no-op que
     * dejaba pasar a cualquier usuario autenticado — lo que volvía inútiles los
     * `adminOnly` de automatizaciones e integraciones.
     */
    requireOrgRole: (allowedRoles: OrgRoleType[]) => {
        const allowed = allowedRoles.map(r => String(r).toLowerCase());

        return async (req: Request, res: Response, next: NextFunction) => {
            try {
                const user = (req as any).user;
                if (!user) {
                    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No autenticado.' } });
                    return;
                }

                // Super admin de plataforma: acceso total.
                if (isSuperAdmin(user)) {
                    next();
                    return;
                }

                const tenantId = (req as any).tenantId;
                const userId = user.id || user.sub;

                if (!tenantId || !userId) {
                    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Contexto de organización no resuelto.' } });
                    return;
                }

                const membership = await coreAdapter.organizations.getMembership(tenantId, userId);
                const slug = String((membership as any)?.role?.slug || '').toLowerCase();

                if (!membership || !allowed.includes(slug)) {
                    res.status(403).json({
                        error: {
                            code: 'FORBIDDEN',
                            message: 'No tienes permisos suficientes para realizar esta acción.'
                        }
                    });
                    return;
                }

                next();
            } catch (error) {
                console.error('[rbacAdapter.requireOrgRole] Error verificando rol:', error);
                res.status(403).json({ error: { code: 'FORBIDDEN', message: 'No autorizado.' } });
            }
        };
    }
};
