import { prisma } from '@/lib/prisma';
import { coreAdapter } from '@/modules/core/core.adapter';
import { WebMessage } from '@prisma/client';
import { env } from '../../../config/env';
import { chatLLM } from './llm.client';
import { buildPersonalitySystemPrompt, buildChatMessages, buildKbAwareSystemPrompt } from './ai.prompt.builder';
import { aiAuditService } from './ai.audit.service';
import { detectIntent, AiIntent } from './ai.intent';
import { sanitizeAssistantText } from './ai.sanitize';
import { kbService } from './kb.service';
import { resolveWidgetContact } from './contact.resolve';
import { renderContactLine } from './contact.render';
import { fallbackTemplates } from './fallback.templates';
import { pickVariant } from './fallback.pick';
import { AnalyticsService } from '../analytics/analytics.service';

type ResponseType = 'AI_MESSAGE' | 'FALLBACK' | 'BLOCKED';

interface DecisionResult {
    type: ResponseType;
    message?: {
        textBody: string;
        htmlBody?: string;
        [key: string]: any;
    };
    fallbackText?: string;
    meta?: any;
}

export class AiWidgetResponderService {

    async decideAndRespondWebWidget(
        tenantId: string,
        widgetId: string,
        threadId: string,
        inboundMessage: WebMessage,
        previewConfig?: any
    ): Promise<DecisionResult> {
        const GLOBAL_ENABLED = env.ENABLE_AI_WIDGET === 'true';

        // 1. Load Context
        const [widget, thread, org] = await Promise.all([
            prisma.webWidget.findUnique({ where: { id: widgetId } }),
            prisma.webThread.findUnique({ where: { id: threadId } }),
            coreAdapter.organizations.getById(tenantId),
        ]);

        if (!widget || !thread || !org) {
            return { type: 'FALLBACK', fallbackText: 'Error: configuración no encontrada.' };
        }


        const aiConfig = {
            ...(widget.ai as any || {}),
            ...(previewConfig?.ai || {}),
            enabled: previewConfig?.features?.aiEnabled ?? previewConfig?.ai?.enabled ?? (widget.ai as any)?.enabled
        };

        // 2. Gating
        const aiEnabled = aiConfig.enabled === true || (env.AI_WIDGET_ALWAYS_RESPOND === 'true');

        if (!GLOBAL_ENABLED || !aiEnabled || thread.aiPaused) {
            console.log(`[AiWidgetResponder] GATED: GLOBAL=${GLOBAL_ENABLED} AI_CONFIG=${aiConfig.enabled} ALWAYS_RESPOND=${env.AI_WIDGET_ALWAYS_RESPOND}`);
            return {
                type: 'FALLBACK',
                fallbackText: aiConfig?.fallbackMessage || 'Por favor contáctanos por nuestros canales oficiales para ayudarte mejor.',
            };
        }

        // 3. Load Profile
        let profileId = aiConfig.profileId;
        // If no profile configured on widget, try tenant default or first available
        if (!profileId) {
            const firstProfile = await prisma.aiProfile.findFirst({
                where: {
                    tenantId,
                    channelType: 'WIDGET'
                }
            });
            if (firstProfile) profileId = firstProfile.id;
        }

        let profile: any = null;
        if (profileId) {
            profile = await prisma.aiProfile.findUnique({
                where: { id: profileId },
            });
        }

        // Fallback profile if missing
        if (!profile) {
            profile = {
                id: 'default',
                name: 'Default Agent',
                systemPrompt: 'Eres un asistente útil.',
                agentName: 'Asistente',
                roleTitle: 'Soporte',
                tones: ['PROFESSIONAL'],
                greetingStyle: 'MEDIUM',
                maxTokens: 512,
                kbEnabled: false,
                fallbackMode: 'CUSTOM',
                confidenceThreshold: 0
            };
        }

        const userText = inboundMessage.text;

        // 4. Intent Detection
        const intent = detectIntent(userText);

        // 5. Identity & Escalation Logic (Smart Passthrough)
        const contact = resolveWidgetContact(widget);
        const rendered = renderContactLine(contact);

        // We no longer bypass here. We search KB first.
        // If KB is empty later, we decide whether to passthrough or hard fallback.

        // Log Phase and Intent
        console.log(`[AiWidgetResponder] PHASE=PERSONA_ONLY INTENT=${intent} MSG="${userText.substring(0, 30)}..."`);

        // === BYPASS: SMALLTALK / CHATTER ===
        // We will send EVERYTHING to the LLM with the Persona prompt, 
        // because the Persona prompt handles greetings/chatter naturally.
        // We only use intent for logging or specific handling if needed.

        // 6. KB Retrieval & Decision Flow
        let kbChunkIds: string[] = [];
        let kbFileIds: string[] = [];
        let kbResults: any[] = [];

        const shouldSearchKb = profile.kbEnabled && (intent === 'BUSINESS_INFO_QUERY' || intent === 'IDENTITY_QUERY' || intent === 'HUMAN_ESCALATION');

        if (shouldSearchKb) {
            try {
                kbResults = await kbService.retrieveTopChunks({
                    tenantId,
                    profileId: profile.id,
                    query: userText,
                    k: 5,
                });

                if (kbResults.length > 0) {
                    kbChunkIds = kbResults.map(r => r.chunkId);
                    kbFileIds = [...new Set(kbResults.map(r => r.fileId))];
                    console.log(`[AiWidgetResponder] KB_FOUND chunks=${kbResults.length} bestScore=${kbResults[0]?.score.toFixed(2)}`);
                } else if (intent === 'BUSINESS_INFO_QUERY') {
                    // Check if we have structured contact info to show in the fallback
                    const contactInfo = resolveWidgetContact(widget);
                    const renderedContact = renderContactLine(contactInfo);

                    if (renderedContact.channel !== 'NONE') {
                        // HARD FALLBACK: Business query + No KB + We HAVE contact info to show
                        console.log(`[AiWidgetResponder] KB_EMPTY for BUSINESS_INFO_QUERY. Structured contact found (${renderedContact.channel}). Hard fallback.`);

                        const variantIdx = pickVariant(threadId, fallbackTemplates.length);
                        const fallbackResponse = fallbackTemplates[variantIdx].replace('{CONTACT_LINE}', renderedContact.text);

                        const savedFallback = await prisma.webMessage.create({
                            data: {
                                tenantId, threadId,
                                direction: 'OUTBOUND',
                                actorType: 'ASSISTANT',
                                text: fallbackResponse,
                            }
                        });

                        await prisma.webThread.update({
                            where: { id: threadId },
                            data: { lastMessageAt: new Date() },
                        });

                        await aiAuditService.createLog({
                            tenantId, channel: 'WEB_WIDGET', widgetId, threadId,
                            effectivePrompt: 'HARD_FALLBACK_INTERACTIVE',
                            model: 'BYPASS_LLM',
                            responseText: fallbackResponse,
                            confidenceScore: 0,
                            action: 'FALLBACK',
                            kbChunkIds: [],
                            kbFileIds: [],
                        });

                        return {
                            type: 'AI_MESSAGE',
                            message: {
                                ...savedFallback,
                                role: 'ASSISTANT',
                                origin: 'AI',
                                textBody: savedFallback.text
                            } as any
                        };
                    } else {
                        // Analytics: AI Blocked / Gating
                        AnalyticsService.emitEvent({
                            tenantId,
                            eventType: 'AI_GATING_BLOCKED',
                            channel: 'web',
                            threadId,
                            meta: { intent, reason: 'KB_EMPTY' }
                        });
                        // KB EMPTY + NO STRUCTURED CONTACT -> Last hope: Passthrough to LLM to find info in Mission/System prompt
                        console.log(`[AiWidgetResponder] KB_EMPTY for BUSINESS_INFO_QUERY and NO structured contact. Passthrough to LLM to search MISSION.`);
                    }
                } else {
                    // IDENTITY or ESCALATION with empty KB -> Passthrough to LLM
                    console.log(`[AiWidgetResponder] KB_EMPTY for ${intent}. Passthrough to LLM.`);
                }
            } catch (kbErr: any) {
                console.warn(`[AiWidgetResponder] KB_RETRIEVAL_FAIL: ${kbErr.message}`);
            }
        }

        // 7. Prompt Building
        // Variant Index based on hash of thread+msg for stability but variation across messages
        const variantSeed = (threadId || '') + (inboundMessage.id || '');
        const variantIndex = Math.abs(this.simpleHash(variantSeed)) % 8;

        // Load history for context (EXCLUDE current message to avoid duplicates)
        const recentMessages = await prisma.webMessage.findMany({
            where: {
                threadId,
                id: { not: inboundMessage.id }
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
        });

        const lastMessages = recentMessages.reverse();
        const hasHistory = lastMessages.length > 0;

        let systemPrompt = buildPersonalitySystemPrompt({
            profile,
            widget,
            variantIndex,
            hasHistory,
            contactInfo: contact
        });

        // Inject KB chunks if we have them
        if (kbResults.length > 0) {
            systemPrompt = buildKbAwareSystemPrompt({
                basePrompt: systemPrompt,
                chunks: kbResults,
            });
            console.log(`[AiWidgetResponder] KB_INJECTED into prompt.`);
        }

        const chatMessages = buildChatMessages({
            systemPrompt,
            lastMessages,
            userText
        });

        // Diagnostic Bypass
        if (userText.toUpperCase().trim() === 'PING_TEST') {
            return {
                type: 'AI_MESSAGE',
                message: { id: 'ping', text: 'PONG! El pipeline de IA está activo.', createdAt: new Date() } as any
            };
        }

        // 5. Call LLM (Strictly Gemini)
        let requestedModel = env.GEMINI_MODEL || 'gemini-1.5-flash';

        if (aiConfig.modelOverride) {
            requestedModel = aiConfig.modelOverride;
        }

        let aiResponseText = '';
        let action: 'RESPONDED' | 'FALLBACK' = 'RESPONDED';

        try {
            console.log(`[AiWidgetResponder] LLM_REQ model=${requestedModel}`);
            const start = Date.now();

            const { text, tokens } = await chatLLM({
                system: systemPrompt,
                messages: chatMessages,
                temperature: kbResults.length > 0 ? 0.1 : 0.7,
                maxTokens: profile.maxTokens || 512,
            });

            // 7. Sanitize
            const rawText = text || '';
            aiResponseText = sanitizeAssistantText(rawText);

            const duration = Date.now() - start;
            console.log(`[AiWidgetResponder] CHAT_OK ms=${duration} tokens=${tokens} rawLen=${rawText.length} cleanLen=${aiResponseText.length}`);

            // Incluir tokens en el meta de la clase para uso posterior en Analytics
            (this as any).lastRequestTokens = tokens;

            if (env.NODE_ENV === 'development' && rawText.length !== aiResponseText.length) {
                console.log(`[AiWidgetResponder] SANITIZED: "${rawText.substring(0, 50)}..." -> "${aiResponseText.substring(0, 50)}..."`);
            }

            if (!aiResponseText) {
                // If sanitization killed everything (e.g. only had <think>), we fallback
                throw new Error('Empty response after sanitization');
            }

        } catch (error: any) {
            console.error('[AiWidgetResponder] LLM_ERROR DETAILS:', {
                message: error.message,
                stack: error.stack,
                model: requestedModel,
                provider: 'GEMINI'
            });
            // Fallback
            action = 'FALLBACK';
            aiResponseText = profile.fallbackMessage || "Tuve un problema técnico, ¿me repites tu mensaje por favor?";
        }

        // 8. Save & Audit (if successful)
        // If fallback, we still send it as AI_MESSAGE but maybe with different meta?
        // User said: "Solo si Ollama falla: { type:'FALLBACK', text:'<preset>' }"
        // But also "Respuesta siempre: si Ollama OK -> AI_MESSAGE".
        // If I return FALLBACK type, the frontend might render it differently?
        // The user contract says: 
        // "Siempre: { type:'AI_MESSAGE', ... }"
        // "Solo si Ollama falla: { type:'FALLBACK', ... }"

        if (action === 'FALLBACK') {
            AnalyticsService.emitEvent({
                tenantId,
                eventType: 'AI_FALLBACK_TO_HUMAN',
                channel: 'web',
                threadId,
                meta: { reason: 'LLM_ERROR_OR_REJECTION' }
            });
            return {
                type: 'FALLBACK',
                fallbackText: aiResponseText
            };
        }

        // Success case
        const savedMessage = await prisma.webMessage.create({
            data: {
                tenantId,
                threadId,
                direction: 'OUTBOUND',
                actorType: 'ASSISTANT',
                text: aiResponseText,
            }
        });

        await prisma.webThread.update({
            where: { id: threadId },
            data: { lastMessageAt: new Date() },
        });

        await aiAuditService.createLog({
            tenantId, channel: 'WEB_WIDGET', widgetId, threadId,
            effectivePrompt: systemPrompt,
            model: requestedModel,
            responseText: aiResponseText,
            confidenceScore: 1.0,
            action: 'RESPONDED',
            kbChunkIds,
            kbFileIds,
        });

        const responsePayload = {
            type: 'AI_MESSAGE' as const,
            message: {
                ...savedMessage,
                textBody: savedMessage.text
            },
            meta: {
                mode: 'PERSONA_ONLY',
                variantIndex
            }
        };

        // Analytics Hook: AI Responded
        AnalyticsService.emitEvent({
            tenantId,
            eventType: 'MESSAGE_OUTBOUND_AI',
            channel: 'web',
            threadId,
            actorType: 'AI',
            meta: {
                messageId: savedMessage.id,
                model: requestedModel,
                tokens: (this as any).lastRequestTokens || 0
            }
        });

        return responsePayload;
    }

    private simpleHash(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash;
    }

}

export const aiWidgetResponderService = new AiWidgetResponderService();
