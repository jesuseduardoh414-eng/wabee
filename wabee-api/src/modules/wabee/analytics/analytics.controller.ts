import { prisma } from '@/config/core/core.prisma';
import { coreAdapter } from '@/modules/core/core.adapter';
import { Response } from 'express';

export async function getOverview(req: any, res: Response) {
    try {
        const { from, to, channel } = req.query;
        const tenantId = req.tenantId;

        if (!from || !to) {
            return res.status(400).json({ message: 'Rango de fechas (from, to) es requerido.' });
        }

        const dateFrom = new Date(from as string);
        const dateTo = new Date(to as string);

        // Consultar rollups en el rango
        const rollups = await prisma.analyticsDailyRollup.findMany({
            where: {
                tenantId,
                date: { gte: dateFrom, lte: dateTo },
                channel: channel !== 'all' ? (channel as string) : undefined
            }
        });

        // Agregación de métricas desde rollups
        const summary = {
            inbound_total: 0,
            outbound_human: 0,
            outbound_ai: 0,
            outbound_flow: 0,
            threads_created: 0,
            threads_closed: 0,
            escalations: 0,
            avg_resolution_time: 0,
            automation_rate: 0,
            fcr_rate: 0,
        };

        let totalResolutionSeconds = 0;

        rollups.forEach(r => {
            const m = r.metrics as any;
            summary.inbound_total += m.inbound_count || 0;
            summary.outbound_human += m.outbound_human_count || 0;
            summary.outbound_ai += m.outbound_ai_count || 0;
            summary.outbound_flow += m.outbound_flow_count || 0;
            summary.threads_created += m.threads_created || 0;
            summary.threads_closed += m.threads_closed || 0;
            summary.escalations += m.escalations_count || 0;
            totalResolutionSeconds += m.total_resolution_seconds || 0;
        });

        // Cálculos derivados
        const totalOutbound = summary.outbound_human + summary.outbound_ai + summary.outbound_flow;
        summary.automation_rate = totalOutbound > 0
            ? ((summary.outbound_ai + summary.outbound_flow) / totalOutbound) * 100
            : 0;

        summary.avg_resolution_time = summary.threads_closed > 0
            ? totalResolutionSeconds / summary.threads_closed
            : 0;

        res.json({
            range: { from, to },
            summary,
            chartData: rollups.map(r => ({
                date: r.date,
                metrics: r.metrics
            }))
        });

    } catch (error) {
        console.error('[AnalyticsController] Error getOverview:', error);
        res.status(500).json({ message: 'Error al obtener reporte de analytics.' });
    }
}

export async function getCampaignAnalytics(req: any, res: Response) {
    try {
        const tenantId = req.tenantId;
        const { from, to } = req.query;

        // Si hay una campaña específica, podríamos filtrar por ella.
        // Por ahora devolvemos el resumen de todas las campañas en el rango.
        const campaigns = await prisma.whatsappCampaign.findMany({
            where: {
                tenantId,
                startedAt: { gte: from ? new Date(from as string) : undefined, lte: to ? new Date(to as string) : undefined }
            }
        });

        res.json(campaigns);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener analytics de campañas.' });
    }
}

export async function exportData(req: any, res: Response) {
    try {
        const tenantId = req.tenantId;
        const { type, from, to } = req.body;

        // Auditoría
        await coreAdapter.system.createAuditLog({
            tenantId,
            userId: req.user?.id,
            action: 'ANALYTICS_EXPORT',
            modelType: 'Analytics',
            description: `Exportación de ${type} desde ${from} hasta ${to}`,
            newValues: { type, from, to } as any
        });

        // En un MVP devolvemos JSON rico, en producción generaría un CSV/Excel.
        res.json({ message: 'Exportación preparada exitosamente.', downloadUrl: null });
    } catch (error) {
        res.status(500).json({ message: 'Error en la exportación.' });
    }
}

export async function getTimeSeries(req: any, res: Response) {
    try {
        const tenantId = req.tenantId;
        const { metric, from, to, channel } = req.query;

        if (!from || !to) {
            return res.status(400).json({ message: 'Rango de fechas es requerido.' });
        }

        const dateFrom = new Date(from as string);
        const dateTo = new Date(to as string);

        const rollups = await prisma.analyticsDailyRollup.findMany({
            where: {
                tenantId,
                date: { gte: dateFrom, lte: dateTo },
                channel: channel !== 'all' ? (channel as string) : undefined
            },
            orderBy: { date: 'asc' }
        });

        const series = rollups.map(r => {
            const m = r.metrics as any;
            let value = 0;

            switch (metric) {
                case 'inbound': value = m.inbound_count || 0; break;
                case 'outbound': value = (m.outbound_human_count || 0) + (m.outbound_ai_count || 0) + (m.outbound_flow_count || 0); break;
                case 'fcr':
                    value = (m.threads_closed > 0) ? (m.fcr_candidate_count / m.threads_closed) * 100 : 0;
                    break;
                case 'mttr':
                    value = (m.threads_closed > 0) ? (m.total_resolution_seconds / m.threads_closed) / 60 : 0; // en minutos
                    break;
                case 'automation':
                    const totalOut = (m.outbound_human_count || 0) + (m.outbound_ai_count || 0) + (m.outbound_flow_count || 0);
                    value = totalOut > 0 ? ((m.outbound_ai_count + m.outbound_flow_count) / totalOut) * 100 : 0;
                    break;
                case 'escalations': value = m.escalations_count || 0; break;
                case 'ai_tokens': value = m.ai_tokens_count || 0; break;
                case 'ai_requests': value = m.ai_requests_count || 0; break;
                default: value = 0;
            }

            return {
                date: r.date.toISOString().split('T')[0],
                value: parseFloat(value.toFixed(2))
            };
        });

        res.json({
            tenantId,
            metric,
            from,
            to,
            series
        });

    } catch (error) {
        console.error('[AnalyticsController] Error getTimeSeries:', error);
        res.status(500).json({ message: 'Error al obtener series temporales.' });
    }
}

export async function getCampaignTimeSeries(req: any, res: Response) {
    try {
        const tenantId = req.tenantId;
        const { from, to, channelId, campaignId } = req.query;

        if (!from || !to) {
            return res.status(400).json({ message: 'Rango de fechas es requerido.' });
        }

        const dateFrom = new Date(from as string);
        const dateTo = new Date(to as string);

        // Consultamos los mensajes de campaña en el rango para agrupar por día
        // Nota: En un sistema de alto volumen, esto vendría de un Rollup específico de campañas.
        // Para v2.1 usamos una agregación directa con prisma ya que los campaign_messages están indexados.
        const messages = await prisma.whatsappCampaignMessage.findMany({
            where: {
                campaign: {
                    tenantId,
                    id: campaignId ? (campaignId as string) : undefined,
                    channelId: channelId ? (channelId as string) : undefined,
                },
                createdAt: { gte: dateFrom, lte: dateTo }
            },
            select: {
                createdAt: true,
                status: true,
                variant: true
            }
        });

        // Agrupar por día
        const dailyGroups: Record<string, any> = {};

        messages.forEach(msg => {
            const dateStr = msg.createdAt.toISOString().split('T')[0];
            if (!dailyGroups[dateStr]) {
                dailyGroups[dateStr] = { date: dateStr, sent: 0, delivered: 0, read: 0, failed: 0, sentA: 0, sentB: 0, readA: 0, readB: 0 };
            }

            const day = dailyGroups[dateStr];
            if (msg.status === 'SENT' || msg.status === 'DELIVERED' || msg.status === 'READ') day.sent++;
            if (msg.status === 'DELIVERED' || msg.status === 'READ') day.delivered++;
            if (msg.status === 'READ') day.read++;
            if (msg.status === 'FAILED') day.failed++;

            // A/B Testing metrics
            if (msg.variant === 'A') {
                if (msg.status !== 'FAILED') day.sentA++;
                if (msg.status === 'READ') day.readA++;
            } else if (msg.variant === 'B') {
                if (msg.status !== 'FAILED') day.sentB++;
                if (msg.status === 'READ') day.readB++;
            }
        });

        const series = Object.values(dailyGroups).sort((a: any, b: any) => a.date.localeCompare(b.date));

        res.json({
            tenantId,
            from,
            to,
            series
        });

    } catch (error) {
        console.error('[AnalyticsController] Error getCampaignTimeSeries:', error);
        res.status(500).json({ message: 'Error al obtener series temporales de campañas.' });
    }
}

export async function getRecentActivity(req: any, res: Response) {
    try {
        const tenantId = req.tenantId;
        const limit = parseInt(req.query.limit as string) || 10;

        const events = await prisma.analyticsEvent.findMany({
            where: { tenantId },
            orderBy: { occurredAt: 'desc' },
            take: limit,
            select: {
                occurredAt: true,
                eventType: true,
                threadId: true,
                actorType: true,
                meta: true
            }
        });

        const formatted = events.map(e => {
            const meta = e.meta as any;
            return {
                type: e.eventType,
                time: e.occurredAt,
                threadId: e.threadId,
                name: meta?.contactName || 'Sistema',
                message: meta?.text || meta?.action || e.eventType,
                actor: e.actorType,
                tags: e.eventType.includes('INBOUND') ? ['INBOUND'] :
                    e.eventType.includes('OUTBOUND') ? ['OUTBOUND'] :
                        e.eventType.includes('AI') ? ['AI'] : ['SYSTEM']
            };
        });

        res.json(formatted);
    } catch (error) {
        console.error('[AnalyticsController] Error getRecentActivity:', error);
        res.status(500).json({ message: 'Error al obtener actividad reciente.' });
    }
}
