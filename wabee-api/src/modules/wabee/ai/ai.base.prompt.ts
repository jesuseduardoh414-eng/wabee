/**
 * WABEE Base System Prompt — Capa Global de Inteligencia
 *
 * Esta capa se inyecta ANTES del prompt de cada negocio en TODOS los perfiles de IA
 * de la plataforma WABEE. Define el comportamiento semántico base:
 *
 *   - Interpretación de intención antes de fallback
 *   - Uso de KB/PDFs/APIs como contexto semántico (no lookup literal)
 *   - Reducción de handoffs: reinterpretación → pregunta aclaratoria → handoff
 *   - Flag de agresividad configurable por tenant/perfil
 *
 * Orden de composición INVARIABLE:
 *   [WABEE Base System Prompt]  ← esta capa (no puede ser sobrescrita)
 *   +
 *   [Business Prompt]           ← AiProfile.systemPrompt del negocio
 *
 * NO modificar el orden en la función composeSystemPrompt().
 */

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Nivel de agresividad del agente frente a consultas con KB insuficiente.
 *
 * conservative → Mayor tendencia al handoff (1 reintento KB, luego escala)
 * balanced     → Default. Reinterpretación + 1 pregunta aclaratoria antes de escalar
 * aggressive   → Máxima interpretación. 2 reintentos KB con umbral reducido +
 *                pregunta aclaratoria antes de escalar
 */
export type HandoffAggressiveness = 'conservative' | 'balanced' | 'aggressive';

/**
 * Resultado del análisis de KB insuficiente en el nuevo flujo de 3 pasos.
 */
export interface KbFallbackPolicyResult {
    /** Acción a tomar: responder con pregunta aclaratoria, o escalar */
    action: 'ASK_CLARIFICATION' | 'HANDOFF';
    /** Texto de la pregunta aclaratoria (si action === 'ASK_CLARIFICATION') */
    clarificationPrompt?: string;
    /** URL semántica de reinterpretación generada para el segundo intento KB */
    reinterpretedQuery?: string;
    /** Razón de la decisión (para debug) */
    reason: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuración por nivel de agresividad
// ─────────────────────────────────────────────────────────────────────────────

interface AggressivenessConfig {
    /** Número máximo de reintentos de KB antes de preguntar */
    kbRetries: number;
    /** Factor multiplicador del threshold KB (< 1 = más permisivo) */
    kbThresholdFactor: number;
    /** Si se permite preguntar antes de escalar */
    askBeforeHandoff: boolean;
    /** Descripción en español para el prompt base */
    policyDescription: string;
}

export const AGGRESSIVENESS_CONFIG: Record<HandoffAggressiveness, AggressivenessConfig> = {
    conservative: {
        kbRetries: 1,
        kbThresholdFactor: 1.0,  // Mantiene umbral original
        askBeforeHandoff: false,  // Escala directo tras 1 reintento
        policyDescription:
            'Si tras una reinterpretación semántica no encuentras información suficiente, ' +
            'transfiere con un asesor de forma cordial.'
    },
    balanced: {
        kbRetries: 1,
        kbThresholdFactor: 0.85, // Umbral ligeramente más permisivo en reintento
        askBeforeHandoff: true,  // Hace 1 pregunta aclaratoria antes de escalar
        policyDescription:
            'Si tras una reinterpretación semántica no encuentras información suficiente, ' +
            'haz UNA pregunta aclaratoria al usuario para refinar la consulta. ' +
            'Solo si sigue sin haber contexto suficiente, transfiere con un asesor.'
    },
    aggressive: {
        kbRetries: 2,
        kbThresholdFactor: 0.65, // Umbral significativamente más permisivo
        askBeforeHandoff: true,  // Hace 1 pregunta aclaratoria antes de escalar
        policyDescription:
            'Maximiza la interpretación. Puedes intentar responder incluso con contexto parcial. ' +
            'Haz una pregunta aclaratoria si el tema no está claro. ' +
            'El handoff es el ÚLTIMO recurso únicamente cuando no hay ninguna información disponible.'
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// Prompt Base Global
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera el WABEE Base System Prompt con el nivel de agresividad indicado.
 * Esta función es interna — usar `composeSystemPrompt()` para el uso final.
 */
function buildBasePrompt(aggressiveness: HandoffAggressiveness): string {
    const config = AGGRESSIVENESS_CONFIG[aggressiveness];

    return `
[WABEE INTELLIGENCE LAYER — BASE GLOBAL — NO SOBRESCRIBIR]

Eres un asistente de IA empresarial operado a través de la plataforma WABEE.
Esta capa define tu comportamiento base de inteligencia y es INVARIABLE.
El prompt del negocio que aparece a continuación la complementa pero no la reemplaza.

[SEMANTIC INTERPRETATION — OBLIGATORIO]
ANTES de concluir que no tienes información suficiente, DEBES:
1. Reformular internamente la consulta del usuario buscando equivalentes semánticos.
2. Buscar coincidencias conceptuales en el contexto disponible (KB, PDFs, APIs).
   - Una mención parcial, conceptualmente equivalente o contextualmente relacionada ES suficiente.
   - NO dependas de coincidencias literales de palabras.
3. Si la intención del usuario es ambigua o muy genérica (ej. "quiero informes", "dame info", "hola"), NO preguntes "¿qué informes?" de inmediato. En su lugar, da una bienvenida cordial, resume brevemente quién eres y qué hace la empresa (según tu perfil), y pregunta cómo puedes ayudar en un tema específico.

[PROACTIVE GENERAL RESPONSE — NO KB FALLBACK]
Si el usuario pide información general y el bloque [CONOCIMIENTO RECUPERADO] está vacío:
- NUNCA digas "No tengo esa información" o "No hay documentos".
- Usa la información de [INFORMACIÓN DE LA EMPRESA] y tu [IDENTITY] para dar una respuesta introductoria amable.
- Describe el propósito general del negocio y ofrece guiar al usuario.
- Solo si el usuario insiste en un dato puntual inexistente tras el saludo, procede a la aclaración.

[KNOWLEDGE GROUNDING — CONTEXTO SEMÁNTICO]
Los documentos (PDFs), bases de conocimiento y respuestas de APIs son CONTEXTO SEMÁNTICO.
NO son diccionarios de búsqueda exacta. Reglas:
- Interpreta el significado, no solo el texto literal.
- Usa el contexto más amplio del documento para inferir respuestas razonables.
- Si dos términos son equivalentes en el dominio del negocio, tratalos como iguales.
- NUNCA inventes datos concretos (precios, fechas, nombres). Interpreta, no fabrica.

[HANDOFF POLICY — ${aggressiveness.toUpperCase()}]
El handoff a un agente humano es SIEMPRE el ÚLTIMO recurso.
${config.policyDescription}

Secuencia OBLIGATORIA antes de escalar:
${config.kbRetries >= 1 ? '  PASO 1: Reinterpretación semántica interna de la consulta.' : ''}
${config.kbRetries >= 2 ? '  PASO 2: Segundo intento KB con umbral más permisivo.' : ''}
${config.askBeforeHandoff
        ? `  PASO ${config.kbRetries + 1}: Pregunta aclaratoria al usuario (UNA vez, concisa).`
        : `  PASO ${config.kbRetries + 1}: Si no hay información, escalar con mensaje empático.`}
  PASO FINAL: Handoff solo si lo anterior no genera contexto suficiente.

PROHIBIDO: Hacer handoff inmediato por no encontrar coincidencia literal en KB.

[RESPONSE QUALITY — SIEMPRE]
- Responde siempre en el idioma del usuario.
- REGLA DE ORO: Solo haz UNA pregunta por turno. Nunca abrumes al usuario con una lista de requerimientos. Guíalo paso a paso.
- Si no tienes información sobre algo, sé honesto y breve. No inventes.
- Nunca muestres razonamiento interno, etiquetas técnicas ni JSON al usuario.
- Mantén el hilo conversacional. Interpreta respuestas cortas en contexto.
- Una respuesta directa e imperfecta es mejor que un handoff innecesario.

[END WABEE INTELLIGENCE LAYER]
`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Constante estática (balanced — default de plataforma)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Prompt base de WABEE con agresividad "balanced".
 * Exportado para referencias estáticas. En producción usar composeSystemPrompt().
 */
export const WABEE_BASE_SYSTEM_PROMPT: string = buildBasePrompt('balanced');

// ─────────────────────────────────────────────────────────────────────────────
// Función compositora — USO OBLIGATORIO en ai.prompt.builder.ts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compone el prompt final del sistema concatenando correctamente la capa base
 * WABEE con el prompt del negocio/perfil.
 *
 * El orden es INVARIABLE:
 *   [WABEE Base System Prompt]  (capa 1 — no sobrescribible)
 *   +
 *   [Business Prompt]           (capa 2 — específica del negocio)
 *
 * @param businessPrompt   - Prompt construido por buildPersonalitySystemPrompt()
 * @param aggressiveness   - Nivel de agresividad del perfil (default: 'balanced')
 * @returns                - Prompt final listo para enviar al LLM
 */
export function composeSystemPrompt(
    businessPrompt: string,
    aggressiveness: HandoffAggressiveness = 'balanced'
): string {
    const baseLayer = buildBasePrompt(aggressiveness);

    return [
        baseLayer,
        '',
        '─'.repeat(60),
        '[BUSINESS CONFIGURATION — PERFIL DEL NEGOCIO]',
        '─'.repeat(60),
        '',
        businessPrompt
    ].join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilidades para el orquestador (flujo KB insuficiente)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retorna la configuración de agresividad para un perfil dado.
 * Normaliza valores inválidos/nulos a 'balanced'.
 */
export function resolveAggressiveness(
    rawValue: string | null | undefined
): HandoffAggressiveness {
    if (rawValue === 'conservative' || rawValue === 'balanced' || rawValue === 'aggressive') {
        return rawValue;
    }
    return 'balanced';
}

/**
 * Genera un prompt de reinterpretación semántica para el segundo intento KB.
 * El orquestador usa esto para construir una query KB alternativa.
 *
 * @param originalQuery     - Query original del usuario
 * @param aggressiveness    - Nivel de agresividad
 * @returns                 - Instrucción para el LLM de reinterpretación
 */
export function buildKbReinterpretationPrompt(
    originalQuery: string,
    aggressiveness: HandoffAggressiveness
): string {
    const config = AGGRESSIVENESS_CONFIG[aggressiveness];

    return `
[TAREA INTERNA — REINTERPRETACIÓN SEMÁNTICA]
La consulta original del usuario fue: "${originalQuery}"
No se encontró información suficiente con esa formulación exacta.

Tu tarea es generar UNA SOLA frase de búsqueda alternativa que:
- Capture la misma intención con palabras diferentes
- Use términos más generales o sinónimos del dominio
- Amplie el scope de búsqueda ${config.kbThresholdFactor < 0.75 ? 'significativamente' : 'moderadamente'}

Responde ÚNICAMENTE con la frase de búsqueda alternativa. Sin explicaciones.
    `.trim();
}

/**
 * Genera el prompt de pregunta aclaratoria para el usuario.
 * Se usa cuando KB sigue insuficiente tras reinterpretación.
 *
 * @param originalQuery     - Consulta original del usuario
 * @param agentName         - Nombre del agente (para personalización)
 * @returns                 - Instrucción para el LLM de pregunta aclaratoria
 */
export function buildClarificationRequestPrompt(
    originalQuery: string,
    agentName: string = 'el asistente'
): string {
    return `
[INSTRUCCIÓN: PREGUNTA ACLARATORIA]
El usuario consultó sobre: "${originalQuery}"
No encuentras información suficiente para responder con certeza.

Formula UNA pregunta breve y cordial que:
- Ayude a refinar la consulta del usuario
- Sea específica (no preguntes "¿puedes ser más específico?" de forma genérica)
- Permanezca en el rol de ${agentName}
- No mencione sistemas, bases de conocimiento ni documentos

Genera solo la pregunta aclaratoria, sin explicaciones adicionales.
    `.trim();
}
