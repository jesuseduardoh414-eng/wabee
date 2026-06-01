import { apiClient } from './client';

export type CrmProvider = 'HUBSPOT' | 'SALESFORCE' | 'PIPEDRIVE' | 'ZOHO' | 'DYNAMICS365';
export type CrmIntegrationStatus = 'DISCONNECTED' | 'CONNECTED' | 'ERROR' | 'EXPIRED';
export type SyncDirection = 'PUSH' | 'PULL' | 'BIDIRECTIONAL';
export type CrmSyncStatus = 'SUCCESS' | 'FAILED' | 'PENDING' | 'SKIPPED';

export interface ExternalIntegration {
    id: string;
    provider: CrmProvider;
    name: string;
    status: CrmIntegrationStatus;
    createdAt: string;
    updatedAt: string;
    _count?: { syncLogs: number };
    accounts?: { id: string; tokenExpiresAt: string | null; updatedAt: string }[];
}

export interface FieldMapping {
    id: string;
    entityType: string;
    wabeeField: string;
    externalField: string;
    direction: SyncDirection;
}

export interface CrmSyncLog {
    id: string;
    entityType: string;
    entityId: string | null;
    operation: string;
    direction: SyncDirection;
    status: CrmSyncStatus;
    errorMessage: string | null;
    createdAt: string;
}

const BASE = '/integrations';

export const integrationsApi = {
    list: () => apiClient<ExternalIntegration[]>(BASE),

    get: (id: string) => apiClient<ExternalIntegration & { fieldMappings: FieldMapping[] }>(`${BASE}/${id}`),

    create: (data: { provider: CrmProvider; name: string }) =>
        apiClient<ExternalIntegration>(BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        }),

    delete: (id: string) => apiClient<void>(`${BASE}/${id}`, { method: 'DELETE' }),

    upsertMappings: (id: string, mappings: Omit<FieldMapping, 'id'>[]) =>
        apiClient<FieldMapping[]>(`${BASE}/${id}/field-mappings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mappings }),
        }),

    getSyncLogs: (id: string, limit = 50) =>
        apiClient<CrmSyncLog[]>(`${BASE}/${id}/sync-logs?limit=${limit}`),
};
