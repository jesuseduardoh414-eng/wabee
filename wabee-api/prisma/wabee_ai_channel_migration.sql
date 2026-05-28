-- ============================================================
-- WABEE V7 — Migración: Módulo IA-Canal (v3 FINAL)
-- Fecha: 2026-03-17
-- Descripción: Extiende WhatsappChannel, WhatsappThread y
--   WhatsappMessage para soportar configuración IA por canal,
--   control de atención por thread y trazabilidad por mensaje.
-- Todos los nuevos campos son NULLABLE → sin breaking changes.
-- ============================================================

-- ── 1. NUEVOS TIPOS ENUM ─────────────────────────────────────

-- Modo operativo de la IA en el canal
DO $$ BEGIN
  CREATE TYPE r4d_app_v1."ChannelAiMode" AS ENUM ('autonomous', 'copilot_only', 'disabled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Modo de atención actual del thread (nullable en DB, sin default)
DO $$ BEGIN
  CREATE TYPE r4d_app_v1."ThreadHandlingMode" AS ENUM ('ai', 'human_queue', 'human', 'copilot', 'paused');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Quién envió el mensaje
DO $$ BEGIN
  CREATE TYPE r4d_app_v1."MessageSenderType" AS ENUM ('contact', 'ai', 'human', 'system');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Cómo fue generado el mensaje
DO $$ BEGIN
  CREATE TYPE r4d_app_v1."MessageGeneratedBy" AS ENUM ('ai', 'user', 'workflow', 'template', 'system');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Rol mínimo orientativo para escalamiento humano
DO $$ BEGIN
  CREATE TYPE r4d_app_v1."HumanHandoffRole" AS ENUM ('any_agent', 'senior_agent', 'supervisor', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2. EXTENSIÓN: whatsapp_channels ──────────────────────────

ALTER TABLE r4d_app_v1.whatsapp_channels
  ADD COLUMN IF NOT EXISTS ai_enabled              BOOLEAN                          NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_ai_profile_id   UUID                             NULL
    REFERENCES r4d_app_v1.ai_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS human_handoff_enabled   BOOLEAN                          NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS human_handoff_role      r4d_app_v1."HumanHandoffRole"   NULL,
  -- NOTA: human_team_ref es METADATA INFORMATIVA, no routing autoritativo.
  -- No usar como FK ni como clave de lógica de negocio. Solo orientativa para agentes.
  ADD COLUMN IF NOT EXISTS human_team_ref          VARCHAR(120)                     NULL,
  ADD COLUMN IF NOT EXISTS fallback_message        TEXT                             NULL,
  ADD COLUMN IF NOT EXISTS ai_mode                 r4d_app_v1."ChannelAiMode"      NOT NULL DEFAULT 'disabled';

-- Índice para queries de canales con IA habilitada por tenant
CREATE INDEX IF NOT EXISTS idx_whatsapp_channels_tenant_ai
  ON r4d_app_v1.whatsapp_channels (organization_id, ai_enabled);

CREATE INDEX IF NOT EXISTS idx_whatsapp_channels_ai_profile
  ON r4d_app_v1.whatsapp_channels (default_ai_profile_id)
  WHERE default_ai_profile_id IS NOT NULL;

-- ── 3. EXTENSIÓN: whatsapp_threads ───────────────────────────

ALTER TABLE r4d_app_v1.whatsapp_threads
  -- NULL intencionalmente: openThread() asigna el valor correcto al abrir/crear el thread.
  ADD COLUMN IF NOT EXISTS handling_mode           r4d_app_v1."ThreadHandlingMode" NULL,
  ADD COLUMN IF NOT EXISTS assigned_ai_profile_id  UUID                             NULL
    REFERENCES r4d_app_v1.ai_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ai_paused               BOOLEAN                          NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_paused_at            TIMESTAMPTZ                      NULL,
  ADD COLUMN IF NOT EXISTS ai_paused_by_user_id    UUID                             NULL,
  ADD COLUMN IF NOT EXISTS takeover_reason         VARCHAR(120)                     NULL,
  ADD COLUMN IF NOT EXISTS human_takeover_at       TIMESTAMPTZ                      NULL,
  ADD COLUMN IF NOT EXISTS human_takeover_by       UUID                             NULL,
  ADD COLUMN IF NOT EXISTS last_responder_type     r4d_app_v1."MessageSenderType"  NULL;

-- Índices para queries de inbox y reportabilidad
CREATE INDEX IF NOT EXISTS idx_whatsapp_threads_handling_mode
  ON r4d_app_v1.whatsapp_threads (organization_id, handling_mode);

CREATE INDEX IF NOT EXISTS idx_whatsapp_threads_ai_paused
  ON r4d_app_v1.whatsapp_threads (organization_id, ai_paused)
  WHERE ai_paused = true;

CREATE INDEX IF NOT EXISTS idx_whatsapp_threads_ai_profile
  ON r4d_app_v1.whatsapp_threads (assigned_ai_profile_id)
  WHERE assigned_ai_profile_id IS NOT NULL;

-- ── 4. EXTENSIÓN: whatsapp_messages ──────────────────────────

ALTER TABLE r4d_app_v1.whatsapp_messages
  ADD COLUMN IF NOT EXISTS sender_type     r4d_app_v1."MessageSenderType"   NULL,
  ADD COLUMN IF NOT EXISTS sender_user_id  UUID                              NULL,
  ADD COLUMN IF NOT EXISTS ai_profile_id   UUID                              NULL
    REFERENCES r4d_app_v1.ai_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS generated_by    r4d_app_v1."MessageGeneratedBy"  NULL;

-- Índice para queries de reportabilidad (ai_only/human_only/hybrid)
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_sender_type
  ON r4d_app_v1.whatsapp_messages (thread_id, sender_type, direction)
  WHERE sender_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_ai_profile
  ON r4d_app_v1.whatsapp_messages (ai_profile_id)
  WHERE ai_profile_id IS NOT NULL;

-- ── 5. VERIFICACIÓN RÁPIDA ────────────────────────────────────
-- Ejecutar manualmente para verificar columnas:
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_schema = 'r4d_app_v1' AND table_name = 'whatsapp_channels'
--   AND column_name IN ('ai_enabled','ai_mode','default_ai_profile_id');
