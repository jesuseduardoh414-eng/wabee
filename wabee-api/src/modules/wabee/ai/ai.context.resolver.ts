/**
 * ai.context.resolver.ts
 * ─────────────────────────────────────────────────────────────
 * Módulo de resolución de referencias contextuales conversacionales.
 *
 * Capacidades:
 * 1. Extrae entidades enumeradas de los mensajes del agente (listas, opciones, rutas, etc.)
 * 2. Detecta si el mensaje actual hace referencia a algo mencionado antes
 * 3. Resuelve la referencia a la entidad concreta
 * 4. Permite construir un query enriquecido para KB retrieval
 */

/* ─── Tipos ─────────────────────────────────────────────────────────────── */

export interface EntityMemory {
    /** Mapa ordinal → texto, ej: { "1": "Monterrey - Veracruz", "2": "Monterrey - Hidalgo" } */
    ordinalMap: Record<string, string>;
    /** Mapa de palabras clave → texto, ej: { "hidalgo": "Monterrey - Hidalgo" } */
    keywordMap: Record<string, string>;
    /** Todas las entidades en orden */
    orderedList: string[];
    /** Entidad activa del último turno de seguimiento (anáfora) */
    activeEntityType?: 'route' | 'product' | 'service' | 'option' | 'other';
    activeEntityValue?: string;
    /** Referencia resuelta en el turno anterior para facilitar anáforas */
    lastResolvedReference?: string;
    /** Contador de turnos desde la última lista presentada (para invalidación) */
    turnsSinceLastList?: number;
    /** Timestamp de última actualización (ms) */
    updatedAt: number;
}

export interface ContextResolution {
    detected: boolean;
    resolvedTo?: string;
    refType?: 'ordinal_number' | 'ordinal_word' | 'keyword_mention' | 'demonstrative' | 'anafora';
}

/* ─── Constantes ─────────────────────────────────────────────────────────── */

/** Palabras ordinales en español → índice numérico (1-based) */
const ORDINAL_WORDS: Record<string, number> = {
    'primera': 1, 'primer': 1, 'primero': 1,
    'segunda': 2, 'segundo': 2, 'dos': 2,
    'tercera': 3, 'tercero': 3, 'tres': 3,
    'cuarta': 4, 'cuarto': 4, 'cuatro': 4,
    'quinta': 5, 'quinto': 5, 'cinco': 5,
};

/** Expresiones demostrativas que sugieren referencia a algo previo */
const DEMONSTRATIVE_PATTERNS = [
    /\b(esa|ese|eso|esta|este|esto)\s+(ruta?|opci[oó]n|destino|servicio|producto|alternativa)\b/i,
    /\b(la|el)\s+(misma?|mismo|anterior)\b/i,
    /\b(esa|ese)\b/i,
];

/** Patrones de extracción de listas con prefijos contextuales */
const CONTEXT_LABELS = [
    'ruta', 'rutas', 'opcion', 'opción', 'opciones', 'destino', 'destinos',
    'servicio', 'servicios', 'producto', 'productos', 'alternativa', 'alternativas'
];

/* ─── Extracción de entidades ─────────────────────────────────────────────── */

/**
 * Extrae entidades enumeradas de un texto (respuesta del agente).
 * Detecta listas numeradas, con letras o con bullet points.
 *
 * Ejemplos que reconoce:
 * "1. Monterrey - Veracruz"
 * "2. Monterrey - Hidalgo ($250)"
 * "a) Servicio Express"
 * "- Opción A: ruta norte"
 */
export function extractEntitiesFromText(text: string): EntityMemory {
    const ordinalMap: Record<string, string> = {};
    const keywordMap: Record<string, string> = {};
    const orderedList: string[] = [];

    if (!text || text.length < 5) {
        return { ordinalMap, keywordMap, orderedList, updatedAt: Date.now() };
    }

    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    for (const line of lines) {
        // Patrón: "1. texto", "2) texto", "a. texto", "a) texto"
        const numbered = line.match(/^(\d+)[).]\s+(.+)$/);
        const lettered = line.match(/^([a-e])[).]\s+(.+)$/i);
        // Patrón con guión/bullet: "- texto", "• texto"
        const bulleted = line.match(/^[-•*]\s+(.+)$/);

        let idx: number | null = null;
        let content: string | null = null;

        if (numbered) {
            idx = parseInt(numbered[1], 10);
            content = numbered[2].trim();
        } else if (lettered) {
            idx = lettered[1].toLowerCase().charCodeAt(0) - 96; // a=1, b=2...
            content = lettered[2].trim();
        } else if (bulleted) {
            // Bullets se indexan secuencialmente
            idx = orderedList.length + 1;
            content = bulleted[1].trim();
        }

        if (idx !== null && content) {
            // Limpiar contenido (quitar precios entre paréntesis para el mapa pero guardarlo completo)
            const cleanContent = content;
            ordinalMap[String(idx)] = cleanContent;
            orderedList.push(cleanContent);

            // Construir keyword map con palabras relevantes (>3 chars, no stopwords)
            const words = cleanContent.toLowerCase().split(/[\s\-–—,|:]+/)
                .filter(w => w.length > 3 && !['para', 'esta', 'este', 'desde', 'hasta', 'entre', 'como', 'tiene'].includes(w));
            for (const word of words) {
                keywordMap[word] = cleanContent;
            }
        }
    }

    return { ordinalMap, keywordMap, orderedList, updatedAt: Date.now() };
}

/**
 * Escanea una ventana de historial (últimos N mensajes del agente)
 * y extrae entidades enumeradas de cada uno, acumulando el resultado.
 *
 * @param historyMessages - Array de { text: string, origin: 'USER' | 'AI' }
 * @param windowSize - Cuántos mensajes del agente revisar (default: 4)
 */
export function extractEntitiesFromHistory(
    historyMessages: Array<{ text: string; origin: 'USER' | 'AI' }>,
    windowSize = 4
): EntityMemory {
    // Tomamos los últimos N mensajes del agente
    const agentMessages = historyMessages
        .filter(m => m.origin === 'AI')
        .slice(-windowSize);

    const accumulated: EntityMemory = {
        ordinalMap: {},
        keywordMap: {},
        orderedList: [],
        updatedAt: Date.now(),
    };

    for (const msg of agentMessages) {
        const partial = extractEntitiesFromText(msg.text);

        // Merge: los resultados más recientes sobreescriben los más viejos para ordinales
        Object.assign(accumulated.ordinalMap, partial.ordinalMap);
        Object.assign(accumulated.keywordMap, partial.keywordMap);

        // La lista ordenada toma la más reciente que tenga contenido
        if (partial.orderedList.length > 0) {
            accumulated.orderedList = partial.orderedList;
        }
    }

    return accumulated;
}

/* ─── Detección y resolución de referencias ──────────────────────────────── */

/**
 * Detecta si el mensaje del usuario contiene una referencia contextual
 * y la resuelve usando la memoria de entidades disponible.
 * Prioridad: Numérica > Texto Parcial > Anafórica
 */
export function resolveContextualReference(
    userMessage: string,
    memory: EntityMemory
): ContextResolution {
    if (!memory || (memory.orderedList?.length ?? 0) === 0) {
        return { detected: false };
    }

    // Invalidación de memoria si han pasado demasiados turnos (ej. 3)
    if ((memory.turnsSinceLastList || 0) > 3) {
        return { detected: false };
    }

    const lower = userMessage.toLowerCase().trim();

    // ── 1. PRIORIDAD: REFERENCIAS NUMÉRICAS ──
    const directRef = lower.match(/(?:ruta|opci[oó]n|destino|servicio|producto|alternativa|la|el|n[uú]mero|num\.?|no\.?)\s*(\d+)/i);
    if (directRef) {
        const num = directRef[1];
        const entity = memory.ordinalMap[num];
        if (entity) {
            return { detected: true, resolvedTo: entity, refType: 'ordinal_number' };
        }
    }

    // Ordinales textuales ("la segunda")
    for (const [word, idx] of Object.entries(ORDINAL_WORDS)) {
        const pattern = new RegExp(`\\b(la|el|una|un)?\\s*${word}\\b`, 'i');
        if (pattern.test(lower)) {
            const entity = memory.ordinalMap[String(idx)];
            if (entity) {
                return { detected: true, resolvedTo: entity, refType: 'ordinal_word' };
            }
        }
    }

    // ── 2. PRIORIDAD: TEXTO PARCIAL (KEYWORD) ──
    const keywordPhraseMatch = lower.match(/\bde\s+([\wáéíóúüñ]+)/i);
    if (keywordPhraseMatch) {
        const keyword = keywordPhraseMatch[1].toLowerCase();
        // Buscar en keywordMap
        const mapMatch = Object.entries(memory.keywordMap).find(([k]) => k.includes(keyword) || keyword.includes(k));
        if (mapMatch) {
            return { detected: true, resolvedTo: mapMatch[1], refType: 'keyword_mention' };
        }
    }

    // ── 3. PRIORIDAD: ANAFÓRICAS / DEMOSTRATIVOS ──
    const isAnafora = DEMONSTRATIVE_PATTERNS.some(p => p.test(lower));
    if (isAnafora) {
        // Si hay una referencia resuelta en el turno anterior, usarla primero (Continuidad)
        if (memory.lastResolvedReference) {
            return { detected: true, resolvedTo: memory.lastResolvedReference, refType: 'anafora' };
        }
        // Si no, usar la última de la lista
        const last = memory.orderedList[memory.orderedList.length - 1];
        if (last) {
            return { detected: true, resolvedTo: last, refType: 'anafora' };
        }
    }

    return { detected: false };
}

/* ─── Referencias implícitas (sin número, usando entidad activa) ──────────── */

/** Patrones de referencia implícita: preguntas de seguimiento sin referencia explícita */
const IMPLICIT_REFERENCE_PATTERNS = [
    /^(y\s+)?(qu[eé]\s+)?(costo|precio|vale|sale|cuesta|cobran|cobras)\s*(tiene|hay|es)?[?]?$/i,
    /^(y\s+)?(cu[aá]nto\s+)(cuesta|vale|sale|es|cobra)[?]?$/i,
    /^(y\s+)?(el\s+)?(precio|costo|tarifa|valor)[?]?$/i,
    /^(y\s+)?(cu[aá]nto\s+sale)[?]?$/i,
    /^(y\s+)?(m[aá]s\s+detalles|informaci[oó]n|info|datos)[?]?$/i,
    /^(y\s+)?(cu[aá]les\s+son\s+los?\s+)?(horarios?|salidas?|llegadas?)[?]?$/i,
    /^(y\s+)?(cu[aá]nto\s+tarda|duraci[oó]n)[?]?$/i,
    /^(d[eé]\s+la\s+\d+|de\s+esa|de\s+ese)[?]?$/i,
];

/**
 * Detecta si un mensaje es una referencia implícita de seguimiento
 * que requiere la entidad activa para resolverse.
 */
export function detectImplicitReference(userMessage: string): boolean {
    const lower = userMessage.toLowerCase().trim();
    return IMPLICIT_REFERENCE_PATTERNS.some(p => p.test(lower));
}

/**
 * Detecta el tipo de entidad predominante en las opciones listadas.
 */
export function inferEntityType(
    text: string
): 'route' | 'product' | 'service' | 'option' | 'other' {
    const lower = text.toLowerCase();
    if (/ruta|destino|origen|monterrey|v[ae]racruz|hidalgo|guadalajara|cdmx/i.test(lower)) return 'route';
    if (/producto|art[ií]culo|modelo|referencia/i.test(lower)) return 'product';
    if (/servicio|plan|paquete|membres[ií]a/i.test(lower)) return 'service';
    return 'option';
}

/**
 * Actualiza la entidad activa en la memoria contextual basándose
 * en la referencia resuelta en el último turno.
 */
export function updateActiveEntity(
    memory: EntityMemory,
    resolvedEntity: string | undefined,
    entityType?: EntityMemory['activeEntityType']
): EntityMemory {
    if (!resolvedEntity) return memory;
    return {
        ...memory,
        activeEntityValue: resolvedEntity,
        activeEntityType: entityType || inferEntityType(resolvedEntity),
        updatedAt: Date.now(),
    };
}

/* ─── Query building para KB ─────────────────────────────────────────────── */

/**
 * Construye el query óptimo para KB retrieval combinando:
 * - El mensaje limpio (sin ruido de saludo)
 * - La entidad contextual resuelta (si hay referencia explícita)
 * - La entidad activa (si hay referencia implícita)
 */
export function buildKbQuery(params: {
    cleanedMessage: string;
    contextResolution: ContextResolution;
    activeEntity?: string;
    isImplicit?: boolean;
}): string {
    const { cleanedMessage, contextResolution, activeEntity, isImplicit } = params;

    // Caso 1: Referencia explícita resuelta ("ruta 2" → "Monterrey - Hidalgo")
    if (contextResolution.detected && contextResolution.resolvedTo) {
        // En V3.1 Priorizamos los términos de la entidad al inicio
        const resolvedTerms = contextResolution.resolvedTo
            .split(/[\s\-–—,|:()]+/)
            .filter(w => w.length > 2)
            .join(' ');
        
        // Limpiar la query de números para evitar confusión con el scoring original
        const deNumberedMessage = cleanedMessage.replace(/\b\d+\b/g, '').replace(/\s+/g, ' ').trim();
        return `${resolvedTerms} ${deNumberedMessage}`.trim();
    }

    // Caso 2: Referencia implícita ("qué costo tiene") → usar entidad activa
    if (isImplicit && activeEntity) {
        const entityTerms = activeEntity
            .split(/[\s\-–—,|:()]+/)
            .filter(w => w.length > 2)
            .join(' ');
        
        const coreMessage = cleanedMessage.replace(/\b(que|cual|como|cuanto|tiene|hay|es|de|la|el)\b/g, '').replace(/\s+/g, ' ').trim();
        return `${entityTerms} ${coreMessage}`.trim();
    }

    return cleanedMessage;
}
