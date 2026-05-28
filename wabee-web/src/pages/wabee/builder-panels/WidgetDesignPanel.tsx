import React from 'react';
import { SwatchIcon, CursorArrowRaysIcon, ViewColumnsIcon } from '@heroicons/react/24/outline';
import { T, S } from '@/lib/text-tokens';

interface Props {
    draftConfig: any;
    setDraftConfig: (config: any) => void;
}

const WidgetDesignPanel: React.FC<Props> = ({ draftConfig, setDraftConfig }) => {
    const handleThemeChange = (field: string, value: any) => {
        setDraftConfig({
            ...draftConfig,
            theme: {
                ...(draftConfig.theme || {}),
                [field]: value
            }
        });
    };

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300 pb-8">
            <header className="space-y-0.5">
                <h2 className={`${T.sectionTitle} text-xl uppercase italic tracking-tighter`}>Diseño <span className="text-[var(--brand-primary)]">Visual</span></h2>
                <p className={`${T.pageSubtitle} text-[11px]`}>Personaliza la estética e identidad visual de tu widget en tiempo real.</p>
            </header>

            {/* Colores y Temas */}
            <div className="bg-[var(--bg-card)] rounded-xl p-3.5 border border-[var(--border-default)] shadow-2xl space-y-4 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/5 blur-[60px] pointer-events-none"></div>

                <div className="flex items-center gap-2.5 mb-0.5">
                    <div className="h-6 w-6 bg-pink-500/10 rounded-lg flex items-center justify-center border border-pink-500/20">
                        <SwatchIcon className="h-3.5 w-3.5 text-pink-500" />
                    </div>
                    <div>
                        <h3 className={`${T.cardTitle} text-sm uppercase`}>Colores</h3>
                        <p className={`${T.cardSubtitle} text-[9px] uppercase tracking-widest opacity-80`}>Cromática Institucional</p>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className={`${T.labelText} ${S.meta} text-[9px] uppercase tracking-widest block px-1`}>Tono Predominante</label>
                    <div className="flex gap-3 items-center bg-[var(--bg-input)] p-2 rounded-lg border border-[var(--border-default)] group-hover:border-[var(--brand-primary)]/50 transition-all">
                        <div className="relative h-8 w-8 shrink-0">
                            <input
                                type="color"
                                value={draftConfig.theme?.primaryColor || '#ead018'}
                                onChange={e => handleThemeChange('primaryColor', e.target.value)}
                                className="absolute inset-0 h-full w-full opacity-0 cursor-pointer z-10"
                            />
                            <div
                                className="h-full w-full rounded-md border border-white/10 shadow-inner"
                                style={{ backgroundColor: draftConfig.theme?.primaryColor || '#ead018' }}
                            ></div>
                        </div>
                        <div className="flex-1">
                            <input
                                type="text"
                                value={draftConfig.theme?.primaryColor || '#EAD018'}
                                onChange={e => handleThemeChange('primaryColor', e.target.value)}
                                className={`ui-input bg-transparent border-none p-0 focus:ring-0 focus:border-transparent ${T.inputText} ${S.body} tracking-wider uppercase shadow-none`}
                                placeholder="#000000"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Layout y Posición */}
            <div className="bg-[var(--bg-card)] rounded-xl p-3.5 border border-[var(--border-default)] shadow-2xl space-y-4 group relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-[60px] pointer-events-none"></div>

                <div className="flex items-center gap-2.5 mb-0.5">
                    <div className="h-6 w-6 bg-indigo-500/10 rounded-lg flex items-center justify-center border border-indigo-500/20">
                        <CursorArrowRaysIcon className="h-3.5 w-3.5 text-indigo-500" />
                    </div>
                    <div>
                        <h3 className={`${T.cardTitle} text-sm uppercase`}>Anclaje</h3>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    {[
                        { id: 'bottom-right', label: 'Derecha' },
                        { id: 'bottom-left', label: 'Izquierda' }
                    ].map((pos) => (
                        <button
                            key={pos.id}
                            onClick={() => handleThemeChange('position', pos.id)}
                            className={`group/btn relative h-14 rounded-lg border transition-all flex flex-col items-center justify-center gap-1.5 overflow-hidden ${draftConfig.theme?.position === pos.id
                                ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/10'
                                : 'border-[var(--border-default)] bg-[var(--bg-input)] grayscale hover:grayscale-0 hover:border-[var(--brand-primary)]/50'
                                }`}
                        >
                            <div className="w-8 h-4 bg-[var(--bg-card)] rounded relative border border-[var(--border-default)] overflow-hidden">
                                <div className={`absolute bottom-0.5 ${pos.id === 'bottom-right' ? 'right-0.5' : 'left-0.5'} w-1 h-1 bg-[var(--brand-primary)] rounded-full`} />
                            </div>
                            <span className={`${T.menuText} text-[8px] uppercase tracking-widest ${draftConfig.theme?.position === pos.id ? '!text-[var(--brand-primary)]' : ''}`}>{pos.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Estilo y Bordes */}
            <div className="bg-[var(--bg-card)] rounded-xl p-3.5 border border-[var(--border-default)] shadow-2xl space-y-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 blur-[60px] pointer-events-none"></div>

                <div className="flex items-center gap-2.5 mb-0.5">
                    <div className="h-6 w-6 bg-violet-500/10 rounded-lg flex items-center justify-center border border-violet-500/20">
                        <ViewColumnsIcon className="h-3.5 w-3.5 text-violet-500" />
                    </div>
                    <div>
                        <h3 className={`${T.cardTitle} text-sm uppercase`}>Morfología</h3>
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex justify-between items-end px-1">
                        <label className={`${T.labelText} ${S.meta} text-[9px] uppercase tracking-widest`}>Bordes</label>
                        <span className={`${T.cardTitle} text-sm tracking-widest italic !text-[var(--brand-primary)]`}>{draftConfig.theme?.radius ?? 16}PX</span>
                    </div>
                    <div className="relative pt-0.5">
                        <input
                            type="range"
                            min="0"
                            max="32"
                            step="4"
                            value={draftConfig.theme?.radius ?? 16}
                            onChange={e => handleThemeChange('radius', parseInt(e.target.value))}
                            className="w-full h-1 bg-[var(--bg-input)] rounded-full appearance-none cursor-pointer accent-[var(--brand-primary)] border border-[var(--border-default)]"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WidgetDesignPanel;
