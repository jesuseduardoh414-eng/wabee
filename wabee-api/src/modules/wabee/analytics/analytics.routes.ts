import { Router } from 'express';
import * as analyticsController from './analytics.controller';
import { tenantMiddleware } from '@/middleware/tenant';
import { authMiddleware } from '@/middleware/auth.middleware';

const router = Router();

// Apply base middlewares
router.use(authMiddleware);
router.use(tenantMiddleware);

// Analytics Endpoints
router.get('/overview', analyticsController.getOverview);
router.get('/timeseries', analyticsController.getTimeSeries);
router.get('/campaigns/timeseries', analyticsController.getCampaignTimeSeries);
router.get('/activity', analyticsController.getRecentActivity);
router.get('/campaigns', analyticsController.getCampaignAnalytics);

// Admin/Supervisor only endpoints
router.post('/export', analyticsController.exportData);

export default router;
