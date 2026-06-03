import { ICrmProvider, CrmContact, CrmDeal, SyncResult } from '../crm.provider.interface';
import { env } from '@/config/env';

const HUBSPOT_AUTH_URL = 'https://app.hubspot.com/oauth/authorize';
const HUBSPOT_TOKEN_URL = 'https://api.hubapi.com/oauth/v1/token';
const API = 'https://api.hubapi.com';
const SCOPES = 'crm.objects.contacts.read crm.objects.contacts.write crm.objects.deals.read crm.objects.deals.write';

// Wabee lifecycle → HubSpot lifecyclestage
const LIFECYCLE_TO_HS: Record<string, string> = {
    NEW:      'subscriber',
    LEAD:     'lead',
    ACTIVE:   'lead',
    CUSTOMER: 'customer',
    INACTIVE: 'other',
    BLOCKED:  'other',
};

// HubSpot lifecyclestage → Wabee lifecycle
const HS_TO_LIFECYCLE: Record<string, string> = {
    subscriber:             'NEW',
    lead:                   'LEAD',
    marketingqualifiedlead: 'LEAD',
    salesqualifiedlead:     'LEAD',
    opportunity:            'LEAD',
    customer:               'CUSTOMER',
    evangelist:             'CUSTOMER',
    other:                  'INACTIVE',
};

export class HubSpotProvider implements ICrmProvider {
    readonly providerName = 'HUBSPOT';

    buildAuthUrl(redirectUri: string, state: string): string {
        const params = new URLSearchParams({
            client_id:    env.HUBSPOT_CLIENT_ID,
            redirect_uri: redirectUri,
            scope:        SCOPES,
            state,
        });
        return `${HUBSPOT_AUTH_URL}?${params}`;
    }

    async exchangeCode(code: string, redirectUri: string) {
        const res = await fetch(HUBSPOT_TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type:    'authorization_code',
                client_id:     env.HUBSPOT_CLIENT_ID,
                client_secret: env.HUBSPOT_CLIENT_SECRET,
                redirect_uri:  redirectUri,
                code,
            }),
        });
        if (!res.ok) throw new Error(`HubSpot token exchange failed: ${await res.text()}`);
        const data = await res.json();
        return {
            accessToken:  data.access_token as string,
            refreshToken: data.refresh_token as string | undefined,
            expiresAt:    new Date(Date.now() + (data.expires_in as number) * 1000),
            scopes:       ((data.scope as string) || SCOPES).split(' '),
        };
    }

    async refreshAccessToken(refreshToken: string) {
        const res = await fetch(HUBSPOT_TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type:    'refresh_token',
                client_id:     env.HUBSPOT_CLIENT_ID,
                client_secret: env.HUBSPOT_CLIENT_SECRET,
                refresh_token: refreshToken,
            }),
        });
        if (!res.ok) throw new Error(`HubSpot token refresh failed: ${await res.text()}`);
        const data = await res.json();
        return {
            accessToken: data.access_token as string,
            expiresAt:   new Date(Date.now() + (data.expires_in as number) * 1000),
        };
    }

    /** Returns HubSpot portal ID (hub_id) for the given access token. */
    async getPortalId(accessToken: string): Promise<string | null> {
        const res = await fetch(`${API}/oauth/v1/access-tokens/${accessToken}`);
        if (!res.ok) return null;
        const data = await res.json();
        return data.hub_id ? String(data.hub_id) : null;
    }

    async pushContact(accessToken: string, contact: CrmContact): Promise<SyncResult> {
        const props: Record<string, string> = {};
        if (contact.firstName)     props.firstname       = contact.firstName;
        if (contact.lastName)      props.lastname        = contact.lastName;
        if (contact.email)         props.email           = contact.email;
        if (contact.phone)         props.phone           = contact.phone;
        if (contact.lifecycleStage) props.lifecyclestage = LIFECYCLE_TO_HS[contact.lifecycleStage] ?? 'lead';

        // Try to resolve existing contact in HubSpot
        let existingId: string | null = contact.externalId || null;
        if (!existingId && contact.email) {
            existingId = await this._findContactByEmail(accessToken, contact.email);
        }

        const [res, operation] = existingId
            ? [
                await fetch(`${API}/crm/v3/objects/contacts/${existingId}`, {
                    method: 'PATCH',
                    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ properties: props }),
                }),
                'UPDATE',
              ]
            : [
                await fetch(`${API}/crm/v3/objects/contacts`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ properties: props }),
                }),
                'CREATE',
              ];

        if (!res.ok) {
            return {
                entityType: 'CONTACT', entityId: existingId ?? undefined,
                operation, direction: 'PUSH', status: 'FAILED',
                errorMessage: await res.text(),
            };
        }
        const data = await res.json();
        return { entityType: 'CONTACT', entityId: data.id, operation, direction: 'PUSH', status: 'SUCCESS' };
    }

    async pullContacts(accessToken: string, since?: Date): Promise<CrmContact[]> {
        let url = `${API}/crm/v3/objects/contacts?limit=100&properties=firstname,lastname,email,phone,lifecyclestage`;
        if (since) {
            // HubSpot v3 search endpoint for filtering by modified date
            const searchRes = await fetch(`${API}/crm/v3/objects/contacts/search`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filterGroups: [{ filters: [{ propertyName: 'lastmodifieddate', operator: 'GTE', value: since.valueOf() }] }],
                    properties: ['firstname', 'lastname', 'email', 'phone', 'lifecyclestage'],
                    limit: 100,
                }),
            });
            if (!searchRes.ok) return [];
            const data = await searchRes.json();
            return this._mapContacts(data.results ?? []);
        }

        const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!res.ok) return [];
        const data = await res.json();
        return this._mapContacts(data.results ?? []);
    }

    async pushDeal(accessToken: string, deal: CrmDeal): Promise<SyncResult> {
        const props: Record<string, any> = { dealname: deal.name };
        if (deal.stage)  props.dealstage = deal.stage;
        if (deal.amount) props.amount    = deal.amount;

        const existingId = deal.externalId || null;
        const [res, operation] = existingId
            ? [
                await fetch(`${API}/crm/v3/objects/deals/${existingId}`, {
                    method: 'PATCH',
                    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ properties: props }),
                }),
                'UPDATE',
              ]
            : [
                await fetch(`${API}/crm/v3/objects/deals`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ properties: props }),
                }),
                'CREATE',
              ];

        if (!res.ok) {
            return {
                entityType: 'DEAL', entityId: existingId ?? undefined,
                operation, direction: 'PUSH', status: 'FAILED',
                errorMessage: await res.text(),
            };
        }
        const data = await res.json();
        return { entityType: 'DEAL', entityId: data.id, operation, direction: 'PUSH', status: 'SUCCESS' };
    }

    async pullDeals(accessToken: string, _since?: Date): Promise<CrmDeal[]> {
        const res = await fetch(`${API}/crm/v3/objects/deals?limit=100&properties=dealname,dealstage,amount`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) return [];
        const data = await res.json();
        return (data.results ?? []).map((d: any) => ({
            externalId: d.id as string,
            name:       (d.properties.dealname as string) ?? '',
            stage:      d.properties.dealstage as string | undefined,
            amount:     d.properties.amount ? parseFloat(d.properties.amount) : undefined,
        }));
    }

    private async _findContactByEmail(accessToken: string, email: string): Promise<string | null> {
        const res = await fetch(`${API}/crm/v3/objects/contacts/search`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: email }] }],
                properties: ['email'],
                limit: 1,
            }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        return (data.results?.[0]?.id as string) ?? null;
    }

    private _mapContacts(results: any[]): CrmContact[] {
        return results.map(c => ({
            externalId:     c.id as string,
            firstName:      c.properties.firstname as string | undefined,
            lastName:       c.properties.lastname  as string | undefined,
            email:          c.properties.email     as string | undefined,
            phone:          c.properties.phone     as string | undefined,
            lifecycleStage: HS_TO_LIFECYCLE[c.properties.lifecyclestage] ?? 'NEW',
        }));
    }
}

export const hubSpotProvider = new HubSpotProvider();
