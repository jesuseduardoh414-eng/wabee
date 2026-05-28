/**
 * ThreadStateOrchestrator
 * =======================
 * Servicio ÚNICO autorizado para transicionar:
 *   - WhatsappThread.handling_mode
 *   - ConversationState.mode
 *
 * REGLA: Ningún otro servicio actualiza esos campos directamente.
 * Todas las transiciones se ejecutan en transacciones atómicas.
 */

import { prisma } from '@/lib/prisma';
import { ChannelAiMode, ThreadHandlingMode, MessageSenderType, MessageGeneratedBy, ConversationMode } from '@prisma/client';
import { AnalyticsService } from '../../analytics/analytics.service';
import { aiAuditService } from '../../ai/ai.audit.service';

export interface HandlingStatus {
    handlingMode: ThreadHandlingMode | null;
    aiPaused: boolean;
    assignedAiProfileId: string | null;
    assignedUserId: string | null;
    humanTakeoverBy: string | null;
    humanTakeoverAt: Date | null;
    conversationMode: ConversationMode;
}

export class ThreadStateOrchestrator {

    /**
     * openThread()
     * ─────────────
     * Llamado UNA VEZ al crearse o reabrirse un thread.
     * Lee la configuración del canal y asigna handling_mode inicial.
     *
     * Tabla de resolución (v3 FINAL):
     *   ai_enabled=true  + ai_mode='autonomous'   → handling_mode='ai'
     *   ai_enabled=true  + ai_mode='copilot_only' → handling_mode='copilot'
     *   ai_enabled=true  + ai_mode='disabled'     → handling_mode='human_queue'
     *   ai_enabled=false + (cualquier ai_mode)    → handling_mode='human_queue'
     *   Sin default_ai_profile_id pero ai_enabled → handling_mode='human_queue' + warning
     */
    static async openThread(
        threadId: string,
        tenantId: string,
        channelId: string,
    ): Promise<void> {
        const channel = await prisma.whatsappChannel.findFirst({
            where: { id: channelId, tenantId },
            select: {
                aiEnabled: true,
                aiMode: true,
                defaultAiProfileId: true,
            },
        });

        let handlingMode: ThreadHandlingMode = ThreadHandlingMode.human_queue;
        let assignedAiProfileId: string | null = null;

        if (channel?.aiEnabled && channel.aiMode !== ChannelAiMode.disabled) {
            if (!channel.defaultAiProfileId) {
                console.warn(
                    `[ThreadStateOrchestrator] ⚠️ Canal ${channelId} tiene ai_enabled=true pero sin default_ai_profile_id → fallback a human_queue`,
                );
            } else {
                assignedAiProfileId = channel.defaultAiProfileId;
                handlingMode =
                    channel.aiMode === ChannelAiMode.copilot_only
                        ? ThreadHandlingMode.copilot
                        : ThreadHandlingMode.ai;
            }
        }

        const conversationMode =
            handlingMode === ThreadHandlingMode.ai || handlingMode === ThreadHandlingMode.copilot
                ? ConversationMode.AI_MANAGED
                : ConversationMode.DISABLED;

        await prisma.$transaction([
            prisma.whatsappThread.update({
                where: { id: threadId },
                data: {
                    handlingMode,
                    assignedAiProfileId,
                },
            }),
            prisma.conversationState.upsert({
                where: { threadId },
                create: {
                    tenantId,
                    threadId,
                    mode: conversationMode,
                },
                update: {
                    mode: conversationMode,
                },
            }),
        ]);

        console.log(
            `[ThreadStateOrchestrator] ✅ openThread: thread=${threadId} → handling_mode=${handlingMode}, conv_mode=${conversationMode}`,
        );
    }

    /**
     * aiHandoff()
     * ─────────────
     * La IA decide escalar (keywords, baja confianza, error LLM).
     * Thread pasa a 'human_queue' esperando que un agente tome control.
     * ConversationState pasa a 'HUMAN_HANDOFF'.
     */
    static async aiHandoff(
        threadId: string,
        tenantId: string,
        reason: string,
    ): Promise<void> {
        await prisma.$transaction([
            prisma.whatsappThread.update({
                where: { id: threadId },
                data: {
                    handlingMode: ThreadHandlingMode.human_queue,
                    aiPaused: true,
                    aiPausedAt: new Date(),
                    aiPausedByUserId: 'SYSTEM_AI',
                    lastResponderType: MessageSenderType.system,
                },
            }),
            prisma.conversationState.upsert({
                where: { threadId },
                create: {
                    tenantId,
                    threadId,
                    mode: ConversationMode.HUMAN_HANDOFF,
                    handoffReason: reason,
                    handoffAt: new Date(),
                },
                update: {
                    mode: ConversationMode.HUMAN_HANDOFF,
                    handoffReason: reason,
                    handoffAt: new Date(),
                },
            }),
        ]);

        // Emitir analytics
        AnalyticsService.emitEvent({
            tenantId,
            eventType: 'AI_FALLBACK_TO_HUMAN',
            channel: 'whatsapp',
            threadId,
            actorType: 'AI',
            meta: { reason },
        });

        console.log(`[ThreadStateOrchestrator] 🔄 aiHandoff: thread=${threadId}, reason=${reason}`);
    }

    /**
     * humanTakeover()
     * ─────────────────
     * Un humano toma control explícito del thread.
     * Pausa la IA permanentemente en este thread (V1: sin auto-resume).
     *
     * Política assignedUserId (v3 §4):
     *   - Si no hay asignación previa → asignar al userId actual
     *   - Si ya existe assignedUserId diferente → preservar; solo registrar humanTakeoverBy
     */
    static async humanTakeover(
        threadId: string,
        tenantId: string,
        userId: string,
        reason: string = 'manual_intervention',
    ): Promise<void> {
        const thread = await prisma.whatsappThread.findFirst({
            where: { id: threadId, tenantId },
            select: { assignedUserId: true, handlingMode: true },
        });

        if (!thread) {
            throw { status: 404, code: 'THREAD_NOT_FOUND', message: 'Thread no encontrado.' };
        }

        // Determinar si se actualiza assignedUserId (solo si no hay asignación previa)
        const shouldAssign = !thread.assignedUserId;
        const now = new Date();

        await prisma.$transaction([
            prisma.whatsappThread.update({
                where: { id: threadId },
                data: {
                    handlingMode: ThreadHandlingMode.human,
                    aiPaused: true,
                    aiPausedAt: now,
                    aiPausedByUserId: userId,
                    humanTakeoverAt: now,
                    humanTakeoverBy: userId,
                    takeoverReason: reason,
                    lastResponderType: MessageSenderType.human,
                    ...(shouldAssign && { assignedUserId: userId }),
                },
            }),
            prisma.conversationState.upsert({
                where: { threadId },
                create: {
                    tenantId,
                    threadId,
                    mode: ConversationMode.HUMAN_HANDOFF,
                    handoffReason: reason,
                    handoffAt: now,
                },
                update: {
                    mode: ConversationMode.HUMAN_HANDOFF,
                    handoffReason: reason,
                    handoffAt: now,
                },
            }),
        ]);

        // Emitir analytics
        AnalyticsService.emitEvent({
            tenantId,
            eventType: 'HUMAN_TAKEOVER',
            channel: 'whatsapp',
            threadId,
            actorType: 'HUMAN',
            actorUserId: userId,
            meta: { reason, assignedUserId: shouldAssign ? userId : thread.assignedUserId },
        });

        console.log(
            `[ThreadStateOrchestrator] 👤 humanTakeover: thread=${threadId}, user=${userId}, reason=${reason}, assigned=${shouldAssign}`,
        );
    }

    /**
     * saveAiSuggestion()
     * ───────────────────
     * Persiste la sugerencia de IA en modo copilot_only.
     * La sugerencia NO se envía al cliente. Solo visible para el agente en el inbox.
     * Se guarda como WhatsappThreadNote con prefix [AI_SUGGESTION].
     */
    static async saveAiSuggestion(
        threadId: string,
        tenantId: string,
        suggestedText: string,
    ): Promise<void> {
        await prisma.whatsappThreadNote.create({
            data: {
                tenantId,
                threadId,
                body: `[AI_SUGGESTION] ${suggestedText}`,
                createdById: null, // null = generado por IA/sistema
                isPinned: false,
            },
        });

        console.log(`[ThreadStateOrchestrator] 💡 saveAiSuggestion: thread=${threadId}`);
    }

    /**
     * resumeAi()
     * ─────────────────
     * Reanuda la inteligencia artificial en el thread indicado.
     * Limpia la pausa manual (`aiPaused = false`) y devuelve
     * el estado de handling a 'ai'.
     */
    static async resumeAi(
        threadId: string,
        tenantId: string,
        userId: string,
    ): Promise<void> {
        const thread = await prisma.whatsappThread.findFirst({
            where: { id: threadId, tenantId },
            select: { id: true }
        });

        if (!thread) {
            throw { status: 404, code: 'THREAD_NOT_FOUND', message: 'Thread no encontrado.' };
        }

        await prisma.$transaction([
            prisma.whatsappThread.update({
                where: { id: threadId },
                data: {
                    handlingMode: ThreadHandlingMode.ai,
                    aiPaused: false,
                    aiPausedAt: null,
                    aiPausedByUserId: null,
                    lastResponderType: MessageSenderType.system,
                },
            }),
            prisma.conversationState.upsert({
                where: { threadId },
                create: {
                    tenantId,
                    threadId,
                    mode: ConversationMode.AI_MANAGED,
                },
                update: {
                    mode: ConversationMode.AI_MANAGED,
                    handoffReason: null,
                    handoffAt: null,
                },
            }),
        ]);

        AnalyticsService.emitEvent({
            tenantId,
            eventType: 'THREAD_STATUS_CHANGED', // AI_RESUMED no existe en el enum restringido
            channel: 'whatsapp',
            threadId,
            actorType: 'HUMAN',
            actorUserId: userId,
            meta: { action: 'AI_RESUMED' },
        });

        console.log(`[ThreadStateOrchestrator] 🤖 resumeAi: thread=${threadId}, user=${userId}`);
    }

    /**
     * getHandlingStatus()
     * ─────────────────────
     * Estado actual de atención del thread. Solo lectura, sin mutación.
     */
    static async getHandlingStatus(
        threadId: string,
        tenantId: string,
    ): Promise<HandlingStatus> {
        const [thread, state] = await Promise.all([
            prisma.whatsappThread.findFirst({
                where: { id: threadId, tenantId },
                select: {
                    handlingMode: true,
                    aiPaused: true,
                    assignedAiProfileId: true,
                    assignedUserId: true,
                    humanTakeoverBy: true,
                    humanTakeoverAt: true,
                },
            }),
            prisma.conversationState.findUnique({
                where: { threadId },
                select: { mode: true },
            }),
        ]);

        if (!thread) {
            throw { status: 404, code: 'THREAD_NOT_FOUND', message: 'Thread no encontrado.' };
        }

        return {
            handlingMode: thread.handlingMode,
            aiPaused: thread.aiPaused,
            assignedAiProfileId: thread.assignedAiProfileId,
            assignedUserId: thread.assignedUserId,
            humanTakeoverBy: thread.humanTakeoverBy,
            humanTakeoverAt: thread.humanTakeoverAt,
            conversationMode: state?.mode ?? ConversationMode.DISABLED,
        };
    }

    /**
     * shouldAiRespond()
     * ──────────────────
     * Helper: determina si la IA debe responder en este thread.
     * Gate centralizado — el adapter lo llama antes de invocar el orchestrator.
     */
    static shouldAiRespond(
        thread: {
            handlingMode: ThreadHandlingMode | null;
            aiPaused: boolean;
        },
        channel: {
            aiEnabled: boolean;
            aiMode: ChannelAiMode;
            defaultAiProfileId: string | null;
        },
        conversationMode: ConversationMode,
    ): { respond: boolean; reason: string } {
        if (!channel.aiEnabled) return { respond: false, reason: 'channel_ai_disabled' };
        if (channel.aiMode === ChannelAiMode.disabled) return { respond: false, reason: 'channel_mode_disabled' };
        if (!channel.defaultAiProfileId) return { respond: false, reason: 'no_ai_profile_configured' };
        if (thread.aiPaused) return { respond: false, reason: 'thread_ai_paused_by_human_takeover' };
        if (thread.handlingMode === ThreadHandlingMode.human) return { respond: false, reason: 'thread_in_human_mode' };
        if (thread.handlingMode === ThreadHandlingMode.human_queue) return { respond: false, reason: 'thread_in_human_queue' };
        if (thread.handlingMode === ThreadHandlingMode.paused) return { respond: false, reason: 'thread_paused' };
        if (conversationMode === ConversationMode.HUMAN_HANDOFF) return { respond: false, reason: 'conversation_in_handoff' };
        if (conversationMode === ConversationMode.DISABLED) return { respond: false, reason: 'conversation_disabled' };
        return { respond: true, reason: 'ok' };
    }
}
