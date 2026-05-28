import { apiClient } from './client';

export interface DashboardSummary {
    revenueAttributed: number;
    leadsGenerated: number;
    totalConversations: number;
    automationRate: number;
    avgFirstResponseTime: number;
    avgFirstHumanResponseTime: number;
    conversationRate: number;
    leadConversionRate: number;
    dealConversionRate: number;
}

export interface OperationalHealth {
    channels: Array<{
        id: string;
        name: string;
        healthStatus: string;
    }>;
    activeCampaigns: number;
    crmErrors: number;
}

export interface AiVsHumanStats {
    aiHandled: number;
    humanHandled: number;
    takeovers: number;
    aiToHumanRate: number;
}

export interface TopCampaign {
    id: string;
    name: string;
    sent: number;
    delivered: number;
    read: number;
    responded: number;
    revenueAttributed: number;
    responseRate: number;
}

export interface AgentPerformance {
    agentId: string;
    chatsHandled: number;
    messagesSent: number;
    chatsClosed: number;
    avgResponseTime: number;
}

export interface InboxStatus {
    open: number;
    pending: number;
    closed: number;
    human_queue: number;
    assigned: number;
    unassigned: number;
}

export interface DashboardTimeSeries {
    timestamp: string;
    conversations: number;
    leads: number;
    revenue: number;
}

export const getDashboardSummary = (from?: string, to?: string) => 
    apiClient<DashboardSummary>(`/wabee/dashboard/summary?from=${from || ''}&to=${to || ''}`);

export const getDashboardHealth = () => 
    apiClient<OperationalHealth>(`/wabee/dashboard/health`);

export const getDashboardAiVsHuman = (from?: string, to?: string) => 
    apiClient<AiVsHumanStats>(`/wabee/dashboard/ai-vs-human?from=${from || ''}&to=${to || ''}`);

export const getDashboardTopCampaigns = (from?: string, to?: string) => 
    apiClient<TopCampaign[]>(`/wabee/dashboard/top-campaigns?from=${from || ''}&to=${to || ''}`);

export const getDashboardAgentsPerformance = (from?: string, to?: string) => 
    apiClient<AgentPerformance[]>(`/wabee/dashboard/agents-performance?from=${from || ''}&to=${to || ''}`);

export const getDashboardInboxStatus = () => 
    apiClient<InboxStatus>(`/wabee/dashboard/inbox-status`);

export const getDashboardTimeSeries = (from?: string, to?: string) => 
    apiClient<DashboardTimeSeries[]>(`/wabee/dashboard/timeseries?from=${from || ''}&to=${to || ''}`);
