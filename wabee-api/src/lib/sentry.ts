import * as Sentry from '@sentry/node';
import { env } from '@/config/env';
import { logger } from './logger';

let enabled = false;

/**
 * Inicializa Sentry SOLO si SENTRY_DSN está configurado.
 * Sin DSN es un no-op total: ni en dev ni en local pasa nada.
 */
export function initSentry(): void {
    if (!env.SENTRY_DSN) {
        logger.info('[Sentry] Deshabilitado (sin SENTRY_DSN).');
        return;
    }
    Sentry.init({
        dsn: env.SENTRY_DSN,
        environment: env.NODE_ENV,
        // Sin performance tracing por defecto (solo error tracking).
        tracesSampleRate: 0,
    });
    enabled = true;
    logger.info('[Sentry] Inicializado (error tracking activo).');
}

/** Reporta una excepción a Sentry si está habilitado. */
export function captureError(err: unknown, context?: Record<string, any>): void {
    if (!enabled) return;
    Sentry.captureException(err, context ? { extra: context } : undefined);
}

export { Sentry };
