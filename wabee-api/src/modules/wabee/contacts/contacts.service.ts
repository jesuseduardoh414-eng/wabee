import { prisma } from '../../../config/core/core.prisma';
import {
    CreateContactInput,
    UpdateContactInput,
    ContactQueryInput,
    PatchLifecycleInput,
    CreateSegmentInput,
    UpdateSegmentInput,
    ContactLifecycleStatusSchema
} from './contacts.schemas';
// @ts-ignore
import { ContactStatus, ContactLifecycleStatus } from '@prisma/client';
import { LimitsService } from '../../billing/limits.service';

export function normalizePhone(phone: string): string {
    const trimmed = phone.trim();
    const hasPlus = trimmed.startsWith('+');
    const digits = trimmed.replace(/[^\d]/g, '');

    return hasPlus ? `+${digits}` : digits;
}

export class ContactsService {
    // --- CONTACTS ---

    static async getContacts(tenantId: string, query: ContactQueryInput) {
        let {
            search, status, lifecycleStatus, tag, tagsAny, tagsAll,
            groupId, segmentId, page, pageSize, take, limit, skip: providedSkip, offset
        } = query;

        // Unified pagination parameters
        const finalTake = take || limit || pageSize || 50;
        const finalSkip = providedSkip !== undefined ? providedSkip : (offset !== undefined ? offset : (page - 1) * (pageSize || 50));

        // If segmentId is provided, merge segment filters into query
        if (segmentId) {
            const segment = await prisma.savedSegment.findFirst({ where: { id: segmentId, tenantId } });
            if (segment && segment.filter) {
                const filter = segment.filter as any;
                search = search || filter.search;
                status = status || filter.status;
                lifecycleStatus = lifecycleStatus || filter.lifecycleStatus;
                tag = tag || filter.tag;
                tagsAny = tagsAny || filter.tagsAny;
                tagsAll = tagsAll || filter.tagsAll;
                groupId = groupId || filter.groupId;
            }
        }

        const where: any = {
            tenantId,
            ...(status && (status as any) !== '' && { status }),
            ...(lifecycleStatus && (Array.isArray(lifecycleStatus) ? lifecycleStatus.length > 0 : (lifecycleStatus as any) !== '') && {
                lifecycleStatus: Array.isArray(lifecycleStatus)
                    ? { in: lifecycleStatus }
                    : lifecycleStatus
            }),
            ...(search && {
                OR: [
                    { phone: { contains: search } },
                    { name: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } },
                ]
            }),
            ...(groupId && { contactGroups: { some: { groupId } } }),
        };

        // Note: For JSON tags, we'll fetch and filter if tags are needed
        // to avoid complex JSON path queries that might fail in different DBs
        let allItems = await prisma.contact.findMany({
            where,
            orderBy: { updatedAt: 'desc' },
            include: { contactGroups: { include: { group: true } } }
        });

        // Filter by tags in memory if needed (skip if tagsAny/tagsAll is empty array)
        if (tag || (tagsAny && tagsAny.length > 0) || (tagsAll && tagsAll.length > 0)) {
            allItems = allItems.filter((c: any) => {
                const cTags = Array.isArray(c.tags) ? (c.tags as any[]).map((t: any) => String(t).toLowerCase().trim()) : [];

                if (tag && !cTags.includes(tag.toLowerCase().trim())) return false;

                if (tagsAny && tagsAny.length > 0 && !tagsAny.some((t: string) => cTags.includes(t.toLowerCase().trim()))) return false;

                if (tagsAll && !tagsAll.every((t: string) => cTags.includes(t.toLowerCase().trim()))) return false;

                return true;
            });
        }

        const total = allItems.length;
        const items = allItems.slice(finalSkip, finalSkip + finalTake);

        return {
            items,
            meta: {
                total,
                page: Math.floor(finalSkip / finalTake) + 1,
                pageSize: finalTake,
                totalPages: Math.ceil(total / finalTake)
            }
        };
    }

    static async getContactById(tenantId: string, id: string) {
        const contact = await prisma.contact.findFirst({
            where: { id, tenantId },
            include: {
                contactGroups: { include: { group: true } },
                lifecycleEvents: { orderBy: { createdAt: 'desc' } }
            }
        });
        if (!contact) throw { status: 404, message: 'Contact not found' };
        return contact;
    }

    static async createContact(tenantId: string, data: CreateContactInput, limit?: number | null) {
        // 1. Validar módulo/límite (null = bloqueado)
        if (limit === null || limit === undefined) {
             throw { status: 403, message: 'El módulo de contactos no está disponible en tu plan actual.' };
        }

        // 2. Validar capacidad actual (si no es ilimitado -1)
        if (limit !== -1) {
            const currentCount = await LimitsService.countContacts(tenantId);
            if (currentCount >= limit) {
                throw { 
                    status: 403, 
                    message: `Tu plan actual permite hasta ${limit} contactos. Has alcanzado el límite.` 
                };
            }
        }

        const phone = normalizePhone(data.phone);

        // Normalize tags
        const tags = Array.from(new Set((data.tags || []).map(t => t.toLowerCase().trim())));

        try {
            return await prisma.contact.create({
                data: {
                    ...data,
                    tenantId,
                    phone,
                    tags,
                    status: data.status as ContactStatus,
                    lifecycleStatus: data.lifecycleStatus as ContactLifecycleStatus
                }
            });
        } catch (error: any) {
            if (error.code === 'P2002') {
                throw { status: 409, message: 'Contact with this phone number already exists' };
            }
            throw error;
        }
    }

    static async updateContact(tenantId: string, id: string, data: UpdateContactInput) {
        const contact = await this.getContactById(tenantId, id);

        const updateData: any = { ...data };
        if (data.phone) updateData.phone = normalizePhone(data.phone);
        if (data.tags) {
            updateData.tags = Array.from(new Set(data.tags.map(t => t.toLowerCase().trim())));
        }

        return await prisma.contact.update({
            where: { id: contact.id },
            data: updateData
        });
    }

    static async deleteContact(tenantId: string, id: string) {
        const contact = await this.getContactById(tenantId, id);
        // Hard delete with validation (if not assigned to active sessions?)
        // TRD says "delete contact", we'll do hard delete for now.
        return await prisma.contact.delete({
            where: { id: contact.id }
        });
    }

    static async addTags(tenantId: string, id: string, tagsToAdd: string[]) {
        const contact = await this.getContactById(tenantId, id);
        const existingTags = (Array.isArray(contact.tags) ? contact.tags : []) as string[];
        const newTags = Array.from(new Set([
            ...existingTags,
            ...tagsToAdd.map(t => t.toLowerCase().trim())
        ])).slice(0, 100);

        return await prisma.contact.update({
            where: { id: contact.id },
            data: { tags: newTags }
        });
    }

    static async removeTags(tenantId: string, id: string, tagsToRemove: string[]) {
        const contact = await this.getContactById(tenantId, id);
        const existingTags = (Array.isArray(contact.tags) ? contact.tags : []) as string[];
        const normalizedToRemove = tagsToRemove.map(t => t.toLowerCase().trim());
        const newTags = existingTags.filter(t => !normalizedToRemove.includes(t));

        return await prisma.contact.update({
            where: { id: contact.id },
            data: { tags: newTags }
        });
    }

    static async updateLifecycle(tenantId: string, id: string, input: PatchLifecycleInput) {
        const contact = await this.getContactById(tenantId, id);
        const fromStatus = contact.lifecycleStatus;
        const toStatus = input.toStatus as ContactLifecycleStatus;

        if (fromStatus === toStatus) return contact;

        const updateData: any = { lifecycleStatus: toStatus };

        // Regla: toStatus=BLOCKED => status=BLOCKED
        if (toStatus === 'BLOCKED') {
            updateData.status = 'BLOCKED';
        } else if (contact.status === 'BLOCKED') {
            // Si estaba bloqueado y pasamos a otro estado válido, desbloqueamos
            updateData.status = 'ACTIVE';
        }

        const [updatedContact] = await prisma.$transaction([
            prisma.contact.update({
                where: { id: contact.id },
                data: updateData
            }),
            prisma.contactLifecycleEvent.create({
                data: {
                    tenantId,
                    contactId: contact.id,
                    fromStatus,
                    toStatus,
                    actorUserId: input.actorUserId || null,
                    source: input.source || 'manual'
                }
            })
        ]);

        // Trigger CRM sync (fire-and-forget, non-blocking)
        if (toStatus === 'LEAD' || toStatus === 'CUSTOMER') {
            import('../integrations/hubspot/hubspot.sync.service').then(({ hubSpotSyncService }) => {
                hubSpotSyncService.onContactLifecycleChange(contact.id, tenantId, toStatus).catch(
                    (e: Error) => console.error('[HubSpot] onContactLifecycleChange error:', e.message)
                );
            }).catch(() => {/* module not available */});
        }

        return updatedContact;
    }

    // --- FIND OR CREATE (WEBHOOK) ---

    static async findOrCreateByPhone(tenantId: string, rawPhone: string, defaults: Partial<CreateContactInput> = {}) {
        const phone = normalizePhone(rawPhone);

        // Try to find
        let contact = await prisma.contact.findUnique({
            where: { tenantId_phone: { tenantId, phone } }
        });

        if (contact) {
            // Update last interaction
            return await prisma.contact.update({
                where: { id: contact.id },
                data: { lastInteractionAt: new Date() }
            });
        }

        // Create

        // Create
        return await prisma.contact.create({
            data: {
                tenantId,
                phone,
                name: defaults.name || phone,
                sourceSystem: defaults.sourceSystem || 'system',
                lastInteractionAt: new Date(),
                status: 'ACTIVE',
                lifecycleStatus: 'NEW',
                tags: defaults.tags || []
            }
        });
    }

    // --- GROUPS ---

    static async getGroups(tenantId: string) {
        return await prisma.group.findMany({
            where: { tenantId },
            orderBy: { name: 'asc' }
        });
    }

    static async createGroup(tenantId: string, data: { name: string, description?: string | null }) {
        try {
            return await prisma.group.create({
                data: { ...data, tenantId }
            });
        } catch (error: any) {
            if (error.code === 'P2002') throw { status: 409, message: 'Group name already exists' };
            throw error;
        }
    }

    static async addContactsToGroup(tenantId: string, groupId: string, contactIds: string[]) {
        const group = await prisma.group.findFirst({ where: { id: groupId, tenantId } });
        if (!group) throw { status: 404, message: 'Group not found' };

        const operations = contactIds.map(contactId =>
            prisma.contactGroup.upsert({
                where: { tenantId_contactId_groupId: { tenantId, contactId, groupId } },
                create: { tenantId, contactId, groupId },
                update: {}
            })
        );

        return await prisma.$transaction(operations);
    }

    static async removeContactsFromGroup(tenantId: string, groupId: string, contactIds: string[]) {
        return await prisma.contactGroup.deleteMany({
            where: {
                tenantId,
                groupId,
                contactId: { in: contactIds }
            }
        });
    }

    // --- SEGMENTS ---

    static async getSegments(tenantId: string) {
        return await prisma.savedSegment.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'desc' }
        });
    }

    static async createSegment(tenantId: string, data: CreateSegmentInput) {
        return await prisma.savedSegment.create({
            data: {
                tenantId,
                name: data.name,
                description: data.description,
                filter: data.filter as any
            }
        });
    }

    static async updateSegment(tenantId: string, segmentId: string, data: UpdateSegmentInput) {
        const segment = await prisma.savedSegment.findFirst({ where: { id: segmentId, tenantId } });
        if (!segment) throw { status: 404, message: 'Segment not found' };

        return await prisma.savedSegment.update({
            where: { id: segment.id },
            data: {
                ...(data.name && { name: data.name }),
                ...(data.description !== undefined && { description: data.description }),
                ...(data.filter && { filter: data.filter as any })
            }
        });
    }

    static async executeSegment(tenantId: string, segmentId: string, page: number = 1, pageSize: number = 20) {
        const segment = await prisma.savedSegment.findFirst({ where: { id: segmentId, tenantId } });
        if (!segment) throw { status: 404, message: 'Segment not found' };

        const filter = segment.filter as any;

        // Execute using getContacts with the saved filter
        return await this.getContacts(tenantId, {
            ...filter,
            page,
            pageSize
        });
    }

    static async deleteSegment(tenantId: string, segmentId: string) {
        const segment = await prisma.savedSegment.findFirst({ where: { id: segmentId, tenantId } });
        if (!segment) throw { status: 404, message: 'Segment not found' };

        return await prisma.savedSegment.delete({
            where: { id: segment.id }
        });
    }
}
