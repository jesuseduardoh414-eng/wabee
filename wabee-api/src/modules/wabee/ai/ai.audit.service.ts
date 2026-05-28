import { prisma } from '@/lib/prisma';

interface CreateAuditLogParams {
    tenantId: string;
    channel: string;
    widgetId?: string;
    threadId?: string;
    effectivePrompt: string;
    model: string;
    responseText?: string;
    confidenceScore?: number;
    action: 'RESPONDED' | 'ESCALATED' | 'BLOCKED' | 'FALLBACK';
    errorMessage?: string;
    kbFileIds?: string[];
    kbChunkIds?: string[];
}

export class AiAuditService {

    /**
     * Create audit log entry for AI interaction
     */
    async createLog(params: CreateAuditLogParams): Promise<void> {
        try {
            await prisma.aiAuditLog.create({
                data: {
                    tenantId: params.tenantId,
                    channel: params.channel,
                    widgetId: params.widgetId,
                    threadId: params.threadId,
                    effectivePrompt: params.effectivePrompt,
                    provider: 'GEMINI',
                    model: params.model,
                    responseText: params.responseText,
                    confidenceScore: params.confidenceScore,
                    action: params.action,
                    errorMessage: params.errorMessage,
                    kbFileIds: params.kbFileIds || [],
                    kbChunkIds: params.kbChunkIds || [],
                },
            });
        } catch (error) {
            console.error('Failed to create AI audit log:', error);
            // Don't throw - audit logging should not break the main flow
        }
    }

    /**
     * Query audit logs with pagination
     */
    async queryLogs(params: {
        tenantId: string;
        widgetId?: string;
        threadId?: string;
        page: number;
        limit: number;
    }) {
        const { tenantId, widgetId, threadId, page, limit } = params;
        const skip = (page - 1) * limit;

        const where = {
            tenantId,
            ...(widgetId && { widgetId }),
            ...(threadId && { threadId }),
        };

        const [logs, total] = await Promise.all([
            prisma.aiAuditLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
                select: {
                    id: true,
                    channel: true,
                    widgetId: true,
                    threadId: true,
                    model: true,
                    confidenceScore: true,
                    action: true,
                    createdAt: true,
                },
            }),
            prisma.aiAuditLog.count({ where }),
        ]);

        return {
            logs,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }
}

export const aiAuditService = new AiAuditService();
