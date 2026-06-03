import { Request, Response, NextFunction } from 'express';
import { buildHubSpotAuthUrl, parseHubSpotState, exchangeAndSave } from './hubspot.oauth.service';
import { env } from '@/config/env';
import { prisma } from '@/lib/prisma';

const FRONTEND_CRM = `${env.FRONTEND_URL}/dashboard/wabee/crm-integrations`;

export async function oauthStart(req: Request, res: Response, next: NextFunction) {
    try {
        const { integration_id, tenant_id } = req.query as { integration_id?: string; tenant_id?: string };

        if (!integration_id || !tenant_id) {
            return res.status(400).json({ error: 'Se requieren integration_id y tenant_id' });
        }

        const integration = await prisma.externalIntegration.findFirst({
            where: { id: integration_id, tenantId: tenant_id, provider: 'HUBSPOT' },
        });
        if (!integration) return res.status(404).json({ error: 'Integración no encontrada' });

        const url = buildHubSpotAuthUrl(integration_id, tenant_id);
        res.redirect(url);
    } catch (err) {
        next(err);
    }
}

export async function oauthCallback(req: Request, res: Response, next: NextFunction) {
    try {
        const { code, state, error } = req.query as {
            code?: string;
            state?: string;
            error?: string;
        };

        if (error || !code || !state) {
            console.warn('[HubSpot OAuth] Callback con error:', error);
            return res.redirect(`${FRONTEND_CRM}?oauth=error&provider=hubspot`);
        }

        const { integrationId, tenantId } = parseHubSpotState(state);
        await exchangeAndSave(code, integrationId, tenantId);

        res.redirect(`${FRONTEND_CRM}?oauth=ok&provider=hubspot`);
    } catch (err) {
        console.error('[HubSpot OAuth] Callback error:', err);
        res.redirect(`${FRONTEND_CRM}?oauth=error&provider=hubspot`);
    }
}
