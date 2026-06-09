import { useState, useEffect } from 'react';
import { T, S } from '@/lib/text-tokens';
import { ChannelAiConfig, getChannelAiConfig, updateChannelAiConfig } from '@/api/wabee/whatsapp.api';
import { AiProfile, aiApi } from '@/api/wabee/ai.api';

interface Props {
    channelId: string;
    onClose: () => void;
}

export default function ChannelAiConfigSection({ channelId, onClose }: Props) {
    const [config, setConfig] = useState<ChannelAiConfig | null>(null);
    const [profiles, setProfiles] = useState<AiProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                const [configData, profilesData] = await Promise.all([
                    getChannelAiConfig(channelId),
                    aiApi.listProfiles()
                ]);
                setConfig(configData);
                setProfiles(profilesData);
            } catch (err: any) {
                setError(err.message || 'Error al cargar configuración IA');
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [channelId]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!config) return;
        
        try {
            setSaving(true);
            setError(null);
            setSuccess(false);
            await updateChannelAiConfig(channelId, {
                aiEnabled: config.aiEnabled,
                defaultAiProfileId: config.defaultAiProfileId,
                humanHandoffEnabled: config.humanHandoffEnabled,
                humanHandoffRole: config.humanHandoffRole,
                humanTeamRef: config.humanTeamRef,
                aiMode: config.aiMode,
                fallbackMessage: config.fallbackMessage
            });
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (err: any) {
            setError(err.message || 'Error al guardar configuración IA');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="p-8 text-center bg-[var(--bg-card)] border border-[var(--border-default)] rounded-2xl shadow-2xl mt-4">
            <div className="animate-spin h-8 w-8 border-t-2 border-b-2 border-[var(--brand-primary)] rounded-full mx-auto" />
            <p className={`${T.helperText} ${S.meta} mt-4 opacity-60 uppercase tracking-[0.3em]`}>Cargando Configuración IA...</p>
        </div>
    );

    if (error) return (
        <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-2xl mt-4 text-red-500 text-sm font-bold flex justify-between items-center shadow-lg">
            <span>{error}</span>
            <button onClick={onClose} className="text-red-500 hover:text-[color:var(--text-strong)] transition-colors uppercase text-[10px] tracking-widest border border-red-500/30 px-3 py-1 rounded">Cerrar</button>
        </div>
    );

    if (!config) return null;

    return (
        <div className="bg-[var(--bg-page)] border border-[var(--brand-primary)]/30 rounded-2xl shadow-2xl mt-4 p-6 relative overflow-hidden animate-fade-in">
             <div className={`absolute top-0 right-0 p-2 border-l border-b border-[var(--brand-primary)]/30 bg-[var(--brand-primary)]/10 rounded-bl-2xl ${T.buttonPrimaryText}`}>
                <span className={`${T.helperText} ${S.meta} text-[color:var(--brand-primary)] uppercase tracking-[0.2em]`}>IA Config</span>
            </div>

            <div className="flex justify-between items-start mb-6 border-b border-[var(--border-default)] pb-4">
                <div>
                    <h3 className={`${T.sectionTitle} ${S.headingLg} flex items-center gap-3`}>
                        <div className={`p-2 bg-[var(--brand-primary)]/10 rounded-xl border border-[var(--brand-primary)]/20 ${T.buttonPrimaryText}`}>
                            <svg className="w-5 h-5 text-[color:var(--brand-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        Atención IA para Canal
                    </h3>
                    <p className={`${T.helperText} ${S.body} text-[color:var(--text-muted)] mt-1 max-w-xl`}>
                        Ajusta cómo responde la Inteligencia Artificial en este canal. <span className="text-[color:var(--brand-primary)]/80">Nota: La pausa o escalamiento manual se gestiona de forma independiente por cada conversación en el Inbox.</span>
                    </p>
                </div>
                <button 
                  type="button" 
                  onClick={onClose} 
                  className="text-[color:var(--text-muted)] hover:text-[color:var(--brand-primary)] transition-colors p-2 bg-[var(--bg-elevated)]/50 rounded-xl"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>

            <form onSubmit={handleSave} className="space-y-8">
                {/* Master Switch */}
                <div className="flex items-center justify-between p-5 bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl">
                    <div>
                        <span className={`${T.labelText} ${S.headingSm} block mb-1`}>Activar Inteligencia Artificial</span>
                         <span className={`${T.helperText} ${S.meta} text-[color:var(--text-muted)] opacity-60`}>Permite a la IA participar en las conversaciones de este canal.</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={config.aiEnabled} 
                            onChange={e => setConfig({...config, aiEnabled: e.target.checked})} 
                        />
                        <div className="w-14 h-7 bg-[var(--bg-elevated)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-[color:var(--text-strong)] after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-[color:var(--text-muted)] peer-checked:after:bg-[var(--bg-page)] after:border-[var(--border-strong)] after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-[var(--brand-primary)]"></div>
                    </label>
                </div>

                {config.aiEnabled && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                        
                        {/* Panel Izquierdo: Config IA */}
                        <div className="space-y-6">
                            <div>
                                <label className={`${T.labelText} ${S.meta} block uppercase tracking-widest text-[color:var(--text-muted)] mb-2`}>Modo Operativo IA</label>
                                <select 
                                    className="!text-[var(--text-strong)] w-full bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl px-4 py-3 focus:outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)] transition-all font-medium"
                                    value={config.aiMode}
                                    onChange={e => setConfig({...config, aiMode: e.target.value as any})}
                                >
                                    <option value="autonomous"> Autónomo (Responde automáticamente)</option>
                                    <option value="copilot_only">🧠 Solo Copiloto (Sugiere respuestas al agente)</option>
                                    <option value="disabled">🚫 Deshabilitado (Requiere intervención humana inmediata)</option>
                                </select>
                                {config.aiMode === 'copilot_only' && (
                                     <p className={`${T.helperText} ${S.meta} text-[color:var(--brand-primary)] mt-2 bg-[var(--brand-primary)]/10 p-2 rounded border border-[var(--brand-primary)]/20 ${T.buttonPrimaryText}`}>La IA ya no enviará mensajes al cliente, solo dejará notas internas con sugerencias para el agente.</p>
                                )}
                            </div>

                            <div>
                                <label className={`${T.labelText} ${S.meta} block uppercase tracking-widest text-[color:var(--text-muted)] mb-2`}>Perfil de Agente IA (Base)</label>
                                <select 
                                    className="!text-[var(--text-strong)] w-full bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl px-4 py-3 focus:outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)] transition-all font-medium"
                                    value={config.defaultAiProfileId || ''}
                                    onChange={e => setConfig({...config, defaultAiProfileId: e.target.value || null})}
                                >
                                    <option value="">Selecciona un Agente de Inteligencia Artificial...</option>
                                    {profiles.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                            
                            <div>
                                <label className={`${T.labelText} ${S.meta} block uppercase tracking-widest text-[color:var(--text-muted)] mb-2`}>Mensaje Fallback (Error IA)</label>
                                <textarea 
                                    className="!text-[var(--text-strong)] w-full bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl px-4 py-3 focus:outline-none focus:border-[var(--brand-primary)] transition-all font-medium text-sm"
                                    rows={2}
                                    placeholder="Mensaje automático si la IA falla. Ej: Dame un momento, estoy verificando..."
                                    value={config.fallbackMessage || ''}
                                    onChange={e => setConfig({...config, fallbackMessage: e.target.value})}
                                />
                            </div>
                        </div>

                        {/* Panel Derecho: Escalamiento Humano */}
                        <div className="space-y-6 bg-[var(--bg-elevated)] p-6 rounded-xl border border-[var(--border-default)]/50">
                            <h4 className={`${T.cardTitle} ${S.headingSm} flex items-center gap-2 mb-4 uppercase tracking-tighter`}>
                                <svg className="w-4 h-4 text-[color:var(--brand-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                Escalamiento Humano
                            </h4>

                            <div className="flex items-center justify-between">
                                <span className={`${T.labelText} ${S.body} font-bold`}>Permitir Escalar (Handoff)</span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        className="sr-only peer" 
                                        checked={config.humanHandoffEnabled} 
                                        onChange={e => setConfig({...config, humanHandoffEnabled: e.target.checked})} 
                                    />
                                    <div className="w-11 h-6 bg-[var(--bg-elevated)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-[color:var(--text-strong)] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[color:var(--text-muted)] peer-checked:after:bg-[var(--bg-page)] after:border-[var(--border-strong)] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--brand-primary)]"></div>
                                </label>
                            </div>

                            {config.humanHandoffEnabled && (
                                <>
                                    <div className="pt-2">
                                        <label className={`${T.labelText} ${S.meta} block uppercase tracking-widest text-[color:var(--text-muted)] mb-2`}>Rol Mínimo (Informativo)</label>
                                        <select 
                                            className="w-full bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl px-4 py-3 text-[color:var(--text-muted)] focus:outline-none"
                                            value={config.humanHandoffRole || ''}
                                            onChange={e => setConfig({...config, humanHandoffRole: e.target.value || null})}
                                        >
                                            <option value="">Cualquier Agente Disponible</option>
                                            <option value="senior_agent">Agente Senior</option>
                                            <option value="supervisor">Supervisor</option>
                                            <option value="admin">Administrador</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className={`${T.labelText} ${S.meta} block uppercase tracking-widest text-[color:var(--text-muted)] mb-2`}>Área / Equipo Referencia</label>
                                        <input 
                                            type="text"
                                            className="!text-[var(--text-strong)] w-full bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl px-4 py-3 focus:outline-none focus:border-[var(--brand-primary)] transition-all font-medium text-sm"
                                            placeholder="Ej: ventas, soporte-nivel-2"
                                            value={config.humanTeamRef || ''}
                                            onChange={e => setConfig({...config, humanTeamRef: e.target.value})}
                                        />
                                        <p className={`${T.helperText} ${S.meta} text-[color:var(--text-muted)] mt-2 opacity-60`}>Ayuda a saber a quién notificar. No enruta de forma automática todavía.</p>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}

                <div className="flex border-t border-[var(--border-default)] pt-6 items-center justify-end gap-4 mt-6">
                    {success && <span className="text-sm font-black text-green-500 bg-green-500/10 px-4 py-2 rounded-xl border border-green-500/20 uppercase tracking-widest">Cambios Guardados</span>}
                    <button 
                         type="submit" 
                         disabled={saving}
                         className={`px-8 py-3 rounded-xl transition-all shadow-lg active:scale-95 flex items-center gap-2 ${saving ? 'bg-[var(--bg-elevated)] text-[color:var(--text-muted)]/50 cursor-not-allowed' : 'bg-[var(--brand-primary)]  hover:brightness-110 shadow-[var(--brand-primary)]/10 border border-[var(--brand-primary)]'} ${T.buttonPrimaryText}`}
                    >
                         {saving && <svg className="animate-spin h-4 w-4 text-[#121208]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                         <span className={`${T.buttonText} ${S.body}`}>{saving ? 'Guardando...' : 'Guardar IA'}</span>
                    </button>
                </div>
            </form>
        </div>
    );
}
