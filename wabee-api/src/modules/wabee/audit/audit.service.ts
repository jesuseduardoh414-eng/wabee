import { coreAdapter } from '@/modules/core/core.adapter';
import { corePrisma as prisma } from '@/config/core/core.prisma';

export interface CreateAuditLogInput {
    tenantId: string;
    /** ID del usuario que realizó la acción (mapeado a user_id en BD) */
    userId?: string | null;
    /** @deprecated Usar userId. Mantenido por retrocompatibilidad con callers existentes */
    performedByUserId?: string | null;
    action: string;
    /** Tipo de entidad (mapeado a model_type en BD) */
    modelType?: string;
    /** @deprecated Usar modelType. Mantenido por retrocompatibilidad con callers existentes */
    entityType?: string;
    /** ID de la entidad (mapeado a model_id en BD) */
    modelId?: string;
    /** @deprecated Usar modelId. Mantenido por retrocompatibilidad con callers existentes */
    entityId?: string;
    oldValues?: any;
    /** Valores nuevos / metadatos del evento (mapeado a new_values en BD).
     *  Si se pasa `metadata`, se usará como newValues para retrocompatibilidad. */
    newValues?: any;
    /** @deprecated Usar newValues. Mantenido por retrocompatibilidad */
    metadata?: any;
    description?: string;
    ipAddress?: string;
    userAgent?: string;
    userEmail?: string;
    userType?: string;

    // Extensión para Impersonación (Suplantación)
    performedByRealUserId?: string | null;
    isImpersonated?: boolean;
    impersonationSessionId?: string | null;
}

export class AuditService {
    /**
     * Registra una acción crítica en el Audit Trail (tabla core.audit_trail)
     */
    static async log(input: CreateAuditLogInput) {
        // Retrocompatibilidad: admitir tanto userId como performedByUserId
        const resolvedUserId = input.userId || input.performedByUserId || null;
        // Retrocompatibilidad: admitir tanto modelType como entityType
        const resolvedModelType = input.modelType || input.entityType || 'unknown';
        // Retrocompatibilidad: admitir tanto modelId como entityId
        const resolvedModelId = input.modelId || input.entityId || null;
        // Retrocompatibilidad: admitir tanto newValues como metadata
        const resolvedNewValues = {
            ...(input.newValues || {}),
            ...(input.metadata || {}),
            ...(input.isImpersonated ? {
                isImpersonated: true,
                performedByRealUserId: input.performedByRealUserId,
                impersonationSessionId: input.impersonationSessionId
            } : {})
        };

        console.log('[AuditService] Creating audit log', {
            modelType: resolvedModelType,
            modelId: resolvedModelId || null,
            action: input.action,
            tenantId: input.tenantId,
            userId: resolvedUserId || null,
            isImpersonated: input.isImpersonated || false
        });

        try {
            const result = await coreAdapter.system.createAuditLog({
                tenantId: input.tenantId || null,
                userId: resolvedUserId,
                action: input.action,
                modelType: resolvedModelType,
                modelId: resolvedModelId,
                oldValues: input.oldValues || {},
                newValues: resolvedNewValues,
                description: input.description || null,
                ipAddress: input.ipAddress || null,
                userAgent: input.userAgent || null,
                userEmail: input.userEmail || null,
                userType: input.userType || null,
            });

            console.log('[AuditService] Audit log created', {
                id: result.id,
                modelType: result.modelType,
                action: result.action,
            });

            return result;
        } catch (error) {
            console.error('[AuditService] Non-critical error: Failed to create audit log', error);
            // No lanzamos para no romper el flujo del caller
            return null;
        }
    }

    /**
     * Obtiene los logs de auditoría para un tenant, con filtros opcionales
     */
    static async getLogs(tenantId: string, filters: {
        from?: string;
        to?: string;
        action?: string;
        /** Filtrar por tipo de modelo (model_type en BD) */
        modelType?: string;
        /** @deprecated Usar modelType */
        entityType?: string;
        /** Filtrar por usuario actor */
        userId?: string;
        /** @deprecated Usar userId */
        actorUserId?: string;
        /** @deprecated Usar userId */
        performedByUserId?: string;
        limit?: number;
        offset?: number;
    }) {
        const where: any = { tenantId };

        if (filters.from || filters.to) {
            where.createdAt = {};
            if (filters.from) where.createdAt.gte = new Date(filters.from);
            if (filters.to) where.createdAt.lte = new Date(filters.to);
        }

        if (filters.action) where.action = filters.action;

        // Retrocompatibilidad: modelType o entityType
        const modelTypeFilter = filters.modelType || filters.entityType;
        if (modelTypeFilter) where.modelType = modelTypeFilter;

        // Retrocompatibilidad: userId, actorUserId o performedByUserId
        const userIdFilter = filters.userId || filters.actorUserId || filters.performedByUserId;
        if (userIdFilter) where.userId = userIdFilter;

        const limit = filters.limit || 50;
        const offset = filters.offset || 0;

        try {
            // Nota: Para búsquedas complejas, usamos corePrisma directamente o expandimos el adapter.
            // Dado que getLogs es una operación de lectura pesada, mantendremos el acceso a corePrisma 
            // pero importándolo correctamente.
            const [items, total] = await Promise.all([
                prisma.auditTrail.findMany({
                    where,
                    orderBy: { createdAt: 'desc' },
                    take: limit,
                    skip: offset,
                    include: {
                        actor: {
                            select: { name: true, email: true },
                        },
                    },
                }),
                prisma.auditTrail.count({ where }),
            ]);

            return { items, total, limit, offset };
        } catch (error) {
            console.error('[AuditService] Error fetching logs:', error);
            return { items: [], total: 0, limit, offset, error: 'Error al cargar los logs de auditoría' };
        }
    }

    /**
     * Helper para construir llamadas a log desde requests de Express
     * que inyecta automáticamente metadatos de suplantación (impersonation).
     */
    static buildPayloadWithAuth(req: any, basePayload: Omit<CreateAuditLogInput, 'tenantId' | 'userId' | 'isImpersonated' | 'performedByRealUserId' | 'impersonationSessionId'> & Partial<CreateAuditLogInput>): CreateAuditLogInput {
        return {
            ...basePayload,
            tenantId: basePayload.tenantId || req.tenantId,
            userId: basePayload.userId || req.effectiveUserId || req.user?.id,
            isImpersonated: req.isImpersonating || false,
            performedByRealUserId: req.realUserId || undefined,
            impersonationSessionId: req.impersonationSessionId || undefined,
            ipAddress: req.ip || basePayload.ipAddress,
            userAgent: req.headers['user-agent'] || basePayload.userAgent,
        };
    }
}
