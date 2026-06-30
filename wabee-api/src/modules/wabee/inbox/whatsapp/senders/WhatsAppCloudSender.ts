
import axios from 'axios';
import { ChannelSender } from './ChannelSender';
import { env } from '@/config/env';
import { decrypt } from '@/modules/wabee/channels/whatsapp/token.crypto';
import { prisma } from '@/lib/prisma';

export class WhatsAppCloudSender implements ChannelSender {
    private async getRequestConfig(channel: any) {
        let accessToken: string;
        let phoneNumberId: string;

        // Número configurado por variables de entorno: su token global se usa
        // SOLO para ese número; los demás canales usan su sesión OAuth propia.
        const envPhoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID;
        const envToken = env.WHATSAPP_ACCESS_TOKEN;

        if (envPhoneNumberId && envToken && channel.phoneNumberId === envPhoneNumberId) {
            accessToken = envToken;
            phoneNumberId = envPhoneNumberId;
        } else if (channel.oauthSessionId) {
            const session = await prisma.metaOauthSession.findUnique({
                where: { id: channel.oauthSessionId }
            });
            if (!session) throw { status: 503, message: 'Sesión de OAuth no encontrada. Reconecta el canal con Meta.' };
            accessToken = decrypt({
                ciphertext: session.accessTokenCiphertext,
                iv: session.accessTokenIv,
                tag: session.accessTokenTag
            });
            phoneNumberId = channel.phoneNumberId;
        } else {
            throw { status: 400, message: 'Canal sin credenciales configuradas.' };
        }

        // Health Check
        const { WhatsappChannelHealthService } = await import('../whatsapp.channelHealth.service');
        if (channel.healthStatus === 'RED') {
            await WhatsappChannelHealthService.checkChannelHealth(channel.id);
            const reChecked = await prisma.whatsappChannel.findUnique({ where: { id: channel.id }, select: { healthStatus: true } });
            if (reChecked?.healthStatus === 'RED') {
                throw { status: 503, message: 'Canal fuera de servicio (RED).', code: 'CHANNEL_HEALTH_RED' };
            }
        }

        const graphVersion = env.META_GRAPH_VERSION || 'v19.0';
        const url = `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`;

        return { url, accessToken };
    }

    async sendText(params: any): Promise<any> {
        const { channel, to: rawTo, text } = params;
        const to = this.normalizeRecipient(rawTo);
        const { url, accessToken } = await this.getRequestConfig(channel);

        try {
            console.log(`[WhatsAppCloudSender TEXT] URL: ${url}`);
            console.log(`[WhatsAppCloudSender TEXT] Payload:`, { to, text: { body: text } });

            const response = await axios.post(url, {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to,
                type: "text",
                text: { body: text }
            }, {
                headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
            });

            console.log(`[WhatsAppCloudSender TEXT] Meta Response Status: ${response.status}`);
            console.log(`[WhatsAppCloudSender TEXT] Meta Response Data:`, JSON.stringify(response.data));

            return { externalId: response.data.messages?.[0]?.id, raw: response.data };
        } catch (error: any) {
            console.error(`[WhatsAppCloudSender TEXT ERROR]`, error.response?.data || error);
            this.handleError(error);
        }
    }

    async sendMedia(params: any): Promise<any> {
        const { channel, to: rawTo, mediaType, mediaLink, caption, filename } = params;
        const to = this.normalizeRecipient(rawTo);
        const { url, accessToken } = await this.getRequestConfig(channel);

        try {
            const mediaPayload: Record<string, any> = { link: mediaLink };

            if (caption) {
                mediaPayload.caption = caption;
            }

            if (mediaType === 'document' && filename) {
                mediaPayload.filename = filename;
            }

            const payload = {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to,
                type: mediaType,
                [mediaType]: mediaPayload,
            };

            console.log(`[WhatsAppCloudSender MEDIA] URL: ${url}`);
            console.log(`[WhatsAppCloudSender MEDIA] Payload:`, {
                to,
                mediaType,
                hasCaption: Boolean(caption),
                filename: filename || null,
            });

            const response = await axios.post(url, payload, {
                headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
            });

            console.log(`[WhatsAppCloudSender MEDIA] Meta Response Status: ${response.status}`);
            console.log(`[WhatsAppCloudSender MEDIA] Meta Response Data:`, JSON.stringify(response.data));

            return { externalId: response.data.messages?.[0]?.id, raw: response.data };
        } catch (error: any) {
            console.error(`[WhatsAppCloudSender MEDIA ERROR]`, error.response?.data || error);
            this.handleError(error);
        }
    }

    async sendTemplate(params: any): Promise<any> {
        const { channel, to: rawTo, template } = params;
        const to = this.normalizeRecipient(rawTo);
        const { url, accessToken } = await this.getRequestConfig(channel);

        try {
            const cleanTemplate = {
                name: template.name,
                language: { code: template.language },
                components: params.components || []
            };

            // Log seguro: sin PII, sin tokens
            console.log(`[WhatsAppCloudSender] Enviando template: ${cleanTemplate.name} a ${to.slice(0, 4)}...`);

            const response = await axios.post(url, {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to,
                type: "template",
                template: cleanTemplate
            }, {
                headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
            });

            return { externalId: response.data.messages?.[0]?.id, raw: response.data };
        } catch (error: any) {
            this.handleError(error);
        }
    }

    /**
     * Normaliza el número destinatario antes de enviarlo a Meta.
     * México: WhatsApp agrega un "1" tras el código 52 (521XXXXXXXXXX), pero Meta
     * recomienda enviar SIN ese "1" (52XXXXXXXXXX). El sandbox/allowlist y algunos
     * envíos lo rechazan con error 131030 si lleva el "1". Lo quitamos para México.
     */
    private normalizeRecipient(to: string): string {
        const digits = String(to ?? '').replace(/\D/g, '');
        if (/^521\d{10}$/.test(digits)) return '52' + digits.slice(3);
        return digits;
    }

    private handleError(error: any) {
        const apiError = error.response?.data?.error;
        if (apiError) {
            // IMPORTANTE: NO propagar 401 de Meta como 401 de Wabee.
            // El 401 de Meta significa token expirado/inválido (problema de configuración),
            // NO que el usuario de Wabee no esté autenticado.
            // El frontend interpreta 401 como sesión expirada → logout.
            const metaStatus = error.response?.status || 400;
            const mappedStatus = metaStatus === 401 ? 503 : metaStatus;
            throw {
                status: mappedStatus,
                provider: 'meta',
                message: metaStatus === 401
                    ? 'Token de WhatsApp expirado o inválido. Regenera el token en Meta Developers.'
                    : apiError.message,
                code: apiError.code,
                subcode: apiError.error_subcode,
                traceId: apiError.fbtrace_id
            };
        }
        throw { status: 503, message: `Error de conexión con Meta: ${error.message}` };
    }
}
