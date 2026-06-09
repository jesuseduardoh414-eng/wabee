import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';

/**
 * Slug del rol GLOBAL que identifica a un Super Admin de plataforma.
 * Es distinto del rol `admin`, que es el Administrador a nivel de organización.
 */
export const SUPER_ADMIN_ROLE = 'superadmin';

/** Único punto de verdad para saber si un usuario es Super Admin de plataforma. */
export const isSuperAdmin = (user?: { globalRole?: string } | null): boolean =>
    user?.globalRole === SUPER_ADMIN_ROLE;

export const requireSuperAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        return res.status(401).json({
            error: {
                code: 'UNAUTHORIZED',
                message: 'No autenticado.'
            }
        });
    }

    if (!isSuperAdmin(req.user)) {
        return res.status(403).json({
            error: {
                code: 'FORBIDDEN',
                message: 'Acceso denegado. Se requieren permisos de administrador de plataforma.'
            }
        });
    }

    next();
};
