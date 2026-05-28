import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getChannels, Channel } from '@/api/wabee/whatsapp.api';
import { templatesApi, Template, TemplatesResponse } from '@/api/wabee/templates.api';
import { TemplatesWhatsAppCards } from '@/components/wabee/TemplatesWhatsAppCards';
import { useToast } from '@/context/ToastContext';
import { useDialog } from '@/context/DialogContext';
import { T, S } from '@/lib/text-tokens';



export default function TemplatesHubPage() {
    const navigate = useNavigate();
    const { channelId: urlChannelId } = useParams<{ channelId: string }>();

    // Channels
    const [channels, setChannels] = useState<Channel[]>([]);
    const [selectedChannelId, setSelectedChannelId] = useState<string>('');
    const [loadingChannels, setLoadingChannels] = useState(true);

    // View Mode
    const [viewMode, setViewMode] = useState<'table' | 'whatsapp'>('table');

    // Templates
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loadingTemplates, setLoadingTemplates] = useState(false);
    const [importing, setImporting] = useState(false);
    const [meta, setMeta] = useState<any>(null);

    // Filters
    const [filters, setFilters] = useState({
        status: '',
        language: '',
        category: '',
        q: ''
    });

    const { error: toastError, success: toastSuccess, warning: toastWarn } = useToast();
    const { confirm } = useDialog();

    // Tenant Key for Persistence
    const tenantKey = localStorage.getItem('tenant_key') || 'default';
    const storageKey = `wabee.templates.selectedChannel.${tenantKey}`;

    // Load channels on mount
    useEffect(() => {
        const fetchChannelsData = async () => {
            try {
                setLoadingChannels(true);
                const data = await getChannels({});
                setChannels(data);

                // Initialization Logic
                let initialId = '';

                // 1. URL Alias
                if (urlChannelId && data.some(c => c.id === urlChannelId)) {
                    initialId = urlChannelId;
                }
                // 2. Local Storage
                else {
                    const savedId = localStorage.getItem(storageKey);
                    if (savedId && data.some(c => c.id === savedId)) {
                        initialId = savedId;
                    }
                }

                // 3. First available
                if (!initialId && data.length > 0) {
                    initialId = data[0].id;
                }

                if (initialId) {
                    setSelectedChannelId(initialId);
                }
            } catch (error) {
                console.error('Error loading channels:', error);
            } finally {
                setLoadingChannels(false);
            }
        };
        fetchChannelsData();
    }, [urlChannelId, storageKey]);

    // Persist selection
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
            toastWarn('El canal debe estar CONNECTED y tener WABA ID para importar.');
            return;
        }

        const isConfirmed = await confirm({
            title: 'Importar Templates',
            description: '¿Importar templates desde Meta? Esto puede tomar unos segundos.',
            confirmText: 'Importar'
        });
        if (!isConfirmed) return;

        setImporting(true);
        try {
            const data = await templatesApi.importTemplates(selectedChannelId);

            toastSuccess(`Importación completa: ${data.imported} importados, ${data.updated} actualizados, ${data.skipped} omitidos.`);

            await fetchTemplates();
        } catch (error: any) {
            console.error('Error importing templates:', error);
            toastError(error.message || 'Error importing templates');
        } finally {
            setImporting(false);
        }
    };

    const extractBodyPreview = (components: any[]): string => {
        if (!components || !Array.isArray(components)) return 'N/A';

        const bodyComponent = components.find(c => c.type === 'BODY');
        if (!bodyComponent || !bodyComponent.text) return 'N/A';

        return bodyComponent.text.replace(/\{\{(\d+)\}\}/g, '____');
    };

    const selectedChannel = channels.find(c => c.id === selectedChannelId);
    const canImport = selectedChannel?.status === 'CONNECTED' && !!selectedChannel?.wabaId;

    // Loading state
    if (loadingChannels) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    // No channels state
    if (channels.length === 0) {
        return (
            <div className="p-12 max-w-4xl mx-auto text-center">
                <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-[40px] p-16 shadow-2xl relative overflow-hidden">
                    <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-[var(--brand-primary)]/5 blur-[100px] pointer-events-none ${T.buttonPrimaryText}`}></div>
                    <h1 className={`${T.pageTitle} text-4xl font-black text-[var(--text-strong)] mb-6 uppercase italic tracking-tighter`}>Canales <span className="text-[var(--brand-primary)]">Inactivos</span></h1>
                    <p className={`${T.pageSubtitle} ${S.body} text-[var(--text-muted)] mb-10 font-medium max-w-sm mx-auto leading-relaxed`}>No se han detectado puentes de comunicación de WhatsApp configurados en este entorno.</p>
                    <button
                        onClick={() => navigate('/dashboard/wabee/channels')}
                        className={`bg-[var(--brand-primary)]  px-10 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:brightness-110 transition-all active:scale-95 shadow-lg shadow-[var(--brand-primary)]/20 ${T.buttonPrimaryText}`}
                    >
                        Configurar Canales
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-10 bg-[var(--bg-page)] min-h-screen">
            {/* Header with Channel Selector */}
            <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <h1 className={`${T.pageTitle} text-5xl font-black text-[var(--text-strong)] tracking-tighter uppercase italic`}>Templates <span className="text-[var(--brand-primary)]">Hub</span></h1>
                        <p className={`${T.pageSubtitle} ${S.body} text-[var(--text-muted)] font-medium max-w-md`}>Gestión centralizada de plantillas de Meta para campañas de alta conversión.</p>
                    </div>

                    {/* Channel Selector Styled */}
                    <div className="flex items-center gap-4 bg-[var(--bg-card)] p-2 rounded-2xl border border-[var(--border-default)]">
                        <div className="pl-4 text-[var(--brand-primary)]"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg></div>
                        <select
                            value={selectedChannelId}
                            onChange={(e) => setSelectedChannelId(e.target.value)}
                            className={`${T.inputText} ${S.body} bg-transparent text-[var(--text-strong)] font-black uppercase tracking-widest text-[10px] py-2 pr-8 outline-none cursor-pointer appearance-none`}
                        >
                            {channels.map((channel) => (
                                <option key={channel.id} value={channel.id} className="bg-[var(--bg-card)] text-[var(--text-strong)]">
                                    {channel.name} ({channel.displayPhone || 'N/A'})
                                </option>
                            ))}
                        </select>
                        {!canImport && selectedChannelId && (
                            <div className="px-3 py-1 bg-[var(--state-danger)]/10 border border-[var(--state-danger)]/20 rounded-lg">
                                <span className="text-[9px] text-[var(--state-danger)] font-black uppercase tracking-widest italic">Offline</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {/* View Mode Toggle */}
                    <div className="flex bg-[var(--bg-card)] p-1.5 rounded-2xl border border-[var(--border-default)]">
                        <button
                            onClick={() => setViewMode('table')}
                            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'table' ? 'bg-[var(--brand-primary)]  shadow-lg shadow-[var(--brand-primary)]/10' : 'text-[color:var(--text-muted)] hover:text-[color:var(--text-strong)]'} ${T.buttonPrimaryText}`}
                        >
                            Estructura
                        </button>
                        <button
                            onClick={() => setViewMode('whatsapp')}
                            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'whatsapp' ? 'bg-[var(--brand-primary)]  shadow-lg shadow-[var(--brand-primary)]/10' : 'text-[color:var(--text-muted)] hover:text-[color:var(--text-strong)]'} ${T.buttonPrimaryText}`}
                        >
                            Visual
                        </button>
                    </div>

                    <button
                        onClick={handleImport}
                        disabled={importing || !selectedChannelId || !canImport}
                        className="bg-[var(--bg-card)] text-[color:var(--brand-primary)] px-8 py-3.5 rounded-2xl font-black uppercase tracking-widest text-[10px] border border-[var(--brand-primary)]/20 hover:bg-[var(--brand-primary)] hover: transition-all disabled:opacity-20 disabled:grayscale flex items-center gap-3 shadow-xl shadow-[var(--brand-primary)]/5"
                    >
                        {importing ? (
                            <><div className="animate-spin h-3 w-3 border-2 border-[var(--brand-primary-foreground)] border-t-transparent rounded-full" /> Sincronizando...</>
                        ) : (
                            <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg> Meta Sync</>
                        )}
                    </button>
                </div>
            </header>

            {/* Filters */}
            <div className="bg-[var(--bg-card)] p-6 rounded-3xl border border-[var(--border-default)] shadow-2xl flex flex-wrap gap-8 items-center">
                <div className="min-w-[150px]">
                    <label className={`${T.labelText} ${S.meta} block font-black text-[color:var(--text-muted)] uppercase tracking-[0.2em] mb-2 px-1`}>Estado</label>
                    <div className="relative">
                        <select
                            value={filters.status}
                            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                            className={`${T.inputText} ${S.body} w-full px-5 py-3 bg-[var(--bg-input)] border border-[var(--border-default)] text-[var(--text-strong)] rounded-xl outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/50 focus:border-[var(--brand-primary)] transition-all font-black uppercase tracking-widest text-[9px] appearance-none cursor-pointer`}
                        >
                            <option value="" className="bg-[var(--bg-card)]">TODOS</option>
                            <option value="APPROVED" className="bg-[var(--bg-card)]">APPROVED</option>
                            <option value="PENDING" className="bg-[var(--bg-card)]">PENDING</option>
                            <option value="REJECTED" className="bg-[var(--bg-card)]">REJECTED</option>
                        </select>
                    </div>
                </div>

                <div className="min-w-[120px]">
                    <label className={`${T.labelText} ${S.meta} block font-black text-[color:var(--text-muted)] uppercase tracking-[0.2em] mb-2 px-1`}>Idioma</label>
                    <input
                        type="text"
                        value={filters.language}
                        onChange={(e) => setFilters({ ...filters, language: e.target.value })}
                        placeholder="ej: es_MX"
                        className={`${T.inputText} w-full px-5 py-3 bg-[var(--bg-input)] border border-[var(--border-default)] text-[var(--text-strong)] rounded-xl outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/50 focus:border-[var(--brand-primary)] transition-all font-mono text-[10px] placeholder:text-[var(--text-muted)]`}
                    />
                </div>

                <div className="min-w-[180px]">
                    <label className={`${T.labelText} ${S.meta} block font-black text-[color:var(--text-muted)] uppercase tracking-[0.2em] mb-2 px-1`}>Categoría</label>
                    <div className="relative">
                        <select
                            value={filters.category}
                            onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                            className={`${T.inputText} ${S.body} w-full px-5 py-3 bg-[var(--bg-input)] border border-[var(--border-default)] text-[var(--text-strong)] rounded-xl outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/50 focus:border-[var(--brand-primary)] transition-all font-black uppercase tracking-widest text-[9px] appearance-none cursor-pointer`}
                        >
                            <option value="" className="bg-[var(--bg-card)]">TODAS</option>
                            <option value="MARKETING" className="bg-[var(--bg-card)]">MARKETING</option>
                            <option value="UTILITY" className="bg-[var(--bg-card)]">UTILITY</option>
                            <option value="AUTHENTICATION" className="bg-[var(--bg-card)]">AUTHENTICATION</option>
                        </select>
                    </div>
                </div>

                <div className="flex-1 min-w-[250px]">
                    <label className={`${T.labelText} ${S.meta} block font-black text-[color:var(--text-muted)] uppercase tracking-[0.2em] mb-2 px-1`}>Identificador</label>
                    <div className="flex gap-4">
                        <input
                            type="text"
                            value={filters.q}
                            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                            placeholder="Nombre de la plantilla..."
                            className={`${T.inputText} w-full px-5 py-3 bg-[var(--bg-input)] border border-[var(--border-default)] text-[var(--text-strong)] rounded-xl outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/50 focus:border-[var(--brand-primary)] transition-all font-medium placeholder:text-[var(--text-muted)]`}
                        />
                        <button
                            onClick={fetchTemplates}
                            className={`bg-[var(--brand-primary)]  px-8 rounded-xl font-black uppercase tracking-widest text-[9px] hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-[var(--brand-primary)]/20 ${T.buttonPrimaryText}`}
                        >
                            Filtrar
                        </button>
                    </div>
                </div>
            </div>

            {/* Templates Content */}
            {loadingTemplates ? (
                <div className="py-32 flex flex-col items-center gap-6 bg-[var(--bg-card)] rounded-[40px] border border-[var(--border-default)] shadow-2xl">
                    <div className="w-16 h-16 border-4 border-[var(--brand-primary)]/10 border-t-[var(--brand-primary)] rounded-full animate-spin"></div>
                    <p className={`${T.helperText} ${S.meta} text-[color:var(--text-muted)] font-black uppercase tracking-[0.3em] text-[10px] animate-pulse`}>Analizando Meta Registry...</p>
                </div>
            ) : (
                <div className="space-y-8">
                    {viewMode === 'table' ? (
                        <div className="bg-[var(--bg-card)] rounded-[32px] border border-[var(--border-default)] shadow-2xl overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-[var(--bg-muted)] border-b border-[var(--border-default)]">
                                        <th className={`px-8 py-6 ${T.tableHeader} ${S.meta} font-black text-[color:var(--text-muted)] uppercase tracking-[0.2em] italic`}>Nombre</th>
                                        <th className={`px-8 py-6 ${T.tableHeader} ${S.meta} font-black text-[color:var(--text-muted)] uppercase tracking-[0.2em] italic`}>Idioma</th>
                                        <th className={`px-8 py-6 ${T.tableHeader} ${S.meta} font-black text-[color:var(--text-muted)] uppercase tracking-[0.2em] italic`}>Categoría</th>
                                        <th className={`px-8 py-6 ${T.tableHeader} ${S.meta} font-black text-[color:var(--text-muted)] uppercase tracking-[0.2em] italic`}>Estatus</th>
                                        <th className={`px-8 py-6 ${T.tableHeader} ${S.meta} font-black text-[color:var(--text-muted)] uppercase tracking-[0.2em] italic`}>Cuerpo (Snippet)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border-default)]">
                                    {templates.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className={`px-8 py-24 text-center ${T.tableCell} text-[color:var(--text-muted)] font-bold italic uppercase tracking-widest opacity-30 text-xs`}>
                                                No se detectaron plantillas en esta frecuencia
                                            </td>
                                        </tr>
                                    ) : (
                                        templates.map((template) => (
                                            <tr key={template.id} className="hover:bg-[var(--brand-primary)]/[0.02] transition-colors group">
                                                <td className={`px-8 py-5 ${T.tableCell} text-sm font-extrabold text-[var(--text-strong)] group-hover:text-[var(--brand-primary)] transition-colors`}>
                                                    {template.name}
                                                </td>
                                                <td className={`px-8 py-5 ${T.badgeText} text-[10px] font-black text-[color:var(--brand-primary)] uppercase tracking-widest`}>
                                                    {template.language}
                                                </td>
                                                <td className="px-8 py-5">
                                                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${template.category === 'MARKETING' ? 'bg-[color:var(--state-info)]/10 text-[color:var(--state-info)] border-[color:var(--state-info)]/20' :
                                                        template.category === 'UTILITY' ? 'bg-[color:var(--state-success)]/10 text-[color:var(--state-success)] border-[color:var(--state-success)]/20' :
                                                            'bg-[color:var(--state-warning)]/10 text-[color:var(--state-warning)] border-[color:var(--state-warning)]/20'
                                                        }`}>
                                                        {template.category}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <span className={`px-3 py-1 rounded-full ${T.badgeText} text-[9px] font-black uppercase tracking-widest border ${template.status === 'APPROVED' ? 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] border-[var(--brand-primary)]/20 shadow-[0_0_10px_rgba(var(--brand-primary-rgb),0.1)]' :
                                                        template.status === 'PENDING' ? 'bg-[color:var(--state-warning)]/10 text-[color:var(--state-warning)] border-[color:var(--state-warning)]/20' :
                                                            template.status === 'REJECTED' ? 'bg-[color:var(--state-danger)]/10 text-[color:var(--state-danger)] border-[color:var(--state-danger)]/20' :
                                                                'bg-[color:var(--text-muted)]/10 text-[color:var(--text-muted)] border-[color:var(--text-muted)]/20'
                                                        }`}>
                                                        {template.status}
                                                    </span>
                                                </td>
                                                <td className={`px-8 py-5 ${T.tableCell} text-xs text-[color:var(--text-muted)] max-w-xs truncate italic font-medium opacity-60`}>
                                                    {extractBodyPreview(template.components)}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <TemplatesWhatsAppCards templates={templates} />
                    )}

                    {meta && meta.total > 0 && (
                        <div className={`flex justify-between items-center ${T.helperText} ${S.meta} text-[10px] font-black text-[color:var(--text-muted)] uppercase tracking-[0.2em] italic opacity-60 px-4`}>
                            <div>Sincronizados: <span className="text-[color:var(--text-strong)] not-italic">{templates.length} / {meta.total}</span></div>
                            <div className="flex gap-2 items-center">
                                <div className="h-[1px] w-12 bg-[var(--border-default)]"></div>
                                Página {meta.page} de {meta.totalPages}
                                <div className="h-[1px] w-12 bg-[var(--border-default)]"></div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
