import { prisma } from '@/lib/prisma';
import { InboxContext, InboxRole } from '../types/inbox-role.types';
import { ThreadHandlingMode } from '@prisma/client';

// ─── Tipos de retorno ─────────────────────────────────────────────────────────

export interface ThreadAccessResult {
    id: string;
    tenantId: string;
    channelId: string;
    contactPhone: string;
    contactName: string | null;
    status: string;
    assignedUserId: string | null;
    contextState: any;
    currentFlowVersionId: string | null;
    lastMessageAt: Date;
    lastMessagePreview: string | null;
    unreadCount: number;
    createdAt: Date;
    updatedAt: Date;
    contactId: string | null;
    handlingMode: ThreadHandlingMode | null;
    aiPaused: boolean;
}

// ─── InboxService ─────────────────────────────────────────────────────────────

/**
 * Servicio principal de acceso y visibilidad de threads en el Inbox.
 *
 * Responsabilidades:
 * 1. getThreadsForUser — filtrado según rol (Agent: solo asignados, Supervisor: global)
 * 2. validateThreadAccess — ownership check + tenant isolation
 *
 * REGLA CRÍTICA: Todas las queries siempre incluyen tenantId para garantizar aislamiento.
 */
export class InboxService {

    /**
     * Devuelve los threads visibles para el usuario según su rol.
     *
     * - Agent:      solo threads donde assignedUserId === ctx.userId (del mismo tenant)
     * - Supervisor: todos los threads del tenant, sin filtro de asignación
     * - Admin:      igual que Supervisor (acceso global dentro del tenant)
     */
    static async getThreadsForUser(
        ctx: InboxContext,
        options: { limit?: number; cursor?: string } = {}
    ): Promise<ThreadAccessResult[]> {
        const { userId, tenantId, role } = ctx;
        const limit = options.limit ?? 30;
        const cursor = options.cursor;

        const whereBase: any = { tenantId };

        // Agent solo ve sus threads asignados o los que están libres (en la cola)
        if (role === InboxRole.Agent) {
            whereBase.OR = [
                { assignedUserId: userId },
                { assignedUserId: null }
            ];
        }
        // Supervisor y Admin ven todos los threads del tenant (no se agrega filtro adicional)

        const threads = await prisma.whatsappThread.findMany({
            where: whereBase,
            orderBy: { lastMessageAt: 'desc' },
            take: limit + 1, // +1 para detectar si hay más páginas
            cursor: cursor ? { id: cursor } : undefined,
            select: {
                id: true,
                tenantId: true,
                channelId: true,
                contactPhone: true,
                contactName: true,
                status: true,
                assignedUserId: true,
                contextState: true,
                currentFlowVersionId: true,
                lastMessageAt: true,
                lastMessagePreview: true,
                unreadCount: true,
                createdAt: true,
                updatedAt: true,
                contactId: true,
                handlingMode: true,
                aiPaused: true,
            }
        });

        return threads as ThreadAccessResult[];
    }

    /**
     * Valida que el usuario tenga acceso a un thread específico.
     * Aplica:
     *   - Tenant isolation (siempre)
     *   - Ownership check (si rol = Agent)
     *
     * @throws 404 si el thread no existe en el tenant
     * @throws 403 si el Agent intenta acceder a un thread no asignado a él
     * @returns El thread validado, listo para usar en casos de uso
     */
    static async validateThreadAccess(
        ctx: InboxContext,
        threadId: string
    ): Promise<ThreadAccessResult> {
        const { userId, tenantId, role } = ctx;

        // Buscar el thread siempre filtrando por tenant
        const thread = await prisma.whatsappThread.findFirst({
            where: { id: threadId, tenantId },
            select: {
                id: true,
                tenantId: true,
                channelId: true,
                contactPhone: true,
                contactName: true,
                status: true,
                assignedUserId: true,
                contextState: true,
                currentFlowVersionId: true,
                lastMessageAt: true,
                lastMessagePreview: true,
                unreadCount: true,
                createdAt: true,
                updatedAt: true,
                contactId: true,
                handlingMode: true,
                aiPaused: true,
            }
        });

        // 404 si no existe o no pertenece al tenant
        if (!thread) {
            throw { status: 404, code: 'THREAD_NOT_FOUND', message: 'Thread no encontrado o acceso denegado.' };
        }

        // Ownership check para Agent: Solo puede ver lo suyo o lo que está libre
        if (role === InboxRole.Agent && thread.assignedUserId !== userId && thread.assignedUserId !== null) {
            throw {
                status: 403,
                code: 'INBOX_PERMISSION_DENIED',
                message: 'El agente no tiene permiso para ver chats asignados a otros.'
            };
        }

        // Supervisor y Admin: acceso garantizado dentro del tenant
        return thread as ThreadAccessResult;
    }
}
