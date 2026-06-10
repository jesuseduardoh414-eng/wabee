import { prisma } from '@/lib/prisma';
import { CrmProvider, CrmIntegrationStatus, SyncDirection, CrmSyncStatus } from '@prisma/client';
import { SyncResult } from './crm.provider.interface';

export class IntegrationsService {

    // ── CRUD de integraciones ─────────────────────────────────────────────────

    async listIntegrations(tenantId: string) {
        return prisma.externalIntegration.findMany({
            where: { tenantId },
            include: {
                _count: { select: { syncLogs: true } },
                accounts: { select: { id: true, tokenExpiresAt: true, updatedAt: true }, take: 1 },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getIntegration(tenantId: string, integrationId: string) {
        const integration = await prisma.externalIntegration.findFirst({
            where: { id: integrationId, tenantId },
            include: {
                accounts: { select: { id: true, tokenExpiresAt: true, scopes: true, updatedAt: true } },
                fieldMappings: { orderBy: { entityType: 'asc' } },
            },
        });
        if (!integration) throw { status: 404, message: 'Integration not found' };
        return integration;
    }

    async createIntegration(tenantId: string, provider: CrmProvider, name: string) {
        const existing = await prisma.externalIntegration.findFirst({
            where: { tenantId, provider },
        });
        if (existing) throw { status: 409, message: `A ${provider} integration already exists for this tenant` };

        return prisma.externalIntegration.create({
            data: { tenantId, provider, name, status: 'DISCONNECTED' },
        });
    }

    async deleteIntegration(tenantId: string, integrationId: string) {
        const integration = await prisma.externalIntegration.findFirst({
            where: { id: integrationId, tenantId },
        });
        if (!integration) throw { status: 404, message: 'Integration not found' };

        await prisma.externalIntegration.delete({ where: { id: integrationId } });
        return { message: 'Integration deleted successfully' };
    }

    // ── Tokens (OAuth callback) ───────────────────────────────────────────────

    async saveAccount(params: {
        integrationId: string;
        tenantId: string;
        accessToken: string;
        refreshToken?: string;
        tokenExpiresAt?: Date;
        scopes: string[];
        meta?: Record<string, any>;
    }) {
        const { integrationId, tenantId, ...data } = params;

        // Upsert — only one account per integration
        const existing = await prisma.integrationAccount.findFirst({
            where: { integrationId, tenantId },
        });

        if (existing) {
            return prisma.integrationAccount.update({
                where: { id: existing.id },
                data: { ...data },
            });
        }

        return prisma.integrationAccount.create({
            data: { integrationId, tenantId, ...data },
        });
    }

    async getAccount(integrationId: string, tenantId: string) {
        return prisma.integrationAccount.findFirst({
            where: { integrationId, tenantId },
        });
    }

    async markConnected(integrationId: string, status: CrmIntegrationStatus = 'CONNECTED') {
        await prisma.externalIntegration.update({
            where: { id: integrationId },
            data: { status },
        });
    }

    // ── Field mappings ────────────────────────────────────────────────────────

    async upsertFieldMappings(
        tenantId: string,
        integrationId: string,
        mappings: { entityType: string; wabeeField: string; externalField: string; direction: SyncDirection }[]
    ) {
        await prisma.externalIntegration.findFirstOrThrow({
            where: { id: integrationId, tenantId },
        });

        await Promise.all(mappings.map(m =>
            prisma.fieldMapping.upsert({
                where: {
                    integrationId_entityType_wabeeField: {
                        integrationId,
                        entityType: m.entityType,
                        wabeeField: m.wabeeField,
                    },
                },
                update: { externalField: m.externalField, direction: m.direction },
                create: { integrationId, tenantId, ...m },
            })
        ));

        return prisma.fieldMapping.findMany({ where: { integrationId } });
    }

    // ── Manual pull sync ─────────────────────────────────────────────────────

    async pullContactsFromCrm(tenantId: string, integrationId: string) {
        const { getProvider } = await import('./provider.registry');
        const { decrypt } = await import('../channels/whatsapp/token.crypto');

        const integration = await prisma.externalIntegration.findFirst({
            where: { id: integrationId, tenantId, status: 'CONNECTED' },
        });
        if (!integration) throw { status: 404, message: 'Integración no encontrada o no conectada' };

        const account = await this.getAccount(integrationId, tenantId);
        if (!account) throw { status: 400, message: 'Sin credenciales guardadas para esta integración' };

        let accessToken: string;
        try {
            accessToken = decrypt(JSON.parse(account.accessToken));
        } catch {
            throw { status: 500, message: 'Error al descifrar el token de acceso' };
        }

        const provider = getProvider(integration.provider);
        if (!provider) throw { status: 400, message: `Proveedor ${integration.provider} no disponible` };

        const contacts = await provider.pullContacts(accessToken);

        let imported = 0;
        let updated = 0;
        let skipped = 0;

        for (const c of contacts) {
            if (!c.phone && !c.email) { skipped++; continue; }

            try {
                const phone = c.phone ?? null;
                const existing = phone
                    ? await prisma.contact.findFirst({ where: { tenantId, phone } })
                    : await prisma.contact.findFirst({ where: { tenantId, email: c.email! } });

                const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || null;

                if (existing) {
                    await prisma.contact.update({
                        where: { id: existing.id },
                        data: {
                            name:           name ?? existing.name,
                            email:          c.email ?? existing.email,
                            externalCrmId:  c.externalId || existing.externalCrmId,
                            sourceSystem:   integration.provider,
                        },
                    });
                    updated++;
                } else {
                    await prisma.contact.create({
                        data: {
                            tenantId,
                            phone:          phone ?? `crm-${c.externalId}`,
                            name,
                            email:          c.email ?? null,
                            externalCrmId:  c.externalId || null,
                            sourceSystem:   integration.provider,
                            lifecycleStatus: 'LEAD',
                            status:         'ACTIVE',
                            tags:           [],
                        },
                    });
                    imported++;
                }

                await this.writeSyncLog(integrationId, tenantId, {
                    entityType: 'CONTACT',
                    entityId:   c.externalId || undefined,
                    operation:  existing ? 'UPDATE' : 'CREATE',
                    direction:  'PULL',
                    status:     'SUCCESS',
                    meta:       { name, phone, email: c.email },
                });
            } catch (e) {
                skipped++;
                await this.writeSyncLog(integrationId, tenantId, {
                    entityType:   'CONTACT',
                    entityId:     c.externalId || undefined,
                    operation:    'CREATE',
                    direction:    'PULL',
                    status:       'FAILED',
                    errorMessage: (e as Error).message,
                });
            }
        }

        return { imported, updated, skipped, total: contacts.length };
    }

    // ── Sync logs ─────────────────────────────────────────────────────────────

    async writeSyncLog(integrationId: string, tenantId: string, result: SyncResult) {
        return prisma.crmSyncLog.create({
            data: {
                integrationId,
                tenantId,
                entityType: result.entityType,
                entityId: result.entityId ?? null,
                operation: result.operation,
                direction: result.direction,
                status: result.status,
                errorMessage: result.errorMessage ?? null,
                meta: result.meta ?? undefined,
            },
        });
    }

    async listSyncLogs(tenantId: string, integrationId: string, limit = 50) {
        return prisma.crmSyncLog.findMany({
            where: { integrationId, tenantId },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
    }
}

export const integrationsService = new IntegrationsService();
