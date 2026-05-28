import { Router } from 'express';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant';
import { RealtimeController } from './realtime.controller';

const router = Router();

/**
 * GET /v1/wabee/realtime/stream?token=JWT
 *
 * authMiddleware valida el token (Bearer header o ?token= query param).
 * tenantMiddleware resuelve req.tenantId desde el JWT.
 * RealtimeController.stream abre el SSE y suscribe al bus.
 */
router.get('/stream', authMiddleware, tenantMiddleware, RealtimeController.stream);

export default router;
