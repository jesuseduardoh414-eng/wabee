import { apiClient } from './client';

export interface Campaign {
    id: string;
    tenantId: string;
    name: string;
    status: 'DRAFT' | 'SCHEDULED' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED' | 'CANCELED';
    audienceType: 'SEGMENT' | 'GROUP' | 'TAGS' | 'ALL_ACTIVE';
    audienceFilter: any;
    channelId: string;
    templateId: string;
    scheduledAt?: string;
    startedAt?: string;
    completedAt?: string;
    pauseReason?: string;
    sentCount: number;
    deliveredCount: number;
    readCount: number;
    failedCount: number;
    estimatedRecipients: number;
    audienceSnapshotPath?: string;
    audienceSnapshotHash?: string;
    templateInputMapping?: Record<string, {
        mode: 'fixed' | 'contact_field';
        value: string;
        fallback?: string;
    }> | null;
    createdAt: string;
    updatedAt: string;
    channel?: {
        name: string;
        displayPhone: string;
    };
    template?: {
        name: string;
        language: string;
    };
}

export interface CampaignMetric {
    variant: 'A' | 'B';
    status: string;
    _count: {
        _all: number;
    };
}

export interface CampaignAnalyticsSummary {
    campaignInfo: {
        id: string;
        name: string;
        status: string;
        channelName: string;
        channelPhone: string;
        templateName: string;
        startedAt?: string;
        completedAt?: string;
    };
    coreMetrics: {
        sent: number;
        delivered: number;
        read: number;
        failed: number;
        deliveryRate: number;
        readRate: number;
    };
    conversationalImpact: {
        threadsGenerated: number;
        responded: number;
        responseRate: number;
        conversationRate: number;
        aiHandled: number;
        humanHandled: number;
        takeovers: number;
        aiToHumanRate: number;
    };
    commercialImpact: {
        leadsGenerated: number;
        dealsGenerated: number;
        revenueAttributed: number;
        leadConversionRate: number;
        dealConversionRate: number;
        revenuePerCampaign: number;
    };
}

export interface CampaignAnalyticsTimeSeries {
    timestamp: string;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    responded: number;
}

export interface CampaignAnalyticsFunnel {
    label: string;
    value: number;
}

export interface CampaignAnalyticsError {
    error_type: string;
    count: number;
    percentage: number;
}

export interface CampaignAnalyticsRecipient {
    id: string;
    contact_name: string;
    phone: string;
    status: string;
    error_message?: string;
    updatedAt: string;
    threadId?: string;
}

export interface CampaignAnalyticsRecipientsResponse {
    items: CampaignAnalyticsRecipient[];
    total: number;
    page: number;
    limit: number;
}

export const getCampaigns = async (): Promise<Campaign[]> => {
    return apiClient<Campaign[]>('/wabee/campaigns');
};

export const getCampaignById = async (id: string): Promise<Campaign> => {
    return apiClient<Campaign>(`/wabee/campaigns/${id}`);
};

export const createCampaign = async (data: any): Promise<Campaign> => {
    return apiClient<Campaign>('/wabee/campaigns', {
        method: 'POST',
        body: JSON.stringify(data)
    });
};

export const updateCampaign = async (id: string, data: any): Promise<Campaign> => {
    return apiClient<Campaign>(`/wabee/campaigns/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
    });
};

export const operateCampaign = async (id: string, action: 'START' | 'PAUSE' | 'RESUME' | 'CANCEL', pauseReason?: string): Promise<any> => {
    return apiClient<any>(`/wabee/campaigns/${id}/operate`, {
        method: 'POST',
        body: JSON.stringify({ action, pauseReason })
    });
};

export const getCampaignErrors = async (id: string): Promise<any[]> => {
    return apiClient<any[]>(`/wabee/campaigns/${id}/errors`);
};

export const getCampaignMetrics = async (id: string): Promise<CampaignMetric[]> => {
    return apiClient<CampaignMetric[]>(`/wabee/campaigns/${id}/metrics`);
};

export const deleteCampaign = async (id: string): Promise<any> => {
    return apiClient<any>(`/wabee/campaigns/${id}`, {
        method: 'DELETE'
    });
};

// ── Analytics ─────────────────────────────────────────────────────────────

export const getCampaignAnalyticsSummary = async (id: string): Promise<CampaignAnalyticsSummary> => {
    return apiClient<CampaignAnalyticsSummary>(`/wabee/campaigns/${id}/analytics/summary`);
};

export const getCampaignAnalyticsTimeSeries = async (id: string, period = 'all'): Promise<CampaignAnalyticsTimeSeries[]> => {
    return apiClient<CampaignAnalyticsTimeSeries[]>(`/wabee/campaigns/${id}/analytics/timeseries?period=${period}`);
};

export const getCampaignAnalyticsFunnel = async (id: string): Promise<CampaignAnalyticsFunnel[]> => {
    return apiClient<CampaignAnalyticsFunnel[]>(`/wabee/campaigns/${id}/analytics/funnel`);
};

export const getCampaignAnalyticsErrors = async (id: string): Promise<CampaignAnalyticsError[]> => {
    return apiClient<CampaignAnalyticsError[]>(`/wabee/campaigns/${id}/analytics/errors`);
};

export const getCampaignAnalyticsRecipients = async (id: string, page = 1, limit = 50): Promise<CampaignAnalyticsRecipientsResponse> => {
    return apiClient<CampaignAnalyticsRecipientsResponse>(`/wabee/campaigns/${id}/analytics/recipients?page=${page}&limit=${limit}`);
};

export const uploadCampaignMedia = async (file: File): Promise<{ success: boolean; id: string, mimeType: string, path: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    // apiClient by default sets Content-Type to application/json if we pass body as string
    // but for FormData, we should let the browser set it automatically with boundary.
    const tenantId = localStorage.getItem('wabee_orgId') || localStorage.getItem('tenant_key');

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/v1';

    const res = await fetch(`${API_URL}/core/media/upload`, {
        method: 'POST',
        credentials: 'include',
        headers: {
            'x-tenant-id': tenantId ?? ''
        },
        body: formData
    });

    if (!res.ok) {
        let errorMsg = `HTTP Error ${res.status}`;
        try {
            const errorData = await res.json();
            if (errorData.message) errorMsg = errorData.message;
        } catch (e) {
            // failed to parse json
        }
        throw new Error(errorMsg);
    }

    return res.json();
};
