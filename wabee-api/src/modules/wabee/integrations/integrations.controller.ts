import { Request, Response } from 'express';
import { integrationsService } from './integrations.service';
import { CrmProvider } from '@prisma/client';
import { encrypt } from '../channels/whatsapp/token.crypto';
import { prisma } from '@/lib/prisma';
import { env } from '@/config/env';

const VALID_PROVIDERS = new Set<string>(Object.values(CrmProvider));

export class IntegrationsController {

    static async list(req: Request, res: Response) {
        try {
            const tenantId = (req as any).tenantId;
            res.json(await integrationsService.listIntegrations(tenantId));
        } catch (e: any) { res.status(e.status || 500).json({ error: e.message }); }
    }

    static async get(req: Request, res: Response) {
        try {
            const tenantId = (req as any).tenantId;
            res.json(await integrationsService.getIntegration(tenantId, req.params.id));
        } catch (e: any) { res.status(e.status || 500).json({ error: e.message }); }
    }

    static async create(req: Request, res: Response) {
        try {
            const tenantId = (req as any).tenantId;
            const { provider, name } = req.body;

            if (!provider || !VALID_PROVIDERS.has(provider)) {
                return res.status(400).json({ error: `provider must be one of: ${[...VALID_PROVIDERS].join(', ')}` });
            }
            if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

            const integration = await integrationsService.createIntegration(tenantId, provider as CrmProvider, name.trim());
            res.status(201).json(integration);
        } catch (e: any) { res.status(e.status || 500).json({ error: e.message }); }
    }

    static async remove(req: Request, res: Response) {
        try {
            const tenantId = (req as any).tenantId;
            res.json(await integrationsService.deleteIntegration(tenantId, req.params.id));
        } catch (e: any) { res.status(e.status || 500).json({ error: e.message }); }
    }

    static async upsertMappings(req: Request, res: Response) {
        try {
            const tenantId = (req as any).tenantId;
            const { mappings } = req.body;

            if (!Array.isArray(mappings)) {
                return res.status(400).json({ error: 'mappings must be an array' });
            }

            const result = await integrationsService.upsertFieldMappings(tenantId, req.params.id, mappings);
            res.json(result);
        } catch (e: any) { res.status(e.status || 500).json({ error: e.message }); }
    }

    static async seedCrmAiTools(req: Request, res: Response) {
        try {
            const tenantId  = (req as any).tenantId as string;
            const base      = env.APP_BASE_URL;
            const internalKey = env.CRM_TOOLS_INTERNAL_KEY;

            if (!internalKey) {
                return res.status(503).json({ error: 'CRM_TOOLS_INTERNAL_KEY no configurado en el servidor' });
            }

            // 1. Create or reuse IntegrationCredential for internal key
            const credName = 'wabee-crm-tools-internal';
            let credential = await prisma.integrationCredential.findFirst({
                where: { tenantId, name: credName },
            });
            if (!credential) {
                const encConfig = JSON.stringify(encrypt(internalKey));
                credential = await prisma.integrationCredential.create({
                    data: {
                        tenantId,
                        name:            credName,
                        authType:        'BEARER_TOKEN',
                        encryptedConfig: { token: encConfig },
                    },
                });
            }

            // 2. Upsert the 3 AI tools
            const toolDefs = [
                {
                    name:            'buscar_contacto',
                    displayName:     'Buscar Contacto en CRM',
                    description:     'Busca un contacto por teléfono, nombre o email en Wabee y el CRM conectado.',
                    capability:      'customer_lookup' as const,
                    semanticDescription: 'Usa esta herramienta cuando el usuario o la IA necesiten encontrar información de un contacto existente: historial, estado de lead, email, etc.',
                    endpointUrl:     `${base}/v1/wabee/crm-tools/${tenantId}/buscar-contacto`,
                    parametersSchema: {
                        type: 'object',
                        properties: { query: { type: 'string', description: 'Teléfono, nombre o email del contacto' } },
                        required: ['query'],
                    },
                    exampleUtterances: ['busca al contacto', 'quién es', 'información del cliente', 'tiene cuenta'],
                },
                {
                    name:            'crear_lead',
                    displayName:     'Crear Lead en CRM',
                    description:     'Crea o actualiza un contacto como LEAD en Wabee y lo sincroniza automáticamente con el CRM.',
                    capability:      'lead_create' as const,
                    semanticDescription: 'Usa esta herramienta cuando el usuario muestre intención de compra o solicite información y deba registrarse como lead en el CRM.',
                    endpointUrl:     `${base}/v1/wabee/crm-tools/${tenantId}/crear-lead`,
                    parametersSchema: {
                        type: 'object',
                        properties: {
                            telefono: { type: 'string', description: 'Número de teléfono del lead' },
                            nombre:   { type: 'string', description: 'Nombre del lead (opcional)' },
                            email:    { type: 'string', description: 'Email del lead (opcional)' },
                        },
                        required: ['telefono'],
                    },
                    exampleUtterances: ['registrar lead', 'crear contacto', 'agregar al CRM', 'guardar como prospecto'],
                },
                {
                    name:            'actualizar_oportunidad',
                    displayName:     'Actualizar Oportunidad en CRM',
                    description:     'Crea o actualiza un deal/oportunidad en el CRM conectado (HubSpot, Salesforce, etc.).',
                    capability:      'general_api_fetch' as const,
                    semanticDescription: 'Usa esta herramienta para registrar una oportunidad de venta en el CRM: nombre del deal, etapa y monto estimado.',
                    endpointUrl:     `${base}/v1/wabee/crm-tools/${tenantId}/actualizar-oportunidad`,
                    parametersSchema: {
                        type: 'object',
                        properties: {
                            nombre: { type: 'string', description: 'Nombre de la oportunidad' },
                            etapa:  { type: 'string', description: 'Etapa del deal (ej: Prospecting, Negotiation)' },
                            monto:  { type: 'number', description: 'Monto estimado en USD' },
                            telefonoContacto: { type: 'string', description: 'Teléfono del contacto relacionado' },
                        },
                        required: ['nombre'],
                    },
                    exampleUtterances: ['crear oportunidad', 'registrar venta', 'actualizar deal', 'nueva cotización'],
                },
            ];

            const created: string[] = [];
            const existing: string[] = [];

            for (const def of toolDefs) {
                const current = await prisma.aiTool.findFirst({ where: { tenantId, name: def.name } });
                if (current) { existing.push(def.name); continue; }

                await prisma.aiTool.create({
                    data: {
                        tenantId,
                        credentialId:      credential.id,
                        name:              def.name,
                        displayName:       def.displayName,
                        description:       def.description,
                        capability:        def.capability,
                        semanticDescription: def.semanticDescription,
                        method:            'POST',
                        endpointUrl:       def.endpointUrl,
                        parametersSchema:  def.parametersSchema,
                        exampleUtterances: def.exampleUtterances,
                        safetyFlags:       { canMutateData: true, requiresConfirmation: false, safeToAutoRun: true, idempotent: false, sensitiveOperation: false },
                        confirmationPolicy: 'AUTO',
                        isActive:          true,
                        retries:           1,
                        timeoutMs:         8000,
                    },
                });
                created.push(def.name);
            }

            res.json({
                ok:       true,
                creadas:  created,
                yaExistian: existing,
                mensaje:  created.length > 0
                    ? `${created.length} AI Tools CRM creadas. Ahora asígnalas a tu perfil de IA.`
                    : 'Las AI Tools ya existían.',
            });
        } catch (e: any) {
            res.status(e.status || 500).json({ error: e.message });
        }
    }

    static async connectToken(req: Request, res: Response) {
        try {
            const tenantId = (req as any).tenantId;
            const { token } = req.body;

            if (!token?.trim()) return res.status(400).json({ error: 'token is required' });

            const integration = await integrationsService.getIntegration(tenantId, req.params.id);

            const encryptedToken = JSON.stringify(encrypt(token.trim()));
            await integrationsService.saveAccount({
                integrationId: integration.id,
                tenantId,
                accessToken: encryptedToken,
                scopes: ['crm.objects.contacts.read', 'crm.objects.contacts.write', 'crm.objects.deals.read', 'crm.objects.deals.write'],
                meta: { authMethod: 'service_key' },
            });
            await integrationsService.markConnected(integration.id, 'CONNECTED');

            res.json({ ok: true });
        } catch (e: any) { res.status(e.status || 500).json({ error: e.message }); }
    }

    static async getSyncLogs(req: Request, res: Response) {
        try {
            const tenantId = (req as any).tenantId;
            const limit = Math.min(parseInt(String(req.query.limit || '50')), 200);
            const logs = await integrationsService.listSyncLogs(tenantId, req.params.id, limit);
            res.json(logs);
        } catch (e: any) { res.status(e.status || 500).json({ error: e.message }); }
    }
}
