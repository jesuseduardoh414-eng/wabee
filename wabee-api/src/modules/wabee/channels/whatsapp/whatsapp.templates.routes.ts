import { Router } from 'express';
import * as templatesController from './whatsapp.templates.controller';

const router = Router({ mergeParams: true });

// POST /v1/wabee/channels/:channelId/templates/import
router.post('/import', templatesController.importTemplates);

// GET /v1/wabee/channels/:channelId/templates
router.get('/', templatesController.listTemplates);

export default router;
