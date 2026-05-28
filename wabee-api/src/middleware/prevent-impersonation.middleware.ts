import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';

/**
 * Middleware protector para aislar rutas operacionales altamente sensibles y destructivas.
 * Impide explícitamente operaciones si el request viene de un Admin bajo impersonation proxy.
 */
export const preventImpersonation = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.isImpersonating) {
        return res.status(403).json({
            error: {
                code: 'IMPERSONATION_RESTRICTED',
                message: 'Operación prohibida: No puede ejecutar esta acción sensible mientras se encuentre suplantando una cuenta proxy.'
            }
        });
    }

    next();
};
