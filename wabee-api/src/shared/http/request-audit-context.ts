import { Request } from 'express';
import crypto from 'crypto';

export interface AuditContext {
    ipAddress: string;
    userAgent: string;
    requestId: string;
    actorId?: string;
    actorEmail?: string;
    actorRole?: string;
    tenantId?: string;
    isImpersonation: boolean;
}

/**
 * Extrae el contexto de auditoría de una solicitud Express.
 */
export const getAuditContext = (req: Request): AuditContext => {
    const user = (req as any).user;

    // Lógica de Request ID: req.id > req.requestId > Header x-request-id > UUID
    const requestId =
        (req as any).id ||
        (req as any).requestId ||
        req.header('x-request-id') ||
        crypto.randomUUID();

    return {
        ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
        userAgent: req.header('user-agent') || 'unknown',
        requestId,
        actorId: user?.id,
        actorEmail: user?.email,
        actorRole: user?.globalRole || user?.role?.slug || 'unknown',
        tenantId: (req as any).tenantId || user?.tenantId || user?.organizationId,
        isImpersonation: !!user?.isImpersonating,
    };
};
