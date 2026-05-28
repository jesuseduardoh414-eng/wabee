import { apiClient } from './client';

export interface Template {
    id: string;
    name: string;
    language: string;
    category: string;
    status: string;
    components: any[];
    createdAt: string;
    updatedAt: string;
}

export interface TemplatesResponse {
    items: Template[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

export const templatesApi = {
    listTemplates: (channelId: string, filters: any = {}) => {
        const params = new URLSearchParams();
        if (filters.status) params.append('status', filters.status);
        if (filters.language) params.append('language', filters.language);
        if (filters.category) params.append('category', filters.category);
        if (filters.q) params.append('q', filters.q);

        return apiClient<TemplatesResponse>(`/channels/${channelId}/templates?${params.toString()}`);
    },

    importTemplates: (channelId: string) =>
        apiClient<{ imported: number; updated: number; skipped: number }>(
            `/channels/${channelId}/templates/import`,
            { method: 'POST' }
        )
};
