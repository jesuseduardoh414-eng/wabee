import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';

/**
 * Define las dependencias entre módulos para que el bloqueo se propague.
 * Padre: [Hijos]
 */
const MODULE_DEPENDENCIES: Record<string, string[]> = {
    contacts: ['segments', 'groups'],
    aiProfiles: ['webWidgets', 'integrationsTools'],
};

/**
 * Middleware para restringir el acceso a rutas según los módulos habilitados en el plan.
 * Utiliza req.orgPlan (inyectado por planResolverMiddleware).
 */
export const requireModule = (moduleKey: string) => {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const plan = req.orgPlan;

            if (!plan) {
                return res.status(403).json({ 
                    error: { 
                        code: 'PLAN_REQUIRED', 
                        message: 'No se encontró un plan activo para validar el acceso.' 
                    } 
                });
            }

            // 1. Validar si el módulo está habilitado individualmente
            let isEnabled = plan.modules && plan.modules[moduleKey] === true;

            // 2. Validar dependencias (Si un padre está desactivado, el hijo también)
            for (const [parent, children] of Object.entries(MODULE_DEPENDENCIES)) {
                if (children.includes(moduleKey)) {
                    const parentEnabled = plan.modules && plan.modules[parent] === true;
                    if (!parentEnabled) {
                        isEnabled = false;
                        break;
                    }
                }
            }

            if (!isEnabled) {
                return res.status(403).json({ 
                    error: { 
                        code: 'MODULE_DISABLED', 
                        message: `El módulo '${moduleKey}' (o una de sus dependencias) no está incluido en tu plan actual.` 
                    } 
                });
            }

            next();
        } catch (error: any) {
            console.error(`[Middleware:requireModule:${moduleKey}] Error:`, error.message);
            res.status(500).json({ 
                error: { 
                    code: 'INTERNAL_ERROR', 
                    message: 'Error al validar los módulos de tu suscripción.' 
                } 
            });
        }
    };
};
