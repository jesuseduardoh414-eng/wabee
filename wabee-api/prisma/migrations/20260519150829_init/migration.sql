-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "wabee";

-- CreateEnum
CREATE TYPE "wabee"."ContactStatus" AS ENUM ('ACTIVE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "wabee"."ContactLifecycleStatus" AS ENUM ('NEW', 'LEAD', 'ACTIVE', 'CUSTOMER', 'INACTIVE', 'BLOCKED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "wabee"."WebThreadStatus" AS ENUM ('OPEN', 'PENDING', 'CLOSED');

-- CreateEnum
CREATE TYPE "wabee"."WebMessageActorType" AS ENUM ('USER', 'SYSTEM', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "wabee"."FallbackMode" AS ENUM ('PRESET_A', 'PRESET_B', 'PRESET_C', 'CUSTOM');

-- CreateEnum
CREATE TYPE "wabee"."GreetingStyle" AS ENUM ('SHORT', 'MEDIUM', 'WARM');

-- CreateEnum
CREATE TYPE "wabee"."WhatsappCampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'CANCELED', 'FAILED');

-- CreateEnum
CREATE TYPE "wabee"."WhatsappCampaignMessageStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "wabee"."AnalyticsEventType" AS ENUM ('THREAD_CREATED', 'THREAD_STATUS_CHANGED', 'THREAD_REOPENED', 'MESSAGE_INBOUND_USER', 'MESSAGE_OUTBOUND_HUMAN', 'MESSAGE_OUTBOUND_AI', 'MESSAGE_OUTBOUND_FLOW', 'AI_GATING_BLOCKED', 'AI_FALLBACK_TO_HUMAN', 'HUMAN_TAKEOVER', 'THREAD_ASSIGNED_TO_HUMAN', 'THREAD_UNASSIGNED', 'CAMPAIGN_MESSAGE_SENT', 'CAMPAIGN_MESSAGE_DELIVERED', 'CAMPAIGN_MESSAGE_READ', 'CAMPAIGN_MESSAGE_FAILED', 'CRM_EVENT');

-- CreateEnum
CREATE TYPE "wabee"."AnalyticsActorType" AS ENUM ('HUMAN', 'AI', 'FLOW', 'SYSTEM');

-- CreateEnum
CREATE TYPE "wabee"."AiChannelType" AS ENUM ('WIDGET', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "wabee"."ChannelAiMode" AS ENUM ('autonomous', 'copilot_only', 'disabled');

-- CreateEnum
CREATE TYPE "wabee"."ThreadHandlingMode" AS ENUM ('ai', 'human_queue', 'human', 'copilot', 'paused');

-- CreateEnum
CREATE TYPE "wabee"."MessageSenderType" AS ENUM ('contact', 'ai', 'human', 'system');

-- CreateEnum
CREATE TYPE "wabee"."MessageGeneratedBy" AS ENUM ('ai', 'user', 'workflow', 'template', 'system');

-- CreateEnum
CREATE TYPE "wabee"."HumanHandoffRole" AS ENUM ('any_agent', 'senior_agent', 'supervisor', 'admin');

-- CreateEnum
CREATE TYPE "wabee"."ServiceSlotType" AS ENUM ('TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT', 'PHONE', 'EMAIL');

-- CreateEnum
CREATE TYPE "wabee"."ServiceToolExecutionMode" AS ENUM ('AUTO', 'MANUAL', 'HYBRID');

-- CreateEnum
CREATE TYPE "wabee"."ServiceToolActionType" AS ENUM ('READ', 'CREATE', 'UPDATE', 'DELETE');

-- CreateEnum
CREATE TYPE "wabee"."AiServiceIntentType" AS ENUM ('INFO', 'INTEREST', 'TRANSACTION');

-- CreateEnum
CREATE TYPE "wabee"."ServiceType" AS ENUM ('INFORMATIONAL', 'TRANSACTIONAL', 'HYBRID');

-- CreateEnum
CREATE TYPE "wabee"."ToolAuthType" AS ENUM ('NONE', 'BEARER_TOKEN', 'API_KEY_HEADER', 'BASIC_AUTH');

-- CreateEnum
CREATE TYPE "wabee"."ToolCapability" AS ENUM ('product_search', 'service_search', 'appointment_lookup', 'appointment_create', 'quote_request', 'order_status', 'inventory_check', 'faq_lookup', 'customer_lookup', 'lead_create', 'reservation_check', 'reservation_create', 'payment_link_create', 'shipment_quote', 'shipment_tracking', 'general_api_fetch', 'CUSTOM');

-- CreateEnum
CREATE TYPE "wabee"."ToolConfirmationPolicy" AS ENUM ('AUTO', 'HYBRID', 'MANUAL');

-- CreateEnum
CREATE TYPE "wabee"."HttpMethod" AS ENUM ('GET', 'POST', 'PUT', 'DELETE', 'PATCH');

-- CreateEnum
CREATE TYPE "wabee"."ToolExecutionStatus" AS ENUM ('PENDING', 'SUCCESS', 'ERROR', 'REJECTED');

-- CreateEnum
CREATE TYPE "wabee"."FormStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "wabee"."ConversationMode" AS ENUM ('AI_MANAGED', 'HUMAN_HANDOFF', 'DISABLED', 'FORM_FILLING', 'AWAITING_TOOL_CONFIRMATION');

-- CreateEnum
CREATE TYPE "wabee"."InboxAuditActorType" AS ENUM ('human', 'ai', 'system');

-- CreateEnum
CREATE TYPE "wabee"."InboxAuditActorRole" AS ENUM ('agent', 'supervisor', 'admin', 'bot', 'system');

-- CreateEnum
CREATE TYPE "wabee"."InboxAuditEventType" AS ENUM ('THREAD_TAKEN', 'HUMAN_TAKEOVER', 'HUMAN_MESSAGE_SENT', 'THREAD_ASSIGNED', 'THREAD_REASSIGNED', 'THREAD_UNASSIGNED', 'THREAD_CLOSED', 'THREAD_REOPENED', 'INTERNAL_NOTE_ADDED', 'AI_HANDOFF_TO_HUMAN', 'AI_MESSAGE_SENT', 'THREAD_RESOLVED', 'TEMPLATE_SENT');

-- CreateTable
CREATE TABLE "wabee"."UserProfile" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wabee"."auth_challenges" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'LOGIN_2FA',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "consumed_at" TIMESTAMPTZ,

    CONSTRAINT "auth_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wabee"."meta_oauth_sessions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'META',
    "access_token_ciphertext" TEXT NOT NULL,
    "access_token_iv" TEXT NOT NULL,
    "access_token_tag" TEXT NOT NULL,
    "token_expires_at" TIMESTAMPTZ,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "meta_oauth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wabee"."whatsapp_channels" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'GENERAL',
    "status" TEXT NOT NULL DEFAULT 'CONNECTED',
    "waba_id" TEXT NOT NULL,
    "phone_number_id" TEXT NOT NULL,
    "meta_app_id" TEXT,
    "display_phone" TEXT,
    "verified_name" TEXT,
    "webhook_status" TEXT NOT NULL DEFAULT 'PENDING',
    "health_status" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "health_failure_count" INTEGER NOT NULL DEFAULT 0,
    "last_healthy_at" TIMESTAMPTZ,
    "last_health_check_at" TIMESTAMPTZ,
    "last_error_code" TEXT,
    "last_error_message" TEXT,
    "last_error_at" TIMESTAMPTZ,
    "oauth_session_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "archived_at" TIMESTAMPTZ,
    "ai_enabled" BOOLEAN NOT NULL DEFAULT false,
    "default_ai_profile_id" UUID,
    "human_handoff_enabled" BOOLEAN NOT NULL DEFAULT true,
    "human_handoff_role" "wabee"."HumanHandoffRole",
    "human_team_ref" VARCHAR(120),
    "fallback_message" TEXT,
    "ai_mode" "wabee"."ChannelAiMode" NOT NULL DEFAULT 'disabled',

    CONSTRAINT "whatsapp_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wabee"."whatsapp_messages" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "channel_id" UUID NOT NULL,
    "direction" TEXT NOT NULL,
    "thread_id" UUID,
    "wa_message_id" TEXT,
    "from_phone" TEXT NOT NULL,
    "to_phone" TEXT NOT NULL,
    "remote_phone" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "text_body" TEXT,
    "timestamp" TIMESTAMPTZ(6) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "delivery_status" TEXT,
    "error_code" TEXT,
    "error_message" TEXT,
    "delivered_at" TIMESTAMPTZ,
    "read_at" TIMESTAMPTZ,
    "raw_payload" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "source" TEXT,
    "external_ref" TEXT,
    "sender_type" "wabee"."MessageSenderType",
    "sender_user_id" UUID,
    "ai_profile_id" UUID,
    "generated_by" "wabee"."MessageGeneratedBy",

    CONSTRAINT "whatsapp_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wabee"."whatsapp_threads" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "channel_id" UUID NOT NULL,
    "contact_phone" TEXT NOT NULL,
    "contact_name" TEXT,
    "last_message_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_message_preview" TEXT,
    "unread_count" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "contact_id" UUID,
    "assigned_user_id" UUID,
    "context_state" JSONB,
    "current_flow_version_id" TEXT,
    "source" TEXT,
    "handling_mode" "wabee"."ThreadHandlingMode",
    "assigned_ai_profile_id" UUID,
    "ai_paused" BOOLEAN NOT NULL DEFAULT false,
    "ai_paused_at" TIMESTAMPTZ,
    "ai_paused_by_user_id" UUID,
    "takeover_reason" VARCHAR(120),
    "human_takeover_at" TIMESTAMPTZ,
    "human_takeover_by" UUID,
    "last_responder_type" "wabee"."MessageSenderType",

    CONSTRAINT "whatsapp_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wabee"."whatsapp_thread_notes" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "threadId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "createdById" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "whatsapp_thread_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wabee"."contacts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "last_interaction_at" TIMESTAMPTZ,
    "status" "wabee"."ContactStatus" NOT NULL DEFAULT 'ACTIVE',
    "lifecycle_status" "wabee"."ContactLifecycleStatus" NOT NULL DEFAULT 'NEW',
    "external_crm_id" TEXT,
    "source_system" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "tags" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wabee"."groups" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wabee"."contact_groups" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wabee"."saved_segments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "filter" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "saved_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wabee"."contact_lifecycle_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "from_status" "wabee"."ContactLifecycleStatus" NOT NULL,
    "to_status" "wabee"."ContactLifecycleStatus" NOT NULL,
    "actor_user_id" UUID,
    "source" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_lifecycle_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wabee"."whatsapp_message_statuses" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "channel_id" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "timestamp" TIMESTAMPTZ(6) NOT NULL,
    "raw_payload" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_message_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wabee"."thread_notes" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "thread_id" UUID NOT NULL,
    "author_user_id" UUID,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "thread_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wabee"."whatsapp_templates" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "channel_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "components" JSONB NOT NULL,
    "meta_template_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "whatsapp_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wabee"."web_widgets" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "welcome_message" TEXT,
    "domain_allowed" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ai_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "features" JSONB,
    "theme" JSONB,
    "content" JSONB,
    "ai" JSONB,

    CONSTRAINT "web_widgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wabee"."web_threads" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "widget_id" UUID NOT NULL,
    "visitor_id" TEXT NOT NULL,
    "session_id" TEXT,
    "status" "wabee"."WebThreadStatus" NOT NULL DEFAULT 'OPEN',
    "context_state" JSONB,
    "ai_paused" BOOLEAN NOT NULL DEFAULT false,
    "ai_paused_at" TIMESTAMPTZ,
    "ai_paused_by_user_id" UUID,
    "last_message_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "web_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wabee"."web_messages" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "thread_id" UUID NOT NULL,
    "direction" TEXT NOT NULL,
    "actor_type" "wabee"."WebMessageActorType" NOT NULL,
    "text" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "web_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wabee"."ai_profiles" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "tone" TEXT,
    "tones" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "system_prompt" TEXT NOT NULL,
    "agent_name" TEXT,
    "role_title" TEXT,
    "personality_notes" TEXT,
    "examples" JSONB,
    "greeting_style" "wabee"."GreetingStyle" NOT NULL DEFAULT 'WARM',
    "fallback_message" TEXT,
    "fallback_mode" "wabee"."FallbackMode" NOT NULL DEFAULT 'CUSTOM',
    "fallback_custom_message" TEXT,
    "max_tokens" INTEGER NOT NULL DEFAULT 512,
    "confidence_threshold" DOUBLE PRECISION NOT NULL DEFAULT 0.6,
    "channel_type" "wabee"."AiChannelType" NOT NULL DEFAULT 'WIDGET',
    "kb_enabled" BOOLEAN NOT NULL DEFAULT true,
    "handoff_aggressiveness" VARCHAR(20) NOT NULL DEFAULT 'balanced',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ai_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wabee"."kb_files" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "profile_id" UUID,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storage_path" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "error" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "kb_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wabee"."kb_chunks" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "profile_id" UUID,
    "idx" INTEGER NOT NULL DEFAULT 0,
    "section" VARCHAR(120),
    "content" TEXT NOT NULL,
    "content_norm" TEXT NOT NULL DEFAULT '',
    "char_start" INTEGER,
    "char_end" INTEGER,
    "embedding" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kb_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wabee"."ai_audit_logs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "widget_id" UUID,
    "thread_id" UUID,
    "effective_prompt" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'OLLAMA',
    "model" TEXT NOT NULL,
    "response_text" TEXT,
    "confidence_score" DOUBLE PRECISION,
    "action" TEXT NOT NULL,
    "error_message" TEXT,
    "kb_file_ids" JSONB,
    "kb_chunk_ids" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wabee"."whatsapp_campaigns" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "channel_id" UUID NOT NULL,
    "template_id" UUID,
    "name" TEXT NOT NULL,
    "status" "wabee"."WhatsappCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "audience_type" TEXT NOT NULL,
    "audience_filter" JSONB,
    "audience_snapshot_path" TEXT,
    "audience_snapshot_hash" TEXT,
    "scheduled_at" TIMESTAMPTZ,
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "estimated_recipients" INTEGER NOT NULL DEFAULT 0,
    "pause_reason" TEXT,
    "template_input_mapping" JSONB,
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "delivered_count" INTEGER NOT NULL DEFAULT 0,
    "read_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "whatsapp_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wabee"."whatsapp_campaign_messages" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "message_id" UUID,
    "wa_message_id" TEXT,
    "status" "wabee"."WhatsappCampaignMessageStatus" NOT NULL DEFAULT 'PENDING',
    "variant" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ,
    "error_code" TEXT,
    "error_payload" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "whatsapp_campaign_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wabee"."analytics_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "event_type" "wabee"."AnalyticsEventType" NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'all',
    "thread_id" UUID,
    "conversation_id" UUID,
    "contact_id" UUID,
    "campaign_id" UUID,
    "campaign_message_id" UUID,
    "variant" TEXT,
    "actor_type" "wabee"."AnalyticsActorType" NOT NULL DEFAULT 'SYSTEM',
    "actor_user_id" UUID,
    "meta" JSONB DEFAULT '{}',

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wabee"."analytics_daily_rollups" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "channel" TEXT NOT NULL,
    "metrics" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "analytics_daily_rollups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wabee"."analytics_aggregation_cursors" (
    "organization_id" UUID NOT NULL,
    "last_aggregated_at" TIMESTAMPTZ NOT NULL DEFAULT '1970-01-01 00:00:00+00',
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "analytics_aggregation_cursors_pkey" PRIMARY KEY ("organization_id")
);

-- CreateTable
CREATE TABLE "wabee"."analytics_crm_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "external_id" TEXT,
    "thread_id" UUID,
    "contact_id" UUID,
    "value" DOUBLE PRECISION,
    "currency" TEXT DEFAULT 'USD',
    "meta" JSONB DEFAULT '{}',

    CONSTRAINT "analytics_crm_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wabee"."whatsapp_agent_bindings" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "channel_id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "handoff_to_human_keys" TEXT[] DEFAULT ARRAY['asesor', 'humano', 'agente', 'ayuda']::TEXT[],

    CONSTRAINT "whatsapp_agent_bindings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wabee"."ai_services" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "type" "wabee"."ServiceType" NOT NULL DEFAULT 'TRANSACTIONAL',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "intent_hints" JSONB NOT NULL DEFAULT '[]',
    "behavior_config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ai_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wabee"."ai_service_slots" (
    "id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "type" "wabee"."ServiceSlotType" NOT NULL DEFAULT 'TEXT',
    "required" BOOLEAN NOT NULL DEFAULT true,
    "sensitive" BOOLEAN NOT NULL DEFAULT false,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "validation_config" JSONB,
    "prompt_hint" TEXT NOT NULL,
    "is_core" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ai_service_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wabee"."ai_service_tools" (
    "id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "tool_id" UUID NOT NULL,
    "purpose" TEXT,
    "execution_mode" "wabee"."ServiceToolExecutionMode" NOT NULL DEFAULT 'AUTO',
    "action_type" "wabee"."ServiceToolActionType" NOT NULL DEFAULT 'READ',
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ai_service_tools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wabee"."ai_service_knowledge" (
    "id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "collection_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_service_knowledge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wabee"."integration_credentials" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "auth_type" "wabee"."ToolAuthType" NOT NULL DEFAULT 'NONE',
    "encryptedConfig" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wabee"."ai_tools" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "credential_id" UUID,
    "name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "capability" "wabee"."ToolCapability" NOT NULL DEFAULT 'general_api_fetch',
    "custom_capability" TEXT,
    "semantic_description" TEXT,
    "output_schema" JSONB,
    "confirmation_policy" "wabee"."ToolConfirmationPolicy" NOT NULL DEFAULT 'AUTO',
    "safety_flags" JSONB NOT NULL DEFAULT '{}',
    "example_utterances" JSONB,
    "method" "wabee"."HttpMethod" NOT NULL DEFAULT 'POST',
    "endpoint_url" TEXT NOT NULL,
    "parameters_schema" JSONB NOT NULL,
    "response_mapping" JSONB,
    "trigger_hints" JSONB,
    "timeout_ms" INTEGER NOT NULL DEFAULT 5000,
    "retries" INTEGER NOT NULL DEFAULT 0,
    "require_approval" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_tools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wabee"."ai_profile_tools" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "tool_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "added_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_profile_tools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wabee"."ai_tool_executions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "tool_id" UUID NOT NULL,
    "thread_id" UUID,
    "status" "wabee"."ToolExecutionStatus" NOT NULL,
    "request_payload" JSONB,
    "response_payload" JSONB,
    "error_message" TEXT,
    "duration_ms" INTEGER,
    "executed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_tool_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wabee"."conversation_states" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "thread_id" UUID NOT NULL,
    "mode" "wabee"."ConversationMode" NOT NULL DEFAULT 'AI_MANAGED',
    "handoff_reason" TEXT,
    "handoff_at" TIMESTAMPTZ,
    "active_form_intent" TEXT,
    "collected_data" JSONB,
    "form_status" "wabee"."FormStatus",
    "context_memory" JSONB,
    "active_service_id" UUID,
    "service_intent_type" "wabee"."AiServiceIntentType",
    "next_suggested_slot" TEXT,
    "customer_memory" JSONB,
    "last_updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wabee"."inbox_audit_log" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "thread_id" UUID NOT NULL,
    "channel_id" UUID,
    "contact_id" UUID,
    "actor_type" "wabee"."InboxAuditActorType" NOT NULL,
    "actor_user_id" UUID,
    "actor_role" "wabee"."InboxAuditActorRole",
    "actor_display_name" TEXT,
    "contact_display_name" TEXT,
    "channel_name" TEXT,
    "event_type" "wabee"."InboxAuditEventType" NOT NULL,
    "message_id" UUID,
    "description" TEXT,
    "metadata" JSONB,
    "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inbox_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auth_challenges_user_id_idx" ON "wabee"."auth_challenges"("user_id");

-- CreateIndex
CREATE INDEX "meta_oauth_sessions_organization_id_idx" ON "wabee"."meta_oauth_sessions"("organization_id");

-- CreateIndex
CREATE INDEX "whatsapp_channels_organization_id_idx" ON "wabee"."whatsapp_channels"("organization_id");

-- CreateIndex
CREATE INDEX "whatsapp_channels_organization_id_ai_enabled_idx" ON "wabee"."whatsapp_channels"("organization_id", "ai_enabled");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_channels_organization_id_phone_number_id_key" ON "wabee"."whatsapp_channels"("organization_id", "phone_number_id");

-- CreateIndex
CREATE INDEX "whatsapp_messages_organization_id_idx" ON "wabee"."whatsapp_messages"("organization_id");

-- CreateIndex
CREATE INDEX "whatsapp_messages_channel_id_idx" ON "wabee"."whatsapp_messages"("channel_id");

-- CreateIndex
CREATE INDEX "whatsapp_messages_thread_id_idx" ON "wabee"."whatsapp_messages"("thread_id");

-- CreateIndex
CREATE INDEX "whatsapp_messages_organization_id_channel_id_idx" ON "wabee"."whatsapp_messages"("organization_id", "channel_id");

-- CreateIndex
CREATE INDEX "whatsapp_messages_remote_phone_idx" ON "wabee"."whatsapp_messages"("remote_phone");

-- CreateIndex
CREATE INDEX "whatsapp_messages_timestamp_idx" ON "wabee"."whatsapp_messages"("timestamp");

-- CreateIndex
CREATE INDEX "idx_whatsapp_messages_tenant_external_ref" ON "wabee"."whatsapp_messages"("organization_id", "external_ref");

-- CreateIndex
CREATE INDEX "whatsapp_messages_thread_id_sender_type_direction_idx" ON "wabee"."whatsapp_messages"("thread_id", "sender_type", "direction");

-- CreateIndex
CREATE INDEX "whatsapp_threads_organization_id_idx" ON "wabee"."whatsapp_threads"("organization_id");

-- CreateIndex
CREATE INDEX "whatsapp_threads_organization_id_contact_id_idx" ON "wabee"."whatsapp_threads"("organization_id", "contact_id");

-- CreateIndex
CREATE INDEX "whatsapp_threads_channel_id_idx" ON "wabee"."whatsapp_threads"("channel_id");

-- CreateIndex
CREATE INDEX "whatsapp_threads_last_message_at_idx" ON "wabee"."whatsapp_threads"("last_message_at");

-- CreateIndex
CREATE INDEX "whatsapp_threads_organization_id_handling_mode_idx" ON "wabee"."whatsapp_threads"("organization_id", "handling_mode");

-- CreateIndex
CREATE INDEX "whatsapp_threads_organization_id_ai_paused_idx" ON "wabee"."whatsapp_threads"("organization_id", "ai_paused");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_threads_organization_id_channel_id_contact_phone_key" ON "wabee"."whatsapp_threads"("organization_id", "channel_id", "contact_phone");

-- CreateIndex
CREATE INDEX "whatsapp_thread_notes_tenantId_threadId_createdAt_idx" ON "wabee"."whatsapp_thread_notes"("tenantId", "threadId", "createdAt");

-- CreateIndex
CREATE INDEX "whatsapp_thread_notes_tenantId_threadId_isPinned_idx" ON "wabee"."whatsapp_thread_notes"("tenantId", "threadId", "isPinned");

-- CreateIndex
CREATE INDEX "contacts_organization_id_phone_idx" ON "wabee"."contacts"("organization_id", "phone");

-- CreateIndex
CREATE INDEX "contacts_organization_id_lifecycle_status_idx" ON "wabee"."contacts"("organization_id", "lifecycle_status");

-- CreateIndex
CREATE INDEX "contacts_organization_id_status_idx" ON "wabee"."contacts"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_organization_id_phone_key" ON "wabee"."contacts"("organization_id", "phone");

-- CreateIndex
CREATE INDEX "groups_organization_id_name_idx" ON "wabee"."groups"("organization_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "groups_organization_id_name_key" ON "wabee"."groups"("organization_id", "name");

-- CreateIndex
CREATE INDEX "contact_groups_organization_id_group_id_idx" ON "wabee"."contact_groups"("organization_id", "group_id");

-- CreateIndex
CREATE INDEX "contact_groups_organization_id_contact_id_idx" ON "wabee"."contact_groups"("organization_id", "contact_id");

-- CreateIndex
CREATE UNIQUE INDEX "contact_groups_organization_id_contact_id_group_id_key" ON "wabee"."contact_groups"("organization_id", "contact_id", "group_id");

-- CreateIndex
CREATE INDEX "saved_segments_organization_id_idx" ON "wabee"."saved_segments"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "saved_segments_organization_id_name_key" ON "wabee"."saved_segments"("organization_id", "name");

-- CreateIndex
CREATE INDEX "contact_lifecycle_events_organization_id_contact_id_idx" ON "wabee"."contact_lifecycle_events"("organization_id", "contact_id");

-- CreateIndex
CREATE INDEX "contact_lifecycle_events_organization_id_created_at_idx" ON "wabee"."contact_lifecycle_events"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "whatsapp_message_statuses_organization_id_idx" ON "wabee"."whatsapp_message_statuses"("organization_id");

-- CreateIndex
CREATE INDEX "whatsapp_message_statuses_message_id_idx" ON "wabee"."whatsapp_message_statuses"("message_id");

-- CreateIndex
CREATE INDEX "whatsapp_message_statuses_timestamp_idx" ON "wabee"."whatsapp_message_statuses"("timestamp");

-- CreateIndex
CREATE INDEX "thread_notes_organization_id_thread_id_idx" ON "wabee"."thread_notes"("organization_id", "thread_id");

-- CreateIndex
CREATE INDEX "whatsapp_templates_organization_id_idx" ON "wabee"."whatsapp_templates"("organization_id");

-- CreateIndex
CREATE INDEX "whatsapp_templates_channel_id_idx" ON "wabee"."whatsapp_templates"("channel_id");

-- CreateIndex
CREATE INDEX "whatsapp_templates_organization_id_channel_id_idx" ON "wabee"."whatsapp_templates"("organization_id", "channel_id");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_templates_organization_id_channel_id_name_language_key" ON "wabee"."whatsapp_templates"("organization_id", "channel_id", "name", "language");

-- CreateIndex
CREATE INDEX "web_widgets_organization_id_idx" ON "wabee"."web_widgets"("organization_id");

-- CreateIndex
CREATE INDEX "web_threads_organization_id_idx" ON "wabee"."web_threads"("organization_id");

-- CreateIndex
CREATE INDEX "web_threads_widget_id_idx" ON "wabee"."web_threads"("widget_id");

-- CreateIndex
CREATE INDEX "web_threads_organization_id_widget_id_visitor_id_idx" ON "wabee"."web_threads"("organization_id", "widget_id", "visitor_id");

-- CreateIndex
CREATE INDEX "web_threads_organization_id_widget_id_visitor_id_status_idx" ON "wabee"."web_threads"("organization_id", "widget_id", "visitor_id", "status");

-- CreateIndex
CREATE INDEX "web_messages_organization_id_thread_id_idx" ON "wabee"."web_messages"("organization_id", "thread_id");

-- CreateIndex
CREATE INDEX "ai_profiles_organization_id_idx" ON "wabee"."ai_profiles"("organization_id");

-- CreateIndex
CREATE INDEX "kb_files_organization_id_idx" ON "wabee"."kb_files"("organization_id");

-- CreateIndex
CREATE INDEX "kb_files_organization_id_profile_id_idx" ON "wabee"."kb_files"("organization_id", "profile_id");

-- CreateIndex
CREATE INDEX "kb_chunks_organization_id_idx" ON "wabee"."kb_chunks"("organization_id");

-- CreateIndex
CREATE INDEX "kb_chunks_file_id_idx" ON "wabee"."kb_chunks"("file_id");

-- CreateIndex
CREATE INDEX "kb_chunks_organization_id_profile_id_idx" ON "wabee"."kb_chunks"("organization_id", "profile_id");

-- CreateIndex
CREATE INDEX "kb_chunks_organization_id_profile_id_file_id_idx" ON "wabee"."kb_chunks"("organization_id", "profile_id", "file_id");

-- CreateIndex
CREATE INDEX "kb_chunks_organization_id_profile_id_idx_idx" ON "wabee"."kb_chunks"("organization_id", "profile_id", "idx");

-- CreateIndex
CREATE INDEX "ai_audit_logs_organization_id_idx" ON "wabee"."ai_audit_logs"("organization_id");

-- CreateIndex
CREATE INDEX "ai_audit_logs_widget_id_idx" ON "wabee"."ai_audit_logs"("widget_id");

-- CreateIndex
CREATE INDEX "ai_audit_logs_thread_id_idx" ON "wabee"."ai_audit_logs"("thread_id");

-- CreateIndex
CREATE INDEX "ai_audit_logs_created_at_idx" ON "wabee"."ai_audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "whatsapp_campaigns_organization_id_idx" ON "wabee"."whatsapp_campaigns"("organization_id");

-- CreateIndex
CREATE INDEX "whatsapp_campaigns_status_idx" ON "wabee"."whatsapp_campaigns"("status");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_campaigns_organization_id_name_key" ON "wabee"."whatsapp_campaigns"("organization_id", "name");

-- CreateIndex
CREATE INDEX "whatsapp_campaign_messages_organization_id_campaign_id_idx" ON "wabee"."whatsapp_campaign_messages"("organization_id", "campaign_id");

-- CreateIndex
CREATE INDEX "whatsapp_campaign_messages_wa_message_id_idx" ON "wabee"."whatsapp_campaign_messages"("wa_message_id");

-- CreateIndex
CREATE INDEX "whatsapp_campaign_messages_status_idx" ON "wabee"."whatsapp_campaign_messages"("status");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_campaign_messages_organization_id_campaign_id_cont_key" ON "wabee"."whatsapp_campaign_messages"("organization_id", "campaign_id", "contact_id");

-- CreateIndex
CREATE INDEX "analytics_events_organization_id_occurred_at_idx" ON "wabee"."analytics_events"("organization_id", "occurred_at");

-- CreateIndex
CREATE INDEX "analytics_events_organization_id_event_type_occurred_at_idx" ON "wabee"."analytics_events"("organization_id", "event_type", "occurred_at");

-- CreateIndex
CREATE INDEX "analytics_events_organization_id_thread_id_idx" ON "wabee"."analytics_events"("organization_id", "thread_id");

-- CreateIndex
CREATE INDEX "analytics_daily_rollups_organization_id_date_idx" ON "wabee"."analytics_daily_rollups"("organization_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_daily_rollups_organization_id_date_channel_key" ON "wabee"."analytics_daily_rollups"("organization_id", "date", "channel");

-- CreateIndex
CREATE INDEX "analytics_crm_events_organization_id_occurred_at_idx" ON "wabee"."analytics_crm_events"("organization_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_agent_bindings_channel_id_key" ON "wabee"."whatsapp_agent_bindings"("channel_id");

-- CreateIndex
CREATE INDEX "whatsapp_agent_bindings_organization_id_idx" ON "wabee"."whatsapp_agent_bindings"("organization_id");

-- CreateIndex
CREATE INDEX "whatsapp_agent_bindings_profile_id_idx" ON "wabee"."whatsapp_agent_bindings"("profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_agent_bindings_organization_id_channel_id_key" ON "wabee"."whatsapp_agent_bindings"("organization_id", "channel_id");

-- CreateIndex
CREATE INDEX "ai_services_organization_id_idx" ON "wabee"."ai_services"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_services_organization_id_slug_key" ON "wabee"."ai_services"("organization_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "ai_services_organization_id_name_key" ON "wabee"."ai_services"("organization_id", "name");

-- CreateIndex
CREATE INDEX "ai_service_slots_service_id_idx" ON "wabee"."ai_service_slots"("service_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_service_slots_service_id_key_key" ON "wabee"."ai_service_slots"("service_id", "key");

-- CreateIndex
CREATE INDEX "ai_service_tools_service_id_idx" ON "wabee"."ai_service_tools"("service_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_service_tools_service_id_tool_id_key" ON "wabee"."ai_service_tools"("service_id", "tool_id");

-- CreateIndex
CREATE INDEX "ai_service_knowledge_service_id_idx" ON "wabee"."ai_service_knowledge"("service_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_service_knowledge_service_id_collection_id_key" ON "wabee"."ai_service_knowledge"("service_id", "collection_id");

-- CreateIndex
CREATE UNIQUE INDEX "integration_credentials_organization_id_name_key" ON "wabee"."integration_credentials"("organization_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ai_tools_organization_id_name_key" ON "wabee"."ai_tools"("organization_id", "name");

-- CreateIndex
CREATE INDEX "ai_profile_tools_organization_id_idx" ON "wabee"."ai_profile_tools"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_profile_tools_profile_id_tool_id_key" ON "wabee"."ai_profile_tools"("profile_id", "tool_id");

-- CreateIndex
CREATE INDEX "ai_tool_executions_organization_id_thread_id_idx" ON "wabee"."ai_tool_executions"("organization_id", "thread_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_states_thread_id_key" ON "wabee"."conversation_states"("thread_id");

-- CreateIndex
CREATE INDEX "conversation_states_organization_id_thread_id_idx" ON "wabee"."conversation_states"("organization_id", "thread_id");

-- CreateIndex
CREATE INDEX "inbox_audit_log_tenant_id_actor_user_id_idx" ON "wabee"."inbox_audit_log"("tenant_id", "actor_user_id");

-- CreateIndex
CREATE INDEX "inbox_audit_log_tenant_id_thread_id_idx" ON "wabee"."inbox_audit_log"("tenant_id", "thread_id");

-- CreateIndex
CREATE INDEX "inbox_audit_log_tenant_id_occurred_at_idx" ON "wabee"."inbox_audit_log"("tenant_id", "occurred_at");

-- AddForeignKey
ALTER TABLE "wabee"."whatsapp_channels" ADD CONSTRAINT "whatsapp_channels_oauth_session_id_fkey" FOREIGN KEY ("oauth_session_id") REFERENCES "wabee"."meta_oauth_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wabee"."whatsapp_channels" ADD CONSTRAINT "whatsapp_channels_default_ai_profile_id_fkey" FOREIGN KEY ("default_ai_profile_id") REFERENCES "wabee"."ai_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wabee"."whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "wabee"."whatsapp_channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wabee"."whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "wabee"."whatsapp_threads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wabee"."whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_ai_profile_id_fkey" FOREIGN KEY ("ai_profile_id") REFERENCES "wabee"."ai_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wabee"."whatsapp_threads" ADD CONSTRAINT "whatsapp_threads_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "wabee"."whatsapp_channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wabee"."whatsapp_threads" ADD CONSTRAINT "whatsapp_threads_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "wabee"."contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wabee"."whatsapp_threads" ADD CONSTRAINT "whatsapp_threads_assigned_ai_profile_id_fkey" FOREIGN KEY ("assigned_ai_profile_id") REFERENCES "wabee"."ai_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wabee"."whatsapp_thread_notes" ADD CONSTRAINT "whatsapp_thread_notes_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "wabee"."whatsapp_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wabee"."contact_groups" ADD CONSTRAINT "contact_groups_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "wabee"."contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wabee"."contact_groups" ADD CONSTRAINT "contact_groups_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "wabee"."groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wabee"."contact_lifecycle_events" ADD CONSTRAINT "contact_lifecycle_events_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "wabee"."contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wabee"."whatsapp_message_statuses" ADD CONSTRAINT "whatsapp_message_statuses_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "wabee"."whatsapp_channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wabee"."thread_notes" ADD CONSTRAINT "thread_notes_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "wabee"."whatsapp_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wabee"."whatsapp_templates" ADD CONSTRAINT "whatsapp_templates_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "wabee"."whatsapp_channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wabee"."web_threads" ADD CONSTRAINT "web_threads_widget_id_fkey" FOREIGN KEY ("widget_id") REFERENCES "wabee"."web_widgets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wabee"."web_messages" ADD CONSTRAINT "web_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "wabee"."web_threads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wabee"."kb_files" ADD CONSTRAINT "kb_files_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "wabee"."ai_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wabee"."kb_chunks" ADD CONSTRAINT "kb_chunks_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "wabee"."kb_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wabee"."whatsapp_campaigns" ADD CONSTRAINT "whatsapp_campaigns_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "wabee"."whatsapp_channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wabee"."whatsapp_campaigns" ADD CONSTRAINT "whatsapp_campaigns_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "wabee"."whatsapp_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wabee"."whatsapp_campaign_messages" ADD CONSTRAINT "whatsapp_campaign_messages_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "wabee"."whatsapp_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wabee"."whatsapp_campaign_messages" ADD CONSTRAINT "whatsapp_campaign_messages_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "wabee"."contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wabee"."whatsapp_campaign_messages" ADD CONSTRAINT "whatsapp_campaign_messages_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "wabee"."whatsapp_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wabee"."whatsapp_agent_bindings" ADD CONSTRAINT "whatsapp_agent_bindings_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "wabee"."whatsapp_channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wabee"."whatsapp_agent_bindings" ADD CONSTRAINT "whatsapp_agent_bindings_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "wabee"."ai_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wabee"."ai_service_slots" ADD CONSTRAINT "ai_service_slots_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "wabee"."ai_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wabee"."ai_service_tools" ADD CONSTRAINT "ai_service_tools_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "wabee"."ai_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wabee"."ai_service_tools" ADD CONSTRAINT "ai_service_tools_tool_id_fkey" FOREIGN KEY ("tool_id") REFERENCES "wabee"."ai_tools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wabee"."ai_service_knowledge" ADD CONSTRAINT "ai_service_knowledge_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "wabee"."ai_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wabee"."ai_tools" ADD CONSTRAINT "ai_tools_credential_id_fkey" FOREIGN KEY ("credential_id") REFERENCES "wabee"."integration_credentials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wabee"."ai_profile_tools" ADD CONSTRAINT "ai_profile_tools_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "wabee"."ai_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wabee"."ai_profile_tools" ADD CONSTRAINT "ai_profile_tools_tool_id_fkey" FOREIGN KEY ("tool_id") REFERENCES "wabee"."ai_tools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wabee"."ai_tool_executions" ADD CONSTRAINT "ai_tool_executions_tool_id_fkey" FOREIGN KEY ("tool_id") REFERENCES "wabee"."ai_tools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
