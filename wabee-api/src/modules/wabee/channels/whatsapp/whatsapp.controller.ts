import { Request, Response } from 'express';
import { prisma } from '../../../../config/core/core.prisma';
import { CreateWhatsAppChannelSchema, TestMessageSchema, EmbeddedSignupSchema } from './whatsapp.schemas';
import { exchangeEmbeddedSignupCode, registerCoexistenceChannel } from '@/modules/oauth/meta/meta.oauth.service';
import { decrypt } from './token.crypto';
import { graphGet } from './meta.graph.client';
import { tenancyAdapter } from '../../_adapters/tenancy.adapter';
import { GlobalAuditLogService } from '@/modules/audit/global-audit-log.service';
import { getAuditContext } from '@/shared/http/request-audit-context';

// POST /
export const createChannel = async (req: Request, res: Response) => {
    const auditCtx = getAuditContext(req);
    try {
        const tenantId = tenancyAdapter.getTenantId(req);
        const validation = CreateWhatsAppChannelSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({ error: validation.error.errors });
        }

        const { name, purpose, wabaId, phoneNumberId, displayPhone, verifiedName } = validation.data;

        // --- ENFORCEMENT CHECK ---
        const plan = (req as any).orgPlan;
        const limit = plan?.limits?.channels ?? null;

        if (limit !== -1) {
            // Solo cuentan los canales activos (no archivados), consistente con LimitsService.countChannels.
            const currentCount = await prisma.whatsappChannel.count({
                where: { tenantId, archivedAt: null }
            });

            if (limit === null || currentCount >= limit) {
                await GlobalAuditLogService.logEvent({
                    category: 'channels',
                    eventType: 'channel.limit_reached',
                    severity: 'warning',
                    outcome: 'failure',
                    message: `Intento de conexión fallido: Límite de canales alcanzado (${limit})`,
                    metadata: { tenantId, limit, currentCount }
                }, auditCtx);

                return res.status(403).json({ 
                    error: 'CHANNEL_LIMIT_REACHED', 
                    message: `Has alcanzado el límite de ${limit} canales de tu plan. Elimina uno para conectar un nuevo número.` 
                });
            }
        }

        const existing = await prisma.whatsappChannel.findFirst({
            where: { tenantId, phoneNumberId }
        });

        if (existing && existing.status !== 'ARCHIVED') {
            return res.status(409).json({ error: 'Channel with this Phone Number ID already exists' });
        }

        // Si existe pero está archivado, reactivarlo en vez de crear uno nuevo
        const channel = existing?.status === 'ARCHIVED'
            ? await prisma.whatsappChannel.update({
                where: { id: existing.id },
                data: {
                    name,
                    purpose,
                    wabaId,
                    displayPhone: displayPhone || '',
                    verifiedName: verifiedName || '',
                    status: 'CONNECTED',
                    archivedAt: null,
                    healthStatus: 'UNKNOWN',
                    lastErrorMessage: null,
                }
              })
            : await prisma.whatsappChannel.create({
                data: {
                    tenantId,
                    name,
                    purpose,
                    wabaId,
                    phoneNumberId,
                    displayPhone: displayPhone || '',
                    verifiedName: verifiedName || '',
                    status: 'CONNECTED',
                }
              });

        await GlobalAuditLogService.logEvent({
            category: 'channels',
            eventType: 'channel.create',
            severity: 'success',
            outcome: 'success',
            message: `Canal de WhatsApp conectado: ${name} (${displayPhone})`,
            targetType: 'whatsapp_channel',
            targetId: channel.id,
            newValues: { name, phoneNumberId, displayPhone }
        }, auditCtx);

        return res.status(201).json(channel);
    } catch (error: any) {
        console.error('Error creating channel:', error);
        await GlobalAuditLogService.logEvent({
            category: 'channels',
            eventType: 'channel.create.failed',
            severity: 'critical',
            outcome: 'failure',
            message: `Error fatal al conectar canal: ${error.message}`,
            metadata: { body: req.body, error: error.message }
        }, auditCtx);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

// POST /manual
export const createManualChannel = async (req: Request, res: Response) => {
    // For now, same as createChannel logic but might differ in validation/auth later
    return createChannel(req, res);
};


// POST /embedded-signup
// Canjea el código de Embedded Signup (Meta) y registra el canal.
// Soporta onboardingMode = COEXISTENCE (la app del cliente sigue activa) o STANDARD.
export const embeddedSignup = async (req: Request, res: Response) => {
    const auditCtx = getAuditContext(req);
    try {
        const tenantId = tenancyAdapter.getTenantId(req);
        const validation = EmbeddedSignupSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({ error: validation.error.errors });
        }

        const { code, wabaId, phoneNumberId, onboardingMode, name } = validation.data;

        // --- ENFORCEMENT CHECK (mismo criterio que createChannel) ---
        const plan = (req as any).orgPlan;
        const limit = plan?.limits?.channels ?? null;

        if (limit !== -1) {
            // Solo cuenta como nuevo si el número aún no existe para el tenant.
            const existing = await prisma.whatsappChannel.findFirst({
                where: { tenantId, phoneNumberId }
            });
            if (!existing) {
                // Solo cuentan los canales activos (no archivados), consistente con LimitsService.countChannels.
                const currentCount = await prisma.whatsappChannel.count({ where: { tenantId, archivedAt: null } });
                if (limit === null || currentCount >= limit) {
                    await GlobalAuditLogService.logEvent({
                        category: 'channels',
                        eventType: 'channel.limit_reached',
                        severity: 'warning',
                        outcome: 'failure',
                        message: `Intento de conexión (Embedded Signup) fallido: Límite de canales alcanzado (${limit})`,
                        metadata: { tenantId, limit, currentCount }
                    }, auditCtx);

                    return res.status(403).json({
                        error: 'CHANNEL_LIMIT_REACHED',
                        message: `Has alcanzado el límite de ${limit} canales de tu plan. Elimina uno para conectar un nuevo número.`
                    });
                }
            }
        }

        // 1. Canjear código por token y crear sesión Meta.
        const { session, accessToken } = await exchangeEmbeddedSignupCode(code, tenantId);

        // 2. Registrar/reactivar el canal con su modo de onboarding.
        const channel = await registerCoexistenceChannel({
            tenantId,
            sessionId: session.id,
            accessToken,
            wabaId,
            phoneNumberId,
            onboardingMode,
            name,
        });

        await GlobalAuditLogService.logEvent({
            category: 'channels',
            eventType: 'channel.create',
            severity: 'success',
            outcome: 'success',
            message: `Canal conectado vía Embedded Signup (${onboardingMode}): ${channel.name} (${channel.displayPhone || phoneNumberId})`,
            targetType: 'whatsapp_channel',
            targetId: channel.id,
            newValues: { name: channel.name, phoneNumberId, wabaId, onboardingMode }
        }, auditCtx);

        return res.status(201).json(channel);
    } catch (error: any) {
        const metaError = error.response?.data?.error;
        console.error('Error en Embedded Signup:', metaError || error.message);
        await GlobalAuditLogService.logEvent({
            category: 'channels',
            eventType: 'channel.create.failed',
            severity: 'critical',
            outcome: 'failure',
            message: `Error en Embedded Signup: ${metaError?.message || error.message}`,
            metadata: { body: { ...req.body, code: '[redacted]' }, error: metaError?.message || error.message }
        }, auditCtx);
        return res.status(502).json({
            code: 'EMBEDDED_SIGNUP_FAILED',
            message: metaError?.message || 'No se pudo completar la conexión con Meta.',
            metaCode: metaError?.code,
        });
    }
};

// POST /detect
export const discoverAssets = async (req: Request, res: Response) => {
    const tenantId = tenancyAdapter.getTenantId(req);
    const auditCtx = getAuditContext(req);
    console.log(`[Discovery] Starting hierarchical discovery for tenant: ${tenantId}`);

    try {
        // 1. Get latest Meta OAuth session
        const session = await prisma.metaOauthSession.findFirst({
            where: { tenantId, provider: 'META' },
            orderBy: { updatedAt: 'desc' }
        });

        if (!session) {
            console.log(`[Discovery] No session found for tenant: ${tenantId}`);
            return res.status(400).json({
                code: 'NO_META_SESSION',
                message: 'Conecta con Facebook primero.',
                hint: 'Ve a la configuración de canales y usa el botón "Conectar con Facebook".'
            });
        }

        const maskedToken = `...${session.accessTokenCiphertext.slice(-6)}`;
        console.log(`[Discovery] Using session: ${session.id}, masked cipher: ${maskedToken}`);

        // Check expiry
        if (session.tokenExpiresAt && new Date() > session.tokenExpiresAt) {
            console.log(`[Discovery] Token expired for session: ${session.id}`);
            return res.status(401).json({
                code: 'META_TOKEN_EXPIRED',
                message: 'La sesión de Meta ha expirado.',
                hint: 'Por favor, vuelve a conectar con Facebook para renovar los permisos.'
            });
        }

        // 2. Decrypt token
        let accessToken: string;
        try {
            accessToken = decrypt({
                ciphertext: session.accessTokenCiphertext,
                iv: session.accessTokenIv,
                tag: session.accessTokenTag
            });
        } catch (err) {
            console.error(`[Discovery] Decryption failed for session: ${session.id}`, err);
            return res.status(401).json({
                code: 'TOKEN_DECRYPTION_FAILED',
                message: 'Error al procesar las credenciales de Meta.',
                hint: 'Intenta conectar con Facebook de nuevo.'
            });
        }

        const assets: any[] = [];
        try {
            // STEP A: Get Businesses
            console.log(`[Discovery] Fetching businesses...`);
            const bizResponse = await graphGet('/me/businesses', accessToken);
            const businesses = bizResponse.data || [];
            console.log(`[Discovery] Found ${businesses.length} businesses.`);

            for (const biz of businesses) {
                console.log(`[Discovery] Fetching WABAs for business: ${biz.name} (${biz.id})`);

                // STEP B: Get WABAs for this business
                const wabaResponse = await graphGet(`/${biz.id}/owned_whatsapp_business_accounts`, accessToken);
                const wabas = wabaResponse.data || [];
                console.log(`[Discovery] Found ${wabas.length} WABAs for business ${biz.id}`);

                for (const waba of wabas) {
                    console.log(`[Discovery] Fetching phone numbers for WABA: ${waba.name} (${waba.id})`);

                    // STEP C: Get Phone Numbers for this WABA
                    const phoneResponse = await graphGet(`/${waba.id}/phone_numbers`, accessToken, {
                        fields: 'id,display_phone_number,verified_name,status,code_verification_status'
                    });

                    const phoneNumbers = phoneResponse.data || [];
                    for (const phone of phoneNumbers) {
                        assets.push({
                            businessId: biz.id,
                            businessName: biz.name,
                            wabaId: waba.id,
                            wabaName: waba.name,
                            phoneNumberId: phone.id,
                            displayPhoneNumber: phone.display_phone_number,
                            verifiedName: phone.verified_name,
                            status: phone.status
                        });
                    }
                }
            }

            // Fallback: If no businesses found, maybe they have WABAs directly associated? (Less common for Cloud API)
            if (businesses.length === 0) {
                console.log(`[Discovery] No businesses found, trying direct WABA access...`);
                try {
                    const directWabaResponse = await graphGet('/me/whatsapp_business_accounts', accessToken);
                    const directWabas = directWabaResponse.data || [];
                    for (const waba of directWabas) {
                        const phoneResponse = await graphGet(`/${waba.id}/phone_numbers`, accessToken, {
                            fields: 'id,display_phone_number,verified_name,status'
                        });
                        const phoneNumbers = phoneResponse.data || [];
                        for (const phone of phoneNumbers) {
                            assets.push({
                                wabaId: waba.id,
                                wabaName: waba.name,
                                phoneNumberId: phone.id,
                                displayPhoneNumber: phone.display_phone_number,
                                verifiedName: phone.verified_name,
                                status: phone.status
                            });
                        }
                    }
                } catch (e: any) {
                    console.log(`[Discovery] Direct WABA access failed: ${e.message}`);
                }
            }

        } catch (error: any) {
            const metaStatus = error.response?.status;
            const metaError = error.response?.data?.error || {};
            const fbtraceId = error.response?.headers?.['x-fb-trace-id'];

            console.error(`[Discovery] Meta API Error (${metaStatus}):`, metaError);

            if (metaStatus === 401 || metaError.code === 190) {
                return res.status(401).json({
                    code: 'TOKEN_INVALID',
                    metaCode: metaError.code,
                    metaMessage: metaError.message,
                    hint: 'El token ya no es válido. Re-conecta con Facebook.',
                    fbtraceId
                });
            }
            if (metaStatus === 403 || metaError.code === 200) {
                return res.status(403).json({
                    code: 'INSUFFICIENT_PERMISSIONS',
                    metaCode: metaError.code,
                    metaMessage: metaError.message,
                    hint: 'Asegúrate de haber aceptado todos los permisos (Manage Business, WhatsApp Management).',
                    fbtraceId
                });
            }
            if (metaError.code === 100) {
                return res.status(400).json({
                    code: 'META_API_ERROR',
                    metaCode: 100,
                    metaMessage: metaError.message,
                    hint: 'Error de estructura en Graph API. Verifica la configuración del App.',
                    fbtraceId
                });
            }

            throw error; // Let the outer catch handle unexpected errors
        }

        if (assets.length === 0) {
            await GlobalAuditLogService.logEvent({
                category: 'channels',
                eventType: 'channel.discover.empty',
                severity: 'info',
                outcome: 'success',
                message: 'Descubrimiento de activos Meta finalizado sin resultados.',
                metadata: { tenantId }
            }, auditCtx);
            return res.json({
                message: 'No se encontraron WhatsApp Business Accounts o números de teléfono en tus cuentas comerciales.',
                assets: []
            });
        }

        await GlobalAuditLogService.logEvent({
            category: 'channels',
            eventType: 'channel.discover.success',
            severity: 'success',
            outcome: 'success',
            message: `Descubrimiento de activos Meta finalizado: ${assets.length} números encontrados.`,
            metadata: { tenantId, assetCount: assets.length }
        }, auditCtx);

        return res.json({ message: 'ok', assets });
    } catch (error: any) {
        const fbtraceId = error.response?.headers?.['x-fb-trace-id'];
        console.error(`[Discovery] Unexpected error for tenant ${tenantId}:`, error);

        await GlobalAuditLogService.logEvent({
            category: 'channels',
            eventType: 'channel.discover.failed',
            severity: 'critical',
            outcome: 'failure',
            message: `Error inesperado en descubrimiento de Meta: ${error.message}`,
            metadata: { tenantId, error: error.message, fbtraceId }
        }, auditCtx);

        return res.status(502).json({
            code: 'META_API_ERROR',
            message: 'Error de comunicación con Meta',
            metaCode: error.response?.data?.error?.code,
            metaMessage: error.response?.data?.error?.message || error.message,
            fbtraceId,
            hint: 'Esto puede ser un problema temporal de Meta o de configuración del App ID.'
        });
    }
};

// GET /
export const listChannels = async (req: Request, res: Response) => {
    try {
        const tenantId = tenancyAdapter.getTenantId(req);
        const { status, includeArchived } = req.query;

        const whereClause: any = { tenantId };

        if (status) {
            whereClause.status = status as any;
        } else if (includeArchived !== 'true') {
            // Exclude ARCHIVED by default
            whereClause.status = { not: 'ARCHIVED' };
        }

        const channels = await prisma.whatsappChannel.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                name: true,
                phoneNumberId: true,
                displayPhone: true,
                status: true,
                healthStatus: true,
                lastHealthCheckAt: true,
                lastErrorMessage: true,
                webhookStatus: true,
                purpose: true,
                wabaId: true,
                onboardingMode: true,
                archivedAt: true,
                createdAt: true
            }
        });

        return res.json(channels);
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
};

// DELETE /:id
export const archiveChannel = async (req: Request, res: Response) => {
    const auditCtx = getAuditContext(req);
    try {
        const tenantId = tenancyAdapter.getTenantId(req);
        const { id } = req.params as { id: string };

        const channel = await prisma.whatsappChannel.findFirst({
            where: { id, tenantId }
        });

        if (!channel) {
            return res.status(404).json({ error: 'Channel not found' });
        }

        // Idempotency: if already archived
        if (channel.status === 'ARCHIVED') {
            return res.json({ ok: true, channelId: id, status: 'ARCHIVED' });
        }

        await prisma.whatsappChannel.update({
            where: { id },
            data: {
                status: 'ARCHIVED',
                archivedAt: new Date()
            }
        });

        await GlobalAuditLogService.logEvent({
            category: 'channels',
            eventType: 'channel.archive',
            severity: 'warning',
            outcome: 'success',
            message: `Canal de WhatsApp archivado: ${channel.name} (${channel.displayPhone})`,
            targetType: 'whatsapp_channel',
            targetId: id
        }, auditCtx);

        return res.json({ ok: true, channelId: id, status: 'ARCHIVED' });
    } catch (error: any) {
        console.error('Error archiving channel:', error);
        await GlobalAuditLogService.logEvent({
            category: 'channels',
            eventType: 'channel.archive.failed',
            severity: 'critical',
            outcome: 'failure',
            message: `Error fatal al archivar canal (${req.params.id}): ${error.message}`,
            targetType: 'whatsapp_channel',
            targetId: req.params.id
        }, auditCtx);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

// POST /:id/test-message
export const testMessage = async (req: Request, res: Response) => {
    const auditCtx = getAuditContext(req);
    try {
        const validation = TestMessageSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({ error: validation.error.errors });
        }

        await GlobalAuditLogService.logEvent({
            category: 'channels',
            eventType: 'channel.test_message',
            severity: 'info',
            outcome: 'success',
            message: `Prueba de envío de mensaje iniciada para el canal ${req.params.id}`,
            targetType: 'whatsapp_channel',
            targetId: req.params.id,
            metadata: { ...req.body }
        }, auditCtx);

        // Mock sending message
        return res.json({ success: true, message: 'Test message queued' });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
};

// GET /:id/health
export const getChannelHealth = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const channel = await prisma.whatsappChannel.findUnique({
            where: { id }
        });

        if (!channel) return res.status(404).json({ error: 'Channel not found' });

        return res.json({
            id: channel.id,
            name: channel.name,
            status: channel.status,
            healthStatus: channel.healthStatus,
            health: channel.healthStatus,
            lastHealthCheckAt: channel.lastHealthCheckAt,
            lastCheck: channel.lastHealthCheckAt,
            lastErrorMessage: channel.lastErrorMessage,
            webhookStatus: channel.webhookStatus,
        });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
};

// PATCH /:id/webhook/verify
export const markWebhookVerified = async (req: Request, res: Response) => {
    const auditCtx = getAuditContext(req);
    try {
        const id = req.params.id as string;
        const channel = await prisma.whatsappChannel.update({
            where: { id },
            data: { webhookStatus: 'VERIFIED' }
        });

        await GlobalAuditLogService.logEvent({
            category: 'channels',
            eventType: 'channel.webhook_verified',
            severity: 'success',
            outcome: 'success',
            message: `Webhook de canal verificado manualmente: ${channel.name}`,
            targetType: 'whatsapp_channel',
            targetId: id
        }, auditCtx);

        return res.json({ success: true, channel });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
};
