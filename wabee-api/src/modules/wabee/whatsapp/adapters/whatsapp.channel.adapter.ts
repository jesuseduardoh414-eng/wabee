import { prisma } from '@/lib/prisma';
import { UniversalMessageContext, aiOrchestratorService } from '../../ai/ai.orchestrator.service';
import { sendMessage } from '../../inbox/whatsapp/whatsapp.inbox.service';
import { aiAuditService } from '../../ai/ai.audit.service';
import { AnalyticsService } from '../../analytics/analytics.service';
import { WhatsappMessage, ChannelAiMode, MessageSenderType, MessageGeneratedBy } from '@prisma/client';
import { ChannelAiConfigService } from '../../channels/channel.ai-config.service';
import { ThreadStateOrchestrator } from '../../inbox/services/thread.state.orchestrator';
import { InboxAuditService } from '../../audit/inbox-audit.service';

export class WhatsAppChannelAdapter {

    /**
     * Intercepta el flujo del webhook para evaluar si debe ser contestado por IA.
     * Retorna true si la IA manejó el mensaje (para saltar otro procesamiento) o false.
     */
    static async handleInbound(
        tenantId: string,
        channelId: string,
        threadId: string,
        contactId: string | undefined,
        inboundMessage: WhatsappMessage
    ): Promise<boolean> {

        // ─── 1. Resolver configuración efectiva del canal ─────────────────────
        const resolved = await ChannelAiConfigService.resolveEffectiveAiProfile(channelId, tenantId);

        if (!resolved.profileId) {
            console.log(`[AI-Adapter] ❌ Sin AI Profile efectivo para canal ${channelId} — flujo humano.`);
            return false;
        }

        // ─── 2. Leer canal y estado del thread para el gate centralizado ─────
        const [channel, thread, convState] = await Promise.all([
            prisma.whatsappChannel.findFirst({
                where: { id: channelId, tenantId },
                select: { aiEnabled: true, aiMode: true, defaultAiProfileId: true },
            }),
            prisma.whatsappThread.findFirst({
                where: { id: threadId, tenantId },
                select: { handlingMode: true, aiPaused: true, assignedAiProfileId: true },
            }),
            prisma.conversationState.findUnique({
                where: { threadId },
                select: { mode: true },
            }),
        ]);

        if (!channel) return false;

        // ─── 3. Inicializar thread si no tiene handling_mode aún ────────────
        if (!thread?.handlingMode) {
            await ThreadStateOrchestrator.openThread(threadId, tenantId, channelId);
            // Releer tras inicialización
            const freshThread = await prisma.whatsappThread.findFirst({
                where: { id: threadId, tenantId },
                select: { handlingMode: true, aiPaused: true },
            });
            if (freshThread) {
                Object.assign(thread ?? {}, freshThread);
            }
        }

        // ─── 4. Gate centralizado — ¿Debe responder la IA? ──────────────────
        const gate = ThreadStateOrchestrator.shouldAiRespond(
            { handlingMode: thread?.handlingMode ?? null, aiPaused: thread?.aiPaused ?? false },
            { aiEnabled: channel.aiEnabled, aiMode: channel.aiMode, defaultAiProfileId: channel.defaultAiProfileId },
            convState?.mode ?? 'DISABLED' as any,
        );

        if (!gate.respond) {
            console.log(`[AI-Adapter] ⏭️ Gate bloqueó IA — reason: ${gate.reason}`);
            return false;
        }

        console.log(`[AI-Adapter] ✅ Gate OK. ProfileId=${resolved.profileId}, source=${resolved.source}, mode=${channel.aiMode}`);

        // ─── 5. Mapear contexto universal ────────────────────────────────────
        const context: UniversalMessageContext = {
            tenantId,
            channelType: 'WHATSAPP',
            channelId,
            threadId,
            contactId,
            userIdentificator: inboundMessage.remotePhone,
            message: {
                id: inboundMessage.id,
                text: inboundMessage.textBody || '',
                type: inboundMessage.type === 'text' ? 'text' : inboundMessage.type,
            },
            aiConfig: {
                profileId: resolved.profileId,
                enabled: true,
                handoffKeys: resolved.handoffKeys,
            },
        };

        // ─── 6. Orquestar ────────────────────────────────────────────────────
        const decision = await aiOrchestratorService.processInbound(context);
        console.log(`[AI-Adapter] 🗓️ Decisión: action=${decision.action}`);

        // ─── 7. Ejecutar decisión ────────────────────────────────────────────

        if (decision.action === 'NO_AI' || decision.action === 'SKIP') {
            return false;
        }

        if (decision.action === 'HANDOFF') {
            const handoffText = decision.replyText || 'Te comunico con un agente humano.';
            await this.sendOutbound(tenantId, channelId, threadId, context.userIdentificator, handoffText, {
                senderType: MessageSenderType.system,
                aiProfileId: resolved.profileId,
                generatedBy: MessageGeneratedBy.ai,
            });
            await ThreadStateOrchestrator.aiHandoff(threadId, tenantId, decision.handoffReason || 'orchestrator_decision');

            // ── NUEVO: Registro en Auditoría de Atención ──
            await InboxAuditService.logWithSnapshots({
                tenantId,
                threadId,
                channelId,
                actorType: 'ai',
                actorUserId: resolved.profileId,
                actorRole: 'bot',
                eventType: 'AI_HANDOFF_TO_HUMAN',
                description: `Derivación automática: ${decision.handoffReason || 'baja confianza'}`,
                metadata: { intent: decision.meta?.intent, kbScore: decision.meta?.kbBestScore }
            });

            return true;
        }

        if (decision.action === 'REPLY' && decision.replyText) {

            // Modo copilot_only: sugerencia interna, NO outbound al cliente
            if (channel.aiMode === ChannelAiMode.copilot_only) {
                await ThreadStateOrchestrator.saveAiSuggestion(threadId, tenantId, decision.replyText);
                console.log(`[AI-Adapter] 💡 copilot_only: sugerencia guardada como ThreadNote (no enviada al cliente)`);
                return true;
            }

            // Modo autonomous: enviar respuesta al cliente
            const sentMessage = await this.sendOutbound(
                tenantId,
                channelId,
                threadId,
                context.userIdentificator,
                decision.replyText,
                {
                    senderType: MessageSenderType.ai,
                    aiProfileId: resolved.profileId,
                    generatedBy: MessageGeneratedBy.ai,
                },
            );

            // Audit log
            await aiAuditService.createLog({
                tenantId,
                channel: 'WHATSAPP',
                threadId,
                effectivePrompt: decision.meta?.systemPrompt || 'SYSTEM_PROMPT',
                model: decision.meta?.model || 'GEMINI',
                responseText: decision.replyText,
                confidenceScore: 0.9,
                action: 'RESPONDED',
                kbChunkIds: decision.kbChunksUsed || [],
                kbFileIds: decision.kbFilesUsed || [],
            });

            // Analytics
            AnalyticsService.emitEvent({
                tenantId,
                eventType: 'MESSAGE_OUTBOUND_AI',
                channel: 'whatsapp',
                threadId,
                actorType: 'AI',
                meta: {
                    messageId: sentMessage.id,
                    tokens: decision.tokensUsed || 0,
                    intent: decision.meta?.intent || 'UNKNOWN',
                    profileId: resolved.profileId,
                },
            });

            // Actualizar last_responder_type en el thread
            await prisma.whatsappThread.update({
                where: { id: threadId },
                data: { lastResponderType: MessageSenderType.ai },
            });

            console.log(`[AI-Adapter] 📤 Respuesta IA enviada: msgId=${sentMessage.id}`);
            return true;
        }

        return false;
    }

    private static async sendOutbound(
        tenantId: string,
        channelId: string,
        threadId: string,
        toPhone: string,
        text: string,
        traceData: {
            senderType: MessageSenderType;
            aiProfileId: string | null;
            generatedBy: MessageGeneratedBy;
        },
    ) {
        const outboundMsg = await sendMessage(tenantId, threadId, text, {
            senderType: traceData.senderType,
            aiProfileId: traceData.aiProfileId,
            generatedBy: traceData.generatedBy
        });

        return outboundMsg;
    }
}
