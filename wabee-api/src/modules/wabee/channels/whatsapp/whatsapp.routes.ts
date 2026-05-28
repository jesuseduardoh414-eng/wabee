import { Router } from 'express';
import * as whatsappController from '@/modules/wabee/channels/whatsapp/whatsapp.controller';
import { tenantMiddleware } from '@/middleware/tenant';
import { requireModule } from '@/middleware/modules.guard';

const router = Router();

// Apply tenant middleware and base module check
router.use(tenantMiddleware);
router.use(requireModule('channels'));

// Standard create (with validation)
router.post('/', whatsappController.createChannel);

// Manual create (without session)
router.post('/manual', whatsappController.createManualChannel);

// Discover assets (POST as per req)
router.post('/detect', whatsappController.discoverAssets);

router.get('/', whatsappController.listChannels);
router.post('/:id/test-message', whatsappController.testMessage);
router.get('/:id/health', whatsappController.getChannelHealth);
router.delete('/:id', whatsappController.archiveChannel);
router.patch('/:id/webhook/verify', whatsappController.markWebhookVerified);

// Template routes
import templatesRouter from './whatsapp.templates.routes';
router.use('/:channelId/templates', requireModule('templatesHub'), templatesRouter);

// AI Config routes
import channelAiRoutes from './channel.ai.routes';
router.use('/:channelId/ai-config', requireModule('aiProfiles'), channelAiRoutes);

export default router;
