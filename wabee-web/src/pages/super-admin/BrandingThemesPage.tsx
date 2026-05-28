import React, { useState, useEffect } from 'react';
import { 
    Palette, Plus, Trash2, CheckCircle2, 
    Layout, Type, Clock, Image as ImageIcon, Copy, Globe, EyeOff, Monitor, Upload, Zap, Star
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/context/ToastContext';
import { themesApi, BrandingTheme } from '@/api/wabee/themes.api';
import { brandingApi } from '@/api/wabee/branding.api';
import { T, S } from '@/lib/text-tokens';
import { BrandLogo } from '@/components/BrandLogo';

export const BrandingThemesPage = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const toast = useToast();
    
    const [themes, setThemes] = useState<BrandingTheme[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [newThemeName, setNewThemeName] = useState('');
    const [duplicating, setDuplicating] = useState(false);
    const [editingThemeId, setEditingThemeId] = useState<string | null>(null);
    const [themeDraftName, setThemeDraftName] = useState('');

    const loadThemes = async () => {
        try {
            const data = await themesApi.getThemes();
            setThemes(data);
        } catch (error) {
            console.error('Error loading themes:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadThemes();
    }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newThemeName.trim()) return;
        setCreating(true);
        try {
            await themesApi.createTheme(newThemeName);
            setNewThemeName('');
            loadThemes();
        } catch (error) {
            console.error('Error creating theme:', error);
        } finally {
            setCreating(false);
        }
    };



    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este tema?')) return;
        try {
            await themesApi.deleteTheme(id);
            loadThemes();
        } catch (error) {
            alert('No se puede eliminar el tema activo.');
        }
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            await brandingApi.uploadLogo(file);
            queryClient.invalidateQueries({ queryKey: ['global-branding'] });
            toast.success('Logo actualizado correctamente');
        } catch (error: any) {
            console.error('[Branding] Logo upload error:', error);
            const msg = error?.response?.data?.error?.message || error?.message || 'Error desconocido';
            toast.error(`No se pudo subir el logo: ${msg}`);
        }
    };

    const handleLogoDelete = async () => {
        if (!confirm('¿Estás seguro de eliminar el logo personalizado? Se volverá al logo por defecto.')) return;
        try {
            await brandingApi.deleteGlobalLogo();
            queryClient.invalidateQueries({ queryKey: ['global-branding'] });
            toast.success('Logo eliminado correctamente');
        } catch (error) {
            toast.error('No se pudo eliminar el logo');
        }
    };

    const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            await brandingApi.uploadFavicon(file);
            queryClient.invalidateQueries({ queryKey: ['global-branding'] });
            toast.success('Favicon actualizado correctamente');
        } catch (error: any) {
            console.error('[Branding] Favicon upload error:', error);
            const msg = error?.response?.data?.error?.message || error?.message || 'Error desconocido';
            toast.error(`No se pudo subir el favicon: ${msg}`);
        }
    };

    const handleFaviconDelete = async () => {
        if (!confirm('¿Estás seguro de eliminar el favicon personalizado?')) return;
        try {
            await brandingApi.deleteFavicon();
            queryClient.invalidateQueries({ queryKey: ['global-branding'] });
            toast.success('Favicon eliminado correctamente');
        } catch (error) {
            toast.error('No se pudo eliminar el favicon');
        }
    };

    const getNextCopyName = (baseName: string) => {
        const copyPrefix = `Copia de ${baseName}`;
        let name = copyPrefix;
        let counter = 2;
        
        while (themes.some(t => t.name === name)) {
            name = `${copyPrefix} (${counter})`;
            counter++;
        }
        return name;
    };

    const handleDuplicate = async (theme: BrandingTheme) => {
        setDuplicating(true);
        try {
            const nextName = getNextCopyName(theme.name);
            await themesApi.createTheme(nextName, {
                variant: theme.variant,
                colors: theme.colors,
                typography: theme.typography
            });
            loadThemes();
        } catch (error) {
            console.error('Error duplicating theme:', error);
            alert('Error al duplicar el tema.');
        } finally {
            setDuplicating(false);
        }
    };

    const handlePublish = async (theme: BrandingTheme) => {
        try {
            await themesApi.publishTheme(theme.id, !theme.isPublished);
            loadThemes();
        } catch (error: any) {
            const msg = error?.response?.data?.error?.message || 'Error al cambiar el estado del tema.';
            alert(msg);
        }
    };

    const handleSetDefault = async (theme: BrandingTheme) => {
        if (theme.isActive) return;
        try {
            await themesApi.activateTheme(theme.id);
            toast.success(`'${theme.name}' es ahora el tema global por defecto.`);
            loadThemes();
            // Despachar evento para reflejar cambios en tiempo real
            window.dispatchEvent(new Event('refresh-branding-colors'));
            window.dispatchEvent(new Event('refresh-branding-typography'));
        } catch (error: any) {
            const msg = error?.response?.data?.error?.message || 'Error al establecer el tema por defecto.';
            alert(msg);
        }
    };

    const handleSaveName = async (themeId: string) => {
        if (!themeDraftName.trim() || themeDraftName.trim() === themes.find(t => t.id === themeId)?.name) {
            setEditingThemeId(null);
            return;
        }
        
        try {
            await themesApi.updateTheme(themeId, { name: themeDraftName.trim() });
            setEditingThemeId(null);
            loadThemes(); 
        } catch (error) {
            console.error('Error updating theme name:', error);
            alert('Error al actualizar el nombre del tema.');
            setEditingThemeId(null);
        }
    };

    // ─── Global Branding Logic ──────────────────────────────────────────────
    const { data: branding } = useQuery({
        queryKey: ['global-branding'],
        queryFn: () => brandingApi.getGlobalBranding()
    });

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="w-6 h-6 rounded-full border-2 border-[var(--brand-primary)] border-t-transparent animate-spin" />
        </div>
    );

    return (
        <div className="p-4 sm:p-6 lg:p-10 w-full max-w-7xl mx-auto space-y-10">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
                <div className="space-y-2">
                    <h1 className={`${T.pageTitle} ${S.displayMd}`}>
                        Biblioteca de <span className="text-[var(--brand-primary)]">Temas</span>
                    </h1>
                    <p className={`${T.pageSubtitle} ${S.body}`}>
                        Gestiona múltiples variantes visuales de la plataforma y actívalas instantáneamente.
                    </p>
                </div>

                <div className="flex gap-3 shrink-0">
                    <form onSubmit={handleCreate} className="flex gap-3">
                        <input 
                            type="text" 
                            placeholder="Nombre del nuevo tema..."
                            value={newThemeName}
                            onChange={(e) => setNewThemeName(e.target.value)}
                            className="bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl px-4 py-2 text-xs text-[var(--text-strong)] outline-none focus:border-[var(--brand-primary)]/50 min-w-[200px] placeholder:text-[var(--text-muted)]"
                        />
                        <button
                            type="submit"
                            disabled={creating || !newThemeName.trim()}
                            className={`flex items-center gap-2 px-6 py-2 bg-[var(--brand-primary)]  rounded-xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all disabled:opacity-50 ${T.buttonPrimaryText}`}
                        >
                            <Plus size={16} /> {creating ? 'Creando...' : 'Nuevo Tema'}
                        </button>
                    </form>
                </div>
            </div>

            {/* Grid de Temas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {themes.map((theme) => (
                    <div 
                        key={theme.id}
                        className={`group relative bg-[var(--bg-card)] border rounded-[2.5rem] p-8 space-y-6 transition-all duration-300 overflow-hidden ${
                            theme.isActive 
                                ? 'border-[var(--brand-primary)] shadow-[0_0_40px_rgba(234,208,24,0.1)] ring-1 ring-[var(--brand-primary)]/20' 
                                : 'border-[var(--border-default)] hover:border-[var(--brand-primary)]/30'
                        }`}
                    >
                        {/* Status Badges y Acción de Default */}
                        <div className="absolute top-6 right-6 flex flex-col items-end gap-2">
                            {theme.isActive ? (
                                <div className="flex items-center gap-1.5 px-3 py-1 bg-yellow-500/15 text-yellow-500 border border-yellow-500/30 rounded-full shadow-[0_0_10px_rgba(234,208,24,0.1)]">
                                    <Star size={12} className="fill-current" />
                                    <span className="text-[10px] font-black uppercase tracking-widest leading-none">Global Default</span>
                                </div>
                            ) : null}

                            {!theme.isActive && theme.isPublished ? (
                                <div className="flex items-center gap-1.5 px-3 py-1 bg-[var(--state-success)]/15 text-[var(--state-success)] border border-[var(--state-success)]/30 rounded-full">
                                    <Globe size={10} />
                                    <span className="text-[10px] font-black uppercase tracking-widest leading-none">Publicado (Alternativo)</span>
                                </div>
                            ) : null}

                            {!theme.isActive && !theme.isPublished ? (
                                <div className="flex items-center gap-1.5 px-3 py-1 bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[var(--border-default)] rounded-full">
                                    <EyeOff size={10} />
                                    <span className="text-[10px] font-black uppercase tracking-widest leading-none">Borrador</span>
                                </div>
                            ) : null}
                        </div>

                        <div className="space-y-1">
                            {editingThemeId === theme.id ? (
                                <input
                                    type="text"
                                    autoFocus
                                    value={themeDraftName}
                                    onChange={(e) => setThemeDraftName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSaveName(theme.id);
                                        if (e.key === 'Escape') setEditingThemeId(null);
                                    }}
                                    onBlur={() => handleSaveName(theme.id)}
                                    className="bg-[var(--bg-input)] border border-[var(--brand-primary)] rounded px-2 py-1 text-xl font-black text-[var(--text-strong)] outline-none w-full"
                                />
                            ) : (
                                <h3 
                                    className={`${T.cardTitle} text-xl font-black cursor-pointer hover:text-[var(--brand-primary)] transition-colors flex items-center gap-2 group/title`}
                                    onClick={() => {
                                        setEditingThemeId(theme.id);
                                        setThemeDraftName(theme.name);
                                    }}
                                    title="Haz clic para editar nombre"
                                >
                                    {theme.name}
                                    <span className="opacity-0 group-hover/title:opacity-100 text-[9px] uppercase font-bold text-[var(--text-muted)] p-1 bg-[var(--bg-input)] rounded ml-1 transition-opacity">Editar</span>
                                </h3>
                            )}
                            <div className={`${T.helperText} flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest`}>
                                <Clock size={12} /> Actualizado: {new Date(theme.updatedAt).toLocaleDateString()}
                            </div>
                        </div>

                        {/* Mini Preview Paleta */}
                        <div className="flex gap-1.5 h-12 w-full">
                            {['chart-5', 'brand-primary', 'bg-card', 'chart-4', 'text-strong'].map((key) => (
                                <div 
                                    key={key} 
                                    className="flex-1 rounded-lg border border-black/20"
                                    style={{ backgroundColor: theme.colors[key] }}
                                />
                            ))}
                        </div>

                        {/* Ficha técnica rápida */}
                        <div className="grid grid-cols-2 gap-3 pb-2">
                            <div className={`${T.helperText} flex items-center gap-2 text-[10px] font-medium`}>
                                <Palette size={14} className="opacity-50" /> {Object.keys(theme.colors).length} Colores
                            </div>
                            <div className={`${T.helperText} flex items-center gap-2 text-[10px] font-medium`}>
                                <Type size={14} className="opacity-50" /> {Object.keys(theme.typography).length} Tipografías
                            </div>
                        </div>

                        {/* Acciones */}
                        <div className="pt-4 flex flex-col gap-3">
                            <div className="flex gap-2">
                                <button
                                    onClick={() => navigate(`/dashboard/super-admin/themes/${theme.id}/colors`)}
                                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[var(--bg-card)] border border-[var(--border-default)] ${T.buttonText} hover:bg-[var(--bg-hover)] transition-all font-black text-[10px] uppercase tracking-widest`}
                                >
                                    <Layout size={14} /> Colores
                                </button>
                                <button
                                    onClick={() => navigate(`/dashboard/super-admin/themes/${theme.id}/typography`)}
                                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[var(--bg-card)] border border-[var(--border-default)] ${T.buttonText} hover:bg-[var(--bg-hover)] transition-all font-black text-[10px] uppercase tracking-widest`}
                                >
                                    <Type size={14} /> Textos
                                </button>
                            </div>
                            
                            <div className="flex flex-col gap-2">
                                <button
                                    onClick={() => handleSetDefault(theme)}
                                    disabled={theme.isActive}
                                    title={theme.isActive ? 'Este es el tema global por defecto' : 'Marcar como tema global por defecto'}
                                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-2xl transition-all font-black text-[10px] uppercase tracking-widest w-full disabled:cursor-not-allowed border ${
                                        theme.isActive
                                            ? 'bg-yellow-500/10 border-yellow-500/40 text-yellow-500'
                                            : 'bg-[var(--bg-card)] border-[var(--border-default)] text-[var(--text-muted)] hover:border-yellow-500/30 hover:text-yellow-500 hover:bg-yellow-500/5'
                                    }`}
                                >
                                    <Star size={14} className={theme.isActive ? "fill-current" : ""} /> {theme.isActive ? 'Es Default' : 'Hacer Default'}
                                </button>
                                {/* Acción Secundaria Ocultada/Miniaturizada */}
                                <div className="flex gap-2 w-full justify-between items-center">
                                    <button
                                        onClick={() => handlePublish(theme)}
                                        disabled={theme.isActive}
                                        title={theme.isActive ? 'El tema global por defecto siempre está publicado' : (theme.isPublished ? 'Quitar publicación' : 'Publicar tema para otros usuarios')}
                                        className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl transition-all font-bold text-[9px] uppercase tracking-widest flex-1 disabled:opacity-40 disabled:cursor-not-allowed border ${
                                            (theme.isPublished || theme.isActive)
                                                ? 'bg-[var(--state-success)]/10 border-[var(--state-success)]/40 text-[var(--state-success)] hover:bg-[var(--state-success)]/20'
                                                : 'bg-[var(--bg-card)] border-[var(--border-default)] text-[var(--text-muted)] hover:border-[var(--brand-primary)]/30 hover:text-[var(--brand-primary)]'
                                        }`}
                                    >
                                        {(theme.isPublished || theme.isActive) ? <><EyeOff size={12} /> Despublicar</> : <><Globe size={12} /> Publicar</>}
                                    </button>
                                    <button
                                        onClick={() => handleDuplicate(theme)}
                                        disabled={duplicating}
                                        title="Duplicar tema"
                                        className={`w-9 h-9 flex items-center justify-center bg-[var(--bg-card)] border border-[var(--border-default)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] rounded-xl transition-all disabled:opacity-50`}
                                    >
                                        <Copy size={13} />
                                    </button>
                                    {!theme.isActive && theme.name !== 'Modo Oscuro' && theme.name !== 'Modo Claro' && (
                                        <button
                                            onClick={() => handleDelete(theme.id)}
                                            title="Eliminar tema"
                                            className="w-9 h-9 flex items-center justify-center border border-[var(--border-default)] text-[var(--text-muted)] hover:text-red-500 hover:border-red-500/30 rounded-xl transition-all"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}

                {/* Empty State / Create Box */}
                <div className="border-2 border-dashed border-[var(--border-default)] rounded-[2.5rem] p-8 flex flex-col items-center justify-center text-center space-y-4 hover:border-[var(--brand-primary)]/30 transition-all cursor-pointer group" onClick={() => document.querySelector<HTMLInputElement>('input[placeholder="Nombre del nuevo tema..."]')?.focus()}>
                    <div className="w-16 h-16 rounded-full bg-[var(--bg-surface)] border border-[var(--border-default)] flex items-center justify-center group-hover:text-[var(--brand-primary)] group-hover:border-[var(--brand-primary)]/30 transition-all">
                        <Plus size={32} />
                    </div>
                    <div>
                        <h4 className={`${T.cardTitle} font-bold`}>Crear Variante</h4>
                        <p className={`${T.helperText} text-xs max-w-[200px] mt-1`}>Experimenta con nuevas paletas sin afectar el tema activo.</p>
                    </div>
                </div>
            </div>

            {/* Gestión de Marca Global (Branding) */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-[2.5rem] p-8 space-y-8">
                <div className="flex items-center justify-between">
                    <div className="flex gap-3">
                         <Globe className="text-[var(--brand-primary)]" size={24} />
                         <h3 className={`${T.cardTitle} ${S.headingMd}`}>Branding Global de Plataforma</h3>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    {/* Visual Preview */}
                    <div className="space-y-6">
                        {/* Logo Upload */}
                        <div className="space-y-4">
                            <label className={`${T.labelText} ${S.meta} flex items-center gap-2`}>
                                <ImageIcon size={16} className="text-[var(--brand-primary)]" />
                                Logo Principal (Sidebar/Auth)
                            </label>
                            
                            <div className="flex items-center gap-6 p-6 bg-[var(--bg-elevated)] rounded-2xl border border-[var(--border-default)]">
                                <div className="w-20 h-20 bg-[var(--bg-page)] rounded-xl border border-[var(--border-default)] flex items-center justify-center overflow-hidden p-2">
                                    {branding?.logoUrl ? (
                                        <img src={branding.logoUrl || undefined} alt="Logo" className="max-w-full max-h-full object-contain" />
                                    ) : (
                                        <BrandLogo variant="full" size={40} />
                                    )}
                                </div>
                                <div className="flex-1 space-y-3">
                                    <div className="flex gap-2">
                                        <label className="flex-1 cursor-pointer bg-[var(--brand-primary)] text-[var(--brand-primary-foreground)] px-4 py-2.5 rounded-xl font-bold text-xs hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-sm">
                                            <Upload size={14} />
                                            Subir Logo
                                            <input type="file" className="hidden" accept="image/png,image/jpeg,image/svg+xml" onChange={handleLogoUpload} />
                                        </label>
                                        {branding?.logoUrl && (
                                            <button 
                                                onClick={handleLogoDelete}
                                                className="px-4 py-2.5 bg-[var(--state-danger)]/10 text-[var(--state-danger)] border border-[var(--state-danger)]/20 rounded-xl font-bold text-xs hover:bg-[var(--state-danger)]/20 transition-all"
                                            >
                                                Eliminar
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-widest pl-1">PNG o SVG recomendado (Max 2MB)</p>
                                </div>
                            </div>
                        </div>

                        {/* Favicon Upload */}
                        <div className="space-y-4">
                            <label className={`${T.labelText} ${S.meta} flex items-center gap-2`}>
                                <Monitor size={16} className="text-[var(--brand-primary)]" />
                                Browser Favicon (Pestaña)
                            </label>
                            
                            <div className="flex items-center gap-6 p-6 bg-[var(--bg-elevated)] rounded-2xl border border-[var(--border-default)]">
                                <div className="w-12 h-12 bg-[var(--bg-page)] rounded-xl border border-[var(--border-default)] flex items-center justify-center overflow-hidden p-2">
                                    {branding?.faviconUrl ? (
                                        <img src={branding.faviconUrl || undefined} alt="Favicon" className="w-8 h-8 object-contain" />
                                    ) : (
                                        <div className="w-6 h-6 bg-[var(--brand-primary)] rounded flex items-center justify-center">
                                            <Zap size={14} className="text-[var(--brand-primary-foreground)] fill-current" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 space-y-3">
                                    <div className="flex gap-2">
                                        <label className="flex-1 cursor-pointer bg-[var(--bg-page)] text-[var(--text-strong)] border border-[var(--border-default)] px-4 py-2.5 rounded-xl font-bold text-xs hover:bg-[var(--bg-hover)] transition-all flex items-center justify-center gap-2">
                                            <Upload size={14} />
                                            Subir Favicon
                                            <input type="file" className="hidden" accept="image/png,image/x-icon,image/svg+xml" onChange={handleFaviconUpload} />
                                        </label>
                                        {branding?.faviconUrl && (
                                            <button 
                                                onClick={handleFaviconDelete}
                                                className="px-4 py-2.5 bg-[var(--state-danger)]/10 text-[var(--state-danger)] border border-[var(--state-danger)]/20 rounded-xl font-bold text-xs hover:bg-[var(--state-danger)]/20 transition-all"
                                            >
                                                Eliminar
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-widest pl-1">ICO, PNG o SVG (Max 1MB)</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <p className={`${T.helperText} ${S.body}`}>
                            Personaliza la identidad visual global de tu plataforma. Estos cambios se aplican a <strong>todos los usuarios</strong> sin importar el tema seleccionado.
                        </p>
                        <div className="p-8 bg-[var(--bg-elevated)] rounded-3xl border border-[var(--border-default)] space-y-4">
                            <h5 className={`${T.cardTitle} text-sm font-bold`}>¿Por qué cambiar el Favicon?</h5>
                            <p className={`${T.helperText} text-xs leading-relaxed`}>
                                El Favicon es lo primero que ven tus usuarios en sus pestañas y marcadores. Personalizarlo refuerza la marca blanca y ofrece una experiencia profesional de extremo a extremo.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
