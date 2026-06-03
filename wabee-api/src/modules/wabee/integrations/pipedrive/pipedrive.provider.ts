import { ICrmProvider, CrmContact, CrmDeal, SyncResult } from '../crm.provider.interface';

const API = 'https://api.pipedrive.com/v1';

// Pipedrive uses API key auth — no OAuth needed.
// buildAuthUrl / exchangeCode / refreshAccessToken are no-ops.

export class PipedriveProvider implements ICrmProvider {
    readonly providerName = 'PIPEDRIVE';

    buildAuthUrl(_redirectUri: string, _state: string): string {
        throw new Error('Pipedrive uses API key auth, not OAuth');
    }

    async exchangeCode(_code: string, _redirectUri: string) {
        throw new Error('Pipedrive uses API key auth, not OAuth');
    }

    async refreshAccessToken(_refreshToken: string) {
        throw new Error('Pipedrive tokens do not expire');
    }

    private url(path: string, apiToken: string) {
        return `${API}${path}?api_token=${apiToken}`;
    }

    async pushContact(apiToken: string, contact: CrmContact): Promise<SyncResult> {
        const body: Record<string, any> = {};
        const name = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.phone || 'Sin nombre';
        body.name = name;

        // Find or create
        let existingId: string | null = contact.externalId || null;

        if (!existingId && contact.email) {
            const search = await fetch(this.url(`/persons/search`, apiToken) + `&term=${encodeURIComponent(contact.email)}&fields=email&limit=1`);
            if (search.ok) {
                const data = await search.json();
                existingId = data.data?.items?.[0]?.item?.id ? String(data.data.items[0].item.id) : null;
            }
        }

        if (contact.email) body.email = [{ value: contact.email, primary: true }];
        if (contact.phone) body.phone = [{ value: contact.phone, primary: true }];

        let res: Response;
        let operation: string;

        if (existingId) {
            res       = await fetch(this.url(`/persons/${existingId}`, apiToken), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            operation = 'UPDATE';
        } else {
            res       = await fetch(this.url('/persons', apiToken), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            operation = 'CREATE';
        }

        if (!res.ok) {
            return { entityType: 'CONTACT', entityId: existingId ?? undefined, operation, direction: 'PUSH', status: 'FAILED', errorMessage: await res.text() };
        }
        const data = await res.json();
        return { entityType: 'CONTACT', entityId: String(data.data?.id ?? ''), operation, direction: 'PUSH', status: 'SUCCESS' };
    }

    async pullContacts(apiToken: string, _since?: Date): Promise<CrmContact[]> {
        const res = await fetch(this.url('/persons', apiToken) + '&limit=100&sort=update_time+DESC');
        if (!res.ok) return [];
        const data = await res.json();
        return (data.data ?? []).map((p: any) => ({
            externalId: String(p.id),
            firstName:  p.first_name ?? undefined,
            lastName:   p.last_name  ?? undefined,
            email:      p.email?.[0]?.value ?? undefined,
            phone:      p.phone?.[0]?.value ?? undefined,
        }));
    }

    async pushDeal(apiToken: string, deal: CrmDeal): Promise<SyncResult> {
        const body: Record<string, any> = { title: deal.name };
        if (deal.amount) body.value = deal.amount;

        const existingId = deal.externalId || null;
        let res: Response;
        let operation: string;

        if (existingId) {
            res       = await fetch(this.url(`/deals/${existingId}`, apiToken), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            operation = 'UPDATE';
        } else {
            res       = await fetch(this.url('/deals', apiToken), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            operation = 'CREATE';
        }

        if (!res.ok) {
            return { entityType: 'DEAL', entityId: existingId ?? undefined, operation, direction: 'PUSH', status: 'FAILED', errorMessage: await res.text() };
        }
        const data = await res.json();
        return { entityType: 'DEAL', entityId: String(data.data?.id ?? ''), operation, direction: 'PUSH', status: 'SUCCESS' };
    }

    async pullDeals(apiToken: string, _since?: Date): Promise<CrmDeal[]> {
        const res = await fetch(this.url('/deals', apiToken) + '&limit=100&sort=update_time+DESC');
        if (!res.ok) return [];
        const data = await res.json();
        return (data.data ?? []).map((d: any) => ({
            externalId: String(d.id),
            name:       d.title ?? '',
            stage:      d.stage_id ? String(d.stage_id) : undefined,
            amount:     d.value   ? Number(d.value)     : undefined,
        }));
    }
}

export const pipedriveProvider = new PipedriveProvider();
