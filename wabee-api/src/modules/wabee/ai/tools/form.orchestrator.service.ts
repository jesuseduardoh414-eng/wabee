import { prisma } from '../../../../config/core/core.prisma';
import { ConversationMode, FormStatus } from '@prisma/client';
import { chatLLM } from '../llm.client';
import { toolExecutorService } from './tool.executor.service';
import { toolRegistryService } from './tool.registry.service';

export interface FormContext {
    tenantId: string;
    threadId: string;
    userIdentificator: string;
    message: string;
    profileId: string;
}

export class AiFormOrchestratorService {
    /**
     * Procesa un mensaje cuando la conversación está en modo FORM_FILLING o debe entrar en él.
     */
    async processForm(context: FormContext, state: any) {
        console.log(`[FormOrchestrator] Processing thread=${context.threadId} mode=${state.mode}`);

        const activeIntent = state.activeFormIntent || 'createLead';
        let collectedData = (state.collectedData as any) || {};

        // 1. Inicializar si es nuevo
        if (state.mode !== ConversationMode.FORM_FILLING) {
            console.log(`[FormOrchestrator] Initializing FORM_FILLING for ${activeIntent}`);
            collectedData = {
                phone: context.userIdentificator,
                need: state.activeFormIntent === 'createLead' ? collectedData.need : undefined
            };

            state = await prisma.conversationState.update({
                where: { id: state.id },
                data: {
                    mode: ConversationMode.FORM_FILLING,
                    activeFormIntent: activeIntent,
                    formStatus: FormStatus.PENDING,
                    collectedData
                }
            });
        }

        // 2. Intentar extraer información del mensaje actual
        const extracted = await this.extractData(context.message, collectedData);

        if (extracted && Object.keys(extracted).length > 0) {
            collectedData = { ...collectedData, ...extracted };
            // Limpiar reintentos si hubo éxito en algún campo
            if (collectedData._retries) {
                Object.keys(extracted).forEach(key => {
                    delete collectedData._retries[key];
                });
            }

            await prisma.conversationState.update({
                where: { id: state.id },
                data: { collectedData }
            });
            console.log(`[FormOrchestrator] Extracted:`, extracted);
        } else {
            // Lógica de reintentos: El mensaje fue irrelevante para los campos
            const missingField = this.getMissingField(collectedData);
            if (missingField) {
                if (!collectedData._retries) collectedData._retries = {};
                collectedData._retries[missingField] = (collectedData._retries[missingField] || 0) + 1;

                await prisma.conversationState.update({
                    where: { id: state.id },
                    data: { collectedData }
                });

                console.log(`[FormOrchestrator] No relevant info extracted. Retry count for ${missingField}: ${collectedData._retries[missingField]}`);
            }
        }

        // 3. Verificar si el formulario está completo
        const missingFieldAfterCapture = this.getMissingField(collectedData);

        if (!missingFieldAfterCapture) {
            // ¡COMPLETO! Ejecutar herramienta
            console.log(`[FormOrchestrator] Form COMPLETE. Executing tool...`);
            return await this.finalizeForm(context, state, collectedData);
        }

        // 4. Pedir el siguiente dato (con varianza según reintentos)
        const retryCount = collectedData._retries?.[missingFieldAfterCapture] || 0;
        const question = await this.generateQuestion(missingFieldAfterCapture, retryCount);
        return {
            replyText: question,
            state: state,
            collectedData
        };
    }

    private async extractData(message: string, current: any) {
        const prompt = `
            Eres un extractor de datos JSON. Tu objetivo es identificar información personal en el mensaje del usuario para un formulario de contacto.
            
            CAMPOS DISPONIBLES:
            - name: Nombre de la persona.
            - need: Lo que el usuario necesita o su interés (ej: cotización, precios, informes).
            
            DATOS YA CONOCIDOS: ${JSON.stringify(current)}
            
            MENSAJE DEL USUARIO: "${message}"
            
            INSTRUCCIONES:
            - Solo extrae datos que NO estén ya en "DATOS YA CONOCIDOS" o que el usuario esté corrigiendo.
            - Si no hay información relevante para estos campos, devuelve {}.
            - Devuelve ÚNICAMENTE un objeto JSON válido.
        `;

        try {
            const response = await chatLLM({
                system: 'Eres un sistema de extracción de datos especializado en JSON.',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0
            });

            // Limpiar Markdown si el LLM lo incluye
            const jsonStr = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(jsonStr);
        } catch (e) {
            console.error('[FormOrchestrator] Extraction error:', e);
            return null;
        }
    }

    private getMissingField(data: any): string | null {
        if (!data.name) return 'name';
        if (!data.need) return 'need';
        return null;
    }

    private async generateQuestion(field: string, retryCount: number = 0): Promise<string> {
        const mapping: any = {
            name: {
                0: '¿Podrías decirme tu nombre completo para registrarte?',
                1: 'Disculpa, no logré captar tu nombre. ¿Cómo te llamas?',
                default: 'Necesito tu nombre para continuar con el registro. ¿Podrías indicármelo?'
            },
            need: {
                0: '¿En qué podemos ayudarte específicamente? (Ej: cotización de licencias, informes generales, soporte técnico)',
                1: 'Aún no me queda claro qué información necesitas. ¿Podrías detallar tu solicitud?',
                default: 'Por favor, dime qué tipo de informes o servicios te interesan para poder ayudarte mejor.'
            }
        };

        const fieldMap = mapping[field];
        if (!fieldMap) return '¿Podrías darme más detalles?';

        return fieldMap[retryCount] || fieldMap.default;
    }

    private async finalizeForm(context: FormContext, state: any, data: any) {
        try {
            // 1. Buscar la tool en el registro
            const tools = await toolRegistryService.getProfileTools(context.profileId);
            const toolToExecute = tools.find((t: any) => t.name === 'createLead');

            if (!toolToExecute) {
                throw new Error('Tool createLead not found for this profile');
            }

            // 2. Ejecutar Tool
            const execution = await toolExecutorService.execute({
                tenantId: context.tenantId,
                toolId: (toolToExecute as any).dbId, // Necesitamos el ID de base de datos
                threadId: context.threadId,
                payload: data
            });

            // 3. Responder al usuario
            const finalResponse = await chatLLM({
                system: 'Eres un asistente cordial. El usuario terminó de llenar sus datos y ya creamos su registro de interés (lead).',
                messages: [{ role: 'user', content: `El registro de lead fue exitoso. Confirma al usuario de forma natural. Datos: ${JSON.stringify(data)}` }]
            });

            // 4. Limpiar estado
            await prisma.conversationState.update({
                where: { id: state.id },
                data: {
                    mode: ConversationMode.AI_MANAGED,
                    activeFormIntent: null,
                    formStatus: FormStatus.COMPLETED,
                    collectedData: undefined
                }
            });

            return {
                replyText: finalResponse.text,
                mode: ConversationMode.AI_MANAGED,
                executionId: execution.id
            };
        } catch (error: any) {
            console.error('[FormOrchestrator] Finalization error:', error);

            // 1. Marcar como FAILED en el estado
            await prisma.conversationState.update({
                where: { id: state.id },
                data: {
                    mode: ConversationMode.HUMAN_HANDOFF,
                    formStatus: FormStatus.FAILED,
                    handoffReason: 'tool_execution_failed'
                }
            });

            // 2. Fallback a handoff si falla la escritura crítica
            return {
                replyText: 'Lo siento, hubo un problema técnico al procesar tu registro. He transferido esta conversación a un asesor humano para que te ayude personalmente de inmediato.',
                mode: ConversationMode.HUMAN_HANDOFF
            };
        }
    }
}

export const aiFormOrchestratorService = new AiFormOrchestratorService();
