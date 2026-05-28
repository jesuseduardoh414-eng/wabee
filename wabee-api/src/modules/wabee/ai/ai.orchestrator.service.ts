/**
 * AiOrchestratorService — Motor IA Agnóstico de Canal
 */

import { prisma } from '@/lib/prisma';
import { env } from '../../../config/env';
import { chatLLM } from './llm.client';
import { buildChatMessages, buildContextAssemblyPrompt } from './ai.prompt.builder';
import { detectIntent, AiIntent } from './ai.intent';
import { aiFormOrchestratorService } from './tools/form.orchestrator.service';
import * as aiMemoryService from './ai.context.resolver';
import { EntityMemory, ContextResolution } from './ai.context.resolver';
import { aiServiceEngine } from './ai.service.engine';
import { sanitizeAssistantText } from './ai.sanitize';
import { kbService } from './kb.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { toolExecutorService } from './tools/tool.executor.service';
import { toolRegistryService } from './tools/tool.registry.service';
import { ToolResponseNormalizer } from './tools/tool.normalizer';
import { normalizeText, matchesTrigger, cleanQueryForKb } from './ai.normalize';
import {
    resolveAggressiveness,
    buildKbReinterpretationPrompt,
    buildClarificationRequestPrompt,
    AGGRESSIVENESS_CONFIG
} from './ai.base.prompt';
import {
    scoreTool,
    getMissingRequiredParams,
    TOOL_SCORE_THRESHOLD,
    toolLog
} from './tools/tool.scorer';
import {
    advanceLifecycle,
    detectsLeadIntent,
    isContactOperative
} from './contact.lifecycle.service';
import { ContactLifecycleStatus, ConversationMode } from '@prisma/client';

export interface UniversalMessageContext {
    tenantId: string;
    channelType: 'WHATSAPP' | 'WEB_WIDGET';
    channelId: string;
    threadId: string;
    contactId?: string;
    userIdentificator: string; 
    message: {
        id: string;
        text: string;
        type: string;
    };
    aiConfig: {
        profileId: string;
        enabled: boolean;
        handoffKeys: string[];
    };
    widget?: {
        id: string;
        name: string;
        greetingMessage: string;
        profileId: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
    };
}

export type OrchestratorAction = 'NO_AI' | 'HANDOFF' | 'REPLY' | 'SKIP' | 'ERROR' | 'CONTINUE';

export interface OrchestratorResponse {
    action: OrchestratorAction;
    replyText?: string;
    handoffReason?: string;
    kbChunksUsed?: string[];
    kbFilesUsed?: string[];
    tokensUsed?: number;
    lifecycleTransition?: {
        from: string;
        to: string;
        reason: string;
    };
    meta?: any;
    debug?: {
        intent: string;
        source: 'PROMPT' | 'KB' | 'TOOL' | 'FORM';
        normalizedMessage?: string;
        toolsAvailable?: string[];
        toolSelected?: string;
        toolPayload?: any;
        toolResult?: any;
        
        // Conversational Engine
        isFirstTurn?: boolean;
        isFollowUpTurn?: boolean;
        greetingSuppressed?: boolean;
        selfIntroSuppressed?: boolean;
        servicePitchSuppressed?: boolean;
        flowStatus?: 'ACTIVE' | 'INACTIVE';
        serviceId?: string;
        slotCaptured?: boolean;
        // KB Retrieval
        kbTried?: boolean;
        kbUsed?: boolean;
        kbQueryUsed?: string;
        kbChunks?: number;
        kbBestScore?: number;
        kbSkipReason?: string;
        // Context Resolution
        contextualReferenceDetected?: boolean;
        contextualReferenceResolvedTo?: string;
        activeEntityType?: string;
        activeEntityValue?: string;
        contextResolved?: boolean;
        contextRefType?: string;
        contextValue?: string;
        personaGuardrailsApplied?: boolean;
        tokens?: number;
        kbFilesUsed?: string[];
        meta?: any;
        // Flow Engine
        activeFlow?: string;
        collectedData?: any;
        missingSlotTarget?: string;
        extractedSlots?: any;
        lastAskedSlot?: string;
        // Service Engine (Session Philosophy)
        activeService?: string;
        serviceConfidence?: number;
        serviceIntentType?: string;
        serviceLockReason?: string;
        enoughContextToRespond?: boolean;
        conversationMode?: string;
        slotCaptureBlockedReason?: string;
        // Service Switch
        serviceSwitchDetected?: boolean;
        serviceSwitchReason?: string;
        previousServiceId?: string;
        // Memorias
        customerMemory?: any;
        // Robustez y Diagnóstico
        serviceStateLoaded?: boolean;
        entityMemoryLoaded?: boolean;
        fallbackApplied?: boolean;
        flowTried?: boolean;
        flowSkippedReason?: string;
        extractorSucceeded?: boolean;
        extractorError?: string;
    };
}

const KB_CONFIDENCE_THRESHOLD = 0.35;

export class AiOrchestratorService {

    async processInbound(context: UniversalMessageContext): Promise<OrchestratorResponse> {
        console.log(`[AiOrchestrator] 📥 Thread: "${context.threadId}" | Msg: "${context.message.text?.substring(0, 30)}..."`);
        try {
            if (!context.aiConfig.enabled) return { action: 'NO_AI' };

            // 1. Verificar operatividad
            if (context.contactId) {
                const contact = await prisma.contact.findUnique({
                    where: { id: context.contactId },
                    select: { lifecycleStatus: true }
                });
                if (contact && !isContactOperative(contact.lifecycleStatus)) {
                    return { action: 'NO_AI', meta: { reason: `contact_${contact.lifecycleStatus.toLowerCase()}` } };
                }
            }

            // 2. Resolver Estado
            const state = await this.resolveConversationState(context.tenantId, context.threadId);
            if (state.mode === 'DISABLED') return { action: 'NO_AI' };
            if (state.mode === 'HUMAN_HANDOFF') return { action: 'SKIP' };

            // 3. Normalizar y Detectar Intención
            const userText = context.message.text || '';
            const normalizedText = normalizeText(userText);
            const intent = detectIntent(userText); 

            // 4. Handoff Manual (Keywords)
            if (intent === 'HUMAN_ESCALATION') {
                await this.transitionToHandoff(state.id, 'user_requested_escalation');
                return {
                    action: 'HANDOFF',
                    replyText: 'Entendido, te comunico con un asesor en breve. 😊',
                    lifecycleTransition: await this.updateLifecycleOnHandoff(context.contactId, context.tenantId)
                };
            }

            // 5. Ejecutar Decisión
            return await this.decideAndRespond(context, state, intent, normalizedText);

        } catch (error) {
            console.error('[AiOrchestrator] Error crítico:', error);
            return { action: 'ERROR', meta: { error: String(error) } };
        }
    }

    private async decideAndRespond(
        context: UniversalMessageContext,
        state: any,
        intent: AiIntent,
        normalizedText: string
    ): Promise<OrchestratorResponse> {
        const { tenantId, threadId, aiConfig, message, channelType } = context;
        const userText = message.text || '';

        const profile = await prisma.aiProfile.findUnique({
            where: { id: aiConfig.profileId },
            include: { kbFiles: true }
        });
        if (!profile) return { action: 'ERROR', meta: { error: 'profile_not_found' } };

        // ── A. PRIORIDAD: MODO FORMULARIO ──
        if (state.mode === ConversationMode.FORM_FILLING) {
            const formResult: any = await aiFormOrchestratorService.processForm({
                tenantId, threadId, userIdentificator: context.userIdentificator,
                message: userText, profileId: profile.id
            }, state);

            await prisma.conversationState.update({
                where: { id: state.id },
                data: { 
                    mode: formResult.mode || formResult.state?.mode || ConversationMode.FORM_FILLING, 
                    collectedData: formResult.collectedData 
                }
            });

            return { action: 'REPLY', replyText: formResult.replyText, meta: { mode: 'FORM_FILLING' } };
        }

        // ── B. INICIAR FORMULARIO (LEAD_CREATION) ──
        if (intent === 'LEAD_CREATION') {
            const formResult: any = await aiFormOrchestratorService.processForm({
                tenantId, threadId, userIdentificator: context.userIdentificator,
                message: userText, profileId: profile.id
            }, state);

            await prisma.conversationState.update({
                where: { id: state.id },
                data: { 
                    mode: formResult.mode || ConversationMode.FORM_FILLING, 
                    collectedData: formResult.collectedData 
                }
            });

            return { action: 'REPLY', replyText: formResult.replyText, meta: { mode: 'FORM_FILLING' } };
        }

        // ── B.1 SERVICE SESSION ENGINE ──
        let flowActive = false;
        let evaluation: any = null;
        let customerMemory: any = null;
        let flowTried = false;
        let flowSkippedReason: string | undefined;

        try {
            const contextMem = (state as any).contextMemory || {};
            evaluation = await aiServiceEngine.evaluateTurn(userText, intent, tenantId, contextMem);
            flowTried = evaluation.tried ?? false;
            flowSkippedReason = evaluation.skippedReason;
            customerMemory = evaluation.customerMemory;

            if (evaluation.inSession && evaluation.serviceState) {
                flowActive = true;
                await prisma.conversationState.update({
                    where: { id: state.id },
                    data: {
                        contextMemory: { 
                            ...contextMem, 
                            serviceState: evaluation.serviceState,
                            customerMemory: evaluation.customerMemory
                        }
                    }
                });
                (state as any).contextMemory = { 
                    ...contextMem, 
                    serviceState: evaluation.serviceState,
                    customerMemory: evaluation.customerMemory
                };
            } else if (evaluation.customerMemory) {
                await prisma.conversationState.update({
                    where: { id: state.id },
                    data: { contextMemory: { ...contextMem, customerMemory: evaluation.customerMemory } }
                });
                (state as any).contextMemory = { ...contextMem, customerMemory: evaluation.customerMemory };
            }
        } catch (flowErr: any) {
            console.error(`[Orchestrator] ServiceEngine Error: ${flowErr.message}`);
            flowSkippedReason = `engine_error: ${flowErr.message}`;
        }

        // ── B2. PROCESAMIENTO DE ACCIONES PENDIENTES ──
        const contextMem = (state as any).contextMemory || {};
        const pendingAction = contextMem.pendingToolAction;
        
        if (pendingAction && pendingAction.expiresAt > Date.now()) {
            const isAffirmative = normalizeText(userText).match(/^(si|yes|claro|adelante|de acuerdo|va|ok|acepto|confirmar|procede|hazlo)$/i);
            if (isAffirmative) {
                const toolId = await toolRegistryService.getToolIdByNameForProfile(profile.id, pendingAction.name);
                if (toolId) {
                    try {
                        const rawResponse = await toolExecutorService.execute({ 
                            toolId, tenantId, threadId, payload: pendingAction.args 
                        });
                        delete contextMem.pendingToolAction;
                        await prisma.conversationState.update({
                            where: { id: state.id },
                            data: { contextMemory: contextMem }
                        });
                        (state as any).preExecutedToolResult = rawResponse;
                        (state as any).preExecutedToolName = pendingAction.name;
                    } catch (execErr: any) {
                        console.error(`[Orchestrator] PendingAction Error: ${execErr.message}`);
                    }
                }
            } else {
                delete contextMem.pendingToolAction;
                await prisma.conversationState.update({
                    where: { id: state.id },
                    data: { contextMemory: contextMem }
                });
            }
        }

        // ── C. JERARQUÍA DE FUENTES ──
        const isSmalltalk = intent.startsWith('SMALLTALK_') || intent === 'CHATTER' || intent === 'GENERAL_QUESTION';
        let useKb = profile.kbEnabled && ['BUSINESS_INFO_QUERY', 'PRODUCT_SEARCH', 'OPERATIONAL_ACTION', 'COMPLAINT', 'LEAD_CREATION'].includes(intent);
        let useTools = ['PRODUCT_SEARCH', 'OPERATIONAL_ACTION', 'BUSINESS_INFO_QUERY', 'COMPLAINT'].includes(intent); 
        
        if (evaluation?.inSession && evaluation.serviceState?.serviceType) {
            const svcType = evaluation.serviceState.serviceType;
            if (svcType === 'INFORMATIONAL') { useKb = true; useTools = false; }
            else if (svcType === 'TRANSACTIONAL') { useKb = false; useTools = true; }
            else if (svcType === 'HYBRID') { useKb = true; useTools = true; }
        }
        
        // ── 0. Context Resolution ──
        let contextResolution: ContextResolution = { detected: false };
        let resolvedMemory: EntityMemory | null = null;
        let isImplicitRef = false;
        const debugEnabled = (env as any).AI_DEBUG_LEVEL === 'verbose';

        try {
            const cm = (state as any).contextMemory || {};
            resolvedMemory = cm.entityMemory as EntityMemory | null;
            if (resolvedMemory && (resolvedMemory.orderedList?.length ?? 0) > 0) {
                resolvedMemory.turnsSinceLastList = (resolvedMemory.turnsSinceLastList || 0) + 1;
                contextResolution = aiMemoryService.resolveContextualReference(userText, resolvedMemory);
                if (contextResolution?.detected && contextResolution.resolvedTo) {
                    resolvedMemory.lastResolvedReference = contextResolution.resolvedTo;
                    resolvedMemory = aiMemoryService.updateActiveEntity(resolvedMemory, contextResolution.resolvedTo);
                }
                if (!contextResolution?.detected && resolvedMemory?.activeEntityValue) {
                    isImplicitRef = aiMemoryService.detectImplicitReference(userText);
                    if (isImplicitRef) {
                        contextResolution = { detected: true, resolvedTo: resolvedMemory.activeEntityValue, refType: 'ordinal_number' };
                    }
                }
            }
        } catch (ctxErr: any) {
            console.error(`[Orchestrator] ContextResolver Error: ${ctxErr.message}`);
        }

        // ── 1. Retrieval RAG ──
        let kbResults: any[] = [];
        let kbSufficient = false;
        let kbBestScore = 0;
        let kbQueryUsed = '';
        const systemPromptInstructions: string[] = []; // Acumulador de instrucciones dinámicas ──

        if (useKb) {
            const baseQuery = cleanQueryForKb(userText);
            kbQueryUsed = aiMemoryService.buildKbQuery({ 
                cleanedMessage: baseQuery, contextResolution, isImplicit: isImplicitRef, activeEntity: resolvedMemory?.activeEntityValue
            });
            kbResults = await kbService.retrieveTopChunks({ tenantId, profileId: profile.id, query: kbQueryUsed, k: 5 });
            kbBestScore = kbResults[0]?.score ?? 0;
            const threshold = contextResolution.detected ? Math.min(0.25, (profile.confidenceThreshold || KB_CONFIDENCE_THRESHOLD)) : (profile.confidenceThreshold || KB_CONFIDENCE_THRESHOLD);
            kbSufficient = kbResults.length > 0 && kbBestScore >= threshold;

            // ── NUEVO FLUJO: Reinterpretación semántica antes de handoff ──────
            if (!kbSufficient && ['BUSINESS_INFO_QUERY', 'PRODUCT_SEARCH'].includes(intent)) {
                const aggressiveness = resolveAggressiveness((profile as any).handoffAggressiveness);
                const aggrConfig = AGGRESSIVENESS_CONFIG[aggressiveness];
                const ctxMem = (state as any).contextMemory || {};

                // ── Detección: ¿el usuario está respondiendo una pregunta aclaratoria previa? ──
                const clarificationPending = ctxMem.clarificationPending;
                let kbRetrySufficient = false;

                if (clarificationPending) {
                    // El mensaje actual ES la respuesta a la aclaratoria anterior.
                    // Limpiar el flag y continuar al LLM con el contexto ampliado.
                    delete ctxMem.clarificationPending;
                    await prisma.conversationState.update({
                        where: { id: state.id },
                        data: { contextMemory: ctxMem }
                    });
                    console.log(`[AiOrchestrator] 🔄 Respuesta a aclaratoria recibida. Continuando con LLM sin KB forzado.`);
                    // kbResults queda vacío, el LLM usará el prompt base con lo disponible
                } else {
                    // ── PASO 1: Reinterpretación semántica interna ──────────────
                    try {
                        const reinterpretInstr = buildKbReinterpretationPrompt(userText, aggressiveness);
                        const reinterpretLlm = await chatLLM({
                            system: reinterpretInstr,
                            messages: [{ role: 'user', content: userText }],
                            temperature: 0.2,
                            maxTokens: 150
                        });
                        const reinterpretedQuery = sanitizeAssistantText(reinterpretLlm.text || '', { allowShort: true }).trim();

                        if (reinterpretedQuery && reinterpretedQuery.length > 3) {
                            console.log(`[AiOrchestrator] 🔍 Reinterpretación: "${userText}" → "${reinterpretedQuery}"`);
                            const retryThreshold = (profile.confidenceThreshold || KB_CONFIDENCE_THRESHOLD) * aggrConfig.kbThresholdFactor;
                            const retryResults = await kbService.retrieveTopChunks({ tenantId, profileId: profile.id, query: reinterpretedQuery, k: 5 });
                            const retryScore = retryResults[0]?.score ?? 0;

                            if (retryResults.length > 0 && retryScore >= retryThreshold) {
                                // ¡Reinterpretación exitosa! Usar estos chunks
                                kbResults = retryResults;
                                kbBestScore = retryScore;
                                kbSufficient = true;
                                kbRetrySufficient = true;
                                console.log(`[AiOrchestrator] ✅ Reinterpretación KB satisfactoria. Score: ${retryScore.toFixed(3)}`);
                            }

                            // ── PASO 2 (aggressive only): segundo reintento con umbral aún más bajo ──
                            if (!kbRetrySufficient && aggrConfig.kbRetries >= 2) {
                                const deepThreshold = retryThreshold * 0.75;
                                if (retryResults.length > 0 && retryScore >= deepThreshold) {
                                    kbResults = retryResults;
                                    kbBestScore = retryScore;
                                    kbSufficient = true;
                                    kbRetrySufficient = true;
                                    console.log(`[AiOrchestrator] ✅ Reinterpretación KB (deep). Score: ${retryScore.toFixed(3)}`);
                                }
                            }
                        }
                    } catch (reinterpretErr: any) {
                        console.warn(`[AiOrchestrator] Reinterpretación fallida: ${reinterpretErr.message}`);
                    }

                    // ── PASO 3: Pregunta aclaratoria o guía de respuesta general ──
                    if (!kbSufficient) {
                        if (aggrConfig.askBeforeHandoff) {
                            // Generar guía aclaratoria vía LLM (interna)
                            try {
                                const agentName = profile.agentName || 'el asistente';
                                const clarifInstr = buildClarificationRequestPrompt(userText, agentName);
                                const clarifLlm = await chatLLM({
                                    system: clarifInstr,
                                    messages: [{ role: 'user', content: userText }],
                                    temperature: 0.3,
                                    maxTokens: 400
                                });
                                const clarifText = sanitizeAssistantText(clarifLlm.text || '').trim();

                                if (clarifText && clarifText.length > 5) {
                                    // Marcar que estamos esperando respuesta aclaratoria en el siguiente turno
                                    await prisma.conversationState.update({
                                        where: { id: state.id },
                                        data: { contextMemory: { ...ctxMem, clarificationPending: true } }
                                    });

                                    if (flowActive) {
                                        console.log(`[AiOrchestrator] 🔄 KB insuficiente en flujo activo. Continuando trámite.`);
                                        systemPromptInstructions.push(`[KB_STATUS: NO_SPECIFIC_INFO]\nNo hay detalles técnicos nuevos en la base de conocimiento para este mensaje específico. CONTINÚA con el flujo actual del servicio (${evaluation.serviceState?.activeServiceId}) usando la información confirmada. NO reinicies el saludo.`);
                                    } else {
                                        console.log(`[AiOrchestrator] 🔄 KB insuficiente. Inyectando guía de respuesta general.`);
                                        systemPromptInstructions.push(`[KB_STATUS: INSUFFICIENT]\nNo se encontró información técnica específica. Saluda amablemente usando tu información de [INFORMACIÓN DE LA EMPRESA] y pregunta cómo puedes ayudar guiando al usuario hacia uno de tus servicios ofrecidos.`);
                                    }
                                }
                            } catch (clarifErr: any) {
                                console.warn(`[AiOrchestrator] Guía aclaratoria fallida: ${clarifErr.message}`);
                            }
                        } else {
                            // Si NO debe preguntar (conservative), entonces sí HANDOFF inmediato
                            console.log(`[AiOrchestrator] 📲 Handoff inmediato (agresividad conservadora).`);
                            return {
                                action: 'HANDOFF',
                                handoffReason: 'insufficient_kb_conservative',
                                replyText: 'No poseo información suficiente sobre ese tema. Te transfiero con un asesor para que te ayude directamente.',
                                lifecycleTransition: await this.updateLifecycleOnMessage(context.contactId, tenantId, userText),
                                meta: { intent, kbBestScore, aggressiveness }
                            };
                        }
                    }
                }
            }
        }

        // ── 2. Historial ──
        const rawHistory = channelType === 'WHATSAPP' 
            ? await prisma.whatsappMessage.findMany({ where: { threadId, id: { not: message.id } }, orderBy: { timestamp: 'desc' }, take: 10 })
            : await prisma.webMessage.findMany({ where: { threadId, id: { not: message.id } }, orderBy: { createdAt: 'desc' }, take: 10 });
        
        const history = rawHistory.reverse().map((m: any) => {
            const text = (m as any).textBody || (m as any).text || '';
            if (text.includes('Error: HTTP') || text.includes('Fallo ejecucion')) return null;
            const actorType = (m.actorType === 'ASSISTANT' || m.actorType === 'SYSTEM' || m.source === 'AI') ? 'ASSISTANT' : 'USER';
            return { text, direction: m.direction, actorType };
        }).filter((h): h is { text: string; direction: any; actorType: string } => h !== null);

        // ── 3. Prompting ──
        const isFollowUpTurn = history.length > 0;
        let systemPrompt = buildContextAssemblyPrompt({
            profile, widget: context.widget as any, variantIndex: 0, hasHistory: isFollowUpTurn,
            contactInfo: {}, kbChunks: kbSufficient ? kbResults : undefined,
            serviceState: evaluation?.serviceState, customerMemory: evaluation?.customerMemory
        });

        // Aplicar instrucciones acumuladas durante el flujo de decisión
        if (systemPromptInstructions.length > 0) {
            systemPrompt += `\n\n${systemPromptInstructions.join('\n\n')}`;
        }

        if (intent === 'COMPLAINT') systemPrompt += `\n\n[REGLA: EMPATÍA]\nPrioriza validar sentimientos.`;
        if (flowActive || ['SERVICE_TRANSACTION', 'PRODUCT_SEARCH', 'BUSINESS_INFO_QUERY'].includes(intent)) {
            systemPrompt += `\n\n[DIÁLOGO: PASO A PASO]\nSé breve y directo. Solo haz UNA pregunta por turno. Nunca pidas varios datos a la vez. El objetivo es guiar al usuario de forma natural.`;
        }

        const chatMessages = buildChatMessages({
            systemPrompt,
            lastMessages: history.map(m => ({ text: m.text, direction: m.direction || 'INBOUND', actorType: m.actorType || 'USER' })),
            userText
        });

        const conversationModeForTools = evaluation?.serviceState?.serviceType as any || null;
        const profileTools = useTools ? await this.getEnabledToolsForIntent(profile.id, intent, userText, normalizedText, conversationModeForTools) : [];
        const hasScoredTools = profileTools.length > 0;

        // ── 4. Ejecución LLM ──
        try {
            let replyText = '';
            let totalTokens = 0;
            let toolSelected: string | undefined;
            let toolPayload: any | undefined;
            let toolResult: any | undefined;
            let responseSource: 'PROMPT' | 'KB' | 'TOOL' | 'FORM' = kbSufficient ? 'KB' : 'PROMPT';

            if ((state as any).preExecutedToolResult) {
                const preResult = (state as any).preExecutedToolResult;
                const preName = (state as any).preExecutedToolName;
                toolSelected = preName; toolResult = preResult; responseSource = 'TOOL';
                chatMessages.push({ role: 'assistant', functionCall: { name: preName, args: {} } as any } as any);
                chatMessages.push({ role: 'function', functionResponse: { name: preName, response: preResult } } as any);

                const llmFinal = await chatLLM({ system: systemPrompt + '\n\n[CONFIRMA ACCIÓN REALizada]', messages: chatMessages, temperature: 0.1 });
                replyText = sanitizeAssistantText(llmFinal.text || 'Listo.');
                totalTokens += (llmFinal.tokens || 0);
            } else {
                if (hasScoredTools) systemPrompt += `\n\n[PRIORIDAD: HERRAMIENTAS DISPONIBLES]\nSi alguna de las herramientas disponibles aplica a la consulta, úsala.`;
                const llm = await chatLLM({
                    system: systemPrompt, messages: chatMessages, temperature: isSmalltalk ? 0.7 : 0.1,
                    maxTokens: profile.maxTokens || 512, tools: profileTools.length > 0 ? profileTools.map(t => t.definition) : undefined
                });
                totalTokens += (llm.tokens || 0);

                if (llm.functionCall && useTools) {
                    const fnCall = llm.functionCall;
                    toolSelected = fnCall.name; toolPayload = fnCall.args; responseSource = 'TOOL';
                    const toolId = await toolRegistryService.getToolIdByNameForProfile(profile.id, fnCall.name);
                    if (toolId) {
                        let toolResponse;
                        try {
                            const tool = await toolRegistryService.getToolByNameForProfile(profile.id, fnCall.name, evaluation?.serviceState?.activeServiceId);
                            const gov = (tool as any)?.governance || { executionMode: 'AUTO', actionType: 'READ' };
                            const confirmPolicy = (tool as any)?.confirmationPolicy || gov.executionMode;
                            const safetyFlags = (tool as any)?.safetyFlags || {};

                            // ── Validar parámetros requeridos antes de ejecutar ──────────
                            const missingParams = getMissingRequiredParams(
                                (tool as any)?.parametersSchema,
                                fnCall.args || {}
                            );
                            if (missingParams.length > 0) {
                                toolLog(`Params faltantes para "${fnCall.name}": ${missingParams.join(', ')}`);
                                // Pedir los datos faltantes al usuario de forma natural — retornar sin ejecutar la API
                                const llmAsk = await chatLLM({
                                    system: systemPrompt + `\n\n[REGLA: SOLICITAR DATOS FALTANTES]\nNecesitas los siguientes datos antes de continuar: ${missingParams.join(', ')}. Pide cada uno de forma natural, uno a la vez.`,
                                    messages: chatMessages,
                                    temperature: 0.2
                                });
                                return {
                                    action: 'REPLY',
                                    replyText: sanitizeAssistantText(llmAsk.text || `Necesito algunos datos más: ${missingParams.join(', ')}.`),
                                    tokensUsed: (llmAsk.tokens || 0),
                                    meta: { intent, missingParams }
                                };
                            }

                            // ── Gobernanza: MANUAL ───────────────────────────────────────
                            if (confirmPolicy === 'MANUAL' || gov.executionMode === 'MANUAL') {
                                toolLog(`Policy MANUAL para "${fnCall.name}" | handoffEnabled: ${!!(profile as any).handoffEnabled}`);
                                // Si hay handoff configurado → handoff
                                if ((profile as any).handoffEnabled !== false) {
                                    await this.transitionToHandoff(state.id, `manual_tool_${fnCall.name}`);
                                    return { action: 'HANDOFF', replyText: 'Esta acción requiere atención de un asesor. Te estamos conectando.' };
                                }
                                // Sin handoff → respuesta explicativa (no crash silencioso)
                                return { action: 'REPLY', replyText: 'Esta acción requiere supervisión de un asesor. Por favor contáctanos directamente para continuar.' };
                            }

                            // ── Gobernanza: HYBRID (o canMutateData) ─────────────────────
                            const needsConfirm = confirmPolicy === 'HYBRID' ||
                                (safetyFlags.canMutateData && !safetyFlags.safeToAutoRun);
                            if (needsConfirm && gov.actionType !== 'READ') {
                                toolLog(`Policy HYBRID para "${fnCall.name}" | guardando pendingToolAction`);
                                const currentMem = (state as any).contextMemory || {};
                                await prisma.conversationState.update({
                                    where: { id: state.id },
                                    data: { contextMemory: { ...currentMem, pendingToolAction: { name: fnCall.name, args: fnCall.args, expiresAt: Date.now() + 300000 } } }
                                });
                                const llmP = await chatLLM({ system: systemPrompt + '\n\n[PROPÓN ACCIÓN AL USUARIO]', messages: chatMessages, temperature: 0.1 });
                                return { action: 'CONTINUE', replyText: sanitizeAssistantText(llmP.text || '¿Deseas que proceda?') };
                            }

                            // ── AUTO: Ejecutar directamente ──────────────────────────────
                            toolLog(`Ejecutando "${fnCall.name}" | Policy: AUTO`);
                            const raw = await toolExecutorService.execute({ toolId, tenantId, threadId, payload: fnCall.args });
                            toolResponse = (tool as any).responseMapping 
                                ? ToolResponseNormalizer.normalize(raw, (tool as any).responseMapping) 
                                : raw;
                            toolResult = toolResponse;
                        } catch (err: any) {
                            toolLog(`Error ejecutando "${fnCall.name}": ${err.message}`);
                            toolResponse = { error: 'No disponible' }; toolResult = { error: err.message };
                        }
                        chatMessages.push({ role: 'assistant', functionCall: fnCall as any } as any);
                        chatMessages.push({ role: 'function', functionResponse: { name: fnCall.name, response: toolResponse } } as any);
                        const llm2 = await chatLLM({ 
                            system: systemPrompt + '\n\n[REGLA: RESOLUCIÓN DE RESPUESTA DE HERRAMIENTA]\nInterpreta el resultado de la herramienta y responde al usuario de forma natural y clara. No muestres JSON crudo.', 
                            messages: chatMessages, temperature: 0.1 
                        });
                        replyText = sanitizeAssistantText(llm2.text || '');
                        totalTokens += (llm2.tokens || 0);
                    } else { replyText = sanitizeAssistantText(llm.text || 'Error de herramienta.'); }
                } else { replyText = sanitizeAssistantText(llm.text || ''); }
            }

            if (!replyText || replyText.length < 2) {
                return {
                    action: 'HANDOFF',
                    handoffReason: 'low_confidence_fallback',
                    replyText: 'No tengo la información suficiente para ayudarte con esto con seguridad. Te estoy comunicando con un asesor humano. 😊',
                    lifecycleTransition: await this.updateLifecycleOnMessage(context.contactId, tenantId, userText),
                    meta: { intent },
                };
            }

            // ── 5. Persistencia ──
            try {
                const newEntities = aiMemoryService.extractEntitiesFromText(replyText);
                if (newEntities.orderedList.length >= 2) {
                    resolvedMemory = { ...newEntities, turnsSinceLastList: 0, updatedAt: Date.now() };
                } else if (resolvedMemory) {
                    resolvedMemory.updatedAt = Date.now();
                }
                if (customerMemory) {
                    customerMemory.recentContext.metadata = { 
                        ...(customerMemory.recentContext.metadata || {}), 
                        lastPresentedOptions: resolvedMemory?.orderedList || [], 
                        lastResolvedReference: resolvedMemory?.lastResolvedReference 
                    };
                    (customerMemory.recentContext as any).entityMemory = resolvedMemory;
                }
                const updatedContextMemory = { ...((state as any).contextMemory || {}), serviceState: evaluation?.serviceState, customerMemory, entityMemory: resolvedMemory };
                await prisma.conversationState.update({ where: { id: state.id }, data: { contextMemory: updatedContextMemory, customerMemory: customerMemory || state.customerMemory } });
            } catch (memErr) { console.warn("[Orchestrator] Memory sync failed"); }

            return {
                action: 'REPLY', replyText, tokensUsed: totalTokens, kbChunksUsed: kbResults.filter(() => kbSufficient).map(r => r.chunkId),
                lifecycleTransition: await this.updateLifecycleOnMessage(context.contactId, tenantId, userText),
                meta: { intent },
                debug: {
                    intent, source: responseSource, flowStatus: flowActive ? 'ACTIVE' : 'INACTIVE', tokens: totalTokens,
                    contextResolved: contextResolution.detected, contextValue: contextResolution.resolvedTo,
                    activeService: evaluation?.serviceState?.activeServiceId, customerMemory
                }
            };
        } catch (llmErr: any) {
            console.error(`[Orchestrator] LLM Error: ${llmErr.message}`);
            return { action: 'HANDOFF', handoffReason: 'llm_failure', replyText: 'Error técnico.' };
        }
    }

    private async resolveConversationState(tenantId: string, threadId: string) {
        let state = await prisma.conversationState.findUnique({ where: { threadId } });
        if (!state) {
            state = await prisma.conversationState.create({
                data: { tenantId, threadId, mode: 'AI_MANAGED' }
            });
        }
        return state;
    }

    private async transitionToHandoff(stateId: string, reason: string) {
        await prisma.conversationState.update({
            where: { id: stateId },
            data: { mode: 'HUMAN_HANDOFF', handoffAt: new Date(), handoffReason: reason }
        });
    }

    private async updateLifecycleOnMessage(contactId: string | undefined, tenantId: string, text: string) {
        if (!contactId) return undefined;
        if (detectsLeadIntent(text)) {
            const next = await advanceLifecycle(contactId, tenantId, 'LEAD', 'lead_intent_detected');
            return { from: '?', to: next, reason: 'lead_intent_detected' };
        }
        return undefined;
    }

    private async updateLifecycleOnHandoff(contactId: string | undefined, tenantId: string) {
        if (!contactId) return undefined;
        return undefined; 
    }

    /**
     * Selección semántica de herramientas para un intent.
     * Usa sistema de scoring centralizado (tool.scorer.ts).
     * Los triggers/hints son señal secundaria, NO el mecanismo principal.
     */
    private async getEnabledToolsForIntent(
        profileId: string,
        intent: AiIntent,
        userText?: string,
        normalizedText?: string,
        conversationMode?: 'INFORMATIONAL' | 'TRANSACTIONAL' | 'HYBRID' | null
    ) {
        const allTools = await prisma.aiProfileTool.findMany({
            where: { profileId, isActive: true, tool: { isActive: true } },
            include: { tool: true }
        });

        // Regla: COMPLAINT no dispara tools a menos que el scoring sea muy alto
        const isComplaint = intent === 'COMPLAINT';
        // Threshold más estricto para intents de queja
        const threshold = isComplaint ? TOOL_SCORE_THRESHOLD + 15 : TOOL_SCORE_THRESHOLD;

        const candidates: any[] = [];

        for (const pt of allTools) {
            const t = pt.tool as any;

            const result = scoreTool({
                tool: t,
                intent,
                userText: userText || '',
                normalizedText: normalizedText || '',
                conversationMode,
            });

            if (result.score >= threshold) {
                candidates.push({
                    definition: {
                        name: t.name,
                        // Descripción semántica estructurada (construida por tool.scorer)
                        description: t.semanticDescription || t.description,
                        parameters: t.parametersSchema as any
                    },
                    matchReason: result.reasons.join(' | '),
                    score: result.score,
                    isGenericCapability: result.isGenericCapability,
                });
            }
        }

        // Ordenar por score descendente (tools más específicas primero)
        candidates.sort((a, b) => b.score - a.score);

        toolLog(
            `Intent: ${intent} | Threshold: ${threshold} | Candidatas (${candidates.length}): ${candidates.map(c => `${c.definition.name}(${c.score})`).join(', ')}`
        );

        return candidates;
    }
}

export const aiOrchestratorService = new AiOrchestratorService();
