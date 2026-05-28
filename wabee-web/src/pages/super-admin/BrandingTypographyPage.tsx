import React, { useState, useEffect } from 'react';
import { Type, Save, RefreshCcw, ArrowLeft, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { T, S } from '@/lib/text-tokens';
import { brandingApi, TypographyConfig, DEFAULT_TYPOGRAPHY } from '@/api/wabee/branding.api';
import { themesApi } from '@/api/wabee/themes.api';
import { useNavigate, useParams } from 'react-router-dom';

// ─── Mapa de tamaños de preview semántico por grupo ─────────────────────────
// Cada grupo tiene el tamaño que reflejaría mejor su uso real en la plataforma.
const PREVIEW_SIZE: Record<string, string> = {
    pageTitle:       S.displayMd,
    pageSubtitle:    S.body,
    sectionTitle:    S.headingLg,
    sectionSubtitle: S.body,
    cardTitle:       S.headingSm,
    cardSubtitle:    S.meta,
    kpiValue:        S.kpiLg,
    kpiLabel:        S.meta,
    labelText:       S.meta,
    inputText:       S.body,
    buttonText:      S.body,
    navText:         S.body,
    menuText:        S.body,
    tableHeader:     S.meta,
    tableCell:       S.body,
    statusText:      S.meta,
    messageText:     S.body,
    helperText:      S.meta,
    emptyStateTitle: S.displayMd,
    emptyStateBody:  S.body,
};

interface TextGroupMetadata {
    key: string;
    name: string;
    description: string;
    preview: string;
}

// ─── 20 grupos oficiales — orden visual lógico de la página ─────────────────
const TEXT_GROUPS: TextGroupMetadata[] = [
    // Títulos y estructura
    { key: 'pageTitle',        name: 'Título de Página',       description: 'Encabezado principal de cada sección del dashboard',  preview: 'Dashboard Ejecutivo'                             },
    { key: 'pageSubtitle',     name: 'Subtítulo de Página',    description: 'Descripción bajo el título principal de página',       preview: 'Marketing conversacional para tu negocio'        },
    { key: 'sectionTitle',     name: 'Título de Sección',      description: 'Encabezados h2/h3 de bloques internos',                preview: 'Rendimiento General'                             },
    { key: 'sectionSubtitle',  name: 'Subtítulo de Sección',   description: 'Descripción bajo el encabezado de sección',           preview: 'Métricas del período seleccionado'               },
    { key: 'cardTitle',        name: 'Título de Card',         description: 'Encabezado de tarjetas y widgets del dashboard',       preview: 'Top Campañas'                                    },
    { key: 'cardSubtitle',     name: 'Subtítulo de Card',      description: 'Metadata o rango temporal en cabecera de card',        preview: 'Rendimiento del período actual'                  },
    // KPI
    { key: 'kpiLabel',         name: 'Etiqueta KPI',           description: 'Nombre de la métrica sobre el valor numérico',         preview: 'Conversaciones'                                  },
    { key: 'kpiValue',         name: 'Valor KPI',              description: 'Número grande resaltado en dashboards y métricas',     preview: '1,245'                                           },
    // Formularios
    { key: 'labelText',        name: 'Etiquetas',              description: 'Labels sobre campos de formulario',                    preview: 'Correo electrónico'                              },
    { key: 'inputText',        name: 'Texto de Entrada',       description: 'Texto dentro de campos editables por el usuario',      preview: 'tu@empresa.com'                                  },
    // Acciones
    { key: 'buttonPrimaryText',name: 'Texto de Botón (Pri.)',  description: 'Etiquetas de botones principales (fondo primario)',    preview: 'Guardar cambios'                                 },
    { key: 'buttonText',       name: 'Texto de Botón (Sec.)',  description: 'Etiquetas de botones secundarios o acciones menores',  preview: 'Cancelar'                                        },
    // Navegación
    { key: 'navText',          name: 'Navegación',             description: 'Items del sidebar y tabs de navegación principal',     preview: 'Campañas'                                        },
    { key: 'menuText',         name: 'Menús Desplegables',     description: 'Opciones en dropdowns y menú de perfil',               preview: 'Cerrar sesión'                                   },
    // Tablas
    { key: 'tableHeader',      name: 'Cabecera de Tabla',      description: 'Títulos de columna en listados de datos',              preview: 'Fecha'                                           },
    { key: 'tableCell',        name: 'Celda de Tabla',         description: 'Datos principales en filas de tabla',                  preview: '19 Mar 2026'                                     },
    // Estados y mensajes
    { key: 'statusText',       name: 'Estados / Badges',       description: 'Indicadores de estado, chips y etiquetas semánticas',  preview: 'Activo'                                          },
    { key: 'messageText',      name: 'Mensajes',               description: 'Toasts, alertas inline y textos de diálogo',           preview: 'Cambios guardados correctamente'                 },
    { key: 'helperText',       name: 'Texto Auxiliar',         description: 'Notas al pie, contadores y metadatos secundarios',     preview: 'Última actualización hace 5 min'                 },
    // Empty states
    { key: 'emptyStateTitle',  name: 'Título Estado Vacío',    description: 'Encabezado cuando no hay resultados que mostrar',      preview: 'Sin resultados'                                  },
    { key: 'emptyStateBody',   name: 'Cuerpo Estado Vacío',    description: 'Texto explicativo en pantallas sin contenido',         preview: 'No se encontraron registros con los filtros activos' },
];

const FONTS = ['Inter', 'Poppins', 'Manrope', 'DM Sans', 'System UI'];

// Umbral de luminancia simple para fondo oscuro #121208
const isReadableOnDark = (hex: string): boolean => {
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return true;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return luma > 40;
};

export const BrandingTypographyPage = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const [config, setConfig] = useState<TypographyConfig>(DEFAULT_TYPOGRAPHY);
    const [themeName, setThemeName] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    useEffect(() => {
        const load = async () => {
            try {
                if (id) {
                    const themes = await themesApi.getThemes();
                    const theme = themes.find(t => t.id === id);
                    if (theme) {
                        setThemeName(theme.name);
                        // Merge seguro con defaults
                        const merged = { ...DEFAULT_TYPOGRAPHY };
                        const themeTypography = theme.typography || {};
                        Object.keys(themeTypography).forEach(key => {
                            if (merged[key]) merged[key] = { ...merged[key], ...themeTypography[key] };
                        });
                        setConfig(merged);
                    }
                } else {
                    const data = await brandingApi.getTypography();
                    if (data && typeof data === 'object') {
                        const merged = { ...DEFAULT_TYPOGRAPHY };
                        Object.keys(data).forEach(key => {
                            if (merged[key]) merged[key] = { ...merged[key], ...data[key] };
                        });
                        setConfig(merged);
                    }
                }
            } catch (error) {
                console.error('Error loading typography config:', error);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id]);

    const handleChange = (key: string, field: 'color' | 'fontFamily', value: string) => {
        setConfig(prev => ({
            ...prev,
            [key]: { ...prev[key], [field]: value },
        }));
        setHasChanges(true);
        setSaveSuccess(false);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            if (id) {
                await themesApi.updateTheme(id, { typography: config });
            } else {
                await brandingApi.updateTypography(config);
            }
            setHasChanges(false);
            setSaveSuccess(true);
            window.dispatchEvent(new CustomEvent('refresh-branding-typography'));
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (error: any) {
            console.error('Error saving typography:', error);
            const serverMsg = error.response?.data?.error?.message || error.message || 'Error desconocido';
            alert(`No se pudo guardar la configuración.\n\nMotivo exacto del servidor:\n${serverMsg}\n\nRevisa la consola para más detalles.`);
        } finally {
            setSaving(false);
        }
    };

    const handleReset = async () => {
        if (!confirm('¿Restaurar los grupos de este tema a los valores por defecto?')) return;
        try {
            if (id) {
                setConfig(DEFAULT_TYPOGRAPHY);
                setHasChanges(true);
            } else {
                const data = await brandingApi.resetTypography();
                if (data && typeof data === 'object') {
                    const merged = { ...DEFAULT_TYPOGRAPHY };
                    Object.keys(data).forEach(key => {
                        if (merged[key]) merged[key] = { ...merged[key], ...data[key] };
                    });
                    setConfig(merged);
                }
                setHasChanges(false);
            }
            setSaveSuccess(false);
            window.dispatchEvent(new CustomEvent('refresh-branding-typography'));
        } catch (error) {
            console.error('Error resetting typography:', error);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="w-6 h-6 rounded-full border-2 border-[var(--brand-primary)] border-t-transparent animate-spin" />
        </div>
    );

    return (
        <div className="p-4 sm:p-6 lg:p-10 w-full max-w-7xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">

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
                        Textos: <span className="text-[var(--brand-primary)]">{themeName || 'Global'}</span>
                    </h1>
                    <p className={`${T.pageSubtitle} ${S.body}`}>
                        Configura el estilo tipográfico de este tema específico.
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
                            : <><Save size={14} /> {saving ? 'Guardando...' : 'Guardar Cambios'}</>
                        }
                    </button>
                </div>
            </div>

            {/* Info Box */}
            <div className={`bg-[var(--brand-primary)]/5 border border-[var(--brand-primary)]/20 rounded-3xl p-5 flex gap-4 items-start ${T.buttonPrimaryText}`}>
                <div className={`bg-[var(--brand-primary)]/10 p-2 rounded-xl text-[var(--brand-primary)] shrink-0 mt-0.5 ${T.buttonPrimaryText}`}>
                    <Info size={18} />
                </div>
                <div className="space-y-1">
                    <h4 className={`${T.cardTitle} font-bold text-sm`}>Configuración Centralizada de Plataforma</h4>
                    <p className={`${T.helperText} text-xs leading-relaxed`}>
                        Estos 20 grupos fueron definidos en la auditoría tipográfica del frontend. Los cambios se aplican
                        globalmente vía variables CSS <code className="text-[var(--brand-primary)]/70">--tx-*</code> y afectan
                        todos los componentes que consumen tokens <code className="text-[var(--brand-primary)]/70">T.*</code>.
                        No modifican tamaños ni pesos en esta fase.
                    </p>
                </div>
            </div>

            {/* Tabla de grupos */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-[1.5rem] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-[var(--border-default)] bg-[var(--bg-surface)]">
                                <th className={`px-6 py-4 text-[9px] ${T.tableHeader} font-black uppercase tracking-widest whitespace-nowrap`}>Grupo Semántico</th>
                                <th className={`px-6 py-4 text-[9px] ${T.tableHeader} font-black uppercase tracking-widest`}>Vista Previa Real</th>
                                <th className={`px-6 py-4 text-[9px] ${T.tableHeader} font-black uppercase tracking-widest whitespace-nowrap`}>Tipografía</th>
                                <th className={`px-6 py-4 text-[9px] ${T.tableHeader} font-black uppercase tracking-widest whitespace-nowrap`}>Color Hex</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-default)]/50">
                            {TEXT_GROUPS.map((group) => {
                                const groupConfig = config[group.key] || DEFAULT_TYPOGRAPHY[group.key] || { color: '#ffffff', fontFamily: 'Inter' };
                                const readable = isReadableOnDark(groupConfig.color);
                                const tokenClass = T[group.key as keyof typeof T];
                                const previewSize = PREVIEW_SIZE[group.key] || S.body;

                                return (
                                    <tr key={group.key} className="group hover:bg-[var(--bg-hover)]/50 transition-colors">
                                        {/* Columna 1: Info del Grupo */}
                                        <td className="px-6 py-4 min-w-[200px] align-top">
                                            <div className="flex flex-col gap-1.5">
                                                <div className="flex items-center gap-2">
                                                    <h3 className={`${T.tableCell} font-black text-[10px] uppercase tracking-widest`}>
                                                        {group.name}
                                                    </h3>
                                                    <code className={`text-[7.5px] bg-[var(--bg-surface)] px-1.5 py-0.5 rounded text-[var(--brand-primary)]/60 border border-[var(--border-default)] font-mono whitespace-nowrap mt-px`}>
                                                        {group.key}
                                                    </code>
                                                </div>
                                                <p className={`${T.helperText} text-[9px] font-bold leading-tight max-w-[240px]`}>
                                                    {group.description}
                                                </p>
                                            </div>
                                        </td>

                                        {/* Columna 2: Preview */}
                                        <td className="px-6 py-4 align-top w-1/3">
                                            <div className="relative bg-[var(--bg-elevated)] rounded-xl flex items-center justify-center overflow-hidden border border-[var(--border-default)] p-4 min-h-[58px] group-hover:border-[var(--border-strong)] transition-all">
                                                {/* Patrón sutil */}
                                                <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[radial-gradient(var(--brand-primary)_1px,transparent_1px)] [background-size:12px_12px]" />
                                                
                                                <span
                                                    style={{ color: groupConfig.color, fontFamily: groupConfig.fontFamily }}
                                                    className={`${tokenClass ?? ''} ${previewSize} transition-all text-center leading-snug`}
                                                >
                                                    {group.preview}
                                                </span>

                                                {/* Indicador de contraste */}
                                                <div className="absolute bottom-1.5 right-2">
                                                    {readable ? (
                                                        <div className="flex items-center gap-0.5 bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded-full text-[7px] font-bold">
                                                            <CheckCircle2 size={8} /> OK
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-0.5 bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded-full text-[7px] font-bold animate-pulse" title="El contraste sobre fondo oscuro es muy bajo">
                                                            <AlertCircle size={8} /> Contraste
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        {/* Columna 3: Fuente */}
                                        <td className="px-6 py-4 align-top w-[180px]">
                                            <select
                                                value={groupConfig.fontFamily}
                                                onChange={(e) => handleChange(group.key, 'fontFamily', e.target.value)}
                                                className={`w-full bg-[var(--bg-input)] border border-[var(--border-default)] rounded-lg py-2 px-2.5 ${T.inputText} text-[11px] outline-none focus:border-[var(--brand-primary)]/40 transition-all cursor-pointer hover:bg-[var(--bg-hover)]`}
                                            >
                                                {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                                            </select>
                                        </td>

                                        {/* Columna 4: Color */}
                                        <td className="px-6 py-4 align-top w-[160px]">
                                            <div className={`flex items-center gap-2 bg-[var(--bg-input)] border border-[var(--border-default)] rounded-lg p-1.5 focus-within:border-[var(--brand-primary)]/40 transition-all hover:bg-[var(--bg-hover)]`}>
                                                <input
                                                    type="color"
                                                    value={groupConfig.color}
                                                    onChange={(e) => handleChange(group.key, 'color', e.target.value)}
                                                    className="w-6 h-6 rounded cursor-pointer bg-transparent border-none outline-none shrink-0"
                                                />
                                                <input
                                                    type="text"
                                                    value={groupConfig.color}
                                                    onChange={(e) => {
                                                        const v = e.target.value;
                                                        if (/^#[0-9a-fA-F]{0,6}$/.test(v)) {
                                                            handleChange(group.key, 'color', v);
                                                        }
                                                    }}
                                                    className={`w-[70px] bg-transparent border-none ${T.inputText} text-[10px] font-mono outline-none uppercase`}
                                                    maxLength={7}
                                                    placeholder="#ffffff"
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Banner flotante de cambios pendientes */}
            {hasChanges && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-6 duration-300">
                    <div className="bg-[var(--bg-card)]/95 backdrop-blur-md border border-[var(--brand-primary)]/30 px-6 py-3.5 rounded-[2rem] shadow-2xl flex items-center gap-5">
                        <div className="flex items-center gap-2.5">
                            <div className={`w-2 h-2 rounded-full bg-[var(--brand-primary)] animate-pulse shrink-0 ${T.buttonPrimaryText}`} />
                            <span className={`${T.tableCell} text-xs font-bold`}>Cambios sin guardar</span>
                        </div>
                        <div className="h-5 w-px bg-[var(--border-default)]" />
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className={`bg-[var(--brand-primary)]  px-5 py-1.5 rounded-xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg disabled:opacity-60 ${T.buttonPrimaryText}`}
                        >
                            {saving ? 'Guardando...' : 'Aplicar Ahora'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
