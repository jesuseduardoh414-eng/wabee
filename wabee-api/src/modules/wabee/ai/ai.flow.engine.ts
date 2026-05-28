import { getAvailableFlows, getFlow, FlowDefinition, FlowSlot } from './ai.flow.registry';
import { aiFlowExtractor } from './ai.flow.extractor';

export interface FlowState {
    mode: 'FLOW';
    activeFlowId: string;
    collectedData: Record<string, any>;
    lastAskedSlot?: string;
}

export interface TurnEvaluation {
    inFlow: boolean;
    flowState?: FlowState;
    missingSlotTarget?: FlowSlot;
    extractedSlots?: Record<string, any>;
    lastAskedSlot?: string;
    completed?: boolean;
    tried?: boolean;
    skippedReason?: string;
    extractorSucceeded?: boolean;
    extractorError?: string;
}

export class AiFlowEngine {

    /**
     * Evalúa el turno actual, decide si inicia un flujo, si extrae datos para un flujo activo,
     * y genera el próximo paso de la máquina de estados.
     */
    async evaluateTurn(
        userMessage: string,
        intent: string,
        currentState?: any
    ): Promise<TurnEvaluation> { // Updated return type
        
        let flowState: FlowState | null = null;
        let extractedSlots: Record<string, any> = {}; // To store extracted data for this turn

        // 1. Check if we are ALREADY in a flow
        if (currentState?.mode === 'FLOW' && currentState?.activeFlowId) {
            flowState = currentState as FlowState;
        }

        // 1.1 Guardrail Duro: No activar flows para Smalltalk/Chatter
        const isSmalltalk = intent.startsWith('SMALLTALK_') || intent === 'CHATTER' || intent === 'GENERAL_QUESTION';
        if (isSmalltalk && !flowState) {
            return { 
                inFlow: false, 
                tried: true, 
                skippedReason: 'guardrail_smalltalk_active' 
            };
        }

        // 2. If NO flow is active, check if we should start one
        if (!flowState) {
            const possibleFlow = this.findMatchingFlow(userMessage, intent);
            if (possibleFlow) {
                // Validación adicional de evidencia fuerte si es BUSINESS_INFO_QUERY
                const hasStrongEvidence = this.checkStrongEvidence(userMessage, possibleFlow);
                
                if (intent === 'LEAD_CREATION' || hasStrongEvidence) {
                    console.log(`[FlowEngine] 🔄 Iniciando flujo: ${possibleFlow.id}`);
                    flowState = {
                        mode: 'FLOW',
                        activeFlowId: possibleFlow.id,
                        collectedData: {}
                    };
                } else {
                    return { 
                        inFlow: false, 
                        tried: true, 
                        skippedReason: 'insufficient_evidence_for_activation' 
                    };
                }
            }
        }

        // 3. If STILL no flow, return early
        if (!flowState) {
            return { inFlow: false, tried: false };
        }

        const flowDef = getFlow(flowState.activeFlowId);
        if (!flowDef) {
            console.warn(`[FlowEngine] Flujo '${flowState.activeFlowId}' no encontrado. Abortando flujo.`);
            return { inFlow: false };
        }

        // 4. If we are in a flow, try to extract pending data from the user message
        const pendingSlots = this.getPendingSlots(flowDef, flowState.collectedData);
        let extractionSucceeded = true;
        let extractorError: string | undefined;

        if (pendingSlots.length > 0) {
            try {
                const extracted = await aiFlowExtractor.extract(userMessage, pendingSlots);
                
                // Merge extracted data into state and track what was extracted in this turn
                let newDataFound = false;
                for (const [key, value] of Object.entries(extracted)) {
                    if (value !== null && value !== undefined && value !== '') {
                        flowState.collectedData[key] = value;
                        extractedSlots[key] = value; 
                        newDataFound = true;
                    }
                }
                if (newDataFound) {
                    console.log(`[FlowEngine] 💾 Datos actualizados:`, flowState.collectedData);
                }
            } catch (err: any) {
                console.error(`[FlowEngine] Extractor error: ${err.message}`);
                extractionSucceeded = false;
                extractorError = err.message;
            }
        }

        // 5. Determine the NEXT slot to ask
        const updatedPendingSlots = this.getPendingSlots(flowDef, flowState.collectedData);

        if (updatedPendingSlots.length === 0) {
            console.log(`[FlowEngine] ✅ Flujo completado: ${flowDef.id}`);
            return {
                inFlow: true,
                flowState,
                completed: true,
                extractedSlots: Object.keys(extractedSlots).length > 0 ? extractedSlots : undefined,
                lastAskedSlot: flowState.lastAskedSlot // Include last asked slot
            };
        }

        // Grab the highest priority missing slot (first one in array)
        const nextTarget = updatedPendingSlots[0];
        flowState.lastAskedSlot = nextTarget.id;

        console.log(`[FlowEngine] 🎯 Siguiente Target Slot: ${nextTarget.id}`);

        return {
            inFlow: true,
            flowState,
            missingSlotTarget: nextTarget,
            extractedSlots: Object.keys(extractedSlots).length > 0 ? extractedSlots : undefined,
            extractorSucceeded: extractionSucceeded,
            extractorError: extractorError
        };
    }

    private checkStrongEvidence(message: string, flow: FlowDefinition): boolean {
        const lower = message.toLowerCase();
        
        // Palabras de acción fuerte (Transaccionales)
        const transactionalKeywords = [
            'quiero', 'necesito', 'voy a', 'reservar', 'apartar', 'comprar', 
            'enviar', 'mandar', 'cotizar', 'presupuesto', 'viajar', 'boleto', 
            'pasaje', 'paquete', 'envío', 'envio'
        ];

        // Si el mensaje es muy corto (ej: "hola"), no hay evidencia
        if (lower.length < 10) return false;

        return transactionalKeywords.some(kw => lower.includes(kw));
    }

    /**
     * Construye un bloque estricto de texto que se inyectará en el System Prompt
     * ordenando al LLM que pregunte específicamente por el slot faltante.
     */
    buildSystemInstruction(evaluation: TurnEvaluation): string {
        if (!evaluation.inFlow || !evaluation.flowState) return '';
        
        const flowDef = getFlow(evaluation.flowState.activeFlowId);
        if (!flowDef) return '';

        let instruction = `\n\n[FLOW CONTROL: ALTA PRIORIDAD]\nActualmente estás gestionando un flujo de: "${flowDef.name}".\n`;
        
        // Show collected data so the LLM has context
        const collectedKeys = Object.keys(evaluation.flowState.collectedData);
        if (collectedKeys.length > 0) {
            instruction += `Datos que ya recolectaste y NO debes volver a pedir:\n`;
            for (const [k, v] of Object.entries(evaluation.flowState.collectedData)) {
                instruction += `- ${k}: ${v}\n`;
            }
        }

        if (evaluation.completed) {
            instruction += `\nESTADO: Todos los datos necesarios han sido recopilados con éxito.\nTU TAREA: ${flowDef.completionMessage || 'Confirma amablemente que el registro está completo y la operación ha sido procesada.'}`;
            return instruction;
        }

        if (evaluation.missingSlotTarget) {
            instruction += `\nESTADO: Falta información.\n`;
            instruction += `TU ÚNICA TAREA EN ESTE TURNO ES PREGUNTAR AL USUARIO POR ESTE DATO FALTANTE:\n`;
            instruction += `-> Dato: ${evaluation.missingSlotTarget.id} (${evaluation.missingSlotTarget.description})\n`;
            instruction += `-> Instrucción sugerida: "${evaluation.missingSlotTarget.promptText}"\n`;
            instruction += `\nREGLA: NUNCA hagas múltiples preguntas a la vez. No menciones otros campos. Pregunta SOLO de maneral natural por el dato faltante y espera la respuesta. No adelantes pasos.`;
            return instruction;
        }

        return '';
    }

    private findMatchingFlow(messageText: string, intent: string): FlowDefinition | null {
        const flows = getAvailableFlows();
        
        for (const flow of flows) {
            // Match por intent
            if (flow.triggerIntents.includes(intent)) {
                return flow;
            }
            // Match por regex secundario
            if (flow.triggerRegex) {
                for (const regex of flow.triggerRegex) {
                    if (regex.test(messageText)) {
                        return flow;
                    }
                }
            }
        }
        return null;
    }

    private getPendingSlots(flowDef: FlowDefinition, collectedData: Record<string, any>): FlowSlot[] {
        return flowDef.slots.filter(s => {
            const val = collectedData[s.id];
            return val === undefined || val === null || val === '';
        });
    }

}

export const aiFlowEngine = new AiFlowEngine();
