export interface FlowSlot {
    id: string;
    description: string;                  // Para ayudar al LLM extractor a entender qué buscar
    type: 'string' | 'number' | 'date' | 'boolean';
    required: boolean;
    promptText: string;                   // Lo que el agente debe preguntar si falta este slot
}

export interface FlowDefinition {
    id: string;
    name: string;
    description: string;
    triggerIntents: string[];             // Intents que pueden iniciar este flujo (opcional)
    triggerRegex?: RegExp[];              // Patrones crudos (opcional)
    slots: FlowSlot[];                    // Datos a recopilar, en orden de prioridad
    completionMessage?: string;           // Opcional: Instrucción extra al terminar
}

// ============================================================================
// REGISTRY QUEMADO (Para MVP)
// En el futuro, esto vendrá de la Base de Datos.
// ============================================================================

export const FLOW_REGISTRY: Record<string, FlowDefinition> = {
    'reservar_viaje': {
        id: 'reservar_viaje',
        name: 'Reserva de Viaje',
        description: 'Ayuda al cliente a cotizar y apartar un viaje.',
        triggerIntents: ['LEAD_CREATION', 'BUSINESS_INFO_QUERY'],
        triggerRegex: [/(reservar|comprar|necesito|quiero).*(viaje|boleto|pasaje|ruta)/i],
        slots: [
            {
                id: 'origen',
                description: 'La ciudad o lugar desde donde el cliente quiere salir.',
                type: 'string',
                required: true,
                promptText: '¿Desde qué ciudad te gustaría salir?'
            },
            {
                id: 'destino',
                description: 'La ciudad o lugar adonde el cliente quiere ir.',
                type: 'string',
                required: true,
                promptText: '¿Hacia dónde te gustaría viajar?'
            },
            {
                id: 'fecha',
                description: 'La fecha exacta o aproximada en la que el cliente quiere viajar (ej. "mañana", "el 15 de octubre").',
                type: 'string',
                required: true,
                promptText: '¿Para qué fecha te gustaría tu viaje?'
            },
            {
                id: 'pasajeros',
                description: 'El número de personas que van a viajar.',
                type: 'number',
                required: true,
                promptText: '¿Cuántas personas van a viajar?'
            },
            {
                id: 'nombre_completo',
                description: 'El nombre de la persona a nombre de quien quedará la reserva.',
                type: 'string',
                required: true,
                promptText: 'Por último, ¿cuál es tu nombre completo para dejar el registro?'
            }
        ],
        completionMessage: 'Confirma todos los datos con el cliente y menciónale que un asesor se contactará para el pago.'
    },

    'envio_paquete': {
        id: 'envio_paquete',
        name: 'Envío de Paquetería',
        description: 'Ayuda al cliente a cotizar o registrar un envío.',
        triggerIntents: ['LEAD_CREATION', 'BUSINESS_INFO_QUERY'],
        triggerRegex: [/(enviar|cotizar|mandar).*(paquete|caja|sobre|envío|envio)/i],
        slots: [
            {
                id: 'origen',
                description: 'La ciudad o código postal desde donde se enviará el paquete.',
                type: 'string',
                required: true,
                promptText: '¿Desde dónde vas a realizar tu envío?'
            },
            {
                id: 'destino',
                description: 'La ciudad o código postal hacia donde se enviará el paquete.',
                type: 'string',
                required: true,
                promptText: '¿A qué ciudad o código postal se dirige el paquete?'
            },
            {
                id: 'tipo_paquete',
                description: 'Qué tipo de paquete es (ej. sobre, caja, dimensiones, documentos, ropa).',
                type: 'string',
                required: true,
                promptText: '¿Qué tipo de paquete vas a enviar (ej. sobre, caja, ropa) y cuáles son sus dimensiones aprox.?'
            },
            {
                id: 'peso',
                description: 'El peso aproximado del paquete en kilos o gramos.',
                type: 'string',
                required: true,
                promptText: '¿Qué peso aproximado tiene el paquete?'
            }
        ],
        completionMessage: 'Confirma los datos del envío con el cliente y menciona que le daremos una cotización en breve.'
    }
};

export function getAvailableFlows(): FlowDefinition[] {
    return Object.values(FLOW_REGISTRY);
}

export function getFlow(id: string): FlowDefinition | undefined {
    return FLOW_REGISTRY[id];
}
