import { Router } from 'express';
import * as contactController from './contacts.controller';
import * as groupsController from '../groups/groups.controller';
import { requireModule } from '@/middleware/modules.guard';

const router = Router();

// El middleware de Auth y Tenancy base ya debería estar inyectado desde el index principal o contactos
// Las rutas internas obtienen su tenantId mediante tenancyAdapter en el controller.

// ─── Middlewares base para todas las rutas de este submódulo ──────────────────
router.use(requireModule('contacts'));

// --- Groups (Legacy Aliases) ---
router.use('/groups', requireModule('groups'));
router.get('/groups', groupsController.listGroups);
router.post('/groups', groupsController.createGroup);
router.get('/groups/:id', groupsController.getGroup);
router.patch('/groups/:id', groupsController.updateGroup);
router.delete('/groups/:id', groupsController.deleteGroup);
router.get('/groups/:id/contacts', groupsController.getGroupContacts);
router.post('/groups/:id/contacts', groupsController.addContactsToGroup);
router.delete('/groups/:id/contacts', groupsController.removeContactsFromGroup);

// --- Segments ---
router.use('/segments', requireModule('segments'));
router.get('/segments', contactController.listSegments);
router.post('/segments', contactController.createSegment);
router.patch('/segments/:id', contactController.updateSegment);
router.post('/segments/:id/execute', contactController.executeSegment);
router.delete('/segments/:id', contactController.deleteSegment);

// --- Demo ---
router.post('/demo-seed', contactController.demoSeed);

// --- Contacts ---
import multer from 'multer';
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 }
});
router.post('/import', upload.single('file'), contactController.importContacts);

router.get('/', contactController.listContacts);
router.post('/', contactController.createContact);
router.get('/:id', contactController.getContact);
router.patch('/:id', contactController.updateContact);
router.delete('/:id', contactController.deleteContact);

router.post('/:id/tags:add', contactController.addTags);
router.post('/:id/tags:remove', contactController.removeTags);
router.patch('/:id/lifecycle', contactController.patchLifecycle);


export default router;
