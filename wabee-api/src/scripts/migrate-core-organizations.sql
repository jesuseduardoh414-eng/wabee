-- ============================================================
-- MIGRACIÓN: Alinear core.organizations con @r4d-26/core schema
-- Ejecutar en Supabase SQL Editor (o aplicado en auto-migración)
-- ============================================================

-- 1. Crear tabla core.products si no existe
--    (requerida por la relación products en organizations)
CREATE TABLE IF NOT EXISTS core.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    base_url TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 2. Agregar columnas faltantes a core.organizations
--    Cada columna usa IF NOT EXISTS para ser idempotente

ALTER TABLE core.organizations
    ADD COLUMN IF NOT EXISTS email TEXT NOT NULL DEFAULT '';

ALTER TABLE core.organizations
    ADD COLUMN IF NOT EXISTS logo_url TEXT;

ALTER TABLE core.organizations
    ADD COLUMN IF NOT EXISTS plan_template_id UUID;

ALTER TABLE core.organizations
    ADD COLUMN IF NOT EXISTS product_id UUID;

ALTER TABLE core.organizations
    ADD COLUMN IF NOT EXISTS external_customer_id TEXT;

ALTER TABLE core.organizations
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE core.organizations
    ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}';

-- 3. Agregar FK de product_id a core.products (si no existe ya)
DO $$ BEGIN
    ALTER TABLE core.organizations
        ADD CONSTRAINT fk_organizations_product
        FOREIGN KEY (product_id)
        REFERENCES core.products(id);
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- FIN DE MIGRACIÓN
-- ============================================================
