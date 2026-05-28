import { prisma } from '../../../config/core/core.prisma';
import { CreateGroupInput, UpdateGroupInput } from './groups.schemas';

export class GroupsService {
    static async getGroups(tenantId: string) {
        return await prisma.group.findMany({
            where: { tenantId },
            orderBy: { name: 'asc' },
            include: {
                _count: {
                    select: { contactGroups: true }
                }
            }
        });
    }

    static async getGroupById(tenantId: string, id: string) {
        const group = await prisma.group.findFirst({
            where: { id, tenantId }
        });
        if (!group) throw { status: 404, message: 'Group not found' };
        return group;
    }

    static async createGroup(tenantId: string, data: CreateGroupInput) {
        try {
            return await prisma.group.create({
                data: { ...data, tenantId }
            });
        } catch (error: any) {
            if (error.code === 'P2002') throw { status: 409, message: 'Group name already exists' };
            throw error;
        }
    }

    static async updateGroup(tenantId: string, id: string, data: UpdateGroupInput) {
        await this.getGroupById(tenantId, id);
        return await prisma.group.update({
            where: { id },
            data
        });
    }

    static async deleteGroup(tenantId: string, id: string) {
        await this.getGroupById(tenantId, id);
        return await prisma.group.delete({
            where: { id }
        });
    }

    // --- MEMBERSHIP ---

    static async getGroupContacts(tenantId: string, groupId: string) {
        await this.getGroupById(tenantId, groupId);

        const memberships = await prisma.contactGroup.findMany({
            where: { tenantId, groupId },
            include: { contact: true }
        });

        return memberships.map(m => m.contact);
    }

    static async addContactsToGroup(tenantId: string, groupId: string, contactIds: string[]) {
        await this.getGroupById(tenantId, groupId);

        // Validate that all contacts belong to the same tenant
        const validContacts = await prisma.contact.findMany({
            where: {
                id: { in: contactIds },
                tenantId
            },
            select: { id: true }
        });

        if (validContacts.length !== contactIds.length) {
            throw { status: 400, message: 'One or more contacts not found or belong to another tenant' };
        }

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
        await this.getGroupById(tenantId, groupId);

        return await prisma.contactGroup.deleteMany({
            where: {
                tenantId,
                groupId,
                contactId: { in: contactIds }
            }
        });
    }
}
