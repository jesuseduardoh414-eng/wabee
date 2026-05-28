import { prisma } from '@/config/core/core.prisma';
import { WhatsAppCloudSender } from '@/modules/wabee/inbox/whatsapp/senders/WhatsAppCloudSender';
import { WhatsAppSharedService } from '@/modules/wabee/inbox/whatsapp/whatsapp.shared.service';
import { WhatsAppUtils } from '@/modules/wabee/inbox/whatsapp/whatsapp.utils';
import { ConversationUpsertService } from '@/modules/wabee/inbox/whatsapp/services/conversation-upsert.service';
import { CampaignMediaLinkService } from './services/campaign-media-link.service';
import { RealtimeBus } from '@/modules/wabee/realtime/realtime.bus';
import { CampaignsService } from './campaigns.service';
import { CampaignEventsService, CampaignAction } from './services/campaign-events.service';
import { AnalyticsService } from '../analytics/analytics.service';

// ─── PII Masking ──────────────────────────────────────────────────────────────────────────
function maskPhone(phone: string): string {
    if (!phone || phone.length < 4) return '***';
    return `***${phone.slice(-4)}`;
}

// ─── Template Components Resolver ──────────────────────────────────────────────────────
/**
 * Resuelve un valor de mapping para un contacto específico.
 * - 'fixed', 'fixed_media': devuelve entry.value directamente
 * - 'contact_field': accede al campo del contacto; usa fallback si está vacío
 */
function resolveValue(
    entry: { mode: 'fixed' | 'contact_field' | 'fixed_media'; value: string; fallback?: string },
    contact: any
): string {
    if (entry.mode === 'fixed' || entry.mode === 'fixed_media') {
        return entry.value;
    }
    // contact_field: mapeo seguro de campos permitidos
    let resolved: string | undefined | null = null;
    switch (entry.value) {
        case 'contact.name': resolved = contact?.name; break;
        case 'contact.phone': resolved = contact?.phone; break;
        case 'contact.email': resolved = contact?.email; break;
        default: resolved = null;
    }
    return resolved || entry.fallback || '';
}

/**
 * Construye el array de components con parameters en formato Meta Cloud API.
 *
 * Si mapping es null/vacío → retorna [] (template estático, Meta no necesita components).
 * Format esperado por Meta:
 * [
 *   { type: "body", parameters: [{ type: "text", text: "valor" }] },
 *   { type: "header", parameters: [{ type: "image", image: { link: "url" } }] },
 *   ...
 * ]
 */
async function resolveTemplateComponentsAsync(
    tenantId: string,
    templateComponents: any[],
    mapping: Record<string, any> | null | undefined,
    contact: any
): Promise<any[]> {
    if (!mapping || Object.keys(mapping).length === 0) return [];
    if (!Array.isArray(templateComponents)) return [];

    const PLACEHOLDER_RE = /\{\{(\d+)\}\}/g;
    const result: any[] = [];

    for (const comp of templateComponents) {
        if (comp.type === 'BODY' && comp.text) {
            const indices: number[] = [];
            let m: RegExpExecArray | null;
            const re = new RegExp(PLACEHOLDER_RE.source, 'g');
            while ((m = re.exec(comp.text)) !== null) {
                indices.push(parseInt(m[1], 10));
            }
            if (indices.length > 0) {
                const parameters = indices.map(idx => {
                    const entry = mapping[`body_var_${idx}`];
                    return { type: 'text', text: entry ? resolveValue(entry, contact) : '' };
                });
                result.push({ type: 'body', parameters });
            }
        } else if (comp.type === 'HEADER') {
            const format = comp.format ?? 'NONE';
            if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(format)) {
                // Soportar tanto `header_media_1` u otros mappings como un fallback a `header_media`
                const entry = mapping['header_media'] || mapping[`header_media_1`];
                if (entry) {
                    const mediaValue = resolveValue(entry, contact);
                    const resolvedLink = await CampaignMediaLinkService.resolveMediaLink(tenantId, mediaValue);
                    const metaType = format.toLowerCase() as 'image' | 'video' | 'document';
                    result.push({
                        type: 'header',
                        parameters: [{ type: metaType, [metaType]: { link: resolvedLink } }]
                    });
                }
            } else if (format === 'TEXT' && comp.text) {
                const indices: number[] = [];
                let m: RegExpExecArray | null;
                const re = new RegExp(PLACEHOLDER_RE.source, 'g');
                while ((m = re.exec(comp.text)) !== null) {
                    indices.push(parseInt(m[1], 10));
                }
                if (indices.length > 0) {
                    const parameters = indices.map(idx => {
                        const entry = mapping[`header_var_${idx}`];
                        return { type: 'text', text: entry ? resolveValue(entry, contact) : '' };
                    });
                    result.push({ type: 'header', parameters });
                }
            }
        } else if (comp.type === 'BUTTONS' && Array.isArray(comp.buttons)) {
            comp.buttons.forEach((btn: any, btnIndex: number) => {
                if (btn.type === 'URL' && btn.url) {
                    const indices: number[] = [];
                    let m: RegExpExecArray | null;
                    const re = new RegExp(PLACEHOLDER_RE.source, 'g');
                    while ((m = re.exec(btn.url)) !== null) {
                        indices.push(parseInt(m[1], 10));
                    }
                    if (indices.length > 0) {
                        const parameters = indices.map(idx => {
                            const entry = mapping[`button_url_${btnIndex}_var_${idx}`];
                            return { type: 'text', text: entry ? resolveValue(entry, contact) : '' };
                        });
                        result.push({ type: 'button', sub_type: 'url', index: btnIndex, parameters });
                    }
                }
            });
        }
    }

    return result;
}

export class CampaignWorker {
    private static isRunning = false;
    private static sender = new WhatsAppCloudSender();

    /**
     * Inicia el loop del worker.
     * En producción esto podría ser un proceso separado o un cron.
     */
    static start(intervalMs: number = 10000) {
        console.log(`[CampaignWorker] Motor iniciado (Intervalo: ${intervalMs}ms)`);
        setInterval(() => this.tick(), intervalMs);
    }

    private static async tick() {
        if (this.isRunning) return;
        this.isRunning = true;

        try {
            await this.activateScheduledCampaigns();
            await this.processInProgressCampaigns();
        } catch (error) {
            console.error('[CampaignWorker] Error en el ciclo de ejecución:', error);
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Activa campañas cuya fecha programada ya pasó.
     *
     * ANTI-RACE CONDITION:
     * Se usa updateMany con WHERE status='SCHEDULED' para que la actualización
     * sea atómica a nivel DB. Si dos workers corren simultáneamente, solo uno
     * encontrará filas con status='SCHEDULED' (el otro ya las habrá cambiado a IN_PROGRESS).
     *
     * Flujo:
     * 1. updateMany atómico: SCHEDULED → IN_PROGRESS (claim)
     * 2. findMany posterior: buscar las que se activaron en este tick
     * 3. expandAudienceAndSeedMessages por cada una (idempotente por UNIQUE index)
     * 4. Publicar evento SSE
     */
    private static async activateScheduledCampaigns() {
        const now = new Date();
        // Ventana de búsqueda posterior: campañas activadas en el último minuto
        const windowStart = new Date(now.getTime() - 60_000);

        // ── STEP 1: Claim atómico ──────────────────────────────────────────────
        // Solo una instancia del worker podrá cambiar cualquier campaña dada
        // de SCHEDULED a IN_PROGRESS, porque el WHERE incluye status='SCHEDULED'.
        const claimResult = await prisma.whatsappCampaign.updateMany({
            where: {
                status: 'SCHEDULED',
                scheduledAt: {
                    not: null,
                    lte: now,
                },
            },
            data: {
                status: 'IN_PROGRESS',
                startedAt: now,
            },
        });

        if (claimResult.count === 0) return; // Nada que activar

        console.log(`[CampaignWorker] Reclamadas ${claimResult.count} campaña(s) programada(s) para activación.`);

        // ── STEP 2: Buscar las campañas recién activadas ──────────────────────
        // (updateMany no devuelve registros; usamos ventana de tiempo)
        const activatedCampaigns = await prisma.whatsappCampaign.findMany({
            where: {
                status: 'IN_PROGRESS',
                startedAt: { gte: windowStart },
                scheduledAt: { not: null, lte: now },
            },
            include: { channel: true, template: true },
        });

        // ── STEP 3: Expandir audiencia y sembrar mensajes por campaña ─────────
        for (const campaign of activatedCampaigns) {
            try {
                console.log(`[CampaignWorker] Activando campaña programada: "${campaign.name}" (${campaign.id}) tenant=${campaign.tenantId}`);

                // Expandir audiencia → crear whatsappCampaignMessage (idempotente con skipDuplicates)
                const recipientCount = await CampaignsService.expandAudienceAndSeedMessages(
                    campaign.tenantId,
                    campaign.id
                );

                console.log(`[CampaignWorker] Audiencia expandida: "${campaign.name}" → ${recipientCount} destinatario(s)`);

                // ── STEP 4: Publicar evento SSE ─────────────────────────────
                RealtimeBus.publish(campaign.tenantId, {
                    type: 'campaign.status',
                    campaignId: campaign.id,
                    payload: {
                        status: 'IN_PROGRESS',
                        startedAt: campaign.startedAt?.toISOString() ?? now.toISOString(),
                        estimatedRecipients: recipientCount,
                    } as any
                });

                try {
                    console.log(`[CampaignWorker] Audit event -> CAMPAIGN_AUTO_STARTED for ${campaign.id}`);
                    await CampaignEventsService.logCampaignEvent({
                        tenantId: campaign.tenantId,
                        actorUserId: null,
                        campaignId: campaign.id,
                        campaignName: campaign.name,
                        action: 'CAMPAIGN_AUTO_STARTED',
                        metadata: { trigger: 'worker', estimatedRecipients: recipientCount }
                    });
                } catch (auditError) {
                    console.error('[CampaignWorker] Non-critical audit error during auto-start:', auditError);
                }

            } catch (err: any) {
                // Error al expandir audiencia de una campaña → marcar como FAILED sin tumbar el worker
                console.error(
                    `[CampaignWorker] Error activando campaña "${campaign.name}" (${campaign.id}):`,
                    err?.message ?? err
                );

                try {
                    const failed = await prisma.whatsappCampaign.update({
                        where: { id: campaign.id },
                        data: {
                            status: 'FAILED',
                            pauseReason: `Error al expandir audiencia: ${err?.message ?? 'UNKNOWN'}`,
                        }
                    });
                    RealtimeBus.publish(failed.tenantId, {
                        type: 'campaign.status',
                        campaignId: failed.id,
                        payload: { status: 'FAILED', pauseReason: failed.pauseReason }
                    });

                    try {
                        console.log(`[CampaignWorker] Audit event -> CAMPAIGN_FAILED for ${failed.id}`);
                        await CampaignEventsService.logCampaignEvent({
                            tenantId: failed.tenantId,
                            actorUserId: null,
                            campaignId: failed.id,
                            campaignName: failed.name,
                            action: 'CAMPAIGN_FAILED',
                            metadata: { trigger: 'worker', error: err?.message }
                        });
                    } catch (auditError) {
                        console.error('[CampaignWorker] Non-critical audit error during failure log:', auditError);
                    }
                } catch (innerErr) {
                    console.error(`[CampaignWorker] Error FATAL marcando FAILED la campaña ${campaign.id}:`, innerErr);
                }
            }
        }
    }

    /**
     * Procesa lotes de mensajes de campañas activas.
     */
    private static async processInProgressCampaigns() {
        const activeCampaigns = await prisma.whatsappCampaign.findMany({
            where: { status: 'IN_PROGRESS' },
            include: { channel: true, template: true }
        });

        for (const campaign of activeCampaigns) {
            // Verificar Salud del Canal (Circuit Breaker TRD)
            if (campaign.channel.healthStatus === 'RED' || campaign.channel.status === 'SUSPENDED') {
                console.warn(`[CampaignWorker] Canal ${campaign.channel.name} degradado. Pausando campaña ${campaign.name}`);
                const paused = await prisma.whatsappCampaign.update({
                    where: { id: campaign.id },
                    data: { status: 'PAUSED', pauseReason: 'Canal degradado (Health RED)' }
                });
                RealtimeBus.publish(paused.tenantId, {
                    type: 'campaign.status',
                    campaignId: paused.id,
                    payload: { status: 'PAUSED', pauseReason: paused.pauseReason }
                });
                continue;
            }

            // Obtener lote de mensajes PENDING o RETRY
            const now = new Date();
            const messages = await prisma.whatsappCampaignMessage.findMany({
                where: {
                    campaignId: campaign.id,
                    status: { in: ['PENDING'] }, // Simplificado para este lote
                    // Próxima versión incluirá lógica de retries con nextAttemptAt
                },
                take: 20, // TPS Control: Lote pequeño para no saturar y respetar rate limit
                include: { contact: true }
            });

            if (messages.length === 0) {
                // Verificar si quedan mensajes en otros estados no finales (FAILED con retry?)
                const remaining = await prisma.whatsappCampaignMessage.count({
                    where: { campaignId: campaign.id, status: 'PENDING' }
                });

                if (remaining === 0) {
                    console.log(`[CampaignWorker] Campaña finalizada: ${campaign.name}`);
                    const completed = await prisma.whatsappCampaign.update({
                        where: { id: campaign.id },
                        data: { status: 'COMPLETED', completedAt: now }
                    });
                    RealtimeBus.publish(completed.tenantId, {
                        type: 'campaign.status',
                        campaignId: completed.id,
                        payload: {
                            status: 'COMPLETED',
                            completedAt: completed.completedAt?.toISOString() ?? null,
                        }
                    });

                    const finalStatus: CampaignAction = completed.failedCount > 0 ? 'CAMPAIGN_PARTIAL_FAILURE' : 'CAMPAIGN_COMPLETED';
                    try {
                        console.log(`[CampaignWorker] Audit event -> ${finalStatus} for ${completed.id}`);
                        await CampaignEventsService.logCampaignEvent({
                            tenantId: completed.tenantId,
                            actorUserId: null,
                            campaignId: completed.id,
                            campaignName: completed.name,
                            action: finalStatus,
                            metadata: {
                                trigger: 'worker',
                                sentCount: completed.sentCount,
                                deliveredCount: completed.deliveredCount,
                                readCount: completed.readCount,
                                failedCount: completed.failedCount
                            }
                        });
                    } catch (auditError) {
                        console.error('[CampaignWorker] Non-critical audit error during completion log:', auditError);
                    }
                }
                continue;
            }

            // Procesar lote
            for (const msg of messages) {
                await this.sendCampaignMessage(campaign, msg);
            }
        }
    }

    private static async sendCampaignMessage(campaign: any, campaignMessage: any) {
        const { tenantId, channelId } = campaign;
        const contact = campaignMessage.contact;
        const normalizedPhone = WhatsAppUtils.normalizeToE164Digits(contact.phone);

        try {
            // 1. Resolver Hilo y Reabrir si es necesario
            const thread = await ConversationUpsertService.resolveThreadAndReopen({
                tenantId,
                channelId,
                contactPhone: normalizedPhone,
                contactName: contact.name,
            });

            // 2. Resolver components con mapping (masking de PII en log)
            const resolvedComponents = await resolveTemplateComponentsAsync(
                tenantId,
                (campaign.template?.components as any[]) ?? [],
                campaign.templateInputMapping as Record<string, any> | null,
                contact
            );

            // Extraer URL de media resuelta para el header (si existe un bloque header con link)
            let resolvedHeaderMediaUrl: string | null = null;
            for (const comp of resolvedComponents) {
                if (comp.type === 'header' && Array.isArray(comp.parameters)) {
                    const param = comp.parameters[0];
                    if (param?.image?.link) resolvedHeaderMediaUrl = param.image.link;
                    else if (param?.video?.link) resolvedHeaderMediaUrl = param.video.link;
                    else if (param?.document?.link) resolvedHeaderMediaUrl = param.document.link;
                }
            }

            console.log(
                `[CampaignWorker] Enviando a ${maskPhone(normalizedPhone)} ` +
                `| template: ${campaign.template?.name ?? 'N/A'} ` +
                `| components: ${resolvedComponents.length} bloque(s)`
            );

            // 4. Enviar vía Meta (con components resueltos)
            const sendResult = await this.sender.sendTemplate({
                channel: campaign.channel,
                template: campaign.template,
                to: normalizedPhone,
                tenantId,
                threadId: thread.id,
                components: resolvedComponents,  // [] si no hay mapping
            });

            // 5. Upsert Mensaje en Inbox (Hardened Idempotency + Real Rendering)
            const inboxMsg = await ConversationUpsertService.upsertOutboundCampaignMessage({
                tenantId,
                channelId,
                threadId: thread.id,
                campaignId: campaign.id,
                campaignName: campaign.name,
                campaignMessageId: campaignMessage.id,
                waMessageId: sendResult.externalId,
                toPhone: normalizedPhone,
                fromPhone: campaign.channel.displayPhone || 'system',
                template: campaign.template,
                templateInputMapping: campaign.templateInputMapping,
                contact: { name: contact?.name, phone: contact?.phone, email: contact?.email },
                resolvedMediaUrl: resolvedHeaderMediaUrl,  // ← URL resuelta para preview
            });

            // 6. Actualizar CampaignMessage a SENT y vincular IDs
            await prisma.whatsappCampaignMessage.update({
                where: { id: campaignMessage.id },
                data: {
                    status: 'SENT',
                    messageId: inboxMsg?.id,
                    waMessageId: sendResult.externalId
                }
            });

            // 7. Incrementar contador SENT en campaña y obtener snapshot absoluto
            const updatedCampaign = await prisma.whatsappCampaign.update({
                where: { id: campaign.id },
                data: { sentCount: { increment: 1 } }
            });
            
            // 7.5. Registrar evento de analítica para gráficas
            await AnalyticsService.emitEvent({
                tenantId,
                eventType: 'CAMPAIGN_MESSAGE_SENT',
                channel: 'whatsapp',
                campaignId: campaign.id,
                campaignMessageId: campaignMessage.id,
                contactId: contact.id,
                threadId: thread.id,
                meta: {
                    phone: normalizedPhone,
                    template: campaign.template?.name
                }
            });

            // 8. Publicar métricas en tiempo real (throttled, valores absolutos)
            RealtimeBus.publish(tenantId, {
                type: 'campaign.metrics',
                campaignId: campaign.id,
                payload: {
                    sentCount: updatedCampaign.sentCount,
                    deliveredCount: updatedCampaign.deliveredCount,
                    readCount: updatedCampaign.readCount,
                    failedCount: updatedCampaign.failedCount,
                    status: updatedCampaign.status,
                }
            });

        } catch (error: any) {
            // Log seguro: sin PII completa, sin contenido del mapping
            console.error(
                `[CampaignWorker] Error enviando mensaje ${campaignMessage.id} ` +
                `a ${maskPhone(normalizedPhone)}: ${error?.message ?? 'UNKNOWN_ERROR'}`
            );

            try {
                await prisma.whatsappCampaignMessage.update({
                    where: { id: campaignMessage.id },
                    data: {
                        status: 'FAILED',
                        errorCode: String(error?.code || error?.status || 'UNKNOWN_ERROR'),
                        errorPayload: {
                            message: error?.message || 'Unknown',
                            code: error?.code,
                            status: error?.status
                        }
                    }
                });

                const failedCampaign = await prisma.whatsappCampaign.update({
                    where: { id: campaign.id },
                    data: { failedCount: { increment: 1 } }
                });

                // Registrar evento de analítica de fallo
                await AnalyticsService.emitEvent({
                    tenantId,
                    eventType: 'CAMPAIGN_MESSAGE_FAILED',
                    channel: 'whatsapp',
                    campaignId: campaign.id,
                    campaignMessageId: campaignMessage.id,
                    contactId: contact?.id,
                    meta: {
                        error: error?.message || 'Unknown',
                        code: error?.code
                    }
                });
                // Publicar métricas con snapshot absoluto
                RealtimeBus.publish(tenantId, {
                    type: 'campaign.metrics',
                    campaignId: campaign.id,
                    payload: {
                        sentCount: failedCampaign.sentCount,
                        deliveredCount: failedCampaign.deliveredCount,
                        readCount: failedCampaign.readCount,
                        failedCount: failedCampaign.failedCount,
                        status: failedCampaign.status,
                    }
                });
            } catch (innerError) {
                console.error(`[CampaignWorker] Error FATAL actualizando estado FAILED de ${campaignMessage.id}:`, innerError);
            }
        }
    }
}
