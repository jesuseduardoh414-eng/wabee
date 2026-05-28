import { Request, Response } from 'express';
import { AuditService } from './audit.service';

export const getAuditLogs = async (req: any, res: Response) => {
    try {
        const tenantId = req.tenantId; // from auth middleware
        const { from, to, action, modelType, entityType, actorUserId, userId, limit, offset } = req.query;

        const filters = {
            from: from as string,
            to: to as string,
            action: action as string,
            // Aceptar tanto modelType (nuevo) como entityType (legacy) desde el frontend
            modelType: (modelType || entityType) as string,
            // Aceptar tanto userId / actorUserId desde el frontend
            userId: (userId || actorUserId) as string,
            limit: limit ? parseInt(limit as string, 10) : 50,
            offset: offset ? parseInt(offset as string, 10) : 0,
        };

        const result = await AuditService.getLogs(tenantId, filters);
        res.json(result);
    } catch (error: any) {
        console.error('[AuditController] Error getAuditLogs:', error);
        res.status(500).json({ message: 'Error retrieving audit logs' });
    }
};

export const exportAuditLogs = async (req: any, res: Response) => {
    try {
        const tenantId = req.tenantId;
        const { from, to, action, modelType, entityType } = req.body;

        // Límite por plan (idealmente verificando `req.organization.plan`)
        // Por ahora hardcode a 1000 records para evitar timeouts
        const result = await AuditService.getLogs(tenantId, {
            from,
            to,
            action,
            modelType: modelType || entityType,
            limit: 1000,
        });

        res.json({ success: true, count: result.items.length, data: result.items });
    } catch (error: any) {
        console.error('[AuditController] Error exportAuditLogs:', error);
        res.status(500).json({ message: 'Error exporting audit logs' });
    }
};
