/**
 * redis.patch.ts
 *
 * Parche de arranque para silenciar los errores ECONNREFUSED de ioredis
 * cuando Redis no está disponible en entorno local (REDIS_ENABLED=false).
 *
 * ESTRATEGIA REAL:
 * ioredis expone su clase Redis como módulo CommonJS. Podemos sobrescribir
 * el wrapper en el require-cache ANTES de que @r4d-26/core lo importe,
 * interceptando la creación de cada instancia y registrando un handler
 * 'error' silencioso.
 *
 * En producción (NODE_ENV=production o REDIS_ENABLED=true) este módulo
 * es un no-op total.
 */

const isDev = process.env.NODE_ENV !== 'production';
const redisEnabled = process.env.REDIS_ENABLED !== 'false';

export function applyRedisPatch(): void {
    if (!isDev || redisEnabled) {
        return; // No-op en producción o cuando Redis está habilitado
    }

    try {
        // Require ioredis para poblar el cache antes de que lo haga el Core
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const ioredisModule = require('ioredis');

        // ioredis exporta la clase bajo .default (ESM-compat) y también directamente
        const OriginalRedis = ioredisModule.default ?? ioredisModule;

        if (!OriginalRedis || typeof OriginalRedis !== 'function') {
            console.warn('[Redis Patch] No se pudo obtener el constructor de ioredis.');
            return;
        }

        /**
         * Constructor proxy: crea la instancia original pero con opciones defensivas
         * y registra un handler 'error' silencioso de inmediato.
         */
        function PatchedRedis(this: any, ...args: any[]) {
            // Inyectar opciones defensivas
            const opts: Record<string, any> =
                args[0] && typeof args[0] === 'object' ? { ...args[0] } : {};

            opts.lazyConnect = true;
            opts.enableOfflineQueue = false;
            opts.maxRetriesPerRequest = 0;
            opts.retryStrategy = () => null; // null = no reconectar

            // Reemplazar el primer argumento
            const newArgs = [...args];
            newArgs[0] = opts;

            // Llamar al constructor original en el contexto de this
            OriginalRedis.apply(this, newArgs);

            // Registrar handler 'error' silencioso para esta instancia
            this.on('error', (_err: Error) => {
                // Silenciado intencionalmente: Redis no disponible en dev local.
                // Activa REDIS_ENABLED=true en .env cuando Redis esté disponible.
            });
        }

        // Copiar el prototipo y propiedades estáticas
        PatchedRedis.prototype = OriginalRedis.prototype;
        Object.setPrototypeOf(PatchedRedis, OriginalRedis);

        // Copiar propiedades estáticas conocidas de ioredis (Cluster, etc.)
        for (const key of Object.keys(OriginalRedis)) {
            (PatchedRedis as any)[key] = (OriginalRedis as any)[key];
        }

        // Sobrescribir en el require-cache para que cualquier import posterior use el proxy
        const resolvedPath = require.resolve('ioredis');
        const cached = require.cache[resolvedPath];
        if (cached) {
            if (cached.exports.default) {
                cached.exports.default = PatchedRedis;
            }
            // También sobrescribir la exportación directa (para uso CJS)
            // ioredis v5+ usa ESM default, pero BullMQ/ioredis legacy usa module.exports
            if (typeof cached.exports === 'function') {
                // El módulo exporta la clase directamente
                require.cache[resolvedPath]!.exports = PatchedRedis;
            }
        }

        console.info(
            '[Redis] REDIS_ENABLED=false → modo dev sin Redis. ' +
            'Conexiones Redis silenciadas (lazyConnect + error handler). ' +
            'Rate limiting, circuit breaker y colas desactivados localmente.'
        );
    } catch (err: any) {
        // Si el patch falla no es crítico: el servidor arrancará con los errores normales de ioredis
        console.warn('[Redis Patch] No se pudo aplicar el patch:', err?.message);
    }
}
