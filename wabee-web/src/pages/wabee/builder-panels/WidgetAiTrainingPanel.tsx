import React, { useEffect, useState } from 'react';
import { CpuChipIcon, ShieldCheckIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { aiApi } from '@/api/wabee/ai.api';
import { T, S } from '@/lib/text-tokens';

interface Props {
    draftConfig: any;
    setDraftConfig: (config: any) => void;
}

interface AiProfile {
    id: string;
    name: string;
}

const WidgetAiTrainingPanel: React.FC<Props> = ({ draftConfig, setDraftConfig }) => {
    const [profiles, setProfiles] = useState<AiProfile[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadProfiles();
    }, []);

    const loadProfiles = async () => {
        try {
            const data = await aiApi.listProfiles();
            setProfiles(data);
        } catch (error) {
            console.error('Error loading profiles:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target as HTMLInputElement;
        const finalValue = type === 'range' ? parseFloat(value) : value;
        setDraftConfig({ ...draftConfig, [name]: finalValue });
    };

    const toggleAiEnabled = () => {
        const enabled = !draftConfig.features?.aiEnabled;
        setDraftConfig({
            ...draftConfig,
            features: {
                ...draftConfig.features,
                aiEnabled: enabled
            }
        });
    };



    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300 text-left pb-8">
            <header className="space-y-0.5">
                <h1 className={`${T.sectionTitle} text-xl uppercase italic tracking-tighter`}>Cerebro <span className="text-[var(--brand-primary)]">Artificial</span></h1>
                <p className={`${T.pageSubtitle} text-[11px]`}>Calibra el razonamiento y los protocolos de respuesta de tu asistente digital.</p>
            </header>

            {/* Enable Toggle */}
            <div className="bg-[var(--bg-card)] rounded-xl p-3.5 border border-[var(--border-default)] shadow-2xl flex items-center justify-between group transition-all hover:border-purple-500/50 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 blur-[60px] pointer-events-none"></div>

                <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all duration-500 border ${draftConfig.features?.aiEnabled ? 'bg-purple-500/10 border-purple-500/30' : 'bg-[var(--bg-input)] border-[var(--border-default)]'}`}>
                        <SparklesIcon className={`h-4 w-4 transition-all duration-500 ${draftConfig.features?.aiEnabled ? 'text-purple-400 rotate-12' : 'text-[var(--text-muted)] opacity-50'}`} />
                    </div>
                    <div>
                        <h3 className={`${T.cardTitle} text-sm uppercase`}>Núcleo Activo</h3>
                        <p className={`${T.cardSubtitle} text-[8px] uppercase tracking-widest opacity-80 italic`}>IA Automatizada</p>
                    </div>
                </div>
                <button
                    onClick={toggleAiEnabled}
                    className={`w-10 h-5 rounded-full transition-all duration-500 relative flex items-center px-1 ${draftConfig.features?.aiEnabled ? 'bg-purple-600' : 'bg-[var(--bg-input)] border border-[var(--border-default)]'}`}
                >
                    <div className={`w-3.5 h-3.5 bg-white rounded-full transition-all duration-500 shadow-xl ${draftConfig.features?.aiEnabled ? 'translate-x-4.5' : 'translate-x-0'}`} />
                </button>
            </div>

            {/* Configuración del Modelo */}
            <div className={`bg-[var(--bg-card)] rounded-xl p-3.5 border border-[var(--border-default)] shadow-2xl space-y-4 transition-all duration-700 relative overflow-hidden ${!draftConfig.features?.aiEnabled ? 'opacity-30 grayscale pointer-events-none scale-95' : 'opacity-100'}`}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 blur-[60px] pointer-events-none"></div>

                <div className="flex items-center gap-3">
                    <div className="h-7 w-7 bg-purple-500/10 rounded-lg flex items-center justify-center border border-purple-500/20">
                        <CpuChipIcon className="h-3.5 w-3.5 text-purple-400" />
                    </div>
                    <div>
                        <h3 className={`${T.cardTitle} text-sm uppercase italic`}>Personalidad</h3>
                        <p className={`${T.cardSubtitle} text-[8px] uppercase tracking-widest opacity-80`}>Módulo Operativo</p>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="space-y-2">
                        <label className={`${T.labelText} ${S.meta} text-[10px] uppercase tracking-[0.2em] block px-1 text-purple-400`}>Seleccionar Perfil Operativo</label>
                        <select
                            name="aiProfileId"
                            value={draftConfig.aiProfileId || ''}
                            onChange={handleChange}
                            className={`ui-select ${T.inputText} ${S.body}`}
                        >
                            <option value="">Sin perfil seleccionado...</option>
                            {loading ? (
                                <option>Escaneando perfiles...</option>
                            ) : (
                                profiles.map(profile => (
                                    <option key={profile.id} value={profile.id}>{profile.name}</option>
                                ))
                            )}
                        </select>
                        {profiles.length === 0 && !loading && (
                            <div className="flex items-center gap-2 mt-2 px-1">
                                <div className="w-1 h-1 rounded-full bg-amber-500 animate-pulse"></div>
                                <p className={`${T.helperText} text-[10px] text-amber-500/90 uppercase tracking-widest italic`}>Advertencia: No se detectaron perfiles globales.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Fallback y Escalado */}
            <div className={`bg-[var(--bg-card)] rounded-xl p-3.5 border border-[var(--border-default)] shadow-2xl space-y-4 relative overflow-hidden transition-all duration-700 ${!draftConfig.features?.aiEnabled ? 'opacity-30 grayscale pointer-events-none' : 'opacity-100'}`}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 blur-[60px] pointer-events-none"></div>

                <div className="flex items-center gap-3">
                    <div className="h-7 w-7 bg-rose-500/10 rounded-lg flex items-center justify-center border border-rose-500/20">
                        <ShieldCheckIcon className="h-3.5 w-3.5 text-rose-500" />
                    </div>
                    <div>
                        <h3 className={`${T.cardTitle} text-sm uppercase italic`}>Contingencia</h3>
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="space-y-1">
                        <label className={`${T.labelText} ${S.meta} text-[9px] uppercase tracking-widest block px-1 text-rose-400`}>Mensaje Fallback</label>
                        <textarea
                            name="fallbackMessage"
                            value={draftConfig.fallbackMessage || ''}
                            onChange={handleChange}
                            rows={2}
                            placeholder="Mensaje alternativo..."
                            className={`ui-textarea ${T.inputText} ${S.body} shadow-inner resize-none`}
                        />
                        <p className={`${T.helperText} text-[9px] px-1 italic`}>Este mensaje se enviará si la IA no tiene una respuesta confiable.</p>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default WidgetAiTrainingPanel;
