import { prisma } from '@/lib/prisma';
import { integrationsService } from './integrations.service';
import { getProvider } from './provider.registry';
import { decrypt } from '../channels/whatsapp/token.crypto';
import { CrmContact } from './crm.provider.interface';
import { hubSpotRetryQueue } from './hubspot/hubspot.retry.queue';

class CrmSyncService {

    // ── Token helpers ─────────────────────────────────────────────────────────

    private async getValidToken(integrationId: string, tenantId: string, providerName: string): Promise<string | null> {
        const account = await integrationsService.getAccount(integrationId, tenantId);
        if (!account) return null;

        let accessToken: string;
        try {
            accessToken = decrypt(JSON.parse(account.accessToken));
        } catch {
            return null;
        }

        // Refresh if expiring soon (only for OAuth-based providers)
        const needsRefresh = account.tokenExpiresAt &&
            account.tokenExpiresAt.getTime() < Date.now() + 5 * 60 * 1000;

        if (needsRefresh && account.refreshToken) {
            const provider = getProvider(providerName);
            if (!provider) return null;
            try {
                const refreshToken = decrypt(JSON.parse(account.refreshToken));
                const refreshed    = await provider.refreshAccessToken(refreshToken);
                const { encrypt }  = await import('../channels/whatsapp/token.crypto');
                const encAccess    = JSON.stringify(encrypt(refreshed.accessToken));
                await integrationsService.saveAccount({
                    integrationId,
                    tenantId,
                    accessToken:    encAccess,
                    refreshToken:   account.refreshToken,
                    tokenExpiresAt: refreshed.expiresAt,
                    scopes:         account.scopes,
                    meta:           account.meta as Record<string, any> | undefined,
                });
                return refreshed.accessToken;
            } catch (err) {
                console.error(`[CRM Sync] Token refresh failed for ${providerName}:`, (err as Error).message);
                await integrationsService.markConnected(integrationId, 'EXPIRED');
                return null;
            }
        }

        return accessToken;
    }

    // ── Contact lifecycle hook ─────────────────────────────────────────────────

    /**
     * Called after a contact transitions to LEAD or CUSTOMER.
     * Pushes to ALL connected CRM integrations for the tenant.
     */
    async onContactLifecycleChange(contactId: string, tenantId: string, newLifecycle: string) {
        if (newLifecycle !== 'LEAD' && newLifecycle !== 'CUSTOMER') return;

        const integrations = await prisma.externalIntegration.findMany({
            where: { tenantId, status: 'CONNECTED' },
        });
        if (!integrations.length) return;

        const contact = await prisma.contact.findUnique({
            where: { id: contactId },
            select: { id: true, phone: true, name: true, email: true, externalCrmId: true },
        });
        if (!contact) return;

        const nameParts  = contact.name?.split(' ') ?? [];
        const crmContact: CrmContact = {
            externalId:     contact.externalCrmId ?? '',
            firstName:      nameParts[0],
            lastName:       nameParts.slice(1).join(' ') || undefined,
            email:          contact.email ?? undefined,
            phone:          contact.phone,
            lifecycleStage: newLifecycle,
        };

        for (const integration of integrations) {
            const provider = getProvider(integration.provider);
            if (!provider) continue;

            const integrationId = integration.id;
            hubSpotRetryQueue.enqueue(`contact-push-${contactId}-${integrationId}`, async () => {
                const token = await this.getValidToken(integrationId, tenantId, integration.provider);
                if (!token) throw new Error('Token no disponible');

                const result = await provider.pushContact(token, crmContact);
                await integrationsService.writeSyncLog(integrationId, tenantId, {
                    ...result,
                    meta: {
                        phone:          contact.phone,
                        name:           contact.name ?? undefined,
                        email:          contact.email ?? undefined,
                        lifecycleStage: newLifecycle,
                    },
                });

                if (result.status === 'SUCCESS' && result.entityId && !contact.externalCrmId) {
                    await prisma.contact.update({
                        where: { id: contactId },
                        data: { externalCrmId: result.entityId, sourceSystem: integration.provider },
                    });
                }
            });
        }
    }

    // ── Deal webhook ──────────────────────────────────────────────────────────

    async processDealEvent(tenantId: string, integrationId: string, deal: {
        dealId:    string;
        dealName:  string;
        stage:     string;
        amount?:   number;
        contactId?: string;
        provider:  string;
    }) {
        await prisma.analyticsCrmEvent.create({
            data: {
                tenantId,
                type:      'DEAL_STAGE_CHANGED',
                provider:  deal.provider,
                externalId: deal.dealId,
                value:     deal.amount,
                meta: { stage: deal.stage, dealName: deal.dealName, contactId: deal.contactId },
            },
        });

        await integrationsService.writeSyncLog(integrationId, tenantId, {
            entityType: 'DEAL',
            entityId:   deal.dealId,
            operation:  'STAGE_CHANGED',
            direction:  'PULL',
            status:     'SUCCESS',
            meta:       { stage: deal.stage, dealName: deal.dealName },
        });
    }
}

export const crmSyncService = new CrmSyncService();
