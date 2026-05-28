import React from 'react';
import { ChatBubbleLeftRightIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { T, S } from '@/lib/text-tokens';

interface Props {
    draftConfig: any;
    setDraftConfig: (config: any) => void;
}

const WidgetContentPanel: React.FC<Props> = ({ draftConfig, setDraftConfig }) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setDraftConfig({ ...draftConfig, [name]: value });
    };

    return (

        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300 pb-8">
            <header className="space-y-0.5">
                <h2 className={`${T.sectionTitle} text-xl uppercase italic tracking-tighter`}>Dominio de <span className="text-[var(--brand-primary)]">Contenido</span></h2>
                <p className={`${T.pageSubtitle} text-[11px]`}>Define los mensajes clave y la narrativa oficial de tu widget inteligente.</p>
            </header>

            {/* Identidad de Marca */}
            <div className="bg-[var(--bg-card)] rounded-xl p-3.5 border border-[var(--border-default)] shadow-2xl space-y-4 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[60px] pointer-events-none"></div>

                <div className="flex items-center gap-2.5 mb-0.5">
                    <div className="h-6 w-6 bg-blue-500/10 rounded-lg flex items-center justify-center border border-blue-500/20">
                        <ChatBubbleLeftRightIcon className="h-3.5 w-3.5 text-blue-500" />
                    </div>
                    <div>
                        <h3 className={`${T.cardTitle} text-sm uppercase`}>ADN de Marca</h3>
                        <p className={`${T.cardSubtitle} text-[9px] uppercase tracking-widest opacity-80`}>Identificadores Globales</p>
                    </div>
                </div>

                <div className="grid gap-3">
                    <div className="space-y-1">
                        <label className={`${T.labelText} ${S.meta} text-[9px] uppercase tracking-widest block px-1 text-blue-400`}>Título</label>
                        <input
                            type="text"
                            name="title"
                            value={draftConfig.title || ''}
                            onChange={handleChange}
                            placeholder="Ej. ¡Bienvenido!"
                            className={`ui-input ${T.inputText} ${S.body} shadow-inner`}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className={`${T.labelText} ${S.meta} text-[10px] uppercase tracking-[0.2em] block px-1 text-blue-400`}>Subtítulo Descriptivo</label>
                        <input
                            type="text"
                            name="subtitle"
                            value={draftConfig.subtitle || ''}
                            onChange={handleChange}
                            placeholder="Ej. ¿En qué podemos ayudarte?"
                            className={`ui-input ${T.inputText} ${S.body} shadow-inner`}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className={`${T.labelText} ${S.meta} text-[10px] uppercase tracking-[0.2em] block px-1 text-blue-400`}>Nombre Corporativo</label>
                        <input
                            type="text"
                            name="brandName"
                            value={draftConfig.brandName || ''}
                            onChange={handleChange}
                            placeholder="Ej. WABEE Support"
                            className={`ui-input ${T.inputText} ${S.body} shadow-inner`}
                        />
                    </div>
                </div>
            </div>

            {/* Mensajes Predefinidos */}
            <div className="bg-[var(--bg-card)] rounded-xl p-3.5 border border-[var(--border-default)] shadow-2xl space-y-4 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-[60px] pointer-events-none"></div>

                <div className="flex items-center gap-2.5 mb-0.5">
                    <div className="h-6 w-6 bg-amber-500/10 rounded-lg flex items-center justify-center border border-amber-500/20">
                        <SparklesIcon className="h-3.5 w-3.5 text-amber-500" />
                    </div>
                    <div>
                        <h3 className={`${T.cardTitle} text-sm uppercase`}>Mensajería</h3>
                        <p className={`${T.cardSubtitle} text-[8px] uppercase tracking-widest opacity-80`}>Automatización</p>
                    </div>
                </div>

                <div className="grid gap-6">
                    <div className="space-y-2">
                        <label className={`${T.labelText} ${S.meta} text-[10px] uppercase tracking-[0.2em] block px-1 text-amber-400`}>Primer Contacto</label>
                        <textarea
                            name="welcomeMessage"
                            value={draftConfig.welcomeMessage || ''}
                            onChange={handleChange}
                            rows={2}
                            placeholder="Escribe el primer mensaje..."
                            className={`ui-textarea ${T.inputText} ${S.body} shadow-inner resize-none`}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className={`${T.labelText} ${S.meta} text-[10px] uppercase tracking-[0.2em] block px-1 text-amber-400`}>Protocolo Fuera de Horario</label>
                        <textarea
                            name="offlineMessage"
                            value={draftConfig.offlineMessage || ''}
                            onChange={handleChange}
                            rows={2}
                            placeholder="Mensaje fuera de horario..."
                            className={`ui-textarea ${T.inputText} ${S.body} shadow-inner resize-none`}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WidgetContentPanel;
