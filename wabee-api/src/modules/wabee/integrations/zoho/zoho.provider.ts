import { ICrmProvider, CrmContact, CrmDeal, SyncResult } from '../crm.provider.interface';
import { env } from '@/config/env';

const AUTH_URL  = 'https://accounts.zoho.com/oauth/v2/auth';
const TOKEN_URL = 'https://accounts.zoho.com/oauth/v2/token';
const API       = 'https://www.zohoapis.com/crm/v3';
const SCOPES    = 'ZohoCRM.modules.contacts.ALL,ZohoCRM.modules.deals.ALL';

const LIFECYCLE_TO_ZOHO: Record<string, string> = {
    NEW:      'Cold Lead',
    LEAD:     'Warm Lead',
    ACTIVE:   'Warm Lead',
    CUSTOMER: 'Converted',
    INACTIVE: 'Lost Lead',
};

export class ZohoProvider implements ICrmProvider {
    readonly providerName = 'ZOHO';

    buildAuthUrl(redirectUri: string, state: string): string {
        const params = new URLSearchParams({
            client_id:     env.ZOHO_CLIENT_ID,
            redirect_uri:  redirectUri,
            response_type: 'code',
            scope:         SCOPES,
            access_type:   'offline',
            state,
        });
        return `${AUTH_URL}?${params}`;
    }

    async exchangeCode(code: string, redirectUri: string) {
        const res = await fetch(TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type:    'authorization_code',
                client_id:     env.ZOHO_CLIENT_ID,
                client_secret: env.ZOHO_CLIENT_SECRET,
                redirect_uri:  redirectUri,
                code,
            }),
        });
        if (!res.ok) throw new Error(`Zoho token exchange failed: ${await res.text()}`);
        const data = await res.json();
        if (data.error) throw new Error(`Zoho token error: ${data.error}`);
        return {
            accessToken:  data.access_token  as string,
            refreshToken: data.refresh_token as string | undefined,
            expiresAt:    new Date(Date.now() + (data.expires_in as number) * 1000),
            scopes:       SCOPES.split(','),
        };
    }

    async refreshAccessToken(refreshToken: string) {
        const res = await fetch(TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type:    'refresh_token',
                client_id:     env.ZOHO_CLIENT_ID,
                client_secret: env.ZOHO_CLIENT_SECRET,
                refresh_token: refreshToken,
            }),
        });
        if (!res.ok) throw new Error(`Zoho token refresh failed: ${await res.text()}`);
        const data = await res.json();
        return {
            accessToken: data.access_token as string,
            expiresAt:   new Date(Date.now() + (data.expires_in as number) * 1000),
        };
    }

    async pushContact(accessToken: string, contact: CrmContact): Promise<SyncResult> {
        const record: Record<string, any> = {
            Last_Name:  contact.lastName || contact.firstName || 'Sin nombre',
            First_Name: contact.firstName,
            Email:      contact.email,
            Phone:      contact.phone,
            Lead_Status: LIFECYCLE_TO_ZOHO[contact.lifecycleStage ?? ''] ?? 'Warm Lead',
        };

        const existingId = contact.externalId || null;
        let res: Response;
        let operation: string;

        if (existingId) {
            res = await fetch(`${API}/Contacts/${existingId}`, {
                method: 'PUT',
                headers: { Authorization: `Zoho-oauthtoken ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: [record] }),
            });
            operation = 'UPDATE';
        } else {
            res = await fetch(`${API}/Contacts`, {
                method: 'POST',
                headers: { Authorization: `Zoho-oauthtoken ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: [record] }),
            });
            operation = 'CREATE';
        }

        if (!res.ok) {
            return { entityType: 'CONTACT', entityId: existingId ?? undefined, operation, direction: 'PUSH', status: 'FAILED', errorMessage: await res.text() };
        }
        const data = await res.json();
        const id   = data.data?.[0]?.details?.id ?? existingId ?? '';
        return { entityType: 'CONTACT', entityId: id, operation, direction: 'PUSH', status: 'SUCCESS' };
    }

    async pullContacts(accessToken: string, _since?: Date): Promise<CrmContact[]> {
        const res = await fetch(`${API}/Contacts?fields=First_Name,Last_Name,Email,Phone&per_page=100`, {
            headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
        });
        if (!res.ok) return [];
        const data = await res.json();
        return (data.data ?? []).map((c: any) => ({
            externalId: c.id as string,
            firstName:  c.First_Name ?? undefined,
            lastName:   c.Last_Name  ?? undefined,
            email:      c.Email      ?? undefined,
            phone:      c.Phone      ?? undefined,
        }));
    }

    async pushDeal(accessToken: string, deal: CrmDeal): Promise<SyncResult> {
        const record: Record<string, any> = { Deal_Name: deal.name };
        if (deal.amount) record.Amount    = deal.amount;
        if (deal.stage)  record.Stage     = deal.stage;

        const existingId = deal.externalId || null;
        let res: Response;
        let operation: string;

        if (existingId) {
            res = await fetch(`${API}/Deals/${existingId}`, { method: 'PUT', headers: { Authorization: `Zoho-oauthtoken ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ data: [record] }) });
            operation = 'UPDATE';
        } else {
            res = await fetch(`${API}/Deals`, { method: 'POST', headers: { Authorization: `Zoho-oauthtoken ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ data: [record] }) });
            operation = 'CREATE';
        }

        if (!res.ok) {
            return { entityType: 'DEAL', entityId: existingId ?? undefined, operation, direction: 'PUSH', status: 'FAILED', errorMessage: await res.text() };
        }
        const data = await res.json();
        return { entityType: 'DEAL', entityId: data.data?.[0]?.details?.id ?? '', operation, direction: 'PUSH', status: 'SUCCESS' };
    }

    async pullDeals(accessToken: string, _since?: Date): Promise<CrmDeal[]> {
        const res = await fetch(`${API}/Deals?fields=Deal_Name,Stage,Amount&per_page=100`, {
            headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
        });
        if (!res.ok) return [];
        const data = await res.json();
        return (data.data ?? []).map((d: any) => ({
            externalId: d.id as string,
            name:       d.Deal_Name ?? '',
            stage:      d.Stage     ?? undefined,
            amount:     d.Amount    ? Number(d.Amount) : undefined,
        }));
    }
}

export const zohoProvider = new ZohoProvider();
