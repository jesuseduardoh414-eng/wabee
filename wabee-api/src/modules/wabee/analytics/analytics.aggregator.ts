import { prisma, corePrisma } from '@/config/core/core.prisma';
import { coreAdapter } from '@/modules/core/core.adapter';
import { AnalyticsEventType, AnalyticsActorType } from '@prisma/client';

export class AnalyticsAggregator {
    /**
     * Procesa la agregación incremental para todos los tenants.
     */
    static async aggregateAll() {
        const tenants = await corePrisma.organization.findMany({
            select: { id: true }
        });

        console.log(`[AnalyticsAggregator] Iniciando agregación para ${tenants.length} tenants...`);

        for (const tenant of tenants) {
            await this.aggregateTenant(tenant.id);
        }
    }

    /**
     * Agregación incremental para un tenant específico.
     */
    static async aggregateTenant(tenantId: string) {
        // 1. Obtener cursor
        const cursor = await prisma.analyticsAggregationCursor.upsert({
            where: { tenantId },
            create: { tenantId },
            update: {}
        });

        const lastAggregatedAt = cursor.lastAggregatedAt;
        const now = new Date();

        // 2. Buscar eventos nuevos desde el último cursor
        // Auditoría
        await coreAdapter.system.createAuditLog({
            tenantId,
            userId: 'SYSTEM',
            action: 'ANALYTICS_AGGREGATION',
            modelType: 'Analytics',
            description: `Agregación incremental para tenant ${tenantId}`,
            newValues: { lastAggregatedAt, now } as any
        });

        const events = await prisma.analyticsEvent.findMany({
            where: {
                tenantId,
                occurredAt: { gt: lastAggregatedAt, lte: now }
            },
            orderBy: { occurredAt: 'asc' },
            take: 1000 // Procesamos en lotes de 1000
        });

        if (events.length === 0) return;

        console.log(`[AnalyticsAggregator] Tenant ${tenantId}: Procesando ${events.length} eventos nuevos.`);

        // 3. Agrupar por fecha y canal
        const rollups: Record<string, any> = {};

        for (const event of events) {
            const dateStr = event.occurredAt.toISOString().split('T')[0];
            const channel = event.channel || 'all';
            const key = `${dateStr}_${channel}`;

            if (!rollups[key]) {
                rollups[key] = {
                    date: new Date(dateStr),
                    channel,
                    metrics: {
                        inbound_count: 0,
                        outbound_human_count: 0,
                        outbound_ai_count: 0,
                        outbound_flow_count: 0,
                        threads_created: 0,
                        threads_closed: 0,
                        escalations_count: 0,
                        ai_gating_blocked: 0,
                        ai_fallback_count: 0,
                        total_resolution_seconds: 0,
                        ai_tokens_count: 0, // Nueva métrica
                        ai_requests_count: 0, // Nueva métrica
                        fcr_candidate_count: 0, // Refinado
                        fcr_candidate_ids: []
                    }
                };
            }

            const m = rollups[key].metrics;

            // Lógica de conteos por EventType
            switch (event.eventType) {
                case 'THREAD_CREATED':
                    m.threads_created++;
                    break;
                case 'MESSAGE_INBOUND_USER':
                    m.inbound_count++;
                    break;
                case 'MESSAGE_OUTBOUND_HUMAN':
                    m.outbound_human_count++;
                    break;
                case 'MESSAGE_OUTBOUND_AI':
                    m.outbound_ai_count++;
                    m.ai_requests_count++;
                    const aiMeta = event.meta as any;
                    if (aiMeta?.tokens) {
                        m.ai_tokens_count += aiMeta.tokens;
                    }
                    break;
                case 'MESSAGE_OUTBOUND_FLOW':
                    m.outbound_flow_count++;
                    break;
                case 'HUMAN_TAKEOVER':
                case 'THREAD_ASSIGNED_TO_HUMAN':
                    m.escalations_count++;
                    break;
                case 'AI_GATING_BLOCKED':
                    m.ai_gating_blocked++;
                    m.ai_requests_count++;
                    break;
                case 'AI_FALLBACK_TO_HUMAN':
                    m.ai_fallback_count++;
                    break;
                case 'THREAD_STATUS_CHANGED':
                    const meta = event.meta as any;
                    if (meta?.toStatus === 'CLOSED') {
                        m.threads_closed++;
                        // Calculamos tiempo de resolución
                        if (meta.duration_seconds) {
                            m.total_resolution_seconds += meta.duration_seconds;
                        }
                        // Candidato potencial para FCR si se cerró sin escalación previa (heurística simple)
                        if (!meta.was_escalated) {
                            m.fcr_candidate_count++;
                        }
                    }
                    break;
            }
        }

        // 4. Guardar rollups (Upsert incremental)
        for (const key in rollups) {
            const { date, channel, metrics } = rollups[key];

            const existing = await prisma.analyticsDailyRollup.findUnique({
                where: { tenantId_date_channel: { tenantId, date, channel } }
            });

            if (existing) {
                const updatedMetrics = this.mergeMetrics(existing.metrics as any, metrics);
                await prisma.analyticsDailyRollup.update({
                    where: { id: existing.id },
                    data: { metrics: updatedMetrics }
                });
            } else {
                await prisma.analyticsDailyRollup.create({
                    data: { tenantId, date, channel, metrics }
                });
            }
        }

        // 5. Actualizar cursor
        await prisma.analyticsAggregationCursor.update({
            where: { tenantId },
            data: { lastAggregatedAt: events[events.length - 1].occurredAt }
        });

        // Recursión si hay más eventos (take 1000)
        if (events.length === 1000) {
            await this.aggregateTenant(tenantId);
        }
    }

    private static mergeMetrics(existing: any, news: any): any {
        const result = { ...existing };
        for (const key in news) {
            if (typeof news[key] === 'number') {
                result[key] = (result[key] || 0) + news[key];
            } else if (Array.isArray(news[key])) {
                result[key] = [...(result[key] || []), ...news[key]];
            }
        }
        return result;
    }
}
