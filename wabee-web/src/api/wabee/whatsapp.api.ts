import { apiClient } from './client';

export interface Channel {
    id: string;
    name: string;
    phoneNumberId: string;
    displayPhone?: string;
    status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'SUSPENDED' | 'ARCHIVED';
    healthStatus?: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';
    lastHealthCheckAt?: string;
    lastErrorMessage?: string;
    webhookStatus?: 'VERIFIED' | 'FAILED' | 'PENDING';
    purpose?: 'SALES' | 'SUPPORT' | 'GENERAL';
    wabaId?: string;
    onboardingMode?: 'STANDARD' | 'COEXISTENCE';
    createdAt?: string;
}

export interface ConnectChannelData {
    name: string;
    wabaId: string;
    phoneNumberId: string;
    displayPhone?: string;
    verifiedName?: string;
    purpose?: 'SALES' | 'SUPPORT' | 'GENERAL';
}

export const getChannels = async (params?: { status?: string }): Promise<Channel[]> => {
    let url = '/channels';
    if (params?.status) {
        url += `?status=${params.status}`;
    }
    return apiClient<Channel[]>(url);
};

export const createChannel = async (data: any): Promise<Channel> => {
    return apiClient<Channel>('/channels', {
        method: 'POST',
        body: JSON.stringify(data)
    });
};

export const connectChannel = createChannel; // Alias for createChannel

export interface EmbeddedSignupPayload {
    code: string;
    wabaId: string;
    phoneNumberId: string;
    onboardingMode: 'STANDARD' | 'COEXISTENCE';
    name?: string;
}

export const embeddedSignupExchange = async (data: EmbeddedSignupPayload): Promise<Channel> => {
    return apiClient<Channel>('/channels/embedded-signup', {
        method: 'POST',
        body: JSON.stringify(data),
    });
};

export const getChannelHealth = async (id: string): Promise<any> => {
    return apiClient<any>(`/channels/${id}/health`);
};

export interface DiscoveredAsset {
    wabaId: string;
    wabaName: string;
    phoneNumberId: string;
    displayPhoneNumber: string;
    verifiedName: string;
    status: string;
    metaBusinessId?: string;
}

export interface DiscoveryResponse {
    assets: DiscoveredAsset[];
}

export const discoverAssets = async (): Promise<DiscoveryResponse> => {
    return apiClient<DiscoveryResponse>('/channels/detect', {
        method: 'POST'
    });
};

export const archiveChannel = async (id: string): Promise<void> => {
    return apiClient<void>(`/channels/${id}`, {
        method: 'DELETE'
    });
};

export interface SendBulkParams {
    channelId: string;
    contactIds: string[];
    text?: string;
    template?: any;
}

export const sendMessageBulk = async (params: SendBulkParams): Promise<any> => {
    return apiClient<any>('/whatsapp/send', {
        method: 'POST',
        body: JSON.stringify(params)
    });
};

// --- AI Configuration ---

export interface ChannelAiConfig {
    aiEnabled: boolean;
    defaultAiProfileId: string | null;
    humanHandoffEnabled: boolean;
    humanHandoffRole: string | null;
    humanTeamRef: string | null;
    fallbackMessage: string | null;
    aiMode: 'autonomous' | 'copilot_only' | 'disabled';
    defaultAiProfileName?: string | null;
}

export const getChannelAiConfig = async (channelId: string): Promise<ChannelAiConfig> => {
    return apiClient<ChannelAiConfig>(`/channels/${channelId}/ai-config`);
};

export const updateChannelAiConfig = async (channelId: string, data: Partial<ChannelAiConfig>): Promise<ChannelAiConfig> => {
    return apiClient<ChannelAiConfig>(`/channels/${channelId}/ai-config`, {
        method: 'PATCH',
        body: JSON.stringify(data)
    });
};
