import { prisma } from '@/lib/prisma';
import { AuditService } from '../../audit/audit.service';
import { AnalyticsService } from '../../analytics/analytics.service';
import { InboxService } from '../services/inbox.service';
import { InboxContext } from '../types/inbox-role.types';

export interface AssignThreadInput {
    threadId: string;
    assignedUserId: string; // Cambio: YA NO PERMITE NULL. Para liberar usar unassignThread.
}

/**
 * Caso de uso: Asignar / Reasignar un thread a un agente
 *
 * Solo puede ejecutarlo: Supervisor y Admin.
 *
 * Reglas:
 * - Solo actualiza assignedUserId = targetUserId.
 * - NO cambia handling_mode (si estaba en IA sigue en IA).
 * - NO pausa reactivamente la IA.
 */
export async function assignThread(ctx: InboxContext, input: AssignThreadInput) {
    const { threadId, assignedUserId } = input;
    const { tenantId, userId } = ctx;

    // 1. Validar existencia
    const thread = await InboxService.validateThreadAccess(ctx, threadId);

    if (!assignedUserId) {
        throw { status: 400, code: 'INVALID_INPUT', message: 'Se requiere un usuario destino para asignar, use unassign para liberar' };
    }

    const previousUserId = thread.assignedUserId;

    // 2. Ejecutar asignación pura
    const updated = await prisma.whatsappThread.update({
        where: { id: threadId },
        data: { assignedUserId }
    });

    // 3. Audit Log
    await AuditService.log({
        tenantId,
        userId,
        action: 'THREAD_ASSIGNED',
        modelType: 'thread',
        modelId: threadId,
        oldValues: { assignedUserId: previousUserId },
        newValues: { assignedUserId },
        description: `Thread asignado administrativamente al usuario ${assignedUserId} por ${userId}`
    });

    // 4. Analytics
    AnalyticsService.emitEvent({
        tenantId,
        eventType: 'THREAD_ASSIGNED_TO_HUMAN',
        channel: 'whatsapp',
        threadId,
        actorType: 'HUMAN',
        actorUserId: userId, // el que hizo la accion (admin)
        meta: { previousUserId, newUserId: assignedUserId, action: 'admin_assign' }
    });

    return updated;
}
