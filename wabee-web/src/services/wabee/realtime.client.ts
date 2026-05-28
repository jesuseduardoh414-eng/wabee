/**
 * realtime.client.ts
 *
 * Cliente SSE para suscribirse al stream de Campaigns Hub en tiempo real.
 * Usa EventSource nativo con token JWT por query param.
 *
 * TODO (PROD): Migrar a cookie HttpOnly o token SSE de corta vida (1-5 min)
 * emitido por el backend. Encapsulado aquí para el cambio sea solo en este archivo.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type RealtimeEventType =
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
        payload: {
            notificationId: string;
            type: string;
            title: string;
        };
    };

export interface StreamHandle {
    close: () => void;
}

export interface ConnectOptions {
    /** Llamado cuando SSE falla más de maxRetries veces.  */
    onFallback?: () => void;
    /** Llamado cuando SSE se conecta exitosamente */
    onConnected?: () => void;
    /** Número máximo de reintentos antes de activar fallback (default: 3) */
    maxRetries?: number;
}

// ─── Main ────────────────────────────────────────────────────────────────────

/**
 * Abre un stream SSE al endpoint /v1/wabee/realtime/stream.
 *
 * NOTA: EventSource nativo NO soporta headers personalizados (limitación del browser).
 * Por eso enviamos token Y tenantId como query params.
 * tenancyAdapter ya soporta leer tenantId desde req.query.tenantId.
 *
 * @param onEvent - Callback invocado con cada evento de campaña
 * @param options - Configuración de reintentos y fallback
 * @returns StreamHandle con método close()
 */
export function connectCampaignStream(
    onEvent: (event: RealtimeEventType) => void,
    options: ConnectOptions = {}
): StreamHandle {
    const { onFallback, onConnected, maxRetries = 3 } = options;
    let retryCount = 0;
    let closed = false;
    let es: EventSource | null = null;

    const connect = () => {
        if (closed) return;

        // ── Leer credenciales de localStorage ─────────────────────────────────
        const token = localStorage.getItem('wabee_token') ?? '';
        // IMPORTANTE: EventSource no puede enviar x-tenant-id como header,
        // así que lo mandamos por query param. tenancyAdapter lo lee desde req.query.tenantId
        const tenantId = localStorage.getItem('wabee_orgId') || localStorage.getItem('tenant_key') || '';
        const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:4000/v1';

        if (!token) {
            console.warn('[RealtimeClient] No hay token JWT, no se abre SSE.');
            onFallback?.();
            return;
        }

        const params = new URLSearchParams();
        params.set('token', token);
        if (tenantId) params.set('tenantId', tenantId);

        const url = `${API_URL}/wabee/realtime/stream?${params.toString()}`;

        console.log('[RealtimeClient] Conectando SSE...');
        es = new EventSource(url);

        es.onopen = () => {
            retryCount = 0; // Reset al reconectar exitosamente
            console.log('[RealtimeClient] ✅ Conexión SSE establecida.');
            onConnected?.();
        };

        es.onmessage = (e: MessageEvent) => {
            try {
                const evt = JSON.parse(e.data) as RealtimeEventType;
                if (evt.type === 'campaign.metrics' || evt.type === 'campaign.status' || evt.type === 'new_notification') {
                    onEvent(evt);
                }
            } catch {
                // Ignorar mensajes malformados (ej: ping/hello con data: {})
            }
        };

        es.onerror = (err) => {
            console.warn('[RealtimeClient] Error en SSE:', err);
            es?.close();
            es = null;
            retryCount++;

            if (retryCount >= maxRetries) {
                console.warn(`[RealtimeClient] SSE falló ${retryCount} veces. Activando fallback polling.`);
                onFallback?.();
                return;
            }

            // Reconexión exponencial: 1s, 2s, 4s…
            const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 10_000);
            console.warn(`[RealtimeClient] Reintento ${retryCount}/${maxRetries} en ${delay}ms.`);
            setTimeout(connect, delay);
        };
    };

    connect();

    return {
        close: () => {
            closed = true;
            es?.close();
            es = null;
            console.log('[RealtimeClient] Stream SSE cerrado manualmente.');
        }
    };
}
