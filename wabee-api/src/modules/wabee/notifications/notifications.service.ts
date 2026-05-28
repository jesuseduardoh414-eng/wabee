import { coreAdapter } from '@/modules/core/core.adapter';
import { RealtimeBus } from '@/modules/wabee/realtime/realtime.bus';

export enum WabeeNotificationType {
    CHANNEL_ALERT = 'CHANNEL_ALERT',
    CAMPAIGN_ALERT = 'CAMPAIGN_ALERT',
    AI_ALERT = 'AI_ALERT',
    CRM_ALERT = 'CRM_ALERT',
    SECURITY_ALERT = 'SECURITY_ALERT'
}

export interface CreateNotificationInput {
    tenantId: string;
    userId: string;
    type: WabeeNotificationType | string;
    severity: 'info' | 'warning' | 'critical';
    title: string;
    message: string;
    relatedEntityId?: string;
}

export class NotificationService {
    /**
     * Crea una notificación para un usuario específico (Admin/Supervisor)
     */
    static async create(input: CreateNotificationInput) {
        const notification = await coreAdapter.notifications.create({
            userId: input.userId,
            title: input.title,
            message: input.message,
            type: input.type,
        });

        // Disparar evento realtime para que el UI refresque inmediatamente
        RealtimeBus.publish(input.tenantId, {
            type: 'new_notification',
            payload: { notificationId: notification.id, type: input.type, title: input.title }
        });

        return notification;
    }

    /**
     * Crea una notificación para todos los Admins de un tenant
     */
    static async notifyAdmins(tenantId: string, input: Omit<CreateNotificationInput, 'userId' | 'tenantId'>) {
        const admins = await coreAdapter.organizations.listMembersByRoles(tenantId, ['ADMIN', 'admin', 'SUPER_ADMIN', 'super_admin']);

        const creations = admins.map((admin: any) =>
            this.create({
                ...input,
                tenantId,
                userId: admin.userId
            })
        );

        return await Promise.all(creations);
    }

    static async getNotifications(userId: string) {
        return await coreAdapter.notifications.list(userId, 50);
    }

    static async markAsRead(id: string, userId: string) {
        return await coreAdapter.notifications.markAsRead(id, userId);
    }

    static async markAllAsRead(userId: string) {
        return await coreAdapter.notifications.markAllAsRead(userId);
    }
}
