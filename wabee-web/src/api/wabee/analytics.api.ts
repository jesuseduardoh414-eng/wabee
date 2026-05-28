import client from '../client';

export interface AnalyticsSummary {
    inbound_total: number;
    outbound_human: number;
    outbound_ai: number;
    outbound_flow: number;
    threads_created: number;
    threads_closed: number;
    escalations: number;
    avg_resolution_time: number;
    automation_rate: number;
    fcr_rate: number;
}

export interface TimeSeriesPoint {
    date: string;
    value: number;
}

export interface CampaignTimeSeriesPoint {
    date: string;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    sentA: number;
    sentB: number;
    readA: number;
    readB: number;
}

export const analyticsApi = {
    getOverview: async (params: { from: string; to: string; channel?: string }) => {
        const { data } = await client.get('/wabee/analytics/overview', { params });
        return data;
    },

    getTimeSeries: async (params: { metric: string; from: string; to: string; channel?: string }) => {
        const { data } = await client.get('/wabee/analytics/timeseries', { params });
        return data.series as TimeSeriesPoint[];
    },

    getCampaignTimeSeries: async (params: { from: string; to: string; channelId?: string; campaignId?: string }) => {
        const { data } = await client.get('/wabee/analytics/campaigns/timeseries', { params });
        return data.series as CampaignTimeSeriesPoint[];
    },

    getRecentActivity: async (limit: number = 10) => {
        const { data } = await client.get('/wabee/analytics/activity', { params: { limit } });
        return data;
    },

    exportData: async (payload: { type: string; from: string; to: string }) => {
        const { data } = await client.post('/wabee/analytics/export', payload);
        return data;
    }
};
