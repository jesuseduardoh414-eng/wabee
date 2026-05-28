import { ServerResponse } from 'http';

// ─── Event Shape ─────────────────────────────────────────────────────────────
export type RealtimeEvent =
    | {
        type: 'campaign.status';
        campaignId: string;
        payload: {
            status: string;
            startedAt?: string | null;
            completedAt?: string | null;
            pauseReason?: string | null;
        };
    }
    | {
        type: 'campaign.metrics';
        campaignId: string;
        payload: {
            sentCount: number;
            deliveredCount: number;
            readCount: number;
            failedCount: number;
            status?: string;
        };
    }
    | {
        type: 'new_notification';
        campaignId?: string;
        payload: {
            notificationId: string;
            type: string;
            title: string;
        };
    }
    // ── Inbox events (pushed on inbound webhook + outbound send) ─────────────
    | {
        type: 'inbox.message';
        /** whatsappThread.id – allows the UI to filter by active thread */
        threadId: string;
        payload: {
            message: {
                id: string;
                threadId: string;
                channelId: string;
                direction: 'INBOUND' | 'OUTBOUND';
                fromPhone: string;
                toPhone: string;
                remotePhone: string;
                type: string;
                textBody?: string;
                waMessageId?: string;
                timestamp: Date;
                status: string;
                deliveryStatus: string;
            };
            thread?: {
                id: string;
                contactPhone: string;
                contactName?: string | null;
                lastMessageAt: Date;
                lastMessagePreview?: string;
                unreadCount?: number;
            };
        };
    }
    | {
        type: 'inbox.thread_updated';
        threadId: string;
        payload: {
            id: string;
            contactPhone: string;
            contactName?: string | null;
            lastMessageAt: Date;
            lastMessagePreview?: string;
            unreadCount?: number;
            status?: string;
        };
    }
    | {
        type: 'inbox.message_status';
        messageId: string;
        payload: {
            deliveryStatus: string;
            waMessageId?: string;
        };
    };

// ─── Throttle Entry ───────────────────────────────────────────────────────────
interface ThrottleEntry {
    timer: NodeJS.Timeout | null;
    pendingPayload: any;
    pendingType: string;
}

// ─── Singleton Bus ────────────────────────────────────────────────────────────
class RealtimeBusClass {
    /** tenantId → Set of active SSE response streams */
    private readonly subscribers = new Map<string, Set<ServerResponse>>();

    /** campaignId → throttle state (only for campaign events) */
    private readonly throttleMap = new Map<string, ThrottleEntry>();

    private readonly THROTTLE_MS = 500;

    // ── Subscription Management ───────────────────────────────────────────────

    subscribe(tenantId: string, res: ServerResponse): void {
        if (!this.subscribers.has(tenantId)) {
            this.subscribers.set(tenantId, new Set());
        }
        this.subscribers.get(tenantId)!.add(res);
        console.log(`[RealtimeBus] +1 subscriber for tenant ${tenantId} (total: ${this.subscribers.get(tenantId)!.size})`);
    }

    unsubscribe(tenantId: string, res: ServerResponse): void {
        const set = this.subscribers.get(tenantId);
        if (!set) return;
        set.delete(res);
        if (set.size === 0) this.subscribers.delete(tenantId);
        console.log(`[RealtimeBus] -1 subscriber for tenant ${tenantId}`);
    }

    // ── Publish ───────────────────────────────────────────────────────────────

    /**
     * Publica un evento SSE al tenant.
     *
     * Eventos de campaña → throttled (500ms, fusión de payload).
     * Eventos de inbox   → inmediatos (sin throttle, latencia crítica).
     * Eventos de notificación → inmediatos.
     */
    publish(tenantId: string, event: RealtimeEvent): void {
        // Inbox y notification events: enviar inmediatamente
        if (
            event.type === 'new_notification' ||
            event.type === 'inbox.message' ||
            event.type === 'inbox.thread_updated' ||
            event.type === 'inbox.message_status'
        ) {
            this._send(tenantId, event);
            return;
        }

        // Campaign events: throttled
        const campaignId = (event as any).campaignId as string;
        const key = `${tenantId}:${campaignId}`;

        if (!this.throttleMap.has(key)) {
            this.throttleMap.set(key, {
                timer: null,
                pendingPayload: { ...event.payload },
                pendingType: event.type,
            });
        }

        const entry = this.throttleMap.get(key)!;
        Object.assign(entry.pendingPayload, event.payload);
        if (event.type === 'campaign.status') {
            entry.pendingType = event.type;
        } else if (entry.pendingType !== 'campaign.status') {
            entry.pendingType = event.type;
        }

        if (entry.timer) return;

        entry.timer = setTimeout(() => {
            const finalEvent: RealtimeEvent = {
                type: entry.pendingType as any,
                campaignId,
                payload: { ...entry.pendingPayload },
            };
            this.throttleMap.delete(key);
            this._send(tenantId, finalEvent);
        }, this.THROTTLE_MS);
    }

    // ── Internal Send ─────────────────────────────────────────────────────────

    private _send(tenantId: string, event: RealtimeEvent): void {
        const set = this.subscribers.get(tenantId);
        if (!set || set.size === 0) return;

        const data = `data: ${JSON.stringify(event)}\n\n`;
        const dead: ServerResponse[] = [];

        for (const res of set) {
            try {
                res.write(data);
            } catch {
                dead.push(res);
            }
        }

        for (const res of dead) {
            set.delete(res);
        }
        if (set.size === 0) this.subscribers.delete(tenantId);
    }
}

export const RealtimeBus = new RealtimeBusClass();
