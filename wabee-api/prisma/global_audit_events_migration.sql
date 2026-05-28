-- =====================================================
-- MIGRACIÓN: global_audit_events
-- Tabla de Auditoría Global para Super Admin
-- Ejecutar en el schema r4d_app_v1
-- =====================================================

CREATE TABLE IF NOT EXISTS r4d_app_v1.global_audit_events (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tenant_id        UUID,
    affected_tenant_id UUID,
    actor_type       TEXT NOT NULL,           -- user, system, system_impersonation
    actor_user_id    UUID,
    actor_email      TEXT,
    actor_role       TEXT,
    event_type       TEXT NOT NULL,
    category         TEXT NOT NULL,           -- auth, user, org, system, billing, super_admin
    severity         TEXT NOT NULL,           -- info, warning, critical, success
    outcome          TEXT NOT NULL,           -- success, failure
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

-- Índices para consultas frecuentes del Super Admin
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
