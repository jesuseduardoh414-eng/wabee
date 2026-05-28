import { prisma } from '@/lib/prisma';
import { AuditService } from '../../audit/audit.service';
import { AnalyticsService } from '../../analytics/analytics.service';
import { InboxService } from '../services/inbox.service';
import { InboxContext } from '../types/inbox-role.types';
import { ThreadHandlingMode } from '@prisma/client';

export interface UnassignThreadInput {
    threadId: string;
}

/**
 * Caso de uso: Liberar un thread
 * 
 * Reglas (V1):
 * - assignedUserId = null
 * - Si estaba en handling_mode = human (o si aiPaused=true), forzar estado a human_queue para que esté libre.
 * - Mantiene aiPaused = true. La IA no se reanuda automáticamente.
 */
export async function unassignThread(ctx: InboxContext, input: UnassignThreadInput) {
    const { threadId } = input;
    const { tenantId, userId } = ctx;

    const thread = await InboxService.validateThreadAccess(ctx, threadId);
    const previousUserId = thread.assignedUserId;

    if (!previousUserId) {
        return prisma.whatsappThread.findUnique({ where: { id: threadId } });
    }

    // Regla V1: si era humano, vuelve a human_queue
    const newHandlingMode = thread.handlingMode === ThreadHandlingMode.human || thread.aiPaused 
        ? ThreadHandlingMode.human_queue 
        : thread.handlingMode;

    const updated = await prisma.whatsappThread.update({
        where: { id: threadId },
        data: { 
            assignedUserId: null,
            handlingMode: newHandlingMode as any
        }
    });

    await AuditService.log({
        tenantId,
        userId,
        action: 'THREAD_UNASSIGNED',
        modelType: 'thread',
        modelId: threadId,
        oldValues: { assignedUserId: previousUserId, handlingMode: thread.handlingMode },
        newValues: { assignedUserId: null, handlingMode: newHandlingMode },
        description: `Hilo liberado por ${userId}.`
    });

    AnalyticsService.emitEvent({
        tenantId,
        eventType: 'THREAD_UNASSIGNED',
        channel: 'whatsapp',
        threadId,
        actorType: 'HUMAN',
        actorUserId: userId,
        meta: { previousUserId }
    });

    return updated;
}
