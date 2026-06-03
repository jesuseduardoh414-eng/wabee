import { Request, Response } from 'express';
import crypto from 'crypto';
import { env } from '@/config/env';
import { prisma } from '@/lib/prisma';
import { hubSpotSyncService } from './hubspot.sync.service';

/** Validates HubSpot v1 webhook signature: HMAC-SHA256(clientSecret + rawBody) */
function isValidSignature(req: Request): boolean {
    const signature = req.headers['x-hubspot-signature'] as string | undefined;
    if (!signature || !env.HUBSPOT_CLIENT_SECRET) return false;

    const rawBody = (req as any).rawBody?.toString('utf8') ?? JSON.stringify(req.body);
    const expected = crypto
        .createHmac('sha256', env.HUBSPOT_CLIENT_SECRET)
        .update(rawBody)
        .digest('hex');

    try {
        return crypto.timingSafeEqual(
            Buffer.from(signature,  'hex'),
            Buffer.from(expected, 'hex'),
        );
    } catch {
        return false;
    }
}

/** Finds the tenant whose HubSpot account has the given portalId in its meta. */
async function findTenantByPortalId(portalId: string): Promise<string | null> {
    // IntegrationAccount.meta stores { portalId: "..." }
    const account = await prisma.integrationAccount.findFirst({
        where: {
            meta: { path: ['portalId'], equals: portalId },
        },
        include: { integration: { select: { tenantId: true, status: true } } },
    });
    if (!account || account.integration.status !== 'CONNECTED') return null;
    return account.integration.tenantId;
}

export async function handleHubSpotWebhook(req: Request, res: Response) {
    if (!isValidSignature(req)) {
        return res.status(401).json({ error: 'Invalid signature' });
    }

    // Acknowledge immediately — HubSpot expects < 5s response
    res.status(200).json({ received: true });

    const events: any[] = Array.isArray(req.body) ? req.body : [req.body];

    for (const event of events) {
        try {
            const portalId = String(event.portalId);
            const tenantId = await findTenantByPortalId(portalId);
            if (!tenantId) {
                console.warn(`[HubSpot Webhook] No se encontró tenant para portalId ${portalId}`);
                continue;
            }

            // Deal stage change
            if (
                event.subscriptionType === 'deal.propertyChange' &&
                event.propertyName      === 'dealstage'
            ) {
                await hubSpotSyncService.processDealWebhook(tenantId, {
                    dealId:   String(event.objectId),
                    dealName: String(event.propertyValue ?? ''),
                    stage:    String(event.propertyValue ?? ''),
                });
            }
        } catch (err) {
            console.error('[HubSpot Webhook] Error procesando evento:', (err as Error).message, event);
        }
    }
}
