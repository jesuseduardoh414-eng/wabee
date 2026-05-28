import 'dotenv/config';
import {
    AnalyticsActorType,
    AnalyticsEventType,
    ChannelAiMode,
    ContactLifecycleStatus,
    ContactStatus,
    MessageGeneratedBy,
    MessageSenderType,
    ThreadHandlingMode,
    WhatsappCampaignMessageStatus,
    WhatsappCampaignStatus,
} from '@prisma/client';
import { prisma } from '../config/core/core.prisma';
import { DemoSeedService } from '../modules/wabee/contacts/demoSeed.service';

const DEMO_ORG_SLUG = 'wabee-demo';
const DEMO_CHANNEL_KEY = 'demo_phone_main';
const DEMO_EVENT_CHANNEL = 'demo_seed';

type DemoMemberMap = {
    adminId: string;
    supervisorId: string;
    agentId: string;
};

type DemoThreadSeed = {
    phone: string;
    status: 'OPEN' | 'PENDING' | 'CLOSED';
    handlingMode: ThreadHandlingMode;
    assignedUserId: string | null;
    aiPaused?: boolean;
    unreadCount?: number;
    preview: string;
    messages: Array<{
        direction: 'INBOUND' | 'OUTBOUND';
        senderType: MessageSenderType;
        generatedBy: MessageGeneratedBy;
        text: string;
        minutesAgo: number;
        status: string;
        actorType?: AnalyticsActorType;
        actorUserId?: string | null;
    }>;
    note?: string;
    lead?: boolean;
    revenue?: number;
    campaignKey?: 'reactivacion' | 'upsell';
};

function minutesAgo(minutes: number) {
    return new Date(Date.now() - minutes * 60 * 1000);
}

async function getDemoOrgId(): Promise<string> {
    const rows = await prisma.$queryRawUnsafe(
        `SELECT id FROM core.organizations WHERE slug = $1 LIMIT 1`,
        DEMO_ORG_SLUG
    ) as Array<{ id: string }>;

    if (!rows.length) {
        throw new Error(`No existe la organización demo con slug ${DEMO_ORG_SLUG}. Corre seed-test-users.ts primero.`);
    }

    return rows[0].id;
}

async function getDemoMembers(orgId: string): Promise<DemoMemberMap> {
    const rows = await prisma.$queryRawUnsafe(
        `SELECT p.id, p.email, r.slug
         FROM core.organization_members om
         JOIN core.profiles p ON p.id = om.user_id
         JOIN core.roles r ON r.id = om.role_id
         WHERE om.organization_id = $1::uuid AND om.status = 'active'`,
        orgId
    ) as Array<{ id: string; email: string; slug: string }>;

    const byRole = new Map(rows.map((row) => [row.slug, row.id]));
    const adminId = byRole.get('admin');
    const supervisorId = byRole.get('supervisor');
    const agentId = byRole.get('agent');

    if (!adminId || !supervisorId || !agentId) {
        throw new Error('La org demo no tiene admin, supervisor y agente activos.');
    }

    return { adminId, supervisorId, agentId };
}

async function ensureDemoChannel(tenantId: string) {
    return prisma.whatsappChannel.upsert({
        where: {
            tenantId_phoneNumberId: {
                tenantId,
                phoneNumberId: DEMO_CHANNEL_KEY,
            },
        },
        create: {
            tenantId,
            name: 'WhatsApp ventas MX',
            purpose: 'SALES',
            status: 'CONNECTED',
            wabaId: 'demo-waba-main',
            phoneNumberId: DEMO_CHANNEL_KEY,
            metaAppId: 'demo-meta-app',
            displayPhone: '+52 777 100 5436',
            verifiedName: 'Wabee Demo',
            webhookStatus: 'OK',
            healthStatus: 'HEALTHY',
            lastHealthyAt: new Date(),
            lastHealthCheckAt: new Date(),
            aiEnabled: true,
            aiMode: ChannelAiMode.copilot_only,
            humanHandoffEnabled: true,
            fallbackMessage: 'Un asesor continuará la conversación en breve.',
        },
        update: {
            name: 'WhatsApp ventas MX',
            status: 'CONNECTED',
            displayPhone: '+52 777 100 5436',
            verifiedName: 'Wabee Demo',
            webhookStatus: 'OK',
            healthStatus: 'HEALTHY',
            lastHealthyAt: new Date(),
            lastHealthCheckAt: new Date(),
            aiEnabled: true,
            aiMode: ChannelAiMode.copilot_only,
            humanHandoffEnabled: true,
            archivedAt: null,
        },
    });
}

async function clearPreviousDemoArtifacts(tenantId: string) {
    const existingThreads = await prisma.whatsappThread.findMany({
        where: { tenantId, source: 'demo_seed' },
        select: { id: true },
    });
    const existingThreadIds = existingThreads.map((thread) => thread.id);

    const existingCampaigns = await prisma.whatsappCampaign.findMany({
        where: {
            tenantId,
            name: { in: ['Demo Reactivación Mayo', 'Demo Upsell Premium'] },
        },
        select: { id: true },
    });
    const existingCampaignIds = existingCampaigns.map((campaign) => campaign.id);

    await prisma.analyticsEvent.deleteMany({
        where: {
            tenantId,
            OR: [
                { channel: DEMO_EVENT_CHANNEL },
                existingThreadIds.length ? { threadId: { in: existingThreadIds } } : undefined,
                existingCampaignIds.length ? { campaignId: { in: existingCampaignIds } } : undefined,
            ].filter(Boolean) as any,
        },
    });

    if (existingThreadIds.length) {
        await prisma.whatsappThreadNote.deleteMany({
            where: { tenantId, threadId: { in: existingThreadIds } },
        });
    }

    if (existingCampaignIds.length) {
        await prisma.whatsappCampaignMessage.deleteMany({
            where: { tenantId, campaignId: { in: existingCampaignIds } },
        });
        await prisma.whatsappCampaign.deleteMany({
            where: { tenantId, id: { in: existingCampaignIds } },
        });
    }

    await prisma.whatsappMessage.deleteMany({
        where: { tenantId, source: 'demo_seed' },
    });

    await prisma.whatsappThread.deleteMany({
        where: { tenantId, source: 'demo_seed' },
    });
}

async function ensureDemoContacts(tenantId: string) {
    await DemoSeedService.seedDemoContacts(tenantId, 24);

    return prisma.contact.findMany({
        where: { tenantId, sourceSystem: 'demo' },
        orderBy: { phone: 'asc' },
        take: 24,
    });
}

async function seedCampaigns(tenantId: string, channelId: string, contacts: Array<{ id: string; name: string | null }>) {
    const reactivation = await prisma.whatsappCampaign.create({
        data: {
            tenantId,
            channelId,
            name: 'Demo Reactivación Mayo',
            status: WhatsappCampaignStatus.IN_PROGRESS,
            audienceType: 'segment',
            audienceFilter: { kind: 'segment', name: 'VIP Leads' },
            estimatedRecipients: 12,
            startedAt: minutesAgo(60 * 24 * 2),
            sentCount: 12,
            deliveredCount: 10,
            readCount: 6,
            failedCount: 1,
        },
    });

    const upsell = await prisma.whatsappCampaign.create({
        data: {
            tenantId,
            channelId,
            name: 'Demo Upsell Premium',
            status: WhatsappCampaignStatus.COMPLETED,
            audienceType: 'group',
            audienceFilter: { kind: 'group', name: 'VIP' },
            estimatedRecipients: 8,
            startedAt: minutesAgo(60 * 24 * 5),
            completedAt: minutesAgo(60 * 24 * 4),
            sentCount: 8,
            deliveredCount: 8,
            readCount: 5,
            failedCount: 0,
        },
    });

    const reactivationContacts = contacts.slice(0, 12);
    const upsellContacts = contacts.slice(6, 14);

    await Promise.all(
        reactivationContacts.map((contact, index) =>
            prisma.whatsappCampaignMessage.create({
                data: {
                    tenantId,
                    campaignId: reactivation.id,
                    contactId: contact.id,
                    status: index < 6 ? WhatsappCampaignMessageStatus.READ : WhatsappCampaignMessageStatus.DELIVERED,
                    attempts: 1,
                    variant: index % 2 === 0 ? 'A' : 'B',
                },
            })
        )
    );

    await Promise.all(
        upsellContacts.map((contact) =>
            prisma.whatsappCampaignMessage.create({
                data: {
                    tenantId,
                    campaignId: upsell.id,
                    contactId: contact.id,
                    status: WhatsappCampaignMessageStatus.READ,
                    attempts: 1,
                    variant: 'A',
                },
            })
        )
    );

    return { reactivation, upsell };
}

async function createAnalyticsEvent(data: {
    tenantId: string;
    eventType: AnalyticsEventType;
    occurredAt: Date;
    threadId?: string;
    contactId?: string;
    campaignId?: string;
    actorType?: AnalyticsActorType;
    actorUserId?: string | null;
    meta?: Record<string, unknown>;
}) {
    await prisma.analyticsEvent.create({
        data: {
            tenantId: data.tenantId,
            occurredAt: data.occurredAt,
            eventType: data.eventType,
            channel: DEMO_EVENT_CHANNEL,
            threadId: data.threadId,
            contactId: data.contactId,
            campaignId: data.campaignId,
            actorType: data.actorType ?? AnalyticsActorType.SYSTEM,
            actorUserId: data.actorUserId ?? null,
            meta: data.meta ?? {},
        },
    });
}

async function seedThreadsAndMessages(
    tenantId: string,
    channel: { id: string; displayPhone: string | null },
    contacts: Array<{ id: string; phone: string; name: string | null }>,
    members: DemoMemberMap,
    campaigns: { reactivation: { id: string }; upsell: { id: string } }
) {
    const seeds: DemoThreadSeed[] = [
        {
            phone: contacts[0].phone,
            status: 'OPEN',
            handlingMode: ThreadHandlingMode.human_queue,
            assignedUserId: members.agentId,
            unreadCount: 2,
            preview: '¿Cuándo llega mi pedido?',
            messages: [
                { direction: 'INBOUND', senderType: MessageSenderType.contact, generatedBy: MessageGeneratedBy.user, text: 'Hola, quiero saber cuándo llega mi pedido.', minutesAgo: 320, status: 'RECEIVED' },
                { direction: 'OUTBOUND', senderType: MessageSenderType.human, generatedBy: MessageGeneratedBy.user, text: 'Te ayudo con eso. Déjame revisar tu guía.', minutesAgo: 300, status: 'DELIVERED', actorType: AnalyticsActorType.HUMAN, actorUserId: members.agentId },
                { direction: 'INBOUND', senderType: MessageSenderType.contact, generatedBy: MessageGeneratedBy.user, text: 'Perfecto, gracias.', minutesAgo: 295, status: 'RECEIVED' },
            ],
            note: 'Cliente preguntó por guía de envío. Prioridad media.',
            campaignKey: 'reactivacion',
        },
        {
            phone: contacts[1].phone,
            status: 'OPEN',
            handlingMode: ThreadHandlingMode.human,
            assignedUserId: members.supervisorId,
            unreadCount: 0,
            preview: 'Quiero una demo con mi equipo comercial',
            messages: [
                { direction: 'INBOUND', senderType: MessageSenderType.contact, generatedBy: MessageGeneratedBy.user, text: 'Vi su campaña y quiero una demo con mi equipo comercial.', minutesAgo: 1500, status: 'RECEIVED' },
                { direction: 'OUTBOUND', senderType: MessageSenderType.ai, generatedBy: MessageGeneratedBy.ai, text: 'Claro, puedo ayudarte a coordinar una llamada.', minutesAgo: 1490, status: 'DELIVERED', actorType: AnalyticsActorType.AI },
                { direction: 'OUTBOUND', senderType: MessageSenderType.human, generatedBy: MessageGeneratedBy.user, text: 'Soy Laura, te puedo ayudar a agendar hoy mismo.', minutesAgo: 1470, status: 'READ', actorType: AnalyticsActorType.HUMAN, actorUserId: members.supervisorId },
            ],
            lead: true,
            revenue: 18000,
            campaignKey: 'reactivacion',
        },
        {
            phone: contacts[2].phone,
            status: 'PENDING',
            handlingMode: ThreadHandlingMode.ai,
            assignedUserId: null,
            unreadCount: 1,
            preview: '¿Tienen integración con HubSpot?',
            messages: [
                { direction: 'INBOUND', senderType: MessageSenderType.contact, generatedBy: MessageGeneratedBy.user, text: '¿Tienen integración con HubSpot?', minutesAgo: 420, status: 'RECEIVED' },
                { direction: 'OUTBOUND', senderType: MessageSenderType.ai, generatedBy: MessageGeneratedBy.ai, text: 'Sí, tenemos integración y también webhook nativo.', minutesAgo: 410, status: 'DELIVERED', actorType: AnalyticsActorType.AI },
            ],
            lead: true,
        },
        {
            phone: contacts[3].phone,
            status: 'CLOSED',
            handlingMode: ThreadHandlingMode.human,
            assignedUserId: members.adminId,
            unreadCount: 0,
            preview: 'Gracias, quedó resuelto',
            messages: [
                { direction: 'INBOUND', senderType: MessageSenderType.contact, generatedBy: MessageGeneratedBy.user, text: 'Necesito factura del plan anterior.', minutesAgo: 5100, status: 'RECEIVED' },
                { direction: 'OUTBOUND', senderType: MessageSenderType.human, generatedBy: MessageGeneratedBy.user, text: 'Te la envío por correo en un momento.', minutesAgo: 5070, status: 'DELIVERED', actorType: AnalyticsActorType.HUMAN, actorUserId: members.adminId },
                { direction: 'INBOUND', senderType: MessageSenderType.contact, generatedBy: MessageGeneratedBy.user, text: 'Gracias, quedó resuelto.', minutesAgo: 5040, status: 'RECEIVED' },
            ],
        },
        {
            phone: contacts[4].phone,
            status: 'OPEN',
            handlingMode: ThreadHandlingMode.paused,
            assignedUserId: members.agentId,
            aiPaused: true,
            unreadCount: 3,
            preview: 'Necesito hablar con una persona',
            messages: [
                { direction: 'INBOUND', senderType: MessageSenderType.contact, generatedBy: MessageGeneratedBy.user, text: 'Necesito hablar con una persona.', minutesAgo: 180, status: 'RECEIVED' },
                { direction: 'OUTBOUND', senderType: MessageSenderType.ai, generatedBy: MessageGeneratedBy.ai, text: 'Te voy a transferir con un asesor.', minutesAgo: 176, status: 'DELIVERED', actorType: AnalyticsActorType.AI },
            ],
            campaignKey: 'upsell',
        },
        {
            phone: contacts[5].phone,
            status: 'OPEN',
            handlingMode: ThreadHandlingMode.ai,
            assignedUserId: null,
            unreadCount: 0,
            preview: 'Listo, me interesa el plan premium',
            messages: [
                { direction: 'INBOUND', senderType: MessageSenderType.contact, generatedBy: MessageGeneratedBy.user, text: 'Listo, me interesa el plan premium.', minutesAgo: 90, status: 'RECEIVED' },
                { direction: 'OUTBOUND', senderType: MessageSenderType.ai, generatedBy: MessageGeneratedBy.ai, text: 'Puedo ayudarte con la activación y el comparativo.', minutesAgo: 85, status: 'DELIVERED', actorType: AnalyticsActorType.AI },
            ],
            lead: true,
            revenue: 32000,
            campaignKey: 'upsell',
        },
    ];

    const contactsByPhone = new Map(contacts.map((contact) => [contact.phone, contact]));
    let createdThreads = 0;
    let createdMessages = 0;

    for (const [index, seed] of seeds.entries()) {
        const contact = contactsByPhone.get(seed.phone);
        if (!contact) continue;

        const timestamps = seed.messages.map((message) => minutesAgo(message.minutesAgo)).sort((a, b) => a.getTime() - b.getTime());
        const lastMessageAt = timestamps[timestamps.length - 1] ?? new Date();

        const thread = await prisma.whatsappThread.create({
            data: {
                tenantId,
                channelId: channel.id,
                contactPhone: contact.phone,
                contactName: contact.name,
                lastMessageAt,
                lastMessagePreview: seed.preview,
                unreadCount: seed.unreadCount ?? 0,
                status: seed.status,
                metadata: { source: 'demo_seed', scenario: index + 1 },
                contactId: contact.id,
                assignedUserId: seed.assignedUserId,
                contextState: { source: 'demo_seed' },
                source: 'demo_seed',
                handlingMode: seed.handlingMode,
                aiPaused: seed.aiPaused ?? false,
                humanTakeoverAt: seed.handlingMode === ThreadHandlingMode.human || seed.handlingMode === ThreadHandlingMode.human_queue ? lastMessageAt : null,
                humanTakeoverBy: seed.assignedUserId,
                lastResponderType: seed.messages[seed.messages.length - 1]?.senderType ?? MessageSenderType.contact,
            },
        });
        createdThreads++;

        if (seed.note) {
            await prisma.whatsappThreadNote.create({
                data: {
                    tenantId,
                    threadId: thread.id,
                    body: seed.note,
                    createdById: seed.assignedUserId ?? members.adminId,
                    isPinned: true,
                },
            });
        }

        await createAnalyticsEvent({
            tenantId,
            eventType: AnalyticsEventType.THREAD_CREATED,
            occurredAt: timestamps[0] ?? new Date(),
            threadId: thread.id,
            contactId: contact.id,
        });

        for (const [messageIndex, message] of seed.messages.entries()) {
            const timestamp = minutesAgo(message.minutesAgo);
            await prisma.whatsappMessage.create({
                data: {
                    tenantId,
                    channelId: channel.id,
                    direction: message.direction,
                    threadId: thread.id,
                    fromPhone: message.direction === 'INBOUND' ? contact.phone : (channel.displayPhone ?? '+52 777 100 5436'),
                    toPhone: message.direction === 'INBOUND' ? (channel.displayPhone ?? '+52 777 100 5436') : contact.phone,
                    remotePhone: contact.phone,
                    type: 'text',
                    textBody: message.text,
                    timestamp,
                    status: message.status,
                    deliveryStatus: message.direction === 'OUTBOUND' ? message.status.toLowerCase() : null,
                    createdAt: timestamp,
                    metadata: { source: 'demo_seed' },
                    source: 'demo_seed',
                    externalRef: `demo-seed-${thread.id}-${messageIndex}`,
                    senderType: message.senderType,
                    senderUserId: message.actorUserId ?? null,
                    generatedBy: message.generatedBy,
                },
            });
            createdMessages++;

            await createAnalyticsEvent({
                tenantId,
                eventType: message.direction === 'INBOUND' ? AnalyticsEventType.MESSAGE_INBOUND_USER : (message.senderType === MessageSenderType.ai ? AnalyticsEventType.MESSAGE_OUTBOUND_AI : AnalyticsEventType.MESSAGE_OUTBOUND_HUMAN),
                occurredAt: timestamp,
                threadId: thread.id,
                contactId: contact.id,
                actorType: message.actorType ?? (message.direction === 'INBOUND' ? AnalyticsActorType.SYSTEM : AnalyticsActorType.HUMAN),
                actorUserId: message.actorUserId ?? null,
            });
        }

        if (seed.handlingMode === ThreadHandlingMode.human_queue || seed.aiPaused) {
            await createAnalyticsEvent({
                tenantId,
                eventType: AnalyticsEventType.HUMAN_TAKEOVER,
                occurredAt: lastMessageAt,
                threadId: thread.id,
                contactId: contact.id,
                actorType: AnalyticsActorType.HUMAN,
                actorUserId: seed.assignedUserId ?? members.supervisorId,
            });
        }

        if (seed.assignedUserId) {
            await createAnalyticsEvent({
                tenantId,
                eventType: AnalyticsEventType.THREAD_ASSIGNED_TO_HUMAN,
                occurredAt: lastMessageAt,
                threadId: thread.id,
                contactId: contact.id,
                actorType: AnalyticsActorType.HUMAN,
                actorUserId: seed.assignedUserId,
            });
        }

        if (seed.status === 'CLOSED') {
            await createAnalyticsEvent({
                tenantId,
                eventType: AnalyticsEventType.THREAD_STATUS_CHANGED,
                occurredAt: lastMessageAt,
                threadId: thread.id,
                contactId: contact.id,
                actorType: AnalyticsActorType.HUMAN,
                actorUserId: seed.assignedUserId ?? members.adminId,
                meta: { status: 'CLOSED' },
            });
        }

        if (seed.lead) {
            await createAnalyticsEvent({
                tenantId,
                eventType: AnalyticsEventType.CRM_EVENT,
                occurredAt: lastMessageAt,
                threadId: thread.id,
                contactId: contact.id,
                campaignId: seed.campaignKey === 'reactivacion' ? campaigns.reactivation.id : seed.campaignKey === 'upsell' ? campaigns.upsell.id : undefined,
                meta: { type: 'lead' },
            });
        }

        if (seed.revenue) {
            await createAnalyticsEvent({
                tenantId,
                eventType: AnalyticsEventType.CRM_EVENT,
                occurredAt: lastMessageAt,
                threadId: thread.id,
                contactId: contact.id,
                campaignId: seed.campaignKey === 'reactivacion' ? campaigns.reactivation.id : seed.campaignKey === 'upsell' ? campaigns.upsell.id : undefined,
                meta: { type: 'deal', revenue: seed.revenue },
            });
        }
    }

    return { createdThreads, createdMessages };
}

async function seedCampaignAnalytics(
    tenantId: string,
    campaignId: string,
    delivered: number,
    read: number,
    responded: number,
    leads: number,
    revenue: number
) {
    const baseDate = minutesAgo(60 * 24 * 2);

    for (let i = 0; i < delivered + 2; i++) {
        await createAnalyticsEvent({
            tenantId,
            eventType: AnalyticsEventType.CAMPAIGN_MESSAGE_SENT,
            occurredAt: new Date(baseDate.getTime() + i * 60_000),
            campaignId,
        });
    }

    for (let i = 0; i < delivered; i++) {
        await createAnalyticsEvent({
            tenantId,
            eventType: AnalyticsEventType.CAMPAIGN_MESSAGE_DELIVERED,
            occurredAt: new Date(baseDate.getTime() + i * 90_000),
            campaignId,
        });
    }

    for (let i = 0; i < read; i++) {
        await createAnalyticsEvent({
            tenantId,
            eventType: AnalyticsEventType.CAMPAIGN_MESSAGE_READ,
            occurredAt: new Date(baseDate.getTime() + i * 120_000),
            campaignId,
        });
    }

    for (let i = 0; i < responded; i++) {
        await createAnalyticsEvent({
            tenantId,
            eventType: AnalyticsEventType.MESSAGE_INBOUND_USER,
            occurredAt: new Date(baseDate.getTime() + i * 150_000),
            campaignId,
        });
    }

    for (let i = 0; i < leads; i++) {
        await createAnalyticsEvent({
            tenantId,
            eventType: AnalyticsEventType.CRM_EVENT,
            occurredAt: new Date(baseDate.getTime() + i * 180_000),
            campaignId,
            meta: { type: 'lead' },
        });
    }

    if (revenue > 0) {
        await createAnalyticsEvent({
            tenantId,
            eventType: AnalyticsEventType.CRM_EVENT,
            occurredAt: new Date(baseDate.getTime() + 999_000),
            campaignId,
            meta: { type: 'deal', revenue },
        });
    }
}

async function seedOperationalNoise(tenantId: string) {
    await createAnalyticsEvent({
        tenantId,
        eventType: AnalyticsEventType.CRM_EVENT,
        occurredAt: minutesAgo(35),
        meta: { type: 'error', error: 'HubSpot timeout' },
    });
}

async function main() {
    console.log('\n🌱 Preparando Wabee Demo como workspace testeable...\n');

    const tenantId = await getDemoOrgId();
    const members = await getDemoMembers(tenantId);

    await clearPreviousDemoArtifacts(tenantId);
    const channel = await ensureDemoChannel(tenantId);
    const contacts = await ensureDemoContacts(tenantId);
    const campaigns = await seedCampaigns(tenantId, channel.id, contacts);
    const threadStats = await seedThreadsAndMessages(tenantId, channel, contacts, members, campaigns);

    await seedCampaignAnalytics(tenantId, campaigns.reactivation.id, 10, 6, 4, 2, 18000);
    await seedCampaignAnalytics(tenantId, campaigns.upsell.id, 8, 5, 2, 1, 32000);
    await seedOperationalNoise(tenantId);

    console.log('✅ Workspace demo listo.\n');
    console.table([
        { recurso: 'Organización', valor: 'Wabee Demo' },
        { recurso: 'Canal WhatsApp', valor: channel.name },
        { recurso: 'Contactos demo', valor: contacts.length },
        { recurso: 'Threads demo', valor: threadStats.createdThreads },
        { recurso: 'Mensajes demo', valor: threadStats.createdMessages },
        { recurso: 'Campañas demo', valor: 2 },
    ]);
}

main()
    .catch((error) => {
        console.error('\n❌ Error:', error.message);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
