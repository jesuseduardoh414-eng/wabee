import { prisma } from '@/lib/prisma';
import { ContactsService } from '@/modules/wabee/contacts/contacts.service';

export class WhatsAppSharedService {
    /**
     * Resolves a WhatsApp thread by finding it or creating it.
     * This logic is shared between webhooks (inbound) and CRM/Inbox (outbound).
     * 
     * @param params Integration parameters
     * @returns The resolved WhatsappThread
     */
    static async resolveThread(params: {
        tenantId: string;
        channelId: string;
        contactPhone: string;
        contactName?: string;
        lastMessagePreview?: string;
        lastMessageAt?: Date;
        isInbound: boolean;
    }) {
        const {
            tenantId,
            channelId,
            contactPhone,
            contactName,
            lastMessagePreview,
            lastMessageAt,
            isInbound
        } = params;

        // 1. Resolve Contact (Ensures contact exists in CRM)
        const contact = await ContactsService.findOrCreateByPhone(tenantId, contactPhone, {
            name: contactName || contactPhone,
            sourceSystem: 'whatsapp'
        });

        // 2. Resolve Thread (Upsert to ensure atomicity and avoid duplicates)
        const threadIdentifier = {
            tenantId,
            channelId,
            contactPhone
        };

        const timestamp = lastMessageAt || new Date();

        return await prisma.whatsappThread.upsert({
            where: {
                tenantId_channelId_contactPhone: threadIdentifier
            },
            create: {
                ...threadIdentifier,
                contactId: contact.id,
                contactName: contactName || contactPhone,
                status: 'OPEN',
                unreadCount: isInbound ? 1 : 0,
                lastMessageAt: timestamp,
                lastMessagePreview: lastMessagePreview || ''
            },
            update: {
                lastMessageAt: timestamp,
                lastMessagePreview: lastMessagePreview || undefined,
                unreadCount: isInbound ? { increment: 1 } : undefined,
                contactId: contact.id,
                // Update name only if a better context is provided
                contactName: (contactName && contactName !== contactPhone) ? contactName : undefined
            }
        });
    }
}
