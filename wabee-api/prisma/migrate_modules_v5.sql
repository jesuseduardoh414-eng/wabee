-- Migración: Agregar campos físicos para Módulos (modulesJson / modulesSnapshot)
-- Fecha: 2026-03-26

-- 1. Agregar columna 'modules' a 'plan_templates' (Default visual)
ALTER TABLE core.plan_templates ADD COLUMN IF NOT EXISTS modules JSONB DEFAULT '{}';

-- 2. Agregar columna 'modules_json' a 'plan_versions' (Fuente de verdad versionada)
ALTER TABLE core.plan_versions ADD COLUMN IF NOT EXISTS modules_json JSONB DEFAULT '{}';

-- 3. Agregar columna 'modules_snapshot' a 'subscriptions' (Snapshot contratado)
ALTER TABLE core.subscriptions ADD COLUMN IF NOT EXISTS modules_snapshot JSONB DEFAULT '{}';

-- 4. Poblar datos existentes con el set completo de módulos (Retrocompatibilidad)
DO $$
BEGIN
    UPDATE core.plan_versions 
    SET modules_json = '{"team":true,"audit":true,"dashboard":true,"inbox":true,"contacts":true,"segments":true,"groups":true,"channels":true,"aiProfiles":true,"webWidgets":true,"campaigns":true,"templatesHub":true,"integrationsTools":true}'::jsonb
    WHERE modules_json = '{}'::jsonb OR modules_json IS NULL;

    UPDATE core.subscriptions 
    SET modules_snapshot = '{"team":true,"audit":true,"dashboard":true,"inbox":true,"contacts":true,"segments":true,"groups":true,"channels":true,"aiProfiles":true,"webWidgets":true,"campaigns":true,"templatesHub":true,"integrationsTools":true}'::jsonb
    WHERE modules_snapshot = '{}'::jsonb OR modules_snapshot IS NULL;

    UPDATE core.plan_templates 
    SET modules = '{"team":true,"audit":true,"dashboard":true,"inbox":true,"contacts":true,"segments":true,"groups":true,"channels":true,"aiProfiles":true,"webWidgets":true,"campaigns":true,"templatesHub":true,"integrationsTools":true}'::jsonb
    WHERE modules = '{}'::jsonb OR modules IS NULL;
END $$;
