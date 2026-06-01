import { Request, Response } from 'express';
import { integrationsService } from './integrations.service';
import { CrmProvider } from '@prisma/client';

const VALID_PROVIDERS = new Set<string>(Object.values(CrmProvider));

export class IntegrationsController {

    static async list(req: Request, res: Response) {
        try {
            const tenantId = (req as any).tenantId;
            res.json(await integrationsService.listIntegrations(tenantId));
        } catch (e: any) { res.status(e.status || 500).json({ error: e.message }); }
    }

    static async get(req: Request, res: Response) {
        try {
            const tenantId = (req as any).tenantId;
            res.json(await integrationsService.getIntegration(tenantId, req.params.id));
        } catch (e: any) { res.status(e.status || 500).json({ error: e.message }); }
    }

    static async create(req: Request, res: Response) {
        try {
            const tenantId = (req as any).tenantId;
            const { provider, name } = req.body;

            if (!provider || !VALID_PROVIDERS.has(provider)) {
                return res.status(400).json({ error: `provider must be one of: ${[...VALID_PROVIDERS].join(', ')}` });
            }
            if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

            const integration = await integrationsService.createIntegration(tenantId, provider as CrmProvider, name.trim());
            res.status(201).json(integration);
        } catch (e: any) { res.status(e.status || 500).json({ error: e.message }); }
    }

    static async remove(req: Request, res: Response) {
        try {
            const tenantId = (req as any).tenantId;
            res.json(await integrationsService.deleteIntegration(tenantId, req.params.id));
        } catch (e: any) { res.status(e.status || 500).json({ error: e.message }); }
    }

    static async upsertMappings(req: Request, res: Response) {
        try {
            const tenantId = (req as any).tenantId;
            const { mappings } = req.body;

            if (!Array.isArray(mappings)) {
                return res.status(400).json({ error: 'mappings must be an array' });
            }

            const result = await integrationsService.upsertFieldMappings(tenantId, req.params.id, mappings);
            res.json(result);
        } catch (e: any) { res.status(e.status || 500).json({ error: e.message }); }
    }

    static async getSyncLogs(req: Request, res: Response) {
        try {
            const tenantId = (req as any).tenantId;
            const limit = Math.min(parseInt(String(req.query.limit || '50')), 200);
            const logs = await integrationsService.listSyncLogs(tenantId, req.params.id, limit);
            res.json(logs);
        } catch (e: any) { res.status(e.status || 500).json({ error: e.message }); }
    }
}
