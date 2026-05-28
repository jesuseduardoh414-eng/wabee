-- ============================================================
-- WABEE V7 — Migración: Handoff Aggressiveness en AiProfile
-- Fecha: 2026-04-09
-- Descripción: Agrega el campo handoff_aggressiveness a ai_profiles
--   para controlar la agresividad del agente ante KB insuficiente.
-- ============================================================

ALTER TABLE r4d_app_v1.ai_profiles
  ADD COLUMN IF NOT EXISTS handoff_aggressiveness VARCHAR(20) NOT NULL DEFAULT 'balanced';

-- Comentario informativo en la columna
COMMENT ON COLUMN r4d_app_v1.ai_profiles.handoff_aggressiveness 
  IS 'Nivel de agresividad ante KB insuficiente: conservative | balanced | aggressive';

-- Verificación:
-- SELECT id, name, handoff_aggressiveness FROM r4d_app_v1.ai_profiles LIMIT 5;
