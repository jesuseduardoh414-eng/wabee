import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getChannels, Channel } from '@/api/wabee/whatsapp.api';
import { templatesApi, Template } from '@/api/wabee/templates.api';
import { TemplatesWhatsAppCards } from '@/components/wabee/TemplatesWhatsAppCards';
import CreateTemplateModal from '@/components/wabee/CreateTemplateModal';
import { useToast } from '@/context/ToastContext';
import { useDialog } from '@/context/DialogContext';
import { T, S } from '@/lib/text-tokens';

const COPY = {
    inactiveTitle: 'Canales',
    inactiveHighlight: 'Inactivos',
    inactiveBody: 'No se han detectado puentes de comunicación de WhatsApp configurados en este entorno.',
    configureChannels: 'Configurar Canales',
    title: 'Templates',
    highlight: 'Hub',
    subtitle: 'Gestión centralizada de plantillas de Meta para campañas de alta conversión.',
    offline: 'Offline',
    structure: 'Estructura',
    visual: 'Visual',
    sync: 'Meta Sync',
    syncing: 'Sincronizando...',
    syncWarn: 'El canal debe estar CONNECTED y tener WABA ID para importar.',
    syncConfirmTitle: 'Importar Templates',
    syncConfirmDescription: '¿Importar templates desde Meta? Esto puede tomar unos segundos.',
    syncConfirmButton: 'Importar',
    syncSuccess: (data: { imported: number; updated: number; skipped: number }) =>
        `Importación completa: ${data.imported} importados, ${data.updated} actualizados, ${data.skipped} omitidos.`,
    status: 'Estado',
    language: 'Idioma',
    category: 'Categoría',
    identifier: 'Identificador',
    all: 'TODOS',
    allCategories: 'TODAS',
    filter: 'Filtrar',
    templateName: 'Nombre de la plantilla...',
    loading: 'Analizando Meta Registry...',
    name: 'Nombre',
    snippet: 'Cuerpo (Snippet)',
    noTemplates: 'No se detectaron plantillas en esta frecuencia',
    synced: 'Sincronizados',
    page: 'Página',
    approved: 'APPROVED',
    pending: 'PENDING',
    rejected: 'REJECTED',
    marketing: 'MARKETING',
    utility: 'UTILITY',
    auth: 'AUTHENTICATION',
    notAvailable: 'N/A',
} as const;

export default function TemplatesHubPage() {
    const navigate = useNavigate();
    const { channelId: urlChannelId } = useParams<{ channelId: string }>();

    const [channels, setChannels] = useState<Channel[]>([]);
    const [selectedChannelId, setSelectedChannelId] = useState<string>('');
    const [loadingChannels, setLoadingChannels] = useState(true);
    const [viewMode, setViewMode] = useState<'table' | 'whatsapp'>('table');
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loadingTemplates, setLoadingTemplates] = useState(false);
    const [importing, setImporting] = useState(false);
    const [meta, setMeta] = useState<any>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [filters, setFilters] = useState({
        status: '',
        language: '',
        category: '',
        q: ''
    });

    const { error: toastError, success: toastSuccess, warning: toastWarn } = useToast();
    const { confirm } = useDialog();

    const tenantKey = localStorage.getItem('tenant_key') || 'default';
    const storageKey = `wabee.templates.selectedChannel.${tenantKey}`;

    useEffect(() => {
        const fetchChannelsData = async () => {
            try {
                setLoadingChannels(true);
                const data = await getChannels({});
                setChannels(data);

                let initialId = '';
                if (urlChannelId && data.some(c => c.id === urlChannelId)) {
                    initialId = urlChannelId;
                } else {
                    const savedId = localStorage.getItem(storageKey);
                    if (savedId && data.some(c => c.id === savedId)) initialId = savedId;
                }

                if (!initialId && data.length > 0) initialId = data[0].id;
                if (initialId) setSelectedChannelId(initialId);
            } catch (error) {
                console.error('Error loading channels:', error);
            } finally {
                setLoadingChannels(false);
            }
        };
        fetchChannelsData();
    }, [urlChannelId, storageKey]);

    useEffect(() => {
        if (selectedChannelId) {
            localStorage.setItem(storageKey, selectedChannelId);
            fetchTemplates();
        }
    }, [selectedChannelId]);

    const fetchTemplates = async () => {
        if (!selectedChannelId) return;
        setLoadingTemplates(true);
        try {
            const data = await templatesApi.listTemplates(selectedChannelId, filters);
            setTemplates(data.items);
            setMeta(data.meta);
        } catch (error: any) {
            console.error('Error fetching templates:', error);
            toastError(error.message || 'Error loading templates');
        } finally {
            setLoadingTemplates(false);
        }
    };

    const handleImport = async () => {
        if (!selectedChannelId) return;
        const channel = channels.find(c => c.id === selectedChannelId);

        if (!channel || channel.status !== 'CONNECTED' || !channel.wabaId) {
            toastWarn(COPY.syncWarn);
            return;
        }

        const isConfirmed = await confirm({
            title: COPY.syncConfirmTitle,
            description: COPY.syncConfirmDescription,
            confirmText: COPY.syncConfirmButton
        });
        if (!isConfirmed) return;

        setImporting(true);
        try {
            const data = await templatesApi.importTemplates(selectedChannelId);
            toastSuccess(COPY.syncSuccess(data));
            await fetchTemplates();
        } catch (error: any) {
            console.error('Error importing templates:', error);
            toastError(error.message || 'Error importing templates');
        } finally {
            setImporting(false);
        }
    };

    const extractBodyPreview = (components: any[]): string => {
        if (!components || !Array.isArray(components)) return COPY.notAvailable;
        const bodyComponent = components.find(c => c.type === 'BODY');
        if (!bodyComponent || !bodyComponent.text) return COPY.notAvailable;
        return bodyComponent.text.replace(/\{\{(\d+)\}\}/g, '____');
    };

    const selectedChannel = channels.find(c => c.id === selectedChannelId);
    const canImport = selectedChannel?.status === 'CONNECTED' && !!selectedChannel?.wabaId;

    if (loadingChannels) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (channels.length === 0) {
        return (
            <div className="mx-auto max-w-4xl p-6 text-center sm:p-12">
                <div className="relative overflow-hidden rounded-[32px] border border-[var(--border-default)] bg-[var(--bg-card)] p-8 shadow-2xl sm:rounded-[40px] sm:p-16">
                    <div className={`pointer-events-none absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 bg-[var(--brand-primary)]/5 blur-[100px] ${T.buttonPrimaryText}`}></div>
                    <h1 className={`${T.pageTitle} mb-6 text-4xl font-bold uppercase italic tracking-tighter text-[var(--text-strong)]`}>
                        {COPY.inactiveTitle} <span className="text-[var(--brand-primary)]">{COPY.inactiveHighlight}</span>
                    </h1>
                    <p className={`${T.pageSubtitle} ${S.body} mx-auto mb-10 max-w-sm font-medium leading-relaxed text-[var(--text-muted)]`}>{COPY.inactiveBody}</p>
                    <button
                        onClick={() => navigate('/dashboard/wabee/channels')}
                        className={`rounded-2xl bg-[var(--brand-primary)] px-10 py-4 text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-[var(--brand-primary)]/20 transition-all hover:brightness-110 active:scale-95 ${T.buttonPrimaryText}`}
                    >
                        {COPY.configureChannels}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto min-h-screen max-w-7xl space-y-8 bg-[var(--bg-page)] px-4 py-6 sm:space-y-10 sm:px-6 sm:py-8 lg:px-8">
            <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <h1 className={`${T.pageTitle} text-4xl font-bold uppercase italic tracking-tighter text-[var(--text-strong)] sm:text-5xl`}>
                            {COPY.title} <span className="text-[var(--brand-primary)]">{COPY.highlight}</span>
                        </h1>
                        <p className={`${T.pageSubtitle} ${S.body} max-w-md font-medium text-[var(--text-muted)]`}>{COPY.subtitle}</p>
                    </div>

                    <div className="flex w-full items-center gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-2 sm:gap-4">
                        <div className="pl-3 text-[var(--brand-primary)] sm:pl-4">
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                        </div>
                        <select
                            value={selectedChannelId}
                            onChange={(e) => setSelectedChannelId(e.target.value)}
                            className={`${T.inputText} ${S.body} min-w-0 flex-1 cursor-pointer appearance-none bg-transparent py-2 pr-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-strong)] outline-none sm:pr-8`}
                        >
                            {channels.map((channel) => (
                                <option key={channel.id} value={channel.id} className="bg-[var(--bg-card)] text-[var(--text-strong)]">
                                    {channel.name} ({channel.displayPhone || COPY.notAvailable})
                                </option>
                            ))}
                        </select>
                        {!canImport && selectedChannelId && (
                            <div className="rounded-lg border border-[var(--state-danger)]/20 bg-[var(--state-danger)]/10 px-2 py-1 sm:px-3">
                                <span className="text-[9px] font-bold uppercase tracking-widest italic text-[var(--state-danger)]">{COPY.offline}</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:w-auto lg:flex-col lg:items-stretch xl:flex-row">
                    <div className="flex flex-1 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-1.5">
                        <button
                            onClick={() => setViewMode('table')}
                            className={`flex-1 rounded-xl px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all ${viewMode === 'table' ? 'bg-[var(--brand-primary)] shadow-lg shadow-[var(--brand-primary)]/10' : 'text-[color:var(--text-muted)] hover:text-[color:var(--text-strong)]'} ${T.buttonPrimaryText}`}
                        >
                            {COPY.structure}
                        </button>
                        <button
                            onClick={() => setViewMode('whatsapp')}
                            className={`flex-1 rounded-xl px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all ${viewMode === 'whatsapp' ? 'bg-[var(--brand-primary)] shadow-lg shadow-[var(--brand-primary)]/10' : 'text-[color:var(--text-muted)] hover:text-[color:var(--text-strong)]'} ${T.buttonPrimaryText}`}
                        >
                            {COPY.visual}
                        </button>
                    </div>

                    <button
                        onClick={() => setShowCreateModal(true)}
                        disabled={!selectedChannelId || !canImport}
                        className={`flex w-full items-center justify-center gap-3 rounded-2xl bg-[var(--brand-primary)] px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-[var(--brand-primary)]/20 transition-all disabled:cursor-not-allowed disabled:opacity-30 hover:brightness-110 active:scale-95 sm:w-auto sm:px-8 ${T.buttonPrimaryText}`}
                    >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                        Crear Plantilla
                    </button>

                    <button
                        onClick={handleImport}
                        disabled={importing || !selectedChannelId || !canImport}
                        className="flex w-full items-center justify-center gap-3 rounded-2xl border border-[var(--brand-primary)]/20 bg-[var(--bg-card)] px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-[color:var(--brand-primary)] shadow-xl shadow-[var(--brand-primary)]/5 transition-all disabled:grayscale disabled:opacity-20 hover:bg-[var(--brand-primary)] sm:w-auto sm:px-8"
                    >
                        {importing ? (
                            <>
                                <div className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--brand-primary-foreground)] border-t-transparent"></div>
                                {COPY.syncing}
                            </>
                        ) : (
                            <>
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                {COPY.sync}
                            </>
                        )}
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 gap-4 rounded-3xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5 shadow-2xl sm:grid-cols-2 sm:gap-5 sm:p-6 xl:grid-cols-[150px_170px_190px_minmax(0,1fr)] xl:items-end">
                <div>
                    <label className={`${T.labelText} ${S.meta} mb-2 block px-1 font-bold uppercase tracking-[0.2em] text-[color:var(--text-muted)]`}>{COPY.status}</label>
                    <select
                        value={filters.status}
                        onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                        className={`${T.inputText} ${S.body} w-full cursor-pointer appearance-none rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-5 py-3 text-[9px] font-bold uppercase tracking-widest text-[var(--text-strong)] outline-none transition-all focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/50`}
                    >
                        <option value="" className="bg-[var(--bg-card)]">{COPY.all}</option>
                        <option value="APPROVED" className="bg-[var(--bg-card)]">{COPY.approved}</option>
                        <option value="PENDING" className="bg-[var(--bg-card)]">{COPY.pending}</option>
                        <option value="REJECTED" className="bg-[var(--bg-card)]">{COPY.rejected}</option>
                    </select>
                </div>

                <div>
                    <label className={`${T.labelText} ${S.meta} mb-2 block px-1 font-bold uppercase tracking-[0.2em] text-[color:var(--text-muted)]`}>{COPY.language}</label>
                    <input
                        type="text"
                        value={filters.language}
                        onChange={(e) => setFilters({ ...filters, language: e.target.value })}
                        placeholder="ej: es_MX"
                        className={`${T.inputText} w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-5 py-3 font-mono text-[10px] text-[var(--text-strong)] outline-none transition-all placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/50`}
                    />
                </div>

                <div>
                    <label className={`${T.labelText} ${S.meta} mb-2 block px-1 font-bold uppercase tracking-[0.2em] text-[color:var(--text-muted)]`}>{COPY.category}</label>
                    <select
                        value={filters.category}
                        onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                        className={`${T.inputText} ${S.body} w-full cursor-pointer appearance-none rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-5 py-3 text-[9px] font-bold uppercase tracking-widest text-[var(--text-strong)] outline-none transition-all focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/50`}
                    >
                        <option value="" className="bg-[var(--bg-card)]">{COPY.allCategories}</option>
                        <option value="MARKETING" className="bg-[var(--bg-card)]">{COPY.marketing}</option>
                        <option value="UTILITY" className="bg-[var(--bg-card)]">{COPY.utility}</option>
                        <option value="AUTHENTICATION" className="bg-[var(--bg-card)]">{COPY.auth}</option>
                    </select>
                </div>

                <div>
                    <label className={`${T.labelText} ${S.meta} mb-2 block px-1 font-bold uppercase tracking-[0.2em] text-[color:var(--text-muted)]`}>{COPY.identifier}</label>
                    <div className="flex gap-3">
                        <input
                            type="text"
                            value={filters.q}
                            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                            placeholder={COPY.templateName}
                            className={`${T.inputText} min-w-0 flex-1 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-5 py-3 font-medium text-[var(--text-strong)] outline-none transition-all placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/50`}
                        />
                        <button
                            onClick={fetchTemplates}
                            className={`rounded-xl bg-[var(--brand-primary)] px-6 text-[9px] font-bold uppercase tracking-widest shadow-lg shadow-[var(--brand-primary)]/20 transition-all hover:brightness-110 active:scale-95 sm:px-8 ${T.buttonPrimaryText}`}
                        >
                            {COPY.filter}
                        </button>
                    </div>
                </div>
            </div>

            {loadingTemplates ? (
                <div className="flex flex-col items-center gap-6 rounded-[32px] border border-[var(--border-default)] bg-[var(--bg-card)] py-24 shadow-2xl sm:rounded-[40px] sm:py-32">
                    <div className="h-16 w-16 animate-spin rounded-full border-4 border-[var(--brand-primary)]/10 border-t-[var(--brand-primary)]"></div>
                    <p className={`${T.helperText} ${S.meta} text-[10px] font-bold uppercase tracking-[0.3em] text-[color:var(--text-muted)] animate-pulse`}>{COPY.loading}</p>
                </div>
            ) : (
                <div className="space-y-6 sm:space-y-8">
                    {viewMode === 'table' ? (
                        <>
                            <div className="hidden overflow-hidden rounded-[32px] border border-[var(--border-default)] bg-[var(--bg-card)] shadow-2xl md:block">
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[880px] border-collapse text-left">
                                        <thead>
                                            <tr className="border-b border-[var(--border-default)] bg-[var(--bg-muted)]">
                                                <th className={`px-8 py-6 ${T.tableHeader} ${S.meta} font-bold uppercase tracking-[0.2em] italic text-[color:var(--text-muted)]`}>{COPY.name}</th>
                                                <th className={`px-8 py-6 ${T.tableHeader} ${S.meta} font-bold uppercase tracking-[0.2em] italic text-[color:var(--text-muted)]`}>{COPY.language}</th>
                                                <th className={`px-8 py-6 ${T.tableHeader} ${S.meta} font-bold uppercase tracking-[0.2em] italic text-[color:var(--text-muted)]`}>{COPY.category}</th>
                                                <th className={`px-8 py-6 ${T.tableHeader} ${S.meta} font-bold uppercase tracking-[0.2em] italic text-[color:var(--text-muted)]`}>{COPY.status}</th>
                                                <th className={`px-8 py-6 ${T.tableHeader} ${S.meta} font-bold uppercase tracking-[0.2em] italic text-[color:var(--text-muted)]`}>{COPY.snippet}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[var(--border-default)]">
                                            {templates.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className={`px-8 py-24 text-center text-xs font-bold uppercase tracking-widest opacity-30 ${T.tableCell}`}>
                                                        {COPY.noTemplates}
                                                    </td>
                                                </tr>
                                            ) : (
                                                templates.map((template) => (
                                                    <tr key={template.id} className="group transition-colors hover:bg-[var(--brand-primary)]/[0.02]">
                                                        <td className={`px-8 py-5 text-sm font-extrabold text-[var(--text-strong)] transition-colors group-hover:text-[var(--brand-primary)] ${T.tableCell}`}>{template.name}</td>
                                                        <td className={`px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-[color:var(--brand-primary)] ${T.badgeText}`}>{template.language}</td>
                                                        <td className="px-8 py-5">
                                                            <span className={`rounded-full border px-3 py-1 text-[9px] font-bold uppercase tracking-widest ${template.category === 'MARKETING' ? 'bg-[color:var(--state-info)]/10 text-[color:var(--state-info)] border-[color:var(--state-info)]/20' :
                                                                template.category === 'UTILITY' ? 'bg-[color:var(--state-success)]/10 text-[color:var(--state-success)] border-[color:var(--state-success)]/20' :
                                                                    'bg-[color:var(--state-warning)]/10 text-[color:var(--state-warning)] border-[color:var(--state-warning)]/20'
                                                                }`}>
                                                                {template.category}
                                                            </span>
                                                        </td>
                                                        <td className="px-8 py-5">
                                                            <span className={`rounded-full border px-3 py-1 text-[9px] font-bold uppercase tracking-widest ${T.badgeText} ${template.status === 'APPROVED' ? 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] border-[var(--brand-primary)]/20 shadow-[0_0_10px_rgba(var(--brand-primary-rgb),0.1)]' :
                                                                template.status === 'PENDING' ? 'bg-[color:var(--state-warning)]/10 text-[color:var(--state-warning)] border-[color:var(--state-warning)]/20' :
                                                                    template.status === 'REJECTED' ? 'bg-[color:var(--state-danger)]/10 text-[color:var(--state-danger)] border-[color:var(--state-danger)]/20' :
                                                                        'bg-[color:var(--text-muted)]/10 text-[color:var(--text-muted)] border-[color:var(--text-muted)]/20'
                                                                }`}>
                                                                {template.status}
                                                            </span>
                                                        </td>
                                                        <td className={`max-w-xs truncate px-8 py-5 text-xs font-medium italic opacity-60 ${T.tableCell} text-[color:var(--text-muted)]`}>
                                                            {extractBodyPreview(template.components)}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="space-y-4 md:hidden">
                                {templates.length === 0 ? (
                                    <div className="rounded-[28px] border border-[var(--border-default)] bg-[var(--bg-card)] px-6 py-16 text-center shadow-2xl">
                                        <p className={`${T.tableCell} text-xs font-bold uppercase tracking-widest opacity-30`}>{COPY.noTemplates}</p>
                                    </div>
                                ) : (
                                    templates.map((template) => (
                                        <article key={template.id} className="space-y-4 rounded-[28px] border border-[var(--border-default)] bg-[var(--bg-card)] p-5 shadow-2xl">
                                            <div className="flex items-start justify-between gap-3">
                                                <h3 className={`${T.cardTitle} ${S.headingMd} max-w-[70%] break-words italic text-[var(--brand-primary)]`}>{template.name}</h3>
                                                <span className={`rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest ${template.status === 'APPROVED' ? 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] border-[var(--brand-primary)]/20' :
                                                    template.status === 'PENDING' ? 'bg-[color:var(--state-warning)]/10 text-[color:var(--state-warning)] border-[color:var(--state-warning)]/20' :
                                                        'bg-[color:var(--state-danger)]/10 text-[color:var(--state-danger)] border-[color:var(--state-danger)]/20'
                                                    }`}>
                                                    {template.status}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-3">
                                                    <span className={`${T.helperText} ${S.meta} mb-1 block uppercase opacity-50`}>{COPY.language}</span>
                                                    <span className={`${T.badgeText} ${S.meta} text-[var(--brand-primary)]`}>{template.language}</span>
                                                </div>
                                                <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-3">
                                                    <span className={`${T.helperText} ${S.meta} mb-1 block uppercase opacity-50`}>{COPY.category}</span>
                                                    <span className={`${T.badgeText} ${S.meta}`}>{template.category}</span>
                                                </div>
                                            </div>
                                            <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-3">
                                                <span className={`${T.helperText} ${S.meta} mb-1 block uppercase opacity-50`}>{COPY.snippet}</span>
                                                <p className={`${T.messageText} ${S.body} text-[var(--text-muted)]`}>{extractBodyPreview(template.components)}</p>
                                            </div>
                                        </article>
                                    ))
                                )}
                            </div>
                        </>
                    ) : (
                        <TemplatesWhatsAppCards templates={templates} />
                    )}

                    {meta && meta.total > 0 && (
                        <div className={`flex flex-col gap-3 px-2 text-[10px] font-bold uppercase tracking-[0.2em] italic opacity-60 sm:flex-row sm:items-center sm:justify-between sm:px-4 ${T.helperText} text-[color:var(--text-muted)]`}>
                            <div>{COPY.synced}: <span className="not-italic text-[color:var(--text-strong)]">{templates.length} / {meta.total}</span></div>
                            <div className="flex items-center gap-2">
                                <div className="h-[1px] w-8 bg-[var(--border-default)] sm:w-12"></div>
                                {COPY.page} {meta.page} de {meta.totalPages}
                                <div className="h-[1px] w-8 bg-[var(--border-default)] sm:w-12"></div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <CreateTemplateModal
                isOpen={showCreateModal}
                channelId={selectedChannelId}
                onClose={() => setShowCreateModal(false)}
                onSuccess={fetchTemplates}
            />
        </div>
    );
}
