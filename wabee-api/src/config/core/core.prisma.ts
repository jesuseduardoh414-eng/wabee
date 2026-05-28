import { PrismaClient } from '@prisma/client';
import { getPrisma } from '@r4d-26/core';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { env } from '../env';
import { parse } from 'pg-connection-string';

const connectionString = env.DATABASE_URL;
const config = parse(connectionString);

// Convert null to undefined for TS compatibility with pg.PoolConfig
// and cast ssl to any to bypass strict type mismatch (pg-connection-string vs pg.PoolConfig)
const poolConfig: pg.PoolConfig = {
    ...config,
    host: config.host || undefined,
    database: config.database || undefined,
    user: config.user || undefined,
    password: config.password || undefined,
    port: config.port ? Number(config.port) : undefined,
    ssl: config.ssl as any,
    // --- Configuración de Resiliencia ---
    max: 10, // Máximo de conexiones simultáneas en el pool
    connectionTimeoutMillis: 10000, // Timeout de 10s para establecer conexión inicial
    idleTimeoutMillis: 30000, // Cerrar conexiones inactivas tras 30s
};

const pool = new pg.Pool(poolConfig);
const adapter = new PrismaPg(pool) as any;

/**
 * Cliente para el dominio principal de WABEE
 */
export const prisma = new PrismaClient({
    adapter,
    log: ['error', 'warn'],
});

/**
 * Proxy de compatibilidad hacia el CorePrismaClient del paquete @r4d-26/core.
 * Delega cada acceso a getPrisma() que es inicializado por AuthFactory.initialize().
 * Debe usarse únicamente en src/modules/core/core.internal.service.ts.
 */
export const corePrisma: any = new Proxy({} as any, {
    get(_target, prop) {
        return (getPrisma() as any)[prop as string];
    },
});
