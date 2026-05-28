import { Router } from 'express';
import * as groupsController from './groups.controller';

const router = Router();

// El middleware de Auth y Tenancy base ya debería estar inyectado desde el index principal o contactos
// Las rutas internas obtienen su tenantId mediante tenancyAdapter en el controller.

router.get('/', groupsController.listGroups);
router.post('/', groupsController.createGroup);
router.get('/:id', groupsController.getGroup);
router.patch('/:id', groupsController.updateGroup);
router.delete('/:id', groupsController.deleteGroup);

// Membership
router.get('/:id/contacts', groupsController.getGroupContacts);
router.post('/:id/contacts', groupsController.addContactsToGroup);
router.delete('/:id/contacts', groupsController.removeContactsFromGroup);

export default router;
