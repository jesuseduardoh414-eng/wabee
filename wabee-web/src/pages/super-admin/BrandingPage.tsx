import React from 'react';
import { Palette, Layout, Type, Image as ImageIcon, Save, RefreshCcw, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import { T, S } from '@/lib/text-tokens';

export const BrandingPage = () => {
    return (
        <div className="p-4 sm:p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div>
                    <h1 className={`${T.pageTitle} ${S.displayMd}`}>Gestión de <span className="text-[var(--brand-primary)]">Temas</span></h1>
                    <p className={`${T.pageSubtitle} ${S.body}`}>Define la identidad visual y el diseño global de la plataforma.</p>
                </div>
                <div className="flex gap-3">
                    <button className={`flex items-center gap-2 px-5 py-3 border border-[var(--border-default)] ${T.buttonText} rounded-xl hover:bg-[var(--bg-hover)] transition-all`}>
                        <RefreshCcw size={18} /> Restablecer
                    </button>
                    <button className={`flex items-center gap-2 px-6 py-3 bg-[var(--brand-primary)] rounded-xl ${T.buttonPrimaryText} ${S.body} hover:scale-[1.02] transition-all`}>
                        <Save size={18} /> Guardar Cambios
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                {/* Configuration Column */}
                <div className="space-y-8">
                    {/* Gestión de Temas Visuales */}
                    <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-[2.5rem] p-8 flex flex-col justify-between group hover:border-[var(--brand-primary)]/30 transition-all duration-300 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--brand-primary)]/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-[var(--brand-primary)]/10 transition-all" />
                        
                        <div className="space-y-4 relative">
                            <div className="w-14 h-14 rounded-2xl bg-[var(--brand-primary)]/10 flex items-center justify-center text-[var(--brand-primary)]">
                                <Palette size={28} />
                            </div>
                            <div className="space-y-1">
                                <h3 className={`${T.cardTitle} text-xl font-black uppercase tracking-tight`}>Temas Visuales</h3>
                                <p className={`${T.helperText} text-xs leading-relaxed`}>
                                    Crea y gestiona paletas de colores y tipografías personalizadas para toda la plataforma.
                                </p>
                            </div>
                        </div>

                        <Link 
                            to="/dashboard/super-admin/branding/themes"
                            className={`mt-8 w-full py-4 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl ${T.buttonPrimaryText} font-black text-[10px] uppercase tracking-widest hover:bg-[var(--brand-primary)] hover: hover:border-[var(--brand-primary)] transition-all flex items-center justify-center gap-2 group/btn`}
                        >
                            Gestionar Temas <Palette size={14} className="group-hover/btn:scale-110 transition-transform" />
                        </Link>
                    </div>

                    {/* Typography Groups Shortcut */}
                    <div className="bg-[var(--bg-card)] border border-[var(--brand-primary)]/20 bg-gradient-to-br from-[var(--brand-primary)]/5 to-transparent rounded-[2.5rem] p-8 space-y-6">
                        <div className="flex justify-between items-start">
                            <div className="space-y-2">
                                <div className="flex gap-3 mb-1">
                                    <Type className="text-[var(--brand-primary)]" size={20} />
                                    <h3 className={`${T.cardTitle} ${S.headingMd}`}>Grupos de Texto</h3>
                                </div>
                                <p className={`${T.helperText} ${S.meta}`}>Gestión de la auditoría y clasificación semántica de la plataforma.</p>
                            </div>
                            <Link 
                                to="/dashboard/super-admin/branding/typography"
                                className={`bg-[var(--brand-primary)]  px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all shadow-lg inline-block text-center`}
                            >
                                Configurar Grupos
                            </Link>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl space-y-2">
                                <span className="tx-pageTitle text-[10px] font-black uppercase opacity-60">pageTitle</span>
                                <div className="h-1.5 w-full bg-[var(--brand-primary)]/20 rounded-full" />
                            </div>
                            <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl space-y-2">
                                <span className="tx-buttonText text-[10px] font-black uppercase opacity-60">buttonText</span>
                                <div className="h-1.5 w-3/4 bg-[var(--brand-primary)]/20 rounded-full" />
                            </div>
                        </div>
                    </div>

                    {/* Asset Management */}
                    <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-[2.5rem] p-8 space-y-6">
                        <div className="flex gap-3 mb-2">
                             <ImageIcon className="text-[var(--brand-primary)]" size={20} />
                             <h3 className={`${T.cardTitle} ${S.headingMd}`}>Recursos Visuales</h3>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="p-6 border-2 border-dashed border-[var(--border-default)] rounded-2xl flex flex-col items-center justify-center gap-3 hover:border-[var(--brand-primary)]/30 cursor-pointer transition-all">
                                <ImageIcon size={32} className={T.helperText} />
                                <p className={`${T.helperText} ${S.meta} uppercase tracking-widest`}>Logo Dark</p>
                            </div>
                            <div className="p-6 border-2 border-dashed border-[var(--border-default)] rounded-2xl flex flex-col items-center justify-center gap-3 hover:border-[var(--brand-primary)]/30 cursor-pointer transition-all">
                                <ImageIcon size={32} className={T.helperText} />
                                <p className={`${T.helperText} ${S.meta} uppercase tracking-widest`}>Logo Light</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Preview Column */}
                <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-[2.5rem] p-8 sticky top-8">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className={`${T.cardTitle} ${S.headingMd} flex items-center gap-2`}>
                            <Eye size={18} className="text-[var(--brand-primary)]" />
                            Previsualización Live
                        </h3>
                        <div className="flex gap-2">
                             <div className="w-3 h-3 rounded-full bg-red-500/20" />
                             <div className="w-3 h-3 rounded-full bg-yellow-500/20" />
                             <div className="w-3 h-3 rounded-full bg-green-500/20" />
                        </div>
                    </div>

                    <div className="space-y-6 p-8 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[2rem] shadow-inner">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-[var(--brand-primary)] flex items-center justify-center">
                                <Layout size={18} className="text-[var(--brand-primary-foreground)]" />
                            </div>
                            <span className={`${T.pageTitle} ${S.headingLg}`}>WABEE <span className="text-[var(--brand-primary)]">Pro</span></span>
                        </div>
                        
                        <div className="space-y-3">
                            <div className="h-2 bg-[var(--brand-primary)]/20 w-3/4 rounded-full" />
                            <div className="h-2 bg-[var(--brand-primary)]/10 w-full rounded-full" />
                            <div className="h-2 bg-[var(--brand-primary)]/10 w-1/2 rounded-full" />
                        </div>

                        <button className={`w-full py-3 bg-[var(--brand-primary)] rounded-xl ${T.buttonPrimaryText} font-black text-[10px] uppercase tracking-widest`}>
                            Botón de Ejemplo
                        </button>
                    </div>

                    <p className={`${T.helperText} ${S.meta} mt-8 text-center italic`}>
                        Esta previsualización usa las variables actuales del sistema para simular el look final.
                    </p>
                </div>
            </div>
        </div>
    );
};
