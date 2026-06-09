import React, { useState, useEffect, useMemo } from 'react';
import {
    Palette, Save, RefreshCcw, ArrowLeft, Info,
    Layout, Type, Square, MessageSquare, BarChart3,
    CheckCircle2, Baseline, Megaphone
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { colorsApi, ColorsConfig, DEFAULT_COLORS } from '@/api/wabee/colors.api';
import { themesApi } from '@/api/wabee/themes.api';
import { T, S } from '@/lib/text-tokens';

// --- Grupos de Color ---
const COLOR_CATEGORIES = [
    { id: 'brand',      name: 'Marca (Brand)',   icon: Palette,        description: 'Colores de identidad principal' },
    { id: 'text',       name: 'Textos (Base)',   icon: Baseline,       description: 'Colores base de texto de toda la app' },
    { id: 'bg',         name: 'Fondos (BG)',     icon: Layout,         description: 'Superficies y capas de interfaz' },
    { id: 'border',     name: 'Bordes',          icon: Square,         description: 'Divisiones y estados de foco' },
    { id: 'status',     name: 'Estados',         icon: MessageSquare,  description: 'Semántica de sistema (Éxito, Error...)' },
    { id: 'charts',     name: 'Gráficos',        icon: BarChart3,      description: 'Paleta categórica para visualización' },
    { id: 'marketing',  name: 'Marketing',       icon: Megaphone,      description: 'Sitio público (landing y login)' },
];

const COLOR_TOKENS_METADATA: Record<string, { name: string, desc: string, impacts: string }> = {
    // Brand
    'brand-primary': { name: 'Primario', desc: 'Color principal de la marca', impacts: 'Botones primarios, acentos, links' },
    'brand-primary-foreground': { name: 'Contraste Primario', desc: 'Texto sobre el color primario', impacts: 'Texto en botones amarillos' },
    // Textos base
    'text-strong': { name: 'Texto Fuerte', desc: 'Texto principal / títulos', impacts: 'Títulos, valores, texto destacado' },
    'text-body': { name: 'Texto Cuerpo', desc: 'Texto de párrafo', impacts: 'Descripciones y cuerpos de texto' },
    'text-muted': { name: 'Texto Apagado', desc: 'Texto secundario', impacts: 'Labels, ayudas, metadatos' },
    'text-inverse': { name: 'Texto Inverso', desc: 'Texto sobre fondos oscuros/color', impacts: 'Texto sobre superficies invertidas' },
    // Backgrounds
    'bg-page': { name: 'Fondo Página', desc: 'Base de fondo principal', impacts: 'Body de la aplicación' },
    'bg-surface': { name: 'Superficie', desc: 'Fondo secundario', impacts: 'Zonas de contenido lateral' },
    'bg-card': { name: 'Tarjeta / Nav', desc: 'Nivel principal de contenido', impacts: 'Cards, Sidebar, Navbar, Modales' },
    'bg-elevated': { name: 'Elevación', desc: 'Elementos flotantes', impacts: 'Dropdowns, Tooltips, Popovers' },
    'bg-input': { name: 'Fondo Input', desc: 'Fondo de formularios', impacts: 'Inputs, Selects, Textareas' },
    'bg-hover': { name: 'Fondo Hover', desc: 'Interacción mouse-over', impacts: 'Filas hover, botones ghost' },
    'bg-selected': { name: 'Fondo Seleccionado', desc: 'Estado activo', impacts: 'Tabs activas, filas seleccionadas' },
    // Borders
    'border-default': { name: 'Default', desc: 'Borde estándar', impacts: 'Divisiones de cards y tablas' },
    'border-strong': { name: 'Fuerte', desc: 'Borde remarcado', impacts: 'Bordes de sección' },
    'border-focus': { name: 'Foco (Focus)', desc: 'Estado de teclado', impacts: 'Rings de inputs y botones' },
    // Status
    'state-success': { name: 'Éxito', desc: 'Acciones correctas', impacts: 'Alertas positivas, KPIs subir' },
    'state-warning': { name: 'Advertencia', desc: 'Cuidado / Alerta', impacts: 'Badges de pendiente' },
    'state-danger': { name: 'Peligro', desc: 'Errores / Borrar', impacts: 'Botones eliminar, alertas error' },
    'state-info': { name: 'Información', desc: 'Notas de sistema', impacts: 'Links informativos' },
    // Charts
    'chart-1': { name: 'Serie 1', desc: 'Color principal de datos', impacts: 'Línea 1, barra 1' },
    'chart-2': { name: 'Serie 2', desc: 'Color secundario', impacts: 'Línea 2, barra 2' },
    'chart-3': { name: 'Serie 3', desc: 'Color terciario', impacts: 'Visualización 3' },
    'chart-4': { name: 'Serie 4', desc: 'Color cuaternario', impacts: 'Visualización 4' },
    'chart-5': { name: 'Serie 5', desc: 'Color complementario', impacts: 'Visualización 5' },
    'chart-grid': { name: 'Rejilla', desc: 'Guías de gráfico', impacts: 'Grid lines' },
    'chart-axis': { name: 'Ejes', desc: 'Textos de escalas', impacts: 'Numbers en X/Y' },
    'chart-tooltip-bg': { name: 'Tooltip BG', desc: 'Fondo de flotante', impacts: 'Caja hover en charts' },
    'chart-tooltip-text': { name: 'Tooltip Texto', desc: 'Texto interior', impacts: 'Valores en tooltip' },
    // Marketing / Landing
    'mkt-surface': { name: 'Superficie Glass', desc: 'Tarjetas translúcidas del sitio público', impacts: 'Cards de landing, panel de login' },
    'mkt-surface-2': { name: 'Superficie Glass 2', desc: 'Variante más translúcida', impacts: 'Tarjetas de tokens / secundarias' },
    'mkt-border': { name: 'Borde Marketing', desc: 'Borde sutil de superficies', impacts: 'Contornos de cards públicas' },
    'mkt-ink': { name: 'Tinta Oscura', desc: 'Chips y badges oscuros', impacts: 'Etiquetas oscuras en landing' },
};

// --- Componentes de Preview Internos ---
const LivePreview = ({ config }: { config: ColorsConfig }) => {
    // Generamos el estilo local para el contenedor de preview
    const inlineStyles = useMemo(() => {
        const style: any = {};
        Object.entries(config).forEach(([key, value]) => {
            style[`--${key}`] = value;
        });
        return style;
    }, [config]);

    return (
        <div style={inlineStyles} className="bg-[var(--bg-page)] rounded-[2rem] p-3 sm:p-6 space-y-4 sm:space-y-6 w-full animate-in fade-in duration-500 min-h-[700px]">
            {/* Header / Sidebar Mock */}
            <div className="flex gap-4 items-center border-b border-[var(--border-strong)] pb-4 mb-2">
                <div className={`w-10 h-10 rounded-xl bg-[var(--brand-primary)] flex items-center justify-center  shadow-lg shadow-[var(--brand-primary)]/10 ${T.buttonPrimaryText}`}>
                    <Palette size={20} />
                </div>
                <div>
                  <h4 className="text-[var(--tx-pageTitle-color)] text-sm font-black uppercase tracking-[0.2em]">Live Preview</h4>
                  <p className="text-[var(--tx-pageSubtitle-color)] text-[9px] font-bold">bg-page + border-strong</p>
                </div>
            </div>

            {/* List Selection Example (para bg-selected y text-body) */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-2xl overflow-hidden">
                <div className="bg-[var(--bg-surface)] px-4 py-2 border-b border-[var(--border-default)] flex justify-between items-center">
                    <span className="text-[var(--tx-sectionSubtitle-color)] text-[8px] font-black uppercase tracking-widest">Ejemplo de Listado</span>
                    <div className="w-2 h-2 rounded-full bg-[var(--state-success)]" />
                </div>
                <div className="p-1 space-y-0.5">
                    <div className="flex items-center gap-3 px-3 py-2 text-[var(--tx-tableCell-color)] text-xs rounded-lg hover:bg-[var(--bg-hover)] transition-all cursor-pointer">
                        <Square size={12} className="text-[var(--tx-statusText-color)]" />
                        <span>Fila con fondo hover</span>
                    </div>
                    <div className="flex items-center gap-3 px-3 py-2 text-[var(--brand-primary)] text-xs rounded-lg bg-[var(--bg-selected)] border border-[var(--brand-primary)]/10 font-bold transition-all">
                        <CheckCircle2 size={12} />
                        <span>Fila con token: bg-selected</span>
                    </div>
                </div>
            </div>

            {/* Card de Ejemplo */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-[2rem] p-4 sm:p-6 shadow-xl relative overflow-hidden">
                <div className={`absolute top-0 right-0 w-32 h-32 bg-[var(--brand-primary)] opacity-5 blur-3xl -mr-16 -mt-16 ${T.buttonPrimaryText}`} />

                <div className="flex flex-wrap justify-between items-start gap-2 mb-6">
                    <div className="min-w-0">
                        <h3 className={`${T.cardTitle} text-[var(--tx-cardTitle-color)]`}>Dashboard de Métricas</h3>
                        <p className={`${T.cardSubtitle} text-[var(--tx-cardSubtitle-color)]`}>Visualización de tokens en tiempo real</p>
                    </div>
                    <div className="shrink-0 bg-[var(--state-success)] text-[var(--tx-buttonText-color)] px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                        Activo
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
                    <div className="bg-[var(--bg-surface)] p-3 sm:p-4 rounded-2xl border border-[var(--border-default)] min-w-0">
                        <span className="text-[var(--tx-kpiLabel-color)] text-[10px] uppercase font-bold">Métrica A</span>
                        <div className="text-[var(--tx-kpiValue-color)] text-lg sm:text-2xl font-black mt-1 tracking-tight truncate">$45,280</div>
                        <div className="text-[var(--state-success)] text-[10px] font-bold mt-1">↑ 12.5%</div>
                    </div>
                    <div className="bg-[var(--bg-surface)] p-3 sm:p-4 rounded-2xl border border-[var(--border-default)] min-w-0">
                        <span className="text-[var(--tx-kpiLabel-color)] text-[10px] uppercase font-bold">Métrica B</span>
                        <div className="text-[var(--tx-kpiValue-color)] text-lg sm:text-2xl font-black mt-1 tracking-tight truncate">1,402</div>
                        <div className="text-[var(--state-danger)] text-[10px] font-bold mt-1">↓ 3.2%</div>
                    </div>
                </div>

                {/* Texto largo para text-body */}
                <p className="text-[var(--tx-messageText-color)] text-[11px] leading-relaxed mb-6 font-medium">
                  Este es el cuerpo de texto principal (consumiendo <b>tx-messageText</b>). Se utiliza para descripciones multilínea donde se requiere una lectura cómoda sobre el fondo de la card (<b>bg-card</b>). Los colores de texto se configuran en el módulo de Tipografía.
                </p>

                <div className="space-y-3">
                    <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg bg-[var(--brand-primary)] flex items-center justify-center  font-bold ${T.buttonPrimaryText}`}>W</div>
                        <div className="flex-1 h-2 bg-[var(--bg-hover)] rounded-full overflow-hidden">
                            <div className={`w-[70%] h-full bg-[var(--brand-primary)] ${T.buttonPrimaryText}`} />
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[var(--bg-elevated)] flex items-center justify-center border border-[var(--border-default)] shadow-lg">
                            <Layout className="text-[var(--tx-navText-color)]" size={14} />
                        </div>
                        <div className="flex-1 h-2 bg-[var(--bg-hover)] rounded-full overflow-hidden">
                            <div className="w-[45%] h-full bg-[var(--chart-3)]" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Formulario / Input / Botones */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-[2rem] p-4 sm:p-6 space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-[var(--tx-labelText-color)] text-[11px] font-bold ml-1 uppercase tracking-wider">Campo de Entrada</label>
                        <input 
                            type="text" 
                            defaultValue="Token: bg-input"
                            className="w-full bg-[var(--bg-input)] border border-[var(--border-default)] focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)]/20 rounded-xl px-4 py-2.5 text-[var(--tx-inputText-color)] text-sm outline-none transition-all"
                        />
                    </div>
                    <div className="flex gap-3">
                        <button className={`flex-1 bg-[var(--brand-primary)]  px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-[var(--brand-primary)]/20 ${T.buttonPrimaryText}`}>
                            Primario
                        </button>
                        <button className="flex-1 border border-[var(--border-default)] text-[var(--tx-buttonText-color)] px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-[var(--bg-hover)] transition-all">
                            Outline
                        </button>
                    </div>
                </div>

                <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-[2rem] p-4 sm:p-6 flex flex-col justify-center gap-3">
                    <div className="flex items-center justify-between text-[var(--tx-tableHeader-color)] text-sm font-bold border-b border-[var(--border-strong)] pb-2 mb-2">
                        <span>Estado</span>
                        <span>Métricas</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-[var(--tx-helperText-color)]">Cargando...</span>
                        <div className="w-12 h-1.5 bg-[var(--bg-hover)] rounded-full overflow-hidden">
                            <div className="w-1/2 h-full bg-[var(--state-warning)] animate-pulse" />
                        </div>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-[var(--tx-helperText-color)]">Información</span>
                        <span className="text-[var(--state-info)] font-bold">Detalles de API</span>
                    </div>
                </div>
            </div>

            {/* Simulación de Chart */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-[2rem] p-4 sm:p-6">
                <div className="flex justify-between items-center mb-6">
                    <h4 className="text-[var(--text-strong)] font-bold text-sm">Visualización (Recharts)</h4>
                    <BarChart3 className="text-[var(--text-muted)]" size={18} />
                </div>
                <div className="h-32 flex items-end gap-3 px-4 relative">
                    {/* Grilla Sutil */}
                    <div className="absolute inset-x-0 bottom-0 h-full border-b border-[var(--chart-grid)] opacity-50" />
                    <div className="absolute inset-x-0 bottom-1/2 h-px border-t border-[var(--chart-grid)] opacity-30" />
                    <div className="absolute inset-x-0 top-0 h-px border-t border-[var(--chart-grid)] opacity-30" />
                    
                    {[
                        { h: 'h-[40%]', c: 'bg-[var(--chart-1)]' },
                        { h: 'h-[75%]', c: 'bg-[var(--chart-2)]' },
                        { h: 'h-[55%]', c: 'bg-[var(--chart-3)]' },
                        { h: 'h-[90%]', c: 'bg-[var(--chart-4)]' },
                        { h: 'h-[65%]', c: 'bg-[var(--chart-5)]' },
                    ].map((bar, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-2 relative z-10">
                            <div className={`${bar.h} w-full rounded-t-lg ${bar.c} transition-all duration-500`} />
                            <span className="text-[var(--chart-axis)] text-[9px] font-bold uppercase">{`V${i+1}`}</span>
                        </div>
                    ))}
                </div>
                {/* Tooltip Mockup */}
                <div className="mt-8 flex justify-center">
                    <div className="bg-[var(--chart-tooltip-bg)] border border-[var(--border-default)] rounded-xl px-4 py-2 shadow-2xl flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-[var(--chart-4)]" />
                        <span className="text-[var(--chart-tooltip-text)] text-[10px] font-bold">Dato enfocado en tooltip</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const BrandingColorsPage = () => {
    const navigate = useNavigate();
    const { id } = useParams(); // ID del tema opcional
    const [config, setConfig] = useState<ColorsConfig>(DEFAULT_COLORS);
    const [themeName, setThemeName] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [activeCategory, setActiveCategory] = useState('brand');

    useEffect(() => {
        const load = async () => {
            try {
                if (id) {
                    const themes = await themesApi.getThemes();
                    const theme = themes.find(t => t.id === id);
                    if (theme) {
                        setConfig({ ...DEFAULT_COLORS, ...theme.colors });
                        setThemeName(theme.name);
                    }
                } else {
                    const data = await colorsApi.getColors();
                    if (data && typeof data === 'object') {
                        setConfig({ ...DEFAULT_COLORS, ...data });
                    }
                }
            } catch (error) {
                console.error('Error loading colors:', error);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id]);

    const tokensByCategory = useMemo(() => {
        const tokens = Object.keys(DEFAULT_COLORS);
        if (activeCategory === 'brand') return tokens.filter(t => t.startsWith('brand-'));
        if (activeCategory === 'bg') return tokens.filter(t => t.startsWith('bg-'));
        if (activeCategory === 'text') return tokens.filter(t => t.startsWith('text-'));
        if (activeCategory === 'border') return tokens.filter(t => t.startsWith('border-'));
        if (activeCategory === 'status') return tokens.filter(t => t.startsWith('state-'));
        if (activeCategory === 'charts') return tokens.filter(t => t.startsWith('chart-'));
        if (activeCategory === 'marketing') return tokens.filter(t => t.startsWith('mkt-'));
        return [];
    }, [activeCategory]);

    const handleColorChange = (token: string, value: string) => {
        setConfig(prev => ({ ...prev, [token]: value }));
        setHasChanges(true);
        setSaveSuccess(false);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            if (id) {
                await themesApi.updateTheme(id, { colors: config });
            } else {
                await colorsApi.updateColors(config);
            }
            setHasChanges(false);
            setSaveSuccess(true);
            window.dispatchEvent(new CustomEvent('refresh-branding-colors'));
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (error) {
            console.error('Error saving colors:', error);
            alert('Error al guardar la configuración de colores.');
        } finally {
            setSaving(false);
        }
    };

    const handleReset = async () => {
        if (!confirm('¿Restaurar la paleta de este tema a los valores originales?')) return;
        try {
            if (id) {
                setConfig(DEFAULT_COLORS);
                setHasChanges(true);
            } else {
                const data = await colorsApi.resetColors();
                setConfig({ ...DEFAULT_COLORS, ...data });
                setHasChanges(false);
            }
            window.dispatchEvent(new CustomEvent('refresh-branding-colors'));
        } catch (error) {
            console.error('Error resetting colors:', error);
        }
    };

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
                    <button
                        onClick={() => navigate('/dashboard/super-admin/themes')}
                        className={`flex items-center gap-2 ${T.helperText} hover:text-[var(--brand-primary)] transition-colors mb-2 text-xs font-bold uppercase tracking-widest`}
                    >
                        <ArrowLeft size={14} /> Gestión de Temas
                    </button>
                    <h1 className={`${T.pageTitle} ${S.displayMd}`}>
                        Colores: <span className="text-[var(--brand-primary)]">{themeName || 'Global'}</span>
                    </h1>
                    <p className={`${T.pageSubtitle} ${S.body}`}>
                        Personaliza los tokens semánticos de este tema y observa el cambio en el preview.
                    </p>
                </div>

                <div className="flex gap-3 shrink-0">
                    <button
                        onClick={handleReset}
                        className={`flex items-center gap-2 px-5 py-2.5 border border-[var(--border-default)] rounded-2xl ${T.helperText} hover:bg-[var(--bg-hover)] transition-all font-bold text-xs`}
                    >
                        <RefreshCcw size={14} /> Restaurar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!hasChanges || saving}
                        className={`flex items-center gap-2 px-7 py-2.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${
                            saveSuccess
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : hasChanges && !saving
                                    ? 'bg-[var(--brand-primary)]  hover:scale-[1.02] shadow-lg'
                                    : 'bg-[var(--bg-input)] opacity-40 cursor-not-allowed border border-[var(--border-default)]'
                        } ${T.buttonPrimaryText}`}
                    >
                        {saveSuccess
                            ? <><CheckCircle2 size={14} /> Guardado</>
                            : <><Save size={14} /> {saving ? 'Guardando...' : 'Guardar'}</>
                        }
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-10 items-start">
                {/* Editor (Lado Izquierdo) */}
                <div className="space-y-6">
                    {/* Tabs de Categorías */}
                    <div className="bg-[var(--bg-card)] border border-[var(--border-default)] p-1.5 rounded-2xl grid grid-cols-3 gap-1">
                        {COLOR_CATEGORIES.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setActiveCategory(cat.id)}
                                className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all gap-1.5 ${
                                    activeCategory === cat.id 
                                        ? `bg-[var(--bg-surface)] text-[var(--brand-primary)] border border-[var(--brand-primary)]/20 shadow-inner` 
                                        : `${T.helperText} hover:bg-[var(--bg-hover)]`
                                }`}
                            >
                                <cat.icon size={16} />
                                <span className="text-[9px] font-black uppercase tracking-tighter">{cat.name}</span>
                            </button>
                        ))}
                    </div>

                    <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-[1.5rem] p-5 space-y-5">
                        <div className="border-b border-[var(--border-default)] pb-4">
                            <div className="flex items-center justify-between gap-2">
                                <h3 className={`${T.cardTitle} font-black text-xs uppercase tracking-widest flex items-center gap-2`}>
                                    {COLOR_CATEGORIES.find(c => c.id === activeCategory)?.name}
                                </h3>
                                <span className="shrink-0 rounded-full bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] px-2.5 py-1 text-[10px] font-black">
                                    {tokensByCategory.length} {tokensByCategory.length === 1 ? 'color' : 'colores'}
                                </span>
                            </div>
                            <p className={`${T.helperText} text-[11px] mt-1.5 font-medium leading-snug`}>
                                {COLOR_CATEGORIES.find(c => c.id === activeCategory)?.description}
                            </p>
                        </div>

                        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                            {tokensByCategory.map(token => {
                                const meta = COLOR_TOKENS_METADATA[token];
                                return (
                                    <div key={token} className="group p-4 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl hover:border-[var(--border-strong)] transition-all">
                                        <div className="flex justify-between items-start gap-3 mb-2">
                                            <div className="min-w-0">
                                                <h4 className={`${T.cardTitle} text-sm font-black`}>{meta?.name || token}</h4>
                                                <code className="text-[10px] text-[var(--brand-primary)]/70 block mt-1 font-mono">{`var(--${token})`}</code>
                                            </div>
                                            <div
                                                className="w-10 h-10 shrink-0 rounded-xl border border-[var(--border-strong)] shadow-inner"
                                                style={{ backgroundColor: config[token] }}
                                            />
                                        </div>

                                        <p className={`text-[12px] text-[var(--text-body)] mb-2 leading-snug`}>
                                            {meta?.desc}
                                        </p>

                                        {meta?.impacts && (
                                            <div className={`mb-3 text-[11px] leading-snug text-[var(--text-muted)] flex items-start gap-1.5`}>
                                                <CheckCircle2 size={12} className="text-[var(--brand-primary)] shrink-0 mt-0.5" />
                                                <span><span className="font-bold text-[var(--text-body)]">Dónde se usa:</span> {meta.impacts}</span>
                                            </div>
                                        )}

                                        <div className="flex items-center gap-2">
                                            <div className="relative flex-1">
                                                <input
                                                    type="text"
                                                    value={config[token]}
                                                    onChange={(e) => handleColorChange(token, e.target.value)}
                                                    className={`w-full bg-[var(--bg-input)] border border-[var(--border-default)] rounded-lg py-2 px-3 text-[12px] font-mono ${T.inputText} outline-none focus:border-[var(--brand-primary)]/40`}
                                                />
                                                <input
                                                    type="color"
                                                    value={config[token].startsWith('rgba') ? '#000000' : config[token]}
                                                    disabled={config[token].startsWith('rgba')}
                                                    onChange={(e) => handleColorChange(token, e.target.value)}
                                                    className="absolute right-1 top-1 w-7 h-7 rounded cursor-pointer opacity-0"
                                                />
                                                <Palette size={14} className={`absolute right-2.5 top-2.5 ${T.helperText} pointer-events-none`} />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Preview (Lado Derecho) */}
                <div className="sticky top-10">
                    <div className="mb-4 flex items-center justify-between">
                        <h3 className={`${T.sectionTitle} font-black text-xs uppercase tracking-[0.2em] flex items-center gap-2`}>
                            <Layout size={14} className="text-[var(--brand-primary)]" /> Live Preview
                        </h3>
                        <div className="flex gap-2">
                            <span className="w-2 h-2 rounded-full bg-red-500/50" />
                            <span className="w-2 h-2 rounded-full bg-amber-500/50" />
                            <span className="w-2 h-2 rounded-full bg-emerald-500/50" />
                        </div>
                    </div>

                    <div className="bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-[2.5rem] p-1 shadow-2xl overflow-hidden min-h-[700px]">
                        <div className="bg-[var(--bg-card)] rounded-[2.2rem] p-3 sm:p-6 lg:p-10 h-full overflow-y-auto max-h-[85vh]">
                            <LivePreview config={config} />
                            
                            <div className={`mt-10 p-5 bg-[var(--brand-primary)]/5 border border-[var(--brand-primary)]/10 rounded-3xl flex gap-4 items-start ${T.buttonPrimaryText}`}>
                                <Info size={18} className="text-[var(--brand-primary)] shrink-0 mt-0.5" />
                                <p className={`${T.helperText} text-[10px] font-bold leading-relaxed`}>
                                    Esta vista previa inyecta dinámicamente las variables <code className="text-[var(--brand-primary)]">--var</code> en el scope local del contenedor. El resto de la plataforma solo se verá afectada cuando hagas clic en <b>Guardar</b>.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Banner Flotante si hay cambios */}
            {hasChanges && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-6 duration-300">
                    <div className="bg-[var(--bg-card)]/95 backdrop-blur-md border border-[var(--brand-primary)]/30 px-6 py-3.5 rounded-[2rem] shadow-2xl flex items-center gap-5">
                        <div className="flex items-center gap-2.5">
                            <div className={`w-2 h-2 rounded-full bg-[var(--brand-primary)] animate-pulse shrink-0 ${T.buttonPrimaryText}`} />
                            <span className={`${T.tableCell} text-xs font-bold`}>Cambios en borrador</span>
                        </div>
                        <div className="h-5 w-px bg-[var(--border-default)]" />
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className={`bg-[var(--brand-primary)]  px-5 py-1.5 rounded-xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg disabled:opacity-60 ${T.buttonPrimaryText}`}
                        >
                            {saving ? 'Guardando...' : 'Aplicar'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
