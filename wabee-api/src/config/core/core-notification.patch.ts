import { EmailBrandingService } from '../../modules/wabee/email-customization/email-branding.service';
import { EmailTemplateResolverService } from '../../modules/wabee/email-customization/email-template-resolver.service';
import { EmailTemplateRendererService } from '../../modules/wabee/email-customization/email-template-renderer.service';
// Tipado base compatible con lo que emite core.notifications
export interface BaseNotification {
    to: string;
    tenantId?: string;
    userId?: string;
    templateName?: string;
    channel?: string;
    data?: Record<string, any>;
    subject?: string;
    content?: string;
    productId?: string;
}

export function applyNotificationPatch(coreInstance: any) {
    // 1. Determinar el punto de anclaje: siempre parchamos el Facade directamente.
    // El Facade valida plantillas ANTES de llamar al servicio interno; si parchamos solo
    // el servicio interno, el Facade retorna { success: false } antes de llegar a él.
    let ns: any = null;
    if (coreInstance.notifications?.send) {
        ns = coreInstance.notifications; // Facade — intercepta primero
    } else if (coreInstance.notifications?.notificationService?.send) {
        ns = coreInstance.notifications.notificationService; // Fallback (versiones antiguas)
    }

    if (!ns) {
        console.warn('[NotificationPatch] No se encontró un punto de anclaje de notificaciones (service o facade) en el Core. El parche no se aplicó.');
        return;
    }
    
    if (typeof ns.send !== 'function') {
        console.warn('[NotificationPatch] El método send no está disponible en el motor de notificaciones.');
        return;
    }

    // 2. Guardamos la referencia al método de envío ORIGINAL del motor real
    const originalRealSend = ns.send.bind(ns);

    // 2. Parcheamos el método de envío profundo. 
    // Esto capturará TODO: core.notifications.send() y también llamadas internas directas de Auth.
    ns.send = async (options: BaseNotification) => {
        try {
            // Evaluamos el channel (por defecto email)
            const channel = options.channel || 'email';
            
            if (channel !== 'email') {
                return originalRealSend(options);
            }

            let templateCode = options.templateName || 'UNKNOWN';
            
            // ── SINONIMIA DE PLANTILLAS ─────────────────────────────────────────
            // Si el core envía nombres variados, los mapeamos a nuestros canónicos.
            const verificationSynonyms = ['verification', 'verify-email', 'email-verification', 'activation', 'verify_email'];
            if (verificationSynonyms.includes(templateCode.toLowerCase())) {
                templateCode = 'VERIFY_EMAIL';
            }
            
            if (templateCode.toLowerCase() === 'password-reset' || templateCode.toLowerCase() === 'forgot-password') {
                templateCode = 'PASSWORD_RESET';
            }
            // ────────────────────────────────────────────────────────────────────

            console.log(`[NotificationPatch] Procesando email personalizado: ${templateCode} para ${options.to}`);

            // A. Resolver plantilla (consulta viva a DB)
            const resolved = await EmailTemplateResolverService.resolve(templateCode, {
                subject: options.subject,
                content: options.content
            });

            // B. Obtener Branding Global (consulta viva a DB)
            const globalBranding = await EmailBrandingService.getGlobalConfiguration();

            // C. Renderizar Contenido
            const dynamicData = { ...(options.data || {}) };
            
            // Lógica de Adaptación de Tokens/Links del Core Auth
            if (dynamicData.token && !dynamicData.link) {
                const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
                if (templateCode === 'PASSWORD_RESET') {
                    dynamicData.link = `${baseUrl}/reset-password?token=${dynamicData.token}`;
                } else if (templateCode.includes('INVITATION') || templateCode.includes('invitation')) {
                    dynamicData.link = `${baseUrl}/invitations/accept?token=${dynamicData.token}`;
                } else {
                    // Por defecto para registros/verificación
                    dynamicData.link = `${baseUrl}/verify?token=${dynamicData.token}`;
                }
            }

            // Estandarización de variables para el renderer (Soporte dual)
            if (dynamicData.link && !dynamicData.verification_link) dynamicData.verification_link = dynamicData.link;
            if (dynamicData.verification_link && !dynamicData.link) dynamicData.link = dynamicData.verification_link;
            if (dynamicData.link && !dynamicData.action_url) dynamicData.action_url = dynamicData.link;

            // Mapeo de usuario para Auth (Registro/Verificación)
            if (dynamicData.user && typeof dynamicData.user === 'object') {
                if (dynamicData.user.name && !dynamicData.user_name) dynamicData.user_name = dynamicData.user.name;
                if (dynamicData.user.email && !dynamicData.user_email) dynamicData.user_email = dynamicData.user.email;
            }

            const rendered = EmailTemplateRendererService.render(
                globalBranding as any,
                {
                    code: templateCode,
                    subject: resolved.subject || options.subject || '',
                    body: resolved.body,
                    title: resolved.templateTitle,
                    cta: dynamicData.cta_override || resolved.templateCta,
                    footer: resolved.templateFooter
                },
                dynamicData
            );

            // D. Preparamos las opciones finales para el transportador original
            // Limpiamos templateName para que el real no intente buscarlo de nuevo en su disco
            const patchedOptions = {
                ...options,
                subject: rendered.subject,
                content: rendered.html,
                text: rendered.text
            };
            delete patchedOptions.templateName;

            // E. Enviamos usando el método original para evitar bucles
            return originalRealSend(patchedOptions);

        } catch (error) {
            console.error('❌ [NotificationPatch] Error al aplicar branding. Fallback al original. Error:', error);
            // Fallback al comportamiento original en caso de error
            return originalRealSend(options);
        }
    };
    
    console.log('✅ [NotificationPatch] Motor de Correos Personalizados (Capa Profunda) inyectado con éxito.');
}
