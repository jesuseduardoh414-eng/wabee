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
