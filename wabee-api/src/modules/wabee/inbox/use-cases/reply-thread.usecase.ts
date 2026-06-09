import * as inboxService from '../whatsapp/whatsapp.inbox.service';
import { InboxService } from '../services/inbox.service';
import { InboxContext } from '../types/inbox-role.types';
import { ThreadStateOrchestrator } from '../services/thread.state.orchestrator';
import { MessageSenderType, MessageGeneratedBy } from '@prisma/client';

export interface ReplyThreadInput {
    threadId: string;
    text: string;
}

/**
 * Caso de uso: Responder un thread
 *
 * - Agent: puede responder solo si el thread está asignado a él
 * - Supervisor / Admin: pueden responder cualquier thread del tenant
 *
 * Reutiliza el servicio de envío existente del módulo WhatsApp (inboxService.sendMessage).
 */
export async function replyThread(ctx: InboxContext, input: ReplyThreadInput) {
    const { threadId, text } = input;
    const { tenantId } = ctx;

    // 1. Validar acceso (tenant isolation + ownership check para Agent)
    await InboxService.validateThreadAccess(ctx, threadId);

    // 2. Delegar al servicio de envío con trazabilidad
    const message = await inboxService.sendMessage(tenantId, threadId, { text }, {
        senderType: MessageSenderType.human,
        senderUserId: ctx.userId,
        generatedBy: MessageGeneratedBy.user,
    });

    // 3. Auto-takeover: el primer mensaje humano toma el control del thread automáticamente
    if (ctx.userId) {
        await ThreadStateOrchestrator.humanTakeover(
            threadId,
            tenantId,
            ctx.userId,
            'auto_reply_takeover'
        );
    }

    return message;
}
