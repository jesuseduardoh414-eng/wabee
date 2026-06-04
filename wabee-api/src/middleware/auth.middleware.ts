import * as express from 'express';
import jwt from 'jsonwebtoken';

import { PlanSnapshot } from '../modules/billing/plan-resolver';
import { requireJwtSecret } from '../config/env';

export interface AuthRequest extends express.Request {
    user?: any;
    tenantId?: string;
    orgPlan?: PlanSnapshot;
    isImpersonating?: boolean;
    realUserId?: string | null;
    effectiveUserId?: string;
    impersonationSessionId?: string | null;
}

export const authMiddleware = (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
    let token = '';

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    } else if (req.query.token && typeof req.query.token === 'string') {
        token = req.query.token;
    }

    if (!token) {
        return res.status(401).json({
            error: {
                code: 'UNAUTHORIZED',
                message: 'No se proporcionó un token de autenticación válido.'
            }
        });
    }

    let secret: string;
    try {
        secret = requireJwtSecret();
    } catch {
        return res.status(500).json({
            error: { code: 'CONFIG_ERROR', message: 'Error de configuración del servidor (JWT).' }
        });
    }

    try {
        const decoded = jwt.verify(token, secret);

        // Inyectamos el usuario decodificado en el request
        req.user = decoded;

        next();
    } catch (error) {
        return res.status(401).json({
            error: {
                code: 'INVALID_TOKEN',
                message: 'El token proporcionado es inválido o ha expirado.'
            }
        });
    }
};
