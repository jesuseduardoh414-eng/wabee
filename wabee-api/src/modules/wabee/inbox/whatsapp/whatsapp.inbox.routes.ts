import { Router } from 'express';
import { tenantMiddleware } from '@/middleware/tenant';
import * as inboxController from './whatsapp.inbox.controller';

const router = Router();

// All inbox routes are strictly multi-tenant
router.use(tenantMiddleware);

router.get('/threads/:threadId', inboxController.getThreadById);
router.post('/resolve-thread', inboxController.resolveThreadFromContact);
router.get('/channels/:channelId/messages', inboxController.getChannelMessages);
router.get('/channels/:channelId/threads', inboxController.getChannelThreads);
router.post('/threads/:threadId/send', inboxController.sendMessage);
router.post('/threads/:threadId/read', inboxController.markThreadRead);

// Collaboration endpoints (Fase 2)
router.get('/threads/:threadId/notes', inboxController.getThreadNotes);
router.post('/threads/:threadId/notes', inboxController.createThreadNote);
router.patch('/threads/:threadId/notes/:noteId', inboxController.updateThreadNote);
router.delete('/threads/:threadId/notes/:noteId', inboxController.deleteThreadNote);
router.post('/threads/:threadId/assign', inboxController.assignThread);
router.post('/threads/:threadId/status', inboxController.updateThreadStatus);

export default router;
