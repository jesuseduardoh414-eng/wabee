import React, { useState, useMemo, useEffect } from 'react';
import client from '@/api/client';
import { useToast } from '@/context/ToastContext';
import { 
    Mail, 
    Save, 
    Send, 
    Search, 
    ChevronRight, 
    Layout, 
    Monitor, 
    AlertTriangle,
    CheckCircle,
    Info,
    Smartphone, 
    Settings,
    ArrowLeft,
    Type,
    Palette,
    Globe,
    Upload,
    Image as ImageIcon,
    X,
    RefreshCcw,
    Facebook,
    Twitter,
    Instagram,
    Linkedin,
    ExternalLink
} from 'lucide-react';
import { T, S } from '@/lib/text-tokens';

interface EmailTemplate {
    id: string;
    name: string;
    code: string;
    category: string;
    status: 'published' | 'draft';
    subject: string;
    title: string;
    body: string;
    cta: string;
    footer: string;
    lastModified: string;
}

interface EmailGlobalConfig {
    identidad: {
        brandName: string;
        senderName: string;
        supportEmail: string;
        globalFooter: string;
        brandLogo: string;
    };
    layout: {
        bg: string;
        card: string;
        border: string;
        subjectLabel: string;
        buttonBg: string;
        buttonText: string;
    };
    texts: {
        title: { label: string; color: string; font: string; preview: string };
        subtitle: { label: string; color: string; font: string; preview: string };
        paragraph: { label: string; color: string; font: string; preview: string };
        button: { label: string; color: string; font: string; preview: string };
        footer: { label: string; color: string; font: string; preview: string };
    };
}

const INITIAL_TEMPLATES: EmailTemplate[] = [];

const FONTS = ['Inter', 'Roboto', 'Outfit', 'Segoe UI', 'sans-serif'];

export const EmailCustomizationPage = () => {
    const { success, error, info } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'branding' | 'templates'>('branding');
    const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
    const [editorTab, setEditorTab] = useState<'content' | 'preview'>('content');
    const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
    const [previewHtml, setPreviewHtml] = useState<string>('');
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [templates, setTemplates] = useState<EmailTemplate[]>(INITIAL_TEMPLATES);

    // Global Config State
    const [globalConfig, setGlobalConfig] = useState({
        identidad: {
            brandName: 'WABEE',
            senderName: 'WABEE Notifications',
            supportEmail: 'soporte@wabee.mx',
            globalFooter: '© {{current_year}} WABEE. Todos los derechos reservados.',
            brandLogo: ''
        },
        layout: {
            bg: '#f8fafc',
            card: '#ffffff',
            border: '#e2e8f0',
            subjectLabel: '#64748b',
            buttonBg: '#2563eb',
            buttonText: '#ffffff'
        },
        texts: {
            title: { label: 'Título', color: '#0f172a', font: 'Inter', preview: 'Título principal del correo' },
            subtitle: { label: 'Subtítulo', color: '#475569', font: 'Inter', preview: 'Subtítulo o línea introductoria' },
            paragraph: { label: 'Párrafo', color: '#1e293b', font: 'Inter', preview: 'Texto descriptivo del contenido del correo' },
            button: { label: 'Botón', color: '#ffffff', font: 'Inter', preview: 'Verificar mi cuenta' },
            footer: { label: 'Footer', color: '#64748b', font: 'Inter', preview: 'Texto del pie del correo' }
        }
    });
    const [initialGlobalConfig, setInitialGlobalConfig] = useState<EmailGlobalConfig | null>(null);
    const [initialTemplates, setInitialTemplates] = useState<EmailTemplate[]>([]);

    // Hydration from Backend
    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await client.get('/super-admin/email-customization');
                if (response.data.success) {
                    const { globalConfig: dbGlobal, templates: dbTemplates } = response.data.data;
                    
                    // 1. Calcular el merge de Global Config fuera del setter para tener la referencia
                    const mergedGlobal = { ...globalConfig, ...dbGlobal };
                    
                    if (dbGlobal.identidad) mergedGlobal.identidad = { ...globalConfig.identidad, ...dbGlobal.identidad };
                    if (dbGlobal.layout) {
                        mergedGlobal.layout = { 
                            ...globalConfig.layout, 
                            ...dbGlobal.layout,
                            buttonText: dbGlobal.layout.buttonText || dbGlobal.texts?.button?.color || globalConfig.layout.buttonText
                        };
                    }
                    if (dbGlobal.texts) {
                        mergedGlobal.texts = { ...globalConfig.texts };
                        Object.keys(dbGlobal.texts).forEach(key => {
                            if ((mergedGlobal.texts as any)[key]) {
                                (mergedGlobal.texts as any)[key] = { 
                                    ...(mergedGlobal.texts as any)[key], 
                                    ...dbGlobal.texts[key] 
                                };
                            }
                        });
                    }

                    // 2. Actualizar estados
                    setGlobalConfig(mergedGlobal);
                    setInitialGlobalConfig(JSON.parse(JSON.stringify(mergedGlobal)));

                    if (dbTemplates && dbTemplates.length > 0) {
                        setTemplates(dbTemplates);
                        setInitialTemplates(JSON.parse(JSON.stringify(dbTemplates)));
                    }
                }
            } catch (err) {
                console.error('Error loading email customization:', err);
                error('No se pudo cargar la configuración de correos.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [error]);

    const filteredTemplates = useMemo(() => {
        return templates.filter(t => 
            t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
            t.code.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [searchQuery, templates]);

    const hasChanges = useMemo(() => {
        if (!initialGlobalConfig) return false;
        
        const globalChanged = JSON.stringify(globalConfig) !== JSON.stringify(initialGlobalConfig);
        const templatesChanged = JSON.stringify(templates) !== JSON.stringify(initialTemplates);
        
        return globalChanged || templatesChanged;
    }, [globalConfig, initialGlobalConfig, templates, initialTemplates]);

    const handleEditTemplate = (template: EmailTemplate) => {
        setSelectedTemplate(template);
        setEditorTab('content');
    };

    const handleBackToList = () => {
        setSelectedTemplate(null);
    };

    const updateConfig = (section: string, field: string, value: any) => {
        setGlobalConfig(prev => ({
            ...prev,
            [section]: {
                ...(prev as any)[section],
                [field]: value
            }
        }));
    };

    const updateTextStyle = (key: string, field: 'color' | 'font', value: string) => {
        setGlobalConfig(prev => ({
            ...prev,
            texts: {
                ...prev.texts,
                [key]: {
                    ...(prev.texts as any)[key],
                    [field]: value
                }
            }
        }));
    };

    const handleUpdateTemplateField = (id: string, field: keyof EmailTemplate, value: string) => {
        setTemplates(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
        if (selectedTemplate?.id === id) {
            setSelectedTemplate(prev => prev ? { ...prev, [field]: value } : null);
        }
    };

    // --- Preview Unificada (Backend Mirror) ---
    const updatePreview = async () => {
        if (!selectedTemplate && activeTab !== 'branding') return;
        
        setIsPreviewLoading(true);
        try {
            // Si estamos editando un template específico, usamos preview-content
            // Si estamos en branding global, usamos la preview del template por defecto (VERIFY_EMAIL)
            const templateToPreview = selectedTemplate || templates.find(t => t.code === 'VERIFY_EMAIL');
            
            if (!templateToPreview) return;

            const response = await client.post('/super-admin/email-customization/preview-content', {
                globalConfig,
                template: templateToPreview
            });

            if (response.data.success) {
                setPreviewHtml(response.data.data.html);
            }
        } catch (error: any) {
            console.error('Error fetching email preview:', error);
            const msg = error.response?.data?.error?.message || 'Error al conectar con el servidor de previsualización';
            setPreviewHtml(`<div style="padding: 20px; color: #ef4444; font-family: sans-serif; border: 1px dashed #ef4444; border-radius: 8px;"><strong>Error de Previsualización:</strong><br/>${msg}</div>`);
        } finally {
            setIsPreviewLoading(false);
        }
    };

    // Actualizar preview cuando cambie la config o el template
    useEffect(() => {
        const timer = setTimeout(() => {
            updatePreview();
        }, 500); // Debounce para no saturar al servidor mientras se escribe
        return () => clearTimeout(timer);
    }, [globalConfig, selectedTemplate, activeTab]);

    const handleSaveGlobal = async () => {
        setIsSaving(true);
        try {
            const response = await client.put('/super-admin/email-customization/global', globalConfig);
            if (response.data.success) {
                setInitialGlobalConfig(JSON.parse(JSON.stringify(globalConfig)));
                success('Configuración global guardada correctamente.');
            }
        } catch (err: any) {
            console.error('Error saving global email config:', err);
            const detail = err.response?.data?.error?.details?.[0]?.message || '';
            error(`Error al guardar: ${err.response?.data?.error?.message || ''} ${detail}`.trim());
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveTemplates = async () => {
        setIsSaving(true);
        try {
            const response = await client.put('/super-admin/email-customization/templates', templates);
            if (response.data.success) {
                setInitialTemplates(JSON.parse(JSON.stringify(templates)));
                success('Plantillas guardadas correctamente.');
            }
        } catch (err: any) {
            console.error('Error saving email templates:', err);
            error(err.response?.data?.error?.message || 'Error al guardar las plantillas.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleResetAll = async () => {
        if (!window.confirm('¿Seguro que quieres restaurar TODOS LOS VALORES de fábrica? Perderás tus personalizaciones actuales.')) return;
        
        setIsSaving(true);
        try {
            const response = await client.post('/super-admin/email-customization/reset');
            if (response.data.success) {
                const { globalConfig: defGlobal, templates: defTemplates } = response.data.data;
                setGlobalConfig(defGlobal);
                setTemplates(defTemplates);
                setSelectedTemplate(null);
                success('Valores de fábrica restaurados con éxito.');
            }
        } catch (err) {
            console.error('Error resetting email customization:', err);
            error('Error al restaurar los valores por defecto.');
        } finally {
            setIsSaving(false);
        }
    };

    const getTemplateVariables = (code: string) => {
        const global = [
            { key: '{{user_name}}', desc: 'Nombre completo del destinatario' },
            { key: '{{org_name}}', desc: 'Nombre de la organización' },
            { key: '{{current_year}}', desc: 'Año actual (ej: 2026)' },
            { key: '{{brand_name}}', desc: 'Nombre de tu marca corporativa' },
        ];

        const specificsMapping: Record<string, { key: string, desc: string }[]> = {
            'VERIFY_EMAIL': [
                { key: '{{link}}', desc: 'Botón: Enlace de verificación (Recomendado)' },
                { key: '{{verification_code}}', desc: 'Código numérico de 6 dígitos' }
            ],
            'PASSWORD_RESET': [{ key: '{{link}}', desc: 'Botón: Enlace para cambiar contraseña' }],
            'SUBSCRIPTION_SUCCESS': [{ key: '{{plan_name}}', desc: 'Nombre del plan adquirido' }],
            'INVOICE_PAID': [
                { key: '{{amount}}', desc: 'Monto total del pago' },
                { key: '{{link}}', desc: 'Botón: Enlace a la factura' }
            ],
            'EXPIRATION_REMINDER': [{ key: '{{renewal_date}}', desc: 'Fecha de vencimiento/renovación' }],
            'PRODUCT_UPDATES': [{ key: '{{release_title}}', desc: 'Título de la nueva versión/novedad' }],
            'ORG_INVITATION': [
                { key: '{{inviter_name}}', desc: 'Nombre de quien envía la invitación' },
                { key: '{{link}}', desc: 'Botón: Enlace para unirse' }
            ],
            'DATA_DELETION_CONFIRMATION': [
                { key: '{{fullName}}', desc: 'Nombre completo del solicitante' },
                { key: '{{requestId}}', desc: 'ID único de la solicitud' },
                { key: '{{requestedAt}}', desc: 'Fecha en que se realizó la petición' }
            ],
            'STORAGE_THRESHOLD': [
                { key: '{{percentage}}', desc: 'Porcentaje de espacio usado' },
                { key: '{{total_gb}}', desc: 'Límite total de almacenamiento' }
            ]
        };

        return {
            global,
            specific: specificsMapping[code] || []
        };
    };

    const VariableBadge = ({ v, type }: { v: { key: string, desc: string }, type: 'global' | 'specific' }) => {
        const [copied, setCopied] = useState(false);
        
        const copy = () => {
            navigator.clipboard.writeText(v.key);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        };

        const badgeColor = type === 'global' ? 'var(--brand-primary)' : '#10b981';

        return (
            <div 
                onClick={copy}
                className="group relative flex flex-col gap-0.5 px-3 py-2 bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl cursor-pointer hover:border-[var(--brand-primary)]/40 hover:bg-[var(--bg-card)] transition-all overflow-hidden"
            >
                <div className="flex items-center gap-2">
                    <code className="text-[12px] font-bold tracking-tight" style={{ color: badgeColor }}>{v.key}</code>
                    <div className="h-1.5 w-1.5 rounded-full opacity-30" style={{ backgroundColor: badgeColor }}></div>
                </div>
                <span className="text-[11px] text-[var(--text-body)] font-medium leading-tight opacity-85 group-hover:opacity-100 transition-opacity pr-2">
                    {v.desc}
                </span>
                {copied && (
                    <div className="absolute inset-0 bg-zinc-900/90 flex items-center justify-center text-[10px] text-white font-bold animate-in fade-in zoom-in duration-200">
                        Copiado!
                    </div>
                )}
            </div>
        );
    };

    const ColorInput = ({ label, value, onChange }: { label: string, value: string, onChange: (val: string) => void }) => (
        <div className="space-y-1.5">
            <label className={`${T.labelText} ${S.meta} font-bold`}>{label}</label>
            <div className="relative group">
                <input 
                    type="text" 
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl pl-4 pr-10 py-2.5 text-[var(--tx-inputText-color)] text-xs font-mono outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)]/30 transition-all"
                />
                <div className="absolute right-2 top-1.5 w-7 h-7 rounded-lg border border-[var(--border-default)] cursor-pointer overflow-hidden shadow-sm hover:border-[var(--brand-primary)] transition-all">
                    <input 
                        type="color" 
                    value={value?.startsWith('#') ? value : '#000000'}
                        onChange={(e) => onChange(e.target.value)}
                        className="absolute inset-x-0 inset-y-0 w-full h-full cursor-pointer opacity-0"
                    />
                    <div className="w-full h-full" style={{ backgroundColor: value }}></div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="max-w-[1200px] mx-auto px-4 pb-4 animate-in fade-in slide-in-from-bottom-4 duration-500 sm:px-0">
            {/* Header */}
            <div className="flex flex-col gap-4 mb-6 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h1 className={`${T.pageTitle} ${S.displayMd} mb-1`}>Personalización de correos</h1>
                    <p className={`${T.pageSubtitle} ${S.body}`}>Administra el branding global y el contenido específico de las plantillas de correo.</p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <button 
                        onClick={handleResetAll}
                        disabled={isSaving}
                        className="flex w-full items-center justify-center gap-2 px-4 py-2 rounded-xl border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 transition-all active:scale-95 group text-red-500 sm:w-auto"
                    >
                        <RefreshCcw size={16} className={isSaving ? 'animate-spin' : ''} />
                        <span className={`${T.buttonText} ${S.ui}`}>Restaurar</span>
                    </button>
                    <button 
                        onClick={activeTab === 'branding' ? handleSaveGlobal : handleSaveTemplates}
                        disabled={isSaving || !hasChanges}
                    className={`flex w-full items-center justify-center gap-2 group px-6 py-2.5 rounded-2xl font-bold text-sm tracking-[0.12em] uppercase transition-all duration-300 shadow-lg sm:w-auto ${
                            !hasChanges 
                                ? 'bg-[var(--bg-input)] text-[var(--text-muted)] border border-[var(--border-default)] cursor-not-allowed' 
                                : 'bg-[var(--brand-primary)] text-[var(--brand-primary-foreground)] hover:scale-[1.02] active:scale-95 shadow-[var(--brand-primary)]/20'
                        }`}
                    >
                        <Save size={16} className={`text-[var(--brand-primary-foreground)] ${isSaving ? 'animate-pulse' : ''}`} />
                        <span className={`${T.buttonPrimaryText} ${S.ui}`}>{isSaving ? 'Guardando...' : 'Guardar Cambios'}</span>
                    </button>
                </div>
            </div>

            <div className="bg-[var(--bg-card)] border border-[var(--border-default)] p-4 sm:p-6 mb-6 rounded-[2rem] overflow-hidden shadow-xl">
                {/* Main Tabs */}
                <div className="flex bg-[var(--bg-input)] p-1 rounded-xl w-full max-w-4xl mx-auto mb-8 border border-[var(--border-default)]">
                    <button 
                        onClick={() => { setActiveTab('branding'); setSelectedTemplate(null); }}
                        className={`flex-1 py-2 rounded-lg text-base font-bold transition-all ${activeTab === 'branding' ? 'bg-[var(--bg-card)] text-[var(--brand-primary)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-body)]'}`}
                    >
                        Global
                    </button>
                    <button 
                        onClick={() => { setActiveTab('templates'); setSelectedTemplate(null); }}
                        className={`flex-1 py-2 rounded-lg text-base font-bold transition-all ${activeTab === 'templates' ? 'bg-[var(--bg-card)] text-[var(--brand-primary)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-body)]'}`}
                    >
                        Plantillas
                    </button>
                </div>

                {activeTab === 'branding' && !selectedTemplate && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-500">
                        {/* Summary Header */}
                        <div className="flex items-center justify-between px-2">
                            <div>
                                <h3 className={`${T.sectionTitle} ${S.headingLg} mb-1`}>Aplicación masiva</h3>
                                <p className={`${T.sectionSubtitle} ${S.body}`}>Define la identidad compartida de todos los correos desde un solo lugar.</p>
                            </div>
                            <span className={`${T.badgeText} text-[11px] px-3 py-1 rounded-full bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] border border-[var(--brand-primary)]/20 shadow-sm`}>Global</span>
                        </div>

                        {/* Identidad General Section */}
                        <div className="border border-[var(--border-default)] rounded-3xl p-5 sm:p-8 bg-[var(--bg-surface)] backdrop-blur-sm">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="p-2.5 rounded-xl bg-[var(--brand-primary)] text-[var(--brand-primary-foreground)] shadow-lg shadow-[var(--brand-primary)]/20">
                                    <Globe size={20} />
                                </div>
                                <h4 className={`${T.sectionTitle} ${S.headingSm}`}>Identidad general</h4>
                            </div>

                            <div className="space-y-6">
                                <div className="grid gap-6 md:grid-cols-2">
                                    <div className="space-y-6">
                                        <div>
                                            <label className={`${T.labelText} ${S.ui} font-bold mb-1.5 block`}>Logo de la empresa</label>
                                            <div 
                                                className="group relative h-32 border-2 border-dashed border-[var(--border-default)] rounded-2xl flex flex-col items-center justify-center gap-2 bg-[var(--bg-card)] hover:border-[var(--brand-primary)]/50 transition-all cursor-pointer overflow-hidden"
                                                onClick={() => document.getElementById('logo-upload')?.click()}
                                            >
                                                {globalConfig.identidad.brandLogo ? (
                                                    <>
                                                        <img src={globalConfig.identidad.brandLogo} alt="Preview" className="h-full w-full object-contain p-2" />
                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                            <button 
                                                                className="p-2 bg-white/20 rounded-lg hover:bg-white/40 transition-colors"
                                                                onClick={(e) => { e.stopPropagation(); document.getElementById('logo-upload')?.click(); }}
                                                            >
                                                                <RefreshCcw size={16} className="text-white" />
                                                            </button>
                                                            <button 
                                                                className="p-2 bg-red-500/80 rounded-lg hover:bg-red-600 transition-colors"
                                                                onClick={(e) => { e.stopPropagation(); updateConfig('identidad', 'brandLogo', null); }}
                                                            >
                                                                <X size={16} className="text-white" />
                                                            </button>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="p-3 rounded-full bg-[var(--bg-surface)] text-[var(--text-muted)] group-hover:text-[var(--brand-primary)] transition-colors">
                                                            <Upload size={20} />
                                                        </div>
                                                        <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Subir PNG/SVG</span>
                                                    </>
                                                )}
                                                <input 
                                                    id="logo-upload"
                                                    type="file" 
                                                    className="hidden" 
                                                    accept="image/*"
                                                onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        try {
                                                            const formData = new FormData();
                                                            formData.append('file', file);
                                                            const response = await client.post('/super-admin/branding/global/logo', formData, {
                                                                headers: { 'Content-Type': 'multipart/form-data' }
                                                            });
                                                            if (response.data.success) {
                                                                updateConfig('identidad', 'brandLogo', response.data.data.logoUrl);
                                                                success('Logo subido correctamente.');
                                                            }
                                                        } catch (err) {
                                                            console.error('Error uploading logo:', err);
                                                            error('Error al subir el logo. Intenta con un archivo más pequeño o de otro formato.');
                                                        }
                                                    }
                                                }}
                                            />
                                            <p className={`${T.helperText} text-[11px] mt-2 italic px-1`}>Recomendado: Fondo transparente, 200x50px.</p>
                                        </div>
                                    </div>
                                    <div>
                                            <label className={`${T.labelText} ${S.ui} font-bold mb-1.5 block`}>Nombre de marca</label>
                                            <input 
                                                type="text" 
                                                value={globalConfig.identidad.brandName}
                                                onChange={(e) => updateConfig('identidad', 'brandName', e.target.value)}
                                                className="w-full bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl px-4 py-2.5 text-[var(--tx-inputText-color)] text-sm outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)]/30 transition-all font-bold"
                                                placeholder="Ej. WABEE"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-6">
                                        <div>
                                            <label className={`${T.labelText} ${S.ui} font-bold mb-1.5 block`}>Nombre del remitente</label>
                                            <input 
                                                type="text" 
                                                value={globalConfig.identidad.senderName}
                                                onChange={(e) => updateConfig('identidad', 'senderName', e.target.value)}
                                                className="w-full bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl px-4 py-2.5 text-[var(--tx-inputText-color)] text-sm outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)]/30 transition-all"
                                                placeholder="Ej. WABEE Notifications"
                                            />
                                        </div>
                                        <div>
                                            <label className={`${T.labelText} ${S.ui} font-bold mb-1.5 block`}>Email de soporte</label>
                                            <input 
                                                type="email" 
                                                value={globalConfig.identidad.supportEmail}
                                                onChange={(e) => updateConfig('identidad', 'supportEmail', e.target.value)}
                                                className="w-full bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl px-4 py-2.5 text-[var(--tx-inputText-color)] text-sm outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)]/30 transition-all"
                                                placeholder="Ej. soporte@wabee.mx"
                                            />
                                        </div>
                                        <div>
                                            <label className={`${T.labelText} ${S.ui} font-bold mb-1.5 block`}>Footer global</label>
                                            <textarea 
                                                rows={2}
                                                value={globalConfig.identidad.globalFooter}
                                                onChange={(e) => updateConfig('identidad', 'globalFooter', e.target.value)}
                                                className="w-full bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl px-4 py-2.5 text-[var(--tx-inputText-color)] text-sm outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)]/30 transition-all resize-none"
                                                placeholder="Copyright info..."
                                            ></textarea>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Layout Global Section */}
                        <div className="border border-[var(--border-default)] rounded-3xl p-5 sm:p-8 bg-[var(--bg-surface)] backdrop-blur-sm">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="p-2.5 rounded-xl bg-[var(--brand-primary)] text-[var(--brand-primary-foreground)] shadow-lg shadow-[var(--brand-primary)]/20">
                                    <Palette size={20} />
                                </div>
                                <h4 className={`${T.sectionTitle} ${S.headingSm}`}>Layout global</h4>
                            </div>

                            <div className="grid gap-x-8 gap-y-6 md:grid-cols-2">
                                <ColorInput label="Fondo" value={globalConfig.layout.bg} onChange={(v) => updateConfig('layout', 'bg', v)} />
                                <ColorInput label="Tarjeta" value={globalConfig.layout.card} onChange={(v) => updateConfig('layout', 'card', v)} />
                                <ColorInput label="Borde" value={globalConfig.layout.border} onChange={(v) => updateConfig('layout', 'border', v)} />
                                <ColorInput label="Etiqueta asunto" value={globalConfig.layout.subjectLabel} onChange={(v) => updateConfig('layout', 'subjectLabel', v)} />
                                <ColorInput label="Fondo botón" value={globalConfig.layout.buttonBg} onChange={(v) => updateConfig('layout', 'buttonBg', v)} />
                                <ColorInput label="Texto botón" value={globalConfig.layout.buttonText} onChange={(v) => updateConfig('layout', 'buttonText', v)} />
                            </div>
                        </div>

                        {/* Tipos de texto globales Section */}
                        <div className="border border-[var(--border-default)] rounded-3xl p-5 sm:p-8 bg-[var(--bg-surface)] backdrop-blur-sm">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="p-2.5 rounded-xl bg-[var(--brand-primary)] text-[var(--brand-primary-foreground)] shadow-lg shadow-[var(--brand-primary)]/20">
                                    <Type size={20} />
                                </div>
                                <h4 className={`${T.sectionTitle} ${S.headingSm}`}>Tipos de texto globales</h4>
                            </div>

                            <div className="hidden overflow-x-auto md:block">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-[var(--border-default)]">
                                            <th className={`${T.labelText} ${S.ui} py-4 px-2 font-bold uppercase tracking-widest`}>Tipo</th>
                                            <th className={`${T.labelText} ${S.ui} py-4 px-2 font-bold uppercase tracking-widest`}>Color</th>
                                            <th className={`${T.labelText} ${S.ui} py-4 px-2 font-bold uppercase tracking-widest`}>Fuente</th>
                                            <th className={`${T.labelText} ${S.ui} py-4 px-2 font-bold uppercase tracking-widest`}>Preview</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--border-default)]/50">
                                        {Object.entries(globalConfig.texts).map(([key, style]) => (
                                            <tr key={key} className="group hover:bg-[var(--bg-card)]/30 transition-all">
                                                <td className="py-5 px-2">
                                                    <span className={`${T.cardTitle} text-xs font-bold`}>{style.label}</span>
                                                </td>
                                                <td className="py-5 px-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className="relative">
                                                            <input 
                                                                type="color" 
                                                                value={style.color}
                                                                onChange={(e) => updateTextStyle(key, 'color', e.target.value)}
                                                                className="w-10 h-6 cursor-pointer rounded opacity-0 absolute inset-0" 
                                                            />
                                                            <div 
                                                                className="w-10 h-3.5 rounded-sm border border-[var(--border-default)]"
                                                                style={{ backgroundColor: style.color }}
                                                            ></div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-5 px-2">
                                                    <select 
                                                        value={style.font}
                                                        onChange={(e) => updateTextStyle(key, 'font', e.target.value)}
                                                        className="bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl px-4 py-2 text-xs text-[var(--tx-inputText-color)] font-bold outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)]/30 transition-all cursor-pointer hover:bg-[var(--bg-card)]"
                                                    >
                                                        {FONTS.map(f => <option key={f} value={f} className="bg-[var(--bg-card)] text-[var(--tx-inputText-color)]">{f}</option>)}
                                                    </select>
                                                </td>
                                                <td className="py-5 px-2">
                                                    {key === 'button' ? (
                                                        <button 
                                                            className="px-6 py-2 rounded-xl text-xs font-bold transition-all"
                                                            style={{ 
                                                                backgroundColor: globalConfig.layout.buttonBg,
                                                                color: style.color,
                                                                fontFamily: style.font
                                                            }}
                                                        >
                                                            {style.preview}
                                                        </button>
                                                    ) : (
                                                        <span 
                                                            className="text-xs font-bold"
                                                            style={{ 
                                                                color: style.color,
                                                                fontFamily: style.font,
                                                                fontSize: key === 'title' ? '1.25rem' : key === 'subtitle' ? '1rem' : '0.875rem'
                                                            }}
                                                        >
                                                            {style.preview}
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="space-y-4 md:hidden">
                                {Object.entries(globalConfig.texts).map(([key, style]) => (
                                    <div key={key} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 shadow-sm">
                                        <div className="mb-4 flex items-center justify-between gap-3">
                                            <span className={`${T.cardTitle} text-sm font-bold`}>{style.label}</span>
                                            <div className="relative">
                                                <input
                                                    type="color"
                                                    value={style.color}
                                                    onChange={(e) => updateTextStyle(key, 'color', e.target.value)}
                                                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                                                />
                                                <div
                                                    className="h-6 w-10 rounded-md border border-[var(--border-default)]"
                                                    style={{ backgroundColor: style.color }}
                                                ></div>
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            <select
                                                value={style.font}
                                                onChange={(e) => updateTextStyle(key, 'font', e.target.value)}
                                                className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-4 py-2 text-sm font-bold text-[var(--tx-inputText-color)] outline-none transition-all focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)]/30"
                                            >
                                                {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
                                            </select>
                                            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3">
                                                {key === 'button' ? (
                                                    <button
                                                        className="rounded-xl px-5 py-2 text-xs font-bold transition-all"
                                                        style={{
                                                            backgroundColor: globalConfig.layout.buttonBg,
                                                            color: style.color,
                                                            fontFamily: style.font
                                                        }}
                                                    >
                                                        {style.preview}
                                                    </button>
                                                ) : (
                                                    <span
                                                        className="font-bold"
                                                        style={{
                                                            color: style.color,
                                                            fontFamily: style.font,
                                                            fontSize: key === 'title' ? '1.1rem' : key === 'subtitle' ? '0.95rem' : '0.875rem'
                                                        }}
                                                    >
                                                        {style.preview}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* LIVE PREVIEW DE VERIFICACIÓN (Petición del Usuario) */}
                        <div className="border border-[var(--border-default)] rounded-3xl p-5 sm:p-8 bg-[var(--bg-surface)] backdrop-blur-sm">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 rounded-xl bg-[var(--brand-primary)] text-[var(--brand-primary-foreground)] shadow-lg shadow-[var(--brand-primary)]/20">
                                        <Monitor size={20} />
                                    </div>
                                    <div>
                                        <h4 className={`${T.sectionTitle} ${S.headingSm}`}>Previsualización rápida</h4>
                                        <p className={`${T.helperText} ${S.meta}`}>Correo de verificación con marca global aplicada.</p>
                                    </div>
                                </div>
                                <div className="flex bg-[var(--bg-input)] p-1 rounded-xl border border-[var(--border-default)]">
                                    <button 
                                        onClick={() => setPreviewMode('desktop')}
                                        className={`p-1.5 rounded-lg transition-all ${previewMode === 'desktop' ? 'bg-[var(--bg-card)] text-[var(--brand-primary)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-body)]'}`}
                                    >
                                        <Monitor size={16} />
                                    </button>
                                    <button 
                                        onClick={() => setPreviewMode('mobile')}
                                        className={`p-1.5 rounded-lg transition-all ${previewMode === 'mobile' ? 'bg-[var(--bg-card)] text-[var(--brand-primary)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-body)]'}`}
                                    >
                                        <Smartphone size={16} />
                                    </button>
                                </div>
                            </div>

                            <div 
                                className={`mx-auto border shadow-sm overflow-hidden transition-all duration-500 bg-[var(--bg-card)] ${previewMode === 'desktop' ? 'w-full max-w-full' : 'w-full max-w-[320px] sm:max-w-[360px]'}`}
                                style={{ 
                                    backgroundColor: globalConfig.layout.bg,
                                    borderColor: globalConfig.layout.border,
                                    borderRadius: '12px'
                                }}
                            >
                                <div className="p-6 bg-gray-50/50 border-b flex items-center gap-4">
                                    <div className="h-3 w-3 rounded-full bg-red-400"></div>
                                    <div className="h-3 w-3 rounded-full bg-yellow-400"></div>
                                    <div className="h-3 w-3 rounded-full bg-green-400"></div>
                                </div>
                                
                                <div className={`relative transition-all duration-500 overflow-hidden ${previewMode === 'desktop' ? 'h-[750px]' : 'h-[560px] sm:h-[650px]'}`}>
                                    {isPreviewLoading && (
                                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 backdrop-blur-[2px]">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-8 h-8 border-4 border-[var(--brand-primary)] border-t-transparent rounded-full animate-spin"></div>
                                                <p className="text-xs font-medium text-[var(--text-muted)]">Sincronizando diseño...</p>
                                            </div>
                                        </div>
                                    )}
                                    <iframe 
                                        srcDoc={previewHtml}
                                        title="Email Preview"
                                        className="w-full h-full border-none"
                                        style={{ 
                                            display: 'block',
                                            transform: previewMode === 'mobile' ? 'scale(1)' : 'none',
                                            transformOrigin: 'top center'
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'templates' && !selectedTemplate && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
                        <div className="flex items-center gap-3 mb-4">
                            <Mail size={20} className="text-[var(--brand-primary)]" />
                            <div>
                                <h3 className={`${T.sectionTitle} ${S.headingSm}`}>Plantillas</h3>
                                <p className={`${T.sectionSubtitle} ${S.body}`}>Selecciona una para editar su contenido.</p>
                            </div>
                        </div>

                        <div className="relative mb-6">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={16} />
                            <input 
                                type="text" 
                                placeholder="Buscar plantilla..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl pl-10 pr-4 py-2.5 text-[var(--tx-inputText-color)] text-sm outline-none focus:border-[var(--brand-primary)]/50 transition-all"
                            />
                        </div>

                        <div className="grid gap-3">
                            {filteredTemplates.map((template) => (
                                <div 
                                    key={template.id}
                                    onClick={() => handleEditTemplate(template)}
                                    className={`group relative p-4 rounded-2xl border transition-all cursor-pointer ${template.status === 'published' ? 'bg-[var(--bg-card)] border-[var(--border-default)] hover:border-[var(--brand-primary)]/50' : 'bg-[var(--bg-input)]/50 border-dashed border-[var(--border-default)] hover:border-[var(--text-muted)]'}`}
                                >
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="flex items-start gap-3 min-w-0 sm:items-center">
                                            <div className={`p-2 rounded-xl transition-colors ${template.status === 'published' ? 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]' : 'bg-[var(--text-muted)]/10 text-[var(--text-muted)]'}`}>
                                                <Mail size={18} />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2 mb-0.5">
                                                    <h4 className={`${T.cardTitle} ${S.headingSm} min-w-0 break-words`}>{template.name}</h4>
                                                    <span className={`${T.badgeText} text-[10px] px-2 py-0.5 rounded-full ${template.status === 'published' ? 'bg-green-500/10 text-green-500' : 'bg-orange-500/10 text-orange-500'}`}>
                                                        {template.status === 'published' ? 'Publicado' : 'Borrador'}
                                                    </span>
                                                </div>
                                                <p className={`${T.helperText} ${S.meta} truncate`}>{template.code} • {template.category}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between gap-3 sm:shrink-0">
                                            <span className={`${T.helperText} ${S.meta} group-hover:opacity-70 transition-opacity`}>{template.lastModified}</span>
                                            <ChevronRight size={16} className="text-[var(--text-muted)] group-hover:translate-x-1 transition-transform" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {selectedTemplate && (
                    <div className="animate-in fade-in zoom-in-95 duration-500">
                        {/* Editor Header */}
                        <div className="flex flex-col gap-4 mb-6 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex items-start gap-4">
                                <button 
                                    onClick={handleBackToList}
                                    className="p-2 rounded-xl border border-[var(--border-default)] hover:bg-[var(--bg-input)] transition-all"
                                >
                                    <ArrowLeft size={18} />
                                </button>
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                        <h3 className={`${T.sectionTitle} ${S.headingLg}`}>{selectedTemplate.name}</h3>
                                        <span className={`${T.statusText} text-[9px] px-2 py-0.5 rounded-full bg-[var(--bg-input)] text-[var(--text-muted)] border border-[var(--border-default)]`}>
                                            {selectedTemplate.code}
                                        </span>
                                        <span className={`${T.badgeText} text-[10px] px-2 py-0.5 rounded-full ${selectedTemplate.status === 'published' ? 'bg-green-500/10 text-green-500' : 'bg-orange-500/10 text-orange-500'}`}>
                                            {selectedTemplate.status === 'published' ? 'Publicado' : 'Borrador'}
                                        </span>
                                    </div>
                                    <p className={`${T.sectionSubtitle} ${S.body}`}>Edita el contenido del correo y visualiza cómo quedará con el tema global.</p>
                                </div>
                            </div>
                        </div>

                        {/* Sub Tabs: Content / Preview */}
                        <div className="flex bg-[var(--bg-input)] p-1 rounded-xl w-full max-w-2xl mb-8 border border-[var(--border-default)]">
                            <button 
                                onClick={() => setEditorTab('content')}
                                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${editorTab === 'content' ? 'bg-[var(--bg-card)] text-[var(--brand-primary)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-body)]'}`}
                            >
                                Contenido
                            </button>
                            <button 
                                onClick={() => setEditorTab('preview')}
                                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${editorTab === 'preview' ? 'bg-[var(--bg-card)] text-[var(--brand-primary)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-body)]'}`}
                            >
                                Preview
                            </button>
                        </div>

                        {editorTab === 'content' ? (
                            <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
                                {/* Variables Guide */}
                                <div className="p-6 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-default)] shadow-sm">
                                    <div className="flex items-center gap-2 mb-6">
                                        <div className="w-1.5 h-4 bg-[var(--brand-primary)] rounded-full"></div>
                                        <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-body)]">Guía de Variables Dinámicas</span>
                                    </div>
                                    
                                    <div className="space-y-6">
                                        {/* Global Variables */}
                                        <div className="space-y-3">
                                            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block ml-1">Variables Globales</span>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                {getTemplateVariables(selectedTemplate.code).global.map((v) => (
                                                    <VariableBadge key={v.key} v={v} type="global" />
                                                ))}
                                            </div>
                                        </div>

                                        {/* Specific Variables */}
                                        {getTemplateVariables(selectedTemplate.code).specific.length > 0 && (
                                            <div className="space-y-3">
                                                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block ml-1">Variables desta Plantilla</span>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                    {getTemplateVariables(selectedTemplate.code).specific.map((v) => (
                                                        <VariableBadge key={v.key} v={v} type="specific" />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="grid gap-6">
                                    <div>
                                        <label className={`${T.labelText} ${S.ui} font-bold block mb-1.5`}>Asunto del correo</label>
                                        <input 
                                            type="text" 
                                            value={selectedTemplate.subject}
                                            onChange={(e) => handleUpdateTemplateField(selectedTemplate.id, 'subject', e.target.value)}
                                            className="w-full bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl px-4 py-2.5 text-[var(--tx-inputText-color)] text-sm outline-none focus:border-[var(--brand-primary)]/50 transition-all font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className={`${T.labelText} ${S.ui} font-bold block mb-1.5`}>Título principal</label>
                                        <input 
                                            type="text" 
                                            value={selectedTemplate.title}
                                            onChange={(e) => handleUpdateTemplateField(selectedTemplate.id, 'title', e.target.value)}
                                            className="w-full bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl px-4 py-2.5 text-[var(--tx-inputText-color)] text-sm outline-none focus:border-[var(--brand-primary)]/50 transition-all font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className={`${T.labelText} ${S.ui} font-bold block mb-1.5`}>Mensaje principal</label>
                                        <textarea 
                                            rows={5}
                                            value={selectedTemplate.body}
                                            onChange={(e) => handleUpdateTemplateField(selectedTemplate.id, 'body', e.target.value)}
                                            className="w-full bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl px-4 py-2.5 text-[var(--tx-inputText-color)] text-sm outline-none focus:border-[var(--brand-primary)]/50 transition-all resize-none"
                                        ></textarea>
                                    </div>
                                    <div className="grid gap-6 md:grid-cols-2">
                                        <div>
                                            <label className={`${T.labelText} ${S.ui} font-bold block mb-1.5`}>Texto del botón</label>
                                            <input 
                                                type="text" 
                                                value={selectedTemplate.cta}
                                                onChange={(e) => handleUpdateTemplateField(selectedTemplate.id, 'cta', e.target.value)}
                                                className="w-full bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl px-4 py-2.5 text-[var(--tx-inputText-color)] text-sm outline-none focus:border-[var(--brand-primary)]/50 transition-all"
                                            />
                                        </div>
                                        <div>
                                            <label className={`${T.labelText} ${S.ui} font-bold block mb-1.5`}>Texto auxiliar / footer específico</label>
                                            <input 
                                                type="text" 
                                                value={selectedTemplate.footer}
                                                onChange={(e) => handleUpdateTemplateField(selectedTemplate.id, 'footer', e.target.value)}
                                                className="w-full bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl px-4 py-2.5 text-[var(--tx-inputText-color)] text-sm outline-none focus:border-[var(--brand-primary)]/50 transition-all"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                                <div className="flex flex-col gap-4 mb-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex flex-col">
                                        <h4 className={`${T.cardTitle} ${S.headingSm} mb-0.5`}>Vista previa</h4>
                                        <p className={`${T.helperText} ${S.meta}`}>Basado en la configuración global de layout y textos.</p>
                                    </div>
                                    <div className="flex bg-[var(--bg-input)] p-1 rounded-xl border border-[var(--border-default)]">
                                        <button 
                                            onClick={() => setPreviewMode('desktop')}
                                            className={`p-1.5 rounded-lg transition-all ${previewMode === 'desktop' ? 'bg-[var(--bg-card)] text-[var(--brand-primary)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-body)]'}`}
                                        >
                                            <Monitor size={16} />
                                        </button>
                                        <button 
                                            onClick={() => setPreviewMode('mobile')}
                                            className={`p-1.5 rounded-lg transition-all ${previewMode === 'mobile' ? 'bg-[var(--bg-card)] text-[var(--brand-primary)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-body)]'}`}
                                        >
                                            <Smartphone size={16} />
                                        </button>
                                    </div>
                                </div>

                                {/* Email Preview Frame */}
                                <div 
                                    className={`mx-auto rounded-3xl border shadow-2xl overflow-hidden transition-all duration-500 ${previewMode === 'desktop' ? 'w-full max-w-4xl min-h-[600px]' : 'w-full max-w-[320px] min-h-[560px] sm:max-w-[360px] sm:min-h-[600px]'}`}
                                    style={{ 
                                        backgroundColor: globalConfig.layout.bg,
                                        borderColor: globalConfig.layout.border
                                    }}
                                >
                                    <div className="p-6 bg-gray-50/50 border-b flex items-center gap-4">
                                        <div className="h-3 w-3 rounded-full bg-red-400"></div>
                                        <div className="h-3 w-3 rounded-full bg-yellow-400"></div>
                                        <div className="h-3 w-3 rounded-full bg-green-400"></div>
                                    </div>
                                    
                                    <div className="p-4 md:p-8 lg:p-12">
                                        {/* Premium Email Client Shell */}
                                        <div className="mb-8 bg-[var(--bg-card)] border border-[var(--border-default)] rounded-2xl shadow-xl overflow-hidden">
                                            {/* Browser/Client Header */}
                                            <div className="px-4 py-3 bg-[var(--bg-input)]/50 border-b border-[var(--border-default)] flex items-center gap-3">
                                                <div className="flex gap-1.5">
                                                    <div className="w-2.5 h-2.5 rounded-full bg-red-400/20"></div>
                                                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/20"></div>
                                                    <div className="w-2.5 h-2.5 rounded-full bg-green-400/20"></div>
                                                </div>
                                                <div className="flex-1 px-4 py-1.5 bg-[var(--bg-card)] rounded-lg border border-[var(--border-default)] text-[10px] text-[var(--text-muted)] font-mono flex items-center gap-2">
                                                    <Globe size={10} />
                                                    <span>wabee-mail-client.app/view/msg_{selectedTemplate.code.toLowerCase()}</span>
                                                </div>
                                            </div>

                                            {/* Subject & Sender Info */}
                                            <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-[0.2em] text-[var(--brand-primary)]">
                                                        <Mail size={10} />
                                                        <span>Bandeja de Entrada</span>
                                                    </div>
                                                    <h3 className="text-xl font-bold text-[var(--tx-inputText-color)] tracking-tight">
                                                        {selectedTemplate.subject.replace('{{org_name}}', globalConfig.identidad.brandName).replace('{{release_title}}', 'WABEE V7.0')}
                                                    </h3>
                                                    <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                                                        <span className="font-bold text-[var(--text-body)]">{globalConfig.identidad.senderName}</span>
                                                        <span>&lt;{globalConfig.identidad.supportEmail}&gt;</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="px-3 py-1.5 rounded-full bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] text-[9px] font-bold uppercase tracking-widest border border-[var(--brand-primary)]/20">
                                                        {selectedTemplate.category}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Main Email Body Rendering */}
                                        <div 
                                            className="max-w-[440px] mx-auto rounded-[1.5rem] p-4 md:p-8 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.15)] border bg-white transition-all duration-700"
                                            style={{ 
                                                backgroundColor: globalConfig.layout.card,
                                                borderColor: globalConfig.layout.border
                                            }}
                                        >
                                            {/* Elegant Brand Header */}
                                            <div className="flex flex-col items-center text-center mb-6">
                                                {globalConfig.identidad.brandLogo ? (
                                                    <img 
                                                        src={globalConfig.identidad.brandLogo} 
                                                        alt="Brand Logo" 
                                                        className="h-12 w-auto object-contain mb-6 drop-shadow-sm" 
                                                    />
                                                ) : (
                                                    <div 
                                                        className="w-16 h-16 rounded-3xl flex items-center justify-center text-white font-bold text-2xl shadow-xl mb-6 rotate-3"
                                                        style={{ backgroundColor: globalConfig.layout.buttonBg }}
                                                    >{globalConfig.identidad.brandName.charAt(0)}</div>
                                                )}
                                                <div className="h-1 w-12 rounded-full opacity-20 mb-4" style={{ backgroundColor: globalConfig.layout.buttonBg }}></div>
                                            </div>

                                            {/* Structured Content Area */}
                                            <div className="space-y-4 text-center md:text-left">
                                                <h2 
                                                    className="text-lg md:text-2xl font-bold leading-[1.1] tracking-[-0.03em]"
                                                    style={{ color: globalConfig.texts.title.color, fontFamily: globalConfig.texts.title.font }}
                                                >
                                                    {selectedTemplate.title
                                                        .replace('{{user_name}}', 'Juan Pérez')
                                                        .replace('{{org_name}}', globalConfig.identidad.brandName)}
                                                </h2>
                                                
                                                <div 
                                                    className="text-xs md:text-sm leading-[1.5] opacity-90 whitespace-pre-line"
                                                    style={{ color: globalConfig.texts.paragraph.color, fontFamily: globalConfig.texts.paragraph.font }}
                                                >
                                                    {selectedTemplate.body
                                                        .replace(/{{org_name}}/g, globalConfig.identidad.brandName)
                                                        .replace(/{{user_name}}/g, 'Juan Pérez')
                                                        .replace(/{{inviter_name}}/g, 'Raúl Crescencio')
                                                        .replace(/{{plan_name}}/g, 'Plan Pro')
                                                        .replace(/{{percentage}}/g, '85')
                                                        .replace(/{{total_gb}}/g, '20')
                                                        .replace(/{{renewal_date}}/g, '15 de Abril')
                                                        .replace(/{{release_title}}/g, 'WABEE V7.0')
                                                        .replace(/{{location}}/g, 'Ciudad de México, MX')
                                                        .replace(/{{ip_address}}/g, '192.168.1.1')}
                                                </div>
                                                
                                                <div className="pt-4 pb-2 flex justify-center md:justify-start">
                                                    <button 
                                                        className="group relative px-6 py-3 font-bold text-xs md:text-sm rounded-xl shadow-xl transition-all duration-300 hover:scale-[1.03] active:scale-[0.98]"
                                                        style={{ 
                                                            backgroundColor: globalConfig.layout.buttonBg,
                                                            color: globalConfig.texts.button.color,
                                                            fontFamily: globalConfig.texts.button.font
                                                        }}
                                                    >
                                                        <span className="relative z-10">{selectedTemplate.cta}</span>
                                                        <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-20 transition-opacity bg-white"></div>
                                                    </button>
                                                </div>

                                                {/* Premium Footer Section */}
                                                <div className="pt-16 mt-16 border-t" style={{ borderColor: globalConfig.layout.border }}>
                                                    <div className="space-y-8">
                                                        <p 
                                                            className="text-sm leading-relaxed max-w-sm"
                                                            style={{ color: globalConfig.texts.footer.color, fontFamily: globalConfig.texts.footer.font, opacity: 0.7 }}
                                                        >
                                                            {selectedTemplate.footer
                                                                .replace('{{org_name}}', globalConfig.identidad.brandName)
                                                                .replace('{{total_gb}}', '20')
                                                                .replace('{{renewal_date}}', '15 de Abril')}
                                                        </p>

                                                        <div className="pt-10 flex flex-col items-center justify-center gap-8">
                                                            <div className="space-y-3 text-center">
                                                                <div 
                                                                    className="font-bold text-2xl tracking-tighter"
                                                                    style={{ color: globalConfig.texts.title.color }}
                                                                >{globalConfig.identidad.brandName}</div>
                                                                <p className="text-[10px] opacity-40 uppercase font-bold tracking-widest leading-loose">
                                                                    {globalConfig.identidad.globalFooter.replace('{{current_year}}', '2026')}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
