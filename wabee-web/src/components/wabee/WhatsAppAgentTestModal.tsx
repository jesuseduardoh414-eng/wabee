import { useState, useRef, useEffect } from 'react';
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
    }, [messages]);

    const sendMessage = async () => {
        const text = input.trim();
        if (!text || loading) return;

        const userMsg: TestMessage = {
            id: `u_${Date.now()}`,
            role: 'user',
            text,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const response = await aiApi.whatsappTest(profile.id, text, sessionId);

            if (!sessionId) setSessionId(response.sessionId);
            setConvMode(response.conversationMode);
            if (response.lifecycleTransition) setLastLifecycle(response.lifecycleTransition);
            setLastMeta(response.meta);

            const agentText =
                response.action === 'HANDOFF' ? (response.reply || '⚠️ Transferencia a humano iniciada.') :
                    response.action === 'NO_AI' ? '⛔ El agente IA no está activo para este perfil.' :
                        response.action === 'SKIP' ? '⏭️ Conversación en modo HUMANO — IA silenciada.' :
                            response.action === 'ERROR' ? '❌ Error técnico al procesar el mensaje.' :
                                (response.reply || '(sin respuesta)');

            const agentMsg: TestMessage = {
                id: `a_${Date.now()}`,
                role: 'agent',
                text: agentText,
                timestamp: new Date(),
                meta: response.meta,
                action: response.action,
                handoffReason: response.handoffReason
            };

            setMessages(prev => [...prev, agentMsg]);
        } catch (err: any) {
            const errMsg: TestMessage = {
                id: `e_${Date.now()}`,
                role: 'agent',
                text: `❌ Error: ${err.message || 'Sin conexión con el servidor'}`,
                timestamp: new Date(),
                action: 'ERROR'
            };
            setMessages(prev => [...prev, errMsg]);
        } finally {
            setLoading(false);
        }
    };

    const clearSession = async () => {
        if (sessionId) {
            try {
                await aiApi.clearWhatsappTestSession(profile.id, sessionId);
            } catch { /* silent */ }
        }
        setMessages([]);
        setSessionId(undefined);
        setConvMode('AI_MANAGED');
        setLastLifecycle(null);
        setLastMeta(null);
    };

    const modeColor = convMode === 'AI_MANAGED' ? 'var(--status-success, var(--state-success))' : convMode === 'HUMAN_HANDOFF' ? 'var(--status-warning, var(--state-warning))' : 'var(--status-danger, var(--state-danger))';
    const modeLabel = convMode === 'AI_MANAGED' ? 'IA Activa' : convMode === 'HUMAN_HANDOFF' ? 'Handoff → Humano' : 'Desactivado';

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="bg-[var(--bg-page)] border border-[var(--border-default)] rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex overflow-hidden">

                {/* ── Panel Lateral: Info del agente ─────────────────── */}
                <div className="w-72 flex-shrink-0 bg-[var(--bg-surface)] border-r border-[var(--border-default)] flex flex-col">
                    <div className="p-5 border-b border-[var(--border-default)]">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-xl">🤖</span>
                            <span className={`truncate ${T.cardTitle} ${S.headingSm}`}>{profile.agentName || profile.name}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full ${T.badgeText} ${S.ui} ${profile.channelType === 'WHATSAPP' ? 'bg-green-500/10 text-green-500' : 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]'}`}>{profile.channelType || 'WIDGET'}</span>
                        <p className={`mt-2 truncate ${T.helperText} ${S.meta}`}>{profile.name}</p>
                    </div>

                    {/* Estado Conversacional */}
                    <div className="p-4 border-b border-[var(--border-default)] space-y-3">
                        <div>
                            <p className={`mb-1 ${T.sectionTitle} ${S.meta}`}>Estado Conversacional</p>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: modeColor }} />
                                <span className="text-xs font-bold" style={{ color: modeColor }}>{modeLabel}</span>
                            </div>
                        </div>

                        {lastLifecycle && (
                            <div>
                                <p className={`mb-1 ${T.sectionTitle} ${S.meta}`}>Lifecycle</p>
                                <div className="flex items-center gap-1 text-xs">
                                    <span className={`px-1.5 py-0.5 bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded font-mono ${S.meta}`}>{lastLifecycle.from}</span>
                                    <span className="text-[var(--brand-primary)]">→</span>
                                    <span className={`px-1.5 py-0.5 bg-[var(--brand-primary)]/10 rounded font-mono ${S.body}`} style={{ color: 'var(--brand-primary)' }}>{lastLifecycle.to}</span>
                                </div>
                                <p className={`mt-1 italic ${T.helperText} ${S.meta}`}>{lastLifecycle.reason}</p>
                            </div>
                        )}
                    </div>

                            {/* Panel de Depuración Mejorado */}
                            {lastMeta && (
                                <div className="p-4 border-b border-[var(--border-default)] flex-1 overflow-y-auto custom-scrollbar">
                                    <p className={`tracking-wider mb-3 ${T.sectionTitle} ${S.meta}`}>Debug de Decisión</p>
                            
                            <div className="space-y-4">
                                {/* Intención y Fuente */}
                                <div className="space-y-1.5">
                                    <div className="flex justify-between items-center">
                                        <span className={`${T.helperText} ${S.meta}`}>Intención</span>
                                        <span className={`font-mono font-bold bg-[var(--brand-primary)]/10 px-1.5 py-0.5 rounded ${S.body}`} style={{ color: 'var(--brand-primary)' }}>{lastMeta.debug?.intent || lastMeta.intent}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[10px]">
                                        <span className={`${T.helperText} ${S.meta}`}>Fuente</span>
                                        <span className={`font-bold px-1.5 py-0.5 rounded ${
                                            lastMeta.debug?.source === 'TOOL' ? 'bg-blue-500/20 text-blue-400' :
                                            lastMeta.debug?.source === 'KB' ? 'bg-green-500/20 text-green-400' :
                                            'bg-[var(--bg-elevated)] [color:var(--text-strong)]'
                                        } ${T.badgeText} ${S.ui}`}>{lastMeta.debug?.source || 'PROMPT'}</span>
                                    </div>
                                </div>

                                {/* Tools Gating */}
                                <div className="space-y-1.5">
                                    <p className={`${T.helperText} ${S.meta}`}>Tools Disponibles ({lastMeta.debug?.toolsAvailable?.length || 0})</p>
                                    <div className="flex flex-wrap gap-1">
                                        {lastMeta.debug?.toolsAvailable?.length ? lastMeta.debug.toolsAvailable.map(t => (
                                            <span key={t} className={`bg-[var(--bg-page)] border border-[var(--border-default)] text-[var(--text-muted)] px-1.5 py-0.5 rounded ${T.badgeText} ${S.ui}`}>{t}</span>
                                        )) : <span className={`italic ${T.helperText} ${S.meta} opacity-40`}>Ninguna habilitada</span>}
                                    </div>
                                </div>

                                {/* Ejecución de Tool */}
                                {lastMeta.debug?.toolSelected && (
                                    <div className="space-y-2 pt-2 border-t border-[var(--border-default)]">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[10px]">⚙️</span>
                                            <span className={`text-blue-500 font-bold font-mono ${S.body}`}>{lastMeta.debug.toolSelected}</span>
                                        </div>
                                        
                                        {lastMeta.debug.toolPayload && (
                                            <div className="space-y-1">
                                                <p className={`${T.helperText} ${S.meta}`}>Payload</p>
                                                <pre className={`bg-[var(--bg-surface)] p-2 rounded border border-[var(--border-default)] text-[var(--text-muted)] overflow-x-auto ${S.meta}`}>
                                                    {JSON.stringify(lastMeta.debug.toolPayload, null, 2)}
                                                </pre>
                                            </div>
                                        )}

                                        {lastMeta.debug.toolResult && (
                                            <div className="space-y-1">
                                                <p className={`${T.helperText} ${S.meta}`}>Resultado</p>
                                                <div className="max-h-32 overflow-y-auto bg-[var(--bg-surface)] p-2 rounded border border-[var(--border-default)] custom-scrollbar">
                                                    <pre className={`text-green-500 font-mono ${S.meta}`}>
                                                        {JSON.stringify(lastMeta.debug.toolResult, null, 2)}
                                                    </pre>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* AI Service Session Engine */}
                                {lastMeta?.debug?.activeService && (
                                    <div className="space-y-1.5 pt-2 border-t border-[var(--border-default)] pb-2">
                                        <div className="flex justify-between items-center">
                                            <p className={`${T.sectionTitle} ${S.meta}`}>Service Session Engine</p>
                                            <div className="flex gap-1">
                                                {lastMeta?.debug?.serviceIntentType === 'TRANSACTION' ? (
                                                     <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-1 rounded border border-emerald-500/30 font-bold">TRANSACTION</span>
                                                ) : (
                                                     <span className="text-[8px] bg-blue-500/20 text-blue-400 px-1 rounded border border-blue-500/30 font-bold">INFO</span>
                                                )}
                                                {lastMeta?.debug?.serviceLockReason && (
                                                     <span className="text-[8px] bg-amber-500/20 text-amber-400 px-1 rounded border border-amber-500/30 font-bold" title={lastMeta?.debug?.serviceLockReason}>LOCKED</span>
                                                )}
                                            </div>
                                        </div>
                                        
                                        <div className="flex justify-between items-center text-[10px]">
                                            <span className={`text-[var(--text-muted)] ${S.meta}`}>Servicio Activo</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-emerald-400 font-bold font-mono">
                                                    {lastMeta?.debug?.activeService}
                                                </span>
                                                <span className={`text-[9px] text-[var(--text-muted)]/60 font-mono ${S.meta}`}>
                                                    {Math.round((lastMeta?.debug?.serviceConfidence || 0) * 100)}%
                                                </span>
                                            </div>
                                        </div>

                                        {lastMeta?.debug?.serviceSwitchDetected && (
                                            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded px-1.5 py-1 mt-1 flex flex-col gap-0.5 animate-in fade-in slide-in-from-top-1 duration-500">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[10px]">🔄</span>
                                                    <span className="text-[8px] text-emerald-400 font-bold uppercase">
                                                        Service Switch: {lastMeta.debug.previousServiceId} ➔ {lastMeta.debug.activeService}
                                                    </span>
                                                </div>
                                                <span className="text-[7px] text-emerald-500/70 font-mono ml-4 italic">
                                                    Motivo: {lastMeta.debug.serviceSwitchReason?.replace(/_/g, ' ')}
                                                </span>
                                            </div>
                                        )}


                                        {lastMeta?.debug?.enoughContextToRespond && (
                                            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded px-1.5 py-0.5 mt-1 flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                                                <span className="text-[8px] text-indigo-300 font-bold uppercase">Suficiencia: Puede responder con KB</span>
                                            </div>
                                        )}

                                        {lastMeta?.debug?.nextSuggestedSlot && (
                                            <div className="flex justify-between items-center text-[10px] pt-0.5">
                                                <span className={`text-[var(--text-muted)] ${S.meta}`}>Sugerencia Próximo Dato</span>
                                                <span className={`font-mono bg-[var(--brand-primary)]/10 px-1 py-0.5 rounded ${S.body}`} style={{ color: 'var(--brand-primary)' }}>
                                                    {lastMeta?.debug?.nextSuggestedSlot}
                                                </span>
                                            </div>
                                        )}

                                        {lastMeta?.debug?.slotCaptureBlockedReason && (
                                            <div className="bg-red-500/10 border border-red-500/20 rounded px-1.5 py-1 mt-1 flex items-center gap-1.5">
                                                <span className="text-[10px]">🛡️</span>
                                                <span className="text-[8px] text-red-400 font-bold uppercase">
                                                    Captura bloqueada: {lastMeta.debug.slotCaptureBlockedReason.replace(/_/g, ' ')}
                                                </span>
                                            </div>
                                        )}

                                        {lastMeta?.debug?.fallbackApplied && (
                                            <div className="bg-amber-500/10 border border-amber-500/20 rounded px-1.5 py-1 mt-1 flex items-center gap-1.5">
                                                <span className="text-[10px]">⚠️</span>
                                                <span className="text-[8px] text-amber-400 font-bold uppercase">
                                                    Fallback aplicado: Error en motores secundarios
                                                </span>
                                            </div>
                                        )}

                                        <div className="flex gap-2 mt-2 border-t border-[var(--border-default)] pt-1.5 opacity-60">
                                            <div className="flex items-center gap-1">
                                                <div className={`w-1 h-1 rounded-full ${lastMeta?.debug?.serviceStateLoaded ? 'bg-green-500' : 'bg-[#404035]'}`}></div>
                                                <span className={`text-[7px] uppercase font-bold text-[var(--text-muted)] ${S.meta}`}>SvcState</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <div className={`w-1 h-1 rounded-full ${lastMeta?.debug?.entityMemoryLoaded ? 'bg-green-500' : 'bg-[#404035]'}`}></div>
                                                <span className={`text-[7px] uppercase font-bold text-[var(--text-muted)] ${S.meta}`}>EntMem</span>
                                            </div>
                                        </div>

                                        {lastMeta?.debug?.collectedData && Object.keys(lastMeta.debug?.collectedData).length > 0 && (
                                            <div className="pt-1">
                                                <p className={`mb-1 ${T.helperText} ${S.meta}`}>Slots de Servicio</p>
                                                <div className="bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded p-1.5 font-mono text-[9px]">
                                                    {Object.entries(lastMeta.debug?.collectedData || {}).map(([k, v]) => (
                                                        <div key={k} className="flex justify-between border-b border-[var(--border-default)] last:border-0 py-0.5">
                                                            <span className={`${T.helperText} ${S.meta} opacity-60`}>{k}:</span>
                                                            <span className="text-emerald-500 ml-2 text-right break-all">{String(v)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Customer Memory Breakdown */}
                                        {lastMeta?.debug?.customerMemory && (
                                            <div className="pt-2 border-t border-[var(--border-default)] mt-2">
                                                <p className={`text-[8px] text-[var(--text-muted)] font-bold uppercase mb-1 ${S.meta}`}>Memoria del Cliente</p>
                                                <div className="space-y-1.5">
                                                    {/* Explicit Profile */}
                                                    {Object.keys(lastMeta.debug.customerMemory.explicitProfileData || {}).length > 0 && (
                                                        <div className="bg-[var(--bg-elevated)] border border-blue-500/20 rounded p-1">
                                                            <p className={`mb-0.5 px-0.5 text-blue-500 font-bold uppercase text-[7px] ${S.meta}`}>Perfil Explícito</p>
                                                            {Object.entries(lastMeta.debug.customerMemory.explicitProfileData).map(([k, v]) => (
                                                                <div key={k} className="flex justify-between text-[9px] px-1">
                                                                    <span className={`${T.helperText} ${S.meta} opacity-60`}>{k}:</span>
                                                                    <span className="text-blue-500 font-mono">{String(v)}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {/* Soft Preferences */}
                                                    <div className="bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded p-1">
                                                        <p className={`mb-1 px-0.5 ${T.helperText} ${S.meta}`}>Intereses (Pesos)</p>
                                                        <div className="space-y-1 px-0.5">
                                                            <div className="flex flex-col gap-0.5">
                                                                <div className="flex justify-between text-[8px]">
                                                                    <span className={`text-[var(--text-muted)] ${S.meta}`}>Viajes</span>
                                                                    <span className="text-emerald-400">{(lastMeta.debug.customerMemory.softPreferences.travelWeight * 100).toFixed(0)}%</span>
                                                                </div>
                                                                <div className="h-0.5 w-full bg-[var(--border-default)] rounded-full overflow-hidden">
                                                                    <div className="h-full bg-emerald-500" style={{ width: `${lastMeta.debug.customerMemory.softPreferences.travelWeight * 100}%` }}></div>
                                                                </div>
                                                            </div>
                                                            <div className="flex flex-col gap-0.5">
                                                                <div className="flex justify-between text-[8px]">
                                                                    <span className={`text-[var(--text-muted)] ${S.meta}`}>Paquetería</span>
                                                                    <span className="text-blue-400">{(lastMeta.debug.customerMemory.softPreferences.shippingWeight * 100).toFixed(0)}%</span>
                                                                </div>
                                                                <div className="h-0.5 w-full bg-[var(--border-default)] rounded-full overflow-hidden">
                                                                    <div className="h-full bg-blue-500" style={{ width: `${lastMeta.debug.customerMemory.softPreferences.shippingWeight * 100}%` }}></div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {/* Recent Context */}
                                                    {Object.keys(lastMeta.debug.customerMemory.recentContext || {}).length > 0 && (
                                                        <div className="bg-[var(--bg-elevated)] border border-amber-500/20 rounded p-1">
                                                            <p className="text-[7px] text-amber-400 font-bold uppercase mb-0.5 px-0.5">Contexto Reciente</p>
                                                            {Object.entries(lastMeta.debug.customerMemory.recentContext).map(([k, v]) => (
                                                                <div key={k} className="flex justify-between text-[8px] px-1">
                                                                    <span className={`text-[var(--text-muted)]/60 text-[7px] ${S.meta}`}>{k}:</span>
                                                                    <span className="text-amber-200 font-mono truncate max-w-[100px]">{String(v)}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Contexto Conversacional */}
                                {lastMeta.debug && (
                                    <div className="space-y-1.5 pt-2 border-t border-[var(--border-default)]">
                                        <p className={`text-[9px] ${T.sectionTitle} ${S.meta}`}>Contexto Conversacional</p>
                                        <div className="flex justify-between items-center text-[10px]">
                                            <span className={`${T.helperText} ${S.meta}`}>Referencia detectada</span>
                                            <span className={lastMeta.debug.contextualReferenceDetected ? 'text-purple-400 font-bold' : `text-[var(--text-muted)] ${S.meta}`}>
                                                {lastMeta.debug.contextualReferenceDetected ? 'SÍ ✓' : 'no'}
                                            </span>
                                        </div>
                                        {lastMeta.debug.contextualReferenceDetected && lastMeta.debug.contextualReferenceResolvedTo && (
                                            <div className="space-y-1">
                                                <p className={`text-[8px] text-[var(--text-muted)] font-bold uppercase ${S.meta}`}>Resuelta a</p>
                                                <div className="bg-purple-500/10 border border-purple-500/20 p-2 rounded text-purple-300 font-mono text-[9px]">
                                                    {lastMeta.debug.contextualReferenceResolvedTo}
                                                </div>
                                            </div>
                                        )}
                                        
                                        {lastMeta.debug.activeEntityValue && (
                                            <div className="flex justify-between items-center text-[10px] pt-1">
                                                <span className={`text-[var(--text-muted)] ${S.meta}`}>Entidad Activa ({lastMeta.debug.activeEntityType || 'N/A'})</span>
                                                <span className="text-blue-400 font-mono truncate max-w-[120px]" title={lastMeta.debug.activeEntityValue}>
                                                    {lastMeta.debug.activeEntityValue}
                                                </span>
                                            </div>
                                        )}

                                        {lastMeta.debug.personaGuardrailsApplied && (
                                            <div className="flex justify-between items-center text-[10px] pt-1 border-t border-[var(--border-default)] mt-1">
                                                <span className={`text-[var(--text-muted)] ${S.meta}`}>Anti-Alucinación (Contactos)</span>
                                                <span className="text-green-500 font-bold">ACTIVO 🛡️</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Diagnóstico de KB */}
                                {lastMeta.debug?.kbTried && (
                                    <div className="pt-2 border-t border-[var(--border-default)] space-y-2">
                                        <p className={`text-[9px] text-[var(--text-muted)] font-bold uppercase ${S.meta}`}>Diagnóstico KB</p>
                                        
                                        <div className="grid grid-cols-2 gap-2 text-[9px]">
                                            <div className="flex justify-between items-center bg-[var(--bg-elevated)] p-1.5 rounded border border-[var(--border-default)]">
                                                <span className={`text-[var(--text-muted)] ${S.meta}`}>Retrieval</span>
                                                <span className={lastMeta.debug.kbUsed ? 'text-green-500 font-bold' : 'text-amber-500 font-bold'}>
                                                    {lastMeta.debug.kbUsed ? 'EXITOSO' : 'OMITIDO'}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center bg-[var(--bg-elevated)] p-1.5 rounded border border-[var(--border-default)]">
                                                <span className={`text-[var(--text-muted)] ${S.meta}`}>Best Score</span>
                                                <span className={`text-[var(--text-strong)] font-mono ${S.body}`}>{lastMeta.debug.kbBestScore?.toFixed(2) || '0.00'}</span>
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <p className={`text-[8px] text-[var(--text-muted)] font-bold uppercase ${S.meta}`}>Query para KB</p>
                                            <div className={`bg-[var(--bg-page)] p-2 rounded border border-[var(--border-default)] font-mono text-[9px] truncate ${S.body}`} style={{ color: 'var(--brand-primary)' }}>
                                                "{lastMeta.debug.kbQueryUsed || '-'}"
                                            </div>
                                        </div>

                                        {lastMeta.debug.kbSkipReason && !lastMeta.debug.kbUsed && (
                                            <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded">
                                                <span className="text-[10px]">⚠️</span>
                                                <span className="text-[8px] text-amber-500 font-bold uppercase">
                                                    Motivo: {lastMeta.debug.kbSkipReason.replace(/_/g, ' ')}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Métricas */}
                                <div className="pt-2 border-t border-[var(--border-default)] space-y-1">
                                    <div className="flex justify-between text-[10px]">
                                        <span className={`${T.helperText} ${S.meta}`}>KB Chunks</span>
                                        <span className={`${T.inputText} ${S.meta} font-mono`}>{lastMeta.debug?.kbChunks ?? lastMeta.kbChunksUsed}</span>
                                    </div>
                                    <div className="flex justify-between text-[10px]">
                                        <span className={`${T.helperText} ${S.meta}`}>Tokens</span>
                                        <span className={`${T.inputText} ${S.meta} font-mono`}>{lastMeta.debug?.tokens ?? lastMeta.tokensUsed}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* KB info */}
                    <div className="p-4 flex-1">
                        <p className={`tracking-wider mb-2 ${T.sectionTitle} ${S.meta}`}>Configuración</p>
                        <div className="space-y-1">
                            <div className="flex justify-between items-center">
                                <span className={`${T.helperText} ${S.meta}`}>KB habilitada</span>
                                <span className={`font-bold ${S.body} ${profile.kbEnabled ? 'text-green-500' : 'text-red-400'}`}>{profile.kbEnabled ? 'Sí' : 'No'}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className={`${T.helperText} ${S.meta}`}>Documentos</span>
                                <span className={`${T.inputText} ${S.body} font-bold`}>{profile._count?.kbFiles || 0}</span>
                            </div>
                            {sessionId && (
                                <div className="mt-3">
                                    <span className={`block mb-0.5 ${T.helperText} ${S.meta}`}>Session ID</span>
                                    <span className={`font-mono text-[8px] break-all ${S.body}`} style={{ color: 'var(--brand-primary)' }}>{sessionId}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Botón limpiar */}
                    <div className="p-4 border-t border-[var(--border-default)]">
                        <button
                            onClick={clearSession}
                            disabled={messages.length === 0}
                            className={`w-full py-2 rounded-xl border border-[var(--border-default)] transition disabled:opacity-40 bg-[var(--bg-card)] hover:bg-red-500/10 hover:text-red-400 ${T.buttonText} ${S.ui}`}
                        >
                            🗑️ Limpiar conversación
                        </button>
                    </div>
                </div>

                {/* ── Área principal: Chat ──────────────────────────── */}
                <div className="flex-1 flex flex-col">

                    {/* Header */}
                    <div className="px-6 py-4 border-b border-[var(--border-default)] flex justify-between items-center bg-[var(--bg-surface)]">
                        <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center ${profile.channelType === 'WHATSAPP' ? 'bg-green-500/10 text-green-500' : 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]'}`}>
                                {profile.channelType === 'WHATSAPP' ? (
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.520.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.520-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.570-.01-.198 0-.520.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.570-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                                ) : (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                                )}
                            </div>
                            <div>
                                <p className={`${T.cardTitle} ${S.headingSm}`}>{profile.agentName || profile.name}</p>
                                <p className={`${T.helperText} ${S.meta}`}>Modo de prueba — sin sandbox real</p>
                            </div>
                        </div>
                        <button onClick={onClose} className={`text-[var(--text-muted)] hover:text-[var(--text-strong)] transition p-2 rounded-full hover:bg-[var(--bg-hover)] ${S.ui}`}>
                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>

                    {/* Mensajes */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[var(--bg-page)]">
                        {messages.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-center">
                                <div className="text-4xl mb-4">💬</div>
                                <p className={`${T.emptyStateTitle} ${S.headingLg}`}>Escribe un mensaje para probar el agente</p>
                                <p className={`mt-2 max-w-xs ${T.emptyStateBody} ${S.body}`}>Los mensajes se procesan con el flujo real del orquestador usando KB y perfil configurados</p>
                                <div className="mt-6 grid grid-cols-2 gap-2">
                                    {['Hola, quiero informes', '¿Cuáles son sus servicios?', 'Quiero cotización', 'Necesito un asesor'].map(s => (
                                        <button key={s} onClick={() => setInput(s)}
                                            className={`px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl hover:border-[var(--brand-primary)]/40 hover:brightness-110 transition text-left ${T.buttonText} ${S.ui}`}>
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {messages.map(msg => (
                            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[75%] ${msg.role === 'user' ? 'order-2' : 'order-1'}`}>
                                    {msg.role === 'agent' && (
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <div className="w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center">
                                                <span className="text-[8px]">🤖</span>
                                            </div>
                                            <span className={`font-bold ${T.helperText} ${S.meta}`}>{profile.agentName || 'Agente IA'}</span>
                                                            {msg.action && msg.action !== 'REPLY' && (
                                                <span className={`px-1.5 py-0.5 rounded-full uppercase ${msg.action === 'HANDOFF' ? 'bg-amber-500/20 text-amber-500' :
                                                        msg.action === 'ERROR' ? 'bg-red-500/20 text-red-500' :
                                                            `bg-[var(--bg-elevated)] border border-[var(--border-default)] ${T.badgeText} ${S.ui}`
                                                    }`}>{msg.action}</span>
                                            )}
                                        </div>
                                    )}
                                    <div className={`px-4 py-3 rounded-2xl whitespace-pre-wrap ${msg.role === 'user'
                                            ? `bg-[var(--brand-primary)] rounded-br-sm ${T.buttonPrimaryText} ${S.body}`
                                            : msg.action === 'HANDOFF'
                                                ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20 rounded-bl-sm'
                                                : msg.action === 'ERROR'
                                                    ? 'bg-red-500/10 text-red-300 border border-red-500/20 rounded-bl-sm'
                                                    : `bg-[var(--bg-card)] border border-[var(--border-default)] rounded-bl-sm ${T.messageText} ${S.body}`
                                        }`}>
                                        {msg.text}
                                    </div>
                                    {msg.handoffReason && (
                                        <p className="text-[9px] text-amber-400/60 mt-1 ml-1">Motivo: {msg.handoffReason}</p>
                                    )}
                                    <p className={`mt-1 ${msg.role === 'user' ? 'text-right' : 'text-left ml-1'} ${T.helperText} ${S.meta} opacity-50`}>
                                        {msg.timestamp.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>
                        ))}

                        {loading && (
                            <div className="flex justify-start">
                                <div className="bg-[var(--bg-card)] border border-[var(--border-default)] px-5 py-3 rounded-2xl rounded-bl-sm">
                                    <div className="flex gap-1.5 items-center">
                                        <div className="w-1.5 h-1.5 bg-[var(--brand-primary)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <div className="w-1.5 h-1.5 bg-[var(--brand-primary)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <div className="w-1.5 h-1.5 bg-[var(--brand-primary)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Handoff banner */}
                    {convMode === 'HUMAN_HANDOFF' && (
                        <div className={`px-6 py-2 bg-amber-500/10 border-t border-amber-500/20 text-center ${T.messageText} ${S.meta} text-amber-500`}>
                            ⚠️ Conversación en modo HUMAN_HANDOFF — la IA no responderá hasta reiniciar la sesión
                        </div>
                    )}

                    {/* Input */}
                    <div className="px-4 py-4 border-t border-[var(--border-default)] bg-[var(--bg-surface)]">
                        <form
                            onSubmit={e => { e.preventDefault(); sendMessage(); }}
                            className="flex gap-3 items-center"
                        >
                            <input
                                autoFocus
                                type="text"
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                placeholder="Escribe un mensaje como si fuera un cliente..."
                                disabled={loading}
                                className={`flex-1 px-4 py-3 bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/40 focus:border-[var(--brand-primary)] transition placeholder-[var(--text-muted)]/40 disabled:opacity-50 ${T.inputText} ${S.body}`}
                            />
                            <button
                                type="submit"
                                disabled={!input.trim() || loading}
                                className={`px-5 py-3 bg-[var(--brand-primary)] rounded-xl hover:brightness-110 transition disabled:opacity-40 active:scale-95 flex items-center gap-2 ${T.buttonPrimaryText} ${S.body}`}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                                <span className="hidden sm:inline">Enviar</span>
                            </button>
                        </form>
                        <p className={`text-center mt-2 ${T.helperText} ${S.meta}`}>Prueba aislada — no afecta el inbox real ni contactos reales</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WhatsAppAgentTestModal;
