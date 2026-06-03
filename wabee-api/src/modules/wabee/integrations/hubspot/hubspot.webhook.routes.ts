import { Router } from 'express';
import { handleHubSpotWebhook } from './hubspot.webhook.controller';

const router = Router();

router.post('/', handleHubSpotWebhook);

export default router;
