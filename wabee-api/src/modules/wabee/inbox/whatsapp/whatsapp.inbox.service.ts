import { prisma } from '@/lib/prisma';
import { env } from '@/config/env';
import { WhatsAppCloudSender } from './senders/WhatsAppCloudSender';
import { WhatsAppWindowService } from './whatsapp.window.service';
import { WhatsAppUtils } from './whatsapp.utils';
import { WhatsAppSharedService } from './whatsapp.shared.service';
import { AnalyticsService } from '../../analytics/analytics.service';
import { RealtimeBus } from '@/modules/wabee/realtime/realtime.bus';

export async function getMessagesByChannel(
    tenantId: string,
    channelId: string,
    limit: number = 20,
    cursor?: string
) {
    // 1. Verify channel belongs to tenant
    const channel = await prisma.whatsappChannel.findFirst({
        where: { id: channelId, tenantId: tenantId },
        select: { id: true, name: true }
    });

    if (!channel) {
        throw { status: 404, message: 'Channel not found or access denied' };
    }

    // 2. Fetch messages with cursor-based pagination
    const messages = await prisma.whatsappMessage.findMany({
        where: {
            tenantId: tenantId,
            channelId: channelId
        },
        select: {
            id: true,
            tenantId: true,
            channelId: true,
            threadId: true,
            direction: true,
            fromPhone: true,
            toPhone: true,
            remotePhone: true,
            type: true,
            textBody: true,
            timestamp: true,
            status: true,
            metadata: true,
            waMessageId: true,
            deliveryStatus: true,
            externalRef: true,
            errorCode: true,
            errorMessage: true,
            deliveredAt: true,
            readAt: true
        },
        take: limit + 1, // Take one extra to determine if there's a next page
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { timestamp: 'desc' },
    });

    // 3. Determine next cursor
    let nextCursor: string | undefined = undefined;
    if (messages.length > limit) {
        const nextItem = messages.pop(); // Remove the extra item
        nextCursor = nextItem?.id;
    }

    return {
        items: messages,
        nextCursor,
    };
}

export async function getInboxThreads(tenantId: string, channelId: string, limit: number = 20) {
    // 1. Verify channel belongs to tenant
    const channel = await prisma.whatsappChannel.findFirst({
        where: { id: channelId, tenantId: tenantId },
        select: { id: true, name: true }
    });

    if (!channel) {
        throw { status: 404, message: 'Channel not found or access denied' };
    }

    // UPDATED: Simple and robust query - Return ALL threads for tenant/channel
    const threads = await prisma.whatsappThread.findMany({
        where: {
            tenantId,
            channelId
        },
        orderBy: { lastMessageAt: 'desc' },
        take: limit
    });

    console.log(`✅ Found ${threads.length} active threads in dedicated table.`);

    return threads;
}

export async function getMessagesByThread(
    tenantId: string,
    channelId: string,
    threadIdOrPhone: string, // Accept both for transition
    limit: number = 50,
    cursor?: string
) {
    // Verify channel
    const channel = await prisma.whatsappChannel.findFirst({
        where: { id: channelId, tenantId: tenantId },
    });
    if (!channel) throw { status: 404, message: 'Channel not found' };

    console.log(`💬 Fetching messages for thread ${threadIdOrPhone} in channel ${channelId}`);

    // Robust query: Try to filter by threadId first, then fallback to remotePhone
    const messages = await prisma.whatsappMessage.findMany({
        where: {
            tenantId,
            channelId,
            AND: [
                {
                    OR: [
                        { threadId: threadIdOrPhone },
                        { remotePhone: threadIdOrPhone }
                    ]
                }
            ]
        },
        select: {
            id: true,
            tenantId: true,
            channelId: true,
            threadId: true,
            direction: true,
            fromPhone: true,
            toPhone: true,
            remotePhone: true,
            type: true,
            textBody: true,
            timestamp: true,
            status: true,
            metadata: true,
            waMessageId: true,
            deliveryStatus: true,
            externalRef: true,
            errorCode: true,
            errorMessage: true,
            deliveredAt: true,
            readAt: true
        },
        orderBy: { timestamp: 'asc' }, // Chronological order for chat UI
        take: limit, // Use the provided limit
        cursor: cursor ? { id: cursor } : undefined,
    });

    // Fetch thread metadata for the frontend (phone, name, etc.)
    const thread = await prisma.whatsappThread.findFirst({
        where: {
            tenantId,
            channelId,
            OR: [
                { id: threadIdOrPhone },
                { contactPhone: threadIdOrPhone }
            ]
        }
    });

    console.log(`✅ Found ${messages.length} messages for thread ${threadIdOrPhone} (Limit: ${limit})`);

    return {
        items: messages,
        thread: thread ? {
            id: thread.id,
            contactPhone: thread.contactPhone,
            contactName: thread.contactName,
        } : undefined,
        nextCursor: undefined
    };
}

/**
 * Strictly normalizes phone numbers for WhatsApp Cloud API (MX focus).
 * Goal: Always produce 13 digits for Mexico (52 + 1 + 10 digits).
 */
function normalizeToE164Digits(phone: string): string {
    const digits = phone.replace(/[^\d]/g, ''); // Only digits

    // Case 1: 10 digits (assumed MX mobile) -> 52 + 10 (User requested NO '1')
    if (digits.length === 10) {
        return '52' + digits;
    }

    // Case 2: Starts with 52
    // If 13 digits and starts with 521 (Standard MX Mobile), user wants 12 digits (52... NO 1).
    if (digits.length === 13 && digits.startsWith('521')) {
        return '52' + digits.substring(3); // Strips the '1' -> 52 + 10 digits
    }

    // If 12 digits (52 + 10), user explicitly requested to keep it as is.
    if (digits.length === 12) {
        return digits; // Return as is (e.g., 527711005436)
    }

    // Fallback: return as digits if at least 8 digits, else throw
    if (digits.length < 8) {
        throw new Error(`Número inválido o muy corto para envío: ${phone}`);
    }

    // Other international (leave as is if not MX)
    return digits;
}

import { MessageSenderType, MessageGeneratedBy } from '@prisma/client';

export async function sendMessage(
    tenantId: string,
    threadId: string,
    text: string,
    traceData?: {
        senderType: MessageSenderType;
        senderUserId?: string | null;
        generatedBy: MessageGeneratedBy;
        aiProfileId?: string | null;
    }
) {
    // 1. Resolve Thread (and Channel)
    const thread = await prisma.whatsappThread.findUnique({
        where: { id: threadId, tenantId: tenantId },
        include: { channel: true }
    });

    if (!thread) {
        throw { status: 404, message: 'Hilo no encontrado o acceso denegado.' };
    }

    const channel = thread.channel;

    // 2. Resolve Destinatary and Normalize
    const toRaw = thread.contactPhone;
    let toNormalized: string;

    try {
        toNormalized = WhatsAppUtils.normalizeToE164Digits(toRaw);
    } catch (err: any) {
        throw { status: 400, message: err.message };
    }

    // [VALIDATION] Check 24h window using shared service for consistency
    await WhatsAppWindowService.is24hWindowOpen({
        tenantId,
        channelId: channel.id,
        contactPhoneNormalized: toNormalized
    });

    if (process.env.NODE_ENV !== 'production' && (toNormalized === 'unknown' || !toNormalized) && env.WHATSAPP_TEST_DEFAULT_TO) {
        // Ensure DEFAULT_TO is also normalized
        toNormalized = WhatsAppUtils.normalizeToE164Digits(env.WHATSAPP_TEST_DEFAULT_TO);
    }

    if (!toNormalized) {
        throw { status: 400, message: 'Este hilo no tiene número destino válido.' };
    }

    const channelId = channel.id;
    const phoneNumberIdUsed = channel.phoneNumberId;
    const toOriginal = toRaw;

    // 3. DEV ALLOWLIST VALIDATION & SANDBOX WARNING
    if (process.env.NODE_ENV !== 'production' && channel.phoneNumberId === (env.WHATSAPP_TEST_PHONE_NUMBER_ID || '879122178627116')) {
        console.warn(`\n⚠️ [SANDBOX MODE DETECTADO]: Mensajes de prueba solo serán entregados si el usuario (${toNormalized}) escribió al Sandbox en las últimas 24 horas, O si se usan templates aprobados. De lo contrario, Meta Graph API aceptará el mensaje pero lo descartará asincrónicamente por políticas anti-spam. \n`);

        if (env.WHATSAPP_TEST_ALLOWED_RECIPIENTS) {
            const allowed = (env.WHATSAPP_TEST_ALLOWED_RECIPIENTS as string).split(',').map((s: string) => s.trim());
            if (!allowed.includes(toNormalized)) {
                console.warn(`🛑 [DEV] Blocked send to ${toNormalized}. Not in WHATSAPP_TEST_ALLOWED_RECIPIENTS.`);
                throw {
                    status: 400,
                    message: `El número ${toNormalized} no está en la allowlist de sandbox (Meta Test Recipients). Agrégalo en el .env de WABEE y en el portal de Meta.`
                };
            }
        }
    }

    // AUDIT LOG (Requested Format: PRE-FLIGHT)
    console.log("[WA SEND PRE-FLIGHT]", {
        tenantId,
        threadId,
        channelId,
        phoneNumberIdUsed,
        toOriginal,
        toNormalized,
        payload: { text }
    });

    // 4. Select Adaptor (Strategy Pattern)
    const sender = new WhatsAppCloudSender();

    // 5. Persist INITIAL message (PENDING → will be updated to SENT after Meta confirms)
    const newMessage = await prisma.whatsappMessage.create({
        data: {
            tenantId,
            channelId: channel.id,
            threadId: thread.id,
            direction: 'OUTBOUND',
            fromPhone: channel.displayPhone || 'system',
            toPhone: thread.contactPhone,
            remotePhone: thread.contactPhone,
            type: 'text',
            textBody: text,
            timestamp: new Date(),
            status: 'SENDING',
            deliveryStatus: 'PENDING',
            senderType: traceData?.senderType || MessageSenderType.human,
            senderUserId: traceData?.senderUserId,
            generatedBy: traceData?.generatedBy || MessageGeneratedBy.user,
            aiProfileId: traceData?.aiProfileId,
            source: traceData?.senderType === MessageSenderType.ai ? 'AI' : 'SYSTEM'
        }
    });

    try {
        // 6. Send Message via Adaptor
        const sendResult = await sender.sendText({
            channel,
            tenantId,
            threadId,
            to: toNormalized,
            text
        });

        // AUDIT LOG (Requested Format: POST-FLIGHT)
        console.log("[WA SEND POST-FLIGHT]", {
            tenantId,
            threadId,
            waMessageId: sendResult.externalId,
            status: 'HTTP 200 OK',
            responseBody: sendResult.raw
        });

        // 7. Update to PENDING (Waiting for Webhook Truth)
        const updatedMessage = await prisma.whatsappMessage.update({
            where: { id: newMessage.id },
            data: {
                status: 'PENDING',
                deliveryStatus: 'PENDING',
                waMessageId: sendResult.externalId,
                rawPayload: sendResult.raw as any
            }
        });

        // 8. Emitir evento realtime al Inbox (SSE) — outbound visible inmediatamente
        try {
            RealtimeBus.publish(tenantId, {
                type: 'inbox.message',
                threadId: thread.id,
                payload: {
                    message: {
                        id: updatedMessage.id,
                        threadId: thread.id,
                        channelId: channel.id,
                        direction: 'OUTBOUND',
                        fromPhone: channel.displayPhone || 'system',
                        toPhone: thread.contactPhone,
                        remotePhone: thread.contactPhone,
                        type: 'text',
                        textBody: text,
                        waMessageId: sendResult.externalId,
                        timestamp: updatedMessage.timestamp || new Date(),
                        status: 'PENDING',
                        deliveryStatus: 'PENDING',
                    }
                }
            });
        } catch (pubErr) {
            console.warn('[InboxService] ⚠️ No se pudo publicar evento realtime outbound:', pubErr);
        }

        // 9. Update Thread metadata
        await prisma.whatsappThread.update({
            where: { id: thread.id },
            data: {
                lastMessageAt: newMessage.createdAt,
                lastMessagePreview: text.substring(0, 100),
                updatedAt: new Date()
            }
        });

        // 9. Update Contact last interaction
        if (thread.contactId) {
            await prisma.contact.update({
                where: { id: thread.contactId },
                data: { lastInteractionAt: new Date() }
            });
        }

        console.debug(`[WA SEND SUCCESS] Msg: ${updatedMessage.id}, Thread: ${thread.id}, Tenant: ${tenantId}`);

        // Analytics Hook dependiente del senderType
        // Si fue AI, el WhatsappChannelAdapter ya va a emitir un hook más enriquecido con tokens/intent.
        // Solo emitimos HUMAN o FLOW genérico aquí para no duplicar.
        if (!traceData || traceData.senderType === MessageSenderType.human) {
            AnalyticsService.emitEvent({
                tenantId,
                eventType: 'MESSAGE_OUTBOUND_HUMAN',
                channel: 'whatsapp',
                threadId: thread.id,
                actorType: 'HUMAN',
                actorUserId: traceData?.senderUserId || undefined,
                contactId: thread.contactId || undefined,
                meta: { messageId: updatedMessage.id }
            });
        }

        return updatedMessage;

    } catch (error: any) {
        console.error('❌ Error sending message to Meta:', error);

        // Update to FAILED
        await prisma.whatsappMessage.update({
            where: { id: newMessage.id },
            data: {
                status: 'FAILED',
                deliveryStatus: 'FAILED',
                errorCode: String(error.code || 'unknown'),
                errorMessage: error.message || 'Error desconocido'
            }
        });

        // Re-throw to controller
        throw error;
    }
}

export async function markThreadAsRead(tenantId: string, threadId: string) {
    // 1. Verify thread belongs to tenant
    const thread = await prisma.whatsappThread.findFirst({
        where: { id: threadId, tenantId: tenantId }
    });

    if (!thread) {
        throw { status: 404, message: 'Hilo no encontrado' };
    }

    // 2. Update Thread unreadCount -> 0
    await prisma.whatsappThread.update({
        where: { id: threadId },
        data: { unreadCount: 0 }
    });

    // 3. Update Messages status? 
    // User requested: "marcar mensajes INBOUND como READ_LOCAL"
    // We can assume 'READ' is the status we want.
    await prisma.whatsappMessage.updateMany({
        where: {
            threadId: threadId,
            tenantId: tenantId,
            direction: 'INBOUND',
            status: 'RECEIVED' // Update only those that are just received
        },
        data: {
            status: 'READ',
            readAt: new Date()
        }
    });

    console.log(`👀 Mark Read: Thread ${threadId} (Tenant: ${tenantId})`);
}
