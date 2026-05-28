import { Request, Response } from 'express';
import { RealtimeBus } from './realtime.bus';
import { tenancyAdapter } from '../_adapters/tenancy.adapter';

export class RealtimeController {
    /**
     * GET /v1/wabee/realtime/stream?token=JWT
     *
     * El authMiddleware ya valida el token (header Authorization OR query ?token)
     * y adjunta req.user con el payload decodificado.
     * El tenancyAdapter extrae tenantId del mismo req.user / headers.
     */
    static stream(req: Request, res: Response): void {
        // ── 1. Extraer tenantId ─────────────────────────────────────────────
        let tenantId: string;
        try {
            tenantId = tenancyAdapter.getTenantId(req);
        } catch {
            res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No se pudo identificar la organización.' } });
            return;
        }

        // ── 2. Establecer headers SSE ───────────────────────────────────────
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no'); // Deshabilitar buffering en Nginx
        res.flushHeaders();

        // ── 3. Registrar suscriptor ─────────────────────────────────────────
        RealtimeBus.subscribe(tenantId, res as any);

        // ── 4. Evento inicial "hello" ───────────────────────────────────────
        res.write('event: hello\ndata: {}\n\n');

        // ── 5. Heartbeat cada 20s para mantener conexión viva ──────────────
        const heartbeat = setInterval(() => {
            try {
                res.write('event: ping\ndata: {}\n\n');
            } catch {
                clearInterval(heartbeat);
            }
        }, 20_000);

        // ── 6. Cleanup al cerrar conexión ───────────────────────────────────
        req.on('close', () => {
            clearInterval(heartbeat);
            RealtimeBus.unsubscribe(tenantId, res as any);
        });

        req.on('error', () => {
            clearInterval(heartbeat);
            RealtimeBus.unsubscribe(tenantId, res as any);
        });
    }
}
