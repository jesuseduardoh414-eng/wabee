/**
 * Script de migración: Crea la tabla global_audit_events si no existe.
 * Ejecutar con: npx tsx prisma/run-audit-migration.ts
 */
import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    console.error('❌ DATABASE_URL no definida en .env');
    process.exit(1);
}

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool) as any;
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('🔄 Ejecutando migración de global_audit_events...');
    try {
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS r4d_app_v1.global_audit_events (
                id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                tenant_id        UUID,
                affected_tenant_id UUID,
                actor_type       TEXT NOT NULL,
                actor_user_id    UUID,
                actor_email      TEXT,
                actor_role       TEXT,
                event_type       TEXT NOT NULL,
                category         TEXT NOT NULL,
                severity         TEXT NOT NULL,
                outcome          TEXT NOT NULL,
                target_type      TEXT,
                target_id        TEXT,
                target_label     TEXT,
                ip_address       TEXT,
                user_agent       TEXT,
                request_id       TEXT,
                correlation_id   TEXT,
                message          TEXT NOT NULL,
                old_values       JSONB,
                new_values       JSONB,
                metadata         JSONB,
                is_sensitive     BOOLEAN NOT NULL DEFAULT false,
                is_impersonation BOOLEAN NOT NULL DEFAULT false
            );
        `);
        console.log('✅ Tabla global_audit_events creada (o ya existía).');

        await prisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS idx_global_audit_events_created_at
                ON r4d_app_v1.global_audit_events(created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_global_audit_events_severity_created
                ON r4d_app_v1.global_audit_events(severity, created_at);
            CREATE INDEX IF NOT EXISTS idx_global_audit_events_event_type_created
                ON r4d_app_v1.global_audit_events(event_type, created_at);
            CREATE INDEX IF NOT EXISTS idx_global_audit_events_tenant_created
                ON r4d_app_v1.global_audit_events(tenant_id, created_at);
            CREATE INDEX IF NOT EXISTS idx_global_audit_events_affected_tenant_created
                ON r4d_app_v1.global_audit_events(affected_tenant_id, created_at);
        `);
        console.log('✅ Índices creados.');

        // Verificar que la tabla existe y contar registros
        const result = await prisma.$queryRawUnsafe<any[]>(
            `SELECT COUNT(*) as total FROM r4d_app_v1.global_audit_events`
        );
        console.log(`📊 Registros actuales en la tabla: ${result[0].total}`);
        console.log('🎉 Migración completada exitosamente.');
    } catch (err: any) {
        console.error('❌ Error en la migración:', err.message);
        console.error(err);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

main();
