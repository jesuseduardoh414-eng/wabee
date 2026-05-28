import { Router } from 'express';
import * as dashboardController from './dashboard.controller';
import { tenantMiddleware } from '@/middleware/tenant';
import { authMiddleware } from '@/middleware/auth.middleware';

const router = Router();

// Middlewares base
router.use(authMiddleware);
router.use(tenantMiddleware);

// Dashboard Executive Endpoints
router.get('/summary', dashboardController.getSummary);
router.get('/health', dashboardController.getOperationalHealth);
router.get('/ai-vs-human', dashboardController.getAiVsHuman);
router.get('/top-campaigns', dashboardController.getTopCampaigns);
router.get('/agents-performance', dashboardController.getAgentsPerformance);
router.get('/inbox-status', dashboardController.getInboxStatus);
router.get('/timeseries', dashboardController.getTimeSeries);

export default router;
