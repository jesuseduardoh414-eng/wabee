import { ICrmProvider, CrmContact, CrmDeal, SyncResult } from '../crm.provider.interface';
import { env } from '@/config/env';

const LOGIN_URL = 'https://login.salesforce.com';
const SCOPES    = 'api refresh_token offline_access';
const API_VER   = 'v59.0';

interface SalesforceTokenResponse {
    access_token: string;
    refresh_token?: string;
    instance_url?: string;
}

interface SalesforceIdResponse {
    id?: string;
}

interface SalesforceQueryResponse<T> {
    records?: T[];
}

interface SalesforceContactRecord {
    Id: string;
    FirstName?: string;
    LastName?: string;
    Email?: string;
    Phone?: string;
}

interface SalesforceDealRecord {
    Id: string;
    Name?: string;
    StageName?: string;
    Amount?: number | string;
}

const LIFECYCLE_TO_SF: Record<string, string> = {
    NEW:      'Open - Not Contacted',
    LEAD:     'Working - Contacted',
    ACTIVE:   'Working - Contacted',
    CUSTOMER: 'Closed - Converted',
    INACTIVE: 'Closed - Not Converted',
};

export class SalesforceProvider implements ICrmProvider {
    readonly providerName = 'SALESFORCE';

    buildAuthUrl(redirectUri: string, state: string): string {
        const params = new URLSearchParams({
            response_type: 'code',
            client_id:     env.SALESFORCE_CLIENT_ID,
            redirect_uri:  redirectUri,
            scope:         SCOPES,
            state,
        });
        return `${LOGIN_URL}/services/oauth2/authorize?${params}`;
    }

    async exchangeCode(code: string, redirectUri: string) {
        const res = await fetch(`${LOGIN_URL}/services/oauth2/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type:    'authorization_code',
                client_id:     env.SALESFORCE_CLIENT_ID,
                client_secret: env.SALESFORCE_CLIENT_SECRET,
                redirect_uri:  redirectUri,
                code,
            }),
        });
        if (!res.ok) throw new Error(`Salesforce token exchange failed: ${await res.text()}`);
        const data = await res.json() as SalesforceTokenResponse;
        return {
            accessToken:  data.access_token  as string,
            refreshToken: data.refresh_token as string | undefined,
            // Salesforce tokens don't have a fixed expiry — 2h session
            expiresAt:    new Date(Date.now() + 2 * 60 * 60 * 1000),
            scopes:       SCOPES.split(' '),
            // instance_url must be stored in meta
            meta:         { instanceUrl: data.instance_url as string },
        };
    }

    async refreshAccessToken(refreshToken: string) {
        const res = await fetch(`${LOGIN_URL}/services/oauth2/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type:    'refresh_token',
                client_id:     env.SALESFORCE_CLIENT_ID,
                client_secret: env.SALESFORCE_CLIENT_SECRET,
                refresh_token: refreshToken,
            }),
        });
        if (!res.ok) throw new Error(`Salesforce token refresh failed: ${await res.text()}`);
        const data = await res.json() as SalesforceTokenResponse;
        return {
            accessToken: data.access_token as string,
            expiresAt:   new Date(Date.now() + 2 * 60 * 60 * 1000),
        };
    }

    // instanceUrl is stored in account.meta — passed via accessToken compound format
    // Convention: accessToken is plain token; callers must pass instanceUrl separately.
    // We accept instanceUrl as optional prefix: "https://xxx.salesforce.com|token"
    private parseToken(raw: string): { token: string; instanceUrl: string } {
        const [first, second] = raw.split('|');
        return second
            ? { instanceUrl: first, token: second }
            : { instanceUrl: LOGIN_URL, token: first };
    }

    async pushContact(rawToken: string, contact: CrmContact): Promise<SyncResult> {
        const { token, instanceUrl } = this.parseToken(rawToken);
        const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
        const base    = `${instanceUrl}/services/data/${API_VER}/sobjects/Contact`;

        const body: Record<string, any> = {
            LastName:  contact.lastName || contact.firstName || 'Sin nombre',
            FirstName: contact.firstName,
            Email:     contact.email,
            Phone:     contact.phone,
            LeadSource: 'WhatsApp',
        };

        const existingId = contact.externalId || null;
        let res: Response;
        let operation: string;

        if (existingId) {
            res = await fetch(`${base}/${existingId}`, { method: 'PATCH', headers, body: JSON.stringify(body) });
            operation = 'UPDATE';
        } else {
            res = await fetch(base, { method: 'POST', headers, body: JSON.stringify(body) });
            operation = 'CREATE';
        }

        if (res.status === 204) return { entityType: 'CONTACT', entityId: existingId ?? undefined, operation, direction: 'PUSH', status: 'SUCCESS' };
        if (!res.ok) return { entityType: 'CONTACT', entityId: existingId ?? undefined, operation, direction: 'PUSH', status: 'FAILED', errorMessage: await res.text() };

        const data = await res.json() as SalesforceIdResponse;
        return { entityType: 'CONTACT', entityId: data.id ?? existingId ?? '', operation, direction: 'PUSH', status: 'SUCCESS' };
    }

    async pullContacts(rawToken: string, _since?: Date): Promise<CrmContact[]> {
        const { token, instanceUrl } = this.parseToken(rawToken);
        const query = encodeURIComponent(`SELECT Id,FirstName,LastName,Email,Phone FROM Contact LIMIT 100`);
        const res   = await fetch(`${instanceUrl}/services/data/${API_VER}/query?q=${query}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return [];
        const data = await res.json() as SalesforceQueryResponse<SalesforceContactRecord>;
        return (data.records ?? []).map((c) => ({
            externalId: c.Id as string,
            firstName:  c.FirstName ?? undefined,
            lastName:   c.LastName  ?? undefined,
            email:      c.Email     ?? undefined,
            phone:      c.Phone     ?? undefined,
        }));
    }

    async pushDeal(rawToken: string, deal: CrmDeal): Promise<SyncResult> {
        const { token, instanceUrl } = this.parseToken(rawToken);
        const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
        const base    = `${instanceUrl}/services/data/${API_VER}/sobjects/Opportunity`;

        const body: Record<string, any> = {
            Name:        deal.name,
            StageName:   deal.stage ?? 'Prospecting',
            CloseDate:   new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            Amount:      deal.amount,
        };

        const existingId = deal.externalId || null;
        let res: Response;
        let operation: string;

        if (existingId) {
            res = await fetch(`${base}/${existingId}`, { method: 'PATCH', headers, body: JSON.stringify(body) });
            operation = 'UPDATE';
        } else {
            res = await fetch(base, { method: 'POST', headers, body: JSON.stringify(body) });
            operation = 'CREATE';
        }

        if (res.status === 204) return { entityType: 'DEAL', entityId: existingId ?? undefined, operation, direction: 'PUSH', status: 'SUCCESS' };
        if (!res.ok) return { entityType: 'DEAL', entityId: existingId ?? undefined, operation, direction: 'PUSH', status: 'FAILED', errorMessage: await res.text() };
        const data = await res.json() as SalesforceIdResponse;
        return { entityType: 'DEAL', entityId: data.id ?? '', operation, direction: 'PUSH', status: 'SUCCESS' };
    }

    async pullDeals(rawToken: string, _since?: Date): Promise<CrmDeal[]> {
        const { token, instanceUrl } = this.parseToken(rawToken);
        const query = encodeURIComponent(`SELECT Id,Name,StageName,Amount FROM Opportunity LIMIT 100`);
        const res   = await fetch(`${instanceUrl}/services/data/${API_VER}/query?q=${query}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return [];
        const data = await res.json() as SalesforceQueryResponse<SalesforceDealRecord>;
        return (data.records ?? []).map((d) => ({
            externalId: d.Id     as string,
            name:       d.Name   ?? '',
            stage:      d.StageName ?? undefined,
            amount:     d.Amount ? Number(d.Amount) : undefined,
        }));
    }
}

export const salesforceProvider = new SalesforceProvider();
