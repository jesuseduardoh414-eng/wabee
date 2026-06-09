import React, { useEffect, useMemo, useState } from 'react';
import { webWidgetApi } from '@/api/wabee/webwidget.api';
import {
    XMarkIcon,
    ArrowPathIcon,
    ChatBubbleLeftRightIcon,
    CodeBracketIcon,
    PaintBrushIcon,
    SparklesIcon,
    CloudArrowUpIcon,
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
        bubbleStyle: 'modern',
    },
    features: {
        aiEnabled: false,
        leadCaptureEnabled: false,
        attachmentsEnabled: false,
        poweredBy: false,
    },
    aiProfileId: '',
    confidenceThreshold: 70,
    fallbackMessage: 'Lo siento, no entiendo. Te conecto con un humano...',
    takeoverEnabled: true,
    contactWhatsApp: '',
    contactPhone: '',
    contactEmail: '',
    contactWebsite: '',
};

const WebWidgetBuilderPage: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('content');
    const [saving, setSaving] = useState(false);
    const [widgetId, setWidgetId] = useState('');
    const [savedConfig, setSavedConfig] = useState<any>(DEFAULT_CONFIG);
    const [draftConfig, setDraftConfig] = useState<any>(DEFAULT_CONFIG);
    const [initError, setInitError] = useState<string | null>(null);

    const isDirty = useMemo(() => !deepEqual(draftConfig, savedConfig), [draftConfig, savedConfig]);
    const { error: toastError, success: toastSuccess } = useToast();

    useEffect(() => {
        initWidget();
    }, []);

    const initWidget = async () => {
        try {
            setLoading(true);
            setInitError(null);

            let existing = await webWidgetApi.findUnique();

            if (!existing) {
                try {
                    existing = await webWidgetApi.createWidget({
                        title: DEFAULT_CONFIG.title,
                        subtitle: DEFAULT_CONFIG.subtitle,
                    });
                } catch (createError: any) {
                    if (createError?.status === 409) {
                        existing = await webWidgetApi.findUnique();
                    } else {
                        throw createError;
                    }
                }
            }

            if (!existing) throw new Error('No se pudo inicializar el widget');

            setWidgetId(existing.id);

            const content = (existing as any).content || {};
            const theme = (existing as any).theme || {};
            const ai = (existing as any).ai || {};
            const features = (existing as any).features || {};

            const normalized = {
                title: content.title || existing.title || DEFAULT_CONFIG.title,
                subtitle: content.subtitle || existing.subtitle || DEFAULT_CONFIG.subtitle,
                brandName: content.brandName || (existing as any).brandName || DEFAULT_CONFIG.brandName,
                welcomeMessage: content.welcomeMessage || existing.welcomeMessage || DEFAULT_CONFIG.welcomeMessage,
                offlineMessage: content.offlineMessage || (existing as any).offlineMessage || DEFAULT_CONFIG.offlineMessage,
                fallbackMessage: content.fallbackMessage || (existing as any).fallbackMessage || DEFAULT_CONFIG.fallbackMessage,
                domainAllowed: Array.isArray(existing.domainAllowed) ? existing.domainAllowed.join(', ') : '',
                theme: { ...DEFAULT_CONFIG.theme, ...theme },
                aiProfileId: ai.profileId || (existing as any).aiProfileId || DEFAULT_CONFIG.aiProfileId,
                confidenceThreshold: ai.confidenceThreshold || (existing as any).confidenceThreshold || DEFAULT_CONFIG.confidenceThreshold,
                takeoverEnabled: ai.takeoverEnabled ?? (existing as any).takeoverEnabled ?? DEFAULT_CONFIG.takeoverEnabled,
                contactWhatsApp: ai.contact?.whatsapp || '',
                contactPhone: ai.contact?.phone || '',
                contactEmail: ai.contact?.email || '',
                contactWebsite: ai.contact?.website || '',
                features: {
                    ...DEFAULT_CONFIG.features,
                    ...features,
                    aiEnabled: (existing as any).aiEnabled ?? features.aiEnabled ?? DEFAULT_CONFIG.features.aiEnabled,
                },
            };

            setSavedConfig(normalized);
            setDraftConfig(normalized);
        } catch (error: any) {
            const message = error?.message || (error?.status ? `HTTP ${error.status}` : 'Error desconocido');
            setInitError(`No se pudo cargar el widget: ${message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!widgetId || !isDirty) return;

        setSaving(true);
        try {
            const cleanDomains = normalizeDomains(draftConfig.domainAllowed);

            const payload = {
                domainAllowed: cleanDomains,
                aiEnabled: draftConfig.features?.aiEnabled,
                content: {
                    title: draftConfig.title,
                    subtitle: draftConfig.subtitle,
                    brandName: draftConfig.brandName,
                    welcomeMessage: draftConfig.welcomeMessage,
                    offlineMessage: draftConfig.offlineMessage,
                    fallbackMessage: draftConfig.fallbackMessage,
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
                        website: draftConfig.contactWebsite,
                    },
                },
                features: draftConfig.features,
            };

            const updated = await webWidgetApi.updateWidget(widgetId, payload);
            const content = (updated as any).content || {};
            const theme = (updated as any).theme || {};
            const ai = (updated as any).ai || {};
            const features = (updated as any).features || {};

            const synced = {
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
                    aiEnabled: updated.aiEnabled ?? features.aiEnabled,
                },
            };

            setSavedConfig(synced);
            setDraftConfig(synced);
            toastSuccess('Cambios guardados correctamente');
        } catch {
            toastError('Error al guardar los cambios');
        } finally {
            setSaving(false);
        }
    };

    if (!loading && !initError && !widgetId) {
        return (
            <div className="flex h-full flex-col items-center justify-center bg-[var(--bg-page)] p-12 text-center">
                <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-3xl border border-[var(--brand-primary)]/20 bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]">
                    <ArrowPathIcon className="h-10 w-10 animate-spin" />
                </div>
                <h3 className={`${T.sectionTitle} mb-2 text-2xl uppercase italic tracking-tighter`}>Sincronizando...</h3>
                <p className={`${T.helperText} text-[11px] font-medium italic opacity-80`}>El widget está siendo inicializado por primera vez.</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center bg-[var(--bg-page)]">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-10 w-10 animate-spin rounded-full border-2 border-transparent border-t-[var(--brand-primary)]" />
                    <span className={`${T.helperText} text-[10px] uppercase tracking-[0.3em]`}>Inicializando constructor...</span>
                </div>
            </div>
        );
    }

    if (initError) {
        return (
            <div className="flex h-full items-center justify-center bg-[var(--bg-page)] p-6">
                <div className="relative max-w-lg overflow-hidden rounded-[40px] border border-[var(--border-default)] bg-[var(--bg-card)] p-8 text-center shadow-2xl sm:p-12">
                    <div className="absolute left-0 top-0 h-1 w-full bg-red-500/50" />
                    <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-3xl border border-red-500/20 bg-red-500/10 text-red-500">
                        <XMarkIcon className="h-10 w-10 stroke-[2.5px]" />
                    </div>
                    <h3 className={`${T.sectionTitle} mb-4 text-3xl uppercase italic tracking-tighter`}>Error crítico</h3>
                    <p className={`${T.helperText} mb-10 text-[11px] italic leading-relaxed`}>"{initError}"</p>
                    <button
                        onClick={() => window.location.reload()}
                        className={`flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--brand-primary)] py-4 text-[var(--brand-primary-foreground)] shadow-xl transition-all hover:brightness-110 active:scale-95 ${T.buttonPrimaryText}`}
                    >
                        Reintentar conexión
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col overflow-hidden bg-[var(--bg-page)] text-[12px] text-[var(--text-strong)] selection:bg-[var(--brand-primary)]/30">
            <div className="sticky top-0 z-10 shrink-0 border-b border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-2 shadow-2xl">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <nav className="flex flex-wrap gap-1 sm:gap-2">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`relative flex h-10 items-center gap-1.5 px-3 text-[10px] uppercase tracking-widest transition-all ${T.menuText} ${
                                    activeTab === tab.id
                                        ? '!text-[var(--brand-primary)]'
                                        : 'text-[var(--text-muted)] hover:!text-[var(--text-strong)]'
                                }`}
                            >
                                <tab.icon className={`h-4 w-4 ${activeTab === tab.id ? 'text-[var(--brand-primary)]' : ''}`} />
                                <span className="hidden sm:inline">{tab.name}</span>
                                {activeTab === tab.id && (
                                    <div className="absolute bottom-0 left-0 h-0.5 w-full bg-[var(--brand-primary)] shadow-[0_0_10px_var(--brand-primary)]" />
                                )}
                            </button>
                        ))}
                    </nav>

                    <div className="flex items-center justify-between gap-3 md:justify-end">
                        {isDirty && (
                            <div className="flex items-center gap-1.5 rounded-full border border-[var(--brand-primary)]/20 bg-[var(--brand-primary)]/10 px-2.5 py-1 text-[var(--brand-primary)] md:hidden">
                                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--brand-primary)]" />
                                <span className={`${T.helperText} !text-[var(--brand-primary)] text-[9px] uppercase tracking-wider`}>Pendiente</span>
                            </div>
                        )}
                        {isDirty && (
                            <div className="hidden items-center gap-1.5 rounded-full border border-[var(--brand-primary)]/20 bg-[var(--brand-primary)]/10 px-2.5 py-1 text-[var(--brand-primary)] md:flex">
                                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--brand-primary)]" />
                                <span className={`${T.helperText} !text-[var(--brand-primary)] text-[9px] uppercase tracking-wider`}>Pendiente</span>
                            </div>
                        )}
                        <button
                            onClick={handleSave}
                            disabled={saving || !isDirty}
                            className={`flex items-center justify-center gap-1.5 rounded-md px-4 py-2 text-[10px] transition-all ${T.buttonPrimaryText} ${
                                isDirty && !saving
                                    ? 'bg-[var(--brand-primary)] text-[var(--brand-primary-foreground)] shadow-lg shadow-[var(--brand-primary)]/20 hover:brightness-110'
                                    : 'border border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--text-muted)]'
                            }`}
                        >
                            <CloudArrowUpIcon className="h-3.5 w-3.5 stroke-[2.5px]" />
                            {saving ? 'Guardando...' : 'Publicar'}
                        </button>
                    </div>
                </div>
            </div>

            <main className="flex min-h-0 flex-1 flex-col overflow-hidden xl:flex-row">
                <section className="order-2 flex-1 overflow-y-auto border-t border-[var(--border-default)] bg-[var(--bg-page)] xl:order-1 xl:border-r xl:border-t-0">
                    <div className="mx-auto h-full max-w-3xl p-4 pt-6 sm:p-6 lg:max-w-4xl lg:p-8">
                        <div className="relative z-10 mb-12 w-full animate-in fade-in duration-500 fill-mode-forwards">
                            {activeTab === 'content' && <WidgetContentPanel draftConfig={draftConfig} setDraftConfig={setDraftConfig} />}
                            {activeTab === 'design' && <WidgetDesignPanel draftConfig={draftConfig} setDraftConfig={setDraftConfig} />}
                            {activeTab === 'ai' && <WidgetAiTrainingPanel draftConfig={draftConfig} setDraftConfig={setDraftConfig} />}
                            {activeTab === 'install' && (
                                <WidgetInstallationPanel
                                    draftConfig={draftConfig}
                                    setDraftConfig={setDraftConfig}
                                    widgetId={widgetId}
                                />
                            )}
                        </div>
                    </div>
                </section>

                <section className="order-1 shrink-0 border-b border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-4 xl:order-2 xl:w-[400px] xl:border-b-0 xl:border-l xl:px-4 xl:py-5 2xl:w-[450px]">
                    <div className="mx-auto flex w-full max-w-[420px] justify-center">
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
                                    fallbackMessage: draftConfig.fallbackMessage,
                                },
                            }}
                        />
                    </div>
                </section>
            </main>
        </div>
    );
};

export default WebWidgetBuilderPage;
