import { prisma } from '@/lib/prisma';
import { WhatsAppUtils } from '@/modules/wabee/inbox/whatsapp/whatsapp.utils';
import { WhatsAppSharedService } from '@/modules/wabee/inbox/whatsapp/whatsapp.shared.service';
import { WhatsAppCloudSender } from '@/modules/wabee/inbox/whatsapp/senders/WhatsAppCloudSender';
import { WhatsAppWindowService } from '@/modules/wabee/inbox/whatsapp/whatsapp.window.service';

export class WhatsAppOutboundService {
    /**
     * Sends messages (text or template) to a list of CRM contacts.
     */
    static async sendBulk(params: {
        tenantId: string;
        channelId: string;
        contactIds: string[];
        text?: string;
        template?: any;
    }) {
        const { tenantId, channelId, contactIds, text, template } = params;

        // 1. Verify channel ownership
        const channel = await prisma.whatsappChannel.findFirst({
            where: { id: channelId, tenantId }
        });

        if (!channel) {
            throw { status: 404, message: 'Canal no encontrado o acceso denegado.' };
        }

        const results = [];
        let sentCount = 0;
        let failedCount = 0;

        const sender = new WhatsAppCloudSender();

        for (const contactId of contactIds) {
            try {
                // 2. Find Contact
                const contact = await prisma.contact.findFirst({
                    where: { id: contactId, tenantId }
                });

                if (!contact) {
                    results.push({ contactId, status: 'FAILED', errorMessage: 'Contacto no encontrado' });
                    failedCount++;
                    continue;
                }

                // 3. Normalize Phone
                const normalizedPhone = WhatsAppUtils.normalizeToE164Digits(contact.phone);

                // 4. Check 24h Window
                const isWindowOpen = await WhatsAppWindowService.is24hWindowOpen({
                    tenantId,
                    channelId,
                    contactPhoneNormalized: normalizedPhone
                });

                // Enforcement of 24h window rules
                if (!isWindowOpen) {
                    if (text && !template) {
                        results.push({
                            contactId,
                            status: 'FAILED',
                            errorCode: 'WINDOW_CLOSED_TEMPLATE_REQUIRED',
                            errorMessage: 'La ventana de 24h está cerrada. Se requiere una plantilla para iniciar conversación.'
                        });
                        failedCount++;
                        continue;
                    }
                    if (!template) {
                        results.push({
                            contactId,
                            status: 'FAILED',
                            errorCode: 'TEMPLATE_REQUIRED',
                            errorMessage: 'Se requiere texto o plantilla para enviar.'
                        });
                        failedCount++;
                        continue;
                    }
                }

                // 5. Resolve Thread (Ensure same algorithm as Inbox/Webhooks)
                const thread = await WhatsAppSharedService.resolveThread({
                    tenantId,
                    channelId,
                    contactPhone: normalizedPhone,
                    contactName: contact.name || undefined,
                    isInbound: false
                });

                // 6. Persist SENDING message
                const newMessage = await prisma.whatsappMessage.create({
                    data: {
                        tenantId,
                        channelId,
                        threadId: thread.id,
                        direction: 'OUTBOUND',
                        fromPhone: channel.displayPhone || 'system',
                        toPhone: normalizedPhone,
                        remotePhone: normalizedPhone,
                        type: template ? 'template' : 'text',
                        textBody: text || (template ? `Template: ${template.name}` : null),
                        timestamp: new Date(),
                        status: 'SENDING',
                    }
                });

                // 7. Call Meta API
                try {
                    let sendResult;
                    if (template) {
                        sendResult = await sender.sendTemplate({
                            channel,
                            to: normalizedPhone,
                            template,
                            tenantId,
                            threadId: thread.id
                        });
                    } else {
                        sendResult = await sender.sendText({
                            channel,
                            to: normalizedPhone,
                            text: text!,
                            tenantId,
                            threadId: thread.id
                        });
                    }

                    // 8. Update to SENT
                    await prisma.whatsappMessage.update({
                        where: { id: newMessage.id },
                        data: {
                            status: 'SENT',
                            waMessageId: sendResult.externalId,
                            rawPayload: sendResult.raw as any
                        }
                    });

                    results.push({
                        contactId,
                        status: 'SENT',
                        waMessageId: sendResult.externalId
                    });
                    sentCount++;

                } catch (sendError: any) {
                    // Update to FAILED with Meta error details
                    await prisma.whatsappMessage.update({
                        where: { id: newMessage.id },
                        data: {
                            status: 'FAILED',
                            errorCode: String(sendError.code || 'meta_error'),
                            errorMessage: sendError.message || 'Error al enviar a Meta'
                        }
                    });
                    results.push({
                        contactId,
                        status: 'FAILED',
                        errorCode: sendError.code || 'meta_error',
                        errorMessage: sendError.message
                    });
                    failedCount++;
                }

            } catch (err: any) {
                console.error(`Error sending to contact ${contactId}:`, err);
                results.push({
                    contactId,
                    status: 'FAILED',
                    errorMessage: err.message || 'Error interno procesando el contacto'
                });
                failedCount++;
            }
        }

        return {
            sent: sentCount,
            failed: failedCount,
            results
        };
    }
}
