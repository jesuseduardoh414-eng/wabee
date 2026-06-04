import pino from 'pino';
import { env } from '@/config/env';

const isProd = env.NODE_ENV === 'production';

/**
 * Logger estructurado central de WABEE.
 *
 * - En desarrollo: salida legible con colores (pino-pretty).
 * - En producción: JSON en una línea por log (ideal para Render/Datadog/Loki).
 *
 * Nivel configurable con LOG_LEVEL (trace|debug|info|warn|error). Default: info.
 * Redacta cabeceras sensibles automáticamente.
 */
export const logger = pino({
    level: env.LOG_LEVEL || 'info',
    redact: {
        paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.headers["x-tenant-id"]',
            '*.accessToken',
            '*.refreshToken',
            '*.password',
        ],
        remove: true,
    },
    transport: isProd
        ? undefined
        : {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
        },
});

/** Crea un logger hijo con un requestId fijo para correlacionar logs de una petición. */
export function childLogger(requestId: string) {
    return logger.child({ requestId });
}
