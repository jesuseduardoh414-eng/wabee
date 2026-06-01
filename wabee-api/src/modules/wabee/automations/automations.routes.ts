import { Router } from 'express';
import { AutomationsController } from './automations.controller';
import { rbacAdapter } from '../_adapters/rbac.adapter';

const router = Router();

const adminOnly = rbacAdapter.requireOrgRole(['Admin']);

// All automation routes require Admin role (per TRD Section 15.1)
router.get('/',              adminOnly, AutomationsController.listFlows);
router.post('/',             adminOnly, AutomationsController.createFlow);
router.get('/:id',           adminOnly, AutomationsController.getFlow);
router.put('/:id',           adminOnly, AutomationsController.updateFlow);
router.delete('/:id',        adminOnly, AutomationsController.deleteFlow);
router.post('/:id/publish',  adminOnly, AutomationsController.publishVersion);
router.post('/:id/activate', adminOnly, AutomationsController.activateFlow);
router.post('/:id/pause',    adminOnly, AutomationsController.pauseFlow);

export { router as automationsRouter };
