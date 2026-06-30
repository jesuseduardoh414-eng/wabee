import client from '../client';

export interface AuditLog {
    id: string;
    tenantId: string;
    actorUserId: string;
    action: string;
    modelType: string;
    modelId?: string;
    oldValues: any;
    newValues: any;
    description?: string;
    ipAddress?: string;
    userAgent?: string;
    createdAt: string;
    actor?: {
        name: string;
        email: string;
    };
}

export interface AuditLogFilter {
    from?: string;
    to?: string;
    action?: string;
    modelType?: string;
    actorUserId?: string;
    limit?: number;
    offset?: number;
}

export const auditApi = {
    getLogs: async (filters: AuditLogFilter) => {
        const { data } = await client.get('/wabee/audit', { params: filters });
        return data as { items: AuditLog[], total: number, limit: number, offset: number };
    },
    exportLogs: async (filters: AuditLogFilter) => {
        const { data } = await client.post('/wabee/audit/export', filters);
        return data; // { success, count, data: AuditLog[] }
    }
};

// ─── Auditoría de Atención ────────────────────────────────────────────────────

export interface AttentionSummary {
    uniqueChats: number;
    messagesSent: number;
    chatsTaken: number;
    takeovers: number;
    chatsClosed: number;
    chatsReassigned: number;
    chatsReleased: number;
    avgFirstResponseMs: number | null;
    avgResolutionMs: number | null;
    avgHumanQueueResponseMs: number | null;
}

export interface AttentionChatDetail {
    threadId: string;
    contactName: string | null;
    channel: string | null;
    channelId: string | null;
    openedAt: string | null;
    firstHumanAt: string | null;
    lastHumanAt: string | null;
    finalStatus: string | null;
    messagesSentByAgent: number;
    hadAiHandoff: boolean;
    finalAssigneeUserId: string | null;
    finalAssigneeName: string | null;
    conversationType: 'ai_only' | 'human_only' | 'hybrid';
    actions: string[];
}

export interface AttentionFilters {
    agentId?: string;
    from?: string;
    to?: string;
    channelId?: string;
    eventType?: string;
    limit?: number;
    offset?: number;
}

export interface InboxAuditEvent {
    id: string;
    threadId: string;
    actorType: string;
    actorUserId: string | null;
    actorRole: string | null;
    actorDisplayName: string | null;
    contactDisplayName: string | null;
    channelName: string | null;
    eventType: string;
    description: string | null;
    metadata: any;
    occurredAt: string;
}

export const inboxAuditApi = {
    getSummary: async (filters: AttentionFilters): Promise<AttentionSummary> => {
        const { data } = await client.get('/wabee/audit/attention/summary', { params: filters });
        return data;
    },
    getDetails: async (filters: AttentionFilters): Promise<{ items: AttentionChatDetail[], total: number }> => {
        const { data } = await client.get('/wabee/audit/attention/details', { params: filters });
        return data;
    },
    getThreadTimeline: async (threadId: string): Promise<InboxAuditEvent[]> => {
        const { data } = await client.get(`/wabee/audit/attention/threads/${threadId}`);
        return data;
    },
    exportCsv: async (filters: AttentionFilters): Promise<void> => {
        // Descarga vía el cliente autenticado. Antes devolvía una URL relativa que,
        // al abrirse, pegaba al frontend (Vercel) y devolvía index.html sin auth.
        const { data } = await client.get('/wabee/audit/attention/export', {
            params: filters,
            responseType: 'blob',
        });
        const url = window.URL.createObjectURL(data as Blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `auditoria_atencion_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    },
};
