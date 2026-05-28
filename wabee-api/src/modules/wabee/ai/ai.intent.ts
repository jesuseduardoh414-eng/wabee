export type AiIntent =
    | 'SMALLTALK_GREETING'     // Hola, buenos días
    | 'SMALLTALK_THANKS'       // Gracias, muy amable
    | 'SMALLTALK_ACK'          // OK, enterado, vale
    | 'CHATTER'                // LOL, XD, 👍
    | 'GENERAL_QUESTION'       // Conocimiento general no dependiente de la empresa
    | 'COMPLAINT'              // Quejas, inconformidad
    | 'BUSINESS_INFO_QUERY'    // Info de la empresa (requiere prompt/KB)
    | 'PRODUCT_SEARCH'         // Búsqueda en catálogo/productos (requiere Tools)
    | 'OPERATIONAL_ACTION'     // Consultas de datos vivos / acciones (requiere Tools)
    | 'IDENTITY_QUERY'         // Quién eres?
    | 'LEAD_CREATION'          // Intención de compra/contratación
    | 'HUMAN_ESCALATION';      // Quiero hablar con alguien

/**
 * Detecta la intención de un mensaje de usuario con mayor precisión.
 */
export function detectIntent(text: string): AiIntent {
    const lower = text.toLowerCase().trim();

    // 1. Human Escalation (Prioridad Máxima)
    const escalationKeywords = [
        'asesor', 'humano', 'alguien que me atienda', 'agente',
        'atencion personalizada', 'atención personalizada', 'hablar con',
        'atención humana',
    ];
    if (escalationKeywords.some(key => lower.includes(key))) {
        return 'HUMAN_ESCALATION';
    }

    // 2. Complaint / Quejas
    const complaintSignals = [
        'no me atendieron', 'mal servicio', 'pedido no llegó', 'pedido no llego',
        'estoy molesto', 'estoy enojado', 'pésimo', 'pesimo', 'queja', 'reclamo',
        'falló', 'falla', 'no sirve', 'fraude'
    ];
    if (complaintSignals.some(signal => lower.includes(signal))) {
        return 'COMPLAINT';
    }

    // 3. Product Search (Búsqueda específica de catálogo) - PRIORIDAD MEDIA-ALTA
    const productSignals = [
        'busca un producto', 'busca el producto', 'qué productos tienen', 'qué productos tienes',
        'busca un', 'busca el', 'muéstrame un', 'muestrame un', 'muéstrame el', 'muestrame el',
        'catálogo', 'catalogo', 'stock', 'disponibilidad de', 'tienen el', 'tienes el',
        'productos disponibles', 'qué productos', 'que productos', 'qué artículos', 'que articulos',
        'muéstrame los', 'muestrame los', 'quiero ver los', 'qué tienes', 'que tienes',
        'listado de productos', 'lista de productos', 'buscame', 'búscame'
    ];
    // Señales de alta confianza para productos
    const directProductKeywords = ['productos', 'artículos', 'articulos', 'catálogo', 'catalogo'];

    if (productSignals.some(signal => lower.includes(signal)) || 
        (lower.startsWith('busca') && lower.length > 6) ||
        (directProductKeywords.some(kw => lower.includes(kw)) && (lower.includes('disponible') || lower.includes('tienes') || lower.includes('hay') || lower.includes('ver') || lower.includes('manejan')))) {
        return 'PRODUCT_SEARCH';
    }

    // 4. Operational Action (Requiere Tools específicas de cuenta/pedido)
    const operationalSignals = [
        'busca mi', 'consulta mi', 'estatus de mi', 'seguimiento', 'saldo',
        'crea una', 'registra'
    ];
    if (operationalSignals.some(signal => lower.includes(signal))) {
        return 'OPERATIONAL_ACTION';
    }

    // 5. Lead Creation (Intención comercial explícita o confirmada)
    const transactionSignals = ['apartar', 'reservar', 'comprar', 'contratar', 'cotizar ahora', 'regístrame', 'haz mi registro'];
    const interestSignals = ['me interesa', 'quiero'];
    
    // Si dice "me interesa" o "quiero" + una acción transaccional -> LEAD_CREATION
    if (interestSignals.some(s => lower.includes(s)) && transactionSignals.some(ts => lower.includes(ts))) {
        return 'LEAD_CREATION';
    }

    // 6. Business Info (Incluye "quiero informes" y "me interesa saber")
    const businessSignals = [
        'informes', 'información', 'info', 'qué hacen', 'que hacen',
        'horarios', 'horario', 'donde estan', 'dónde están', 'ubicación',
        'qué incluyen', 'que incluyen', 'qué paquetes', 'que paquetes',
        'planes', 'me interesa saber', 'me interesa conocer', 'me interesa info',
        'me interesa información'
    ];
    if (businessSignals.some(signal => lower.includes(signal)) || lower.includes('quiero informes')) {
        return 'BUSINESS_INFO_QUERY';
    }

    // 7. Identity Query
    if (/(quién eres|quien eres|tu nombre|tu identidad|eres un bot)/i.test(lower)) {
        return 'IDENTITY_QUERY';
    }

    // 8. Smalltalk: GREETING
    if (/^(hola|buenos días|buenos dias|buenas tardes|buenas noches|buenas|que tal|qué tal|hi|hello|hey|quien anda ahi|quien anda ahí|hola buenos días|hola que tal|hola qué tal)[\s!.?]*$/i.test(lower)) {
        return 'SMALLTALK_GREETING';
    }

    // 9. Smalltalk: THANKS
    if (/^(gracias|muchas gracias|mil gracias|thx|ty|thanks|te lo agradezco|muy amable|perfecto gracias)[\s!.?]*$/i.test(lower)) {
        return 'SMALLTALK_THANKS';
    }

    // 10. Smalltalk: ACK / Farewell
    if (/^(ok|vale|enterado|vientos|va|hecho|entendido|así es|asi es|excelente|entendido gracias)[\s!.?]*$/i.test(lower)) {
        return 'SMALLTALK_ACK';
    }
    if (/^(adios|adiós|bye|nos vemos|chau|hasta luego|me retiro)[\s!.?]*$/i.test(lower)) {
        return 'SMALLTALK_ACK'; // Despedida como confirmación de cierre
    }

    // 11. Chatter
    if (/^(jaja|jeje|lol|xd|👍|👌)[\s]*$/i.test(lower)) {
        return 'CHATTER';
    }

    // 12. General Question
    if (lower.startsWith('qué es') || lower.startsWith('que es') || lower.startsWith('cómo funciona')) {
        return 'GENERAL_QUESTION';
    }

    return 'BUSINESS_INFO_QUERY'; // Default
}

