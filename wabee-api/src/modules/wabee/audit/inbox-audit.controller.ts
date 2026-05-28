import { Request, Response, NextFunction } from 'express';
import { prisma } from '@/lib/prisma';

const ALLOWED_EVENT_TYPES = [
    'THREAD_TAKEN', 'HUMAN_TAKEOVER', 'HUMAN_MESSAGE_SENT',
    'THREAD_ASSIGNED', 'THREAD_REASSIGNED', 'THREAD_UNASSIGNED',
    'THREAD_CLOSED', 'THREAD_REOPENED', 'INTERNAL_NOTE_ADDED',
    'AI_HANDOFF_TO_HUMAN', 'AI_MESSAGE_SENT', 'THREAD_RESOLVED', 'TEMPLATE_SENT'
];

function buildWhere(tenantId: string, q: any) {
    const where: any = { tenantId };
    if (q.agentId) where.actorUserId = q.agentId;
    if (q.channelId) where.channelId = q.channelId;
    if (q.eventType && ALLOWED_EVENT_TYPES.includes(q.eventType)) where.eventType = q.eventType;
    if (q.from || q.to) {
        where.occurredAt = {};
        if (q.from) where.occurredAt.gte = new Date(q.from);
        if (q.to)   where.occurredAt.lte = new Date(q.to);
    }
    return where;
}

// ─── GET /attention/summary ────────────────────────────────────────────────────
export async function getAttentionSummary(req: any, res: Response, next: NextFunction) {
    try {
        const tenantId = req.tenantId as string;
        const where = buildWhere(tenantId, req.query);

        const logs = await (prisma as any).inboxAuditLog.findMany({
            where,
            select: { threadId: true, actorUserId: true, eventType: true, occurredAt: true }
        });

        const threadSet = new Set<string>();
        let messagesSent = 0, chatsTaken = 0;
        let chatsClosed = 0, chatsReassigned = 0, chatsReleased = 0;

        for (const l of logs) {
            threadSet.add(l.threadId);
            switch (l.eventType) {
                case 'THREAD_TAKEN':         chatsTaken++;      break;
                case 'HUMAN_MESSAGE_SENT':   messagesSent++;    break;
                case 'THREAD_CLOSED':        chatsClosed++;     break;
                case 'THREAD_REASSIGNED':    chatsReassigned++; break;
                case 'THREAD_UNASSIGNED':    chatsReleased++;   break;
            }
        }

        // Calcular tiempos promedio
        // avgFirstResponseMs = avg(HUMAN_MESSAGE_SENT.occurredAt - THREAD_TAKEN.occurredAt)
        // agrupados por threadId
        const byThread: Record<string, { taken?: Date, firstMsg?: Date, closed?: Date, handoff?: Date }> = {};
        for (const l of logs) {
            if (!byThread[l.threadId]) byThread[l.threadId] = {};
            const t = byThread[l.threadId];
            if (l.eventType === 'THREAD_TAKEN' && !t.taken) t.taken = l.occurredAt;
            if (l.eventType === 'HUMAN_MESSAGE_SENT' && !t.firstMsg) t.firstMsg = l.occurredAt;
            if (l.eventType === 'THREAD_CLOSED' && !t.closed) t.closed = l.occurredAt;
            if (l.eventType === 'AI_HANDOFF_TO_HUMAN' && !t.handoff) t.handoff = l.occurredAt;
        }

        let frtSum = 0, frtCount = 0;
        let resSum = 0, resCount = 0;
        let qrtSum = 0, qrtCount = 0;

        for (const t of Object.values(byThread)) {
            if (t.taken && t.firstMsg) {
                const diff = new Date(t.firstMsg).getTime() - new Date(t.taken).getTime();
                if (diff > 0) { frtSum += diff; frtCount++; }
            }
            if (t.taken && t.closed) {
                const diff = new Date(t.closed).getTime() - new Date(t.taken).getTime();
                if (diff > 0) { resSum += diff; resCount++; }
            }
            if (t.handoff && t.taken) {
                const diff = new Date(t.taken).getTime() - new Date(t.handoff).getTime();
                if (diff > 0) { qrtSum += diff; qrtCount++; }
            }
        }

        res.json({
            uniqueChats:              threadSet.size,
            messagesSent,
            chatsTaken,
            chatsClosed,
            chatsReassigned,
            chatsReleased,
            avgFirstResponseMs:       frtCount > 0 ? Math.round(frtSum / frtCount) : null,
            avgResolutionMs:          resCount > 0 ? Math.round(resSum / resCount) : null,
            avgHumanQueueResponseMs:  qrtCount > 0 ? Math.round(qrtSum / qrtCount) : null,
        });

    } catch (err) { next(err); }
}

// ─── GET /attention/details ────────────────────────────────────────────────────
export async function getAttentionDetails(req: any, res: Response, next: NextFunction) {
    try {
        const tenantId = req.tenantId as string;
        const limit  = Math.min(Number(req.query.limit) || 50, 200);
        const offset = Number(req.query.offset) || 0;
        const where  = buildWhere(tenantId, req.query);

        const logs = await (prisma as any).inboxAuditLog.findMany({
            where,
            orderBy: { occurredAt: 'asc' },
            select: {
                threadId: true, eventType: true, occurredAt: true,
                actorUserId: true, actorDisplayName: true,
                contactDisplayName: true, channelName: true, channelId: true,
            }
        });

        // Agrupar por threadId
        const map: Record<string, any> = {};
        for (const l of logs) {
            if (!map[l.threadId]) {
                map[l.threadId] = {
                    threadId: l.threadId,
                    contactName: l.contactDisplayName,
                    channel: l.channelName,
                    channelId: l.channelId,
                    openedAt: null,
                    firstHumanAt: null,
                    lastHumanAt: null,
                    finalStatus: null,
                    messagesSentByAgent: 0,
                    hadAiHandoff: false,
                    finalAssigneeUserId: null,
                    finalAssigneeName: null,
                    conversationType: 'human_only',
                    actions: [] as string[],
                };
            }

            const t = map[l.threadId];
            if (!t.actions.includes(l.eventType)) t.actions.push(l.eventType);

            if (!t.firstHumanAt && ['THREAD_TAKEN', 'HUMAN_TAKEOVER'].includes(l.eventType))
                t.firstHumanAt = l.occurredAt;

            if (['THREAD_TAKEN', 'HUMAN_MESSAGE_SENT', 'HUMAN_TAKEOVER',
                 'THREAD_ASSIGNED', 'THREAD_CLOSED', 'THREAD_REOPENED',
                 'THREAD_UNASSIGNED', 'THREAD_REASSIGNED', 'INTERNAL_NOTE_ADDED'].includes(l.eventType))
                t.lastHumanAt = l.occurredAt;

            if (l.eventType === 'HUMAN_MESSAGE_SENT') t.messagesSentByAgent++;
            if (l.eventType === 'AI_HANDOFF_TO_HUMAN') t.hadAiHandoff = true;
            if (l.eventType === 'THREAD_CLOSED') t.finalStatus = 'CLOSED';
            if (l.eventType === 'THREAD_REOPENED') t.finalStatus = 'OPEN';
            if (['THREAD_ASSIGNED', 'THREAD_REASSIGNED', 'THREAD_TAKEN'].includes(l.eventType)) {
                t.finalAssigneeUserId = l.actorUserId;
                t.finalAssigneeName   = l.actorDisplayName;
            }

            // Determinar tipo de conversación
            if (l.eventType === 'AI_MESSAGE_SENT' && t.conversationType === 'human_only')
                t.conversationType = 'hybrid';
            if (l.eventType === 'AI_MESSAGE_SENT' && !t.hadAiHandoff)
                t.conversationType = 'ai_only';
        }

        // Enriquecer con estado real del thread
        const threadIds = Object.keys(map).slice(offset, offset + limit);
        const threads = await prisma.whatsappThread.findMany({
            where: { id: { in: threadIds }, tenantId },
            select: { id: true, status: true, contactName: true, createdAt: true }
        });
        for (const th of threads) {
            if (map[th.id]) {
                if (!map[th.id].finalStatus) map[th.id].finalStatus = th.status;
                if (!map[th.id].contactName)  map[th.id].contactName  = th.contactName;
                map[th.id].openedAt = th.createdAt;
            }
        }

        const items = threadIds.map(id => map[id]).filter(Boolean);
        res.json({ items, total: Object.keys(map).length, limit, offset });

    } catch (err) { next(err); }
}

// ─── GET /attention/threads/:threadId ─────────────────────────────────────────
export async function getAttentionThreadTimeline(req: any, res: Response, next: NextFunction) {
    try {
        const tenantId = req.tenantId as string;
        const { threadId } = req.params;

        const logs = await (prisma as any).inboxAuditLog.findMany({
            where: { tenantId, threadId },
            orderBy: { occurredAt: 'asc' },
        });

        res.json(logs);
    } catch (err) { next(err); }
}

// ─── GET /attention/export ─────────────────────────────────────────────────────
export async function exportAttentionCsv(req: any, res: Response, next: NextFunction) {
    try {
        const tenantId = req.tenantId as string;
        const where    = buildWhere(tenantId, req.query);

        const logs = await (prisma as any).inboxAuditLog.findMany({
            where,
            orderBy: { occurredAt: 'asc' },
            select: {
                threadId: true, eventType: true, occurredAt: true,
                actorDisplayName: true, actorRole: true,
                contactDisplayName: true, channelName: true, description: true,
            }
        });

        const rows = logs.map((l: any) => [
            l.threadId, l.eventType,
            new Date(l.occurredAt).toISOString(),
            l.actorDisplayName ?? '', l.actorRole ?? '',
            l.contactDisplayName ?? '', l.channelName ?? '',
            (l.description ?? '').replace(/"/g, '""'),
        ].map((v: any) => `"${v}"`).join(','));

        const header = '"threadId","eventType","occurredAt","actorName","actorRole","contactName","channel","description"';

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="audit_attention.csv"');
        res.send([header, ...rows].join('\n'));

    } catch (err) { next(err); }
}
