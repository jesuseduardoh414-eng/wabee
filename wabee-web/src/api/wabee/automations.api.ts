import { apiClient } from './client';

export type AutomationTrigger =
    | 'CONVERSATION_STARTED'
    | 'KEYWORD_MATCH'
    | 'CONTACT_CREATED'
    | 'CONTACT_LIFECYCLE_CHANGED'
    | 'CAMPAIGN_REPLY'
    | 'INBOUND_MESSAGE';

export type AutomationFlowStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';

export interface AutomationFlowVersion {
    id: string;
    version: number;
    stepsJson: object;
    isActive: boolean;
    publishedAt: string | null;
    createdAt: string;
}

export interface AutomationFlow {
    id: string;
    name: string;
    description: string | null;
    trigger: AutomationTrigger;
    status: AutomationFlowStatus;
    createdAt: string;
    updatedAt: string;
    versions?: AutomationFlowVersion[];
    _count?: { versions: number };
}

const BASE = '/automations';

export const automationsApi = {
    list: () => apiClient<AutomationFlow[]>(BASE),

    get: (id: string) => apiClient<AutomationFlow>(`${BASE}/${id}`),

    create: (data: { name: string; description?: string; trigger: AutomationTrigger }) =>
        apiClient<AutomationFlow>(BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        }),

    update: (id: string, data: { name?: string; description?: string; trigger?: AutomationTrigger }) =>
        apiClient<AutomationFlow>(`${BASE}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        }),

    delete: (id: string) => apiClient<void>(`${BASE}/${id}`, { method: 'DELETE' }),

    publish: (id: string, stepsJson: object) =>
        apiClient<AutomationFlowVersion>(`${BASE}/${id}/publish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stepsJson }),
        }),

    activate: (id: string) => apiClient<AutomationFlow>(`${BASE}/${id}/activate`, { method: 'POST' }),

    pause: (id: string) => apiClient<AutomationFlow>(`${BASE}/${id}/pause`, { method: 'POST' }),
};
