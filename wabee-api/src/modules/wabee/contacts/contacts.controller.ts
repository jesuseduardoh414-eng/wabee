import { Response, NextFunction } from 'express';
import {
    CreateContactSchema,
    UpdateContactSchema,
    ContactQuerySchema,
    PatchLifecycleSchema,
    TagsActionSchema,
    GroupSchema,
    GroupContactsSchema,
    SavedSegmentSchema,
    UpdateSegmentSchema
} from './contacts.schemas';
import { ContactsService } from './contacts.service';
import { DemoSeedService } from './demoSeed.service';
import { tenancyAdapter } from '../_adapters/tenancy.adapter';
import { GlobalAuditLogService } from '@/modules/audit/global-audit-log.service';
import { getAuditContext } from '@/shared/http/request-audit-context';

export async function listContacts(req: any, res: Response, next: NextFunction) {
    try {
        const tenantId = tenancyAdapter.getTenantId(req);
        const query = ContactQuerySchema.parse(req.query);
        const result = await ContactsService.getContacts(tenantId, query);

        // Backward compatibility: If ?shape=array is requested, return items array
        if (req.query.shape === 'array') {
            res.setHeader('X-Deprecated', 'Shape=array is deprecated. Move to { items, meta } structure.');
            return res.json(result.items);
        }

        res.json(result);
    } catch (error) {
        next(error);
    }
}

export async function getContact(req: any, res: Response, next: NextFunction) {
    try {
        const tenantId = tenancyAdapter.getTenantId(req);
        const { id } = req.params;
        const contact = await ContactsService.getContactById(tenantId, id);
        res.json(contact);
    } catch (error) {
        next(error);
    }
}

export async function createContact(req: any, res: Response, next: NextFunction) {
    let tenantId: string = '';
    try {
        tenantId = tenancyAdapter.getTenantId(req);
        const data = CreateContactSchema.parse(req.body);
        
        // Extraer límite del plan inyectado por el middleware
        const contactLimit = req.orgPlan?.limits?.contacts;

        const contact = await ContactsService.createContact(tenantId, data, contactLimit);

        // Auditoría Global - Éxito
        await GlobalAuditLogService.logEvent({
            category: 'org',
            eventType: 'contact.created',
            severity: 'success',
            outcome: 'success',
            message: `Contacto creado: ${contact.name || contact.phone}`,
            tenantId,
            targetType: 'contact',
            targetId: contact.id,
            newValues: contact
        }, getAuditContext(req));

        res.status(201).json(contact);
    } catch (error: any) {
        // Auditoría Global - Fallo
        await GlobalAuditLogService.logEvent({
            category: 'org',
            eventType: 'contact.create_failed',
            severity: 'warning',
            outcome: 'failure',
            message: `Fallo al crear contacto: ${error.message || 'Error de validación'}`,
            tenantId: tenantId || (req as any).tenantId,
            metadata: { error: error.message, body: req.body }
        }, getAuditContext(req));

        if (error instanceof Error && error.name === 'ZodError') {
            return res.status(400).json({
                message: 'Validation failed',
                errors: (error as any).errors
            });
        }
        next(error);
    }
}

export async function updateContact(req: any, res: Response, next: NextFunction) {
    const { id } = req.params;
    let tenantId: string = '';
    try {
        tenantId = tenancyAdapter.getTenantId(req);
        const data = UpdateContactSchema.parse(req.body);
        const contact = await ContactsService.updateContact(tenantId, id, data);

        // Auditoría Global - Éxito
        await GlobalAuditLogService.logEvent({
            category: 'org',
            eventType: 'contact.updated',
            severity: 'info',
            outcome: 'success',
            message: `Contacto actualizado: ${contact.name || contact.phone}`,
            tenantId,
            targetType: 'contact',
            targetId: contact.id,
            newValues: data
        }, getAuditContext(req));

        res.json(contact);
    } catch (error: any) {
        // Auditoría Global - Fallo
        await GlobalAuditLogService.logEvent({
            category: 'org',
            eventType: 'contact.update_failed',
            severity: 'warning',
            outcome: 'failure',
            message: `Fallo al actualizar contacto ${id}: ${error.message || 'Error desconocido'}`,
            tenantId: tenantId || (req as any).tenantId,
            targetType: 'contact',
            targetId: id,
            metadata: { error: error.message, body: req.body }
        }, getAuditContext(req));

        next(error);
    }
}

export async function deleteContact(req: any, res: Response, next: NextFunction) {
    const { id } = req.params;
    let tenantId: string = '';
    try {
        tenantId = tenancyAdapter.getTenantId(req);
        await ContactsService.deleteContact(tenantId, id);

        // Auditoría Global - Éxito
        await GlobalAuditLogService.logEvent({
            category: 'org',
            eventType: 'contact.deleted',
            severity: 'warning',
            outcome: 'success',
            message: `Contacto eliminado: ${id}`,
            tenantId,
            targetType: 'contact',
            targetId: id
        }, getAuditContext(req));

        res.status(204).end();
    } catch (error: any) {
        // Auditoría Global - Fallo
        await GlobalAuditLogService.logEvent({
            category: 'org',
            eventType: 'contact.delete_failed',
            severity: 'warning',
            outcome: 'failure',
            message: `Fallo al eliminar contacto ${id}: ${error.message || 'Error desconocido'}`,
            tenantId: tenantId || (req as any).tenantId,
            targetType: 'contact',
            targetId: id,
            metadata: { error: error.message }
        }, getAuditContext(req));

        next(error);
    }
}

export async function addTags(req: any, res: Response, next: NextFunction) {
    const { id } = req.params;
    try {
        const tenantId = tenancyAdapter.getTenantId(req);
        const { tags } = TagsActionSchema.parse(req.body);
        const contact = await ContactsService.addTags(tenantId, id, tags);

        // Auditoría Global
        await GlobalAuditLogService.logEvent({
            category: 'org',
            eventType: 'contact.tags_added',
            severity: 'info',
            outcome: 'success',
            message: `Etiquetas añadidas al contacto ${id}: ${tags.join(', ')}`,
            tenantId,
            targetType: 'contact',
            targetId: id,
            metadata: { tags }
        }, getAuditContext(req));

        res.json(contact);
    } catch (error) {
        next(error);
    }
}

export async function removeTags(req: any, res: Response, next: NextFunction) {
    const { id } = req.params;
    try {
        const tenantId = tenancyAdapter.getTenantId(req);
        const { tags } = TagsActionSchema.parse(req.body);
        const contact = await ContactsService.removeTags(tenantId, id, tags);

        // Auditoría Global
        await GlobalAuditLogService.logEvent({
            category: 'org',
            eventType: 'contact.tags_removed',
            severity: 'info',
            outcome: 'success',
            message: `Etiquetas eliminadas del contacto ${id}: ${tags.join(', ')}`,
            tenantId,
            targetType: 'contact',
            targetId: id,
            metadata: { tags }
        }, getAuditContext(req));

        res.json(contact);
    } catch (error) {
        next(error);
    }
}

export async function patchLifecycle(req: any, res: Response, next: NextFunction) {
    const { id } = req.params;
    try {
        const tenantId = tenancyAdapter.getTenantId(req);
        const data = PatchLifecycleSchema.parse(req.body);
        const contact = await ContactsService.updateLifecycle(tenantId, id, data);

        // Auditoría Global
        await GlobalAuditLogService.logEvent({
            category: 'org',
            eventType: 'contact.lifecycle_updated',
            severity: 'info',
            outcome: 'success',
            message: `Ciclo de vida actualizado para contacto ${id}: ${data.toStatus}`,
            tenantId,
            targetType: 'contact',
            targetId: id,
            newValues: { lifecycleStatus: data.toStatus }
        }, getAuditContext(req));

        res.json(contact);
    } catch (error) {
        next(error);
    }
}

// --- GROUPS ---

export async function listGroups(req: any, res: Response, next: NextFunction) {
    try {
        const tenantId = tenancyAdapter.getTenantId(req);
        const groups = await ContactsService.getGroups(tenantId);
        res.json(groups);
    } catch (error) {
        next(error);
    }
}

export async function createGroup(req: any, res: Response, next: NextFunction) {
    try {
        const tenantId = tenancyAdapter.getTenantId(req);
        const data = GroupSchema.parse(req.body);
        const group = await ContactsService.createGroup(tenantId, data);
        res.status(201).json(group);
    } catch (error) {
        next(error);
    }
}

export async function addContactsToGroup(req: any, res: Response, next: NextFunction) {
    try {
        const tenantId = tenancyAdapter.getTenantId(req);
        const { id } = req.params;
        const { contactIds } = GroupContactsSchema.parse(req.body);
        const result = await ContactsService.addContactsToGroup(tenantId, id, contactIds);
        res.json({ success: true, count: result.length });
    } catch (error) {
        next(error);
    }
}

export async function removeContactsFromGroup(req: any, res: Response, next: NextFunction) {
    try {
        const tenantId = tenancyAdapter.getTenantId(req);
        const { id } = req.params;
        const { contactIds } = GroupContactsSchema.parse(req.body);
        await ContactsService.removeContactsFromGroup(tenantId, id, contactIds);
        res.json({ success: true });
    } catch (error) {
        next(error);
    }
}

// --- SEGMENTS ---

export async function listSegments(req: any, res: Response, next: NextFunction) {
    try {
        const tenantId = tenancyAdapter.getTenantId(req);
        const segments = await ContactsService.getSegments(tenantId);
        res.json(segments);
    } catch (error) {
        next(error);
    }
}

export async function createSegment(req: any, res: Response, next: NextFunction) {
    let tenantId: string = '';
    try {
        tenantId = tenancyAdapter.getTenantId(req);
        const data = SavedSegmentSchema.parse(req.body);
        const segment = await ContactsService.createSegment(tenantId, data);

        // Auditoría Global
        await GlobalAuditLogService.logEvent({
            category: 'org',
            eventType: 'segment.created',
            severity: 'success',
            outcome: 'success',
            message: `Segmento creado: ${segment.name}`,
            tenantId,
            targetType: 'segment',
            targetId: segment.id,
            newValues: segment
        }, getAuditContext(req));

        res.status(201).json(segment);
    } catch (error: any) {
        next(error);
    }
}

export async function updateSegment(req: any, res: Response, next: NextFunction) {
    const { id } = req.params;
    try {
        const tenantId = tenancyAdapter.getTenantId(req);
        const data = UpdateSegmentSchema.parse(req.body);
        const segment = await ContactsService.updateSegment(tenantId, id, data);

        // Auditoría Global
        await GlobalAuditLogService.logEvent({
            category: 'org',
            eventType: 'segment.updated',
            severity: 'info',
            outcome: 'success',
            message: `Segmento actualizado: ${segment.name}`,
            tenantId,
            targetType: 'segment',
            targetId: segment.id,
            newValues: data
        }, getAuditContext(req));

        res.json(segment);
    } catch (error) {
        next(error);
    }
}

export async function executeSegment(req: any, res: Response, next: NextFunction) {
    try {
        const tenantId = tenancyAdapter.getTenantId(req);
        const { id } = req.params;
        const { page, pageSize } = req.query;
        const result = await ContactsService.executeSegment(
            tenantId,
            id,
            Number(page || 1),
            Number(pageSize || 20)
        );
        res.json(result);
    } catch (error) {
        next(error);
    }
}

export async function deleteSegment(req: any, res: Response, next: NextFunction) {
    const { id } = req.params;
    try {
        const tenantId = tenancyAdapter.getTenantId(req);
        await ContactsService.deleteSegment(tenantId, id);

        // Auditoría Global
        await GlobalAuditLogService.logEvent({
            category: 'org',
            eventType: 'segment.deleted',
            severity: 'warning',
            outcome: 'success',
            message: `Segmento eliminado: ${id}`,
            tenantId,
            targetType: 'segment',
            targetId: id
        }, getAuditContext(req));

        res.status(204).end();
    } catch (error) {
        next(error);
    }
}

// --- DEMO ---

export async function demoSeed(req: any, res: Response, next: NextFunction) {
    try {
        const tenantId = tenancyAdapter.getTenantId(req);
        const result = await DemoSeedService.seedDemoContacts(tenantId);
        res.status(201).json(result);
    } catch (error) {
        next(error);
    }
}

// --- IMPORT ---

export async function importContacts(req: any, res: Response, next: NextFunction) {
    let tenantId: string = '';
    try {
        tenantId = tenancyAdapter.getTenantId(req);
        if (!req.file) throw { status: 400, message: 'CSV file is required' };

        const { ContactsImportService } = await import('./contacts.import.service');
        
        // Extraer límite del plan
        const contactLimit = req.orgPlan?.limits?.contacts;

        const result = await ContactsImportService.processImport(tenantId, req.file.buffer, contactLimit);

        const totalImported = result.created + result.updated;
        await GlobalAuditLogService.logEvent({
            category: 'org',
            eventType: 'contact.imported',
            severity: 'success',
            outcome: 'success',
            message: `Importación masiva completada: ${totalImported} contactos (${result.created} creados, ${result.updated} actualizados).`,
            tenantId,
            metadata: { result }
        }, getAuditContext(req));

        res.status(200).json(result);
    } catch (error: any) {
        // Auditoría Global - Fallo
        await GlobalAuditLogService.logEvent({
            category: 'org',
            eventType: 'contact.import_failed',
            severity: 'critical',
            outcome: 'failure',
            message: `Fallo en la importación masiva: ${error.message || 'Error técnico'}`,
            tenantId: tenantId || (req as any).tenantId,
            metadata: { error: error.message }
        }, getAuditContext(req));

        next(error);
    }
}
