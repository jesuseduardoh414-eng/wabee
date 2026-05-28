import { Response, NextFunction } from 'express';
import { GroupSchema, GroupContactsSchema } from './groups.schemas';
import { GroupsService } from './groups.service';
import { tenancyAdapter } from '../_adapters/tenancy.adapter';
import { GlobalAuditLogService } from '@/modules/audit/global-audit-log.service';
import { getAuditContext } from '@/shared/http/request-audit-context';

export async function listGroups(req: any, res: Response, next: NextFunction) {
    try {
        const tenantId = tenancyAdapter.getTenantId(req);
        const groups = await GroupsService.getGroups(tenantId);
        res.json(groups);
    } catch (error) {
        next(error);
    }
}

export async function createGroup(req: any, res: Response, next: NextFunction) {
    let tenantId: string = '';
    try {
        tenantId = tenancyAdapter.getTenantId(req);
        const data = GroupSchema.parse(req.body);
        const group = await GroupsService.createGroup(tenantId, data);

        // Auditoría Global - Éxito
        await GlobalAuditLogService.logEvent({
            category: 'org',
            eventType: 'group.created',
            severity: 'success',
            outcome: 'success',
            message: `Grupo creado: ${group.name}`,
            tenantId,
            targetType: 'group',
            targetId: group.id,
            newValues: group
        }, getAuditContext(req));

        res.status(201).json(group);
    } catch (error: any) {
        // Auditoría Global - Fallo
        await GlobalAuditLogService.logEvent({
            category: 'org',
            eventType: 'group.create_failed',
            severity: 'warning',
            outcome: 'failure',
            message: `Fallo al crear grupo: ${error.message || 'Error desconocido'}`,
            tenantId: tenantId || (req as any).tenantId,
            metadata: { error: error.message, body: req.body }
        }, getAuditContext(req));

        next(error);
    }
}

export async function updateGroup(req: any, res: Response, next: NextFunction) {
    const { id } = req.params;
    let tenantId: string = '';
    try {
        tenantId = tenancyAdapter.getTenantId(req);
        const data = GroupSchema.partial().parse(req.body);
        const group = await GroupsService.updateGroup(tenantId, id, data);

        // Auditoría Global - Éxito
        await GlobalAuditLogService.logEvent({
            category: 'org',
            eventType: 'group.updated',
            severity: 'info',
            outcome: 'success',
            message: `Grupo actualizado: ${group.name}`,
            tenantId,
            targetType: 'group',
            targetId: id,
            newValues: data
        }, getAuditContext(req));

        res.json(group);
    } catch (error: any) {
        // Auditoría Global - Fallo
        await GlobalAuditLogService.logEvent({
            category: 'org',
            eventType: 'group.update_failed',
            severity: 'warning',
            outcome: 'failure',
            message: `Fallo al actualizar grupo ${id}: ${error.message || 'Error desconocido'}`,
            tenantId: tenantId || (req as any).tenantId,
            targetType: 'group',
            targetId: id,
            metadata: { error: error.message, body: req.body }
        }, getAuditContext(req));

        next(error);
    }
}

export async function deleteGroup(req: any, res: Response, next: NextFunction) {
    const { id } = req.params;
    let tenantId: string = '';
    try {
        tenantId = tenancyAdapter.getTenantId(req);
        await GroupsService.deleteGroup(tenantId, id);

        // Auditoría Global - Éxito
        await GlobalAuditLogService.logEvent({
            category: 'org',
            eventType: 'group.deleted',
            severity: 'warning',
            outcome: 'success',
            message: `Grupo eliminado: ${id}`,
            tenantId,
            targetType: 'group',
            targetId: id
        }, getAuditContext(req));

        res.status(204).end();
    } catch (error: any) {
        // Auditoría Global - Fallo
        await GlobalAuditLogService.logEvent({
            category: 'org',
            eventType: 'group.delete_failed',
            severity: 'warning',
            outcome: 'failure',
            message: `Fallo al eliminar grupo ${id}: ${error.message || 'Error desconocido'}`,
            tenantId: tenantId || (req as any).tenantId,
            targetType: 'group',
            targetId: id,
            metadata: { error: error.message }
        }, getAuditContext(req));

        next(error);
    }
}

export async function getGroup(req: any, res: Response, next: NextFunction) {
    try {
        const tenantId = tenancyAdapter.getTenantId(req);
        const { id } = req.params;
        const group = await GroupsService.getGroupById(tenantId, id);
        res.json(group);
    } catch (error) {
        next(error);
    }
}

export async function getGroupContacts(req: any, res: Response, next: NextFunction) {
    try {
        const tenantId = tenancyAdapter.getTenantId(req);
        const { id } = req.params;
        const contacts = await GroupsService.getGroupContacts(tenantId, id);
        res.json(contacts);
    } catch (error) {
        next(error);
    }
}

export async function addContactsToGroup(req: any, res: Response, next: NextFunction) {
    const { id } = req.params;
    try {
        const tenantId = tenancyAdapter.getTenantId(req);
        const { contactIds } = GroupContactsSchema.parse(req.body);
        const result = await GroupsService.addContactsToGroup(tenantId, id, contactIds);

        // Auditoría Global
        await GlobalAuditLogService.logEvent({
            category: 'org',
            eventType: 'group.membership_added',
            severity: 'info',
            outcome: 'success',
            message: `Añadidos ${result.length} contactos al grupo ${id}`,
            tenantId,
            targetType: 'group',
            targetId: id,
            metadata: { count: result.length, contactIds }
        }, getAuditContext(req));

        res.json({ success: true, count: result.length });
    } catch (error) {
        next(error);
    }
}

export async function removeContactsFromGroup(req: any, res: Response, next: NextFunction) {
    const { id } = req.params;
    try {
        const tenantId = tenancyAdapter.getTenantId(req);
        const { contactIds } = GroupContactsSchema.parse(req.body);
        await GroupsService.removeContactsFromGroup(tenantId, id, contactIds);

        // Auditoría Global
        await GlobalAuditLogService.logEvent({
            category: 'org',
            eventType: 'group.membership_removed',
            severity: 'info',
            outcome: 'success',
            message: `Eliminados ${contactIds.length} contactos del grupo ${id}`,
            tenantId,
            targetType: 'group',
            targetId: id,
            metadata: { count: contactIds.length, contactIds }
        }, getAuditContext(req));

        res.json({ success: true });
    } catch (error) {
        next(error);
    }
}
