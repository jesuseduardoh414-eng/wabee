import { Request, Response } from 'express';
import { NotificationService } from './notifications.service';

export const getNotifications = async (req: any, res: Response) => {
    try {
        const userId = req.user.id;
        const notifications = await NotificationService.getNotifications(userId);
        res.json(notifications);
    } catch (error: any) {
        console.error('[NotificationController] Error getNotifications:', error);
        res.status(500).json({ message: 'Error retrieving notifications' });
    }
};

export const markAsRead = async (req: any, res: Response) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        await NotificationService.markAsRead(id, userId);
        res.json({ success: true });
    } catch (error: any) {
        console.error('[NotificationController] Error markAsRead:', error);
        res.status(500).json({ message: 'Error marking notification as read' });
    }
};

export const markAllAsRead = async (req: any, res: Response) => {
    try {
        const userId = req.user.id;
        await NotificationService.markAllAsRead(userId);
        res.json({ success: true });
    } catch (error: any) {
        console.error('[NotificationController] Error markAllAsRead:', error);
        res.status(500).json({ message: 'Error marking all notifications as read' });
    }
};
