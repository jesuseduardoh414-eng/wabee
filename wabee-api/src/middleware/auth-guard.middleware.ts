import { Response, NextFunction } from 'express';
import { coreAdapter } from '@/modules/core/core.adapter';
import { AuthRequest } from './auth.middleware';

/**
 * Middleware de seguridad montado después de `authMiddleware` y `tenantMiddleware`.
 * 1. Procesa los JWT de Impersonation para poblar el AuthRequest con la identidad dual.
 * 2. Valida contra DB que la sesión (ImpersonationSession) siga activa (para corte abrupto).
 * 3. Valida contra DB que el usuario efectivo actual (sea o no suplente) no esté SUSPENDIDO.
 */
export const authGuardMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const tenantId = req.tenantId;

        if (!tenantId) {
            // Este middleware requiere que el tenantId ya haya sido resuelto.
            // Si la ruta no lo requería (rutas genéricas), saltar de inmediato para no romper flujos globales
            return next();
        }

        const isValidUUID = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
        if (!isValidUUID(tenantId)) {
            return res.status(400).json({ error: { code: 'INVALID_TENANT', message: 'El formato del tenant es inválido.' } });
        }

        // 1. Extraer metadata inyectada en el JWT generada por nuestro endpoint `impersonate`
        const user = req.user;
        let isImpersonating = false;
        let realUserId = null;
        let effectiveUserId = user?.id || user?.sub;
        let sessionId = null;

        if (user && user.isImpersonating) {
            isImpersonating = true;
            realUserId = user.realUserId;
            sessionId = user.impersonationSessionId;
            effectiveUserId = user.id || user.sub; // Por convención el JWT suplantado tiene el targetUserId aquí

            // Validar en tiempo real que la sesión de impersonación no haya sido cerrada en DB
            if (!sessionId) {
                return res.status(401).json({ error: { code: 'IMPERSONATION_ENDED', message: 'Sesión de suplantación inválida por falta de ID de sesión.' } });
            }

            const activeSession = await (coreAdapter.auth as any).impersonation.getSession(sessionId);

            if (!activeSession || !activeSession.isActive) {
                return res.status(401).json({ error: { code: 'IMPERSONATION_ENDED', message: 'La sesión de suplantación ha concluido o fue revocada mandatoriamente.' } });
            }

            if (activeSession.tenantId !== tenantId) {
                return res.status(401).json({ error: { code: 'IMPERSONATION_ENDED', message: 'Detectado cruce de tenant en suplantación. Cerrando conexión.' } });
            }
        }

        // 2. Poblar AuthRequest
        req.isImpersonating = isImpersonating;
        req.realUserId = realUserId;
        req.effectiveUserId = effectiveUserId;
        req.impersonationSessionId = sessionId;

        // 3. Validar SSOT: Member Status de Suspension (Usando effectiveUserId siempre)
        if (effectiveUserId && tenantId) {
            const membership = await coreAdapter.organizations.getMembership(tenantId, effectiveUserId);

            if (membership && membership.status === 'suspended') {
                return res.status(403).json({
                    error: {
                        code: 'MEMBER_SUSPENDED',
                        message: 'Esta cuenta ha sido suspendida. Contacte al administrador.'
                    }
                });
            }
        }

        next();
    } catch (error) {
        console.error('[AuthGuardMiddleware] Error ejecutando guard:', error);
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Error validando estado y permisos de cuenta.' } });
    }
};
