import { prisma } from '@/lib/prisma';
import { Prisma, AutomationTrigger } from '@prisma/client';
import { automationEngine } from './automation.engine';
import { automationsService } from './automations.service';
import { AutomationState, FlowDefinition } from './automation.types';

export interface AutomationRunResult {
    handled: boolean;        // true = una automatización manejó el mensaje → saltar IA
    outboundText?: string;   // texto a enviar al usuario (si lo hay)
    assign?: string;         // userId a asignar (nodo assign) — aún no aplicado
    completed: boolean;      // el flujo llegó a un nodo end
}

/**
 * Orquesta la ejecución de automatizaciones para un mensaje entrante.
 * Llamar ANTES de la IA: si devuelve handled=true, se debe saltar la IA.
 *
 * Soporta:
 *  - Continuar un flujo en curso (automationState RUNNING/WAITING_ANSWER).
 *  - Iniciar un flujo nuevo por trigger:
 *      · CONVERSATION_STARTED → solo en conversación nueva.
 *      · INBOUND_MESSAGE      → en cualquier mensaje entrante.
 *  (KEYWORD_MATCH y otros triggers aún no tienen configuración en el modelo.)
 */
export class AutomationRunnerService {
    static async run(params: {
        tenantId: string;
        threadId: string;
        messageText: string;
        isNewConversation: boolean;
    }): Promise<AutomationRunResult> {
        const { tenantId, threadId, messageText, isNewConversation } = params;

        const thread = await prisma.whatsappThread.findFirst({
            where: { id: threadId, tenantId },
            select: { automationState: true },
        });
        const state = (thread?.automationState as AutomationState | null) ?? null;

        // 1. Continuar un flujo en curso ─────────────────────────────────────
        if (state && (state.status === 'RUNNING' || state.status === 'WAITING_ANSWER')) {
            const version = await prisma.automationFlowVersion.findFirst({
                where: { id: state.flowVersionId, tenantId },
                select: { stepsJson: true },
            });
            if (version?.stepsJson) {
                return this.execute(tenantId, threadId, version.stepsJson as unknown as FlowDefinition, state, messageText);
            }
            // La versión ya no existe → limpiar estado y dejar pasar a la IA.
            await prisma.whatsappThread.update({
                where: { id: threadId },
                data: { automationState: Prisma.DbNull, currentFlowVersionId: null },
            });
        }

        // 2. Iniciar un flujo nuevo por trigger ──────────────────────────────
        const candidateTriggers: AutomationTrigger[] = isNewConversation
            ? ['CONVERSATION_STARTED', 'INBOUND_MESSAGE']
            : ['INBOUND_MESSAGE'];

        for (const trigger of candidateTriggers) {
            const version = await automationsService.getActiveVersionForTrigger(tenantId, trigger);
            if (version?.stepsJson) {
                const flow = version.stepsJson as unknown as FlowDefinition;
                const initial = automationEngine.initState(version.id, flow);
                return this.execute(tenantId, threadId, flow, initial, messageText);
            }
        }

        return { handled: false, completed: false };
    }

    private static async execute(
        tenantId: string,
        threadId: string,
        flow: FlowDefinition,
        state: AutomationState,
        messageText: string,
    ): Promise<AutomationRunResult> {
        const result = await automationEngine.processTurn(flow, state, messageText);

        // Persistir el nuevo estado del flujo en el thread.
        await prisma.whatsappThread.update({
            where: { id: threadId },
            data: {
                automationState: (result.newState ?? Prisma.DbNull) as any,
                currentFlowVersionId: result.newState?.flowVersionId ?? null,
            },
        });

        return {
            handled: result.handled,
            outboundText: result.outboundText,
            assign: result.assign,
            completed: result.completed,
        };
    }
}
