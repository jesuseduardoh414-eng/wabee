import { Request, Response, NextFunction } from 'express';
import { env } from '@/config/env';
import { prisma } from '@/lib/prisma';
import { integrationsService } from '../../wabee/integrations/integrations.service';
import { getProvider } from '../../wabee/integrations/provider.registry';
import { encrypt } from '../../wabee/channels/whatsapp/token.crypto';

const FRONTEND_CRM = `${env.FRONTEND_URL}/dashboard/wabee/crm-integrations`;

interface OAuthState {
    integrationId: string;
    tenantId:      string;
    provider:      string;
}

function encodeState(state: OAuthState): string {
    return Buffer.from(JSON.stringify(state)).toString('base64url');
}

function decodeState(state: string): OAuthState {
    return JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
}

function redirectUri(provider: string): string {
    return `${env.APP_BASE_URL}/oauth/crm/${provider.toLowerCase()}/callback`;
}

// GET /oauth/crm/:provider/start?integration_id=X&tenant_id=Y
export async function oauthStart(req: Request, res: Response, next: NextFunction) {
    try {
        const provider      = (req.params.provider as string).toUpperCase();
        const { integration_id, tenant_id } = req.query as { integration_id?: string; tenant_id?: string };

        if (!integration_id || !tenant_id) {
            return res.status(400).json({ error: 'integration_id y tenant_id son requeridos' });
        }

        const integration = await prisma.externalIntegration.findFirst({
            where: { id: integration_id, tenantId: tenant_id, provider: provider as any },
        });
        if (!integration) return res.status(404).json({ error: 'Integración no encontrada' });

        const crmProvider = getProvider(provider);
        if (!crmProvider) return res.status(400).json({ error: `Proveedor ${provider} no soportado` });

        const state = encodeState({ integrationId: integration_id, tenantId: tenant_id, provider });
        const url   = crmProvider.buildAuthUrl(redirectUri(provider), state);
        res.redirect(url);
    } catch (err) {
        next(err);
    }
}

// GET /oauth/crm/:provider/callback?code=X&state=Y
export async function oauthCallback(req: Request, res: Response, next: NextFunction) {
    const providerParam = (req.params.provider as string).toUpperCase();
    try {
        const { code, state, error } = req.query as { code?: string; state?: string; error?: string };

        if (error || !code || !state) {
            return res.redirect(`${FRONTEND_CRM}?oauth=error&provider=${providerParam.toLowerCase()}`);
        }

        const { integrationId, tenantId, provider } = decodeState(state);
        const crmProvider = getProvider(provider);
        if (!crmProvider) throw new Error(`Provider ${provider} not found`);

        const tokens = await crmProvider.exchangeCode(code, redirectUri(provider));

        const encAccess   = JSON.stringify(encrypt(tokens.accessToken));
        const encRefresh  = (tokens as any).refreshToken
            ? JSON.stringify(encrypt((tokens as any).refreshToken))
            : undefined;

        // For Salesforce: store instanceUrl in meta
        const meta = (tokens as any).meta ?? undefined;

        await integrationsService.saveAccount({
            integrationId,
            tenantId,
            accessToken:    encAccess,
            refreshToken:   encRefresh,
            tokenExpiresAt: tokens.expiresAt,
            scopes:         tokens.scopes,
            meta,
        });
        await integrationsService.markConnected(integrationId, 'CONNECTED');

        res.redirect(`${FRONTEND_CRM}?oauth=ok&provider=${provider.toLowerCase()}`);
    } catch (err) {
        console.error(`[CRM OAuth] ${providerParam} callback error:`, err);
        res.redirect(`${FRONTEND_CRM}?oauth=error&provider=${providerParam.toLowerCase()}`);
    }
}
