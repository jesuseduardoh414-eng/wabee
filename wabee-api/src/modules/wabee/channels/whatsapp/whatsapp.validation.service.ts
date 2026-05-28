
import axios from 'axios';
import { env } from '@/config/env';

export interface ValidationResult {
    valid: boolean;
    status: 'CONNECTED' | 'ERROR' | 'SUSPENDED' | 'DISCONNECTED';
    healthStatus: 'GREEN' | 'YELLOW' | 'RED';
    errorCode?: string;
    errorMessage?: string;
    details?: {
        displayPhone?: string;
        verifiedName?: string;
    };
}

/**
 * WhatsApp Channel Validation Service
 * Implementa validación Ping API según TRD v2.1 (no bloqueante)
 */
export class WhatsappValidationService {
    /**
     * Valida credenciales del canal haciendo ping a Meta Graph API
     * NO lanza excepciones - devuelve resultado clasificado
     */
    static async validateChannelCredentials(params: {
        accessToken: string;
        phoneNumberId: string;
        wabaId?: string;
        metaAppId?: string;
    }): Promise<ValidationResult> {
        const graphVersion = env.META_GRAPH_VERSION || 'v19.0';
        const url = `https://graph.facebook.com/${graphVersion}/${params.phoneNumberId}`;

        const maskedToken = params.accessToken.substring(params.accessToken.length - 6);
        console.log(`🔍 [Validation] Pinging Meta API for phone ${params.phoneNumberId} with token ...${maskedToken}`);

        try {
            const response = await axios.get(url, {
                params: {
                    fields: 'display_phone_number,verified_name,code_verification_status',
                    access_token: params.accessToken
                },
                timeout: 10000 // 10 segundos timeout
            });

            console.log(`✅ [Validation] Ping OK for ${params.phoneNumberId}`);

            return {
                valid: true,
                status: 'CONNECTED',
                healthStatus: 'GREEN',
                details: {
                    displayPhone: response.data.display_phone_number,
                    verifiedName: response.data.verified_name
                }
            };
        } catch (error: any) {
            const status = error.response?.status;
            const metaError = error.response?.data?.error;
            const errorCode = metaError?.code;
            const errorSubcode = metaError?.error_subcode;
            const errorMessage = metaError?.message || error.message;

            console.warn(`⚠️ [Validation] Ping FAILED for ${params.phoneNumberId}:`, {
                status,
                code: errorCode,
                subcode: errorSubcode,
                message: errorMessage
            });

            // Clasificación según TRD v2.1 (Producción - No Bloqueante)

            // 1. AUTH ERRORS (401, 403, code 190)
            if (status === 401 || status === 403 || errorCode === 190) {
                return {
                    valid: false,
                    status: 'ERROR',
                    healthStatus: 'RED',
                    errorCode: String(errorCode || status),
                    errorMessage: 'Token inválido o expirado'
                };
            }

            // 2. SUSPENDED (code 368, subcode 2388110 o similares)
            if (errorCode === 368 || errorSubcode === 2388110 || errorSubcode === 2388139) {
                return {
                    valid: false,
                    status: 'SUSPENDED',
                    healthStatus: 'RED',
                    errorCode: `${errorCode}/${errorSubcode}`,
                    errorMessage: 'Cuenta suspendida o restringida por Meta'
                };
            }

            // 3. TEMPORARY ERRORS (rate limit 429, network timeout, 5xx)
            if (status === 429 || status >= 500 || error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
                return {
                    valid: false,
                    status: 'DISCONNECTED',
                    healthStatus: 'YELLOW',
                    errorCode: String(errorCode || status || error.code),
                    errorMessage: errorMessage || 'Error temporal de red o rate limit'
                };
            }

            // 4. OTROS ERRORES (clasificar como DISCONNECTED con YELLOW)
            return {
                valid: false,
                status: 'DISCONNECTED',
                healthStatus: 'YELLOW',
                errorCode: String(errorCode || status || 'UNKNOWN'),
                errorMessage: errorMessage || 'Error desconocido al validar canal'
            };
        }
    }
}
