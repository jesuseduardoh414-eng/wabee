import { prisma } from '@/lib/prisma';
import { coreAdapter } from '@/modules/core/core.adapter';

import { Request, Response, NextFunction } from 'express';
import * as inboxService from './whatsapp.inbox.service';
import { WhatsAppSharedService } from './whatsapp.shared.service';
import { WhatsAppUtils } from './whatsapp.utils';
import { ResolveThreadSchema } from './whatsapp.inbox.schemas';
import { AnalyticsService } from '../../analytics/analytics.service';
import { ThreadStateOrchestrator } from '../services/thread.state.orchestrator';

export async function getChannelMessages(req: any, res: Response, next: NextFunction) {
    try {
        const { channelId } = req.params;
        const tenantId = req.tenantId;
        const limit = Number(req.query.limit) || 20;
        const cursor = req.query.cursor as string | undefined;
        const remotePhone = req.query.remotePhone as string | undefined;
        const threadId = req.query.threadId as string | undefined;

        if (threadId || remotePhone) {
            const result = await inboxService.getMessagesByThread(
                tenantId,
                channelId,
                (threadId || remotePhone)!,
                limit > 20 ? limit : 50, // Higher default limit for chat history
                cursor
            );
            return res.json(result);
        }

        const result = await inboxService.getMessagesByChannel(
            tenantId,
            channelId,
            limit,
            cursor ? cursor : undefined
        );

        res.json(result);
    } catch (error) {
        next(error);
    }
}

export async function getChannelThreads(req: any, res: Response, next: NextFunction) {
    try {
        const { channelId } = req.params;
        const tenantId = req.tenantId;
        const result = await inboxService.getInboxThreads(
            tenantId,
            channelId,
            20 // Fixed limit for MVP
        );

        res.json(result);
    } catch (error) {
        next(error);
    }
}

export async function sendMessage(req: any, res: Response, next: NextFunction) {
    try {
        const { threadId } = req.params;
        const tenantId = req.tenantId;
        const { text } = req.body;

        if (!text) {
            return res.status(400).json({ message: 'El campo "text" es requerido.' });
        }

        const message = await inboxService.sendMessage(tenantId, threadId, text);
        
        // [AUTO-TAKEOVER] Si un humano envía un mensaje manual, la IA debe pausarse para este thread.
        try {
            await ThreadStateOrchestrator.humanTakeover(threadId, tenantId, req.userId || 'system_fallback', 'manual_outbound_message');
        } catch (takeoverErr) {
            console.error(`[CONTROLLER] Non-critical error during auto-takeover for thread ${threadId}:`, takeoverErr);
        }

        res.json(message);
    } catch (error: any) {
        const statusCode = error.status || 500;

        console.error(`❌ [CONTROLLER] Error sending message:`, error);

        res.status(statusCode).json({
            provider: error.provider || 'wabee',
            message: error.message || 'Error interno del servidor',
            code: error.code,
            subcode: error.subcode,
            traceId: error.traceId,
            detail: error.detail,
            prismaCode: error.prismaCode
        });
    }
}

export async function markThreadRead(req: any, res: Response, next: NextFunction) {
    try {
        const { threadId } = req.params;
        const tenantId = req.tenantId;

        await inboxService.markThreadAsRead(tenantId, threadId);

        res.json({ success: true, message: 'Hilo marcado como leído' });
    } catch (error) {
        next(error);
    }
}

export async function getThreadById(req: any, res: Response, next: NextFunction) {
    try {
        const { threadId } = req.params;
        const tenantId = req.tenantId;

        const thread = await prisma.whatsappThread.findFirst({
            where: { id: threadId, tenantId },
            include: {
                contact: true
            }
        });

        if (!thread) {
            return res.status(404).json({ message: 'Hilo no encontrado' });
        }

        res.json(thread);
    } catch (error) {
        next(error);
    }
}

export async function resolveThreadFromContact(req: any, res: Response, next: NextFunction) {
    try {
        const tenantId = req.tenantId;
        const { contactId, channelId: providedChannelId } = ResolveThreadSchema.parse(req.body);

        // 1. Load Contact
        const contact = await prisma.contact.findFirst({
            where: { id: contactId, tenantId }
        });

        if (!contact) {
            return res.status(404).json({ message: 'Contacto no encontrado' });
        }

        // 2. Resolve Channel
        let channelId = providedChannelId;
        if (channelId) {
            const channel = await prisma.whatsappChannel.findFirst({
                where: { id: channelId, tenantId, status: 'CONNECTED' }
            });
            if (!channel) {
                return res.status(400).json({
                    message: 'Canal no encontrado, no pertenece al tenant o no está conectado.',
                    code: 'INVALID_CHANNEL'
                });
            }
        } else {
            const connectedChannels = await prisma.whatsappChannel.findMany({
                where: { tenantId, status: 'CONNECTED' },
                orderBy: { createdAt: 'asc' }
            });

            if (connectedChannels.length === 0) {
                return res.status(400).json({
                    message: 'No hay canales de WhatsApp conectados.',
                    code: 'NO_CONNECTED_CHANNEL'
                });
            }

            if (connectedChannels.length > 1) {
                return res.status(400).json({
                    message: 'Se requiere seleccionar un canal específico.',
                    code: 'CHANNEL_REQUIRED',
                    channels: connectedChannels.map(c => ({
                        id: c.id,
                        name: c.name,
                        displayPhone: c.displayPhone
                    }))
                });
            }

            channelId = connectedChannels[0].id;
        }

        // 3. Normalize Phone
        let phoneNormalized: string;
        try {
            phoneNormalized = WhatsAppUtils.normalizeToE164Digits(contact.phone);
        } catch (error: any) {
            return res.status(400).json({
                message: `Número de teléfono inválido: ${contact.phone}`,
                code: 'INVALID_PHONE'
            });
        }

        // 4. Resolve Thread (Idempotent)
        const thread = await WhatsAppSharedService.resolveThread({
            tenantId,
            channelId,
            contactPhone: phoneNormalized,
            contactName: contact.name ?? undefined,
            isInbound: false
        });

        res.json({
            threadId: thread.id,
            channelId: channelId
        });

    } catch (error) {
        next(error);
    }
}

export async function getThreadNotes(req: any, res: Response, next: NextFunction) {
    try {
        const { threadId } = req.params;
        const tenantId = req.tenantId;

        const notes = await prisma.whatsappThreadNote.findMany({
            where: { threadId, tenantId },
            orderBy: [
                { isPinned: 'desc' },
                { createdAt: 'desc' }
            ],
            take: 50
        });

        // Inyectar datos del autor (Nombre y Rol) para cada nota
        const userIds = notes.map(n => n.createdById).filter(Boolean) as string[];
        const uniqueUserIds = [...new Set(userIds)];

        const profiles = await coreAdapter.profiles.listAuthorsInfo(uniqueUserIds, tenantId);

        const profileMap = new Map(profiles.map((p: any) => [p.id, p]));

        const notesWithAuthors = notes.map(note => {
            const profile: any = note.createdById ? profileMap.get(note.createdById) : null;
            return {
                ...note,
                authorName: profile?.name || (note.createdById ? 'Usuario' : 'Sistema'),
                authorRole: profile?.role || (note.createdById ? 'Staff' : 'Sistema')
            };
        });

        res.json(notesWithAuthors);
    } catch (error) {
        next(error);
    }
}

export async function createThreadNote(req: any, res: Response, next: NextFunction) {
    try {
        const { threadId } = req.params;
        const tenantId = req.tenantId;
        const { body } = req.body;

        if (!body) {
            return res.status(400).json({ message: 'El cuerpo de la nota es requerido.' });
        }

        // Validate thread ownership
        const thread = await prisma.whatsappThread.findFirst({
            where: { id: threadId, tenantId }
        });

        if (!thread) {
            return res.status(404).json({ message: 'Hilo no encontrado' });
        }

        const userId = req.user?.id || req.user?.sub || req.inboxContext?.userId;

        const note = await prisma.whatsappThreadNote.create({
            data: {
                tenantId,
                threadId,
                body,
                createdById: userId || null
            }
        });

        // Inyectar autor para la respuesta inmediata
        let authorName = 'Sistema';
        let authorRole = 'Sistema';

        if (userId) {
            const profile = await coreAdapter.profiles.getAuthorInfo(userId, tenantId);
            authorName = profile?.name || 'Usuario';
            authorRole = profile?.role || 'Staff';
        }

        res.json({
            ...note,
            authorName,
            authorRole
        });
    } catch (error) {
        next(error);
    }
}

export async function updateThreadNote(req: any, res: Response, next: NextFunction) {
    try {
        const { threadId, noteId } = req.params;
        const tenantId = req.tenantId;
        const { body, isPinned } = req.body;

        const existingNote = await prisma.whatsappThreadNote.findFirst({
            where: { id: noteId, threadId, tenantId }
        });

        if (!existingNote) {
            return res.status(404).json({ message: 'Nota no encontrada' });
        }

        const updatedNote = await prisma.whatsappThreadNote.update({
            where: { id: noteId },
            data: {
                ...(body !== undefined && { body }),
                ...(isPinned !== undefined && { isPinned }),
            }
        });

        res.json(updatedNote);
    } catch (error) {
        next(error);
    }
}

export async function deleteThreadNote(req: any, res: Response, next: NextFunction) {
    try {
        const { threadId, noteId } = req.params;
        const tenantId = req.tenantId;

        const existingNote = await prisma.whatsappThreadNote.findFirst({
            where: { id: noteId, threadId, tenantId }
        });

        if (!existingNote) {
            return res.status(404).json({ message: 'Nota no encontrada' });
        }

        await prisma.whatsappThreadNote.delete({
            where: { id: noteId }
        });

        res.json({ success: true, message: 'Nota eliminada' });
    } catch (error) {
        next(error);
    }
}

export async function assignThread(req: any, res: Response, next: NextFunction) {
    try {
        const { threadId } = req.params;
        const tenantId = req.tenantId;
        const { assignedUserId } = req.body;

        const thread = await prisma.whatsappThread.findFirst({
            where: { id: threadId, tenantId }
        });

        if (!thread) {
            return res.status(404).json({ message: 'Hilo no encontrado' });
        }

        const updated = await prisma.whatsappThread.update({
            where: { id: threadId },
            data: { assignedUserId: (assignedUserId as string) || null }
        });

        // Analytics Hook
        AnalyticsService.emitEvent({
            tenantId,
            eventType: 'THREAD_ASSIGNED_TO_HUMAN',
            channel: 'whatsapp',
            threadId,
            actorType: 'SYSTEM',
            actorUserId: assignedUserId || undefined,
            meta: { assignedUserId }
        });

        res.json(updated);
    } catch (error) {
        next(error);
    }
}

export async function updateThreadStatus(req: any, res: Response, next: NextFunction) {
    try {
        const { threadId } = req.params;
        const tenantId = req.tenantId;
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({ message: 'El estado es requerido.' });
        }

        const thread = await prisma.whatsappThread.findFirst({
            where: { id: threadId, tenantId }
        });

        if (!thread) {
            return res.status(404).json({ message: 'Hilo no encontrado' });
        }

        // Mapping PENDING to SNOOZED if it's the requested behavior
        let finalStatus = status;
        if (status === 'PENDING') {
            // Check if PENDING exists in enum. 
            // Based on previous View, ThreadStatus has OPEN, CLOSED, SNOOZED.
            // We'll use SNOOZED as a proxy for PENDING for now.
            finalStatus = 'SNOOZED';
        }

        const updated = await prisma.whatsappThread.update({
            where: { id: threadId },
            data: { status: finalStatus as any }
        });

        // Analytics Hook
        if (finalStatus === 'CLOSED') {
            const now = new Date();
            const durationSeconds = Math.floor((now.getTime() - thread.createdAt.getTime()) / 1000);

            AnalyticsService.emitEvent({
                tenantId,
                eventType: 'THREAD_STATUS_CHANGED',
                channel: 'whatsapp',
                threadId,
                meta: {
                    fromStatus: thread.status,
                    toStatus: finalStatus,
                    duration_seconds: durationSeconds,
                    was_escalated: !!thread.assignedUserId || thread.status === 'SNOOZED' // Heurística: si estuvo asignado o en espera, fue escalado
                }
            });
        } else {
            AnalyticsService.emitEvent({
                tenantId,
                eventType: 'THREAD_STATUS_CHANGED',
                channel: 'whatsapp',
                threadId,
                meta: { fromStatus: thread.status, toStatus: finalStatus }
            });
        }

        // Especial: Detectar Re-apertura para FCR
        if (thread.status === 'CLOSED' && finalStatus === 'OPEN') {
            AnalyticsService.emitEvent({
                tenantId,
                eventType: 'THREAD_REOPENED',
                channel: 'whatsapp',
                threadId,
                meta: { reopenedAt: new Date() }
            });
        }

        res.json(updated);
    } catch (error) {
        next(error);
    }
}
