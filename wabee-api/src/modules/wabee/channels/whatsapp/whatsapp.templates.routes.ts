import { Router } from 'express';
import * as templatesController from './whatsapp.templates.controller';

const router = Router({ mergeParams: true });

// POST /v1/wabee/channels/:channelId/templates/import
router.post('/import', templatesController.importTemplates);

// POST /v1/wabee/channels/:channelId/templates
router.post('/', templatesController.createTemplate);

// GET /v1/wabee/channels/:channelId/templates
router.get('/', templatesController.listTemplates);

// DELETE /v1/wabee/channels/:channelId/templates/:templateId
router.delete('/:templateId', templatesController.deleteTemplate);

export default router;
