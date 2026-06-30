import { tenancyAdapter } from '../modules/wabee/_adapters/tenancy.adapter';
import { isSuperAdmin } from './auth-role.middleware';
import { coreAdapter } from '../modules/core/core.adapter';

/**
 * Compatibility middleware for legacy WABEE code.
 * Bridges Core SaaS tenancy to legacy req.tenantId.
 */
export const tenantMiddleware = async (req: any, res: any, next: any) => {
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

        // ── Guard anti cross-tenant (IDOR) ────────────────────────────────────
        // El tenantId se resuelve desde los claims del JWT y, en su defecto, desde
        // un header/query CONTROLADO POR EL CLIENTE (`x-tenant-id`, `?tenantId=`).
        // Como el JWT de sesión NO fija la organización, aquí verificamos que el
        // usuario autenticado sea realmente miembro del tenant que reclama. Sin esta
        // comprobación, cualquier usuario autenticado podría leer o escribir datos de
        // OTRA organización simplemente cambiando el header `x-tenant-id`.
        // Los super admin de plataforma quedan exentos (rama de arriba); la
        // suplantación funciona porque el usuario efectivo (target) sí es miembro.
        const userId = req.user?.id || req.user?.sub;
        if (userId && !req.__tenantMembershipChecked) {
            const membership = await coreAdapter.organizations.getMembership(tenantId, userId);
            if (!membership) {
                return res.status(403).json({
                    error: {
                        code: 'TENANT_ACCESS_DENIED',
                        message: 'No tienes acceso a esta organización.'
                    }
                });
            }
            // Evita una segunda consulta cuando el middleware se monta dos veces
            // (a nivel de app y dentro del router del submódulo).
            req.__tenantMembershipChecked = true;
        }

        next();
    } catch (error) {
        // Si no hay tenant pero la ruta lo requiere, el adaptador lanzará error.
        next(error);
    }
};
