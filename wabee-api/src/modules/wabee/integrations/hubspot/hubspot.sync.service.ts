import { prisma } from '@/lib/prisma';
import { integrationsService } from '../integrations.service';
import { hubSpotProvider } from './hubspot.provider';
import { hubSpotRetryQueue } from './hubspot.retry.queue';
import { encrypt, decrypt } from '../../channels/whatsapp/token.crypto';
import { CrmContact } from '../crm.provider.interface';

class HubSpotSyncService {

    // ── Token management ──────────────────────────────────────────────────────

    private async getValidToken(integrationId: string, tenantId: string): Promise<string | null> {
        const account = await integrationsService.getAccount(integrationId, tenantId);
        if (!account) return null;

        let accessToken: string;
        try {
            accessToken = decrypt(JSON.parse(account.accessToken));
        } catch {
            console.error('[HubSpot] No se pudo descifrar el access token para integration', integrationId);
            return null;
        }

        // Refresh 5 min before expiry
        const needsRefresh = account.tokenExpiresAt &&
            account.tokenExpiresAt.getTime() < Date.now() + 5 * 60 * 1000;

        if (needsRefresh && account.refreshToken) {
            try {
                const refreshToken = decrypt(JSON.parse(account.refreshToken));
                const refreshed = await hubSpotProvider.refreshAccessToken(refreshToken);

                const encAccess   = JSON.stringify(encrypt(refreshed.accessToken));
                await integrationsService.saveAccount({
                    integrationId,
                    tenantId,
                    accessToken:    encAccess,
                    refreshToken:   account.refreshToken, // encrypted refresh unchanged
                    tokenExpiresAt: refreshed.expiresAt,
                    scopes:         account.scopes,
                    meta:           account.meta as Record<string, any> | undefined,
                });
                return refreshed.accessToken;
            } catch (err) {
                console.error('[HubSpot] Fallo al refrescar token:', (err as Error).message);
                await integrationsService.markConnected(integrationId, 'EXPIRED');
                return null;
            }
        }

        return accessToken;
    }

    private async findConnectedIntegration(tenantId: string) {
        return prisma.externalIntegration.findFirst({
            where: { tenantId, provider: 'HUBSPOT', status: 'CONNECTED' },
        });
    }

    // ── Contact push (Wabee → HubSpot) ───────────────────────────────────────

    /**
     * Called after a contact transitions to LEAD or CUSTOMER.
     * Non-blocking — the actual push is queued with retry logic.
     */
    async onContactLifecycleChange(contactId: string, tenantId: string, newLifecycle: string) {
        if (newLifecycle !== 'LEAD' && newLifecycle !== 'CUSTOMER') return;

        const integration = await this.findConnectedIntegration(tenantId);
        if (!integration) return;

        const contact = await prisma.contact.findUnique({
            where: { id: contactId },
            select: { id: true, phone: true, name: true, email: true, externalCrmId: true },
        });
        if (!contact) return;

        const nameParts = contact.name?.split(' ') ?? [];
        const crmContact: CrmContact = {
            externalId:    contact.externalCrmId ?? '',
            firstName:     nameParts[0],
            lastName:      nameParts.slice(1).join(' ') || undefined,
            email:         contact.email ?? undefined,
            phone:         contact.phone,
            lifecycleStage: newLifecycle,
        };

        const integrationId = integration.id;
        hubSpotRetryQueue.enqueue(`contact-push-${contactId}`, async () => {
            const token = await this.getValidToken(integrationId, tenantId);
            if (!token) throw new Error('Token no disponible');

            const result = await hubSpotProvider.pushContact(token, crmContact);
            await integrationsService.writeSyncLog(integrationId, tenantId, result);

            // Persist HubSpot ID back to Wabee if newly created
            if (result.status === 'SUCCESS' && result.entityId && !contact.externalCrmId) {
                await prisma.contact.update({
                    where: { id: contactId },
                    data: { externalCrmId: result.entityId, sourceSystem: 'HUBSPOT' },
                });
            }
        });
    }

    // ── Deal stage webhook (HubSpot → Wabee) ─────────────────────────────────

    async processDealWebhook(tenantId: string, deal: {
        dealId:    string;
        dealName:  string;
        stage:     string;
        amount?:   number;
        contactId?: string;
    }) {
        const integration = await this.findConnectedIntegration(tenantId);
        if (!integration) return;

        await prisma.analyticsCrmEvent.create({
            data: {
                tenantId,
                type:      'DEAL_STAGE_CHANGED',
                provider:  'HUBSPOT',
                externalId: deal.dealId,
                value:     deal.amount,
                meta: {
                    stage:     deal.stage,
                    dealName:  deal.dealName,
                    contactId: deal.contactId,
                },
            },
        });

        await integrationsService.writeSyncLog(integration.id, tenantId, {
            entityType: 'DEAL',
            entityId:   deal.dealId,
            operation:  'STAGE_CHANGED',
            direction:  'PULL',
            status:     'SUCCESS',
            meta:       { stage: deal.stage },
        });
    }
}

export const hubSpotSyncService = new HubSpotSyncService();
