import { corePrisma } from '../../../config/core/core.prisma';
import { DEFAULT_EMAIL_TEMPLATES } from './email-defaults';

const EMAIL_TEMPLATES_KEY = 'email_customization_templates';

export interface EmailTemplateConfig {
    id: string;
    code: string;
    name: string;
    category: string;
    status: 'published' | 'draft';
    subject: string;
    title: string;
    body: string;
    cta: string;
    footer: string;
}

export interface ResolvedTemplate {
    subject: string;
    body: string;
    source: 'custom' | 'legacy' | 'direct';
    templateTitle?: string;
    templateCta?: string;
    templateFooter?: string;
}

export class EmailTemplateResolverService {
    /**
     * Resuelve una plantilla priorizando configuraciones vigentes de Super Admin.
     * Consultas se hacen en vivo contra DB (Requisito 11).
     */
    static async resolve(templateCode: string, directFallback?: { subject?: string; content?: string }): Promise<ResolvedTemplate> {
        // 1. Intentar resolver desde plantillas personalizadas de Super Admin (email_customization_templates)
        const templatesSetting = await (corePrisma as any).systemSetting.findUnique({
            where: { key: EMAIL_TEMPLATES_KEY }
        }).catch(() => null);

        if (templatesSetting && templatesSetting.value) {
            const customTemplates = templatesSetting.value as unknown as EmailTemplateConfig[];
            const activeCustom = customTemplates.find(t => t.code === templateCode && t.status === 'published');
            
            if (activeCustom) {
                return {
                    source: 'custom',
                    subject: activeCustom.subject,
                    body: activeCustom.body,
                    templateTitle: activeCustom.title,
                    templateCta: activeCustom.cta,
                    templateFooter: activeCustom.footer
                };
            }
        }

        // 1.5. Fallback a las plantillas por defecto del sistema
        const defaultTemplate = DEFAULT_EMAIL_TEMPLATES.find(t => t.code === templateCode && t.status === 'published');
        if (defaultTemplate) {
            return {
                source: 'custom',
                subject: defaultTemplate.subject,
                body: defaultTemplate.body,
                templateTitle: defaultTemplate.title,
                templateCta: defaultTemplate.cta,
                templateFooter: defaultTemplate.footer
            };
        }

        // 2. Intentar resolver de NotificationTemplate (Legacy)
        const legacyTemplate = await (corePrisma as any).notificationTemplate.findFirst({
            where: { name: templateCode, channel: 'email', isActive: true }
        }).catch(() => null);

        if (legacyTemplate) {
            return {
                source: 'legacy',
                subject: legacyTemplate.subject || directFallback?.subject || '',
                body: legacyTemplate.content // Mapeamos content a body
            };
        }

        // 3. Fallback directo provisto por quien llama
        if (directFallback && (directFallback.content || directFallback.subject)) {
            return {
                source: 'direct',
                subject: directFallback.subject || templateCode,
                body: directFallback.content || `Mensaje automático de tipo: ${templateCode}`
            };
        }

        // 4. Fallback final si nada cuadra
        return {
            source: 'direct',
            subject: `Notificación del Sistema: ${templateCode}`,
            body: `Mensaje automático de sistema: ${templateCode}`
        };
    }
}
