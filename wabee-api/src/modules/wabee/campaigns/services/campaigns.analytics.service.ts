import { prisma } from '@/config/core/core.prisma';

export class CampaignsAnalyticsService {
    /**
     * Obtiene un resumen consolidado de KPIs de la campaña.
     */
    static async getSummary(tenantId: string, campaignId: string) {
        const campaign = await prisma.whatsappCampaign.findFirst({
            where: { id: campaignId, tenantId },
            include: {
                channel: { select: { name: true, displayPhone: true } },
                template: { select: { name: true } }
            }
        });

        if (!campaign) throw { status: 404, message: 'Campaña no encontrada' };

        // 1. Métricas de Envío (desde el modelo Campaign)
        const coreMetrics = {
            sent: campaign.sentCount,
            delivered: campaign.deliveredCount,
            read: campaign.readCount,
            failed: campaign.failedCount,
            deliveryRate: campaign.sentCount > 0 ? campaign.deliveredCount / campaign.sentCount : 0,
            readRate: campaign.deliveredCount > 0 ? campaign.readCount / campaign.deliveredCount : 0
        };

        // 2. Impacto Conversacional
        // Hilos vinculados a esta campaña (a través de mensajes)
        const threads = await prisma.whatsappThread.findMany({
            where: {
                tenantId,
                messages: {
                    some: {
                        campaignMessages: {
                            some: { campaignId }
                        }
                    }
                }
            },
            select: { id: true, handlingMode: true }
        });

        const threadIds = threads.map(t => t.id);
        const threadsGenerated = threads.length;

        // Responded: Usuarios que enviaron un mensaje inbound después del inicio de la campaña
        // Buscamos eventos de MESSAGE_INBOUND_USER en los hilos de la campaña
        const responsesCount = await prisma.analyticsEvent.count({
            where: {
                tenantId,
                threadId: { in: threadIds },
                eventType: 'MESSAGE_INBOUND_USER'
            }
        });

        const aiHandled = threads.filter(t => t.handlingMode === 'ai').length;
        const humanHandled = threads.filter(t => t.handlingMode === 'human' || t.handlingMode === 'human_queue').length;
        
        // Takeovers: Eventos de escalación de IA a Humano detectados en el hilo
        const takeovers = await prisma.analyticsEvent.count({
            where: {
                tenantId,
                threadId: { in: threadIds },
                eventType: 'THREAD_ASSIGNED_TO_HUMAN' // Simplificamos: asignación manual tras campaña = takeover
            }
        });

        const conversationalImpact = {
            threadsGenerated,
            responded: responsesCount,
            responseRate: coreMetrics.delivered > 0 ? responsesCount / coreMetrics.delivered : 0,
            conversationRate: coreMetrics.delivered > 0 ? threadsGenerated / coreMetrics.delivered : 0,
            aiHandled,
            humanHandled,
            takeovers,
            aiToHumanRate: threadsGenerated > 0 ? takeovers / threadsGenerated : 0
        };

        // 3. Impacto Comercial (CRM)
        const crmEvents = await prisma.analyticsCrmEvent.findMany({
            where: {
                tenantId,
                OR: [
                    { threadId: { in: threadIds } }
                ]
            }
        });

        const leads = crmEvents.filter(e => e.type === 'LEAD_GENERATED' || e.type === 'LEAD_SYNCED').length;
        const deals = crmEvents.filter(e => e.type === 'DEAL_CREATED').length;
        const revenue = crmEvents
            .filter(e => e.type === 'DEAL_WON' || e.type === 'REVENUE_ATTRIBUTED')
            .reduce((sum, e) => sum + (e.value || 0), 0);

        const commercialImpact = {
            leadsGenerated: leads,
            dealsGenerated: deals,
            revenueAttributed: revenue,
            leadConversionRate: threadsGenerated > 0 ? leads / threadsGenerated : 0,
            dealConversionRate: leads > 0 ? deals / leads : 0,
            revenuePerCampaign: revenue // Por ahora es lo mismo que attributed
        };

        return {
            campaignInfo: {
                id: campaign.id,
                name: campaign.name,
                status: campaign.status,
                channelName: campaign.channel.name,
                channelPhone: campaign.channel.displayPhone,
                templateName: campaign.template?.name || 'Personalizado',
                startedAt: campaign.startedAt,
                completedAt: campaign.completedAt
            },
            coreMetrics,
            conversationalImpact,
            commercialImpact
        };
    }

    /**
     * Datos para el funnel de conversión.
     */
    static async getFunnel(tenantId: string, campaignId: string) {
        const summary = await this.getSummary(tenantId, campaignId);
        
        return [
            { label: 'Audiencia Objetivo', value: summary.coreMetrics.sent + summary.coreMetrics.failed },
            { label: 'Mensajes Enviados', value: summary.coreMetrics.sent },
            { label: 'Entregados', value: summary.coreMetrics.delivered },
            { label: 'Leídos', value: summary.coreMetrics.read },
            { label: 'Respondidos', value: summary.conversationalImpact.responded },
            { label: 'Hilos Creados', value: summary.conversationalImpact.threadsGenerated },
            { label: 'Leads', value: summary.commercialImpact.leadsGenerated },
            { label: 'Deals', value: summary.commercialImpact.dealsGenerated }
        ];
    }

    /**
     * Desglose de errores de envío.
     */
    static async getErrors(tenantId: string, campaignId: string) {
        const errorGroups = await prisma.whatsappCampaignMessage.groupBy({
            by: ['errorCode'],
            where: { campaignId, tenantId, status: 'FAILED' },
            _count: { _all: true }
        });

        const totalFailed = errorGroups.reduce((sum, g) => sum + (g._count?._all || 0), 0);

        return errorGroups.map(g => ({
            error_type: g.errorCode || 'Unknown Error',
            count: g._count?._all || 0,
            percentage: totalFailed > 0 ? ((g._count?._all || 0) / totalFailed) * 100 : 0
        })).sort((a, b) => b.count - a.count);
    }

    /**
     * Series temporales para gráficas.
     */
    static async getTimeSeries(tenantId: string, campaignId: string, period: string = 'all') {
        const where: any = { tenantId, campaignId };
        
        if (period === '24h') {
            where.occurredAt = { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) };
        } else if (period === '7d') {
            where.occurredAt = { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
        }

        const events = await prisma.analyticsEvent.findMany({
            where: {
                ...where,
                eventType: { in: ['CAMPAIGN_MESSAGE_SENT', 'CAMPAIGN_MESSAGE_DELIVERED', 'CAMPAIGN_MESSAGE_READ', 'CAMPAIGN_MESSAGE_FAILED', 'MESSAGE_INBOUND_USER'] }
            },
            select: { eventType: true, occurredAt: true },
            orderBy: { occurredAt: 'asc' }
        });

        // Agrupar por hora o día según el volumen/periodo
        // Para simplificar, devolvemos los eventos crudos o una agrupación básica por hora
        const timeGroups: Record<string, any> = {};

        events.forEach(e => {
            const date = new Date(e.occurredAt);
            date.setMinutes(0, 0, 0); // Truncar a la hora
            const iso = date.toISOString();
            
            if (!timeGroups[iso]) {
                timeGroups[iso] = { timestamp: iso, sent: 0, delivered: 0, read: 0, failed: 0, responded: 0 };
            }

            if (e.eventType === 'CAMPAIGN_MESSAGE_SENT') timeGroups[iso].sent++;
            if (e.eventType === 'CAMPAIGN_MESSAGE_DELIVERED') timeGroups[iso].delivered++;
            if (e.eventType === 'CAMPAIGN_MESSAGE_READ') timeGroups[iso].read++;
            if (e.eventType === 'CAMPAIGN_MESSAGE_FAILED') timeGroups[iso].failed++;
            if (e.eventType === 'MESSAGE_INBOUND_USER') timeGroups[iso].responded++;
        });

        return Object.values(timeGroups);
    }

    /**
     * Listado detallado de destinatarios.
     */
    static async getRecipients(tenantId: string, campaignId: string, page: number = 1, limit: number = 50) {
        const skip = (page - 1) * limit;

        const [items, total] = await Promise.all([
            prisma.whatsappCampaignMessage.findMany({
                where: { campaignId, tenantId },
                include: {
                    contact: { select: { name: true, phone: true } },
                    // Buscamos si hay un hilo vinculado a este contacto y esta campaña
                },
                orderBy: { updatedAt: 'desc' },
                skip,
                take: limit
            }),
            prisma.whatsappCampaignMessage.count({ where: { campaignId, tenantId } })
        ]);

        // Enriquecer con threadId si existe
        // Como no hay relación directa Contact -> Campaign -> Thread en el schema de forma simple, 
        // buscamos hilos de la campaña para mapearlos.
        const campaignThreads = await prisma.whatsappThread.findMany({
            where: {
                tenantId,
                messages: {
                    some: {
                        campaignMessages: {
                            some: { campaignId }
                        }
                    }
                }
            },
            select: { id: true, contactId: true }
        });
        const threadMap = new Map(campaignThreads.map(t => [t.contactId, t.id]));

        const enrichedItems = items.map(m => ({
            id: m.id,
            contact_name: m.contact?.name || 'Desconocido',
            phone: m.contact?.phone || 'N/A',
            status: m.status,
            error_message: m.errorCode,
            updatedAt: m.updatedAt.toISOString(),
            threadId: threadMap.get(m.contactId)
        }));

        return { items: enrichedItems, total, page, limit };
    }
}
