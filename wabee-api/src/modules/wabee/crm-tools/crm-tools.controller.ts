import { Request, Response } from 'express';
import { prisma } from '@/lib/prisma';
import { env } from '@/config/env';
import { crmSyncService } from '../integrations/crm.sync.service';
import { getProvider } from '../integrations/provider.registry';
import { integrationsService } from '../integrations/integrations.service';
import { decrypt, encrypt } from '../channels/whatsapp/token.crypto';

// Simple internal key guard — this endpoint is called by the AI tool executor
function guardInternalKey(req: Request, res: Response): boolean {
    const auth = req.headers.authorization ?? '';
    const key  = auth.replace('Bearer ', '').trim();
    if (!env.CRM_TOOLS_INTERNAL_KEY || key !== env.CRM_TOOLS_INTERNAL_KEY) {
        res.status(401).json({ error: 'Unauthorized' });
        return false;
    }
    return true;
}

async function getActiveToken(tenantId: string): Promise<{ token: string; provider: string } | null> {
    const integration = await prisma.externalIntegration.findFirst({
        where: { tenantId, status: 'CONNECTED' },
        orderBy: { createdAt: 'desc' },
    });
    if (!integration) return null;

    const account = await integrationsService.getAccount(integration.id, tenantId);
    if (!account) return null;

    try {
        const token = decrypt(JSON.parse(account.accessToken));
        return { token, provider: integration.provider };
    } catch {
        return null;
    }
}

// POST /v1/wabee/crm-tools/:tenantId/buscar-contacto
export async function buscarContacto(req: Request, res: Response) {
    if (!guardInternalKey(req, res)) return;
    try {
        const { tenantId } = req.params;
        const { query } = req.body as { query?: string };

        if (!query) return res.status(400).json({ error: 'query es requerido' });

        // Search in Wabee DB first
        const contacts = await prisma.contact.findMany({
            where: {
                tenantId,
                OR: [
                    { phone: { contains: query } },
                    { name: { contains: query, mode: 'insensitive' } },
                    { email: { contains: query, mode: 'insensitive' } },
                ],
            },
            select: { id: true, name: true, phone: true, email: true, lifecycleStatus: true, externalCrmId: true },
            take: 5,
        });

        if (contacts.length === 0) {
            return res.json({ found: false, message: 'No se encontraron contactos con esa búsqueda.', contacts: [] });
        }

        return res.json({
            found: true,
            count: contacts.length,
            contacts: contacts.map(c => ({
                id:            c.id,
                nombre:        c.name ?? 'Sin nombre',
                telefono:      c.phone,
                email:         c.email,
                estado:        c.lifecycleStatus,
                idCrm:         c.externalCrmId,
            })),
        });
    } catch (err) {
        console.error('[CRM Tool] buscarContacto error:', err);
        res.status(500).json({ error: 'Error interno' });
    }
}

// POST /v1/wabee/crm-tools/:tenantId/crear-lead
export async function crearLead(req: Request, res: Response) {
    if (!guardInternalKey(req, res)) return;
    try {
        const { tenantId } = req.params;
        const { telefono, nombre, email } = req.body as { telefono?: string; nombre?: string; email?: string };

        if (!telefono) return res.status(400).json({ error: 'telefono es requerido' });

        // Find or create contact in Wabee
        let contact = await prisma.contact.findUnique({
            where: { tenantId_phone: { tenantId, phone: telefono } },
        });

        if (!contact) {
            contact = await prisma.contact.create({
                data: {
                    tenantId,
                    phone:           telefono,
                    name:            nombre ?? null,
                    email:           email ?? null,
                    lifecycleStatus: 'LEAD',
                    status:          'ACTIVE',
                    tags:            [],
                },
            });
        } else if (contact.lifecycleStatus !== 'LEAD' && contact.lifecycleStatus !== 'CUSTOMER') {
            contact = await prisma.contact.update({
                where: { id: contact.id },
                data:  { lifecycleStatus: 'LEAD', name: nombre ?? contact.name, email: email ?? contact.email },
            });
        }

        // Trigger CRM sync (fire-and-forget)
        crmSyncService.onContactLifecycleChange(contact.id, tenantId, 'LEAD').catch(
            (e: Error) => console.error('[CRM Tool] crearLead sync error:', e.message)
        );

        return res.json({
            ok:       true,
            mensaje:  `Lead ${nombre ?? telefono} creado y sincronizado con el CRM.`,
            contacto: { id: contact.id, telefono, nombre: contact.name, estado: contact.lifecycleStatus },
        });
    } catch (err) {
        console.error('[CRM Tool] crearLead error:', err);
        res.status(500).json({ error: 'Error interno' });
    }
}

// POST /v1/wabee/crm-tools/:tenantId/actualizar-oportunidad
export async function actualizarOportunidad(req: Request, res: Response) {
    if (!guardInternalKey(req, res)) return;
    try {
        const { tenantId } = req.params;
        const { nombre, etapa, monto, telefonoContacto } = req.body as {
            nombre?:           string;
            etapa?:            string;
            monto?:            number;
            telefonoContacto?: string;
        };

        if (!nombre) return res.status(400).json({ error: 'nombre de la oportunidad es requerido' });

        const tokenInfo = await getActiveToken(tenantId);
        if (!tokenInfo) {
            return res.json({ ok: false, mensaje: 'No hay CRM conectado para este tenant.' });
        }

        const provider = getProvider(tokenInfo.provider);
        if (!provider) {
            return res.json({ ok: false, mensaje: `Proveedor ${tokenInfo.provider} no disponible.` });
        }

        const result = await provider.pushDeal(tokenInfo.token, {
            externalId: '',
            name:       nombre,
            stage:      etapa,
            amount:     monto,
        });

        const integration = await prisma.externalIntegration.findFirst({
            where: { tenantId, status: 'CONNECTED' },
        });
        if (integration) {
            await integrationsService.writeSyncLog(integration.id, tenantId, {
                ...result,
                meta: { nombre, etapa, monto, telefonoContacto },
            });
        }

        return res.json({
            ok:      result.status === 'SUCCESS',
            mensaje: result.status === 'SUCCESS'
                ? `Oportunidad "${nombre}" ${result.operation === 'CREATE' ? 'creada' : 'actualizada'} en ${tokenInfo.provider}.`
                : `Error al actualizar oportunidad: ${result.errorMessage}`,
            idCrm:   result.entityId,
        });
    } catch (err) {
        console.error('[CRM Tool] actualizarOportunidad error:', err);
        res.status(500).json({ error: 'Error interno' });
    }
}
