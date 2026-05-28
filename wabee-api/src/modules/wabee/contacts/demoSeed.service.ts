import { prisma } from '../../../config/core/core.prisma';
import { normalizePhone, ContactsService } from './contacts.service';
// @ts-ignore
import { ContactStatus, ContactLifecycleStatus } from '@prisma/client';

export class DemoSeedService {
    static async seedDemoContacts(tenantId: string, count = 40) {
        console.log(`🌱 Seeding demo contacts for tenant ${tenantId}...`);

        const names = [
            'Juan Pérez', 'María García', 'Carlos Rodríguez', 'Ana Martínez', 'Luis Hernández',
            'Sonia López', 'Diego González', 'Laura Pérez', 'Javier Sánchez', 'Marta Ramírez',
            'Pedro Gómez', 'Elena Torres', 'Ricardo Flores', 'Isabel Morales', 'Fernando Castillo',
            'Rosa Ortiz', 'Gabriel Ruiz', 'Silvia Jiménez', 'Roberto Castro', 'Beatriz Navarro',
            'Hugo Vargas', 'Paola Mendoza', 'Jorge Ramos', 'Claudia Reyes', 'Mario Rivera',
            'Adriana Salazar', 'Felipe Guzmán', 'Victoria Silva', 'Raúl Delgado', 'Patricia Aguilar',
            'Oscar Peña', 'Mónica Herrera', 'Víctor Rojas', 'Teresa Medina', 'Daniel Cortés',
            'Verónica Meza', 'Héctor Duarte', 'Lorena Bravo', 'Ángel Gallegos', 'Lucía Pardo'
        ];

        const tagsPool = ['vip', 'demo', 'lead', 'mx', 'customer', 'cold', 'hot', 'newsletter'];
        const lifecycles: ContactLifecycleStatus[] = ['NEW', 'LEAD', 'ACTIVE', 'CUSTOMER', 'INACTIVE'];

        let createdCount = 0;
        let skippedCount = 0;

        for (let i = 0; i < count; i++) {
            const phone = normalizePhone(`+521777000${(i + 1).toString().padStart(4, '0')}`);
            const name = names[i % names.length];
            const email = `${name.toLowerCase().replace(' ', '.')}@example.com`;

            // Random attributes
            const status: ContactStatus = Math.random() > 0.85 ? 'BLOCKED' : 'ACTIVE';
            const lifecycleStatus = lifecycles[Math.floor(Math.random() * lifecycles.length)];

            // Random tags (1 to 3 tags)
            const numTags = Math.floor(Math.random() * 3) + 1;
            const tags = Array.from(new Set(
                Array.from({ length: numTags }, () => tagsPool[Math.floor(Math.random() * tagsPool.length)])
            ));

            try {
                // Use service to ensure validation and hooks
                await prisma.contact.upsert({
                    where: { tenantId_phone: { tenantId, phone } },
                    create: {
                        tenantId,
                        phone,
                        name,
                        email,
                        status,
                        lifecycleStatus,
                        tags,
                        sourceSystem: 'demo',
                        lastInteractionAt: new Date(Date.now() - Math.random() * 10 * 24 * 60 * 60 * 1000) // last 10 days
                    },
                    update: {} // Idempotent: don't overwrite if exists
                });
                createdCount++;
            } catch (e) {
                console.error(`Error seeding contact ${phone}:`, e);
                skippedCount++;
            }
        }

        // --- Create Groups ---
        const groupsData = [
            { name: 'VIP', description: 'Very Important Persons from Demo' },
            { name: 'Leads', description: 'Potential customers from Demo' }
        ];

        let groupsCreatedCount = 0;
        const groupIds: string[] = [];

        for (const g of groupsData) {
            const group = await prisma.group.upsert({
                where: { tenantId_name: { tenantId, name: g.name } },
                create: { ...g, tenantId },
                update: {}
            });
            groupIds.push(group.id);
            groupsCreatedCount++;
        }

        // Assign some contacts to groups
        const contacts = await prisma.contact.findMany({
            where: { tenantId, sourceSystem: 'demo' },
            take: 10
        });

        for (let i = 0; i < contacts.length; i++) {
            const groupId = groupIds[i % groupIds.length];
            await prisma.contactGroup.upsert({
                where: {
                    tenantId_contactId_groupId: {
                        tenantId,
                        contactId: contacts[i].id,
                        groupId
                    }
                },
                create: { tenantId, contactId: contacts[i].id, groupId },
                update: {}
            });
        }

        // --- Create Segments ---
        const segmentsData = [
            {
                name: 'VIP Leads',
                description: 'Segment identifying VIP leads',
                filter: { lifecycleStatus: ['LEAD'], tagsAny: ['vip'] }
            },
            {
                name: 'Inactive Contacts',
                description: 'Contacts marked as inactive',
                filter: { lifecycleStatus: ['INACTIVE'] }
            }
        ];

        let segmentsCreatedCount = 0;
        for (const s of segmentsData) {
            await prisma.savedSegment.upsert({
                where: { tenantId_name: { tenantId, name: s.name } },
                create: { ...s, tenantId },
                update: { filter: s.filter }
            });
            segmentsCreatedCount++;
        }

        return {
            created: createdCount,
            skipped: skippedCount,
            groupsCreated: groupsCreatedCount,
            segmentsCreated: segmentsCreatedCount
        };
    }
}
