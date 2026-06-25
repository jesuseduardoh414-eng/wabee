import { Router } from 'express';
import cors from 'cors';
import * as webWidgetController from './webwidget.controller';
import { tenantMiddleware } from '@/middleware/tenant';
import { requireModule } from '@/middleware/modules.guard';

const router = Router();

// --- Public Widget Routes ---
// Montadas en /v1/public/widgets
// CORS abierto; la seguridad se aplica vía domainAllowed en el servicio.
const publicRouter = Router();

// CORS explícito manejado globalmente por corsPublicOptions en index.ts

publicRouter.get('/:widgetId/config', (req, res, next) => {
    console.log(`[WebWidgetRouter][PUBLIC] GET /config widgetId=${req.params.widgetId}`);
    webWidgetController.getPublicConfig(req, res, next);
});

publicRouter.post('/:widgetId/messages', (req, res, next) => {
    console.log(`[WebWidgetRouter][PUBLIC] POST /messages widgetId=${req.params.widgetId} origin=${req.headers.origin || 'N/A'}`);
    webWidgetController.sendPublicMessage(req, res, next);
});

publicRouter.get('/:widgetId/thread', (req, res, next) => {
    console.log(`[WebWidgetRouter][PUBLIC] GET /thread widgetId=${req.params.widgetId}`);
    webWidgetController.getPublicHistory(req, res, next);
});

export { publicRouter };

// Montado en /v1/widget (mixto, actualmente no en uso intensivo)
router.post('/:widgetId/messages', webWidgetController.sendMessage);
router.get('/:widgetId/thread', webWidgetController.getHistory);

// --- Admin Routes ---
// Montadas en /v1/wabee/web-widgets
// Protegidas con authMiddleware + tenantMiddleware + authGuardMiddleware en index.ts
export const webWidgetAdminRouter = Router();
webWidgetAdminRouter.use(tenantMiddleware as any);
webWidgetAdminRouter.use(requireModule('aiProfiles'));
webWidgetAdminRouter.use(requireModule('webWidgets'));
webWidgetAdminRouter.get('/', webWidgetController.listWidgets);
webWidgetAdminRouter.post('/', webWidgetController.createWidget);
webWidgetAdminRouter.get('/:id', webWidgetController.getWidget);
webWidgetAdminRouter.patch('/:id', webWidgetController.updateWidget);

// Endpoint interno de preview — requiere sesión autenticada del dashboard
// El token JWT se pasa en el header Authorization.
// NO valida domainAllowed, pero es RUTEADO independientemente para saltar el tenantMiddleware.
export const webWidgetPreviewRouter = Router();
webWidgetPreviewRouter.get('/preview-token', webWidgetController.getPreviewToken);
webWidgetPreviewRouter.post('/:id/preview-message', webWidgetController.sendPreviewMessage);

export default router;
