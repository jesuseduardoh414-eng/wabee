import { apiClient } from './client';
import client from '../client';

export interface Thread {
    id: string;
    remotePhone: string;
    contactName?: string | null;
    avatarUrl?: string | null;
    contactId?: string | null;
    status: 'OPEN' | 'CLOSED' | 'SNOOZED';
    lastMessageAt: string;
    lastMessagePreview: string | null;
    unreadCount: number;
    assignedUserId?: string | null;
    handlingMode?: 'ai' | 'human_queue' | 'human' | 'copilot' | 'paused' | null;
    aiPaused?: boolean;
    source?: string | null;
    lastMessage?: { // For backward compatibility if needed in some views
        text: string | null;
        timestamp: string;
        direction?: 'INBOUND' | 'OUTBOUND';
        metadata?: any | null;
    };
    metadata?: any | null;
}

export interface ThreadNote {
    id: string;
    threadId: string;
    createdById?: string | null;
    body: string;
    isPinned: boolean;
    createdAt: string;
    authorName?: string;
    authorRole?: string;
}

export interface Message {
    id: string;
    text: string | null;
    direction: 'INBOUND' | 'OUTBOUND';
    timestamp: string;
    fromPhone: string;
    type: string;
    status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'RECEIVED';
    deliveryStatus?: 'sent' | 'delivered' | 'read' | 'failed' | null;
    errorCode?: string;
    errorMessage?: string;
    senderType?: 'contact' | 'ai' | 'human' | 'system' | null;
    generatedBy?: 'ai' | 'user' | 'workflow' | 'template' | 'system' | null;
    metadata?: any;
}

export async function getChannelThreads(channelId: string): Promise<Thread[]> {
    const rawThreads = await apiClient<any[]>(`/inbox/channels/${channelId}/threads`);

    return rawThreads.map(t => ({
        id: t.id,
        remotePhone: t.contactPhone,
        contactName: t.contactName,
        avatarUrl:
            t.avatarUrl ??
            t.avatar ??
            t.contactAvatar ??
            t.profilePhotoUrl ??
            t.metadata?.avatarUrl ??
            t.metadata?.avatar ??
            t.metadata?.contactAvatar ??
            t.metadata?.profilePhotoUrl ??
            null,
        contactId: t.contactId ?? null,
        status: t.status,
        lastMessageAt: t.lastMessageAt,
        lastMessagePreview: t.lastMessagePreview,
        unreadCount: t.unreadCount || 0,
        assignedUserId: t.assignedUserId,
        handlingMode: t.handlingMode,
        aiPaused: t.aiPaused,
        source: t.source,
        lastMessage: {
            text: t.lastMessagePreview,
            timestamp: t.lastMessageAt,
            metadata: t.metadata // Assuming metadata in thread holds last message info or thread-level source
        },
        metadata: t.metadata
    }));
}

export interface ThreadMessagesResponse {
    items: Message[];
    thread?: {
        id: string;
        contactPhone: string;
        contactName?: string | null;
    };
}

export async function getThreadMessages(channelId: string, threadId: string): Promise<ThreadMessagesResponse> {
    const response = await apiClient<{ items: any[], thread?: any }>(`/inbox/channels/${channelId}/messages?threadId=${threadId}`);

    return {
        items: response.items.map(m => ({
            id: m.id,
            text: m.textBody || `[${m.type}]`,
            direction: m.direction,
            timestamp: m.createdAt,
            fromPhone: m.fromPhone,
            type: m.type,
            status: m.status || 'RECEIVED', // Default fallback
            deliveryStatus: m.deliveryStatus ?? null,
            errorCode: m.errorCode,
            errorMessage: m.errorMessage,
            senderType: m.senderType,
            generatedBy: m.generatedBy,
            metadata: m.metadata
        })),
        thread: response.thread
    };
}

export async function sendMessageToThread(threadId: string, text: string): Promise<Message> {
    return apiClient<Message>(`/inbox/threads/${threadId}/send`, {
        method: 'POST',
        body: JSON.stringify({ text }),
    });
}

export async function uploadInboxAttachment(file: File): Promise<{ id: string; mimeType: string; path: string }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('collectionName', 'inbox');
    formData.append('isPublic', 'false');

    // Usa el mismo cliente axios que el resto de la API: respeta baseURL (proxy de
    // Vite en dev, dominio real en prod), withCredentials y la cabecera x-tenant-id.
    // Antes esto usaba un fetch con la URL absoluta http://localhost:4000 hardcodeada,
    // que fallaba al acceder desde otro dispositivo (móvil en la LAN).
    const response = await client.post('/core/media/upload', formData);

    return response.data;
}

export async function sendAttachmentToThread(
    threadId: string,
    params: { mediaFileId: string; caption?: string }
): Promise<Message> {
    return apiClient<Message>(`/inbox/threads/${threadId}/send`, {
        method: 'POST',
        body: JSON.stringify({
            mediaFileId: params.mediaFileId,
            caption: params.caption,
        }),
    });
}

export async function markThreadRead(threadId: string): Promise<void> {
    return apiClient(`/inbox/threads/${threadId}/read`, {
        method: 'POST'
    });
}

export async function resolveThread(contactId: string, channelId?: string): Promise<{ threadId: string, channelId: string }> {
    return apiClient<{ threadId: string, channelId: string }>(`/inbox/resolve-thread`, {
        method: 'POST',
        body: JSON.stringify({ contactId, channelId }),
    });
}

export async function getThreadById(threadId: string): Promise<Thread> {
    const t = await apiClient<any>(`/inbox/threads/${threadId}`);
    return {
        id: t.id,
        remotePhone: t.contactPhone,
        contactName: t.contactName,
        avatarUrl:
            t.avatarUrl ??
            t.avatar ??
            t.contactAvatar ??
            t.profilePhotoUrl ??
            t.metadata?.avatarUrl ??
            t.metadata?.avatar ??
            t.metadata?.contactAvatar ??
            t.metadata?.profilePhotoUrl ??
            null,
        contactId: t.contactId ?? null,
        status: t.status,
        lastMessageAt: t.lastMessageAt,
        lastMessagePreview: t.lastMessagePreview,
        unreadCount: t.unreadCount || 0,
        assignedUserId: t.assignedUserId,
        handlingMode: t.handlingMode,
        aiPaused: t.aiPaused,
        lastMessage: {
            text: t.lastMessagePreview,
            timestamp: t.lastMessageAt,
        }
    };
}

export async function getThreadNotes(threadId: string): Promise<ThreadNote[]> {
    return apiClient<ThreadNote[]>(`/inbox/threads/${threadId}/notes`);
}

export async function createThreadNote(threadId: string, body: string): Promise<ThreadNote> {
    return apiClient<ThreadNote>(`/inbox/threads/${threadId}/notes`, {
        method: 'POST',
        body: JSON.stringify({ body }),
    });
}

export async function updateThreadNote(threadId: string, noteId: string, patch: { body?: string, isPinned?: boolean }): Promise<ThreadNote> {
    return apiClient<ThreadNote>(`/inbox/threads/${threadId}/notes/${noteId}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
    });
}

export async function deleteThreadNote(threadId: string, noteId: string): Promise<{ success: boolean }> {
    return apiClient<{ success: boolean }>(`/inbox/threads/${threadId}/notes/${noteId}`, {
        method: 'DELETE',
    });
}

export interface Assignee {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
    role: string;
}

export async function getAssignableUsers(): Promise<Assignee[]> {
    return apiClient<Assignee[]>('/inbox/roles/assignees');
}

export async function assignThread(threadId: string, assignedUserId: string): Promise<Thread> {
    return apiClient<any>(`/inbox/roles/threads/${threadId}/assign`, {
        method: 'POST',
        body: JSON.stringify({ assignedUserId }),
    });
}

export async function unassignThread(threadId: string): Promise<Thread> {
    return apiClient<any>(`/inbox/roles/threads/${threadId}/unassign`, {
        method: 'POST',
    });
}

export async function takeThread(threadId: string): Promise<Thread> {
    return apiClient<any>(`/inbox/roles/threads/${threadId}/take`, {
        method: 'POST',
    });
}

export async function updateThreadStatus(threadId: string, status: string): Promise<Thread> {
    // Esto se mantiene en /inbox regular según rutas de whatsapp
    return apiClient<any>(`/inbox/threads/${threadId}/status`, {
        method: 'POST',
        body: JSON.stringify({ status }),
    });
}

// --- AI & Handling Status ---

export interface ThreadHandlingStatus {
    handlingMode: 'ai' | 'human_queue' | 'human' | 'copilot' | 'paused' | null;
    aiPaused: boolean;
    assignedAiProfileId: string | null;
    assignedUserId: string | null;
    humanTakeoverBy: string | null;
    humanTakeoverAt: string | null;
    conversationMode: string;
}

export async function getThreadHandlingStatus(threadId: string): Promise<ThreadHandlingStatus> {
    const response = await apiClient<{ data: ThreadHandlingStatus }>(`/inbox/roles/threads/${threadId}/handling-status`);
    return response.data;
}

export async function forceTakeover(threadId: string, reason?: string): Promise<ThreadHandlingStatus> {
    const response = await apiClient<{ data: ThreadHandlingStatus }>(`/inbox/roles/threads/${threadId}/takeover`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
    });
    return response.data;
}

export async function resumeAi(threadId: string): Promise<any> {
    return apiClient<any>(`/inbox/roles/threads/${threadId}/resume-ai`, {
        method: 'POST',
    });
}
