
import React, { useState } from 'react';
import { ClipboardIcon, CheckIcon, AdjustmentsHorizontalIcon, EyeIcon } from '@heroicons/react/24/outline';
import { T, S } from '@/lib/text-tokens';

interface WidgetInstallationPanelProps {
    draftConfig: any;
    setDraftConfig: (config: any) => void;
    widgetId: string;
}

const WidgetInstallationPanel: React.FC<WidgetInstallationPanelProps> = ({
    draftConfig,
    setDraftConfig,
    widgetId,
}) => {
    const [copied, setCopied] = useState(false);

    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    let apiBaseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:4000/v1').replace(/\/v1\/?$/, '');

    // Evitar exponer localhost en producción si olvidaron compilar el .env.production
    if (!isLocalhost && apiBaseUrl.includes('localhost')) {
        apiBaseUrl = 'https://TU_BACKEND';
    }

    const scriptUrl = `${apiBaseUrl}/v1/wabee-widget.js`;
    const isHttps = apiBaseUrl.startsWith('https://');

    // Valores del tema configurados
    const theme = draftConfig.theme || {};
    const content = draftConfig.content || {};
    const primaryColor = theme.primaryColor || '#16a34a';
    const radius = theme.radius ?? 16;
    const position = theme.position || 'bottom-right';
    const title = content.title || draftConfig.title || 'Chat';
    const subtitle = content.subtitle || draftConfig.subtitle || '';
    const welcomeMessage = content.welcomeMessage || draftConfig.welcomeMessage || '¡Hola! ¿En qué te ayudamos?';

    const snippet = `
<!-- WABEE Widget -->
<script>
  window.WabeeWidgetConfig = {
    widgetId: "${widgetId}"
  };
</script>
<script src="${scriptUrl}"></script>
<!-- End WABEE Widget -->
`.trim();

    const handleCopy = () => {
        navigator.clipboard.writeText(snippet);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-8">
            <header className="space-y-0.5">
                <h2 className={`${T.sectionTitle} text-xl uppercase italic tracking-tighter`}>Despliegue e <span className="text-[var(--brand-primary)]">Instalación</span></h2>
                <p className={`${T.pageSubtitle} text-[11px]`}>Copia el fragmento e intégralo en tu web con un solo paso.</p>
            </header>

            {/* ── Mini Preview del Widget ── */}
            <div className="bg-[var(--bg-card)] rounded-xl p-3.5 border border-[var(--border-default)] shadow-2xl space-y-3 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[60px] pointer-events-none" />

                <div className="flex items-center gap-2.5">
                    <div className="h-6 w-6 bg-blue-500/10 rounded-lg flex items-center justify-center border border-blue-500/20">
                        <EyeIcon className="h-3.5 w-3.5 text-blue-400" />
                    </div>
                    <div>
                        <h3 className={`${T.cardTitle} text-sm uppercase`}>Vista Previa</h3>
                        <p className={`${T.cardSubtitle} text-[9px] uppercase tracking-widest opacity-80`}>Aspecto según tu configuración</p>
                    </div>
                </div>

                {/* Área de demo del widget */}
                <div
                    className="relative bg-[var(--bg-input)] rounded-lg overflow-hidden border border-[var(--border-default)] p-4 flex items-end gap-3"
                    style={{ minHeight: '220px' }}
                >
                    {/* Indicador de posición */}
                    <div className={`absolute top-2 text-[8px] font-black uppercase tracking-widest opacity-40 ${T.helperText} ${position === 'bottom-left' ? 'left-3' : 'right-3'}`}>
                        {position === 'bottom-left' ? '← Izquierda' : 'Derecha →'}
                    </div>

                    {/* Mini chat window */}
                    <div
                        className={`flex flex-col overflow-hidden shadow-xl transition-all duration-500 ${position === 'bottom-left' ? 'mr-auto' : 'ml-auto'}`}
                        style={{
                            width: '200px',
                            borderRadius: `${radius}px`,
                            border: '1px solid #e2e8f0',
                        }}
                    >
                        {/* Header */}
                        <div
                            className="px-3 py-2 flex items-center justify-between gap-2"
                            style={{
                                backgroundColor: primaryColor,
                                borderTopLeftRadius: `${Math.max(0, radius - 1)}px`,
                                borderTopRightRadius: `${Math.max(0, radius - 1)}px`,
                            }}
                        >
                            <div className="flex flex-col">
                                <span className="text-white font-black text-[10px] leading-tight truncate">{title}</span>
                                {subtitle && <span className="text-white/80 text-[8px] leading-tight truncate">{subtitle}</span>}
                            </div>
                            <span className="text-white/70 text-[10px] cursor-pointer shrink-0">✕</span>
                        </div>

                        {/* Messages */}
                        <div className="bg-[#fcfcfc] px-2 py-2 flex flex-col gap-1.5 flex-1" style={{ minHeight: '80px' }}>
                            <div
                                className="text-[9px] text-[#334155] leading-relaxed px-2 py-1.5 border border-[#e2e8f0] max-w-[90%] self-start"
                                style={{ borderRadius: `${radius}px`, borderBottomLeftRadius: '3px' }}
                            >
                                {welcomeMessage.length > 50 ? welcomeMessage.substring(0, 50) + '...' : welcomeMessage}
                            </div>
                            {/* Mensaje de ejemplo del usuario */}
                            <div
                                className="text-[9px] text-white leading-relaxed px-2 py-1.5 max-w-[80%] self-end"
                                style={{ backgroundColor: primaryColor, borderRadius: `${radius}px`, borderBottomRightRadius: '3px' }}
                            >
                                Hola, necesito ayuda
                            </div>
                        </div>

                        {/* Input area */}
                        <div className="bg-white border-t border-[#eee] px-2 py-1.5 flex gap-1.5 items-center">
                            <div
                                className="flex-1 h-5 bg-[#f8f8f8] border border-[#e2e8f0] text-[8px] text-[#94a3b8] flex items-center px-2"
                                style={{ borderRadius: `${radius}px` }}
                            >
                                Escribe un mensaje...
                            </div>
                            <button
                                className="text-[8px] text-white font-black px-2 py-1 shrink-0"
                                style={{ backgroundColor: primaryColor, borderRadius: `${radius}px` }}
                            >
                                Send
                            </button>
                        </div>

                        {/* Branding */}
                        <div className="bg-white text-center py-0.5">
                            <span className="text-[7px] text-[#94a3b8]">Con tecnología de WABEE</span>
                        </div>
                    </div>

                    {/* Launcher bubble */}
                    <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center shadow-lg shrink-0 ${position === 'bottom-left' ? 'order-first' : 'order-last'}`}
                        style={{ backgroundColor: primaryColor }}
                    >
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
                            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
                        </svg>
                    </div>
                </div>

                <p className={`${T.helperText} text-[9px] italic opacity-80 px-1`}>
                    Esta es una representación visual. El widget real se carga vía el script de instalación.
                </p>
            </div>

            {/* ── Snippet de código ── */}
            <div className="bg-[var(--bg-input)] rounded-xl overflow-hidden shadow-2xl border border-[var(--border-default)] group">
                <div className="flex justify-between items-center px-4 py-2 bg-[var(--bg-card)] border-b border-[var(--border-default)]">
                    <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/30"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500/30"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500/30"></div>
                        <span className={`ml-2 text-[10px] font-black uppercase tracking-widest opacity-80 ${T.helperText}`}>Wabee Snippet .html</span>
                    </div>
                    <button
                        onClick={handleCopy}
                        className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-xl transition-all active:scale-95 ${copied ? 'bg-green-500/10 text-green-500' : 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] border border-[var(--brand-primary)]/20 hover:bg-[var(--brand-primary)] hover:text-white'}`}
                    >
                        {copied ? <CheckIcon className="h-4 w-4 stroke-[3px]" /> : <ClipboardIcon className="h-4 w-4 stroke-[3px]" />}
                        {copied ? 'Sistema Copiado' : 'Copiar Fragmento'}
                    </button>
                </div>
                <div className="p-4 overflow-x-auto bg-[var(--bg-input)] brightness-50">
                    <pre className="text-[11px] font-mono text-[var(--brand-primary)] whitespace-pre-wrap leading-relaxed selection:bg-[var(--brand-primary)]/20 opacity-80">
                        {snippet}
                    </pre>
                </div>
            </div>

            {!isHttps && !isLocalhost && (
                <div className="flex items-start gap-4 text-xs text-red-400 bg-red-500/5 p-6 rounded-[32px] border border-red-500/20 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 blur-[50px] pointer-events-none"></div>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 shrink-0 text-red-500 opacity-50">
                        <path fillRule="evenodd" d="M9.401 3.003c.115-.224.347-.348.599-.348s.484.124.599.348l7.023 13.664a.675.675 0 0 1-.599.985H2.977a.675.675 0 0 1-.599-.985l7.023-13.664Zm.599 10.622a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0-7.125a.75.75 0 0 0-.75.75v3.375a.75.75 0 0 0 1.5 0V7.25a.75.75 0 0 0-.75-.75Z" clipRule="evenodd" />
                    </svg>
                    <div className="space-y-1">
                        <p className="font-black uppercase tracking-widest text-red-500 text-[10px]">Protocolo de Inseguridad detectado</p>
                        <p className="text-[#a0a080] font-medium leading-relaxed italic opacity-80">
                            Estás utilizando una URL no cifrada (HTTP). El widget requiere un entorno <strong>HTTPS</strong> certificado para operar en dominios externos de producción.
                        </p>
                    </div>
                </div>
            )}

            {/* Seguridad / Dominios */}
            <div className="bg-[var(--bg-card)] rounded-xl p-3.5 border border-[var(--border-default)] shadow-2xl space-y-4 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-[60px] pointer-events-none"></div>

                <div className="flex items-center gap-3">
                    <div className="h-7 w-7 bg-emerald-500/10 rounded-lg flex items-center justify-center border border-emerald-500/20">
                        <AdjustmentsHorizontalIcon className="h-3.5 w-3.5 text-emerald-500" />
                    </div>
                    <div>
                        <h3 className={`${T.cardTitle} text-sm uppercase italic`}>Seguridad</h3>
                        <p className={`${T.cardSubtitle} text-[8px] uppercase tracking-widest opacity-80`}>Whitelist</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className={`${T.labelText} ${S.meta} text-[10px] uppercase tracking-[0.2em] block px-1 text-emerald-400`}>Lista Blanca de Dominios</label>
                        <input
                            type="text"
                            name="domainAllowed"
                            value={draftConfig.domainAllowed || ''}
                            onChange={(e) => setDraftConfig({ ...draftConfig, domainAllowed: e.target.value })}
                            placeholder="ejemplo.com, localhost"
                            className={`ui-input ${T.inputText} ${S.body} shadow-inner`}
                        />
                        <p className={`${T.helperText} text-[9px] px-1 italic`}>Utiliza comas para separar los dominios donde el widget podrá ejecutarse.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WidgetInstallationPanel;

