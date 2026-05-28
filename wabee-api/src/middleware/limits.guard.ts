import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { LimitsService } from '../modules/billing/limits.service';

/**
 * Middleware para restringir la creación de recursos según los límites del plan.
 * 
 * @param limitKey Clave del límite en limitsSnapshot (ej: 'channels', 'contacts')
 */
export const requireLimit = (limitKey: string) => {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const plan = req.orgPlan;
            const tenantId = req.tenantId;

            if (!plan || !tenantId) {
                return res.status(403).json({ 
                    error: { 
                        code: 'PLAN_REQUIRED', 
                        message: 'No se encontró un plan activo para validar límites.' 
                    } 
                });
            }

            // 1. Obtener el valor del límite del snapshot resuelto
            const limitValue = plan.limits ? plan.limits[limitKey] : null;

            // 2. Semántica: null = BLOQUEADO
            if (limitValue === null || limitValue === undefined) {
                return res.status(403).json({ 
                    error: { 
                        code: 'LIMIT_BLOCKED', 
                        message: `El recurso '${limitKey}' no está incluido en tu plan actual.` 
                    } 
                });
            }

            // 3. Ilimitado (-1)
            if (limitValue === -1) {
                return next();
            }

            // 4. Calcular uso actual
            let currentUsage = 0;
            switch (limitKey) {
                case 'channels':
                    currentUsage = await LimitsService.countChannels(tenantId);
                    break;
                case 'contacts':
                    currentUsage = await LimitsService.countContacts(tenantId);
                    break;
                case 'aiAgents':
                    currentUsage = await LimitsService.countAiAgents(tenantId);
                    break;
                case 'campaignsPerMonth':
                    currentUsage = await LimitsService.countCampaignsThisMonth(tenantId);
                    break;
                case 'aiTokensPerMonth':
                    currentUsage = await LimitsService.getAiTokensUsageThisMonth(tenantId);
                    break;
                default:
                    // Si no conocemos el límite, por seguridad lo dejamos pasar o bloqueamos?
                    // Por ahora, si no hay estrategia de conteo, permitimos (o logueamos error)
                    console.warn(`[Middleware:requireLimit] No counting strategy for ${limitKey}`);
                    return next();
            }

            // 5. Validar
            const canCreate = LimitsService.check(limitValue as number, currentUsage);

            if (!canCreate) {
                return res.status(403).json({ 
                    error: { 
                        code: 'LIMIT_EXCEEDED', 
                        message: `Has alcanzado el límite máximo de '${limitKey}' (${limitValue}) para tu plan actual. Mejora tu plan para crear más.` 
                    } 
                });
            }

            next();
        } catch (error: any) {
            console.error(`[Middleware:requireLimit:${limitKey}] Error:`, error.message);
            res.status(500).json({ 
                error: { 
                    code: 'INTERNAL_ERROR', 
                    message: 'Error al validar los límites de tu suscripción.' 
                } 
            });
        }
    };
};
