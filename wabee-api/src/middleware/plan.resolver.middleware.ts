import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { resolveOrganizationPlanSnapshot, getEmptyPlanSnapshot } from '../modules/billing/plan-resolver';

/**
 * Middleware central para resolver e inyectar el plan de la organización en req.orgPlan.
 * 
 * Este middleware debe correr DESPUÉS de tenantMiddleware para tener acceso a req.tenantId.
 * Si no hay tenantId o no hay suscripción, inyecta un plan vacío/bloqueado.
 */
export const planResolverMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const tenantId = req.tenantId || (req.headers['x-org-id'] as string) || (res.locals.orgId as string);

        if (!tenantId) {
            req.orgPlan = getEmptyPlanSnapshot();
            return next();
        }

        const snapshot = await resolveOrganizationPlanSnapshot(tenantId);
        
        // Inyectar el snapshot o uno vacío si no existe
        req.orgPlan = snapshot || getEmptyPlanSnapshot();

        next();
    } catch (error: any) {
        console.error('[Middleware:planResolver] Error:', error.message);
        // Fallback seguro: plan vacío para evitar huecos de seguridad
        req.orgPlan = getEmptyPlanSnapshot();
        next();
    }
};
