import { useEffect, useMemo, useRef, useState } from 'react';
import { aiApi, AiProfile, WhatsAppTestResponse } from '@/api/wabee/ai.api';
import { S, T } from '@/lib/text-tokens';

interface TestMessage {
    id: string;
    role: 'user' | 'agent';
    text: string;
    timestamp: Date;
    meta?: WhatsAppTestResponse['meta'] | null;
    action?: string;
    handoffReason?: string | null;
}

interface Props {
    profile: AiProfile;
    onClose: () => void;
}

const QUICK_PROMPTS = [
    'Hola, quiero informes',
    '¿Cuáles son sus servicios?',
    'Quiero cotización',
    'Necesito un asesor'
];

const getAgentReply = (response: WhatsAppTestResponse) => {
    if (response.action === 'HANDOFF') return response.reply || 'Transferencia a humano iniciada.';
    if (response.action === 'NO_AI') return 'El agente IA no está activo para este perfil.';
    if (response.action === 'SKIP') return 'Conversación en modo humano. La IA está silenciada.';
    if (response.action === 'ERROR') return 'Error técnico al procesar el mensaje.';
    return response.reply || '(sin respuesta)';
};

const getModeLabel = (mode: 'AI_MANAGED' | 'HUMAN_HANDOFF' | 'DISABLED') => {
    if (mode === 'AI_MANAGED') return 'IA activa';
    if (mode === 'HUMAN_HANDOFF') return 'Handoff → humano';
    return 'Desactivado';
};

const getModeColor = (mode: 'AI_MANAGED' | 'HUMAN_HANDOFF' | 'DISABLED') => {
    if (mode === 'AI_MANAGED') return 'var(--status-success, var(--state-success))';
    if (mode === 'HUMAN_HANDOFF') return 'var(--status-warning, var(--state-warning))';
    return 'var(--status-danger, var(--state-danger))';
};

const WhatsAppAgentTestModal: React.FC<Props> = ({ profile, onClose }) => {
    const [messages, setMessages] = useState<TestMessage[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [sessionId, setSessionId] = useState<string | undefined>(undefined);
    const [convMode, setConvMode] = useState<'AI_MANAGED' | 'HUMAN_HANDOFF' | 'DISABLED'>('AI_MANAGED');
    const [lastLifecycle, setLastLifecycle] = useState<{ from: string; to: string; reason: string } | null>(null);
    const [lastMeta, setLastMeta] = useState<WhatsAppTestResponse['meta'] | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, loading]);

    const debugSummary = useMemo(() => {
        if (!lastMeta) return [];

        return [
            { label: 'Intención', value: lastMeta.debug?.intent || lastMeta.intent || 'Sin clasificar' },
            { label: 'Fuente', value: lastMeta.debug?.source || 'PROMPT' },
            { label: 'Tokens', value: String(lastMeta.debug?.tokens ?? lastMeta.tokensUsed ?? 0) },
            { label: 'Chunks KB', value: String(lastMeta.debug?.kbChunks ?? lastMeta.kbChunksUsed ?? 0) },
            { label: 'Tool', value: lastMeta.debug?.toolSelected || 'Ninguna' },
            { label: 'Servicio', value: lastMeta.debug?.activeService || 'Sin sesión activa' }
        ];
    }, [lastMeta]);

    const sendMessage = async () => {
        const text = input.trim();
        if (!text || loading) return;

        const userMsg: TestMessage = {
            id: `u_${Date.now()}`,
            role: 'user',
            text,
            timestamp: new Date()
        };

        setMessages((prev) => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const response = await aiApi.whatsappTest(profile.id, text, sessionId);

            if (!sessionId) setSessionId(response.sessionId);
            setConvMode(response.conversationMode);
            if (response.lifecycleTransition) setLastLifecycle(response.lifecycleTransition);
            setLastMeta(response.meta);

            const agentMsg: TestMessage = {
                id: `a_${Date.now()}`,
                role: 'agent',
                text: getAgentReply(response),
                timestamp: new Date(),
                meta: response.meta,
                action: response.action,
                handoffReason: response.handoffReason
            };

            setMessages((prev) => [...prev, agentMsg]);
        } catch (err: any) {
            const errMsg: TestMessage = {
                id: `e_${Date.now()}`,
                role: 'agent',
                text: `Error: ${err.message || 'Sin conexión con el servidor'}`,
                timestamp: new Date(),
                action: 'ERROR'
            };
            setMessages((prev) => [...prev, errMsg]);
        } finally {
            setLoading(false);
        }
    };

    const clearSession = async () => {
        if (sessionId) {
            try {
                await aiApi.clearWhatsappTestSession(profile.id, sessionId);
            } catch {
                // ignore cleanup errors in test mode
            }
        }

        setMessages([]);
        setInput('');
        setSessionId(undefined);
        setConvMode('AI_MANAGED');
        setLastLifecycle(null);
        setLastMeta(null);
    };

    const modeColor = getModeColor(convMode);
    const modeLabel = getModeLabel(convMode);

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm p-0 sm:items-center sm:p-4"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden bg-[var(--bg-page)] shadow-2xl sm:h-[85vh] sm:max-w-5xl sm:rounded-2xl sm:border sm:border-[var(--border-default)] lg:flex-row">
                <aside className="hidden w-80 shrink-0 border-r border-[var(--border-default)] bg-[var(--bg-surface)] lg:flex lg:flex-col">
                    <div className="border-b border-[var(--border-default)] p-5">
                        <div className="mb-2 flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--brand-primary)]/12 text-lg">
                                🤖
                            </div>
                            <div className="min-w-0">
                                <p className={`truncate ${T.cardTitle} ${S.headingSm}`}>{profile.agentName || profile.name}</p>
                                <p className={`${T.helperText} ${S.meta}`}>Modo de prueba - sin sandbox real</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`rounded-full px-2 py-0.5 ${T.badgeText} ${S.ui} ${profile.channelType === 'WHATSAPP' ? 'bg-green-500/10 text-green-500' : 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]'}`}>
                                {profile.channelType || 'WIDGET'}
                            </span>
                            <span className={`rounded-full px-2 py-0.5 ${T.badgeText} ${S.ui}`} style={{ backgroundColor: `${modeColor}20`, color: modeColor }}>
                                {modeLabel}
                            </span>
                        </div>
                    </div>

                    <div className="flex-1 space-y-5 overflow-y-auto p-5">
                        <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4">
                            <p className={`mb-3 ${T.sectionTitle} ${S.meta}`}>Configuración</p>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between gap-3">
                                    <span className={`${T.helperText} ${S.meta}`}>KB habilitada</span>
                                    <span className={`${T.inputText} ${S.body}`}>{profile.kbEnabled ? 'Sí' : 'No'}</span>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                    <span className={`${T.helperText} ${S.meta}`}>Documentos</span>
                                    <span className={`${T.inputText} ${S.body}`}>{profile._count?.kbFiles || 0}</span>
                                </div>
                                {sessionId && (
                                    <div className="pt-1">
                                        <p className={`mb-1 ${T.helperText} ${S.meta}`}>Session ID</p>
                                        <p className={`break-all font-mono ${S.meta}`} style={{ color: 'var(--brand-primary)' }}>{sessionId}</p>
                                    </div>
                                )}
                            </div>
                        </section>

                        {lastLifecycle && (
                            <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4">
                                <p className={`mb-3 ${T.sectionTitle} ${S.meta}`}>Lifecycle</p>
                                <div className="flex items-center gap-2 text-xs">
                                    <span className={`rounded-full border border-[var(--border-default)] px-2 py-1 font-mono ${S.meta}`}>{lastLifecycle.from}</span>
                                    <span className="text-[var(--brand-primary)]">→</span>
                                    <span className={`rounded-full bg-[var(--brand-primary)]/10 px-2 py-1 font-mono ${S.meta}`} style={{ color: 'var(--brand-primary)' }}>
                                        {lastLifecycle.to}
                                    </span>
                                </div>
                                <p className={`mt-2 ${T.helperText} ${S.meta}`}>{lastLifecycle.reason}</p>
                            </section>
                        )}

                        {debugSummary.length > 0 && (
                            <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4">
                                <p className={`mb-3 ${T.sectionTitle} ${S.meta}`}>Debug rápido</p>
                                <div className="space-y-2">
                                    {debugSummary.map((item) => (
                                        <div key={item.label} className="flex items-start justify-between gap-3">
                                            <span className={`${T.helperText} ${S.meta}`}>{item.label}</span>
                                            <span className={`text-right ${T.inputText} ${S.body}`}>{item.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}
                    </div>

                    <div className="border-t border-[var(--border-default)] p-5">
                        <button
                            onClick={clearSession}
                            disabled={messages.length === 0}
                            className={`w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-3 transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40 ${T.buttonText} ${S.ui}`}
                        >
                            Limpiar conversación
                        </button>
                    </div>
                </aside>

                <section className="flex min-h-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-3 border-b border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3 sm:px-6 sm:py-4 sm:items-center">
                        <div className="flex min-w-0 items-start gap-3 sm:items-center">
                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${profile.channelType === 'WHATSAPP' ? 'bg-green-500/10 text-green-500' : 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]'}`}>
                                {profile.channelType === 'WHATSAPP' ? (
                                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                                ) : (
                                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                                )}
                            </div>
                            <div className="min-w-0">
                                <p className={`truncate ${T.cardTitle} ${S.headingSm}`}>{profile.agentName || profile.name}</p>
                                <p className={`${T.helperText} ${S.meta}`}>Modo de prueba - sin sandbox real</p>
                                <div className="mt-1 flex flex-wrap items-center gap-2 lg:hidden">
                                    <span className={`rounded-full px-2 py-0.5 ${T.badgeText} ${S.ui}`} style={{ backgroundColor: `${modeColor}20`, color: modeColor }}>
                                        {modeLabel}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={onClose}
                            className={`shrink-0 rounded-full p-2 text-[var(--text-muted)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-strong)] ${S.ui}`}
                            aria-label="Cerrar"
                        >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto bg-[var(--bg-page)] px-4 py-4 sm:px-6 sm:py-5">
                        {messages.length === 0 ? (
                            <div className="flex min-h-full flex-col items-center justify-center text-center">
                                <div className="mb-4 text-4xl" aria-hidden="true">💬</div>
                                <p className={`${T.emptyStateTitle} ${S.headingLg} max-w-md text-balance`}>
                                    Escribe un mensaje para probar el agente
                                </p>
                                <p className={`mt-3 max-w-sm ${T.emptyStateBody} ${S.body}`}>
                                    Los mensajes se procesan con el flujo real del orquestador usando KB y el perfil configurado.
                                </p>

                                <div className="mt-6 grid w-full max-w-md grid-cols-1 gap-2 sm:grid-cols-2">
                                    {QUICK_PROMPTS.map((prompt) => (
                                        <button
                                            key={prompt}
                                            onClick={() => setInput(prompt)}
                                            className={`rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-2 text-left transition hover:border-[var(--brand-primary)]/40 hover:brightness-110 ${T.buttonText} ${S.ui}`}
                                        >
                                            {prompt}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {messages.map((msg) => (
                                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[88%] sm:max-w-[75%] ${msg.role === 'user' ? 'order-2' : 'order-1'}`}>
                                            {msg.role === 'agent' && (
                                                <div className="mb-1 flex items-center gap-1.5">
                                                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500/10 text-[10px]">🤖</div>
                                                    <span className={`font-bold ${T.helperText} ${S.meta}`}>{profile.agentName || 'Agente IA'}</span>
                                                    {msg.action && msg.action !== 'REPLY' && (
                                                        <span className={`rounded-full px-1.5 py-0.5 ${T.badgeText} ${S.ui} ${msg.action === 'HANDOFF' ? 'bg-amber-500/20 text-amber-500' : msg.action === 'ERROR' ? 'bg-red-500/20 text-red-500' : 'border border-[var(--border-default)] bg-[var(--bg-elevated)]'}`}>
                                                            {msg.action}
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            <div className={`whitespace-pre-wrap rounded-2xl px-4 py-3 ${msg.role === 'user' ? `rounded-br-sm bg-[var(--brand-primary)] ${T.buttonPrimaryText} ${S.body}` : msg.action === 'HANDOFF' ? 'rounded-bl-sm border border-amber-500/20 bg-amber-500/10 text-amber-300' : msg.action === 'ERROR' ? 'rounded-bl-sm border border-red-500/20 bg-red-500/10 text-red-300' : `rounded-bl-sm border border-[var(--border-default)] bg-[var(--bg-card)] ${T.messageText} ${S.body}`}`}>
                                                {msg.text}
                                            </div>

                                            {msg.handoffReason && (
                                                <p className="ml-1 mt-1 text-[9px] text-amber-400/70">Motivo: {msg.handoffReason}</p>
                                            )}

                                            <p className={`mt-1 ${msg.role === 'user' ? 'text-right' : 'ml-1 text-left'} ${T.helperText} ${S.meta} opacity-50`}>
                                                {msg.timestamp.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </div>
                                ))}

                                {loading && (
                                    <div className="flex justify-start">
                                        <div className="rounded-2xl rounded-bl-sm border border-[var(--border-default)] bg-[var(--bg-card)] px-5 py-3">
                                            <div className="flex items-center gap-1.5">
                                                <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--brand-primary)]" style={{ animationDelay: '0ms' }} />
                                                <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--brand-primary)]" style={{ animationDelay: '150ms' }} />
                                                <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--brand-primary)]" style={{ animationDelay: '300ms' }} />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div ref={messagesEndRef} />
                            </div>
                        )}
                    </div>

                    {convMode === 'HUMAN_HANDOFF' && (
                        <div className={`border-t border-amber-500/20 bg-amber-500/10 px-4 py-2 text-center text-amber-500 sm:px-6 ${T.messageText} ${S.meta}`}>
                            Conversación en modo HUMAN_HANDOFF. La IA no responderá hasta reiniciar la sesión.
                        </div>
                    )}

                    <div className="border-t border-[var(--border-default)] bg-[var(--bg-surface)] px-4 pt-3 pb-[calc(0.875rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-4">
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                sendMessage();
                            }}
                            className="flex items-center gap-2 sm:gap-3"
                        >
                            <input
                                autoFocus
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Escribe un mensaje como si fuera un cliente..."
                                disabled={loading}
                                className={`min-w-0 flex-1 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-4 py-3 transition placeholder-[var(--text-muted)]/40 focus:border-[var(--brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/40 disabled:opacity-50 ${T.inputText} ${S.body}`}
                            />
                            <button
                                type="submit"
                                disabled={!input.trim() || loading}
                                className={`flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--brand-primary)] px-4 py-3 transition hover:brightness-110 active:scale-95 disabled:opacity-40 sm:px-5 ${T.buttonPrimaryText} ${S.body}`}
                                aria-label="Enviar mensaje"
                            >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                                <span className="hidden sm:inline">Enviar</span>
                            </button>
                        </form>
                        <p className={`mt-2 text-center ${T.helperText} ${S.meta}`}>
                            Prueba aislada - no afecta el inbox real ni contactos reales.
                        </p>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default WhatsAppAgentTestModal;
