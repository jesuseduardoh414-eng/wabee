-- ============================================================
-- WABEE Legacy Domain Models - Migration Script
-- Run this in Supabase SQL Editor to create all missing tables.
-- ============================================================

-- Ensure schema exists
CREATE SCHEMA IF NOT EXISTS r4d_app_v1;

-- ENUMS
DO $$ BEGIN
  CREATE TYPE r4d_app_v1."ContactStatus" AS ENUM ('ACTIVE', 'BLOCKED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE r4d_app_v1."ContactLifecycleStatus" AS ENUM ('NEW', 'LEAD', 'ACTIVE', 'CUSTOMER', 'INACTIVE', 'BLOCKED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE r4d_app_v1."WebThreadStatus" AS ENUM ('OPEN', 'PENDING', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE r4d_app_v1."WebMessageActorType" AS ENUM ('USER', 'SYSTEM', 'ASSISTANT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE r4d_app_v1."FallbackMode" AS ENUM ('PRESET_A', 'PRESET_B', 'PRESET_C', 'CUSTOM');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE r4d_app_v1."GreetingStyle" AS ENUM ('SHORT', 'MEDIUM', 'WARM');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE r4d_app_v1."AiChannelType" AS ENUM ('WIDGET', 'WHATSAPP');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- META OAUTH SESSIONS
CREATE TABLE IF NOT EXISTS r4d_app_v1.meta_oauth_sessions (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id        UUID NOT NULL,
    provider               TEXT NOT NULL DEFAULT 'META',
    access_token_ciphertext TEXT NOT NULL,
    access_token_iv        TEXT NOT NULL,
    access_token_tag       TEXT NOT NULL,
    token_expires_at       TIMESTAMPTZ,
    scopes                 TEXT[] NOT NULL DEFAULT '{}',
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_meta_oauth_sessions_tenant ON r4d_app_v1.meta_oauth_sessions(organization_id);

-- WHATSAPP CHANNELS
CREATE TABLE IF NOT EXISTS r4d_app_v1.whatsapp_channels (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id      UUID NOT NULL,
    name                 TEXT NOT NULL,
    purpose              TEXT NOT NULL DEFAULT 'GENERAL',
    status               TEXT NOT NULL DEFAULT 'CONNECTED',
    waba_id              TEXT NOT NULL,
    phone_number_id      TEXT NOT NULL,
    meta_app_id          TEXT,
    display_phone        TEXT,
    verified_name        TEXT,
    webhook_status       TEXT NOT NULL DEFAULT 'PENDING',
    health_status        TEXT NOT NULL DEFAULT 'UNKNOWN',
    health_failure_count INT NOT NULL DEFAULT 0,
    last_healthy_at      TIMESTAMPTZ,
    last_health_check_at TIMESTAMPTZ,
    last_error_code      TEXT,
    last_error_message   TEXT,
    last_error_at        TIMESTAMPTZ,
    oauth_session_id     UUID REFERENCES r4d_app_v1.meta_oauth_sessions(id),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    archived_at          TIMESTAMPTZ,
    UNIQUE(organization_id, phone_number_id)
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_channels_tenant ON r4d_app_v1.whatsapp_channels(organization_id);

-- CONTACTS
CREATE TABLE IF NOT EXISTS r4d_app_v1.contacts (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id       UUID NOT NULL,
    phone                 TEXT NOT NULL,
    name                  TEXT,
    email                 TEXT,
    last_interaction_at   TIMESTAMPTZ,
    status                r4d_app_v1."ContactStatus" NOT NULL DEFAULT 'ACTIVE',
    lifecycle_status      r4d_app_v1."ContactLifecycleStatus" NOT NULL DEFAULT 'NEW',
    external_crm_id       TEXT,
    source_system         TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tags                  JSONB NOT NULL DEFAULT '[]',
    UNIQUE(organization_id, phone)
);
CREATE INDEX IF NOT EXISTS idx_contacts_tenant ON r4d_app_v1.contacts(organization_id, phone);
CREATE INDEX IF NOT EXISTS idx_contacts_lifecycle ON r4d_app_v1.contacts(organization_id, lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON r4d_app_v1.contacts(organization_id, status);

-- WHATSAPP THREADS
CREATE TABLE IF NOT EXISTS r4d_app_v1.whatsapp_threads (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id         UUID NOT NULL,
    channel_id              UUID NOT NULL REFERENCES r4d_app_v1.whatsapp_channels(id),
    contact_phone           TEXT NOT NULL,
    contact_name            TEXT,
    last_message_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_message_preview    TEXT,
    unread_count            INT NOT NULL DEFAULT 0,
    status                  TEXT NOT NULL DEFAULT 'OPEN',
    metadata                JSONB,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    contact_id              UUID REFERENCES r4d_app_v1.contacts(id),
    assigned_user_id        UUID,
    context_state           JSONB,
    current_flow_version_id TEXT,
    source                  TEXT,
    UNIQUE(organization_id, channel_id, contact_phone)
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_threads_tenant ON r4d_app_v1.whatsapp_threads(organization_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_threads_channel ON r4d_app_v1.whatsapp_threads(channel_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_threads_last_msg ON r4d_app_v1.whatsapp_threads(last_message_at);
CREATE INDEX IF NOT EXISTS idx_whatsapp_threads_contact ON r4d_app_v1.whatsapp_threads(organization_id, contact_id);

-- WHATSAPP MESSAGES
CREATE TABLE IF NOT EXISTS r4d_app_v1.whatsapp_messages (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    channel_id     UUID NOT NULL REFERENCES r4d_app_v1.whatsapp_channels(id),
    direction      TEXT NOT NULL,
    thread_id      UUID REFERENCES r4d_app_v1.whatsapp_threads(id),
    wa_message_id  TEXT UNIQUE,
    from_phone     TEXT NOT NULL,
    to_phone       TEXT NOT NULL,
    remote_phone   TEXT NOT NULL,
    type           TEXT NOT NULL,
    text_body      TEXT,
    timestamp      TIMESTAMPTZ NOT NULL,
    status         TEXT NOT NULL DEFAULT 'RECEIVED',
    error_code     TEXT,
    error_message  TEXT,
    delivered_at   TIMESTAMPTZ,
    read_at        TIMESTAMPTZ,
    raw_payload    JSONB,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata       JSONB,
    source         TEXT
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_tenant ON r4d_app_v1.whatsapp_messages(organization_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_channel ON r4d_app_v1.whatsapp_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_thread ON r4d_app_v1.whatsapp_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_ts ON r4d_app_v1.whatsapp_messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_remote ON r4d_app_v1.whatsapp_messages(remote_phone);

-- WHATSAPP MESSAGE STATUSES
CREATE TABLE IF NOT EXISTS r4d_app_v1.whatsapp_message_statuses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    channel_id      UUID NOT NULL REFERENCES r4d_app_v1.whatsapp_channels(id),
    wa_message_id   TEXT NOT NULL,
    status          TEXT NOT NULL,
    timestamp       TIMESTAMPTZ NOT NULL,
    raw_payload     JSONB NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wa_msg_statuses_wa_id ON r4d_app_v1.whatsapp_message_statuses(wa_message_id);
CREATE INDEX IF NOT EXISTS idx_wa_msg_statuses_channel ON r4d_app_v1.whatsapp_message_statuses(channel_id);

-- THREAD NOTES
CREATE TABLE IF NOT EXISTS r4d_app_v1.thread_notes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    thread_id       UUID NOT NULL REFERENCES r4d_app_v1.whatsapp_threads(id) ON DELETE CASCADE,
    author_user_id  UUID,
    body            TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_thread_notes ON r4d_app_v1.thread_notes(organization_id, thread_id);

-- WHATSAPP TEMPLATES
CREATE TABLE IF NOT EXISTS r4d_app_v1.whatsapp_templates (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id  UUID NOT NULL,
    channel_id       UUID NOT NULL REFERENCES r4d_app_v1.whatsapp_channels(id),
    name             TEXT NOT NULL,
    language         TEXT NOT NULL,
    category         TEXT NOT NULL,
    status           TEXT NOT NULL,
    components       JSONB NOT NULL,
    meta_template_id TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, channel_id, name, language)
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_tenant ON r4d_app_v1.whatsapp_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_channel ON r4d_app_v1.whatsapp_templates(channel_id);

-- GROUPS
CREATE TABLE IF NOT EXISTS r4d_app_v1.groups (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, name)
);
CREATE INDEX IF NOT EXISTS idx_groups_tenant ON r4d_app_v1.groups(organization_id, name);

-- CONTACT GROUPS (M2M)
CREATE TABLE IF NOT EXISTS r4d_app_v1.contact_groups (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    contact_id      UUID NOT NULL REFERENCES r4d_app_v1.contacts(id) ON DELETE CASCADE,
    group_id        UUID NOT NULL REFERENCES r4d_app_v1.groups(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, contact_id, group_id)
);
CREATE INDEX IF NOT EXISTS idx_contact_groups_group ON r4d_app_v1.contact_groups(organization_id, group_id);
CREATE INDEX IF NOT EXISTS idx_contact_groups_contact ON r4d_app_v1.contact_groups(organization_id, contact_id);

-- SAVED SEGMENTS
CREATE TABLE IF NOT EXISTS r4d_app_v1.saved_segments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    filter          JSONB NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, name)
);
CREATE INDEX IF NOT EXISTS idx_saved_segments_tenant ON r4d_app_v1.saved_segments(organization_id);

-- CONTACT LIFECYCLE EVENTS
CREATE TABLE IF NOT EXISTS r4d_app_v1.contact_lifecycle_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    contact_id      UUID NOT NULL REFERENCES r4d_app_v1.contacts(id),
    from_status     r4d_app_v1."ContactLifecycleStatus" NOT NULL,
    to_status       r4d_app_v1."ContactLifecycleStatus" NOT NULL,
    actor_user_id   UUID,
    source          TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lifecycle_events_contact ON r4d_app_v1.contact_lifecycle_events(organization_id, contact_id);
CREATE INDEX IF NOT EXISTS idx_lifecycle_events_ts ON r4d_app_v1.contact_lifecycle_events(organization_id, created_at);

-- WEB WIDGETS
CREATE TABLE IF NOT EXISTS r4d_app_v1.web_widgets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    title           TEXT NOT NULL,
    subtitle        TEXT,
    welcome_message TEXT,
    domain_allowed  TEXT[] NOT NULL DEFAULT '{}',
    ai_enabled      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    features        JSONB,
    theme           JSONB,
    content         JSONB,
    ai              JSONB
);
CREATE INDEX IF NOT EXISTS idx_web_widgets_tenant ON r4d_app_v1.web_widgets(organization_id);

-- WEB THREADS
CREATE TABLE IF NOT EXISTS r4d_app_v1.web_threads (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL,
    widget_id           UUID NOT NULL REFERENCES r4d_app_v1.web_widgets(id),
    visitor_id          TEXT NOT NULL,
    session_id          TEXT,
    status              r4d_app_v1."WebThreadStatus" NOT NULL DEFAULT 'OPEN',
    context_state       JSONB,
    ai_paused           BOOLEAN NOT NULL DEFAULT FALSE,
    ai_paused_at        TIMESTAMPTZ,
    ai_paused_by_user_id UUID,
    last_message_at     TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_web_threads_tenant ON r4d_app_v1.web_threads(organization_id);
CREATE INDEX IF NOT EXISTS idx_web_threads_widget ON r4d_app_v1.web_threads(widget_id);

-- WEB MESSAGES
CREATE TABLE IF NOT EXISTS r4d_app_v1.web_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    thread_id       UUID NOT NULL REFERENCES r4d_app_v1.web_threads(id),
    direction       TEXT NOT NULL,
    actor_type      r4d_app_v1."WebMessageActorType" NOT NULL,
    text            TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_web_messages_thread ON r4d_app_v1.web_messages(organization_id, thread_id);

-- AI PROFILES
CREATE TABLE IF NOT EXISTS r4d_app_v1.ai_profiles (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id         UUID NOT NULL,
    name                    TEXT NOT NULL,
    tone                    TEXT,
    tones                   TEXT[] NOT NULL DEFAULT '{}',
    system_prompt           TEXT NOT NULL,
    agent_name              TEXT,
    role_title              TEXT,
    personality_notes       TEXT,
    examples                JSONB,
    greeting_style          r4d_app_v1."GreetingStyle" NOT NULL DEFAULT 'WARM',
    fallback_message        TEXT,
    fallback_mode           r4d_app_v1."FallbackMode" NOT NULL DEFAULT 'CUSTOM',
    fallback_custom_message TEXT,
    max_tokens              INT NOT NULL DEFAULT 512,
    confidence_threshold    FLOAT NOT NULL DEFAULT 0.6,
    channel_type            r4d_app_v1."AiChannelType" NOT NULL DEFAULT 'WIDGET',
    kb_enabled              BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_profiles_tenant ON r4d_app_v1.ai_profiles(organization_id);

-- KB FILES
CREATE TABLE IF NOT EXISTS r4d_app_v1.kb_files (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    profile_id      UUID REFERENCES r4d_app_v1.ai_profiles(id) ON DELETE CASCADE,
    filename        TEXT NOT NULL,
    mime_type       TEXT NOT NULL,
    size            INT NOT NULL,
    storage_path    TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'PROCESSING',
    error           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kb_files_tenant ON r4d_app_v1.kb_files(organization_id);
CREATE INDEX IF NOT EXISTS idx_kb_files_profile ON r4d_app_v1.kb_files(organization_id, profile_id);

-- KB CHUNKS
CREATE TABLE IF NOT EXISTS r4d_app_v1.kb_chunks (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    file_id      UUID NOT NULL REFERENCES r4d_app_v1.kb_files(id) ON DELETE CASCADE,
    profile_id   UUID,
    idx          INT NOT NULL DEFAULT 0,
    section      VARCHAR(120),
    content      TEXT NOT NULL,
    content_norm TEXT NOT NULL DEFAULT '',
    char_start   INT,
    char_end     INT,
    embedding    JSONB,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kb_chunks_tenant ON r4d_app_v1.kb_chunks(organization_id);
CREATE INDEX IF NOT EXISTS idx_kb_chunks_file ON r4d_app_v1.kb_chunks(file_id);
CREATE INDEX IF NOT EXISTS idx_kb_chunks_profile ON r4d_app_v1.kb_chunks(organization_id, profile_id);

-- AI AUDIT LOGS
CREATE TABLE IF NOT EXISTS r4d_app_v1.ai_audit_logs (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id  UUID NOT NULL,
    channel          TEXT NOT NULL,
    widget_id        UUID,
    thread_id        UUID,
    effective_prompt TEXT NOT NULL,
    provider         TEXT NOT NULL DEFAULT 'OLLAMA',
    model            TEXT NOT NULL,
    response_text    TEXT,
    confidence_score FLOAT,
    action           TEXT NOT NULL,
    error_message    TEXT,
    kb_file_ids      JSONB,
    kb_chunk_ids     JSONB,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_audit_tenant ON r4d_app_v1.ai_audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_audit_widget ON r4d_app_v1.ai_audit_logs(widget_id);
CREATE INDEX IF NOT EXISTS idx_ai_audit_thread ON r4d_app_v1.ai_audit_logs(thread_id);
CREATE INDEX IF NOT EXISTS idx_ai_audit_ts ON r4d_app_v1.ai_audit_logs(created_at);

-- Grant perms to anon/authenticated roles (Supabase)
GRANT USAGE ON SCHEMA r4d_app_v1 TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA r4d_app_v1 TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA r4d_app_v1 TO authenticated;
