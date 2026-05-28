import { prisma } from '@/lib/prisma';
import { InboxService } from '../services/inbox.service';
import { InboxContext } from '../types/inbox-role.types';

export interface AddInternalNoteInput {
    threadId: string;
    body: string;
}

/**
 * Caso de uso: Agregar una nota interna a un thread
 *
 * - Agent: puede agregar notas solo en threads asignados a él
 * - Supervisor / Admin: pueden agregar notas en cualquier thread del tenant
 *
 * Reutiliza el modelo WhatsappThreadNote ya existente en el schema Prisma.
 * El modelo tiene: id, tenantId, threadId, body, isPinned, createdById, createdAt, updatedAt
 *
 * NOTA TÉCNICA: El schema tiene dos modelos relacionados con notas de thread:
 *   - ThreadNote (en r4d_app_v1.thread_notes) — sin relación directa visible en el schema
 *   - WhatsappThreadNote (en r4d_app_v1.whatsapp_thread_notes) — usado por el inbox actual
 * Se reutiliza WhatsappThreadNote ya que es el que está integrado con el inbox existente.
 */
export async function addInternalNote(ctx: InboxContext, input: AddInternalNoteInput) {
    const { threadId, body } = input;
    const { tenantId, userId } = ctx;

    if (!body?.trim()) {
        throw { status: 400, code: 'INVALID_INPUT', message: 'El cuerpo de la nota no puede estar vacío.' };
    }

    // 1. Validar acceso (Agent: solo si asignado, Supervisor: libre)
    await InboxService.validateThreadAccess(ctx, threadId);

    // 2. Crear la nota interna (reutilizando WhatsappThreadNote del inbox actual)
    const note = await prisma.whatsappThreadNote.create({
        data: {
            tenantId,
            threadId,
            body: body.trim(),
            createdById: userId
        }
    });

    return note;
}
