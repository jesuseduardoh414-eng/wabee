import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';

export const requireSuperAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        return res.status(401).json({
            error: {
                code: 'UNAUTHORIZED',
                message: 'No autenticado.'
            }
        });
    }

    if (req.user.globalRole !== 'admin') {
        return res.status(403).json({
            error: {
                code: 'FORBIDDEN',
                message: 'Acceso denegado. Se requieren permisos de administrador de plataforma.'
            }
        });
    }

    next();
};
