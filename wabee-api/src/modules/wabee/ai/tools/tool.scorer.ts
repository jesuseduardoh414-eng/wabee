/**
 * tool.scorer.ts — Motor de scoring semántico para selección de herramientas (tools).
 *
 * Centraliza:
 * - Umbral configurable de score
 * - Mapeo de intents a capabilities
 * - Mapeo de intents a términos semánticos
 * - Lógica de scoring por señales
 * - Validación de parámetros requeridos
 * - Generación automática de summary de outputSchema
 * - Logging de observabilidad (controlado por flag)
 */

import { AiIntent } from '../ai.intent';

// ─────────────────────────────────────────────────────────
// Umbral centralizado (configurable via env var)
// ─────────────────────────────────────────────────────────
export const TOOL_SCORE_THRESHOLD = parseInt(process.env.TOOL_SCORE_THRESHOLD || '25');

// ─────────────────────────────────────────────────────────
// Debug logger (solo activo si AI_DEBUG_TOOLS=true)
// ─────────────────────────────────────────────────────────
const DEBUG_TOOLS = process.env.AI_DEBUG_TOOLS === 'true';

export function toolLog(msg: string, data?: any) {
    if (!DEBUG_TOOLS) return;
    if (data !== undefined) {
        console.log(`[ToolScorer] ${msg}`, JSON.stringify(data, null, 2));
    } else {
        console.log(`[ToolScorer] ${msg}`);
    }
}

// ─────────────────────────────────────────────────────────
// Mapeo: Intent → Capabilities compatibles
// Determina qué capabilities son relevantes para cada intent.
// ─────────────────────────────────────────────────────────
const INTENT_TO_CAPABILITIES: Record<string, string[]> = {
    PRODUCT_SEARCH:    ['product_search', 'inventory_check', 'faq_lookup', 'general_api_fetch'],
    OPERATIONAL_ACTION:['order_status', 'shipment_tracking', 'shipment_quote', 'quote_request', 'reservation_check', 'reservation_create', 'payment_link_create', 'appointment_lookup', 'appointment_create', 'general_api_fetch'],
    BUSINESS_INFO_QUERY:['faq_lookup', 'service_search', 'product_search', 'customer_lookup', 'general_api_fetch'],
    LEAD_CREATION:     ['lead_create', 'customer_lookup', 'general_api_fetch'],
    COMPLAINT:         ['order_status', 'customer_lookup', 'general_api_fetch'],
};

// ─────────────────────────────────────────────────────────
// Mapeo: Intent → Términos semánticos relevantes en descriptions
// Se usa para evaluar si semanticDescription es coherente con el intent.
// NO compara contra el texto del usuario (evitar keyword matching superficial).
// ─────────────────────────────────────────────────────────
const INTENT_SEMANTIC_TERMS: Record<string, string[]> = {
    PRODUCT_SEARCH:    ['producto', 'catálogo', 'item', 'artículo', 'buscar', 'listar', 'inventario', 'stock'],
    OPERATIONAL_ACTION:['pedido', 'orden', 'reserva', 'cita', 'rastreo', 'envío', 'cotización', 'pago', 'link', 'generar', 'crear', 'agendar'],
    BUSINESS_INFO_QUERY:['información', 'faq', 'pregunta', 'servicio', 'horario', 'sucursal', 'contacto', 'detalle'],
    LEAD_CREATION:     ['lead', 'prospecto', 'interesado', 'cliente', 'registrar', 'capturar', 'crm'],
    COMPLAINT:         ['queja', 'problema', 'reclamo', 'estado', 'estatus', 'seguimiento'],
};

// ─────────────────────────────────────────────────────────
// Tipo de resultado de scoring
// ─────────────────────────────────────────────────────────
export interface ToolScoringResult {
    score: number;
    reasons: string[];
    missingRequired: string[];
    hasMissingRequired: boolean;
    capabilityMatch: boolean;
    isGenericCapability: boolean;
}

// ─────────────────────────────────────────────────────────
// Función principal de scoring
// ─────────────────────────────────────────────────────────
export function scoreTool(params: {
    tool: any;             // Registro completo del AiTool desde DB
    intent: AiIntent;
    userText: string;
    normalizedText: string;
    conversationMode?: 'INFORMATIONAL' | 'TRANSACTIONAL' | 'HYBRID' | null;
    llmArgs?: Record<string, any>; // Args ya extraídos por el LLM, si los hay
}): ToolScoringResult {
    const { tool, intent, normalizedText, conversationMode, llmArgs } = params;
    let score = 0;
    const reasons: string[] = [];

    const capability     = (tool.capability || 'general_api_fetch') as string;
    const semanticDesc   = ((tool.semanticDescription || tool.description) as string || '').toLowerCase();
    const exampleUtt     = (tool.exampleUtterances as string[] || []);
    const legacyHints    = (tool.triggerHints as string[] || []);
    const isGeneric      = capability === 'general_api_fetch';

    // ── Señal 1: Capability vs Intent (+40) ──────────────────
    const compatibleCaps = INTENT_TO_CAPABILITIES[intent] || [];
    if (compatibleCaps.includes(capability)) {
        score += 40;
        reasons.push(`capability_match:${capability} for intent:${intent}`);
    }

    // Penalty si es generic (bajamos precisión)
    if (isGeneric) {
        score -= 10;
        reasons.push('penalty:general_api_fetch (-10)');
    }

    // ── Señal 2: semanticDescription vs semantic terms del intent (+30) ──
    // Evaluamos coherencia semántica, NO coincidencia con texto del usuario
    const semanticTerms = INTENT_SEMANTIC_TERMS[intent] || [];
    const semanticHits = semanticTerms.filter(term => semanticDesc.includes(term));
    if (semanticHits.length > 0) {
        // Puntaje proporcional: máx 30 puntos con 3+ hits
        const semanticScore = Math.min(30, semanticHits.length * 10);
        score += semanticScore;
        reasons.push(`semantic_terms_match:${semanticHits.join(',')} (+${semanticScore})`);
    }

    // Bonus: si el conversationMode coincide con el tipo de capability
    if (conversationMode === 'TRANSACTIONAL' && ['order_status', 'appointment_create', 'reservation_create', 'payment_link_create', 'lead_create', 'shipment_quote', 'quote_request'].includes(capability)) {
        score += 5;
        reasons.push('context_mode:TRANSACTIONAL bonus (+5)');
    }
    if (conversationMode === 'INFORMATIONAL' && ['faq_lookup', 'product_search', 'service_search', 'customer_lookup'].includes(capability)) {
        score += 5;
        reasons.push('context_mode:INFORMATIONAL bonus (+5)');
    }

    // ── Señal 3: Disponibilidad de required params en contexto (+15) ──
    let missingRequired: string[] = [];
    if (llmArgs) {
        const schema = tool.parametersSchema as any;
        const required: string[] = schema?.required || [];
        missingRequired = required.filter(p => llmArgs[p] === undefined || llmArgs[p] === null || llmArgs[p] === '');
        if (required.length > 0 && missingRequired.length === 0) {
            score += 15;
            reasons.push(`all_required_params_available:${required.join(',')} (+15)`);
        } else if (missingRequired.length > 0) {
            // No penalizamos, pero informamos
            reasons.push(`missing_params:${missingRequired.join(',')}`);
        }
    }

    // ── Señal 4: exampleUtterances match (+10) ──────────────
    const exampleMatch = exampleUtt.find(u =>
        normalizedText.includes(u.toLowerCase().trim())
    );
    if (exampleMatch) {
        score += 10;
        reasons.push(`example_utterance_match:"${exampleMatch}" (+10)`);
    }

    // ── Señal 5: Legacy triggerHints match (+5) ──────────────
    const hintMatch = legacyHints.find(h =>
        normalizedText.includes(h.toLowerCase().trim())
    );
    if (hintMatch) {
        score += 5;
        reasons.push(`legacy_hint_match:"${hintMatch}" (+5)`);
    }

    const result: ToolScoringResult = {
        score,
        reasons,
        missingRequired,
        hasMissingRequired: missingRequired.length > 0,
        capabilityMatch: compatibleCaps.includes(capability),
        isGenericCapability: isGeneric,
    };

    toolLog(`Tool: ${tool.name} | Score: ${score}/${TOOL_SCORE_THRESHOLD} | ${reasons.join(' | ')}`, undefined);

    return result;
}

// ─────────────────────────────────────────────────────────
// Validación de parámetros requeridos (post-LLM)
// Compara los args que el LLM asignó vs los required del schema.
// ─────────────────────────────────────────────────────────
export function getMissingRequiredParams(parametersSchema: any, llmArgs: Record<string, any>): string[] {
    const required: string[] = parametersSchema?.required || [];
    return required.filter(p => {
        const val = llmArgs[p];
        return val === undefined || val === null || val === '';
    });
}

// ─────────────────────────────────────────────────────────
// Auto-generación de summary del outputSchema
// Si outputSchema.summary no existe, genera uno razonable
// a partir de la estructura del schema.
// ─────────────────────────────────────────────────────────
export function buildOutputSchemaSummary(outputSchema: any, toolName: string): string {
    if (!outputSchema) return `Devuelve una respuesta de la API.`;

    // Si ya tiene summary explícito, usarlo
    if (outputSchema.summary) return outputSchema.summary as string;

    const type = (outputSchema.type || '').toUpperCase();
    const fields = outputSchema.fields ? Object.keys(outputSchema.fields) : [];
    const resultPath = outputSchema.resultPath || '';

    if (type === 'LIST') {
        const fieldList = fields.length > 0 ? ` con campos: ${fields.slice(0, 5).join(', ')}` : '';
        return `Devuelve una lista de resultados${fieldList}${resultPath ? ` desde "${resultPath}"` : ''}.`;
    }
    if (type === 'ENTITY') {
        const fieldList = fields.length > 0 ? ` con campos: ${fields.slice(0, 5).join(', ')}` : '';
        return `Devuelve un objeto único${fieldList}.`;
    }
    if (type === 'STATUS') {
        return `Devuelve el resultado o confirmación de una operación.`;
    }
    if (type === 'MESSAGE') {
        return `Devuelve un mensaje de respuesta.`;
    }

    // Fallback genérico basado en estructura
    if (fields.length > 0) {
        return `Devuelve datos con campos: ${fields.slice(0, 5).join(', ')}.`;
    }

    return `Devuelve una respuesta JSON de la herramienta "${toolName}".`;
}

// ─────────────────────────────────────────────────────────
// Construye la descripción enriquecida que el LLM recibe
// para razonar sobre una tool (usado por tool.registry.service.ts)
// ─────────────────────────────────────────────────────────
export function buildLlmToolDescription(tool: any): string {
    const capability     = tool.capability || 'general_api_fetch';
    const publicName     = tool.customCapability || capability;
    const whatItDoes     = tool.semanticDescription || tool.description || '';
    const schema         = tool.parametersSchema as any || {};
    const required: string[] = schema.required || [];
    const properties: Record<string, any> = schema.properties || {};
    const outputSummary  = buildOutputSchemaSummary(tool.outputSchema, tool.name);
    const policy         = tool.confirmationPolicy || 'AUTO';
    const examples       = (tool.exampleUtterances as string[] || []).slice(0, 3);

    const requiredParams = required.map((p: string) => {
        const prop = properties[p];
        const desc = prop?.description ? ` (${prop.description})` : '';
        const type = prop?.type ? ` [${prop.type}]` : '';
        return `  - ${p}${type}${desc}`;
    }).join('\n');

    const optionalParams = Object.entries(properties)
        .filter(([key]) => !required.includes(key))
        .map(([key, val]: [string, any]) => {
            const desc = val?.description ? ` (${val.description})` : '';
            return `  - ${key} [opcional]${desc}`;
        })
        .join('\n');

    const examplesBlock = examples.length > 0
        ? `Cuándo usar (ejemplos de consultas del usuario):\n${examples.map(e => `  - "${e}"`).join('\n')}`
        : '';

    const noUseHint = capability === 'general_api_fetch'
        ? 'Cuándo NO usar: prefiere herramientas con una capability más específica si están disponibles.'
        : `Cuándo NO usar: si la consulta del usuario no implica "${publicName}" ni acciones relacionadas.`;

    return [
        `[Capability: ${publicName}]`,
        `Qué hace: ${whatItDoes}`,
        noUseHint,
        examplesBlock,
        requiredParams.length > 0 ? `Parámetros requeridos:\n${requiredParams}` : '',
        optionalParams.length > 0 ? `Parámetros opcionales:\n${optionalParams}` : '',
        `Devuelve: ${outputSummary}`,
        `Política de confirmación: ${policy}`,
    ].filter(Boolean).join('\n');
}
