import { AuditContext } from '../../shared/http/request-audit-context';
import { CoreInternalService } from '../core/core.internal.service';

export type AuditCategory = 'auth' | 'user' | 'org' | 'templates' | 'ai' | 'widget' | 'integrations' | 'channels' | 'campaigns' | 'system' | 'billing' | 'super_admin' | 'ui';
export type AuditSeverity = 'info' | 'warning' | 'critical' | 'success';
export type AuditOutcome = 'success' | 'failure';

export interface LogEventInput {
    category: AuditCategory;
    eventType: string;
    severity: AuditSeverity;
    outcome: AuditOutcome;
    message: string;
    tenantId?: string;
    affectedTenantId?: string;
    targetType?: string;
    targetId?: string;
    targetLabel?: string;
    oldValues?: any;
    newValues?: any;
    metadata?: any;
    isSensitive?: boolean;
    actorEmail?: string;
}

// Claves que deben ser sanitizadas en los objetos JSON
const SENSITIVE_KEYS = [
    'password', 'token', 'accessToken', 'refreshToken',
    'apiKey', 'secret', 'webhookSecret', 'authorization',
    'twoFactorSecret', 'challengeId'
];

/**
 * Servicio centralizado para el registro de eventos de auditoría global.
 */
export class GlobalAuditLogService {
    /**
     * Sanitiza recursivamente un objeto eliminando o enmascarando claves sensibles.
     */
    private static sanitize(obj: any): any {
        if (!obj || typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) return obj.map(v => this.sanitize(v));

        const sanitized = { ...obj };
        for (const key in sanitized) {
            if (SENSITIVE_KEYS.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
                sanitized[key] = '***MASKED***';
            } else if (typeof sanitized[key] === 'object') {
                sanitized[key] = this.sanitize(sanitized[key]);
            }
        }
        return sanitized;
    }

    /**
     * Registra un evento de auditoría en la base de datos.
     */
    static async logEvent(input: LogEventInput, context?: AuditContext) {
        try {
            const data = {
                category: input.category,
                eventType: input.eventType,
                severity: input.severity,
                outcome: input.outcome,
                message: input.message,
                tenantId: input.tenantId || context?.tenantId,
                affectedTenantId: input.affectedTenantId,
                actorType: context?.isImpersonation ? 'system_impersonation' : (context?.actorId ? 'user' : 'system'),
                actorUserId: context?.actorId,
                actorEmail: input.actorEmail || context?.actorEmail,
                actorRole: context?.actorRole,
                targetType: input.targetType,
                targetId: input.targetId,
                targetLabel: input.targetLabel,
                ipAddress: context?.ipAddress,
                userAgent: context?.userAgent,
                requestId: context?.requestId,
                isImpersonation: !!context?.isImpersonation,
                isSensitive: !!input.isSensitive,
                oldValues: this.sanitize(input.oldValues),
                newValues: this.sanitize(input.newValues),
                metadata: this.sanitize(input.metadata),
            };

            await CoreInternalService.createGlobalAuditEvent(data);
        } catch (error) {
            // No bloqueamos el flujo principal si falla la auditoría, solo logueamos el error
            console.error('[GlobalAuditLogService] Error al persistir evento de auditoría:', error);
        }
    }
}
