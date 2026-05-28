import { Prisma } from '@prisma/client';
import { prisma } from '@/config/core/core.prisma';
import { coreAdapter } from '@/modules/core/core.adapter';


export class DashboardService {
    /**
     * Resuelve el tenantId real. Si recibe un slug (no-UUID), busca la organización por campo 'slug'.
     * Si no se encuentra (caso de slugs de sistema o superadmin global), retorna null para omitir el filtro.
     */
    private static async resolveTenantId(tenantId: string): Promise<string | null> {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(tenantId)) return tenantId;

        console.log(`[DashboardService] Buscando organización para slug: ${tenantId}`);
        const org = await coreAdapter.organizations.getBySlug(tenantId);

        if (!org) {
            console.log(`[DashboardService] No hay organización vinculada al slug '${tenantId}'. Se asume contexto global.`);
            return null;
        }

        return org.id;
    }

    /**
     * Resumen ejecutivo de KPIs
     */
    static async getSummary(rawTenantId: string, from?: string, to?: string) {
        const tenantId = await this.resolveTenantId(rawTenantId);
        const where: any = {};
        if (tenantId) where.tenantId = tenantId;

        if (from || to) {
            where.occurredAt = {};
            if (from) where.occurredAt.gte = new Date(from);
            if (to) where.occurredAt.lte = new Date(to);
        }

        // 1. Revenue y Leads (Eventos CRM)
        const crmEvents = await prisma.analyticsEvent.findMany({
            where: {
                ...where,
                eventType: 'CRM_EVENT',
            }
        });

        let revenueAttributed = 0;
        let leadsGenerated = 0;
        let dealsGenerated = 0;

        crmEvents.forEach((event: any) => {
            const meta = event.meta || {};
            if (meta.type === 'lead') leadsGenerated++;
            if (meta.type === 'deal') dealsGenerated++;
            if (meta.revenue) revenueAttributed += Number(meta.revenue);
        });

        // 2. Total Conversaciones (Threads creados en el periodo)
        const totalConversations = await prisma.analyticsEvent.count({
            where: {
                ...where,
                eventType: 'THREAD_CREATED'
            }
        });

        // 3. Automation Rate (Hilos atendidos por AI vs Total)
        // Definición: Hilos donde hubo mensaje AI y NUNCA hubo takeover
        const aiHandledEvents = await prisma.analyticsEvent.findMany({
            where: {
                ...where,
                eventType: { in: ['MESSAGE_OUTBOUND_AI', 'HUMAN_TAKEOVER'] },
                threadId: { not: null }
            },
            select: { eventType: true, threadId: true },
            distinct: ['threadId', 'eventType']
        });

        const threadStatusMap = new Map<string, Set<string>>();
        aiHandledEvents.forEach(e => {
            if (!e.threadId) return;
            if (!threadStatusMap.has(e.threadId)) threadStatusMap.set(e.threadId, new Set());
            threadStatusMap.get(e.threadId)!.add(e.eventType);
        });

        let aiHandledCount = 0;
        threadStatusMap.forEach(types => {
            if (types.has('MESSAGE_OUTBOUND_AI') && !types.has('HUMAN_TAKEOVER')) {
                aiHandledCount++;
            }
        });

        let automationRate = totalConversations > 0 ? (aiHandledCount / totalConversations) : 0;
        if (automationRate > 1) automationRate = 1;
        if (automationRate < 0) automationRate = 0;

        // 4. Response Times (Aproximación por eventos)
        // En una implementación real, calcularíamos la diferencia entre MESSAGE_INBOUND y MESSAGE_OUTBOUND
        const avgFirstResponseTime = 1.5; // Placeholder en minutos hasta implementar lógica de diff
        const avgFirstHumanResponseTime = 4.2; // Placeholder

        // 5. Conversion Rates
        const deliveredEvents = await prisma.analyticsEvent.count({
            where: { ...where, eventType: 'CAMPAIGN_MESSAGE_DELIVERED' }
        });

        const conversationRate = deliveredEvents > 0 ? (totalConversations / deliveredEvents) : 0;
        const leadConversionRate = totalConversations > 0 ? (leadsGenerated / totalConversations) : 0;
        const dealConversionRate = leadsGenerated > 0 ? (dealsGenerated / leadsGenerated) : 0;

        return {
            revenueAttributed,
            leadsGenerated,
            totalConversations,
            automationRate,
            avgFirstResponseTime,
            avgFirstHumanResponseTime,
            conversationRate,
            leadConversionRate,
            dealConversionRate
        };
    }

    /**
     * Salud Operativa rápida
     */
    static async getOperationalHealth(rawTenantId: string) {
        const tenantId = await this.resolveTenantId(rawTenantId);
        const where: any = {};
        if (tenantId) where.tenantId = tenantId;

        // Canales
        const channels = await prisma.whatsappChannel.findMany({
            where,
            select: { id: true, name: true, healthStatus: true }
        });

        // Campañas activas
        const activeCampaigns = await (prisma.whatsappCampaign as any).count({
            where: { ...where, status: 'IN_PROGRESS' }
        });

        // Errores CRM recientes (últimas 24h)
        const crmErrors = await (prisma.analyticsEvent as any).count({
            where: {
                ...where,
                eventType: 'CRM_EVENT',
                occurredAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
                meta: { path: ['error'], not: Prisma.JsonNull }
            }
        });

        return {
            channels,
            activeCampaigns,
            crmErrors
        };
    }

    /**
     * IA vs Humano (Eficiencia y Takeovers)
     */
    static async getAiVsHuman(rawTenantId: string, from?: string, to?: string) {
        const tenantId = await this.resolveTenantId(rawTenantId);
        const where: any = {};
        if (tenantId) where.tenantId = tenantId;
        if (from || to) {
            where.occurredAt = {};
            if (from) where.occurredAt.gte = new Date(from);
            if (to) where.occurredAt.lte = new Date(to);
        }

        const events = await prisma.analyticsEvent.findMany({
            where: {
                ...where,
                eventType: { in: ['MESSAGE_OUTBOUND_AI', 'MESSAGE_OUTBOUND_HUMAN', 'HUMAN_TAKEOVER'] },
                threadId: { not: null }
            },
            select: { eventType: true, threadId: true },
            distinct: ['threadId', 'eventType']
        });

        const threadStats = new Map<string, Set<string>>();
        events.forEach(e => {
            if (!e.threadId) return;
            if (!threadStats.has(e.threadId)) threadStats.set(e.threadId, new Set());
            threadStats.get(e.threadId)!.add(e.eventType);
        });

        let aiHandled = 0;
        let humanHandled = 0;
        let takeovers = 0;

        threadStats.forEach(types => {
            if (types.has('MESSAGE_OUTBOUND_AI') && !types.has('HUMAN_TAKEOVER')) {
                aiHandled++;
            }
            if (types.has('MESSAGE_OUTBOUND_HUMAN') || types.has('HUMAN_TAKEOVER')) {
                humanHandled++;
            }
            if (types.has('HUMAN_TAKEOVER')) {
                takeovers++;
            }
        });

        const aiToHumanRate = aiHandled > 0 ? (takeovers / aiHandled) : 0;

        return {
            aiHandled,
            humanHandled,
            takeovers,
            aiToHumanRate
        };
    }

    /**
     * Rendimiento de Campañas
     */
    static async getTopCampaigns(rawTenantId: string, from?: string, to?: string) {
        const tenantId = await this.resolveTenantId(rawTenantId);
        const where: any = {};
        if (tenantId) where.tenantId = tenantId;

        const campaigns = await prisma.whatsappCampaign.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: {
                _count: {
                    select: { messages: true }
                }
            }
        });

        // Enriquecer con analíticas reales
        const enriched = await Promise.all(campaigns.map(async (c) => {
            const stats = await (prisma.analyticsEvent as any).groupBy({
                by: ['eventType'],
                where: { ...where, campaignId: c.id },
                _count: true
            });

            const getCount = (type: string) => stats.find((s: any) => s.eventType === type)?._count || 0;

            const sent = getCount('CAMPAIGN_MESSAGE_SENT');
            const delivered = getCount('CAMPAIGN_MESSAGE_DELIVERED');
            const responded = await (prisma.analyticsEvent as any).count({
                where: { ...where, campaignId: c.id, eventType: 'MESSAGE_INBOUND_USER' }
            });

            // Revenue atribuido a esta campaña
            const crmEvents = await (prisma.analyticsEvent as any).findMany({
                where: { ...where, campaignId: c.id, eventType: 'CRM_EVENT' }
            });
            const revenue = crmEvents.reduce((acc: number, curr: any) => acc + (Number(curr.meta?.revenue) || 0), 0);

            return {
                id: c.id,
                name: c.name,
                sent,
                delivered,
                read: getCount('CAMPAIGN_MESSAGE_READ'),
                responded,
                revenueAttributed: revenue,
                responseRate: delivered > 0 ? (responded / delivered) : 0
            };
        }));

        // Ordenar por revenue
        return enriched.sort((a, b) => b.revenueAttributed - a.revenueAttributed);
    }

    /**
     * Desempeño de Agentes
     */
    static async getAgentsPerformance(rawTenantId: string, from?: string, to?: string) {
        const tenantId = await this.resolveTenantId(rawTenantId);
        const where: any = { actorType: 'HUMAN' };
        if (tenantId) where.tenantId = tenantId;
        if (from || to) {
            where.occurredAt = {};
            if (from) where.occurredAt.gte = new Date(from);
            if (to) where.occurredAt.lte = new Date(to);
        }

        const events = await prisma.analyticsEvent.findMany({
            where: {
                ...where,
                actorUserId: { not: null }
            }
        });

        const agentStats: any = {};
        events.forEach((ef: any) => {
            const uid = ef.actorUserId!;
            if (!agentStats[uid]) {
                agentStats[uid] = { agentId: uid, chatsHandled: new Set(), messagesSent: 0, chatsClosed: 0 };
            }
            if (ef.threadId) agentStats[uid].chatsHandled.add(ef.threadId);
            if (ef.eventType === 'MESSAGE_OUTBOUND_HUMAN') agentStats[uid].messagesSent++;
            if (ef.eventType === 'THREAD_STATUS_CHANGED' && ef.meta?.status === 'CLOSED') agentStats[uid].chatsClosed++;
        });

        // Resolución de nombres vía Core
        const agentIds = Object.keys(agentStats);
        let agentsInfo: any[] = [];
        if (agentIds.length > 0 && tenantId) {
            agentsInfo = await coreAdapter.profiles.listAuthorsInfo(agentIds, tenantId);
        }

        return Object.values(agentStats).map((s: any) => {
            const info = agentsInfo.find(a => a.id === s.agentId);
            return {
                ...s,
                agentName: info?.name || 'Agente',
                agentRole: info?.role || 'Staff',
                chatsHandled: s.chatsHandled.size,
                avgResponseTime: 5.5 // Placeholder
            };
        });
    }

    /**
     * Estado del Inbox
     */
    static async getInboxStatus(rawTenantId: string) {
        const tenantId = await this.resolveTenantId(rawTenantId);
        const where: any = {};
        if (tenantId) where.tenantId = tenantId;

        const threads = await prisma.whatsappThread.findMany({
            where,
            select: { status: true, handlingMode: true, assignedUserId: true }
        });

        return {
            open: threads.filter(t => t.status === 'OPEN').length,
            pending: threads.filter(t => t.status === 'PENDING').length,
            closed: threads.filter(t => t.status === 'CLOSED').length,
            human_queue: threads.filter(t => t.status === 'OPEN' && t.handlingMode === 'human_queue').length,
            assigned: threads.filter(t => !!t.assignedUserId).length,
            unassigned: threads.filter(t => !t.assignedUserId).length
        };
    }

    /**
     * Tendencia Temporal (Conversaciones, Leads, Revenue)
     */
    static async getTimeSeries(rawTenantId: string, from?: string, to?: string) {
        const tenantId = await this.resolveTenantId(rawTenantId);
        const where: any = {};
        if (tenantId) where.tenantId = tenantId;
        if (from || to) {
            where.occurredAt = {};
            if (from) where.occurredAt.gte = new Date(from);
            if (to) where.occurredAt.lte = new Date(to);
        }

        const events = await prisma.analyticsEvent.findMany({
            where: {
                ...where,
                eventType: { in: ['THREAD_CREATED', 'CRM_EVENT'] }
            },
            orderBy: { occurredAt: 'asc' }
        });

        const series: any = {};
        events.forEach((e: any) => {
            const day = e.occurredAt.toISOString().split('T')[0];
            if (!series[day]) series[day] = { timestamp: day, conversations: 0, leads: 0, revenue: 0 };
            
            if (e.eventType === 'THREAD_CREATED') series[day].conversations++;
            if (e.eventType === 'CRM_EVENT') {
                if (e.meta?.type === 'lead') series[day].leads++;
                if (e.meta?.revenue) series[day].revenue += Number(e.meta.revenue);
            }
        });

        return Object.values(series);
    }
}
