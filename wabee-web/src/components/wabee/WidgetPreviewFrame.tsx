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
        html, body {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            background: transparent;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            overflow: hidden;
        }

        #wabee-widget-root {
            position: relative !important;
            inset: auto !important;
            width: 100% !important;
            height: 100% !important;
            z-index: 1 !important;
        }

        .wabee-launcher {
            display: none !important;
        }

        .wabee-window {
            position: relative !important;
            display: flex !important;
            flex-direction: column !important;
            width: 100% !important;
            height: 100% !important;
            max-height: none !important;
            inset: auto !important;
            transform: none !important;
            opacity: 1 !important;
            visibility: visible !important;
            animation: none !important;
        }

        .wabee-messages {
            flex: 1 !important;
            overflow-y: auto !important;
        }
    </style>
</head>
<body>
    <script>
        window.__WABEE_PREVIEW__ = true;
        window.__WABEE_AUTO_OPEN__ = true;
        window.__WABEE_PREVIEW_TOKEN__ = "${previewToken}";
        window.__WABEE_PREVIEW_API_BASE__ = "${apiBaseUrl}";
        window.WabeeWidgetConfig = {
            widgetId: "${widgetId}"
        };
        window.__WABEE_PREVIEW_CONFIG__ = ${JSON.stringify(draftConfig)};
    </script>

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

    useEffect(() => {
        if (!iframeRef.current?.contentWindow) return;

        iframeRef.current.contentWindow.postMessage(
            {
                type: 'WABEE_PREVIEW_UPDATE',
                payload: draftConfig,
            },
            '*'
        );
    }, [draftConfig]);

    return (
        <div
            className="w-full max-w-[380px] overflow-hidden rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
            style={{
                aspectRatio: '19 / 30',
            }}
        >
            <iframe
                ref={iframeRef}
                title="Widget Preview"
                className="block h-full w-full border-0 bg-transparent"
            />
        </div>
    );
};

export default WidgetPreviewFrame;
