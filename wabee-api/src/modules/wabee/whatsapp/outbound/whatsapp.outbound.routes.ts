import { Router } from 'express';
import { tenantMiddleware } from '@/middleware/tenant';
import * as outboundController from './whatsapp.outbound.controller';
import { requireModule } from '@/middleware/modules.guard';

const router = Router();

// Todas las rutas de outbound requieren tenantId (Multi-tenant)
router.use(tenantMiddleware);
router.use(requireModule('campaigns'));

router.post('/send', outboundController.sendBulkMessages);

export default router;
