import client from '../client';

export interface Notification {
    id: string;
    userId: string;
    title: string;
    message: string;
    type: string;
    severity?: string;
    isRead: boolean;
    createdAt: string;
}

export const notificationsApi = {
    getNotifications: async () => {
        const { data } = await client.get('/wabee/notifications');
        const notifications = data as Notification[];
        return notifications.map(n => {
            let derivedSeverity = n.severity;
            if (!derivedSeverity && n.type === 'CAMPAIGN_ALERT') {
                const title = n.title.toLowerCase();
                if (title.includes('fallida')) derivedSeverity = 'critical';
                else if (title.includes('error') || title.includes('pausada') || title.includes('cancelada')) derivedSeverity = 'warning';
                else derivedSeverity = 'success';
            }
            return { ...n, severity: derivedSeverity || 'info' };
        });
    },
    markAsRead: async (id: string) => {
        const { data } = await client.post(`/wabee/notifications/${id}/read`);
        return data;
    },
    markAllAsRead: async () => {
        const { data } = await client.post('/wabee/notifications/read-all');
        return data;
    }
};
