import { prisma } from '@/config/core/core.prisma';
import { WhatsAppSharedService } from '../whatsapp.shared.service';
import { AnalyticsService } from '../../../analytics/analytics.service';
import { renderTemplatePreviewText } from '../utils/template-preview-renderer';

export class ConversationUpsertService {
    /**
     * Resuelve un hilo y lo reabre si está cerrado.
     */
    static async resolveThreadAndReopen(params: {
        tenantId: string;
        channelId: string;
        contactPhone: string;
        contactName?: string;
    }) {
        const { tenantId, channelId, contactPhone, contactName } = params;

        // 1. Resolver Hilo (Usando el servicio compartido)
        const thread = await WhatsAppSharedService.resolveThread({
            tenantId,
            channelId,
            contactPhone,
            contactName,
            isInbound: false
        });

        // 2. Lógica de Reapertura (Hardening)
        if (thread.status === 'CLOSED') {
            await prisma.whatsappThread.update({
                where: { id: thread.id },
                data: { status: 'OPEN', updatedAt: new Date() }
            });

            // Emitir Analytics: Thread Reopened
            await AnalyticsService.emitEvent({
                tenantId,
                eventType: 'THREAD_STATUS_CHANGED',
                channel: 'whatsapp',
                threadId: thread.id,
                contactId: thread.contactId || undefined,
                actorType: 'SYSTEM',
                meta: {
                    source: 'campaign',
                    previousStatus: 'CLOSED',
                    newStatus: 'OPEN'
                }
            });

            console.log(`[ConversationUpsert] Thread ${thread.id} reabierto por campaña.`);
        }

        return thread;
    }

    /**
     * Inserta un mensaje outbound de campaña en el Inbox con idempotencia robusta.
     * Estrategia: findFirst → update | create → catch P2002 → findFirst + update
     */
    static async upsertOutboundCampaignMessage(params: {
        tenantId: string;
        channelId: string;
        threadId: string;
        campaignId: string;
        campaignName: string;
        campaignMessageId: string;
        waMessageId?: string;
        toPhone: string;
        fromPhone: string;
        template: any;
        templateInputMapping?: any;
        contact?: { name?: string; phone?: string; email?: string } | null;
        resolvedMediaUrl?: string | null;
    }) {
        const {
            tenantId,
            channelId,
            threadId,
            campaignId,
            campaignName,
            campaignMessageId,
            waMessageId,
            toPhone,
            fromPhone,
            template,
            templateInputMapping,
            contact,
            resolvedMediaUrl
        } = params;

        const externalRef = `campaign:${campaignMessageId}`;

        // Renderizado REAL del contenido con soporte completo de contact_field + media URL resuelta
        const rendered = renderTemplatePreviewText(template, templateInputMapping, contact, resolvedMediaUrl ?? null);
        const textBody = rendered.bodyText;

        try {
            // ── Paso 1: Buscar mensaje existente (idempotencia por externalRef + tenantId) ──
            let existingMessage = await prisma.whatsappMessage.findFirst({
                where: {
                    tenantId,
                    externalRef
                }
            });

            if (existingMessage) {
                // Ya existe → actualizar waMessageId/status si Meta respondió
                existingMessage = await prisma.whatsappMessage.update({
                    where: { id: existingMessage.id },
                    data: {
                        waMessageId: waMessageId || undefined,
                        status: waMessageId ? 'SENT' : undefined,
                        deliveryStatus: waMessageId ? 'SENT' : undefined,
                        // Actualizar textBody si estaba vacío (edge case)
                        textBody: existingMessage.textBody || textBody
                    }
                });
                console.log(`[ConversationUpsert] Mensaje existente actualizado: ${existingMessage.id}`);
                return existingMessage;
            }

            // ── Paso 2: Crear mensaje nuevo ──
            const newMessage = await prisma.whatsappMessage.create({
                data: {
                    tenantId,
                    channelId,
                    threadId,
                    direction: 'OUTBOUND',
                    fromPhone,
                    toPhone,
                    remotePhone: toPhone,
                    type: 'template',
                    textBody,
                    waMessageId,
                    timestamp: new Date(),
                    status: waMessageId ? 'SENT' : 'SENDING',
                    deliveryStatus: waMessageId ? 'SENT' : 'PENDING',
                    externalRef,
                    source: 'campaign',
                    metadata: {
                        source: 'campaign',
                        campaignId,
                        campaignMessageId,
                        campaignName,
                        templateName: template.name,
                        language: template.language,
                        templatePreview: rendered
                    }
                }
            });

            // Actualizar metadata del Hilo con Texto Real e indicador de Fuente
            await prisma.whatsappThread.update({
                where: { id: threadId },
                data: {
                    lastMessageAt: new Date(),
                    lastMessagePreview: textBody.substring(0, 100),
                    updatedAt: new Date(),
                    source: 'campaign',
                    metadata: {
                        lastMessageSource: 'campaign',
                        campaignId,
                        campaignName
                    }
                }
            });

            // Analytics: Message Outbound Flow
            await AnalyticsService.emitEvent({
                tenantId,
                eventType: 'MESSAGE_OUTBOUND_FLOW',
                channel: 'whatsapp',
                threadId,
                contactId: undefined,
                actorType: 'FLOW',
                meta: {
                    messageId: newMessage.id,
                    source: 'campaign',
                    campaignId,
                    campaignMessageId
                }
            });

            return newMessage;
        } catch (error: any) {
            // ── Paso 3: Race condition P2002 → recuperar con findFirst + update ──
            if (error.code === 'P2002') {
                console.warn(`[ConversationUpsert] P2002 race condition para externalRef: ${externalRef}. Recuperando...`);

                const raceMessage = await prisma.whatsappMessage.findFirst({
                    where: { tenantId, externalRef }
                });

                if (raceMessage) {
                    const updated = await prisma.whatsappMessage.update({
                        where: { id: raceMessage.id },
                        data: {
                            waMessageId: waMessageId || undefined,
                            status: waMessageId ? 'SENT' : undefined,
                            deliveryStatus: waMessageId ? 'SENT' : undefined,
                            textBody: raceMessage.textBody || textBody
                        }
                    });
                    console.log(`[ConversationUpsert] Recuperado de P2002, mensaje: ${updated.id}`);
                    return updated;
                }
            }
            throw error;
        }
    }
}
