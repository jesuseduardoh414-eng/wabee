

/**
 * Grupos de sinónimos para expansión semántica controlada.
 * Ayuda a que el retrieval de KB funcione con términos equivalentes.
 */
const SYNONYM_GROUPS: Record<string, string[]> = {
    'ruta': ['lugares', 'destinos', 'trayectos', 'salidas', 'viajes', 'ciudades'],
    'precio': ['costo', 'tarifa', 'valor', 'cuanto cuesta', 'cuanto sale', 'cotizacion'],
    'horario': ['hora', 'tiempo', 'salida', 'llegada', 'duracion'],
};

/**
 * Expande un texto con sinónimos controlados para mejorar el retrieval.
 * Retorna el texto original + tokens expandidos únicos.
 */
export function expandSynonyms(text: string): string {
    const lower = text.toLowerCase();
    const tokens = new Set<string>();
    
    // Añadir tokens originales (filtrando ruido)
    lower.split(/\s+/).forEach(t => {
        if (t.length > 2) tokens.add(t);
    });

    // Buscar coincidencias en grupos de sinónimos
    for (const [canonical, variants] of Object.entries(SYNONYM_GROUPS)) {
        const match = variants.some(v => lower.includes(v));
        if (match || lower.includes(canonical)) {
            tokens.add(canonical);
            variants.forEach(v => {
                if (v.split(' ').length === 1) tokens.add(v); // Solo expandir unigramas para evitar ruido
            });
        }
    }

    return Array.from(tokens).join(' ');
}

/**
 * Utilidad de normalización de texto para mejorar el matching de intenciones y tools.
 */
export function normalizeText(text: string): string {
    if (!text) return '';

    return text
        .toLowerCase()
        .trim()
        // 1. Remover acentos/diacríticos
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        // 2. Remover puntuación irrelevante (excepto espacios)
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()\?¿¡!]/g, '')
        // 3. Normalizar espacios
        .replace(/\s+/g, ' ')
        // 4. Mapeos semánticos básicos (Sinónimos de acción)
        .replace(/\b(vendes|venden|vende|tienes|tienen|tiene|hay|muestrame|enseñame|buscame|buscame|consulta|quiero ver|necesito|manejan|maneja)\b/g, 'get')
        // 5. Normalización simple de plurales (Heurística básica: remover 's' al final de palabras largas)
        .split(' ')
        .map(word => {
            if (word.length > 3 && word.endsWith('s')) {
                // Evitar romper palabras comunes que terminan en s pero no son plurales obvios
                const exceptions = ['busqueda', 'status', 'gracias'];
                if (!exceptions.includes(word)) {
                    return word.slice(0, -1);
                }
            }
            return word;
        })
        .join(' ');
}

/**
 * Verifica si un texto normalizado contiene un trigger normalizado.
 */
export function matchesTrigger(normalizedText: string, normalizedTrigger: string): boolean {
    const textParts = normalizedText.split(' ');
    const triggerParts = normalizedTrigger.split(' ');
    
    // Versión simple: El trigger está contenido en el texto o viceversa
    if (normalizedText.includes(normalizedTrigger) || normalizedTrigger.includes(normalizedText)) {
        return true;
    }

    // Versión por intersección: Si todas las palabras del trigger están en el texto
    return triggerParts.every(tp => textParts.includes(tp));
}

/**
 * Limpia un query crudo del usuario para ser usado específicamente en KB retrieval.
 * Elimina saludos, cortesías y ruidos que diluyen el score de keywords.
 */
export function cleanQueryForKb(text: string): string {
    if (!text) return '';

    // 1. Normalización básica
    let cleaned = text.toLowerCase().trim();

    // 2. Eliminar puntuación inicial/final común
    cleaned = cleaned.replace(/^[¿¡!?. ]+|[¿¡!?. ]+$/g, '');

    // 3. Eliminar saludos y cortesías comunes (Regex con fronteras de palabra)
    const noisePatterns = [
        /\b(hola|buenos dias|buenas tardes|buenas noches|buenas|que tal|como estas|hi|hello|hey|oiga|disculpe|disculpa)\b/g,
        /\b(por favor|gracias|muchas gracias|mil gracias|amable|podria|podrias|puedes|pueden|quisiera|necesito|me gustaria|quisiera saber|informacion sobre)\b/g,
        /\b(tienes|tienen|manejan|maneja|vende|vendes|venden|hay|cuenta con|cuentan con|muestrame|enseñame|dime|buscame)\b/g
    ];

    noisePatterns.forEach(pattern => {
        cleaned = cleaned.replace(pattern, '');
    });

    // 4. Limpieza final de espacios
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    // 5. Expansión semántica controlada (V3.1)
    // No reemplazamos el original, generamos una versión enriquecida
    const expanded = expandSynonyms(cleaned);

    // Fallback: Si la limpieza dejó el texto vacío, devolvemos el original normalizado brevemente
    if (cleaned.length < 2) {
        return text.toLowerCase().trim().substring(0, 50);
    }

    // Retornamos combinando original limpio + términos expandidos únicos
    return expanded;
}
