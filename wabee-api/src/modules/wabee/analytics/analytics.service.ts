import { prisma } from '@/config/core/core.prisma';
import { AnalyticsEventType, AnalyticsActorType } from '@prisma/client';

export interface EmitEventInput {
    tenantId: string;
    eventType: AnalyticsEventType;
    channel?: 'whatsapp' | 'web' | 'system';
    threadId?: string;
    conversationId?: string;
    contactId?: string;
    campaignId?: string;
    campaignMessageId?: string;
    variant?: string;
    actorType?: AnalyticsActorType;
    actorUserId?: string;
    meta?: any;
    occurredAt?: Date;
}

export class AnalyticsService {
    /**
     * Emite un evento de analytics de forma asíncrona (fire & forget para no bloquear el hilo de ejecución).
     */
    static async emitEvent(input: EmitEventInput) {
        try {
            // Masking de PII sensible en meta si existe
            if (input.meta) {
                input.meta = this.maskPII(input.meta);
            }

            // Persistencia en DB
            await prisma.analyticsEvent.create({
                data: {
                    tenantId: input.tenantId,
                    eventType: input.eventType,
                    channel: input.channel || 'all',
                    threadId: input.threadId,
                    conversationId: input.conversationId,
                    contactId: input.contactId,
                    campaignId: input.campaignId,
                    campaignMessageId: input.campaignMessageId,
                    variant: input.variant,
                    actorType: input.actorType || 'SYSTEM',
                    actorUserId: input.actorUserId,
                    meta: input.meta || {},
                    occurredAt: input.occurredAt || new Date()
                }
            });
        } catch (error) {
            // No hacemos throw para no romper el flujo principal de la app
            console.error('[AnalyticsService] Error emitEvent:', error);
        }
    }

    /**
     * Procesa eventos en lote (opcional para optimización futura).
     */
    static async emitEvents(inputs: EmitEventInput[]) {
        try {
            await prisma.analyticsEvent.createMany({
                data: inputs.map(input => ({
                    tenantId: input.tenantId,
                    eventType: input.eventType,
                    channel: input.channel || 'all',
                    threadId: input.threadId,
                    conversationId: input.conversationId,
                    contactId: input.contactId,
                    campaignId: input.campaignId,
                    campaignMessageId: input.campaignMessageId,
                    variant: input.variant,
                    actorType: input.actorType || 'SYSTEM',
                    actorUserId: input.actorUserId,
                    meta: this.maskPII(input.meta || {}),
                    occurredAt: input.occurredAt || new Date()
                }))
            });
        } catch (error) {
            console.error('[AnalyticsService] Error emitEvents:', error);
        }
    }

    private static maskPII(data: any): any {
        if (!data) return data;
        const serialized = JSON.stringify(data);

        // Expresiones regulares simples para teléfonos y emails
        const masked = serialized
            .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '***@***.***')
            .replace(/\+?[0-9]{10,15}/g, '**********');

        try {
            return JSON.parse(masked);
        } catch {
            return data;
        }
    }
}
