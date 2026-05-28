import { getService, getAvailableServices, ServiceDefinition, ServiceSlot } from './ai.service.registry';
import { aiFlowExtractor } from './ai.flow.extractor';
import { AiServiceIntentType } from '@prisma/client';
import { normalizeText, matchesTrigger } from './ai.normalize';

export interface CustomerMemory {
    lastUpdated: number; // TTL Reference (30 days for hard data)
    explicitProfileData: {
        name?: string;
        phone?: string;
        email?: string;
        [key: string]: any;
    };
    softPreferences: {
        lastInterests: string[];
        preferredCategories: string[];
    };
    recentContext: {
        lastUpdated: number; // TTL Reference (48 hours for fast-decay context)
        lastCities?: string[];
        lastTopics?: string[];
        metadata: Record<string, any>;
    };
    serviceWeights: Record<string, number>; // indexado por slug: peso (0.0 a 1.0)
}

export interface ServiceState {
    mode: 'SERVICE_SESSION';
    activeServiceId: string;
    previousServiceId?: string;
    serviceType: string; // INFORMATIONAL | TRANSACTIONAL | HYBRID
    serviceConfidence: number;
    intentType: AiServiceIntentType;
    collectedData: Record<string, any>;
    lastAskedSlot?: string;
    lockReason?: string;
    serviceSwitchDetected?: boolean;
    serviceSwitchReason?: string;
    lastUpdated: number; // TTL Reference (24 hours for transaction timeout)
}

export interface ServiceSessionEvaluation {
    inSession: boolean;
    serviceState?: ServiceState;
    customerMemory?: CustomerMemory;
    nextSuggestedSlot?: ServiceSlot;
    extractedSlots?: Record<string, any>;
    enoughContextToRespond: boolean;
    tried: boolean;
    skippedReason?: string;
    slotCaptureBlockedReason?: string;
}

export class AiServiceEngine {

    async evaluateTurn(
        userMessage: string,
        intent: string,
        tenantId: string,
        currentState?: any
    ): Promise<ServiceSessionEvaluation> {
        
        // 1. Resolver estado actual — Más robusto para detectar sesión existente
        let session: ServiceState | null = this.mapState(currentState);
        const extractedSlots: Record<string, any> = {};

        // DEBUG: loguear datos previos para trazabilidad
        if (session) {
            console.log(`[ServiceEngine] 🔁 Sesión existente cargada | Service: ${session.activeServiceId} | CollectedData previo:`, JSON.stringify(session.collectedData));
        }
        
        // 2. Guardrail Smalltalk
        const isSmalltalk = intent.startsWith('SMALLTALK_') || intent === 'CHATTER';
        if (isSmalltalk && !session) {
            return { inSession: false, tried: true, skippedReason: 'guardrail_smalltalk', enoughContextToRespond: false };
        }

        // 3. Memoria del Cliente (Customer Memory) - Contrato Reforzado
        const customerMem: CustomerMemory = this.initializeCustomerMemory(currentState?.customerMemory);
        
        // 4. Inferencia de Servicio Dinámica (Discovery)
        const candidate = await this.inferService(userMessage, intent, tenantId);
        
        // Actualizar pesos de preferencia en la memoria de forma dinámica
        this.updateServiceWeights(customerMem, candidate);

        if (!session && candidate.serviceId && candidate.confidence > 0.4) {
            session = {
                mode: 'SERVICE_SESSION',
                activeServiceId: candidate.serviceId,
                serviceType: candidate.type,
                serviceConfidence: candidate.confidence,
                intentType: this.detectIntentType(userMessage, intent),
                collectedData: {},
                lockReason: 'discovery_match',
                lastUpdated: Date.now()
            };
        } else if (session) {
            // Evaluacion de TTL Corto (24 horas)
            const horasPasadas = (Date.now() - session.lastUpdated) / (1000 * 60 * 60);
            if (horasPasadas > 24) {
                console.log(`[ServiceEngine] 🧹 Sesión caducada por TTL (inactividad de >24h). Limpiando trámite anterior.`);
                session = null;
            } else {
                session.lastUpdated = Date.now(); // Renovar TTL
                if (!session.collectedData) session.collectedData = {};
            }
        }

        if (!session) {
            this.updateCustomerMemoryFromText(userMessage, customerMem);
            return { inSession: false, tried: false, enoughContextToRespond: false, customerMemory: customerMem };
        }

        // 5. Lógica de Persistencia y Bloqueo (Switch de Servicio)
        await this.applyLockLogic(session, candidate, userMessage, tenantId);

        // 6. Actualizar memoria transversal
        this.updateCustomerMemoryFromText(userMessage, customerMem);
        
        const serviceDef = await getService(tenantId, session.activeServiceId);
        let slotCaptureBlockedReason: string | undefined;

        if (serviceDef) {
            try {
                // Configuración de comportamiento (Behavior Config)
                const config = serviceDef.behaviorConfig || {};
                
                let pending = serviceDef.slots.filter(s => !session?.collectedData[s.id]);
                
                // Gating dinámico: Bloquear slots si el intento es informativo y el servicio lo requiere
                if (session.intentType === AiServiceIntentType.INFO && !config.allowSoftCollection) {
                    const beforeFilterCount = pending.length;
                    pending = pending.filter(s => !s.required); // Solo permitir no-requeridos en info si no hay soft collection
                    
                    if (pending.length < beforeFilterCount) {
                        slotCaptureBlockedReason = 'intent_is_info_limited';
                    }
                }

                if (pending.length > 0) {
                    // Capturar qué teníamos antes para debug
                    const previousCollectedData = { ...session.collectedData };

                    const extracted = await aiFlowExtractor.extract(userMessage, pending);
                    
                    // MERGE persistente: nunca reemplazar, siempre fusionar sobre el estado existente
                    let extractedAnyValidSlot = false;
                    for (const [k, v] of Object.entries(extracted)) {
                        if (v !== null && v !== undefined && v !== '') {
                            session.collectedData[k] = v;
                            extractedSlots[k] = v;
                            extractedAnyValidSlot = true;
                        }
                    }

                    // Promoción Inteligente de Intención:
                    // Si el mensaje era corto/dudoso y se clasificó como INFO originalmente,
                    // pero el AI Extractor sí logró validar un slot con él (ej: "Monterrey"), 
                    // promovemos la sesión a TRANSACTION para que siga avanzando el flujo.
                    if (extractedAnyValidSlot && session.intentType === AiServiceIntentType.INFO) {
                        session.intentType = AiServiceIntentType.TRANSACTION;
                        console.log(`[ServiceEngine] 🚀 Intención promovida a TRANSACTION porque se extrajo el slot válido:`, Object.keys(extractedSlots));
                    }

                    // DEBUG: trazabilidad completa del merge
                    console.log('[ServiceEngine] 📦 Merge de slots:');
                    console.log('  previousCollectedData:', JSON.stringify(previousCollectedData));
                    console.log('  extractedSlots:', JSON.stringify(extracted));
                    console.log('  mergedCollectedData:', JSON.stringify(session.collectedData));
                }
            } catch (e) {
                console.error(`[ServiceEngine] Extraction error:`, e);
            }
        }

        // 6. Suficiencia de Contexto
        const enoughContext = this.checkSufficiency(userMessage, intent, session);

        // 7. Próxima Sugerencia (Basada en orderIndex)
        let nextSlot = serviceDef?.slots.find(s => !session?.collectedData[s.id]);
        
        return {
            inSession: true,
            serviceState: session,
            customerMemory: customerMem,
            nextSuggestedSlot: nextSlot,
            extractedSlots: Object.keys(extractedSlots).length > 0 ? extractedSlots : undefined,
            enoughContextToRespond: enoughContext,
            tried: true,
            slotCaptureBlockedReason
        };
    }

    private mapState(state: any): ServiceState | null {
        if (!state) return null;

        // Caso 1: Estado de sesión dentro de contextMemory (formato normal del orquestador)
        if (state.serviceState?.activeServiceId) {
            const s = state.serviceState;
            return {
                mode: 'SERVICE_SESSION',
                activeServiceId: s.activeServiceId,
                previousServiceId: s.previousServiceId,
                serviceType: s.serviceType || 'INFORMATIONAL',
                serviceConfidence: s.serviceConfidence || 0.5,
                intentType: s.intentType || 'TRANSACTION',
                collectedData: s.collectedData || {},
                lastAskedSlot: s.lastAskedSlot,
                lockReason: s.lockReason,
                serviceSwitchDetected: s.serviceSwitchDetected,
                serviceSwitchReason: s.serviceSwitchReason,
                lastUpdated: s.lastUpdated || Date.now()
            };
        }

        // Caso 2: El estado en sí mismo es la sesión (guardado de forma plana)
        if (state.activeServiceId) {
            return {
                mode: 'SERVICE_SESSION',
                activeServiceId: state.activeServiceId,
                previousServiceId: state.previousServiceId,
                serviceType: state.serviceType,
                serviceConfidence: state.serviceConfidence || 0.5,
                intentType: state.intentType || 'TRANSACTION',
                collectedData: state.collectedData || {},
                lastAskedSlot: state.lastAskedSlot,
                lockReason: state.lockReason,
                serviceSwitchDetected: state.serviceSwitchDetected,
                serviceSwitchReason: state.serviceSwitchReason,
                lastUpdated: state.lastUpdated || Date.now()
            };
        }

        return null;
    }

    private initializeCustomerMemory(saved?: any): CustomerMemory {
        const now = Date.now();
        const thirtyDaysMs = 1000 * 60 * 60 * 24 * 30;
        const fortyEightHoursMs = 1000 * 60 * 60 * 48;

        // 1. Hard purge (30 días de inactividad global borra TODO el CustomerMemory)
        if (saved?.lastUpdated && (now - saved.lastUpdated > thirtyDaysMs)) {
            console.log(`[ServiceEngine] 🧹 CustomerMemory caducado por TTL (>30 días). Formateando perfil.`);
            saved = null;
        }

        // 2. Soft purge (48 horas borra solo el Recent Context / Short term)
        let recentContext = saved?.recentContext || { metadata: {}, lastUpdated: now };
        if (recentContext.lastUpdated && (now - recentContext.lastUpdated > fortyEightHoursMs)) {
            console.log(`[ServiceEngine] 🧹 recentContext caducado por TTL (>48 horas). Limpiando entidades frescas.`);
            recentContext = { metadata: {}, lastUpdated: now };
        } else {
            recentContext.lastUpdated = now; // Renovar vida
        }

        return {
            lastUpdated: now,
            explicitProfileData: saved?.explicitProfileData || {},
            softPreferences: saved?.softPreferences || { lastInterests: [], preferredCategories: [] },
            recentContext,
            serviceWeights: saved?.serviceWeights || {}
        };
    }

    private updateServiceWeights(mem: CustomerMemory, candidate: { serviceId: string; confidence: number }) {
        const decay = 0.95;
        
        // Enfriamiento global de pesos
        for (const id in mem.serviceWeights) {
            mem.serviceWeights[id] *= decay;
        }

        if (candidate.serviceId) {
            const current = mem.serviceWeights[candidate.serviceId] || 0;
            mem.serviceWeights[candidate.serviceId] = Math.min(current + (candidate.confidence * 0.4), 1.0);
        }
    }

    private updateCustomerMemoryFromText(msg: string, mem: CustomerMemory) {
        const lower = msg.toLowerCase();
        
        // Extracción de nombre básica
        const nameMatch = lower.match(/(me llamo|mi nombre es|soy)\s+([a-záéíóúüñ\s]+)/i);
        if (nameMatch && nameMatch[2]) {
            const name = nameMatch[2].trim().split(/\s+/)[0];
            if (name.length > 2) mem.explicitProfileData.name = name.charAt(0).toUpperCase() + name.slice(1);
        }

        // Detección genérica de lugares/temas para memoria contextual
        const genericCities = ['monterrey', 'mexico', 'guadalajara', 'queretaro', 'pachuca', 'veracruz', 'poza rica', 'puebla', 'cancun', 'tijuana'];
        for (const city of genericCities) {
            if (lower.includes(city)) {
                if (!mem.recentContext.lastCities) mem.recentContext.lastCities = [];
                const formattedCity = city.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                if (!mem.recentContext.lastCities.includes(formattedCity)) {
                    mem.recentContext.lastCities.unshift(formattedCity);
                    mem.recentContext.lastCities = mem.recentContext.lastCities.slice(0, 5);
                }
            }
        }

        // Extracción de números/cantidades genéricas (ej: "2 adultos", "3 paquetes")
        const amountMatch = lower.match(/(\d+)\s+(adultos?|niños?|personas?|paquetes?|maletas?|piezas?|días?|noches?)/i);
        if (amountMatch) {
            if (!mem.recentContext.metadata) mem.recentContext.metadata = {};
            mem.recentContext.metadata[amountMatch[2].toLowerCase()] = amountMatch[1];
        }
    }

    private async inferService(msg: string, intent: string, tenantId: string) {
        const normalizedMsg = normalizeText(msg);
        let bestId = '';
        let bestConf = 0;
        let bestType = 'INFORMATIONAL'; // Default fallback

        const services = await getAvailableServices(tenantId);

        for (const s of services) {
            let conf = 0;
            
            // 1. Scoring por Intent Hints (Semántico y Normalizado)
            const matchedHints = s.intentHints.filter(hint => {
                const normalizedHint = normalizeText(hint);
                return matchesTrigger(normalizedMsg, normalizedHint);
            });
            if (matchedHints.length > 0) conf += 0.6 + (matchedHints.length * 0.1);

            // 2. Scoring por Categoría
            if (s.category && (intent.includes(s.category.toUpperCase()) || normalizedMsg.includes(normalizeText(s.category)))) {
                conf += 0.3;
            }

            // 3. Scoring por Nombre del Servicio
            if (matchesTrigger(normalizedMsg, normalizeText(s.name))) conf += 0.4;

            // 4. Scoring por Slots presentes
            const matchedSlots = s.slots.filter(slot => normalizedMsg.includes(normalizeText(slot.id)));
            if (matchedSlots.length > 0) conf += 0.2;

            if (conf > bestConf) {
                bestConf = conf;
                bestId = s.slug;
                bestType = s.type;
            }
        }

        return { serviceId: bestId, confidence: Math.min(bestConf, 1.0), type: bestType };
    }

    private async applyLockLogic(session: ServiceState, candidate: any, msg: string, tenantId: string) {
        const serviceDef = await getService(tenantId, session.activeServiceId);
        const hasCoreData = serviceDef?.slots.some(s => s.isCore && session.collectedData[s.id]);
        
        // El lock es fuerte solo si hay datos core
        if (hasCoreData && (!candidate.serviceId || candidate.serviceId === session.activeServiceId)) {
            session.lockReason = 'core_data_present';
            session.serviceConfidence = 1.0;
            return;
        }

        // Lógica de Switch de Servicio (más sensible)
        const isStrongSwitch = (candidate.serviceId && candidate.serviceId !== session.activeServiceId) && 
                                candidate.confidence > 0.6;
        
        if (isStrongSwitch) {
             session.serviceSwitchDetected = true;
             session.serviceSwitchReason = 'semantic_switch_detected';
             session.previousServiceId = session.activeServiceId;
             session.activeServiceId = candidate.serviceId;
             session.serviceConfidence = candidate.confidence;
             session.collectedData = {}; 
        }
    }

    /**
     * Detecta el tipo de intención de forma genérica, sin depender de industria.
     * INFO       = usuario pregunta o consulta (a ónde tienen X, cuánto cuesta Y)
     * INTEREST   = usuario muestra interés o disposición (quiero, me interesa, me gustaría)
     * TRANSACTION = usuario ya está proporcionando datos concretos
     */
    private detectIntentType(msg: string, intent: string, session?: ServiceState | null, pendingSlots?: any[]): AiServiceIntentType {
        const lower = msg.toLowerCase().trim();

        // Señales de TRANSACTION: el usuario ya da datos o manifiesta urgencia/acción
        const transactionSignals = [
            /\bquiero\b|\bnecesito\b|\bvoy a\b|\bme gustaría\b|\bdeseo\b/,
            /\breservar\b|\bapartar\b|\bcomprar\b|\bcontratar\b|\bsolicitar\b|\bpedir\b/,
            /\benviar\b|\bmandar\b|\btransferir\b|\bdespachar\b|\bcotizar\b/,
        ];

        // Señales de INFO: el usuario consulta, pregunta o explora
        const infoSignals = [
            /\btienen\b|\bofrecen\b|\bhay\b|\bexiste\b|\bdisponible\b/,
            /\bcuanto\b|\bcuánto\b|\bprecio\b|\bcosto\b|\btarifa\b|\bcotizan\b/,
            /\bqué \b|\bcómo\b|\bcuál\b|\bcuándo\b|\bdónde\b|\binformes\b/,
            /\bhorario\b|\binformación\b|\bdetalles\b|\bsaber\b/,
        ];

        if (intent === 'LEAD_CREATION') return AiServiceIntentType.TRANSACTION;

        const isTransaction = transactionSignals.some(r => r.test(lower));
        if (isTransaction) return AiServiceIntentType.TRANSACTION;

        const isInfo = infoSignals.some(r => r.test(lower));
        if (isInfo) return AiServiceIntentType.INFO;

        // Evaluación inteligente para mensajes cortos de confirmación o continuación
        const isConfirmation = /^(si|sí|ok|vale|enterado|adelante|continua|está bien|perfecto|así es|correcto)$/i.test(lower);
        
        const wordCount = lower.split(/\s+/).length;
        if ((isConfirmation || wordCount <= 5) && session && pendingSlots && pendingSlots.length > 0) {
            return AiServiceIntentType.TRANSACTION;
        }

        // Si es corto pero no hay sesión o no hay slots, es probable que sea una afirmación/agradecimiento o charla suelta.
        // Lo mandamos a INFO por defecto para que el agente responda suave.
        return AiServiceIntentType.INFO;
    }

    private checkSufficiency(msg: string, intent: string, session: ServiceState): boolean {
        const infoKeywords = ['cuanto', 'costo', 'precio', 'donde', 'horario', 'que', 'cómo'];
        return infoKeywords.some(kw => msg.toLowerCase().includes(kw)) || intent === 'BUSINESS_INFO_QUERY';
    }


    /**
     * Construye la instrucción de sistema para el LLM.
     * Política universal: UNA pregunta por turno, nunca lista de slots,
     * nunca volver a pedir datos ya capturados.
     */
    async buildSystemInstruction(evalu: ServiceSessionEvaluation, tenantId: string): Promise<string> {
        if (!evalu.serviceState) return '';
        const service = await getService(tenantId, evalu.serviceState.activeServiceId);
        if (!service) return '';

        const collected = evalu.serviceState.collectedData || {};
        const collectedKeys = Object.keys(collected).filter(k => collected[k] !== null && collected[k] !== undefined && collected[k] !== '');
        const allSlots = service.slots || [];
        const pendingSlots = allSlots.filter(s => !collected[s.id]);
        const intentType = evalu.serviceState.intentType;

        let instr = `\n\n[SERVICIO ACTIVO: ${service.name}]\n`;

        // 1. Datos ya capturados — el LLM NO debe volver a pedir ninguno de estos
        if (collectedKeys.length > 0) {
            instr += `DATOS YA CONFIRMADOS (jamás volver a preguntar por estos):\n`;
            for (const key of collectedKeys) {
                const label = allSlots.find(s => s.id === key)?.label || key;
                instr += `  • ${label}: "${collected[key]}"\n`;
            }
            instr += `\n`;
        }

        // 2. Nombre del cliente conocido
        const clientName = evalu.customerMemory?.explicitProfileData?.name;
        if (clientName) instr += `Cliente: ${clientName}\n`;

        // 3. Modo de interacción: INFO / TRANSACTION
        if (intentType === AiServiceIntentType.INFO) {
            // Modo informativo: responde y opcionalmente indaga (suave)
            instr += `MODO: El usuario está consultando información exploratoria.\n`;
            instr += `Responde su duda de forma directa y humana (corta).\n`;
            if (pendingSlots.length > 0) {
                const firstPending = pendingSlots[0];
                instr += `Puedes cerrar el mensaje de forma natural, y si tiene sentido en el contexto, invitarlo a continuar haciéndole UNA pregunta suave para ayudarle. \nPor ejemplo algo como: "${firstPending.promptText}" (esto es OPCIONAL, no fuerces preguntar si no fluye natural).\n`;
            }
        } else {
            // Modo captura (TRANSACTION / INTEREST): solicitar solo el siguiente slot
            if (pendingSlots.length > 0) {
                const nextSlot = pendingSlots[0];
                instr += `MODO: El usuario está proporcionando datos para el servicio.\n`;
                instr += `PRÓXIMA Y ÚNICA PREGUNTA: Haz solo esta pregunta (debes hacerla para avanzar el flujo):\n`;
                instr += `  "${nextSlot.promptText}"\n`;
            } else {
                instr += `MODO: Tienes todos los datos necesarios para este servicio.\n`;
                instr += `Confirma rápidamente la información al usuario y cierra el tema o guíalo al siguiente paso administrativo.\n`;
            }
        }

        // 4. Aviso si hubo switch de servicio
        if (evalu.serviceState.serviceSwitchDetected) {
            instr += `\nCAMBIO DE TEMA DETECTADO: El usuario cambió el tema. Responde de acuerdo con el servicio actual (${service.name}).\n`;
        }

        // 5. Política conversacional universal (siempre presente para sesiones de captura)
        instr += `
[POLÍTICA CONVERSACIONAL OBLIGATORIA — MODO SESIÓN]
• NUNCA hagas más de UNA pregunta por mensaje.
• NUNCA repitas o vuelvas a pedir un dato que ya confirmaste arriba en "DATOS YA CONFIRMADOS".
• NO enumeres todos los datos que faltan de golpe, solo concéntrate en la PRÓXIMA Y ÚNICA PREGUNTA indicada arriba.
• NO describas, liste ni ofrezcas todos los servicios del negocio repetidamente en cada turno de preguntas y respuestas; guárdate esa lista solo para cuando explícitamente el usuario pregunte "¿qué servicios tienen?" o "¿qué ofrecen?".
• Tus respuestas deben ser cortas, con lenguaje simple, directo y humano (nada de tono robótico).
`;

        return instr;
    }
}

export const aiServiceEngine = new AiServiceEngine();
