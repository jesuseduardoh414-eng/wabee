import { env } from '@/config/env';
import { integrationsService } from '../../wabee/integrations/integrations.service';
import { hubSpotProvider } from '../../wabee/integrations/hubspot/hubspot.provider';
import { encrypt } from '../../wabee/channels/whatsapp/token.crypto';

const REDIRECT_URI = () => `${env.APP_BASE_URL}/oauth/hubspot/callback`;

export interface HubSpotOAuthState {
    integrationId: string;
    tenantId:      string;
}

export function buildHubSpotAuthUrl(integrationId: string, tenantId: string): string {
    const state = Buffer.from(JSON.stringify({ integrationId, tenantId } satisfies HubSpotOAuthState)).toString('base64url');
    return hubSpotProvider.buildAuthUrl(REDIRECT_URI(), state);
}

export function parseHubSpotState(state: string): HubSpotOAuthState {
    return JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
}

export async function exchangeAndSave(code: string, integrationId: string, tenantId: string) {
    const tokens = await hubSpotProvider.exchangeCode(code, REDIRECT_URI());

    // Fetch HubSpot portal ID to correlate webhooks
    const portalId = await hubSpotProvider.getPortalId(tokens.accessToken);

    const encryptedAccess   = JSON.stringify(encrypt(tokens.accessToken));
    const encryptedRefresh  = tokens.refreshToken
        ? JSON.stringify(encrypt(tokens.refreshToken))
        : undefined;

    await integrationsService.saveAccount({
        integrationId,
        tenantId,
        accessToken:    encryptedAccess,
        refreshToken:   encryptedRefresh,
        tokenExpiresAt: tokens.expiresAt,
        scopes:         tokens.scopes,
        meta:           portalId ? { portalId } : undefined,
    });

    await integrationsService.markConnected(integrationId, 'CONNECTED');
}
