import { Request, Response, NextFunction } from 'express';
import { AuditService } from './audit.service';

/**
 * Middleware para auditar acciones automáticamente basado en la validación de que la request fue exitosa.
 * Se "cuelga" del evento 'finish' o 'close' de la respuesta.
 */
export const auditAction = (options: {
    action: string;
    modelType: string;
    getModelId?: (req: Request, res: Response) => string | undefined;
    getOldValues?: (req: Request) => any;
    getNewValues?: (req: Request) => any;
}) => {
    return (req: any, res: Response, next: NextFunction) => {
        const originalSend = res.send;
        let responseBody: any;

        // Intercept response to gather new/old data if needed
        res.send = function (body: any) {
            responseBody = body;
            return originalSend.apply(res, arguments as any);
        };

        res.on('finish', () => {
            // Solo registrar si la petición fue exitosa (200, 201)
            if (res.statusCode >= 200 && res.statusCode < 300) {
                const tenantId = req.tenantId;
                const actorUserId = req.user?.id;

                if (!tenantId || !actorUserId) return; // Requiere autenticación

                try {
                    let parsedBody = responseBody;
                    try {
                        if (typeof responseBody === 'string') {
                            parsedBody = JSON.parse(responseBody);
                        }
                    } catch (e) {
                        // ignores
                    }

                    // Enriquecer response body al request para usarlo en extractors
                    (req as any)._parsedResponse = parsedBody;

                    const modelId = options.getModelId ? options.getModelId(req, res) : undefined;
                    const oldValues = options.getOldValues ? options.getOldValues(req) : {};
                    const newValues = options.getNewValues ? options.getNewValues(req) : parsedBody;

                    // Enmascarar PII (simplificado)
                    const maskPII = (obj: any) => {
                        if (!obj) return obj;
                        const copy = { ...obj };
                        if (copy.email) copy.email = '***@***.***';
                        if (copy.phone) copy.phone = '********' + String(copy.phone).slice(-4);
                        if (copy.password) copy.password = '**********';
                        return copy;
                    };

                    AuditService.log({
                        tenantId,
                        userId: actorUserId,
                        action: options.action,
                        modelType: options.modelType,
                        modelId,
                        oldValues: maskPII(oldValues),
                        newValues: maskPII(newValues),
                        ipAddress: req.ip || req.headers['x-forwarded-for'] || '',
                        userAgent: req.headers['user-agent'] || ''
                    }).catch(err => console.error('[AuditMiddleware] Error asíncrono guardando log:', err));

                } catch (error) {
                    console.error('[AuditMiddleware] Error procesando log:', error);
                }
            }
        });

        next();
    };
};
