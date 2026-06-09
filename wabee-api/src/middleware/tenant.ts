import { tenancyAdapter } from '../modules/wabee/_adapters/tenancy.adapter';
import { isSuperAdmin } from './auth-role.middleware';

/**
 * Compatibility middleware for legacy WABEE code.
 * Bridges Core SaaS tenancy to legacy req.tenantId.
 */
export const tenantMiddleware = (req: any, res: any, next: any) => {
    try {
        // En Core Starter, el tenant se extrae del contexto de la organización
        // Si es SUPER_ADMIN, permitimos que el tenantId sea opcional (ej: para rutas globales o dashboard admin)
        if (isSuperAdmin(req.user)) {
            try {
                const tenantId = tenancyAdapter.getTenantId(req);
                req.tenantId = tenantId;
            } catch (e) {
                // No pasa nada, es super admin y no tiene contexto de tenant
                req.tenantId = null;
            }
            return next();
        }

        const tenantId = tenancyAdapter.getTenantId(req);
        req.tenantId = tenantId;
        next();
    } catch (error) {
        // Si no hay tenant pero la ruta lo requiere, el adaptador lanzará error.
        next(error);
    }
};
