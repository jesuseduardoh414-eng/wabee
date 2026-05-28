import { prisma } from '@/lib/prisma';
import { InboxAuditActorType, InboxAuditActorRole, InboxAuditEventType } from '@prisma/client';

export interface InboxAuditInput {
    tenantId: string;
    threadId: string;
    channelId?: string | null;
    contactId?: string | null;

    actorType: InboxAuditActorType;
    actorUserId?: string | null;
    actorRole?: InboxAuditActorRole | null;

    // Snapshots históricos
    actorDisplayName?: string | null;
    contactDisplayName?: string | null;
    channelName?: string | null;

    eventType: InboxAuditEventType;
    messageId?: string | null;
    description?: string | null;
    metadata?: Record<string, any> | null;
}

/**
 * InboxAuditService
 * ─────────────────
 * Único punto de escritura en InboxAuditLog.
 * Complementa el AuditTrail existente con trazabilidad operativa del Inbox.
 * Non-critical: los errores se loguean pero no interrumpen el flujo del caller.
 */
export class InboxAuditService {

    static async log(input: InboxAuditInput): Promise<void> {
        try {
            await (prisma as any).inboxAuditLog.create({
                data: {
                    tenantId: input.tenantId,
                    threadId: input.threadId,
                    channelId: input.channelId ?? null,
                    contactId: input.contactId ?? null,
                    actorType: input.actorType,
                    actorUserId: input.actorUserId ?? null,
                    actorRole: input.actorRole ?? null,
                    actorDisplayName: input.actorDisplayName ?? null,
                    contactDisplayName: input.contactDisplayName ?? null,
                    channelName: input.channelName ?? null,
                    eventType: input.eventType,
                    messageId: input.messageId ?? null,
                    description: input.description ?? null,
                    metadata: input.metadata ?? null,
                }
            });
        } catch (err) {
            console.error('[InboxAuditService] Non-critical error logging event:', err);
        }
    }

    /**
     * Resuelve snapshots automáticamente desde la base de datos.
     * Útil para llamadas donde no se tienen los nombres disponibles.
     */
    static async logWithSnapshots(
        input: Omit<InboxAuditInput, 'actorDisplayName' | 'contactDisplayName' | 'channelName'>
    ): Promise<void> {
        try {
            const [actor, thread, channel] = await Promise.all([
                input.actorUserId
                    ? (prisma as any).profile.findUnique({
                        where: { id: input.actorUserId },
                        select: { name: true, email: true }
                    }).catch(() => null)
                    : null,
                (prisma as any).whatsappThread.findFirst({
                    where: { id: input.threadId },
                    select: { contactName: true, remotePhone: true, channelId: true }
                }).catch(() => null),
                input.channelId
                    ? (prisma as any).whatsappChannel.findUnique({
                        where: { id: input.channelId },
                        select: { name: true }
                    }).catch(() => null)
                    : null,
            ]);

            await InboxAuditService.log({
                ...input,
                actorDisplayName: actor?.name || actor?.email || null,
                contactDisplayName: thread?.contactName || thread?.remotePhone || null,
                channelName: channel?.name || null,
            });
        } catch (err) {
            console.error('[InboxAuditService] Non-critical error in logWithSnapshots:', err);
        }
    }
}
