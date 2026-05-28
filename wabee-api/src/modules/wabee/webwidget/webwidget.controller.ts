import { Request, Response, NextFunction } from 'express';
import { CreateWebWidgetSchema, UpdateWebWidgetSchema, InboundMessageSchema } from './webwidget.schemas';
import { WebWidgetService } from './webwidget.service';
import { GlobalAuditLogService } from '@/modules/audit/global-audit-log.service';
import { getAuditContext } from '@/shared/http/request-audit-context';

// --- Admin Endpoints ---
export async function listWidgets(req: any, res: Response, next: NextFunction) {
    try {
        const widgets = await WebWidgetService.getWidgets(req.tenantId);
        res.json(widgets);
    } catch (error) {
        next(error);
    }
}

export async function createWidget(req: any, res: Response, next: NextFunction) {
    const auditCtx = getAuditContext(req);
    try {
        const data = CreateWebWidgetSchema.parse(req.body);
        const widget = await WebWidgetService.createWebWidget(req.tenantId, data);

        await GlobalAuditLogService.logEvent({
            category: 'widget',
            eventType: 'widget.create',
            severity: 'success',
            outcome: 'success',
            message: `Web Widget creado: ${widget.title}`,
            targetType: 'web_widget',
            targetId: widget.id,
            newValues: req.body
        }, auditCtx);

        res.status(201).json(widget);
    } catch (error: any) {
        await GlobalAuditLogService.logEvent({
            category: 'widget',
            eventType: 'widget.create.failed',
            severity: 'critical',
            outcome: 'failure',
            message: `Fallo al crear Web Widget: ${error.message}`,
            metadata: { body: req.body, error: error.message }
        }, auditCtx);
        next(error);
    }
}

export async function getWidget(req: any, res: Response, next: NextFunction) {
    try {
        const { id } = req.params;
        const widget = await WebWidgetService.getWidgetById(req.tenantId, id);
        if (!widget) return res.status(404).json({ error: 'Widget not found' });
        res.json(widget);
    } catch (error) {
        next(error);
    }
}

export async function updateWidget(req: any, res: Response, next: NextFunction) {
    const auditCtx = getAuditContext(req);
    const { id } = req.params;
    try {
        const incoming = UpdateWebWidgetSchema.parse(req.body);

        const existing = await WebWidgetService.getWidgetById(req.tenantId, id);
        if (!existing) return res.status(404).json({ error: 'Widget not found' });

        const data: any = { ...incoming };

        if (incoming.theme) {
            data.theme = {
                ...(existing.theme as any || {}),
                ...incoming.theme
            };
        }

        if (incoming.features) {
            data.features = {
                ...(existing.features as any || {}),
                ...incoming.features
            };
        }

        const widget = await WebWidgetService.updateWebWidget(req.tenantId, id, data);

        await GlobalAuditLogService.logEvent({
            category: 'widget',
            eventType: 'widget.update',
            severity: 'success',
            outcome: 'success',
            message: `Web Widget actualizado: ${widget.title}`,
            targetType: 'web_widget',
            targetId: id,
            newValues: req.body
        }, auditCtx);

        res.json(widget);
    } catch (error: any) {
        await GlobalAuditLogService.logEvent({
            category: 'widget',
            eventType: 'widget.update.failed',
            severity: 'critical',
            outcome: 'failure',
            message: `Fallo al actualizar Web Widget (${id}): ${error.message}`,
            targetType: 'web_widget',
            targetId: id,
            metadata: { body: req.body, error: error.message }
        }, auditCtx);
        next(error);
    }
}

// --- Public Widget Endpoints ---
export async function getPublicConfig(req: Request, res: Response, next: NextFunction) {
    try {
        const { widgetId } = req.params as { widgetId: string };
        const originOrReferer = (req.headers.origin || req.headers.referer) as string;
        const config = await WebWidgetService.getPublicConfig(widgetId, originOrReferer);

        // Evitar caché de navegador para configuración dinámica
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        res.json(config);
    } catch (error) {
        next(error);
    }
}

export async function sendPublicMessage(req: Request, res: Response, next: NextFunction) {
    try {
        const { widgetId } = req.params as { widgetId: string };
        const parseResult = InboundMessageSchema.safeParse(req.body);

        if (!parseResult.success) {
            console.warn('[WebWidgetController][PUBLIC] Body inválido:', parseResult.error.format());
            return res.status(400).json({
                type: 'FALLBACK',
                text: 'Lo siento, no pude procesar tu mensaje. Intenta de nuevo.'
            });
        }

        const { visitorId, sessionId, textBody, previewConfig } = parseResult.data;
        const originOrReferer = (req.headers.origin || req.headers.referer) as string;

        if (!textBody) {
            return res.status(400).json({
                type: 'FALLBACK',
                text: 'El mensaje no puede estar vacío.'
            });
        }

        console.log(`[WebWidgetController][PUBLIC] POST /messages widgetId=${widgetId} origin=${originOrReferer || 'N/A'}`);

        const result = await WebWidgetService.processInboundMessage(
            widgetId, visitorId, sessionId, textBody, originOrReferer, previewConfig
        );
        res.json(result);
    } catch (error) {
        next(error);
    }
}

export async function getPublicHistory(req: Request, res: Response, next: NextFunction) {
    try {
        const { widgetId } = req.params as { widgetId: string };
        const { visitorId } = req.query;
        const originOrReferer = (req.headers.origin || req.headers.referer) as string;

        if (!visitorId || typeof visitorId !== 'string') {
            return res.status(400).json({ error: 'visitorId required' });
        }

        const result = await WebWidgetService.getThreadHistory(widgetId, visitorId, originOrReferer);
        res.json(result);
    } catch (error) {
        next(error);
    }
}

// --- Internal Dashboard Preview Endpoint ---
// Protegido SOLO por authMiddleware para evitar errores de resolución de tenant (TENANCY_REQUIRED).
// No requiere validación de dominio; el service verifica membership del usuario hacia el tenantId del widget.
export async function sendPreviewMessage(req: any, res: Response, next: NextFunction) {
    try {
        const { id: widgetId } = req.params;
        const user = req.user;
        const userId = user?.id || user?.sub;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized: No user session found.' });
        }

        const parseResult = InboundMessageSchema.safeParse(req.body);

        if (!parseResult.success) {
            console.warn('[WebWidgetController][PREVIEW] Body inválido:', parseResult.error.format());
            return res.status(400).json({
                type: 'FALLBACK',
                text: 'Lo siento, no pude procesar tu mensaje. Intenta de nuevo.'
            });
        }

        const { visitorId, sessionId, textBody, previewConfig } = parseResult.data;

        if (!textBody) {
            return res.status(400).json({
                type: 'FALLBACK',
                text: 'El mensaje no puede estar vacío.'
            });
        }

        console.log(`[WebWidgetController][PREVIEW] POST /${widgetId}/preview-message
  userId: ${userId}
  origin: ${req.headers.origin || 'N/A'}
  ruta: PREVIEW_INTERNAL`);

        // processPreviewMessage resuelve el tenant y verifica membership
        const result = await WebWidgetService.processPreviewMessage(
            userId, widgetId, visitorId, sessionId, textBody, previewConfig
        );

        res.json(result);
    } catch (error) {
        next(error);
    }
}

export async function sendMessage(req: Request, res: Response, next: NextFunction) {
    try {
        const { widgetId } = req.params as { widgetId: string };
        const parseResult = InboundMessageSchema.safeParse(req.body);

        if (!parseResult.success) {
            return res.status(400).json({
                type: 'FALLBACK',
                text: 'Invalid message.'
            });
        }

        const { visitorId, sessionId, textBody, previewConfig } = parseResult.data;
        const originOrReferer = (req.headers.origin || req.headers.referer) as string;

        const result = await WebWidgetService.processInboundMessage(
            widgetId, visitorId, sessionId, textBody, originOrReferer, previewConfig
        );
        res.json(result);
    } catch (error) {
        next(error);
    }
}

export async function getHistory(req: Request, res: Response, next: NextFunction) {
    try {
        const { widgetId } = req.params as { widgetId: string };
        const { visitorId } = req.query;
        const originOrReferer = (req.headers.origin || req.headers.referer) as string;

        if (!visitorId || typeof visitorId !== 'string') {
            return res.status(400).json({ error: 'visitorId required' });
        }

        const result = await WebWidgetService.getThreadHistory(widgetId, visitorId, originOrReferer);
        res.json(result);
    } catch (error) {
        next(error);
    }
}
