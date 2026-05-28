import React, { useEffect, useRef } from 'react';

interface WidgetPreviewFrameProps {
    widgetId: string;
    apiBaseUrl: string;
    draftConfig: any;
}

const WidgetPreviewFrame: React.FC<WidgetPreviewFrameProps> = ({ widgetId, apiBaseUrl, draftConfig }) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        if (!iframeRef.current) return;

        const iframe = iframeRef.current;
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!iframeDoc) return;

        // Leer token JWT del localStorage del dashboard para pasarlo al iframe
        const previewToken = localStorage.getItem('wabee_token') || '';

        const iframeHTML = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Widget Preview</title>
    <style>
        * { box-sizing: border-box; }
        body, html {
            margin: 0;
            padding: 0;
            width: 380px;
            height: 600px;
            background: transparent;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            overflow: hidden;
        }

        /* Anular estilos de posicionamiento fijo del widget real */
        #wabee-widget-root {
            position: relative !important;
            bottom: auto !important;
            right: auto !important;
            left: auto !important;
            top: auto !important;
            width: 380px !important;
            height: 600px !important;
            z-index: 1 !important;
        }

        /* Ocultar el launcher — en preview la ventana siempre está abierta */
        .wabee-launcher {
            display: none !important;
        }

        /* La ventana ocupa todo el contenedor sin posicionamiento absoluto */
        .wabee-window {
            position: relative !important;
            display: flex !important;
            flex-direction: column !important;
            width: 380px !important;
            height: 600px !important;
            max-height: 600px !important;
            bottom: auto !important;
            right: auto !important;
            left: auto !important;
            top: auto !important;
            transform: none !important;
            opacity: 1 !important;
            visibility: visible !important;
            animation: none !important;
        }

        /* Forzar apertura — sin depender de la clase .open */
        .wabee-window {
            display: flex !important;
        }

        /* El área de mensajes ocupa el espacio restante entre header e input */
        .wabee-messages {
            flex: 1 !important;
            overflow-y: auto !important;
        }
    </style>
</head>
<body>
    <script>
        // Modo preview activado
        window.__WABEE_PREVIEW__ = true;
        window.__WABEE_AUTO_OPEN__ = true;

        // Token JWT del dashboard — enviado al endpoint interno autenticado
        window.__WABEE_PREVIEW_TOKEN__ = "${previewToken}";

        // Base URL del API — el mismo del dashboard para el endpoint interno
        window.__WABEE_PREVIEW_API_BASE__ = "${apiBaseUrl}";

        // Config inicial del widget
        window.WabeeWidgetConfig = {
            widgetId: "${widgetId}"
        };

        // Config del draft (se actualiza via postMessage)
        window.__WABEE_PREVIEW_CONFIG__ = ${JSON.stringify(draftConfig)};
    </script>

    <!-- Cargar el mismo script del widget real -->
    <script
        src="${apiBaseUrl}/v1/wabee-widget.js?v=${Date.now()}"
        onload="console.log('[PREVIEW] wabee-widget.js cargado')"
        onerror="console.error('[PREVIEW] Error al cargar el script del widget desde:', this.src)"
    ></script>
</body>
</html>
        `;

        iframeDoc.open();
        iframeDoc.write(iframeHTML);
        iframeDoc.close();
    }, [widgetId, apiBaseUrl]);

    // Actualizar config en vivo cuando cambie draftConfig
    useEffect(() => {
        if (!iframeRef.current?.contentWindow) return;

        iframeRef.current.contentWindow.postMessage(
            {
                type: 'WABEE_PREVIEW_UPDATE',
                payload: draftConfig
            },
            '*'
        );
    }, [draftConfig]);

    return (
        // Contenedor fijo de 380×600px — el widget se renderiza a tamaño real sin scale
        <div
            style={{
                width: '380px',
                height: '600px',
                flexShrink: 0,
                borderRadius: '16px',
                overflow: 'hidden',
                boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            }}
        >
            <iframe
                ref={iframeRef}
                title="Widget Preview"
                style={{
                    width: '380px',
                    height: '600px',
                    border: 'none',
                    display: 'block',
                }}
            />
        </div>
    );
};

export default WidgetPreviewFrame;
