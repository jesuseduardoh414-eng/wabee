import { apiClient } from './client';

export interface KbFile {
    id: string;
    filename: string;
    size: number;
    status: 'PROCESSING' | 'INDEXED' | 'ERROR';
    error?: string;
    updatedAt: string;
}

export interface KbSource {
    id: string;
    name: string;
    sourceType: 'URL' | 'DATABASE' | 'FILE' | 'INTEGRATION';
    status: 'PENDING' | 'PROCESSING' | 'INDEXED' | 'ERROR';
    config: { url?: string } | null;
    error?: string | null;
    vectorSyncAt?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface WhatsAppTestResponse {
    sessionId: string;
    action: 'NO_AI' | 'HANDOFF' | 'REPLY' | 'SKIP' | 'ERROR';
    reply: string | null;
    handoffReason: string | null;
    conversationMode: 'AI_MANAGED' | 'HUMAN_HANDOFF' | 'DISABLED';
    handoffAt: string | null;
    lifecycleTransition?: { from: string; to: string; reason: string } | null;
    meta: {
        profileId: string;
        profileName: string;
        agentName?: string;
        kbChunksUsed: number;
        tokensUsed: number;
        intent: string | null;
        kbBestScore: number | null;
        debug?: {
            intent: string;
            source: 'PROMPT' | 'KB' | 'TOOL' | 'FORM';
            toolsAvailable: string[];
            toolSelected?: string;
            toolPayload?: any;
            toolResult?: any;
            kbEnabled: boolean;
            kbProfileCount: number;
            kbTried: boolean;
            kbUsed: boolean;
            kbQueryUsed?: string;
            kbChunks: number;
            kbBestScore: number;
            kbSkipReason?: string;
            contextualReferenceDetected: boolean;
            contextualReferenceResolvedTo?: string;
            activeEntityType?: string;
            activeEntityValue?: string;
            personaGuardrailsApplied?: boolean;
            tokens: number;
            kbFilesUsed?: string[];
            // Flow Engine
            activeFlow?: string;
            collectedData?: any;
            missingSlotTarget?: string;
            extractedSlots?: any;
            lastAskedSlot?: string;
            // Robustez
            flowTried?: boolean;
            flowSkippedReason?: string;
            extractorSucceeded?: boolean;
            extractorError?: string;
            // Service Engine (Session Philosophy)
            activeService?: string;
            serviceConfidence?: number;
            serviceIntentType?: string;
            serviceLockReason?: string;
            enoughContextToRespond?: boolean;
            conversationMode?: string;
            nextSuggestedSlot?: string;
            slotCaptureBlockedReason?: string;
            // Service Switch
            serviceSwitchDetected?: boolean;
            serviceSwitchReason?: string;
            previousServiceId?: string;
            // Robustez y Diagnóstico
            serviceStateLoaded?: boolean;
            entityMemoryLoaded?: boolean;
            fallbackApplied?: boolean;
            // Memorias
            customerMemory?: any;
        };
    };
}

// Capabilities controladas del catálogo (enum Prisma ToolCapability)
export type ToolCapability =
    | 'product_search' | 'service_search' | 'appointment_lookup' | 'appointment_create'
    | 'quote_request' | 'order_status' | 'inventory_check' | 'faq_lookup'
    | 'customer_lookup' | 'lead_create' | 'reservation_check' | 'reservation_create'
    | 'payment_link_create' | 'shipment_quote' | 'shipment_tracking'
    | 'general_api_fetch' | 'CUSTOM';

export type ToolConfirmationPolicy = 'AUTO' | 'HYBRID' | 'MANUAL';

export interface ToolSafetyFlags {
    canMutateData: boolean;
    requiresConfirmation: boolean;
    safeToAutoRun: boolean;
    idempotent: boolean;
    sensitiveOperation: boolean;
}

export interface AiTool {
    id: string;
    name: string;
    displayName: string;
    description: string;
    category?: string;
    isActive: boolean;
    // ── Campos semánticos (Fase 3) ──
    capability?: ToolCapability;
    customCapability?: string;           // Solo si capability = 'CUSTOM'
    semanticDescription?: string;
    outputSchema?: any;
    confirmationPolicy?: ToolConfirmationPolicy;
    safetyFlags?: ToolSafetyFlags;
    exampleUtterances?: string[];
    // ── HTTP ──
    method?: string;
    endpointUrl?: string;
    parametersSchema?: any;
    responseMapping?: any;
    // ── Legacy ──
    triggerHints?: string[] | string;
    credentialId?: string | null;
    timeoutMs?: number;
    retries?: number;
    requireApproval?: boolean;
    // ── Metadata ──
    createdAt?: string;
    credential?: { id: string; name: string; authType: string };
}

export interface ConsolidatedProfileTool {
    id: string;
    name: string;
    displayName: string;
    description: string;
    category?: string;
    capability?: ToolCapability;
    confirmationPolicy?: ToolConfirmationPolicy;
    isSemanticComplete: boolean;     // true si tiene capability + semanticDescription definidos
    hasGenericCapability: boolean;   // true si capability es 'general_api_fetch' o no definida
    globalIsActive: boolean;
    isLinked: boolean;
    profileIsActive: boolean;
    profileLinkId: string | null;
    effectivelyActive: boolean;
}


export interface IntegrationCredential {
    id: string;
    name: string;
    authType: 'NONE' | 'BEARER_TOKEN' | 'API_KEY_HEADER' | 'BASIC_AUTH';
    hasConfig: boolean;
    createdAt: string;
}

export interface FlowSlot {
    id: string;
    description: string;
    type: 'string' | 'number' | 'date' | 'boolean' | 'enum';
    required?: boolean;
    promptText: string;
}

export interface FlowDefinition {
    id: string;
    name: string;
    description: string;
    triggerIntents: string[];
    completionMessage?: string;
    slots: FlowSlot[];
}

export interface CreateIntegrationDto {
    name: string;
    authType: 'NONE' | 'BEARER_TOKEN' | 'API_KEY_HEADER' | 'BASIC_AUTH';
    config?: any;
}

export interface UpdateIntegrationDto {
    name?: string;
    authType?: 'NONE' | 'BEARER_TOKEN' | 'API_KEY_HEADER' | 'BASIC_AUTH';
    config?: any;
}

export interface AiProfile {
    id: string;
    name: string;
    agentName?: string;
    roleTitle?: string;
    personalityNotes?: string;
    greetingStyle: 'SHORT' | 'MEDIUM' | 'WARM';
    tones: string[];
    systemPrompt: string;
    maxTokens: number;
    fallbackMode: 'PRESET_A' | 'PRESET_B' | 'PRESET_C' | 'CUSTOM';
    fallbackCustomMessage?: string;
    confidenceThreshold: number;
    channelType: 'WIDGET' | 'WHATSAPP';
    kbEnabled: boolean;
    kbFiles?: KbFile[];
    _count?: {
        kbFiles: number;
    };
    createdAt: string;
}

export const aiApi = {
    listProfiles: () => apiClient<AiProfile[]>('/ai/ai-profiles'),
    getProfile: (id: string) => apiClient<AiProfile>(`/ai/ai-profiles/${id}`),
    createProfile: (data: Partial<AiProfile>) => apiClient<AiProfile>('/ai/ai-profiles', {
        method: 'POST',
        body: JSON.stringify(data)
    }),
    updateProfile: (id: string, data: Partial<AiProfile>) => apiClient<AiProfile>(`/ai/ai-profiles/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    }),
    deleteProfile: (id: string) => apiClient<void>(`/ai/ai-profiles/${id}`, {
        method: 'DELETE'
    }),

    // Knowledge Base
    getKbFiles: (profileId: string) => apiClient<KbFile[]>(`/ai/ai-profiles/${profileId}/kb/files`),
    uploadKbFile: (profileId: string, file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return apiClient<KbFile>(`/ai/ai-profiles/${profileId}/kb/files`, {
            method: 'POST',
            body: formData,
        });
    },
    deleteKbFile: (profileId: string, fileId: string) => apiClient<void>(`/ai/ai-profiles/${profileId}/kb/files/${fileId}`, {
        method: 'DELETE'
    }),
    reindexKbFile: (profileId: string, fileId: string) => apiClient<void>(`/ai/ai-profiles/${profileId}/kb/files/${fileId}/reindex`, {
        method: 'POST'
    }),
    viewKbFileUrl: (profileId: string, fileId: string) => {
        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000/v1';
        const tenantKey = localStorage.getItem('wabee_orgId') || localStorage.getItem('wabee_tenant_key') || localStorage.getItem('tenant_key') || 'dev-api-key-tenant-1';
        const token = localStorage.getItem('wabee_token') || localStorage.getItem('auth_token') || localStorage.getItem('token') || '';
        return `${baseUrl}/wabee/ai/ai-profiles/${profileId}/kb/files/${fileId}/view?tenantId=${tenantKey}&token=${token}`;
    },

    // KB Sources — Database (read-only)
    testDbConnection: (profileId: string, config: object) =>
        apiClient<{ ok: boolean; tables: { schema: string; name: string; columns: { name: string; type: string }[] }[] }>(
            `/ai/ai-profiles/${profileId}/kb/db/test`,
            { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config }) }
        ),
    createDbSource: (profileId: string, data: { name: string; config: object; mappings: object[] }) =>
        apiClient<KbSource>(`/ai/ai-profiles/${profileId}/kb/db/sources`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        }),
    reindexDbSource: (profileId: string, sourceId: string) =>
        apiClient<void>(`/ai/ai-profiles/${profileId}/kb/db/sources/${sourceId}/reindex`, { method: 'POST' }),

    // KB Sources (URL / web scraping)
    getKbSources: (profileId: string) =>
        apiClient<KbSource[]>(`/ai/ai-profiles/${profileId}/kb/sources`),
    createKbSource: (profileId: string, data: { name: string; url: string }) =>
        apiClient<KbSource>(`/ai/ai-profiles/${profileId}/kb/sources`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        }),
    deleteKbSource: (profileId: string, sourceId: string) =>
        apiClient<void>(`/ai/ai-profiles/${profileId}/kb/sources/${sourceId}`, { method: 'DELETE' }),
    reindexKbSource: (profileId: string, sourceId: string) =>
        apiClient<void>(`/ai/ai-profiles/${profileId}/kb/sources/${sourceId}/reindex`, { method: 'POST' }),

    // WhatsApp Agent Test (aislado del inbox real)
    whatsappTest: (profileId: string, message: string, sessionId?: string) =>
        apiClient<WhatsAppTestResponse>(`/ai/ai-profiles/${profileId}/whatsapp-test`, {
            method: 'POST',
            body: JSON.stringify({ message, sessionId })
        }),
    clearWhatsappTestSession: (profileId: string, sessionId: string) =>
        apiClient<{ message: string; sessionId: string }>(`/ai/ai-profiles/${profileId}/whatsapp-test/${sessionId}`, {
            method: 'DELETE'
        }),

    // Integrations Management
    listIntegrations: () => apiClient<IntegrationCredential[]>('/ai/integrations'),
    getIntegration: (id: string) => apiClient<IntegrationCredential>(`/ai/integrations/${id}`),
    createIntegration: (data: CreateIntegrationDto) => apiClient<IntegrationCredential>('/ai/integrations', {
        method: 'POST',
        body: JSON.stringify(data)
    }),
    updateIntegration: (id: string, data: UpdateIntegrationDto) => apiClient<IntegrationCredential>(`/ai/integrations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
    }),
    deleteIntegration: (id: string) => apiClient<void>(`/ai/integrations/${id}`, {
        method: 'DELETE'
    }),

    // Tool Management (Global CRUD)
    listTools: () => apiClient<AiTool[]>('/ai/tools'),
    getTool: (id: string) => apiClient<AiTool>(`/ai/tools/${id}`),
    createTool: (data: Partial<AiTool>) => apiClient<AiTool>('/ai/tools', {
        method: 'POST',
        body: JSON.stringify(data)
    }),
    updateTool: (id: string, data: Partial<AiTool>) => apiClient<AiTool>(`/ai/tools/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
    }),
    deleteTool: (id: string) => apiClient<void>(`/ai/tools/${id}`, {
        method: 'DELETE'
    }),
    testTool: (toolId: string, payload: any) => apiClient<any>(`/ai/tools/${toolId}/test`, {
        method: 'POST',
        body: JSON.stringify(payload)
    }),

    // Legacy / Profile Tool Management
    listLegacyTools: () => apiClient<AiTool[]>('/ai/ai-tools'),
    updateGlobalToolStatus: (id: string, isActive: boolean) => apiClient<void>(`/ai/ai-tools/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive })
    }),
    listProfileTools: (profileId: string) => apiClient<ConsolidatedProfileTool[]>(`/ai/ai-profiles/${profileId}/tools`),
    linkTool: (profileId: string, toolId: string) => apiClient<void>(`/ai/ai-profiles/${profileId}/tools/${toolId}`, {
        method: 'POST'
    }),
    unlinkTool: (profileId: string, toolId: string) => apiClient<void>(`/ai/ai-profiles/${profileId}/tools/${toolId}`, {
        method: 'DELETE'
    }),
    updateProfileToolStatus: (profileId: string, toolId: string, isActive: boolean) => apiClient<void>(`/ai/ai-profiles/${profileId}/tools/${toolId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive })
    }),

    // Conversation Flows
    listFlows: () => apiClient<FlowDefinition[]>('/ai/flows'),
};
