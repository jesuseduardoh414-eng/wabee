import { Request, Response } from 'express';
import * as crypto from 'crypto';
import { prisma } from '@/config/core/core.prisma';
import { env } from '@/config/env';
import { WhatsAppSharedService } from '../inbox/whatsapp/whatsapp.shared.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { RealtimeBus } from '@/modules/wabee/realtime/realtime.bus';
import { WhatsAppChannelAdapter } from '../whatsapp/adapters/whatsapp.channel.adapter';
import { coreAdapter } from '@/modules/core/core.adapter';
import { normalizePhone } from '../contacts/contacts.service';
import { ThreadStateOrchestrator } from '../inbox/services/thread.state.orchestrator';

// ─── Idempotency key format ───────────────────────────────────────────────────
// Inbound messages  → `inbound:${waMessageId}`
// Status updates    → `status:${waMessageId}:${status}`
// These keys are stored in `webhook_events.eventId` (DB unique constraint).

export class CampaignWebhook {
    // ─── GET: Verificación del webhook (Meta handshake) ──────────────────────────
    static verify(req: Request, res: Response) {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        console.log(`[Webhook] GET verification requested | mode=${mode} token=${String(token).slice(0, 6)}***`);

        if (mode === 'subscribe' && token === env.WHATSAPP_VERIFY_TOKEN) {
            console.log('[Webhook] ✅ Verified – challenge sent');
            return res.status(200).send(challenge);
        }

        console.warn('[Webhook] ❌ Forbidden – verify token mismatch');
        return res.status(403).send('Forbidden');
    }

    // ─── POST: Recepción de eventos de WhatsApp ───────────────────────────────────
    static async handle(req: Request, res: Response) {
        // 1. Validar firma — obligatorio si META_APP_SECRET está configurado, en cualquier entorno
        const signature = req.headers['x-hub-signature-256'] as string | undefined;

        if (env.META_APP_SECRET) {
            if (!CampaignWebhook.isValidSignature((req as any).rawBody, signature)) {
                console.warn('[Webhook] ❌ Invalid signature – request rejected');
                return res.status(401).send('Invalid signature');
            }
        } else {
            console.warn('[Webhook] ⚠️ META_APP_SECRET no configurado – validación de firma omitida');
        }

        const body = req.body;

        // 2. Responder 200 solo DESPUÉS de procesar el lote completo.
        //    Procesamos de forma síncrona para garantizar que los datos quedan
        //    persistidos antes de responder. Meta considera reintentos si no
        //    recibe 200 en ~20 s, por eso cada item tiene su propio try/catch.
        try {
            const entry = body.entry?.[0];
            const changes = entry?.changes;

            if (!Array.isArray(changes) || changes.length === 0) {
                console.warn('[Webhook] ⚠️ Evento sin changes, ignorando');
                return res.status(200).send('EVENT_RECEIVED');
            }

            // Iteramos TODAS las changes (no solo la primera) y ruteamos por tipo.
            // Coexistence agrega `smb_message_echoes` (mensajes enviados desde la app
            // del cliente) e `history`/`smb_app_state_sync` (sync de historial).
            for (const change of changes) {
                const value = change?.value;
                const field = change?.field;
                if (!value) continue;

                // ── History sync (Coexistence) ─────────────────────────────────────
                if (field === 'history' || value.history) {
                    await CampaignWebhook.processHistorySync(value);
                    continue;
                }

                // ── App state sync / contactos (Coexistence) ───────────────────────
                if (field === 'smb_app_state_sync' || value.state_sync) {
                    await CampaignWebhook.processSmbAppStateSync(value);
                    continue;
                }

                // ── Status updates ──────────────────────────────────────────────────
                if (value.statuses && Array.isArray(value.statuses)) {
                    for (const statusObj of value.statuses) {
                        try {
                            await CampaignWebhook.processStatusUpdate(statusObj);
                        } catch (err) {
                            console.error('[Webhook] ❌ Error procesando status update:', err);
                        }
                    }
                }

                // ── Message echoes (Coexistence) — mensajes enviados desde la app ─────
                const echoes = value.message_echoes;
                if (echoes && Array.isArray(echoes)) {
                    for (const echoObj of echoes) {
                        try {
                            await CampaignWebhook.processMessageEcho(value.metadata, echoObj);
                        } catch (err) {
                            console.error('[Webhook] ❌ Error procesando message echo:', err);
                        }
                    }
                }

                // ── Inbound messages ─────────────────────────────────────────────────
                if (value.messages && Array.isArray(value.messages)) {
                    for (const msgObj of value.messages) {
                        try {
                            await CampaignWebhook.processIncomingMessage(value.metadata, msgObj);
                        } catch (err) {
                            console.error('[Webhook] ❌ Error procesando mensaje entrante:', err);
                        }
                    }
                }
            }

            return res.status(200).send('EVENT_RECEIVED');
        } catch (error) {
            // Error estructural del payload (e.g., body nulo)
            console.error('[Webhook] ❌ Error crítico procesando evento:', error);
            // Aún respondemos 200 para evitar reintentos de eventos ya recibidos
            return res.status(200).send('EVENT_RECEIVED');
        }
    }

    // ─── Firma HMAC-SHA256 (raw body) ──────────────────────────────────────────
    // Valida X-Hub-Signature-256. Usa rawBody (Buffer antes de express.json) para
    // evitar diferencias de serialización. Sin META_APP_SECRET retorna true (caller
    // decide si bloquear). Sin firma o sin rawBody retorna false.
    private static isValidSignature(rawBody: Buffer | undefined, signature: string | undefined): boolean {
        if (!env.META_APP_SECRET) {
            // Sin secret configurado no podemos validar; en prod esto ya fue advertido al arrancar.
            return true;
        }
        if (!signature) {
            // Sin header de firma: rechazar en producción (manejado por el caller).
            return false;
        }
        if (!rawBody) {
            console.warn('[Webhook] ⚠️ rawBody no disponible – asegúrate de montar el middleware raw-body antes de express.json para la ruta del webhook');
            return false;
        }
        const hmac = crypto.createHmac('sha256', env.META_APP_SECRET);
        const digest = 'sha256=' + hmac.update(rawBody).digest('hex');
        // Comparación segura de longitud constante para prevenir timing attacks
        try {
            return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
        } catch {
            return false;
        }
    }

    // ─── Procesamiento de mensaje entrante ─────────────────────────────────────
    /**
     * Idempotencia: antes de insertar, verificamos que el waMessageId no exista
     * en whatsapp_messages para este tenant. Si ya existe, se loguea y se omite.
     *
     * Campos de deduplicación:
     *   - waMessageId (campo `wa_message_id` en whatsapp_messages)
     *   - La tabla tiene un índice único parcial: (organization_id, wa_message_id)
     *     WHERE wa_message_id IS NOT NULL, lo que garantiza unicidad a nivel DB.
     *
     * Adicionalmente se usa WebhookEvent para idempotencia cross-table:
     *   eventId = `inbound:${waMessageId}`
     */
    private static async processIncomingMessage(metadata: any, msgObj: any) {
        const phoneId = metadata?.phone_number_id;
        const fromPhone = msgObj?.from;
        const waMessageId = msgObj?.id;

        if (!phoneId || !fromPhone || !waMessageId) {
            console.warn('[Webhook] ⚠️ Mensaje entrante con datos insuficientes, ignorando', { phoneId, fromPhone, waMessageId });
            return;
        }

        console.log(`[Webhook] 📥 Inbound message received | wamid=${waMessageId} phone_number_id=${phoneId} from=${fromPhone}`);

        // 1. Resolver canal por Phone Number ID → identificar tenant
        const channel = await prisma.whatsappChannel.findFirst({
            where: { phoneNumberId: phoneId }
        });

        if (!channel) {
            console.warn(`[Webhook] ⚠️ No se encontró canal para phone_number_id=${phoneId}. Configura el canal en WABEE con ese Phone Number ID.`);
            return;
        }

        const tenantId = channel.tenantId;
        console.log(`[Webhook] 📥 Tenant/channel resolved | tenantId=${tenantId} channelId=${channel.id}`);

        // 2. Idempotencia: verificar si el mensaje ya fue procesado
        const idempotencyKey = `inbound:${waMessageId}`;
        try {
            await coreAdapter.system.createWebhookEvent({
                tenantId,
                provider: 'meta_whatsapp',
                eventId: idempotencyKey,
                eventType: 'wa_inbound_message'
            });
        } catch (error: any) {
            if (error.code === 'P2002') {
                // Unique constraint violation → evento duplicado
                console.log(`[Webhook] ⚠️ Duplicate event ignored | wamid=${waMessageId}`);
                return;
            }
            throw error;
        }

        // 3. Resolver hilo (upsert idempotente: no crea duplicados)
        const thread = await WhatsAppSharedService.resolveThread({
            tenantId,
            channelId: channel.id,
            contactPhone: fromPhone,
            lastMessagePreview: msgObj.text?.body || `[${msgObj.type}]`,
            isInbound: true
        });

        console.log(`[Webhook] 📥 Thread resolved | threadId=${thread.id}`);

        // 4. Persistir mensaje entrante (esto siempre ocurre, el inbox humano o de IA debe ver el histórico de qué preguntó el usuario)
        const newMessage = await prisma.whatsappMessage.create({
            data: {
                tenantId,
                channelId: channel.id,
                threadId: thread.id,
                direction: 'INBOUND',
                fromPhone,
                toPhone: channel.displayPhone || 'system',
                remotePhone: fromPhone,
                type: msgObj.type,
                textBody: msgObj.text?.body,
                waMessageId,
                timestamp: new Date(parseInt(msgObj.timestamp) * 1000),
                status: 'RECEIVED',
                deliveryStatus: 'RECEIVED',
                rawPayload: msgObj
            }
        });

        console.log(`[Webhook] 📥 Inbound message persisted | msgId=${newMessage.id} threadId=${thread.id} tenantId=${tenantId}`);

        // 5. [IA INTERCEPTOR]: Validar si el agente responde en lugar del humano
        const agentHandled = await WhatsAppChannelAdapter.handleInbound(
            tenantId,
            channel.id,
            thread.id,
            thread.contactId || undefined,
            newMessage
        );

        if (agentHandled) {
            console.log(`[Webhook] 🤖 AI Agent handled the inbound message. Thread: ${thread.id}`);
            // Continuamos para emitir el realtime del inbound (para que la UI pinte la pregunta) 
            // aunque la respuesta también dispare el suyo localmente.
        }

        // 6. Emitir evento realtime al Inbox (SSE)
        try {
            RealtimeBus.publish(tenantId, {
                type: 'inbox.message',
                threadId: thread.id,
                payload: {
                    message: {
                        id: newMessage.id,
                        threadId: thread.id,
                        channelId: channel.id,
                        direction: 'INBOUND',
                        fromPhone,
                        toPhone: channel.displayPhone || 'system',
                        remotePhone: fromPhone,
                        type: msgObj.type,
                        textBody: msgObj.text?.body,
                        waMessageId,
                        timestamp: newMessage.timestamp,
                        status: 'RECEIVED',
                        deliveryStatus: 'RECEIVED',
                    },
                    thread: {
                        id: thread.id,
                        contactPhone: thread.contactPhone,
                        contactName: thread.contactName,
                        lastMessageAt: thread.lastMessageAt,
                        lastMessagePreview: msgObj.text?.body || `[${msgObj.type}]`,
                        unreadCount: thread.unreadCount,
                    }
                }
            });
        } catch (pubErr) {
            console.warn('[Webhook] ⚠️ No se pudo publicar evento realtime inbound:', pubErr);
        }

        // 6. Analytics
        await AnalyticsService.emitEvent({
            tenantId,
            eventType: 'MESSAGE_INBOUND_USER',
            channel: 'whatsapp',
            threadId: thread.id,
            contactId: thread.contactId || undefined,
            meta: {
                messageId: newMessage.id,
                text: msgObj.text?.body,
                contactName: thread.contactName
            }
        });
    }

    // ─── Procesamiento de message echoes (Coexistence) ────────────────────────
    /**
     * En Coexistence, los mensajes que el cliente envía DESDE su app de WhatsApp
     * Business llegan como `smb_message_echoes`. Los persistimos como OUTBOUND para
     * que el inbox de Wabee refleje la conversación completa (mirroring).
     *
     * Idempotencia: WebhookEvent con eventId = `echo:${waMessageId}` + índice único
     * parcial (organization_id, wa_message_id).
     *
     * Nota: el destinatario (cliente) viene en `echoObj.to`; `echoObj.from` es el
     * número del negocio.
     */
    private static async processMessageEcho(metadata: any, echoObj: any) {
        const phoneId = metadata?.phone_number_id;
        const waMessageId = echoObj?.id;
        const toPhone = echoObj?.to;

        if (!phoneId || !waMessageId || !toPhone) {
            console.warn('[Webhook] ⚠️ Echo con datos insuficientes, ignorando', { phoneId, waMessageId, toPhone });
            return;
        }

        console.log(`[Webhook] 🔁 Message echo received | wamid=${waMessageId} phone_number_id=${phoneId} to=${toPhone}`);

        // 1. Resolver canal por Phone Number ID → tenant
        const channel = await prisma.whatsappChannel.findFirst({
            where: { phoneNumberId: phoneId }
        });

        if (!channel) {
            console.warn(`[Webhook] ⚠️ Echo sin canal para phone_number_id=${phoneId}, ignorando`);
            return;
        }

        const tenantId = channel.tenantId;

        // 2. Idempotencia
        try {
            await coreAdapter.system.createWebhookEvent({
                tenantId,
                provider: 'meta_whatsapp',
                eventId: `echo:${waMessageId}`,
                eventType: 'wa_message_echo'
            });
        } catch (error: any) {
            if (error.code === 'P2002') {
                console.log(`[Webhook] ⚠️ Duplicate echo ignored | wamid=${waMessageId}`);
                return;
            }
            throw error;
        }

        // 3. Resolver hilo (el "remoto" es el cliente destinatario)
        const preview = echoObj.text?.body || `[${echoObj.type}]`;
        const thread = await WhatsAppSharedService.resolveThread({
            tenantId,
            channelId: channel.id,
            contactPhone: toPhone,
            lastMessagePreview: preview,
            isInbound: false
        });

        // 4. Persistir como OUTBOUND originado en la app del cliente
        const newMessage = await prisma.whatsappMessage.create({
            data: {
                tenantId,
                channelId: channel.id,
                threadId: thread.id,
                direction: 'OUTBOUND',
                fromPhone: channel.displayPhone || echoObj.from || 'system',
                toPhone,
                remotePhone: toPhone,
                type: echoObj.type,
                textBody: echoObj.text?.body,
                waMessageId,
                timestamp: new Date(parseInt(echoObj.timestamp) * 1000),
                status: 'SENT',
                deliveryStatus: 'SENT',
                source: 'APP',
                rawPayload: echoObj
            }
        });

        console.log(`[Webhook] 🔁 Echo persisted as OUTBOUND | msgId=${newMessage.id} threadId=${thread.id} tenantId=${tenantId}`);

        // 5. Anti-doble-respuesta: si la IA está activa en este thread, pausarla.
        //    El dueño respondió desde su teléfono → Wabee no debe contestar encima.
        try {
            const threadState = await prisma.whatsappThread.findUnique({
                where: { id: thread.id },
                select: { handlingMode: true, aiPaused: true },
            });
            const aiIsActive = threadState &&
                !threadState.aiPaused &&
                (threadState.handlingMode === 'ai' || threadState.handlingMode === 'copilot');
            if (aiIsActive) {
                await ThreadStateOrchestrator.humanTakeover(
                    thread.id,
                    tenantId,
                    'COEXISTENCE_PHONE',
                    'coexistence_phone_response',
                );
                console.log(`[Webhook] 🔁 IA pausada por echo del teléfono | threadId=${thread.id}`);
            }
        } catch (takeoverErr) {
            console.warn('[Webhook] ⚠️ No se pudo pausar IA tras echo:', takeoverErr);
        }

        // 7. Emitir realtime al Inbox
        try {
            RealtimeBus.publish(tenantId, {
                type: 'inbox.message',
                threadId: thread.id,
                payload: {
                    message: {
                        id: newMessage.id,
                        threadId: thread.id,
                        channelId: channel.id,
                        direction: 'OUTBOUND',
                        fromPhone: channel.displayPhone || 'system',
                        toPhone,
                        remotePhone: toPhone,
                        type: echoObj.type,
                        textBody: echoObj.text?.body,
                        waMessageId,
                        timestamp: newMessage.timestamp,
                        status: 'SENT',
                        deliveryStatus: 'SENT',
                    }
                }
            });
        } catch (pubErr) {
            console.warn('[Webhook] ⚠️ No se pudo publicar echo realtime:', pubErr);
        }
    }

    // ─── History sync (Coexistence) ───────────────────────────────────────────
    /**
     * Persiste el historial de chats que Meta envía al conectar un número en modo
     * Coexistence. El payload llega en `value.history[]`, donde cada elemento es un
     * thread con su `id` (teléfono del contacto) y un array `messages[]`.
     *
     * Idempotencia: cada mensaje usa `externalRef = hist:${wamid}` — el índice único
     * parcial de WhatsappMessage garantiza que no se dupliquen si el chunk se reenvía.
     */
    private static async processHistorySync(value: any) {
        const threads: any[] = Array.isArray(value?.history) ? value.history : [];
        const metadata = value?.metadata;
        const phoneId = metadata?.phone_number_id;

        if (!phoneId || threads.length === 0) {
            console.log(`[Webhook] 🗂️ History sync recibido pero sin threads o sin phone_number_id, ignorando.`);
            return;
        }

        const channel = await prisma.whatsappChannel.findFirst({ where: { phoneNumberId: phoneId } });
        if (!channel) {
            console.warn(`[Webhook] ⚠️ History sync: canal no encontrado para phone_number_id=${phoneId}`);
            return;
        }

        const tenantId = channel.tenantId;
        const businessPhone = channel.displayPhone || '';
        let saved = 0;
        let skipped = 0;

        for (const threadData of threads) {
            const contactPhone = threadData?.id;
            const messages: any[] = Array.isArray(threadData?.messages) ? threadData.messages : [];
            if (!contactPhone || messages.length === 0) continue;

            const thread = await WhatsAppSharedService.resolveThread({
                tenantId,
                channelId: channel.id,
                contactPhone,
                isInbound: true,
            });

            for (const msg of messages) {
                const wamid = msg?.id;
                if (!wamid) continue;

                const externalRef = `hist:${wamid}`;
                const isInbound = msg.from !== businessPhone;
                const ts = msg.timestamp ? new Date(parseInt(msg.timestamp) * 1000) : new Date();

                try {
                    await prisma.whatsappMessage.create({
                        data: {
                            tenantId,
                            channelId: channel.id,
                            threadId: thread.id,
                            direction: isInbound ? 'INBOUND' : 'OUTBOUND',
                            fromPhone: msg.from || (isInbound ? contactPhone : businessPhone),
                            toPhone: msg.to || (isInbound ? businessPhone : contactPhone),
                            remotePhone: contactPhone,
                            type: msg.type || 'text',
                            textBody: msg.text?.body || msg.caption || null,
                            waMessageId: wamid,
                            timestamp: ts,
                            status: isInbound ? 'RECEIVED' : 'SENT',
                            deliveryStatus: msg.history_context?.status || (isInbound ? 'DELIVERED' : 'SENT'),
                            externalRef,
                            source: 'history_sync',
                            rawPayload: msg,
                        },
                    });
                    saved++;
                } catch (err: any) {
                    if (err.code === 'P2002') { skipped++; continue; }
                    console.error(`[Webhook] ❌ Error persistiendo history msg ${wamid}:`, err.message);
                }
            }
        }

        console.log(`[Webhook] 🗂️ History sync completo | channel=${channel.id} threads=${threads.length} saved=${saved} skipped(dup)=${skipped}`);
    }

    // ─── App state sync / contactos (Coexistence) ─────────────────────────────
    /**
     * Meta envía los contactos del negocio vía `smb_app_state_sync` al conectar y
     * cuando cambian. Cada elemento de `value.state_sync[]` con `type="contact"` se
     * upsertea en la tabla de contactos del tenant.
     */
    private static async processSmbAppStateSync(value: any) {
        const stateSync: any[] = Array.isArray(value?.state_sync) ? value.state_sync : [];
        const metadata = value?.metadata;
        const phoneId = metadata?.phone_number_id;

        if (!phoneId || stateSync.length === 0) {
            console.log(`[Webhook] 📇 smb_app_state_sync recibido sin datos, ignorando.`);
            return;
        }

        const channel = await prisma.whatsappChannel.findFirst({ where: { phoneNumberId: phoneId } });
        if (!channel) {
            console.warn(`[Webhook] ⚠️ smb_app_state_sync: canal no encontrado para phone_number_id=${phoneId}`);
            return;
        }

        const tenantId = channel.tenantId;
        let upserted = 0;

        for (const entry of stateSync) {
            if (entry?.type !== 'contact' || !entry?.contact?.phone_number) continue;

            const rawPhone = entry.contact.phone_number as string;
            const name = entry.contact.full_name || entry.contact.first_name || null;

            try {
                const phone = normalizePhone(rawPhone);
                await prisma.contact.upsert({
                    where: { tenantId_phone: { tenantId, phone } },
                    update: { ...(name ? { name } : {}), updatedAt: new Date() },
                    create: {
                        tenantId,
                        phone,
                        name,
                        sourceSystem: 'whatsapp_coexistence',
                    },
                });
                upserted++;
            } catch (err: any) {
                console.error(`[Webhook] ❌ Error upserting contacto ${rawPhone}:`, err.message);
            }
        }

        console.log(`[Webhook] 📇 smb_app_state_sync completo | channel=${channel.id} upserted=${upserted}`);
    }

    // ─── Procesamiento de status updates ──────────────────────────────────────
    /**
     * Idempotencia: se usa WebhookEvent con eventId = `status:${waMessageId}:${status}`.
     * La tabla tiene unique(tenantId, eventId), garantizado a nivel DB.
     *
     * Máquina de estados: PENDING(0) → SENT(1) → DELIVERED(2) → READ(3) / FAILED(99).
     * Solo se avanza, nunca se retrocede.
     */
    private static async processStatusUpdate(statusObj: any) {
        const { id: waMessageId, status } = statusObj;

        if (!waMessageId || !status) {
            console.warn('[Webhook] ⚠️ Status update sin id o status, ignorando', statusObj);
            return;
        }

        console.log(`[Webhook] 📊 Status update received | wamid=${waMessageId} status=${status}`);

        // Buscar mensaje vinculado a campaña
        const campaignMsg = await prisma.whatsappCampaignMessage.findFirst({
            where: { waMessageId },
            include: { campaign: true }
        });

        if (!campaignMsg) {
            // Fallback: mensaje manual (desde Inbox, no de campaña)
            await CampaignWebhook.processManualMessageStatusUpdate(waMessageId, status, statusObj);
            return;
        }

        const tenantId = campaignMsg.tenantId;

        // Máquina de estados
        const statusMap: Record<string, number> = { pending: 0, sent: 1, delivered: 2, read: 3, failed: 99 };
        const currentScore = statusMap[campaignMsg.status.toLowerCase()] ?? 0;
        const newScore = statusMap[status.toLowerCase()] ?? -1;

        if (newScore < 0) {
            console.warn(`[Webhook] ⚠️ Status desconocido ignorado | wamid=${waMessageId} status=${status}`);
            return;
        }

        if (newScore <= currentScore && currentScore !== 99) {
            console.log(`[Webhook] ⚠️ Duplicate/stale status ignored | wamid=${waMessageId} current=${campaignMsg.status} received=${status}`);
            return;
        }

        let kpiField: 'deliveredCount' | 'readCount' | 'failedCount' | null = null;
        if (status === 'delivered') kpiField = 'deliveredCount';
        else if (status === 'read') kpiField = 'readCount';
        else if (status === 'failed') kpiField = 'failedCount';

        try {
            await prisma.$transaction(async (tx) => {
                // Idempotencia a nivel DB
                await coreAdapter.system.createWebhookEvent({
                    tenantId,
                    provider: 'meta_whatsapp',
                    eventId: `status:${waMessageId}:${status}`,
                    eventType: `wa_status_${status}`
                });

                // Actualizar estado del mensaje de campaña
                await tx.whatsappCampaignMessage.update({
                    where: { id: campaignMsg.id },
                    data: {
                        status: status.toUpperCase() as any,
                        ...(status === 'failed' && {
                            errorCode: statusObj.errors?.[0]?.code?.toString() || 'meta_error',
                            errorPayload: JSON.stringify(statusObj.errors || statusObj)
                        })
                    }
                });

                // Reconciliación con WhatsappMessage (Inbox)
                const msgStatus = status.toUpperCase();
                await tx.whatsappMessage.updateMany({
                    where: {
                        tenantId,
                        OR: [
                            { waMessageId },
                            { externalRef: `campaign:${campaignMsg.id}` }
                        ]
                    },
                    data: {
                        status: msgStatus,
                        deliveryStatus: msgStatus,
                        ...(status === 'delivered' && { deliveredAt: new Date() }),
                        ...(status === 'read' && { readAt: new Date() }),
                        ...(status === 'failed' && {
                            errorCode: statusObj.errors?.[0]?.code?.toString() || 'unknown',
                            errorMessage: statusObj.errors?.[0]?.message || statusObj.errors?.[0]?.error_data?.details || 'Error desconocido del provider',
                            rawPayload: statusObj as any
                        })
                    }
                });

                // Reconciliación de KPIs
                if (kpiField) {
                    await tx.whatsappCampaign.update({
                        where: { id: campaignMsg.campaignId },
                        data: { [kpiField]: { increment: 1 } }
                    });
                }
            });

            console.log(`[Webhook] 📊 Status update applied | wamid=${waMessageId} status=${status} tenantId=${tenantId}`);
            
            // Emitir evento de analítica para gráficas
            let analyticsEventType: any = null;
            if (status === 'delivered') analyticsEventType = 'CAMPAIGN_MESSAGE_DELIVERED';
            else if (status === 'read') analyticsEventType = 'CAMPAIGN_MESSAGE_READ';
            else if (status === 'failed') analyticsEventType = 'CAMPAIGN_MESSAGE_FAILED';
            
            if (analyticsEventType) {
                await AnalyticsService.emitEvent({
                    tenantId,
                    eventType: analyticsEventType,
                    channel: 'whatsapp',
                    campaignId: campaignMsg.campaignId,
                    campaignMessageId: campaignMsg.id,
                    contactId: campaignMsg.contactId,
                    meta: {
                        waMessageId,
                        ...(status === 'failed' && {
                            error: statusObj.errors?.[0]?.message || 'meta_error',
                            code: statusObj.errors?.[0]?.code
                        })
                    }
                });
            }
        } catch (error: any) {
            if (error.code === 'P2002') {
                console.log(`[Webhook] ⚠️ Duplicate status event ignored (DB) | wamid=${waMessageId} status=${status}`);
                return;
            }
            throw error;
        }

        // Publicar snapshot de métricas en realtime
        if (kpiField) {
            try {
                const updatedCampaign = await prisma.whatsappCampaign.findUnique({
                    where: { id: campaignMsg.campaignId },
                    select: {
                        tenantId: true,
                        sentCount: true,
                        deliveredCount: true,
                        readCount: true,
                        failedCount: true,
                        status: true,
                    }
                });
                if (updatedCampaign) {
                    RealtimeBus.publish(updatedCampaign.tenantId, {
                        type: 'campaign.metrics',
                        campaignId: campaignMsg.campaignId,
                        payload: {
                            sentCount: updatedCampaign.sentCount,
                            deliveredCount: updatedCampaign.deliveredCount,
                            readCount: updatedCampaign.readCount,
                            failedCount: updatedCampaign.failedCount,
                            status: updatedCampaign.status,
                        }
                    });
                }
            } catch (pubErr) {
                console.warn('[Webhook] ⚠️ No se pudo publicar evento realtime de campaña:', pubErr);
            }
        }
    }

    // ─── Status update para mensajes manuales (no de campaña) ─────────────────
    /**
     * Idempotencia: eventId = `status:${waMessageId}:${status}:manual`
     *
     * Match prioritario:
     *   1) por waMessageId (campo indexado)
     *   2) No hay fallback adicional: sin waMessageId no se puede reconciliar.
     */
    private static async processManualMessageStatusUpdate(
        waMessageId: string,
        status: string,
        statusObj: any
    ) {
        const statusOrder: Record<string, number> = {
            pending: 0, sent: 1, delivered: 2, read: 3, failed: 99
        };
        const newScore = statusOrder[status.toLowerCase()] ?? -1;
        if (newScore < 0) return;

        const existing = await prisma.whatsappMessage.findFirst({
            where: { waMessageId },
            select: { id: true, tenantId: true, deliveryStatus: true, direction: true }
        });

        if (!existing) {
            console.log(`[Webhook] ⚠️ Manual fallback: wamid=${waMessageId} no encontrado en WhatsappMessage. Status ignorado: ${status}`);
            return;
        }

        const currentScore = statusOrder[(existing.deliveryStatus || 'pending').toLowerCase()] ?? 0;
        if (newScore <= currentScore && currentScore !== 99) {
            console.log(`[Webhook] ⚠️ Duplicate/stale manual status ignored | wamid=${waMessageId} current=${existing.deliveryStatus} received=${status}`);
            return;
        }

        const deliveryStatus = status.toUpperCase();

        try {
            await prisma.$transaction(async (tx) => {
                // Idempotencia a nivel DB
                await coreAdapter.system.createWebhookEvent({
                    tenantId: existing.tenantId,
                    provider: 'meta_whatsapp',
                    eventId: `status:${waMessageId}:${status}:manual`,
                    eventType: `wa_status_${status}`
                });

                await tx.whatsappMessage.update({
                    where: { id: existing.id },
                    data: {
                        status: deliveryStatus,
                        deliveryStatus,
                        ...(status === 'delivered' && { deliveredAt: new Date() }),
                        ...(status === 'read' && { readAt: new Date() }),
                        ...(status === 'failed' && {
                            errorCode: statusObj.errors?.[0]?.code?.toString() || 'unknown',
                            errorMessage: statusObj.errors?.[0]?.message || statusObj.errors?.[0]?.error_data?.details || 'Error desconocido del provider',
                            rawPayload: statusObj as any
                        })
                    }
                });
            });

            console.log(`[Webhook] 📊 Manual message status updated | msgId=${existing.id} status=${deliveryStatus} tenantId=${existing.tenantId}`);

            // Publicar status update al realtime del Inbox
            try {
                RealtimeBus.publish(existing.tenantId, {
                    type: 'inbox.message_status',
                    messageId: existing.id,
                    payload: { deliveryStatus, waMessageId }
                } as any);
            } catch (pubErr) {
                console.warn('[Webhook] ⚠️ No se pudo publicar status update realtime:', pubErr);
            }
        } catch (error: any) {
            if (error.code === 'P2002') {
                console.log(`[Webhook] ⚠️ Duplicate manual status event ignored (DB) | wamid=${waMessageId} status=${status}`);
                return;
            }
            console.error('[Webhook] ❌ Error actualizando mensaje manual:', error);
        }
    }
}
