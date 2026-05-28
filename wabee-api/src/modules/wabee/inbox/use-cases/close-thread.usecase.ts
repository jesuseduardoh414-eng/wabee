import { prisma } from '@/lib/prisma';
import { AuditService } from '../../audit/audit.service';
import { AnalyticsService } from '../../analytics/analytics.service';
import { InboxService } from '../services/inbox.service';
import { InboxContext } from '../types/inbox-role.types';

export interface CloseThreadInput {
    threadId: string;
}

/**
 * Caso de uso: Cerrar una conversación
 *
 * - Agent: puede cerrar solo threads asignados a él (ownership check via validateThreadAccess)
 * - Supervisor / Admin: pueden cerrar cualquier thread del tenant
 *
 * Registra en AuditService y AnalyticsService (evento THREAD_STATUS_CHANGED).
 */
export async function closeThread(ctx: InboxContext, input: CloseThreadInput) {
    const { threadId } = input;
    const { tenantId, userId } = ctx;

    // 1. Validar acceso (Agent: solo si asignado, Supervisor: libre)
    const thread = await InboxService.validateThreadAccess(ctx, threadId);

    if (thread.status === 'CLOSED') {
        throw { status: 409, code: 'THREAD_ALREADY_CLOSED', message: 'El thread ya está cerrado.' };
    }

    const now = new Date();
    const durationSeconds = Math.floor((now.getTime() - thread.createdAt.getTime()) / 1000);

    // 2. Actualizar status a CLOSED
    const updated = await prisma.whatsappThread.update({
        where: { id: threadId },
        data: { status: 'CLOSED' }
    });

    // 3. Audit Log
    await AuditService.log({
        tenantId,
        userId,
        action: 'THREAD_CLOSED',
        modelType: 'thread',
        modelId: threadId,
        oldValues: { status: thread.status },
        newValues: { status: 'CLOSED' },
        description: `Thread cerrado por usuario ${userId}`
    });

    // 4. Analytics
    AnalyticsService.emitEvent({
        tenantId,
        eventType: 'THREAD_STATUS_CHANGED',
        channel: 'whatsapp',
        threadId,
        actorType: 'HUMAN',
        actorUserId: userId,
        meta: {
            fromStatus: thread.status,
            toStatus: 'CLOSED',
            duration_seconds: durationSeconds,
            was_escalated: !!thread.assignedUserId || thread.status === 'SNOOZED'
        }
    });

    return updated;
}
