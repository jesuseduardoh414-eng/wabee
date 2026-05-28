import { prisma } from '@/lib/prisma';
import { AuditService } from '../../audit/audit.service';
import { AnalyticsService } from '../../analytics/analytics.service';
import { InboxService } from '../services/inbox.service';
import { InboxContext } from '../types/inbox-role.types';

export interface ForceHumanTakeoverInput {
    threadId: string;
}

/**
 * Caso de uso: Forzar takeover humano (pausar la IA en un thread)
 *
 * Solo puede ejecutarlo: Supervisor y Admin.
 * El guard en la ruta bloquea al Agent con 403 antes de llegar aquí.
 *
 * Efectos:
 * 1. Limpia currentFlowVersionId (detiene el flujo IA activo)
 * 2. Actualiza contextState para marcar el estado de takeover manual
 * 3. Registra el evento en AuditService (crítico para governance de IA)
 * 4. Emite HUMAN_TAKEOVER en AnalyticsService
 *
 * NOTA TÉCNICA:
 * En el schema actual de WhatsappThread:
 *   - `currentFlowVersionId` representa la versión del flujo IA activo.
 *     Limpiarlo (null) detiene la ejecución del flujo automático.
 *   - `contextState` es un campo JSON libre que almacena el estado de la conversación.
 *     Se enriquece con metadatos de takeover sin romper la estructura existente.
 */
export async function forceHumanTakeover(ctx: InboxContext, input: ForceHumanTakeoverInput) {
    const { threadId } = input;
    const { tenantId, userId } = ctx;

    // 1. Validar que el thread existe en el tenant (Supervisor bypasea ownership)
    const thread = await InboxService.validateThreadAccess(ctx, threadId);

    // 2. Construir el nuevo contextState con metadatos de takeover
    const previousContextState = (thread.contextState as Record<string, any>) ?? {};

    const updatedContextState = {
        ...previousContextState,
        aiPaused: true,
        humanTakeover: true,
        takeoverAt: new Date().toISOString(),
        takeoverBy: userId,
        // Preservar estado anterior si existía
        _preTakeoverFlowVersionId: thread.currentFlowVersionId ?? null
    };

    // 3. Actualizar thread: limpiar flujo IA + marcar takeover en contextState
    const updated = await prisma.whatsappThread.update({
        where: { id: threadId },
        data: {
            currentFlowVersionId: null,  // Pausar IA (flujo)
            contextState: updatedContextState
        }
    });

    // 4. Audit Log (crítico para governance de IA)
    await AuditService.log({
        tenantId,
        userId,
        action: 'HUMAN_TAKEOVER_FORCED',
        modelType: 'thread',
        modelId: threadId,
        oldValues: {
            currentFlowVersionId: thread.currentFlowVersionId,
            aiPaused: previousContextState.aiPaused ?? false
        },
        newValues: {
            currentFlowVersionId: null,
            aiPaused: true,
            humanTakeover: true,
            takeoverBy: userId
        },
        description: `Supervisor ${userId} forzó takeover humano en thread ${threadId}. IA pausada.`
    });

    // 5. Analytics
    AnalyticsService.emitEvent({
        tenantId,
        eventType: 'HUMAN_TAKEOVER',
        channel: 'whatsapp',
        threadId,
        actorType: 'HUMAN',
        actorUserId: userId,
        meta: {
            previousFlowVersionId: thread.currentFlowVersionId ?? null,
            takeoverAt: updatedContextState.takeoverAt,
            takeoverBy: userId
        }
    });

    return {
        threadId: updated.id,
        status: updated.status,
        aiPaused: true,
        takeoverBy: userId,
        takeoverAt: updatedContextState.takeoverAt
    };
}
