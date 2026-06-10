import { prisma } from '../../../../config/core/core.prisma';
import { decrypt } from './token.crypto';
import { graphGet, graphPost, graphDelete } from './meta.graph.client';
import { ListTemplatesQuery, CreateTemplateInput } from './whatsapp.templates.schemas';
import { env } from '@/config/env';

interface ImportResult {
    imported: number;
    updated: number;
    skipped: number;
}

export class WhatsAppTemplatesService {
    /**
     * Import templates from Meta Graph API for a specific channel
     */
    static async importTemplates(tenantId: string, channelId: string): Promise<ImportResult> {
        // Audit: confirm if model exists in client
        if (!(prisma as any).whatsappTemplate) {
            console.error('[Prisma Delegates]', Object.keys(prisma));
            throw new Error("Prisma delegate whatsappTemplate not available");
        }
        // 1. Load channel with OAuth session
        const channel = await prisma.whatsappChannel.findFirst({
            where: { id: channelId, tenantId },
            include: { oauthSession: true }
        });

        if (!channel) {
            throw { status: 404, message: 'Channel not found or access denied' };
        }

        if (!channel.wabaId) {
            throw { status: 400, message: 'Channel missing WABA ID' };
        }

        // 2. Resolve access token: OAuth session or env fallback (manual/test channels)
        let accessToken: string;
        const TEST_PHONE_NUMBER_ID = env.WHATSAPP_PHONE_NUMBER_ID;
        const TEST_TOKEN = env.WHATSAPP_ACCESS_TOKEN;

        if (channel.oauthSession) {
            try {
                accessToken = decrypt({
                    ciphertext: channel.oauthSession.accessTokenCiphertext,
                    iv: channel.oauthSession.accessTokenIv,
                    tag: channel.oauthSession.accessTokenTag
                });
            } catch (error) {
                throw { status: 500, message: 'Failed to decrypt access token' };
            }
        } else if (channel.phoneNumberId === TEST_PHONE_NUMBER_ID && TEST_TOKEN) {
            // Fallback for manually-connected test channel using env token
            accessToken = TEST_TOKEN;
        } else {
            throw { status: 400, message: 'Canal sin credenciales configuradas. Reconecta el canal con Meta OAuth.' };
        }

        // 3. Fetch templates from Meta
        let templates: any[];
        try {
            const response = await graphGet(
                `/${channel.wabaId}/message_templates`,
                accessToken,
                { limit: '200' }
            );
            templates = response.data || [];
        } catch (error: any) {
            console.error('❌ [Templates] Meta API error:', error.message);
            throw { status: 502, message: 'Failed to fetch templates from Meta', detail: error.message };
        }

        // 4. Upsert templates (idempotent)
        let imported = 0;
        let updated = 0;
        let skipped = 0;

        for (const template of templates) {
            try {
                const existing = await prisma.whatsappTemplate.findFirst({
                    where: {
                        tenantId,
                        channelId,
                        name: template.name,
                        language: template.language
                    }
                });

                const templateData = {
                    tenantId,
                    channelId,
                    name: template.name,
                    language: template.language,
                    category: template.category || 'UTILITY',
                    status: template.status || 'UNKNOWN',
                    components: template.components || [],
                    metaTemplateId: template.id || null
                };

                if (existing) {
                    await prisma.whatsappTemplate.update({
                        where: { id: existing.id },
                        data: {
                            category: templateData.category,
                            status: templateData.status,
                            components: templateData.components,
                            metaTemplateId: templateData.metaTemplateId,
                            updatedAt: new Date()
                        }
                    });
                    updated++;
                } else {
                    await prisma.whatsappTemplate.create({ data: templateData });
                    imported++;
                }
            } catch (error) {
                console.error(`❌ [Templates] Failed to upsert template ${template.name}:`, error);
                skipped++;
            }
        }

        console.log(`✅ [Templates] Import complete: ${imported} imported, ${updated} updated, ${skipped} skipped`);

        return { imported, updated, skipped };
    }

    /**
     * List templates for a channel with filters
     */
    static async listTemplates(
        tenantId: string,
        channelId: string,
        filters: ListTemplatesQuery
    ) {
        // Audit: confirm if model exists in client
        if (!(prisma as any).whatsappTemplate) {
            console.error('[Prisma Delegates]', Object.keys(prisma));
            throw new Error("Prisma delegate whatsappTemplate not available");
        }

        const { status, language, category, q, page = 1, limit = 20 } = filters;

        // Verify channel belongs to tenant
        const channel = await prisma.whatsappChannel.findFirst({
            where: { id: channelId, tenantId }
        });

        if (!channel) {
            throw { status: 404, message: 'Channel not found or access denied' };
        }

        // Build where clause
        const where: any = {
            tenantId,
            channelId
        };

        if (status) where.status = status;
        if (language) where.language = language;
        if (category) where.category = category;
        if (q) {
            where.name = { contains: q, mode: 'insensitive' };
        }

        // Fetch with pagination
        const [items, total] = await Promise.all([
            prisma.whatsappTemplate.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit
            }),
            prisma.whatsappTemplate.count({ where })
        ]);

        return {
            items,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    static async resolveToken(tenantId: string, channelId: string) {
        const channel = await prisma.whatsappChannel.findFirst({
            where: { id: channelId, tenantId },
            include: { oauthSession: true }
        });

        if (!channel) throw { status: 404, message: 'Canal no encontrado' };
        if (!channel.wabaId) throw { status: 400, message: 'Canal sin WABA ID' };

        let accessToken: string;
        if (channel.oauthSession) {
            try {
                accessToken = decrypt({
                    ciphertext: channel.oauthSession.accessTokenCiphertext,
                    iv: channel.oauthSession.accessTokenIv,
                    tag: channel.oauthSession.accessTokenTag
                });
            } catch {
                throw { status: 500, message: 'Error al descifrar el token de acceso' };
            }
        } else if (channel.phoneNumberId === env.WHATSAPP_PHONE_NUMBER_ID && env.WHATSAPP_ACCESS_TOKEN) {
            accessToken = env.WHATSAPP_ACCESS_TOKEN;
        } else {
            throw { status: 400, message: 'Canal sin credenciales. Reconecta el canal con Meta OAuth.' };
        }

        return { channel, accessToken };
    }

    static async createTemplate(tenantId: string, channelId: string, input: CreateTemplateInput) {
        const { channel, accessToken } = await WhatsAppTemplatesService.resolveToken(tenantId, channelId);

        let components: any[];

        if (input.category === 'AUTHENTICATION') {
            // Authentication: fixed Meta structure — no custom body text
            components = [
                { type: 'BODY', add_security_recommendation: input.addSecurityRecommendation ?? true },
            ];
            if (input.codeExpirationMinutes) {
                components.push({ type: 'FOOTER', code_expiration_minutes: input.codeExpirationMinutes });
            }
            components.push({
                type: 'BUTTONS',
                buttons: [{ type: 'OTP', otp_type: 'COPY_CODE' }],
            });
        } else {
            // Marketing / Utility: text + optional buttons
            components = [];

            if (input.headerText) {
                components.push({ type: 'HEADER', format: 'TEXT', text: input.headerText });
            }

            const bodyVarCount = (input.body.match(/\{\{\d+\}\}/g) || []).length;
            const bodyComponent: any = { type: 'BODY', text: input.body };
            if (bodyVarCount > 0) {
                const examples = input.bodyExamples?.length
                    ? input.bodyExamples.slice(0, bodyVarCount)
                    : Array.from({ length: bodyVarCount }, (_, i) => `ejemplo_${i + 1}`);
                while (examples.length < bodyVarCount) examples.push(`ejemplo_${examples.length + 1}`);
                bodyComponent.example = { body_text: [examples] };
            }
            components.push(bodyComponent);

            if (input.footer) {
                components.push({ type: 'FOOTER', text: input.footer });
            }

            if (input.buttons?.length) {
                components.push({
                    type: 'BUTTONS',
                    buttons: input.buttons.map(btn => {
                        if (btn.type === 'QUICK_REPLY') return { type: 'QUICK_REPLY', text: btn.text };
                        if (btn.type === 'URL') return { type: 'URL', text: btn.text, url: btn.url };
                        return { type: 'PHONE_NUMBER', text: btn.text, phone_number: btn.phone };
                    }),
                });
            }
        }

        let metaResponse: any;
        try {
            metaResponse = await graphPost(
                `/${channel.wabaId}/message_templates`,
                accessToken,
                { name: input.name, language: input.language, category: input.category, components }
            );
        } catch (error: any) {
            const detail = error.response?.data?.error?.message || error.message;
            throw { status: 502, message: 'Meta rechazó la plantilla', detail };
        }

        const created = await prisma.whatsappTemplate.create({
            data: {
                tenantId,
                channelId,
                name: input.name,
                language: input.language,
                category: input.category,
                status: 'PENDING',
                components,
                metaTemplateId: metaResponse.id || null,
            }
        });

        return created;
    }

    static async deleteTemplate(tenantId: string, channelId: string, templateId: string) {
        const { channel, accessToken } = await WhatsAppTemplatesService.resolveToken(tenantId, channelId);

        const template = await prisma.whatsappTemplate.findFirst({
            where: { id: templateId, tenantId, channelId }
        });

        if (!template) throw { status: 404, message: 'Plantilla no encontrada' };

        try {
            await graphDelete(
                `/${channel.wabaId}/message_templates`,
                accessToken,
                { name: template.name }
            );
        } catch (error: any) {
            const meta = error.response?.data?.error;
            // Code 100 = template already deleted on Meta side, proceed
            if (meta?.code !== 100) {
                throw { status: 502, message: 'Error al eliminar en Meta', detail: meta?.message || error.message };
            }
        }

        await prisma.whatsappTemplate.delete({ where: { id: templateId } });

        return { success: true };
    }
}
