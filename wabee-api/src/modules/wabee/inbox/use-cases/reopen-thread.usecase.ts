import { prisma } from '@/lib/prisma';
import { AuditService } from '../../audit/audit.service';
import { AnalyticsService } from '../../analytics/analytics.service';
import { InboxService } from '../services/inbox.service';
import { InboxContext } from '../types/inbox-role.types';

export interface ReopenThreadInput {
    threadId: string;
}

/**
 * Caso de uso: Reabrir una conversación cerrada
 *
 * Solo puede ejecutarlo: Supervisor y Admin.
 * El guard en la ruta ya bloquea al Agent con 403 antes de llegar aquí.
 *
 * Cambia el status de CLOSED a OPEN.
 * Registra en AuditService y AnalyticsService (THREAD_REOPENED).
 */
export async function reopenThread(ctx: InboxContext, input: ReopenThreadInput) {
    const { threadId } = input;
    const { tenantId, userId } = ctx;

    // 1. Validar que el thread existe en el tenant (Supervisor bypasea ownership)
    const thread = await InboxService.validateThreadAccess(ctx, threadId);

    if (thread.status !== 'CLOSED') {
        throw {
            status: 409,
            code: 'THREAD_NOT_CLOSED',
            message: `El thread no está cerrado (estado actual: "${thread.status}"). Solo se pueden reabrir threads cerrados.`
        };
    }

    // 2. Actualizar status a OPEN
    const updated = await prisma.whatsappThread.update({
        where: { id: threadId },
        data: { status: 'OPEN' }
    });

    // 3. Audit Log
    await AuditService.log({
        tenantId,
        userId,
        action: 'THREAD_REOPENED',
        modelType: 'thread',
        modelId: threadId,
        oldValues: { status: 'CLOSED' },
        newValues: { status: 'OPEN' },
        description: `Thread reabierto por supervisor ${userId}`
    });

    // 4. Analytics
    AnalyticsService.emitEvent({
        tenantId,
        eventType: 'THREAD_REOPENED',
        channel: 'whatsapp',
        threadId,
        actorType: 'HUMAN',
        actorUserId: userId,
        meta: { reopenedAt: new Date(), reopenedBy: userId }
    });

    return updated;
}
