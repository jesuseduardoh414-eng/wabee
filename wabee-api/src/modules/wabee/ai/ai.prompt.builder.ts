import { AiProfile, WebMessage, WebWidget } from '@prisma/client';
import { CustomerMemory, ServiceState } from './ai.service.engine';
import {
    composeSystemPrompt,
    resolveAggressiveness,
    HandoffAggressiveness
} from './ai.base.prompt';

/**
 * Builds the system prompt for the AI Persona (No KB/RAG).
 */
/**
 * Builds the system prompt for the AI Persona (No KB/RAG).
 * Strict Persona Only: Uses AiProfile.systemPrompt as the SOLE source of truth/knowledge.
 */
export function buildPersonalitySystemPrompt(params: {
    profile: AiProfile;
    widget: WebWidget | null | undefined;
    variantIndex: number;
    hasHistory?: boolean;
    aggressiveness?: HandoffAggressiveness;
    contactInfo?: {
        whatsapp?: string;
        phone?: string;
        email?: string;
        website?: string;
    };
}): string {
    const { profile, widget, variantIndex, hasHistory, contactInfo, aggressiveness } = params;
    const resolvedAggressiveness = aggressiveness
        ?? resolveAggressiveness((profile as any).handoffAggressiveness);

    const agentName = profile.agentName || 'Asistente';
    const roleTitle = profile.roleTitle || 'Soporte';

    // 1. POLICY LAYER
    const policy = `
[RULES]
- Name: ${agentName}. Role: ${roleTitle}.
- No <think> tags. Concise Spanish.
- [STRICT GROUNDING] Do NOT invent facts, prices, hours, or services. If it's not in [INFORMACIÓN DE LA EMPRESA], it doesn't exist for you.
- Be natural. No meta-talk (e.g. "revisando...", "como IA").
- If data is missing in [INFO], be honest and say you don't have that specific data. Only in THAT case, suggest contacting via WhatsApp or Phone.
- [IMPORTANT] Do NOT append contact channels at the end of every response. Only mention them when you genuinely cannot answer the question.
- No mentions of "system/knowledge base/PDF".
- [LOGICA NEUTRAL] Eres el asistente virtual de la empresa. Tu conocimiento y reglas de negocio se derivan EXCLUSIVAMENTE de [INFORMACIÓN DE LA EMPRESA] y [CONOCIMIENTO RECUPERADO]. No asumas que la empresa pertenece a un sector específico si no hay evidencia.
    `;

    // 2. PROFILE & PERSONALITY
    const notes = profile.personalityNotes ? `\n[PERSONALITY_NOTES]\n${profile.personalityNotes}` : '';

    const tones = profile.tones || [];
    const toneInstructions = tones.map(t => {
        if (t === 'Professional') return "- Maintain a polite, objective, and respectful tone.";
        if (t === 'Friendly') return "- Be warm, use 3-5 emojis max per message. Treat the user like a colleague.";
        if (t === 'Empathetic') return "- Validate the user's feelings first. Show concern.";
        if (t === 'Casual') return "- Be relaxed, use shorter sentences. Minimal formality.";
        if (t === 'Enthusiastic') return "- Use exclamation marks moderately. Show high energy.";
        return `- Tone: ${t}`;
    }).join('\n');

    // 3. VARIATION LAYER (Greetings)
    const greetingsShort = [
        `Hola, soy ${agentName}. ¿En qué te ayudo?`,
        `¡Hola! ${agentName} por aquí. dime.`,
        `Qué tal. Soy ${agentName}.`,
    ];
    const greetingsMedium = [
        `¡Hola! Soy ${agentName}, ${roleTitle}. ¿Cómo te puedo ayudar hoy?`,
        `Bienvenido/a. Me llamo ${agentName}. ¿Tienes alguna duda?`,
        `Saludos. Soy ${agentName}. Estoy aquí para resolver tus dudas.`,
    ];
    const greetingsWarm = [
        `¡Hola, qué gusto saludarte! 😊 Soy ${agentName}, tu ${roleTitle}. ¿En qué te apoyo?`,
        `¡Buen día! 🌟 Soy ${agentName}. Cuéntame, ¿cómo puedo hacer tu día mejor?`,
        `¡Hola! Aquí ${agentName} para ayudarte con lo que necesites. 😊`,
    ];

    let selectedGreeting = greetingsMedium[variantIndex % greetingsMedium.length];
    if (profile.greetingStyle === 'SHORT') selectedGreeting = greetingsShort[variantIndex % greetingsShort.length];
    if (profile.greetingStyle === 'WARM') selectedGreeting = greetingsWarm[variantIndex % greetingsWarm.length];

    // 4. KNOWLEDGE INJECTION
    const companyInfo = profile.systemPrompt ? `
[INFORMACIÓN DE LA EMPRESA (Tus conocimientos)]
${profile.systemPrompt}
` : '';

    // GUARDRAIL DINÁMICO: Primer Turno vs Seguimiento
    const conversationStateGuardrail = hasHistory
        ? `
[ESTADO DE CONVERSACIÓN: SEGUIMIENTO ACTIVO]
ATENCIÓN: EL USUARIO YA ESTÁ HABLANDO CONTIGO Y YA SE ESTABLECIÓ CONTEXTO ANTERIORMENTE.
REGLAS ESTRICTAS E INQUEBRANTABLES PARA ESTE TURNO:
1. NO SALUDES: Está estrictamente prohibido iniciar la frase con "¡Hola!", "Buen día" o similares.
2. NO TE PRESENTES: Está estrictamente prohibido decir "Soy ${agentName}", "Mi nombre es ${agentName}".
3. NO REPITAS TU PITCH: Jamás recites la descripción de la empresa o los servicios ("somos una empresa que ofrece..."). Responde únicamente a la duda actual.
4. RESPUESTA DIRECTA: Entra directo al tema de forma conversacional y concisa. Trata este mensaje como una respuesta fluida.
`
        : `
[ESTADO DE CONVERSACIÓN: PRIMER TURNO]
Greeting Hint: Si el usuario dice 'hola', 'buenas tardes' o similar, saluda y preséntate usando una variación como: "${selectedGreeting}"
Puedes hacer una breve introducción de los servicios de la empresa si es apropiado para ayudar a orientar al usuario en este primer contacto.
`;

    // Construir el prompt del negocio (business layer)
    const businessPrompt = `
${policy}

[IDENTITY]
Name: ${agentName}
Role: ${roleTitle}
${toneInstructions}
${notes}

${companyInfo}

[CANALES DE CONTACTO CONFIGURADOS]
- WhatsApp: ${contactInfo?.whatsapp || 'No configurado'}
- Teléfono: ${contactInfo?.phone || 'No configurado'}
- Email: ${contactInfo?.email || 'No configurado'}
- Sitio Web: ${contactInfo?.website || 'No configurado'}

[CONTEXT]
${widget?.title ? `Widget: ${widget.title}` : 'Canal: WhatsApp'}
${conversationStateGuardrail}

[FORMAT RULES]
- Be concise. Use short paragraphs.
- If listing items, use a numbered list and ensure each item is a visual block.
- [LIST FORMAT - OBLIGATORY] Use a numbered list (1., 2., 3.) when presenting options, products, services, or similar items. Ensure each item starts with its index for easy reference.
- [PRODUCT/OPTION FORMAT]
  Number. Name/Label
  Details: description or price here
  
  [Ensure a double line break between items]
- [COMPLAINT FORMAT] Empathy first, then clear steps.
- Use clean Spanish. NEVER show JSON, technical IDs, or Markdown symbols like **.

[INSTRUCTION]
Respond to the visitor's last message using your Persona and [INFORMACIÓN DE LA EMPRESA].

REGLAS DURAS (RESPUESTA Y ANTI-ALUCINACIÓN):
- Responde ÚNICAMENTE con la respuesta final lista para leer, respaldada SOLAMENTE por [INFORMACIÓN DE LA EMPRESA] y tu configuración de contexto.
- [ANTI-ALUCINACIÓN] ESTÁ ESTRICTAMENTE PROHIBIDO inventar precios, horarios, coberturas, sucursales, productos, servicios específicos, números de teléfono o direcciones. NO ASUMAS el giro de la empresa, adapta tu lenguaje al negocio detectado en el contexto proporcionado.
- PRIORIZA SIEMPRE LA PRECISIÓN SOBRE LA PERSUASIÓN. 
- Evita por completo respuestas ambiguas. JAMÁS uses frases como "puede que sí", "probablemente", o frases evasivas si no hay evidencia concreta.
- Si el usuario pregunta por disponibilidad o características específicas, SOLO confirma si encuentras una coincidencia explícita o razonablemente equivalente en tu información.
- REGLAS ESTRICTAS PARA INFORMACIÓN FALTANTE:
  1) Si el dato puntual NO aparece explícitamente en la información, sé transparente, directo y SIN INVENTAR.
  2) Si existe evidencia general de que dan el servicio, pero NO del caso específico solicitado, DEBES decir: "Sí se menciona el servicio, pero no tengo registro de [dato específico] en la información disponible."
  3) Si no existe evidencia ni general ni específica, DEBES decir textualmente: "No cuento con información disponible sobre eso en los documentos cargados."
- NUNCA repitas el saludo ni te presentes ("¡Hola!, Soy X") si es un turno de seguimiento (hasHistory = true).
- NO muestres razonamiento interno. NO uses frases meta ("para confirmarte", "analizando", "déjame revisar"). NO uses etiquetas <think>, <analysis>, ni similares.

[REGLAS DE CONTINUIDAD CONVERSACIONAL]
- Siempre continúa la conversación de forma fluida.
- Interpreta respuestas cortas (ej. "sí", "está bien", "ok") en función de tu última pregunta.
- Si el usuario confirma ("sí"), procede directamente con la información o acción solicitada anteriormente.
- No reinicies el contexto ni te vuelvas a presentar.
- No repitas preguntas que ya le hiciste al usuario.
`.trim();

    // Componer [Base WABEE] + [Business] — orden INVARIABLE
    return composeSystemPrompt(businessPrompt, resolvedAggressiveness);
}

/**
 * Formats conversation history for LLM
 */
export function buildChatMessages(params: {
    systemPrompt: string;
    lastMessages: Array<{ text: string; actorType: string; direction?: string }>;
    userText: string;
}): Array<{ role: 'user' | 'assistant'; content: string }> {
    const { systemPrompt, lastMessages, userText } = params;

    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    // System instruction is handled by the LLM client
    // We just return the conversation history here + new user message.

    // 1. History (Last 10 max - provided by caller)
    const history = lastMessages;

    history.forEach(msg => {
        let role: 'user' | 'assistant' = 'user';
        if (msg.actorType === 'ASSISTANT' || msg.actorType === 'SYSTEM') role = 'assistant';

        messages.push({
            role,
            content: msg.text
        });
    });

    // 2. Current Input
    messages.push({ role: 'user', content: userText });

    return messages;
}

// Legacy function stub to avoid breaking other files if they import it
export function buildEffectivePrompt(tenant: any, widget: any, profile: any, thread: any, lastMessages: any[], kbChunks: any[], mode: any) {
    return { systemPrompt: 'Legacy', messages: [] };
}

/**
 * Builds a KB-aware system prompt that injects retrieved chunks as factual context.
 * Used when KB retrieval returns relevant chunks for a user query.
 */
export function buildKbAwareSystemPrompt(params: {
    basePrompt: string;
    chunks: Array<{
        content: string;
        section?: string | null;
        score: number;
        fileName: string;
    }>;
}): string {
    const { basePrompt, chunks } = params;

    if (!chunks || chunks.length === 0) return basePrompt;

    // Neutralize [INFORMACIÓN DE LA EMPRESA] when chunks are available:
    // The profile systemPrompt might mention regions/routes (e.g. 'Monterrey a Veracruz')
    // causing Gemini to extrapolate destinations from its training knowledge.
    let workingPrompt = basePrompt;
    const empresaStart = workingPrompt.indexOf('[INFORMACI');
    const empresaEnd = workingPrompt.indexOf('\n[', empresaStart + 10);
    if (empresaStart > 0 && empresaEnd > empresaStart) {
        const empresaBlock = workingPrompt.substring(empresaStart, empresaEnd);
        workingPrompt = workingPrompt.replace(
            empresaBlock,
            '[INFORMACIÓN DE LA EMPRESA — SOLO CONTEXTO DE OPERACIÓN]\n' +
            'Usa esta sección solo para conocer el nombre del negocio y tu rol. ' +
            'Los datos factuales (destinos, precios, rutas, horarios) SOLO provienen de [CONOCIMIENTO RECUPERADO].\n'
        );
    }

    // Build KB context block
    const chunkBlocks = chunks.map((c, i) => {
        let header = `[CHUNK ${i + 1}`;
        if (c.fileName) header += ` file="${c.fileName}"`;
        if (c.section) header += ` section="${c.section}"`;
        header += ` score=${c.score.toFixed(2)}]`;
        return `${header}\n${c.content}`;
    }).join('\n\n');

    const kbSection = `
[CONOCIMIENTO RECUPERADO]
${chunkBlocks}

[REGLAS ABSOLUTAS DE GROUNDING — SIN EXCEPCIÓN]
1. ÚNICAMENTE puedes usar información que aparezca literalmente en los CHUNKS anteriores.
2. PROHIBIDO ABSOLUTO: No uses tu conocimiento previo de entrenamiento. Si no está en los chunks, no existe para ti.
3. Si el usuario pregunta por datos (destinos, precios, horarios, rutas, nombres) que NO están en los chunks, di: "No tengo esa información disponible en este momento."
4. NUNCA completes, supongas ni extrapoles información faltante.
5. NO menciones "chunks", "base de conocimiento", "documentos" ni "sistema" al usuario.
6. Responde de forma natural y concisa usando SOLO lo que está en los chunks.
7. HISTORIAL DE CONVERSACIÓN: Los mensajes anteriores de la conversación son ÚNICAMENTE para entender el tono y la continuidad del diálogo. NUNCA uses datos de tus respuestas previas como fuente de información factual. Si en el pasado mencionaste un dato que NO aparece en los CHUNKS ACTUALES, olvida ese dato y básate solo en los chunks presentes. Los chunks actuales son siempre la fuente de verdad más reciente.
`;

    // Inject KB section before the [INSTRUCTION] block if it exists
    const instructionIdx = workingPrompt.indexOf('[INSTRUCTION]');
    if (instructionIdx > 0) {
        return workingPrompt.substring(0, instructionIdx) + kbSection + '\n' + workingPrompt.substring(instructionIdx);
    }

    // Otherwise append
    return workingPrompt + '\n' + kbSection;
}

/**
 * 8. CONTEXT ASSEMBLY LAYER 🧩
 * Arma el Mega-Prompt final consolidando todas las capas de estado (Tenant, Config, Política, Sesión y Entidades).
 */
export function buildContextAssemblyPrompt(params: {
    profile: AiProfile;
    widget: WebWidget | null | undefined;
    variantIndex: number;
    hasHistory?: boolean;
    contactInfo?: any;
    kbChunks?: Array<any>;
    serviceState?: ServiceState | null;
    customerMemory?: CustomerMemory | null;
    aggressiveness?: HandoffAggressiveness;
}): string {
    const { profile, widget, variantIndex, hasHistory, contactInfo, kbChunks, serviceState, customerMemory, aggressiveness } = params;

    // Resolver agresividad desde parámetro o desde el perfil
    const resolvedAggr: HandoffAggressiveness = aggressiveness
        ?? resolveAggressiveness((profile as any).handoffAggressiveness);

    // 1. BUSINESS CONFIGURATION LAYER (Base Persona) + WABEE Base Layer
    let finalPrompt = buildPersonalitySystemPrompt({ profile, widget, variantIndex, hasHistory, contactInfo, aggressiveness: resolvedAggr });

    // 2. KNOWLEDGE RESOLUTION (Si hay fragmentos Mencionados, inyectar)
    if (kbChunks && kbChunks.length > 0) {
        finalPrompt = buildKbAwareSystemPrompt({ basePrompt: finalPrompt, chunks: kbChunks });
    }

    // 3. SERVICE SESSION ENGINE & CUSTOMER MEMORY (Dinámica Transaccional)
    let dynamicInjection = '\n\n[CONTEXTO TRANSACCIONAL ACTIVO]';

    if (customerMemory) {
        dynamicInjection += `\n- PERFIL DEL USUARIO: \n`;
        if (customerMemory.explicitProfileData?.name) dynamicInjection += `  - Nombre: ${customerMemory.explicitProfileData.name}\n`;
        if (customerMemory.explicitProfileData?.phone) dynamicInjection += `  - Teléfono: ${customerMemory.explicitProfileData.phone}\n`;
        if (customerMemory.explicitProfileData?.email) dynamicInjection += `  - Correo: ${customerMemory.explicitProfileData.email}\n`;
        
        // Memoria de Corto Plazo (Recent Context)
        const recent = customerMemory.recentContext;
        if (recent.lastCities && recent.lastCities.length > 0) {
            dynamicInjection += `  - Lugares mencionados recientemente: ${recent.lastCities.join(', ')}\n`;
        }
        if (recent.metadata && Object.keys(recent.metadata).length > 0) {
            dynamicInjection += `  - Otros datos del contexto actual:\n`;
            for (const [key, value] of Object.entries(recent.metadata)) {
                dynamicInjection += `    • ${key}: ${value}\n`;
            }
        }
    }

    if (serviceState && serviceState.mode === 'SERVICE_SESSION') {
        dynamicInjection += `\n[TRAMITE EN CURSO]
- ESTADO: Te encuentras asistiéndolo en un flujo de tipo: "${serviceState.serviceType}" (Servicio Activo ID: ${serviceState.activeServiceId})
- INTENCIÓN ACTUAL: ${serviceState.intentType}
- DATOS YA RECOPILADOS (No los vuelvas a preguntar):
${JSON.stringify(serviceState.collectedData, null, 2)}
`;
    }

    if (dynamicInjection.length > 40) { // Tiene algo adentro además del título
        const splitRef = '\n[INSTRUCTION]';
        const splitted = finalPrompt.split(splitRef);
        if (splitted.length === 2) {
             finalPrompt = splitted[0] + dynamicInjection + splitRef + splitted[1];
        } else {
             finalPrompt += dynamicInjection;
        }
    }

    return finalPrompt;
}
