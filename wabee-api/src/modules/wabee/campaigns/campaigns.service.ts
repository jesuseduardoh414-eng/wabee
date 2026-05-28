import { prisma } from '@/config/core/core.prisma';
import { AudienceResolverService } from './services/audience-resolver.service';
import { CreateCampaignInput, UpdateCampaignInput } from './campaigns.schemas';
import { WhatsappCampaignStatus } from '@prisma/client';
import { CampaignEventsService } from './services/campaign-events.service';

// ─── Validación de templateInputMapping (server-side) ───────────────────────
// Lista blanca de campos permitidos del modelo Contact.
const ALLOWED_CONTACT_FIELDS = ['contact.name', 'contact.phone', 'contact.email'] as const;
const PLACEHOLDER_REGEX = /\{\{(\d+)\}\}/g;

function extractInputIds(components: any[]): { id: string; required: boolean }[] {
    const inputs: { id: string; required: boolean }[] = [];
    if (!Array.isArray(components)) return inputs;

    for (const comp of components) {
        if (comp.type === 'BODY' && comp.text) {
            const re = new RegExp(PLACEHOLDER_REGEX.source, 'g');
            let m: RegExpExecArray | null;
            while ((m = re.exec(comp.text)) !== null) {
                const idx = parseInt(m[1], 10);
                inputs.push({ id: `body_var_${idx}`, required: true });
            }
        } else if (comp.type === 'HEADER') {
            if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(comp.format ?? '')) {
                inputs.push({ id: 'header_media', required: true });
            } else if (comp.format === 'TEXT' && comp.text) {
                const re = new RegExp(PLACEHOLDER_REGEX.source, 'g');
                let m: RegExpExecArray | null;
                while ((m = re.exec(comp.text)) !== null) {
                    const idx = parseInt(m[1], 10);
                    inputs.push({ id: `header_var_${idx}`, required: true });
                }
            }
        } else if (comp.type === 'BUTTONS' && Array.isArray(comp.buttons)) {
            comp.buttons.forEach((btn: any, btnIndex: number) => {
                if (btn.type === 'URL' && btn.url) {
                    const re = new RegExp(PLACEHOLDER_REGEX.source, 'g');
                    let m: RegExpExecArray | null;
                    while ((m = re.exec(btn.url)) !== null) {
                        const idx = parseInt(m[1], 10);
                        inputs.push({ id: `button_url_${btnIndex}_var_${idx}`, required: true });
                    }
                }
            });
        }
    }
    return inputs;
}

/**
 * Valida el templateInputMapping contra el template real almacenado en DB.
 * Lanza error 400 con detalle si el mapping es inválido.
 */
async function validateTemplateMapping(
    templateId: string | undefined | null,
    mapping: Record<string, any> | null | undefined
) {
    if (!templateId) return; // sin plantilla, sin validación

    const template = await prisma.whatsappTemplate.findUnique({ where: { id: templateId } });
    if (!template) throw { status: 404, message: `Plantilla ${templateId} no encontrada` };

    const components = template.components as any[];
    const inputs = extractInputIds(components);
    const hasInputs = inputs.length > 0;

    if (!hasInputs) {
        // Plantilla estática: no debe tener mapping
        if (mapping && Object.keys(mapping).length > 0) {
            throw {
                status: 400,
                message: 'La plantilla no tiene variables; no se debe enviar templateInputMapping',
                unknownInputs: Object.keys(mapping),
            };
        }
        return;
    }

    // Plantilla con inputs: el mapping es obligatorio
    if (!mapping || Object.keys(mapping).length === 0) {
        throw {
            status: 400,
            message: 'La plantilla tiene variables obligatorias. Proporciona templateInputMapping.',
            missingInputs: inputs.filter(i => i.required).map(i => i.id),
        };
    }

    const requiredIds = new Set(inputs.filter(i => i.required).map(i => i.id));
    const validIds = new Set(inputs.map(i => i.id));
    const mappingKeys = Object.keys(mapping);

    const missingInputs = [...requiredIds].filter(id => !mapping[id]);
    const unknownInputs = mappingKeys.filter(k => !validIds.has(k));
    const invalidFields = mappingKeys.filter(k => {
        const entry = mapping[k];
        return entry?.mode === 'contact_field' && !(ALLOWED_CONTACT_FIELDS as readonly string[]).includes(entry.value);
    });

    if (missingInputs.length > 0 || unknownInputs.length > 0 || invalidFields.length > 0) {
        throw {
            status: 400,
            message: 'templateInputMapping inválido',
            ...(missingInputs.length > 0 && { missingInputs }),
            ...(unknownInputs.length > 0 && { unknownInputs }),
            ...(invalidFields.length > 0 && { invalidContactFields: invalidFields }),
        };
    }
}

export class CampaignsService {
    /**
     * Lista todas las campañas de un tenant.
     */
    static async getCampaigns(tenantId: string) {
        return await prisma.whatsappCampaign.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'desc' },
            include: {
                channel: {
                    select: { name: true, displayPhone: true }
                }
            }
        });
    }

    /**
     * Obtiene el detalle de una campaña específica con sus relaciones.
     */
    static async getCampaignById(tenantId: string, id: string) {
        const campaign = await prisma.whatsappCampaign.findFirst({
            where: { id, tenantId },
            include: {
                channel: true,
                template: true
            }
        });
        if (!campaign) throw { status: 404, message: 'Campaign not found' };
        return campaign;
    }

    /**
     * Crea una nueva campaña.
     * - Si scheduledAt != null → status = SCHEDULED
     * - Si scheduledAt null/undefined → status = DRAFT
     */
    static async createCampaign(tenantId: string, actorUserId: string, data: CreateCampaignInput) {
        await validateTemplateMapping(data.templateId, data.templateInputMapping as any);

        // ─── Regla de negocio TRD v2.1 ───────────────────────────────────────
        // Si el usuario programa la campaña, nace en SCHEDULED.
        // Si no hay scheduledAt, nace en DRAFT (inicio manual).
        const initialStatus: WhatsappCampaignStatus = data.scheduledAt ? 'SCHEDULED' : 'DRAFT';

        const createData: any = {
            tenantId,
            name: data.name,
            channelId: data.channelId,
            templateId: data.templateId || null,
            audienceType: data.audienceType,
            audienceFilter: data.audienceFilter ?? null,
            status: initialStatus,
            scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
            templateInputMapping: data.templateInputMapping ?? null,
        };

        try {
            const campaign = await prisma.whatsappCampaign.create({ data: createData });
            console.log(`[CampaignsService] Campaña creada: "${campaign.name}" status=${campaign.status} scheduledAt=${campaign.scheduledAt?.toISOString() ?? 'null'}`);

            try {
                console.log(`[CampaignsService] Audit event -> CAMPAIGN_CREATED for ${campaign.id}`);
                await CampaignEventsService.logCampaignEvent({
                    tenantId,
                    actorUserId,
                    campaignId: campaign.id,
                    campaignName: campaign.name,
                    action: 'CAMPAIGN_CREATED',
                    metadata: { trigger: 'manual' }
                });

                if (campaign.scheduledAt) {
                    console.log(`[CampaignsService] Audit event -> CAMPAIGN_SCHEDULED for ${campaign.id}`);
                    await CampaignEventsService.logCampaignEvent({
                        tenantId,
                        actorUserId,
                        campaignId: campaign.id,
                        campaignName: campaign.name,
                        action: 'CAMPAIGN_SCHEDULED',
                        metadata: { trigger: 'manual', scheduledAt: campaign.scheduledAt.toISOString() }
                    });
                }
            } catch (auditError) {
                console.error('[CampaignsService] Non-critical audit error during creation:', auditError);
            }

            return campaign;
        } catch (error: any) {
            console.error('[CampaignsService] Create error:', error);
            if (error.code === 'P2002') {
                throw { status: 409, message: 'Ya existe una campaña con ese nombre en esta organización' };
            }
            throw error;
        }
    }


    /**
     * Actualiza los datos de una campaña.
     * - Permite editar campañas en DRAFT o SCHEDULED.
     * - Recalcula status DRAFT↔SCHEDULED cuando cambia scheduledAt:
     *     DRAFT  + scheduledAt set   → SCHEDULED
     *     SCHEDULED + scheduledAt null → DRAFT
     */
    static async updateCampaign(tenantId: string, actorUserId: string, id: string, data: UpdateCampaignInput) {
        const campaign = await this.getCampaignById(tenantId, id);

        // Permitir edición SOLO en DRAFT o SCHEDULED. Cualquier otro estado es inmutable.
        if (campaign.status !== 'DRAFT' && campaign.status !== 'SCHEDULED') {
            throw {
                status: 409,
                message: 'No se puede editar una campaña cuando está en progreso o completada.',
                currentStatus: campaign.status
            };
        }

        if (data.templateInputMapping !== undefined) {
            const templateId = data.templateId ?? campaign.templateId ?? undefined;
            await validateTemplateMapping(templateId, data.templateInputMapping as any);
        }

        const updateData: any = {};
        if (data.name !== undefined) updateData.name = data.name;
        if (data.channelId !== undefined) updateData.channelId = data.channelId;
        if (data.templateId !== undefined) updateData.templateId = data.templateId || null;
        if (data.audienceType !== undefined) updateData.audienceType = data.audienceType;
        if (data.audienceFilter !== undefined) updateData.audienceFilter = data.audienceFilter;
        if (data.templateInputMapping !== undefined) {
            updateData.templateInputMapping = data.templateInputMapping ?? null;
        }

        // ─── Recalcular status DRAFT↔SCHEDULED ───────────────────────────────
        if (data.scheduledAt !== undefined) {
            const newScheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : null;
            updateData.scheduledAt = newScheduledAt;

            if (campaign.status === 'DRAFT' && newScheduledAt !== null) {
                // DRAFT + añadir scheduledAt → SCHEDULED
                updateData.status = 'SCHEDULED';
                console.log(`[CampaignsService] "${campaign.name}" DRAFT → SCHEDULED (scheduledAt: ${newScheduledAt.toISOString()})`);
            } else if (campaign.status === 'SCHEDULED' && newScheduledAt === null) {
                // SCHEDULED + borrar scheduledAt → DRAFT
                updateData.status = 'DRAFT';
                console.log(`[CampaignsService] "${campaign.name}" SCHEDULED → DRAFT (scheduledAt borrado)`);
            }
        }

        try {
            const updated = await prisma.whatsappCampaign.update({
                where: { id: campaign.id },
                data: updateData,
            });

            try {
                console.log(`[CampaignsService] Audit event -> CAMPAIGN_UPDATED for ${updated.id}`);
                await CampaignEventsService.logCampaignEvent({
                    tenantId,
                    actorUserId,
                    campaignId: updated.id,
                    campaignName: updated.name,
                    action: 'CAMPAIGN_UPDATED',
                    metadata: { trigger: 'manual' }
                });

                if (updateData.status === 'SCHEDULED') {
                    console.log(`[CampaignsService] Audit event -> CAMPAIGN_SCHEDULED for ${updated.id}`);
                    await CampaignEventsService.logCampaignEvent({
                        tenantId,
                        actorUserId,
                        campaignId: updated.id,
                        campaignName: updated.name,
                        action: 'CAMPAIGN_SCHEDULED',
                        metadata: { trigger: 'manual', scheduledAt: updated.scheduledAt?.toISOString() }
                    });
                }
            } catch (auditError) {
                console.error('[CampaignsService] Non-critical audit error during update:', auditError);
            }

            return updated;
        } catch (error: any) {
            console.error('[CampaignsService] Update error:', error);
            if (error.code === 'P2002') {
                throw { status: 409, message: 'Ya existe una campaña con ese nombre en esta organización' };
            }
            throw error;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // EXPAND AUDIENCE — método reutilizable (usado por startCampaign y worker)
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Resuelve la audiencia y crea los whatsappCampaignMessage con deduplicación.
     * NO cambia el status de la campaña; eso lo hace el llamador.
     *
     * @returns número de destinatarios expandidos
     */
    static async expandAudienceAndSeedMessages(tenantId: string, campaignId: string): Promise<number> {
        const campaign = await this.getCampaignById(tenantId, campaignId);

        const result = await AudienceResolverService.resolve(
            tenantId,
            campaign.id,
            campaign.audienceType,
            campaign.audienceFilter
        );

        // Actualizar metadatos de audiencia + expandir mensajes (con chunking + dedup)
        await prisma.$transaction(async (tx) => {
            await tx.whatsappCampaign.update({
                where: { id: campaign.id },
                data: {
                    audienceSnapshotPath: result.filePath,
                    audienceSnapshotHash: result.hash,
                    estimatedRecipients: result.count,
                }
            });

            const chunkSize = 200;
            for (let i = 0; i < result.members.length; i += chunkSize) {
                const chunk = result.members.slice(i, i + chunkSize);
                await tx.whatsappCampaignMessage.createMany({
                    data: chunk.map(m => ({
                        tenantId,
                        campaignId: campaign.id,
                        contactId: m.id,
                        variant: m.variant,
                        status: 'PENDING'
                    })),
                    skipDuplicates: true // Idempotencia: UNIQUE(tenant_campaign_contact)
                });
            }
        });

        console.log(`[CampaignsService] expandAudienceAndSeedMessages: campaña="${campaign.name}" recipients=${result.count}`);
        return result.count;
    }

    /**
     * Inicia una campaña manualmente o reanuda una pausada.
     * Bloquea inicio de campañas SCHEDULED (se lanzan automáticamente).
     */
    static async startCampaign(tenantId: string, actorUserId: string, id: string) {
        const campaign = await this.getCampaignById(tenantId, id);

        // ─── Bloquear operaciones sobre campañas terminadas ────────────────────
        if (['COMPLETED', 'CANCELED', 'FAILED'].includes(campaign.status)) {
            throw {
                status: 409,
                message: `No se puede iniciar una campaña en estado ${campaign.status}.`
            };
        }

        // ─── Bloquear inicio manual de campañas programadas ───────────────────
        if (campaign.status === 'SCHEDULED' && campaign.scheduledAt) {
            throw {
                status: 409,
                message: 'Esta campaña está programada y se iniciará automáticamente.'
            };
        }

        // Si ya está pausada, simplemente reanudamos (el worker la retomará)
        if (campaign.status === 'PAUSED') {
            const resumed = await prisma.whatsappCampaign.update({
                where: { id: campaign.id },
                data: { status: 'IN_PROGRESS', pauseReason: null }
            });
            try {
                console.log(`[CampaignsService] Audit event -> CAMPAIGN_STARTED for ${resumed.id} (resumed)`);
                await CampaignEventsService.logCampaignEvent({
                    tenantId,
                    actorUserId,
                    campaignId: resumed.id,
                    campaignName: resumed.name,
                    action: 'CAMPAIGN_STARTED',
                    metadata: { trigger: 'manual', note: 'Resumed' }
                });
            } catch (auditError) {
                console.error('[CampaignsService] Non-critical audit error during resume:', auditError);
            }
            return resumed;
        }

        if (campaign.status !== 'DRAFT') {
            throw { status: 400, message: `Cannot start campaign in status ${campaign.status}` };
        }

        // 1. Expandir audiencia y crear mensajes
        await this.expandAudienceAndSeedMessages(tenantId, campaign.id);

        // 2. Marcar como IN_PROGRESS
        const updated = await prisma.whatsappCampaign.update({
            where: { id: campaign.id },
            data: {
                status: 'IN_PROGRESS',
                startedAt: new Date(),
            }
        });

        try {
            console.log(`[CampaignsService] Audit event -> CAMPAIGN_STARTED for ${updated.id}`);
            await CampaignEventsService.logCampaignEvent({
                tenantId,
                actorUserId,
                campaignId: updated.id,
                campaignName: updated.name,
                action: 'CAMPAIGN_STARTED',
                metadata: { trigger: 'manual' }
            });
        } catch (auditError) {
            console.error('[CampaignsService] Non-critical audit error during manual start:', auditError);
        }

        return updated;
    }

    /**
     * Pausa el despacho de una campaña.
     */
    static async pauseCampaign(tenantId: string, actorUserId: string, id: string, reason?: string) {
        const campaign = await this.getCampaignById(tenantId, id);
        if (campaign.status !== 'IN_PROGRESS') {
            throw { status: 400, message: 'Only IN_PROGRESS campaigns can be paused' };
        }

        const updated = await prisma.whatsappCampaign.update({
            where: { id: campaign.id },
            data: { status: 'PAUSED', pauseReason: reason || 'Manual pause' }
        });

        try {
            console.log(`[CampaignsService] Audit event -> CAMPAIGN_PAUSED for ${updated.id}`);
            await CampaignEventsService.logCampaignEvent({
                tenantId,
                actorUserId,
                campaignId: updated.id,
                campaignName: updated.name,
                action: 'CAMPAIGN_PAUSED',
                metadata: { trigger: 'manual', reason: updated.pauseReason }
            });
        } catch (auditError) {
            console.error('[CampaignsService] Non-critical audit error during pause:', auditError);
        }

        return updated;
    }

    /**
     * Cancela una campaña y marca mensajes no enviados como CANCELED.
     */
    static async cancelCampaign(tenantId: string, actorUserId: string, id: string) {
        const campaign = await this.getCampaignById(tenantId, id);
        if (['COMPLETED', 'CANCELED', 'FAILED'].includes(campaign.status)) {
            throw {
                status: 409,
                message: `No se puede cancelar una campaña que ya está ${campaign.status === 'COMPLETED' ? 'completada' : campaign.status === 'FAILED' ? 'fallida' : 'cancelada'}.`,
                currentStatus: campaign.status
            };
        }

        await prisma.$transaction([
            prisma.whatsappCampaign.update({
                where: { id: campaign.id },
                data: { status: 'CANCELED', completedAt: new Date() }
            }),
            prisma.whatsappCampaignMessage.updateMany({
                where: { campaignId: campaign.id, status: { in: ['PENDING'] } },
                data: { status: 'CANCELED' }
            })
        ]);

        try {
            console.log(`[CampaignsService] Audit event -> CAMPAIGN_CANCELED for ${campaign.id}`);
            await CampaignEventsService.logCampaignEvent({
                tenantId,
                actorUserId,
                campaignId: campaign.id,
                campaignName: campaign.name,
                action: 'CAMPAIGN_CANCELED',
                metadata: { trigger: 'manual' }
            });
        } catch (auditError) {
            console.error('[CampaignsService] Non-critical audit error during cancellation:', auditError);
        }

        return { success: true };
    }

    /**
     * Elimina una campaña y todos sus mensajes asociados físicamente de la base de datos.
     * SOLO permite eliminar campañas en DRAFT o SCHEDULED.
     */
    static async deleteCampaign(tenantId: string, actorUserId: string, id: string) {
        const campaign = await this.getCampaignById(tenantId, id);

        // Solo DRAFT o SCHEDULED son eliminables.
        if (!['DRAFT', 'SCHEDULED'].includes(campaign.status)) {
            throw {
                status: 409,
                message: 'No se puede eliminar una campaña cuando está en progreso o completada.',
                currentStatus: campaign.status
            };
        }

        try {
            await prisma.$transaction([
                prisma.whatsappCampaignMessage.deleteMany({
                    where: { campaignId: campaign.id }
                }),
                prisma.whatsappCampaign.delete({
                    where: { id: campaign.id, tenantId } // multi-tenant estricto
                })
            ]);

            try {
                console.log(`[CampaignsService] Audit event -> CAMPAIGN_DELETED for ${campaign.id}`);
                await CampaignEventsService.logCampaignEvent({
                    tenantId,
                    actorUserId,
                    campaignId: campaign.id,
                    campaignName: campaign.name,
                    action: 'CAMPAIGN_DELETED',
                    metadata: {
                        status: campaign.status,
                        scheduledAt: campaign.scheduledAt?.toISOString(),
                        sentCount: campaign.sentCount,
                        deliveredCount: campaign.deliveredCount,
                        readCount: campaign.readCount,
                        failedCount: campaign.failedCount
                    }
                });
            } catch (auditError) {
                console.error('[CampaignsService] Non-critical audit error during deletion:', auditError);
            }
        } catch (error: any) {
            if (error.code === 'P2025') {
                throw { status: 404, message: 'Campaña no encontrada' };
            }
            throw error;
        }

        return { success: true };
    }


    /**
     * Obtiene los errores detallados de una campaña (DLQ).
     */
    static async getCampaignErrors(tenantId: string, id: string) {
        const campaign = await this.getCampaignById(tenantId, id);
        return await prisma.whatsappCampaignMessage.findMany({
            where: { campaignId: campaign.id, status: 'FAILED' },
            include: {
                contact: {
                    select: { name: true, phone: true }
                }
            },
            orderBy: { updatedAt: 'desc' },
            take: 100
        });
    }

    /**
     * Obtiene métricas agregadas desglosadas por variante A/B (TRD v2.1).
     */
    static async getCampaignMetrics(tenantId: string, id: string) {
        await this.getCampaignById(tenantId, id);
        return await prisma.whatsappCampaignMessage.groupBy({
            by: ['variant', 'status'],
            where: { campaignId: id },
            _count: { _all: true }
        });
    }
}
