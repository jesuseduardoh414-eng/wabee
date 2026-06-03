import { ICrmProvider, CrmContact, CrmDeal, SyncResult } from '../crm.provider.interface';
import { env } from '@/config/env';

// Dynamics 365 uses Azure AD OAuth 2.0.
// The org URL (e.g. https://contoso.crm.dynamics.com) varies per tenant
// and is stored in IntegrationAccount.meta.orgUrl.
// Access token format: "https://org.crm.dynamics.com|token"

const AUTHORITY    = (tenantId: string) => `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0`;
const SCOPES       = (orgUrl: string)   => `${orgUrl}/.default offline_access`;
const API_VER      = '9.2';

export class Dynamics365Provider implements ICrmProvider {
    readonly providerName = 'DYNAMICS365';

    buildAuthUrl(redirectUri: string, state: string): string {
        const orgUrl   = env.DYNAMICS365_ORG_URL || 'https://org.crm.dynamics.com';
        const tenantId = env.DYNAMICS365_TENANT_ID || 'common';
        const params   = new URLSearchParams({
            client_id:     env.DYNAMICS365_CLIENT_ID,
            response_type: 'code',
            redirect_uri:  redirectUri,
            scope:         SCOPES(orgUrl),
            state,
        });
        return `${AUTHORITY(tenantId)}/authorize?${params}`;
    }

    async exchangeCode(code: string, redirectUri: string) {
        const orgUrl   = env.DYNAMICS365_ORG_URL || 'https://org.crm.dynamics.com';
        const tenantId = env.DYNAMICS365_TENANT_ID || 'common';
        const res      = await fetch(`${AUTHORITY(tenantId)}/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type:    'authorization_code',
                client_id:     env.DYNAMICS365_CLIENT_ID,
                client_secret: env.DYNAMICS365_CLIENT_SECRET,
                redirect_uri:  redirectUri,
                scope:         SCOPES(orgUrl),
                code,
            }),
        });
        if (!res.ok) throw new Error(`Dynamics365 token exchange failed: ${await res.text()}`);
        const data = await res.json();
        return {
            accessToken:  data.access_token  as string,
            refreshToken: data.refresh_token as string | undefined,
            expiresAt:    new Date(Date.now() + (data.expires_in as number) * 1000),
            scopes:       [SCOPES(orgUrl)],
            meta:         { orgUrl },
        };
    }

    async refreshAccessToken(refreshToken: string) {
        const orgUrl   = env.DYNAMICS365_ORG_URL || 'https://org.crm.dynamics.com';
        const tenantId = env.DYNAMICS365_TENANT_ID || 'common';
        const res      = await fetch(`${AUTHORITY(tenantId)}/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type:    'refresh_token',
                client_id:     env.DYNAMICS365_CLIENT_ID,
                client_secret: env.DYNAMICS365_CLIENT_SECRET,
                scope:         SCOPES(orgUrl),
                refresh_token: refreshToken,
            }),
        });
        if (!res.ok) throw new Error(`Dynamics365 token refresh failed: ${await res.text()}`);
        const data = await res.json();
        return {
            accessToken: data.access_token as string,
            expiresAt:   new Date(Date.now() + (data.expires_in as number) * 1000),
        };
    }

    private parseToken(raw: string): { token: string; orgUrl: string } {
        const [first, second] = raw.split('|');
        return second
            ? { orgUrl: first, token: second }
            : { orgUrl: env.DYNAMICS365_ORG_URL || 'https://org.crm.dynamics.com', token: first };
    }

    private apiBase(orgUrl: string) {
        return `${orgUrl}/api/data/v${API_VER}`;
    }

    async pushContact(rawToken: string, contact: CrmContact): Promise<SyncResult> {
        const { token, orgUrl } = this.parseToken(rawToken);
        const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'OData-MaxVersion': '4.0', 'OData-Version': '4.0' };
        const body: Record<string, any> = {
            lastname:  contact.lastName || contact.firstName || 'Sin nombre',
            firstname: contact.firstName,
            emailaddress1: contact.email,
            telephone1:    contact.phone,
        };

        const existingId = contact.externalId || null;
        let res: Response;
        let operation: string;

        if (existingId) {
            res = await fetch(`${this.apiBase(orgUrl)}/contacts(${existingId})`, { method: 'PATCH', headers, body: JSON.stringify(body) });
            operation = 'UPDATE';
        } else {
            res = await fetch(`${this.apiBase(orgUrl)}/contacts`, { method: 'POST', headers: { ...headers, Prefer: 'return=representation' }, body: JSON.stringify(body) });
            operation = 'CREATE';
        }

        if (res.status === 204) return { entityType: 'CONTACT', entityId: existingId ?? undefined, operation, direction: 'PUSH', status: 'SUCCESS' };
        if (!res.ok) return { entityType: 'CONTACT', entityId: existingId ?? undefined, operation, direction: 'PUSH', status: 'FAILED', errorMessage: await res.text() };
        const data = await res.json();
        return { entityType: 'CONTACT', entityId: data.contactid ?? '', operation, direction: 'PUSH', status: 'SUCCESS' };
    }

    async pullContacts(rawToken: string, _since?: Date): Promise<CrmContact[]> {
        const { token, orgUrl } = this.parseToken(rawToken);
        const res = await fetch(`${this.apiBase(orgUrl)}/contacts?$select=contactid,firstname,lastname,emailaddress1,telephone1&$top=100`, {
            headers: { Authorization: `Bearer ${token}`, 'OData-MaxVersion': '4.0', 'OData-Version': '4.0' },
        });
        if (!res.ok) return [];
        const data = await res.json();
        return (data.value ?? []).map((c: any) => ({
            externalId: c.contactid as string,
            firstName:  c.firstname        ?? undefined,
            lastName:   c.lastname         ?? undefined,
            email:      c.emailaddress1    ?? undefined,
            phone:      c.telephone1       ?? undefined,
        }));
    }

    async pushDeal(rawToken: string, deal: CrmDeal): Promise<SyncResult> {
        const { token, orgUrl } = this.parseToken(rawToken);
        const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'OData-MaxVersion': '4.0', 'OData-Version': '4.0' };
        const body: Record<string, any> = {
            name:                deal.name,
            stepname:            deal.stage ?? 'Qualify',
            estimatedvalue:      deal.amount,
            estimatedclosedate:  new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        };

        const existingId = deal.externalId || null;
        let res: Response;
        let operation: string;

        if (existingId) {
            res = await fetch(`${this.apiBase(orgUrl)}/opportunities(${existingId})`, { method: 'PATCH', headers, body: JSON.stringify(body) });
            operation = 'UPDATE';
        } else {
            res = await fetch(`${this.apiBase(orgUrl)}/opportunities`, { method: 'POST', headers: { ...headers, Prefer: 'return=representation' }, body: JSON.stringify(body) });
            operation = 'CREATE';
        }

        if (res.status === 204) return { entityType: 'DEAL', entityId: existingId ?? undefined, operation, direction: 'PUSH', status: 'SUCCESS' };
        if (!res.ok) return { entityType: 'DEAL', entityId: existingId ?? undefined, operation, direction: 'PUSH', status: 'FAILED', errorMessage: await res.text() };
        const data = await res.json();
        return { entityType: 'DEAL', entityId: data.opportunityid ?? '', operation, direction: 'PUSH', status: 'SUCCESS' };
    }

    async pullDeals(rawToken: string, _since?: Date): Promise<CrmDeal[]> {
        const { token, orgUrl } = this.parseToken(rawToken);
        const res = await fetch(`${this.apiBase(orgUrl)}/opportunities?$select=opportunityid,name,stepname,estimatedvalue&$top=100`, {
            headers: { Authorization: `Bearer ${token}`, 'OData-MaxVersion': '4.0', 'OData-Version': '4.0' },
        });
        if (!res.ok) return [];
        const data = await res.json();
        return (data.value ?? []).map((d: any) => ({
            externalId: d.opportunityid as string,
            name:       d.name          ?? '',
            stage:      d.stepname      ?? undefined,
            amount:     d.estimatedvalue ? Number(d.estimatedvalue) : undefined,
        }));
    }
}

export const dynamics365Provider = new Dynamics365Provider();
