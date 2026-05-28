import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Monitor, Smartphone } from 'lucide-react';
import { webWidgetApi } from '@/api/wabee/webwidget.api';
import {
    XMarkIcon,
    ArrowPathIcon,
    ChatBubbleLeftRightIcon,
    CodeBracketIcon,
    PaintBrushIcon,
    SparklesIcon,
    GlobeAltIcon,
    CloudArrowUpIcon,
    ChatBubbleBottomCenterTextIcon,
    SwatchIcon,
    CommandLineIcon
} from '@heroicons/react/24/outline';
import { T, S } from '@/lib/text-tokens';
import WidgetContentPanel from './builder-panels/WidgetContentPanel';
import WidgetDesignPanel from './builder-panels/WidgetDesignPanel';
import WidgetAiTrainingPanel from './builder-panels/WidgetAiTrainingPanel';
import WidgetInstallationPanel from './builder-panels/WidgetInstallationPanel';
import WidgetPreviewFrame from '@/components/wabee/WidgetPreviewFrame';
import { normalizeDomains, deepEqual } from './builder-panels/builder.utils';
import { useToast } from '@/context/ToastContext';

const tabs = [
    { id: 'content', name: 'Contenido', icon: ChatBubbleLeftRightIcon },
    { id: 'design', name: 'Diseño', icon: PaintBrushIcon },
    { id: 'ai', name: 'Entrenamiento IA', icon: SparklesIcon },
    { id: 'install', name: 'Instalación', icon: CodeBracketIcon },
];

const DEFAULT_CONFIG = {
    title: '¡Bienvenido!',
    subtitle: '¿En qué podemos ayudarte?',
    brandName: 'Mi Marca',
    welcomeMessage: '¡Hola! ¿Cómo podemos ayudarte hoy?',
    domainAllowed: '',
    offlineMessage: 'Actualmente estamos fuera de línea. Por favor deja un mensaje.',
    theme: {
        primaryColor: '#16a34a',
        radius: 16,
        position: 'bottom-right',
        headerStyle: 'solid',
        bubbleStyle: 'modern'
    },
    features: {
        aiEnabled: false,
        leadCaptureEnabled: false,
        attachmentsEnabled: false,
        poweredBy: false
    },
    aiProfileId: '',
    confidenceThreshold: 70,
    fallbackMessage: 'Lo siento, no entiendo. Te conecto con un humano...',
    takeoverEnabled: true,
    contactWhatsApp: '',
    contactPhone: '',
    contactEmail: '',
    contactWebsite: ''
};

const WebWidgetBuilderPage: React.FC = () => {
    const navigate = useNavigate();
    // No params needed for single-widget view
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('content');
    const [saving, setSaving] = useState(false);

    // Config State
    const [widgetId, setWidgetId] = useState<string>('');
    const [savedConfig, setSavedConfig] = useState<any>(DEFAULT_CONFIG);
    const [draftConfig, setDraftConfig] = useState<any>(DEFAULT_CONFIG);
    const [initError, setInitError] = useState<string | null>(null);

    const isDirty = useMemo(() => !deepEqual(draftConfig, savedConfig), [draftConfig, savedConfig]);

    const { error: toastError, success: toastSuccess } = useToast();

    console.log("WebWidgetBuilderPage rendering. Loading:", loading, "InitError:", initError);

    useEffect(() => {
        initWidget();
    }, []);

    const initWidget = async () => {
        try {
            setLoading(true);
            setInitError(null);

            // 1. Try to find existing widget
            let existing = await webWidgetApi.findUnique();

            // 2. If not found, create one automatically
            if (!existing) {
                try {
                    existing = await webWidgetApi.createWidget({
                        title: DEFAULT_CONFIG.title,
                        subtitle: DEFAULT_CONFIG.subtitle,
                    });
                } catch (createErr: any) {
                    // 409 = widget already exists (race condition or stale GET cache)
                    // Retry findUnique to load the existing widget
                    if (createErr?.status === 409) {
                        console.warn('[initWidget] 409 on create — fetching existing widget');
                        existing = await webWidgetApi.findUnique();
                    } else {
                        console.error('Failed to auto-create widget:', createErr);
                        throw createErr;
                    }
                }
            }

            if (!existing) throw new Error('Could not initialize widget');

            setWidgetId(existing.id);

            // Normalize data (Server -> Builder State)
            // Priority: json content > legacy fields > defaults
            const content = (existing as any).content || {};
            const theme = (existing as any).theme || {};
            const ai = (existing as any).ai || {};
            const features = (existing as any).features || {};

            const normalized: any = {
                // Content
                title: content.title || existing.title || DEFAULT_CONFIG.title,
                subtitle: content.subtitle || existing.subtitle || DEFAULT_CONFIG.subtitle,
                brandName: content.brandName || (existing as any).brandName || DEFAULT_CONFIG.brandName,
                welcomeMessage: content.welcomeMessage || existing.welcomeMessage || DEFAULT_CONFIG.welcomeMessage,
                offlineMessage: content.offlineMessage || (existing as any).offlineMessage || DEFAULT_CONFIG.offlineMessage,
                fallbackMessage: content.fallbackMessage || (existing as any).fallbackMessage || DEFAULT_CONFIG.fallbackMessage,

                // Config
                domainAllowed: Array.isArray(existing.domainAllowed) ? existing.domainAllowed.join(', ') : '',

                // Theme
                theme: { ...DEFAULT_CONFIG.theme, ...theme },

                // AI
                aiProfileId: ai.profileId || (existing as any).aiProfileId || DEFAULT_CONFIG.aiProfileId,
                confidenceThreshold: ai.confidenceThreshold || (existing as any).confidenceThreshold || DEFAULT_CONFIG.confidenceThreshold,
                takeoverEnabled: ai.takeoverEnabled ?? (existing as any).takeoverEnabled ?? DEFAULT_CONFIG.takeoverEnabled,

                // Contacts (from ai.contact)
                contactWhatsApp: ai.contact?.whatsapp || '',
                contactPhone: ai.contact?.phone || '',
                contactEmail: ai.contact?.email || '',
                contactWebsite: ai.contact?.website || '',

                // Features
                features: {
                    ...DEFAULT_CONFIG.features,
                    ...features,
                    aiEnabled: (existing as any).aiEnabled ?? features.aiEnabled ?? DEFAULT_CONFIG.features.aiEnabled
                }
            };

            console.log("Builder Initialized with Config:", normalized);

            setSavedConfig(normalized);
            setDraftConfig(normalized);
        } catch (error: any) {
            console.error('Error initializing widget:', error);
            const msg = error?.message || (error?.status ? `HTTP ${error.status}` : 'Error desconocido');
            setInitError(`No se pudo cargar el widget: ${msg}`);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!widgetId || !isDirty) return;
        setSaving(true);
        try {
            const cleanDomains = normalizeDomains(draftConfig.domainAllowed);

            // Payload Structure (Builder State -> API)
            const payload = {
                // Config
                domainAllowed: cleanDomains,
                aiEnabled: draftConfig.features?.aiEnabled,

                // Sections
                content: {
                    title: draftConfig.title,
                    subtitle: draftConfig.subtitle,
                    brandName: draftConfig.brandName,
                    welcomeMessage: draftConfig.welcomeMessage,
                    offlineMessage: draftConfig.offlineMessage,
                    fallbackMessage: draftConfig.fallbackMessage
                },
                theme: draftConfig.theme,
                ai: {
                    enabled: draftConfig.features?.aiEnabled,
                    profileId: draftConfig.aiProfileId,
                    confidenceThreshold: parseInt(draftConfig.confidenceThreshold as any),
                    takeoverEnabled: draftConfig.takeoverEnabled,
                    contact: {
                        whatsapp: draftConfig.contactWhatsApp,
                        phone: draftConfig.contactPhone,
                        email: draftConfig.contactEmail,
                        website: draftConfig.contactWebsite
                    }
                },
                features: draftConfig.features
            };

            const updated = await webWidgetApi.updateWidget(widgetId, payload);

            // Re-sync state with response (Server -> Builder State)
            const content = (updated as any).content || {};
            const theme = (updated as any).theme || {};
            const ai = (updated as any).ai || {};
            const features = (updated as any).features || {};

            const syncData: any = {
                ...draftConfig,

                title: content.title || updated.title,
                subtitle: content.subtitle || updated.subtitle,

                domainAllowed: updated.domainAllowed?.join(', ') || '',

                theme: { ...draftConfig.theme, ...theme },

                aiProfileId: ai.profileId,
                confidenceThreshold: ai.confidenceThreshold,
                takeoverEnabled: ai.takeoverEnabled,

                features: {
                    ...draftConfig.features,
                    ...features,
                    aiEnabled: updated.aiEnabled ?? features.aiEnabled
                }
            };

            setSavedConfig(syncData);
            setDraftConfig(syncData);
            toastSuccess('Cambios guardados correctamente');
        } catch (error) {
            console.error('Error saving widget:', error);
            toastError('Error al guardar los cambios');
        } finally {
            setSaving(false);
        }
    };

    if (!loading && !initError && !widgetId) {
        return (
            <div className="h-full flex flex-col items-center justify-center bg-[var(--bg-page)] p-12 text-center">
                <div className="h-20 w-20 bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] rounded-3xl flex items-center justify-center mx-auto mb-8 border border-[var(--brand-primary)]/20">
                    <ArrowPathIcon className="h-10 w-10 animate-spin" />
                </div>
                <h3 className={`${T.sectionTitle} text-2xl mb-2 uppercase italic tracking-tighter`}>Sincronizando...</h3>
                <p className={`${T.helperText} text-[11px] font-medium opacity-80 italic`}>El widget está siendo inicializado por primera vez.</p>
            </div>
        );
    }

    if (loading) return (
        <div className="h-full flex items-center justify-center bg-[var(--bg-page)]">
            <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-t-[var(--brand-primary)] border-transparent"></div>
                <span className={`${T.helperText} uppercase tracking-[0.3em] text-[10px]`}>Inicializando Constructor...</span>
            </div>
        </div>
    );

    if (initError) return (
        <div className="h-full flex items-center justify-center bg-[var(--bg-page)] p-6">
            <div className="text-center max-w-lg p-12 bg-[var(--bg-card)] rounded-[40px] border border-[var(--border-default)] shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-red-500/50"></div>
                <div className="h-20 w-20 bg-red-500/10 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-red-500/20">
                    <XMarkIcon className="h-10 w-10 stroke-[2.5px]" />
                </div>
                <h3 className={`${T.sectionTitle} text-3xl mb-4 tracking-tighter uppercase italic`}>Error Crítico</h3>
                <p className={`${T.helperText} mb-10 text-[11px] leading-relaxed italic`}>"{initError}"</p>
                <button
                    onClick={() => window.location.reload()}
                    className={`w-full py-4 bg-[var(--brand-primary)] text-[var(--brand-primary-foreground)] rounded-2xl ${T.buttonPrimaryText} flex items-center justify-center gap-2 shadow-xl hover:brightness-110 active:scale-95 transition-all`}
                >
                    Reintentar Conexión
                </button>
            </div>
        </div>
    );

    return (
        <div className="h-full flex flex-col bg-[var(--bg-page)] text-[var(--text-strong)] overflow-hidden selection:bg-[var(--brand-primary)]/30 text-[12px]">
            {/* PRE-CONSTRUCTOR HEADER */}
            <div className="bg-[var(--bg-card)] border-b border-[var(--border-default)] px-3 h-10 shrink-0 flex items-center justify-between sticky top-0 z-10 shadow-2xl">

                <div className="flex items-center h-full">
                    <nav className="flex gap-2 h-full">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`h-full px-3 flex items-center gap-1.5 ${T.menuText} text-[10px] uppercase tracking-widest transition-all relative group/tab ${activeTab === tab.id ? '!text-[var(--brand-primary)]' : 'text-[var(--text-muted)] hover:!text-[var(--text-strong)]'}`}
                            >
                                <tab.icon className={`h-4 w-4 transition-transform ${activeTab === tab.id ? 'text-[var(--brand-primary)]' : ''}`} />
                                <span className="hidden md:inline">{tab.name}</span>
                                {activeTab === tab.id && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[var(--brand-primary)] shadow-[0_0_10px_var(--brand-primary)]" />}
                            </button>
                        ))}
                    </nav>
                </div>

                <div className="flex items-center gap-4">
                    {isDirty && (
                        <div className="hidden md:flex items-center gap-1.5 bg-[var(--brand-primary)]/10 px-2.5 py-1 rounded-full border border-[var(--brand-primary)]/20 text-[var(--brand-primary)]">
                            <div className="w-1.5 h-1.5 rounded-full bg-[var(--brand-primary)] animate-pulse glow-animation"></div>
                            <span className={`${T.helperText} !text-[var(--brand-primary)] text-[9px] uppercase tracking-wider`}>Pendiente</span>
                        </div>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={saving || !isDirty}
                        className={`px-4 py-1.5 rounded-md ${T.buttonPrimaryText} text-[10px] flex items-center justify-center gap-1.5 transition-all
                            ${isDirty && !saving ? 'bg-[var(--brand-primary)] text-[var(--brand-primary-foreground)] hover:brightness-110 glow-animation shadow-lg shadow-[var(--brand-primary)]/20' : 'bg-[var(--bg-input)] text-[var(--text-muted)] border border-[var(--border-default)]'}`}
                    >
                        <CloudArrowUpIcon className="h-3.5 w-3.5 stroke-[2.5px]" />
                        {saving ? 'Guardando...' : 'Publicar'}
                    </button>
                </div>
            </div>

            {/* MAIN SPLIT VIEW */}
            <main className="flex-1 flex overflow-hidden min-h-0">
                {/* SETTINGS PANEL (Left) */}
                <section className="flex-1 overflow-y-auto custom-scrollbar bg-[var(--bg-page)] border-r border-[var(--border-default)] relative">
                    <div className="h-full max-w-3xl xl:max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 pt-6">
                        <div className="animate-in fade-in duration-500 fill-mode-forwards relative z-10 w-full mb-12">
                            {activeTab === 'content' && <WidgetContentPanel draftConfig={draftConfig} setDraftConfig={setDraftConfig} />}
                            {activeTab === 'design' && <WidgetDesignPanel draftConfig={draftConfig} setDraftConfig={setDraftConfig} />}
                            {activeTab === 'ai' && <WidgetAiTrainingPanel draftConfig={draftConfig} setDraftConfig={setDraftConfig} />}
                            {activeTab === 'install' && <WidgetInstallationPanel
                                draftConfig={draftConfig}
                                setDraftConfig={setDraftConfig}
                                widgetId={widgetId}
                            />}
                        </div>
                    </div>
                </section>

                {/* PREVIEW PANEL (Right) */}
                <section className="w-full lg:w-[400px] xl:w-[450px] bg-[var(--bg-card)] border-l border-[var(--border-default)] flex flex-col items-center justify-start overflow-y-auto p-4 relative group/preview shrink-0 z-10 shadow-[-20px_0_50px_-20px_rgba(0,0,0,0.8)]">


                    {/* Widget preview — contenedor fijo centrado, scroll vertical si el panel es pequeño */}
                    <div className="flex justify-center items-start w-full py-3 transition-transform duration-500 group-hover/preview:-translate-y-1">
                        <WidgetPreviewFrame
                            widgetId={widgetId}
                            apiBaseUrl={(() => {
                                const isRender = window.location.hostname.includes('onrender.com');
                                const defaultBackend = isRender ? 'https://core-starter.onrender.com' : 'http://localhost:4000';
                                const rawUrl = import.meta.env.VITE_API_URL || defaultBackend;
                                try {
                                    return new URL(rawUrl).origin;
                                } catch {
                                    return rawUrl.startsWith('/') ? defaultBackend : rawUrl.replace(/\/v1\/?$/, '');
                                }
                            })()}
                            draftConfig={{
                                ...draftConfig,
                                content: {
                                    title: draftConfig.title,
                                    subtitle: draftConfig.subtitle,
                                    brandName: draftConfig.brandName,
                                    welcomeMessage: draftConfig.welcomeMessage,
                                    offlineMessage: draftConfig.offlineMessage,
                                    fallbackMessage: draftConfig.fallbackMessage
                                }
                            }}
                        />
                    </div>
                </section>
            </main>
        </div>
    );
};

export default WebWidgetBuilderPage;
