import { Router } from 'express';
import { GlobalAuditLogService } from '../audit/global-audit-log.service';
import { getAuditContext } from '../../shared/http/request-audit-context';
import { coreAdapter } from '../core/core.adapter';

const router = Router();

/**
 * @route GET /v1/super-admin/audit/events
 * @desc Listado paginado de eventos de auditoría global
 */
router.get('/events', async (req: any, res) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const search = req.query.search as string;
        const category = req.query.category as string;
        const severity = req.query.severity as string;
        const outcome = req.query.outcome as string;

        const result = await coreAdapter.system.audit.list({
            page,
            pageSize: limit,
            search,
            category,
            severity,
            outcome
        });

        // Registrar evento de acceso a la auditoría (Filtros en metadata)
        await GlobalAuditLogService.logEvent({
            category: 'super_admin',
            eventType: 'super_admin.audit.view',
            severity: 'info',
            outcome: 'success',
            message: `Super Admin accedió al listado de auditoría (Fase 2 - Filtros: ${search || 'N/A'})`,
            metadata: { page, limit, filters: { search, category, severity, outcome } }
        }, getAuditContext(req));

        res.json(result);
    } catch (error: any) {
        console.error('[AuditRoutes] Error fetching events:', error);
        res.status(500).json({ error: { message: 'Error al obtener eventos de auditoría' } });
    }
});

/**
 * @route GET /v1/super-admin/audit/events/:id
 * @desc Detalle completo de un evento de auditoría
 */
router.get('/events/:id', async (req: any, res) => {
    try {
        const { id } = req.params;
        const event = await coreAdapter.system.audit.getById(id);

        if (!event) {
            return res.status(404).json({ error: { message: 'Evento no encontrado' } });
        }

        // Registrar evento de visualización de detalle
        await GlobalAuditLogService.logEvent({
            category: 'super_admin',
            eventType: 'super_admin.audit.event_detail_view',
            severity: 'info',
            outcome: 'success',
            message: `Super Admin visualizó detalle del evento ${id}`,
            targetId: id,
            targetType: 'GlobalAuditEvent'
        }, getAuditContext(req));

        res.json({ data: event });
    } catch (error: any) {
        console.error('[AuditRoutes] Error fetching event detail:', error);
        res.status(500).json({ error: { message: 'Error al obtener detalle del evento' } });
    }
});

export const superAdminAuditRoutes = router;
