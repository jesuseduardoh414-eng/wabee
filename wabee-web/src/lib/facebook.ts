// Integración con el SDK de Facebook para WhatsApp Embedded Signup (incl. Coexistence).
//
// Requiere las variables de entorno:
//   VITE_META_APP_ID     → App ID público de la Meta App
//   VITE_META_CONFIG_ID  → configuration_id del flujo "Facebook Login for Business"
//
// Mientras esas variables no estén configuradas (fase de Meta pendiente),
// `launchEmbeddedSignup` lanza un error controlado en vez de romper la UI.

const FB_SDK_SRC = 'https://connect.facebook.net/en_US/sdk.js';
const GRAPH_VERSION = (import.meta.env.VITE_META_GRAPH_VERSION as string) || 'v19.0';

declare global {
    interface Window {
        FB?: any;
        fbAsyncInit?: () => void;
    }
}

let sdkPromise: Promise<void> | null = null;

export function isEmbeddedSignupConfigured(): boolean {
    return Boolean(import.meta.env.VITE_META_APP_ID && import.meta.env.VITE_META_CONFIG_ID);
}

/** Carga e inicializa el SDK de Facebook una sola vez (idempotente). */
export function loadFacebookSdk(): Promise<void> {
    if (sdkPromise) return sdkPromise;

    sdkPromise = new Promise<void>((resolve, reject) => {
        const appId = import.meta.env.VITE_META_APP_ID as string;
        if (!appId) {
            reject(new Error('VITE_META_APP_ID no está configurado.'));
            return;
        }

        if (window.FB) {
            resolve();
            return;
        }

        window.fbAsyncInit = () => {
            window.FB.init({
                appId,
                cookie: true,
                xfbml: false,
                version: GRAPH_VERSION,
            });
            resolve();
        };

        const existing = document.getElementById('facebook-jssdk');
        if (existing) return; // fbAsyncInit lo resolverá

        const script = document.createElement('script');
        script.id = 'facebook-jssdk';
        script.src = FB_SDK_SRC;
        script.async = true;
        script.defer = true;
        script.crossOrigin = 'anonymous';
        script.onerror = () => reject(new Error('No se pudo cargar el SDK de Facebook.'));
        document.body.appendChild(script);
    });

    return sdkPromise;
}

export interface EmbeddedSignupResult {
    code: string;
    wabaId: string;
    phoneNumberId: string;
    onboardingMode: 'STANDARD' | 'COEXISTENCE';
}

/**
 * Lanza el popup de Embedded Signup y resuelve con el `code` + los IDs (WABA y
 * Phone Number) que Meta entrega a través del evento `WA_EMBEDDED_SIGNUP`.
 *
 * @param coexistence  Si true, solicita el onboarding de Coexistence (la app del
 *                     cliente sigue activa). Si false, Cloud API estándar.
 */
export async function launchEmbeddedSignup(coexistence: boolean): Promise<EmbeddedSignupResult> {
    if (!isEmbeddedSignupConfigured()) {
        throw new Error('Embedded Signup no está configurado todavía (faltan VITE_META_APP_ID / VITE_META_CONFIG_ID).');
    }

    await loadFacebookSdk();

    const configId = import.meta.env.VITE_META_CONFIG_ID as string;

    return new Promise<EmbeddedSignupResult>((resolve, reject) => {
        let sessionInfo: { wabaId?: string; phoneNumberId?: string } = {};

        // El SDK comunica los IDs vía postMessage (evento WA_EMBEDDED_SIGNUP).
        const messageListener = (event: MessageEvent) => {
            if (!event.origin.endsWith('facebook.com')) return;
            try {
                const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
                if (data?.type === 'WA_EMBEDDED_SIGNUP') {
                    if (data.event === 'FINISH' || data.event === 'FINISH_ONLY_WABA') {
                        sessionInfo = {
                            wabaId: data.data?.waba_id,
                            phoneNumberId: data.data?.phone_number_id,
                        };
                    } else if (data.event === 'CANCEL' || data.event === 'ERROR') {
                        cleanup();
                        reject(new Error(data.data?.error_message || 'El usuario canceló la conexión.'));
                    }
                }
            } catch {
                // Mensajes no-JSON de Facebook: ignorar
            }
        };

        const cleanup = () => window.removeEventListener('message', messageListener);
        window.addEventListener('message', messageListener);

        const extras: Record<string, any> = {
            sessionInfoVersion: 3,
        };
        if (coexistence) {
            // Solicita el flujo de Coexistence (número que vive en la app de WA Business).
            extras.featureType = 'whatsapp_business_app_onboarding';
        }

        window.FB.login(
            (response: any) => {
                cleanup();
                const code = response?.authResponse?.code;
                if (!code) {
                    reject(new Error('No se recibió el código de autorización de Meta.'));
                    return;
                }
                if (!sessionInfo.wabaId || !sessionInfo.phoneNumberId) {
                    reject(new Error('No se recibieron los IDs de WhatsApp (WABA / número). Intenta de nuevo.'));
                    return;
                }
                resolve({
                    code,
                    wabaId: sessionInfo.wabaId,
                    phoneNumberId: sessionInfo.phoneNumberId,
                    onboardingMode: coexistence ? 'COEXISTENCE' : 'STANDARD',
                });
            },
            {
                config_id: configId,
                response_type: 'code',
                override_default_response_type: true,
                extras,
            }
        );
    });
}
