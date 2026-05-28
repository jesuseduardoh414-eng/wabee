import { prisma } from '@/lib/prisma';
import { AuditService } from '../../audit/audit.service';
import { AnalyticsService } from '../../analytics/analytics.service';
import { InboxService } from '../services/inbox.service';
import { InboxContext } from '../types/inbox-role.types';
import { InboxAuditService } from '../../audit/inbox-audit.service';

export interface TakeThreadInput {
    threadId: string;
}

/**
 * Caso de uso: Tomar un thread libre
 * 
 * Reglas:
 * - El thread debe estar con assignedUserId = null.
 * - assignedUserId pasa a ser el del usuario actual.
 * - handlingMode pasa a 'human' temporariamente, bloqueando IA.
 * - aiPaused se fija en true para pausar la IA mientras el agente opera.
 * - Usamos actualización atómica optimística para prevenir concurrencia.
 */
export async function takeThread(ctx: InboxContext, input: TakeThreadInput) {
    const { threadId } = input;
    const { tenantId, userId } = ctx;

    // 1. Validar existencia del thread en el tenant
    const thread = await InboxService.validateThreadAccess(ctx, threadId);

    if (thread.assignedUserId) {
        throw { status: 409, code: 'THREAD_ALREADY_ASSIGNED', message: 'El hilo ya ha sido tomado por otro usuario.' };
    }

    // 2. Toma Atómica (Optimistic Concurrency Control)
    const { count } = await prisma.whatsappThread.updateMany({
        where: { 
            id: threadId, 
            tenantId,
            assignedUserId: null 
        },
        data: { 
            assignedUserId: userId,
            handlingMode: 'human',
            aiPaused: true,
            aiPausedAt: new Date(),
            aiPausedByUserId: userId
        }
    });

    if (count === 0) {
        throw { status: 409, code: 'CONCURRENCY_CONFLICT', message: 'No se pudo tomar el hilo. Es posible que otro usuario lo haya tomado recién.' };
    }

    // Fetcha el thread actualizado
    const updated = await prisma.whatsappThread.findUnique({ where: { id: threadId } });

    // 3. Audit Log (técnico)
    await AuditService.log({
        tenantId,
        userId,
        action: 'THREAD_TAKEN',
        modelType: 'thread',
        modelId: threadId,
        oldValues: { assignedUserId: null },
        newValues: { assignedUserId: userId, handlingMode: 'human', aiPaused: true },
        description: `Usuario ${userId} tomó el thread y pausó la IA.`
    });

    // 3b. Inbox Audit Log (trazabilidad operativa)
    InboxAuditService.logWithSnapshots({
        tenantId,
        threadId,
        channelId: updated?.channelId,
        contactId: updated?.contactId,
        actorType: 'human',
        actorUserId: userId,
        actorRole: ctx.role as any,
        eventType: 'THREAD_TAKEN',
        description: 'Agente tomó el chat y pausó la IA.',
    });

    // 4. Analytics
    AnalyticsService.emitEvent({
        tenantId,
        eventType: 'THREAD_ASSIGNED_TO_HUMAN',
        channel: 'whatsapp',
        threadId,
        actorType: 'HUMAN',
        actorUserId: userId,
        meta: { previousUserId: null, newUserId: userId, action: 'take_chat' }
    });

    return updated;
}
