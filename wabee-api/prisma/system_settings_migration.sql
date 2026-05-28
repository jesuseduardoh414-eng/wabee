-- ============================================================
-- WABEE – Migración: Tabla system_settings en schema core
-- Ejecutar manualmente si la tabla no existe todavía en la BD.
-- Este script es idempotente (usa IF NOT EXISTS).
-- ============================================================

CREATE TABLE IF NOT EXISTS core.system_settings (
    key        TEXT        PRIMARY KEY,
    value      JSONB       NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Comentario de tabla para documentación
COMMENT ON TABLE core.system_settings IS
    'Configuración global de plataforma (branding, feature flags, etc.). '
    'Cada fila es una clave/valor JSON. No es por tenant.';

-- Seed inicial de tipografía con los 20 grupos canónicos.
-- Usa ON CONFLICT DO NOTHING para no sobrescribir configuración existente.
INSERT INTO core.system_settings (key, value)
VALUES (
    'global_branding_typography',
    '{
        "pageTitle":       { "color": "#ffffff", "fontFamily": "Inter" },
        "pageSubtitle":    { "color": "#a0a080", "fontFamily": "Inter" },
        "sectionTitle":    { "color": "#ffffff", "fontFamily": "Inter" },
        "sectionSubtitle": { "color": "#a0a080", "fontFamily": "Inter" },
        "cardTitle":       { "color": "#ffffff", "fontFamily": "Inter" },
        "cardSubtitle":    { "color": "#4a4a3a", "fontFamily": "Inter" },
        "kpiLabel":        { "color": "#4a4a3a", "fontFamily": "Inter" },
        "kpiValue":        { "color": "#ffffff", "fontFamily": "Inter" },
        "labelText":       { "color": "#4a4a3a", "fontFamily": "Inter" },
        "inputText":       { "color": "#ffffff", "fontFamily": "Inter" },
        "buttonText":      { "color": "#121208", "fontFamily": "Inter" },
        "navText":         { "color": "#a0a080", "fontFamily": "Inter" },
        "menuText":        { "color": "#a0a080", "fontFamily": "Inter" },
        "tableHeader":     { "color": "#a0a080", "fontFamily": "Inter" },
        "tableCell":       { "color": "#ffffff", "fontFamily": "Inter" },
        "statusText":      { "color": "#a0a080", "fontFamily": "Inter" },
        "messageText":     { "color": "#ffffff", "fontFamily": "Inter" },
        "helperText":      { "color": "#4a4a3a", "fontFamily": "Inter" },
        "emptyStateTitle": { "color": "#ffffff", "fontFamily": "Inter" },
        "emptyStateBody":  { "color": "#a0a080", "fontFamily": "Inter" }
    }'::jsonb
)
ON CONFLICT (key) DO NOTHING;
