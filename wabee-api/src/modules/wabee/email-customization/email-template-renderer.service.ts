import type { EmailGlobalConfig } from './email-branding.service';

export interface RenderedEmail {
    subject: string;
    html: string;
    text: string;
}

export class EmailTemplateRendererService {
    
    /**
     * Catálogo de variables Mock por Template Code para Previsualización Realista.
     */
    static getMockData(templateCode: string): Record<string, any> {
        const mocks: Record<string, Record<string, any>> = {
            'VERIFY_EMAIL': { 
                user_name: 'Juan Pérez', 
                verification_code: '123456',
                link: 'https://wabee.app/verify?token=mock',
                verification_link: 'https://wabee.app/verify?token=mock'
            },
            'PASSWORD_RESET': { 
                user_name: 'Juan Pérez', 
                link: 'https://wabee.app/reset?token=mock',
                reset_link: 'https://wabee.app/reset?token=mock'
            },
            'ORG_INVITATION': { 
                invited_by: 'Administrador', 
                organization_name: 'Atlas Corp', 
                link: 'https://wabee.app/invite?id=mock',
                invite_link: 'https://wabee.app/invite?id=mock' 
            },
            'WELCOME_EMAIL': { user_name: 'Juan Pérez', organization_name: 'WABEE Platform', link: 'https://wabee.app/dashboard' },
            'SUBSCRIPTION_ACTIVE': { plan_name: 'Plan Enterprise', renewal_date: '15 de Mayo, 2026', link: 'https://wabee.app/billing' },
            'PAYMENT_FAILED': { amount: '$49.00', card_last4: '4242', link: 'https://wabee.app/billing' },
            'NEW_DEVICE_LOGIN': { location: 'Ciudad de México, MX', ip_address: '189.215.12.4', link: 'https://wabee.app/security' }
        };
        return mocks[templateCode] || { user_name: 'Juan Pérez' };
    }

    static interpolate(text: string, data: Record<string, any>): string {
        if (!text) return '';
        let interpolated = text;
        for (const [key, value] of Object.entries(data)) {
            const valStr = typeof value === 'string' ? value : String(value ?? '');
            const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
            interpolated = interpolated.replace(regex, valStr);
        }
        return interpolated;
    }

    /**
     * Versión de texto plano del correo para máxima compatibilidad.
     */
    static generatePlainText(content: { title?: string; body: string; cta?: string }, brandName: string): string {
        return `${content.title || brandName}\n\n${content.body.replace(/<[^>]*>/g, '')}\n\n${content.cta ? `Acción: ${content.cta}` : ''}\n\n---\n${brandName}`;
    }

    /**
     * Renderiza el correo usando el motor centralizado (Espejo 100%).
     */
    static render(
        brandingConfig: EmailGlobalConfig,
        template: {
            code: string;
            subject: string;
            body: string;
            title?: string;
            cta?: string;
            footer?: string;
        },
        dynamicData: Record<string, any> = {}
    ): RenderedEmail {
        
        const contextData = {
            ...dynamicData,
            current_year: new Date().getFullYear().toString(),
            brand_name: brandingConfig.identidad.brandName
        };

        const { layout, texts, identidad } = brandingConfig;
        const accentColor = layout.buttonBg || '#2563EB';

        // 1. Interpolación de contenidos
        const subject = this.interpolate(template.subject, contextData);
        const titleContent = template.title ? this.interpolate(template.title, contextData) : '';
        const bodyContent = this.interpolate(template.body, contextData);
        const ctaContent = template.cta ? this.interpolate(template.cta, contextData) : '';
        const footerContent = template.footer 
            ? this.interpolate(template.footer, contextData) 
            : this.interpolate(identidad.globalFooter, contextData);

        // 2. Construcción del Bloque de Logo (Ahora preparado para ir ADENTRO)
        let logoHtml = '';
        if (identidad.brandLogo) {
            logoHtml = `
                <div style="text-align: center; margin-bottom: 35px;">
                    <img src="${identidad.brandLogo}" alt="${identidad.brandName}" style="max-height: 48px; width: auto; border-radius: 4px;" />
                    <div style="width: 40px; height: 3px; background-color: ${accentColor}; margin: 20px auto 0; border-radius: 2px; opacity: 0.3;"></div>
                </div>`;
        } else {
            logoHtml = `
                <div style="text-align: center; margin-bottom: 35px;">
                    <h2 style="margin:0; color: ${texts.title.color}; font-family: ${texts.title.font}, sans-serif; font-size: 28px; font-weight: bold;">${identidad.brandName}</h2>
                    <div style="width: 40px; height: 3px; background-color: ${accentColor}; margin: 15px auto 0; border-radius: 2px; opacity: 0.3;"></div>
                </div>`;
        }

        // 3. Bloque de CTA
        let ctaHtml = '';
        if (ctaContent) {
            const linkUrl = dynamicData.link || dynamicData.action_url || '#';
            ctaHtml = `
            <div style="text-align: center; margin-top: 40px;">
                <a href="${linkUrl}" style="background-color: ${layout.buttonBg}; color: ${layout.buttonText || '#FFFFFF'}; padding: 16px 32px; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 16px; font-family: ${texts.button.font}, sans-serif; display: inline-block; box-shadow: 0 4px 12px ${layout.buttonBg}4D;">
                    ${ctaContent}
                </a>
            </div>`;
        }

        // 4. HTML FINAL (Espejo 100%)
        const html = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Poppins:wght@400;600;800&family=Manrope:wght@400;600;800&family=DM+Sans:wght@400;600;800&display=swap');
    </style>
</head>
<body style="margin: 0; padding: 0; background-color: ${layout.bg}; font-family: ${texts.paragraph.font}, sans-serif; -webkit-font-smoothing: antialiased;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: ${layout.bg}; min-height: 100vh;">
        <tr>
            <td align="center" style="padding: 60px 0;">
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="width: 100%; max-width: 580px; margin: 0 auto;">
                    <tr>
                        <td style="background-color: ${layout.card}; border: 1px solid ${layout.border}; border-radius: 24px; padding: 50px 40px; box-shadow: 0 15px 35px rgba(0,0,0,0.08), 0 5px 15px rgba(0,0,0,0.04);">
                            ${logoHtml}

                            ${titleContent ? `<h1 style="color: ${texts.title.color}; font-family: ${texts.title.font}, sans-serif; font-size: 28px; font-weight: 800; margin-top: 0; margin-bottom: 24px; letter-spacing: -0.02em; line-height: 1.2; text-align: left;">${titleContent}</h1>` : ''}
                            
                            <div style="color: ${texts.paragraph.color}; font-family: ${texts.paragraph.font}, sans-serif; font-size: 16px; line-height: 1.7; font-weight: 400; text-align: left;">
                                ${bodyContent}
                            </div>
 
                            ${ctaHtml}
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="padding-top: 35px;">
                            <div style="height: 1px; width: 60px; background-color: ${layout.border}; margin: 0 auto 25px; opacity: 0.6;"></div>
                            <h3 style="margin: 0; color: ${texts.footer.color}; font-family: ${texts.footer.font}, sans-serif; font-size: 18px; font-weight: 800; letter-spacing: 0.02em; margin-bottom: 8px;">
                                ${identidad.brandName}
                            </h3>
                            <p style="margin: 0; color: ${texts.footer.color}; font-family: ${texts.footer.font}, sans-serif; font-size: 12px; opacity: 0.7; line-height: 1.5; max-width: 300px; margin: 0 auto 15px;">
                                ${footerContent}
                            </p>
                            <p style="margin: 0; color: ${texts.footer.color}; font-family: ${texts.footer.font}, sans-serif; font-size: 10px; opacity: 0.4; font-style: italic;">
                                Si no solicitaste este correo, puedes ignorarlo con seguridad.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;

        return {
            subject,
            html,
            text: this.generatePlainText({ title: titleContent, body: bodyContent, cta: ctaContent }, identidad.brandName)
        };
    }
}
