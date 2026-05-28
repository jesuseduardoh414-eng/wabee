import { Router } from 'express';
import { getNotifications, markAsRead, markAllAsRead } from './notifications.controller';
import { authMiddleware } from '../../../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', getNotifications);
router.post('/read-all', markAllAsRead);
router.post('/:id/read', markAsRead);

export const notificationsRoutes = router;
