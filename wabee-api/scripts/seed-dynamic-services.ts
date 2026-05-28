import { prisma, corePrisma } from '../src/config/core/core.prisma';
import { ServiceSlotType, AiServiceIntentType } from '@prisma/client';

async function seed() {
    console.log('--- Seeding Dynamic Services (Compatibility) ---');

    try {
        // Buscar un tenant para aplicar el seed (usando el primero o uno específico)
        const org = await corePrisma.organization.findFirst();
        if (!org) {
            console.error('X No organization found to seed services.');
            return;
        }
        const tenantId = org.id;
        console.log(`> Targeting Tenant: ${org.name} (${tenantId})`);

        // 1. Servicio de Viajes
        const viaje = await prisma.aiService.upsert({
            where: { tenantId_slug: { tenantId, slug: 'viaje' } },
            update: {},
            create: {
                tenantId,
                name: 'Servicio de Viajes',
                slug: 'viaje',
                description: 'Gestión de rutas, boletos y reservas de viaje.',
                category: 'Logística',
                intentHints: [
                    'viaje', 'viajar', 'boleto', 'pasaje', 'ruta', 'camion', 'transporte',
                    'reservar viaje', 'costo del viaje'
                ],
                behaviorConfig: {
                    allowInfoOnly: true,
                    askOneQuestionAtATime: true,
                    allowSoftCollection: true,
                    requireConfirmationForSensitiveActions: false
                }
            }
        });

        const viajeSlots = [
            { key: 'origen', label: 'Origen', type: ServiceSlotType.TEXT, required: true, isCore: true, promptHint: '¿Desde dónde sales?', orderIndex: 1 },
            { key: 'destino', label: 'Destino', type: ServiceSlotType.TEXT, required: true, isCore: true, promptHint: '¿A dónde viajas?', orderIndex: 2 },
            { key: 'fecha', label: 'Fecha', type: ServiceSlotType.DATE, required: true, isCore: false, promptHint: '¿Para qué fecha?', orderIndex: 3 },
            { key: 'pasajeros', label: 'Pasajeros', type: ServiceSlotType.NUMBER, required: true, isCore: false, promptHint: '¿Cuántas personas?', orderIndex: 4 }
        ];

        for (const slot of viajeSlots) {
            await prisma.aiServiceSlot.upsert({
                where: { serviceId_key: { serviceId: viaje.id, key: slot.key } },
                update: slot,
                create: { ...slot, serviceId: viaje.id }
            });
        }
        console.log('✓ Servicio de Viajes configurado.');

        // 2. Servicio de Paquetería
        const paqueteria = await prisma.aiService.upsert({
            where: { tenantId_slug: { tenantId, slug: 'paqueteria' } },
            update: {},
            create: {
                tenantId,
                name: 'Servicio de Paquetería',
                slug: 'paqueteria',
                description: 'Cotización y envío de paquetes o sobres.',
                category: 'Logística',
                intentHints: [
                    'paquete', 'envio', 'mandar', 'enviar', 'paqueteria',
                    'rastrear', 'cotizar', 'caja', 'sobre'
                ],
                behaviorConfig: {
                    allowInfoOnly: true,
                    askOneQuestionAtATime: true,
                    allowSoftCollection: true,
                    requireConfirmationForSensitiveActions: false
                }
            }
        });

        const paqSlots = [
            { key: 'origen', label: 'Origen', type: ServiceSlotType.TEXT, required: true, isCore: true, promptHint: '¿Desde dónde envías?', orderIndex: 1 },
            { key: 'destino', label: 'Destino', type: ServiceSlotType.TEXT, required: true, isCore: true, promptHint: '¿A dónde se dirige?', orderIndex: 2 },
            { key: 'tipo_paquete', label: 'Tipo de Paquete', type: ServiceSlotType.TEXT, required: true, isCore: true, promptHint: '¿Qué vas a enviar?', orderIndex: 3 },
            { key: 'peso', label: 'Peso', type: ServiceSlotType.TEXT, required: true, isCore: false, promptHint: '¿Peso aprox?', orderIndex: 4 }
        ];

        for (const slot of paqSlots) {
            await prisma.aiServiceSlot.upsert({
                where: { serviceId_key: { serviceId: paqueteria.id, key: slot.key } },
                update: slot,
                create: { ...slot, serviceId: paqueteria.id }
            });
        }
        console.log('✓ Servicio de Paquetería configurado.');

        console.log('--- Seed Finished ---');

    } catch (err: any) {
        console.error('X Seed Error:', err.message);
    } finally {
        await prisma.$disconnect();
    }
}

seed();
