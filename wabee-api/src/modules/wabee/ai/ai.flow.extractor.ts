import { chatLLM } from './llm.client';
import { FlowSlot } from './ai.flow.registry';

export interface ExtractedSlots {
    [key: string]: any;
}

export class AiFlowExtractor {
    
    /**
     * Hace una llamada ligera al LLM para extraer las entidades de la respuesta del usuario
     * basándose en la lista de slots pendientes.
     * @param userMessage El mensaje que acaba de enviar el usuario.
     * @param pendingSlots Los slots que el flujo aún no ha recolectado.
     * @returns Un objeto clave-valor con los slots que fueron detectados confiablemente.
     */
    async extract(userMessage: string, pendingSlots: FlowSlot[]): Promise<ExtractedSlots> {
        if (!pendingSlots || pendingSlots.length === 0) return {};

        const properties: any = {};
        const requiredFields: string[] = [];

        for (const slot of pendingSlots) {
            properties[slot.id] = {
                type: slot.type === 'number' ? 'NUMBER' : slot.type === 'boolean' ? 'BOOLEAN' : 'STRING',
                description: slot.description
            };
            // No los marcamos como 'required' en la validación JSON para que el LLM pueda 
            // omitirlos libremente si el usuario no los mencionó.
        }

        const schema = {
            type: 'OBJECT',
            properties
        };

        const systemPrompt = `
Eres un extractor de datos de alta precisión. Tu tarea es analizar el mensaje del usuario y extraer ÚNICAMENTE la información explícita indicada en el JSON Schema.
Reglas:
1. Extrae los datos que el usuario haya dado. 
2. Si un dato no se menciona claramente o no puedes inferirlo con altísima confianza, OMÍTELO (no lo incluyas en el JSON resultante, déjalo fuera).
3. No inventes información.
4. Responde EXCLUSIVAMENTE con un JSON válido que coincida con el schema dictado. NO agregues comillas invertidas ni bloques de código, solo el objeto JSON puro { ... }.
        `.trim();

        try {
            const start = Date.now();
            const { text } = await chatLLM({
                system: systemPrompt,
                messages: [{ role: 'user', content: userMessage }],
                temperature: 0.0, // Cero alucinación
                maxTokens: 300,
                // Le inyectamos el schema aquí forzando JSON (gemini 1.5 flash lo soporta nativo)
                responseMimeType: 'application/json',
                responseSchema: schema as any
            });

            const duration = Date.now() - start;
            
            // Parceamos asumiendo que el SDK ya lo da bastante limpio por el mimeType
            const rawJson = text?.trim() || '{}';
            const parsed = JSON.parse(rawJson);
            
            console.log(`[AiFlowExtractor] 🎯 Extraídos (${duration}ms):`, Object.keys(parsed));
            return parsed;

        } catch (error: any) {
            console.error(`[AiFlowExtractor] ❌ Falló la extracción LLM: ${error.message}`);
            return {};
        }
    }
}

export const aiFlowExtractor = new AiFlowExtractor();
