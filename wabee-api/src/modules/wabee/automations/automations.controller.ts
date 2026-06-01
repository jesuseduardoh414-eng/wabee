import { Request, Response } from 'express';
import { automationsService } from './automations.service';
import { AutomationFlowStatus } from '@prisma/client';

export class AutomationsController {

    static async listFlows(req: Request, res: Response) {
        try {
            const tenantId = (req as any).tenantId;
            const flows = await automationsService.listFlows(tenantId);
            res.json(flows);
        } catch (error: any) {
            res.status(error.status || 500).json({ error: error.message });
        }
    }

    static async getFlow(req: Request, res: Response) {
        try {
            const tenantId = (req as any).tenantId;
            const flow = await automationsService.getFlow(tenantId, req.params.id);
            res.json(flow);
        } catch (error: any) {
            res.status(error.status || 500).json({ error: error.message });
        }
    }

    static async createFlow(req: Request, res: Response) {
        try {
            const tenantId = (req as any).tenantId;
            const { name, description, trigger } = req.body;

            if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
            if (!trigger)      return res.status(400).json({ error: 'trigger is required' });

            const flow = await automationsService.createFlow(tenantId, { name, description, trigger });
            res.status(201).json(flow);
        } catch (error: any) {
            res.status(error.status || 500).json({ error: error.message });
        }
    }

    static async updateFlow(req: Request, res: Response) {
        try {
            const tenantId = (req as any).tenantId;
            const flow = await automationsService.updateFlow(tenantId, req.params.id, req.body);
            res.json(flow);
        } catch (error: any) {
            res.status(error.status || 500).json({ error: error.message });
        }
    }

    static async deleteFlow(req: Request, res: Response) {
        try {
            const tenantId = (req as any).tenantId;
            const result = await automationsService.deleteFlow(tenantId, req.params.id);
            res.json(result);
        } catch (error: any) {
            res.status(error.status || 500).json({ error: error.message });
        }
    }

    static async publishVersion(req: Request, res: Response) {
        try {
            const tenantId = (req as any).tenantId;
            const { stepsJson } = req.body;

            if (!stepsJson) return res.status(400).json({ error: 'stepsJson is required' });

            const version = await automationsService.publishVersion(tenantId, req.params.id, { stepsJson });
            res.status(201).json(version);
        } catch (error: any) {
            res.status(error.status || 500).json({ error: error.message });
        }
    }

    static async activateFlow(req: Request, res: Response) {
        try {
            const tenantId = (req as any).tenantId;
            const flow = await automationsService.setFlowStatus(tenantId, req.params.id, AutomationFlowStatus.ACTIVE);
            res.json(flow);
        } catch (error: any) {
            res.status(error.status || 500).json({ error: error.message });
        }
    }

    static async pauseFlow(req: Request, res: Response) {
        try {
            const tenantId = (req as any).tenantId;
            const flow = await automationsService.setFlowStatus(tenantId, req.params.id, AutomationFlowStatus.PAUSED);
            res.json(flow);
        } catch (error: any) {
            res.status(error.status || 500).json({ error: error.message });
        }
    }
}
