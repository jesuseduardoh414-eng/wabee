import { Router } from 'express';
import { IntegrationsController } from './integrations.controller';
import { rbacAdapter } from '../_adapters/rbac.adapter';

const router = Router();
const adminOnly = rbacAdapter.requireOrgRole(['Admin']);

router.get('/',                          adminOnly, IntegrationsController.list);
router.post('/',                         adminOnly, IntegrationsController.create);
router.get('/:id',                       adminOnly, IntegrationsController.get);
router.delete('/:id',                    adminOnly, IntegrationsController.remove);
router.put('/:id/field-mappings',        adminOnly, IntegrationsController.upsertMappings);
router.post('/:id/connect-token',        adminOnly, IntegrationsController.connectToken);
router.get('/:id/sync-logs',             adminOnly, IntegrationsController.getSyncLogs);

export { router as integrationsRouter };
