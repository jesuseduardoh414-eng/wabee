-- ============================================================
-- FIX: Alineación de core.subscriptions con schema.prisma
-- Ejecutar en Supabase SQL Editor (o psql directo en Render)
-- Seguro de re-ejecutar: usa IF NOT EXISTS en todo
-- ============================================================

-- 1. Campo principal que causó el error en billing.service.ts
ALTER TABLE core.subscriptions
  ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ(6);

-- 2. Campos de snapshot del plan al momento de suscribir
--    (definidos en schema.prisma líneas 438-448 pero pueden faltar en BD real)
ALTER TABLE core.subscriptions
  ADD COLUMN IF NOT EXISTS snapshot_json        JSONB    DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS price_snapshot       FLOAT,
  ADD COLUMN IF NOT EXISTS currency_snapshot    TEXT,
  ADD COLUMN IF NOT EXISTS billing_interval_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS plan_code_snapshot   TEXT,
  ADD COLUMN IF NOT EXISTS plan_name_snapshot   TEXT,
  ADD COLUMN IF NOT EXISTS features_snapshot    JSONB    DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS limits_snapshot      JSONB    DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS capabilities_snapshot JSONB   DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS version_number_snapshot INT,
  ADD COLUMN IF NOT EXISTS snapshot_created_at  TIMESTAMPTZ(6);

-- 3. Campos de trial (pueden faltar en instalaciones antiguas)
ALTER TABLE core.subscriptions
  ADD COLUMN IF NOT EXISTS trial_starts_at TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS trial_ends_at   TIMESTAMPTZ(6);

-- 4. Campos de plan versioning (plan_version_id)
ALTER TABLE core.subscriptions
  ADD COLUMN IF NOT EXISTS plan_version_id UUID
    REFERENCES core.plan_versions(id);

-- 5. Verificación: lista las columnas actuales de la tabla
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'core'
  AND table_name = 'subscriptions'
ORDER BY ordinal_position;
