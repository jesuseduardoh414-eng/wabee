import { apiClient } from './client';

export interface WebWidget {
    id: string;
    tenantId: string;
    title: string;
    subtitle?: string;
    welcomeMessage?: string;
    domainAllowed: string[];
    theme?: any;
    features?: any;
    aiEnabled: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface WebThread {
    id: string;
    tenantId: string;
    widgetId: string;
    sessionId: string;
    status: 'OPEN' | 'PENDING' | 'CLOSED';
    lastMessageAt?: string;
    createdAt: string;
    updatedAt: string;
    messages: WebMessage[];
}

export interface WebMessage {
    id: string;
    threadId: string;
    direction: 'INBOUND' | 'OUTBOUND';
    actorType: 'USER' | 'SYSTEM';
    text: string;
    createdAt: string;
}

export const webWidgetApi = {
    // Admin Endpoints
    listWidgets: () => apiClient<WebWidget[]>('/web-widgets'),

    // Helper to find the single allowed widget
    findUnique: async () => {
        console.log('[webWidgetApi] findUnique calling /web-widgets');
        try {
            const widgets = await apiClient<WebWidget[]>('/web-widgets');
            console.log('[webWidgetApi] findUnique result:', widgets);
            return widgets && widgets.length > 0 ? widgets[0] : null;
        } catch (err) {
            console.error('[webWidgetApi] findUnique error:', err);
            throw err;
        }
    },

    createWidget: (data: Partial<WebWidget>) =>
        apiClient<WebWidget>('/web-widgets', {
            method: 'POST',
            body: JSON.stringify(data)
        }),
    getWidget: (id: string) => apiClient<WebWidget>(`/web-widgets/${id}`),
    updateWidget: (id: string, data: Partial<WebWidget>) =>
        apiClient<WebWidget>(`/web-widgets/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        }),

    // Public Widget Endpoints
    sendMessage: (widgetId: string, sessionId: string, message: string) =>
        apiClient<{ threadId: string, messageId: string }>(`/widget/${widgetId}/messages`, {
            method: 'POST',
            body: JSON.stringify({ sessionId, message })
        }),

    getHistory: (widgetId: string, sessionId: string) =>
        apiClient<{ thread: WebThread, messages: WebMessage[], widget: Partial<WebWidget> }>(
            `/widget/${widgetId}/thread?sessionId=${sessionId}`
        ),
};
