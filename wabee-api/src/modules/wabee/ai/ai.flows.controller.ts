import { Request, Response } from 'express';
import { getAvailableFlows } from './ai.flow.registry';

export class AiFlowsController {
    
    /**
     * Devuelve la lista de flujos conversacionales registrados estáticamente en el sistema.
     * Es de solo lectura para el panel de configuración de IAs.
     */
    static async listFlows(req: Request, res: Response) {
        try {
            const flows = getAvailableFlows();
            
            // Para el frontend limpiamos las regex que no se pueden serializar directamente por JSON
            // y simplificamos la respuesta
            const returnData = flows.map(f => ({
                id: f.id,
                name: f.name,
                description: f.description,
                triggerIntents: f.triggerIntents,
                completionMessage: f.completionMessage,
                slots: f.slots.map(s => ({
                    id: s.id,
                    description: s.description,
                    type: s.type,
                    required: s.required,
                    promptText: s.promptText
                }))
            }));

            res.status(200).json({
                success: true,
                data: returnData
            });

        } catch (error: any) {
            console.error('[AiFlowsController] Error listing flows:', error);
            res.status(500).json({ success: false, error: 'Error interno al listar flujos de IA' });
        }
    }
}
