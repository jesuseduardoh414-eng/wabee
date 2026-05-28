import { prisma } from '../../../config/core/core.prisma';

export interface ServiceSlot {
    id: string;
    label: string;
    description: string;
    type: 'string' | 'number' | 'date' | 'boolean';
    required: boolean;
    promptText: string;
    isCore?: boolean;
    orderIndex: number;
}

export interface ServiceDefinition {
    id: string;
    tenantId: string;
    slug: string;
    name: string;
    description: string;
    category?: string;
    type: string; // INFORMATIONAL | TRANSACTIONAL | HYBRID
    intentHints: string[];
    slots: ServiceSlot[];
    behaviorConfig: any;
}

/**
 * Carga los servicios disponibles para un tenant específico.
 */
export async function getAvailableServices(tenantId: string): Promise<ServiceDefinition[]> {
    try {
        const services = await prisma.aiService.findMany({
            where: { tenantId, isActive: true },
            include: { slots: { orderBy: { orderIndex: 'asc' } } }
        });

        return services.map(s => {
            return {
                id: s.id,
                tenantId: s.tenantId,
                slug: s.slug,
                name: s.name,
                description: s.description,
                type: s.type as string,
                intentHints: s.intentHints as string[],
                behaviorConfig: s.behaviorConfig,
                slots: s.slots.map(sl => {
                    let mappedType: 'string' | 'number' | 'date' | 'boolean' = 'string';
                    if (sl.type === 'NUMBER') mappedType = 'number';
                    else if (sl.type === 'DATE') mappedType = 'date';
                    else if (sl.type === 'BOOLEAN') mappedType = 'boolean';

                    return {
                        id: sl.key,
                        label: sl.label,
                        description: sl.description || sl.label,
                        type: mappedType,
                        required: sl.required,
                        promptText: sl.promptHint,
                        isCore: sl.isCore,
                        orderIndex: sl.orderIndex
                    };
                })
            };
        });
    } catch (error) {
        console.error(`[ServiceRegistry] Error loading services for tenant ${tenantId}:`, error);
        return [];
    }
}

/**
 * Obtiene un servicio específico por su slug o ID para un tenant.
 */
export async function getService(tenantId: string, identifier: string): Promise<ServiceDefinition | undefined> {
    try {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
        
        const service = await prisma.aiService.findFirst({
            where: {
                tenantId,
                OR: [
                    ...(isUuid ? [{ id: identifier }] : []),
                    { slug: identifier }
                ]
            },
            include: { slots: { orderBy: { orderIndex: 'asc' } } }
        });

        if (!service) return undefined;

        return {
            id: service.id,
            tenantId: service.tenantId,
            slug: service.slug,
            name: service.name,
            description: service.description,
            type: service.type,
            intentHints: service.intentHints as string[],
            behaviorConfig: service.behaviorConfig,
            slots: service.slots.map(sl => {
                let mappedType: 'string' | 'number' | 'date' | 'boolean' = 'string';
                if (sl.type === 'NUMBER') mappedType = 'number';
                else if (sl.type === 'DATE') mappedType = 'date';
                else if (sl.type === 'BOOLEAN') mappedType = 'boolean';

                return {
                    id: sl.key,
                    label: sl.label,
                    description: sl.label,
                    type: mappedType,
                    required: sl.required,
                    promptText: sl.promptHint,
                    isCore: sl.isCore,
                    orderIndex: sl.orderIndex
                };
            })
        };
    } catch (error: any) {
        console.error(`[ServiceRegistry] Error loading service ${identifier}:`, error.message);
        return undefined;
    }
}
