import React, { useState, useEffect, useRef } from 'react';
import { integrationsApi, ExternalIntegration, CrmProvider, CrmSyncLog, FieldMapping } from '@/api/wabee/integrations.api';
import { useToast } from '@/context/ToastContext';
import { useDialog } from '@/context/DialogContext';
import { textTokens as T } from '@/lib/text-tokens';

const PROVIDER_LABELS: Record<CrmProvider, string> = {
    HUBSPOT:    'HubSpot',
    SALESFORCE: 'Salesforce',
    PIPEDRIVE:  'Pipedrive',
    ZOHO:       'Zoho CRM',
    DYNAMICS365:'Dynamics 365',
};

const PROVIDER_COLORS: Record<CrmProvider, string> = {
    HUBSPOT:    'bg-orange-500/20 text-orange-400',
    SALESFORCE: 'bg-blue-500/20 text-blue-400',
    PIPEDRIVE:  'bg-green-500/20 text-green-400',
    ZOHO:       'bg-red-500/20 text-red-400',
    DYNAMICS365:'bg-purple-500/20 text-purple-400',
};

const STATUS_STYLE: Record<string, string> = {
    CONNECTED:    'bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]',
    DISCONNECTED: 'bg-[var(--border-default)] text-[var(--tx-helperText-color,#999)]',
    ERROR:        'bg-red-500/20 text-red-400',
    EXPIRED:      'bg-yellow-500/20 text-yellow-500',
};

const SYNC_STATUS_STYLE: Record<string, string> = {
    SUCCESS: 'text-[var(--brand-primary)]',
    FAILED:  'text-red-400',
    PENDING: 'text-yellow-400',
    SKIPPED: 'text-[var(--tx-helperText-color,#999)]',
};

export default function CrmIntegrationsPage() {
    const [integrations, setIntegrations] = useState<ExternalIntegration[]>([]);
    const [selected, setSelected]         = useState<(ExternalIntegration & { fieldMappings?: FieldMapping[] }) | null>(null);
    const [logs, setLogs]                 = useState<CrmSyncLog[]>([]);
    const [loading, setLoading]           = useState(true);
    const [showCreate, setShowCreate]     = useState(false);
    const [form, setForm]                 = useState<{ provider: CrmProvider; name: string }>({ provider: 'HUBSPOT', name: '' });
    const [activeTab, setActiveTab]       = useState<'mappings' | 'logs'>('logs');
    const [tokenInput, setTokenInput]     = useState('');
    const [savingToken, setSavingToken]   = useState(false);

    const { success: ok, error: err } = useToast();
    const { confirm } = useDialog();
    const oauthHandled = useRef(false);

    // Handle OAuth redirect feedback (?oauth=ok&provider=hubspot)
    useEffect(() => {
        if (oauthHandled.current) return;
        const params = new URLSearchParams(window.location.search);
        const oauthResult = params.get('oauth');
        const provider    = params.get('provider');
        if (oauthResult) {
            oauthHandled.current = true;
            // Clean query params without reloading
            window.history.replaceState({}, '', window.location.pathname);
            if (oauthResult === 'ok') {
                ok(`${provider ? PROVIDER_LABELS[provider.toUpperCase() as CrmProvider] ?? provider : 'CRM'} conectado correctamente`);
            } else {
                err('La autenticación OAuth falló. Intenta de nuevo.');
            }
        }
    }, []);

    useEffect(() => { load(); }, []);

    const load = async () => {
        setLoading(true);
        try { setIntegrations(await integrationsApi.list()); } catch { /* silent */ }
        setLoading(false);
    };

    const loadDetail = async (id: string) => {
        try {
            const [detail, syncLogs] = await Promise.all([
                integrationsApi.get(id),
                integrationsApi.getSyncLogs(id),
            ]);
            setSelected(detail);
            setLogs(syncLogs);
        } catch { /* silent */ }
    };

    const handleCreate = async () => {
        if (!form.name.trim()) return;
        try {
            await integrationsApi.create(form);
            setShowCreate(false);
            setForm({ provider: 'HUBSPOT', name: '' });
            await load();
            ok('Integración creada');
        } catch (e: any) { err(e.message); }
    };

    const saveToken = async (integration: ExternalIntegration) => {
        if (!tokenInput.trim()) return;
        setSavingToken(true);
        try {
            await integrationsApi.connectToken(integration.id, tokenInput.trim());
            setTokenInput('');
            ok(`${PROVIDER_LABELS[integration.provider]} conectado correctamente`);
            await loadDetail(integration.id);
            await load();
        } catch (e: any) {
            err(e.message || 'Error al guardar el token');
        } finally {
            setSavingToken(false);
        }
    };

    const apiRoot = (import.meta.env.VITE_API_URL as string || 'http://localhost:4000/v1').replace(/\/v1\/?$/, '');

    const startOAuth = (integration: ExternalIntegration) => {
        const tenantId = localStorage.getItem('wabee_orgId') || '';
        const provider = integration.provider.toLowerCase();
        const base     = provider === 'hubspot'
            ? `${apiRoot}/oauth/hubspot/start`
            : `${apiRoot}/oauth/crm/${provider}/start`;
        window.location.href = `${base}?integration_id=${integration.id}&tenant_id=${tenantId}`;
    };

    const handleDelete = async (integration: ExternalIntegration) => {
        const confirmed = await confirm({
            title: 'Eliminar integración',
            description: `¿Eliminar la integración con ${PROVIDER_LABELS[integration.provider]}? Se perderán los tokens y mappings.`,
            isDestructive: true,
            confirmText: 'Eliminar',
        });
        if (!confirmed) return;
        try {
            await integrationsApi.delete(integration.id);
            if (selected?.id === integration.id) setSelected(null);
            await load();
            ok('Integración eliminada');
        } catch (e: any) { err(e.message); }
    };

    return (
        <div className="h-full flex flex-col bg-[var(--bg-surface)] overflow-hidden">

            {/* Header */}
            <div className="shrink-0 px-6 pt-6 pb-4 border-b border-[var(--border-default)]">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className={`${T.pageTitle} text-2xl`}>Integraciones CRM</h1>
                        <p className={`${T.cardSubtitle} text-xs mt-1`}>Conecta WABEE con tu CRM para sincronizar contactos, leads y deals automáticamente.</p>
                    </div>
                    <button
                        onClick={() => setShowCreate(true)}
                        className="px-4 py-2 rounded-xl bg-[var(--brand-primary)] text-white text-xs font-bold uppercase tracking-widest hover:opacity-90 transition"
                    >
                        + Conectar CRM
                    </button>
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 flex overflow-hidden">

                {/* Left: list */}
                <div className="w-72 shrink-0 border-r border-[var(--border-default)] overflow-y-auto">
                    {loading && <p className={`${T.cardSubtitle} text-xs p-6 text-center`}>Cargando...</p>}
                    {!loading && integrations.length === 0 && (
                        <div className="p-6 text-center">
                            <p className={`${T.cardSubtitle} text-xs mb-3`}>Sin integraciones CRM.</p>
                            <button onClick={() => setShowCreate(true)} className="text-xs text-[var(--brand-primary)] hover:underline">Conectar el primero</button>
                        </div>
                    )}
                    {integrations.map(i => (
                        <button
                            key={i.id}
                            onClick={() => loadDetail(i.id)}
                            className={`w-full text-left px-4 py-3 border-b border-[var(--border-default)] hover:bg-[var(--bg-card)] transition ${selected?.id === i.id ? 'bg-[var(--bg-card)] border-l-2 border-l-[var(--brand-primary)]' : ''}`}
                        >
                            <div className="flex items-center justify-between gap-2">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${PROVIDER_COLORS[i.provider]}`}>
                                    {PROVIDER_LABELS[i.provider]}
                                </span>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${STATUS_STYLE[i.status] ?? ''}`}>
                                    {i.status}
                                </span>
                            </div>
                            <p className={`${T.menuText} text-xs mt-1 truncate`}>{i.name}</p>
                            {i._count && <p className={`${T.helperText} text-[10px]`}>{i._count.syncLogs} eventos</p>}
                        </button>
                    ))}
                </div>

                {/* Right: detail */}
                {!selected ? (
                    <div className="flex-1 flex items-center justify-center">
                        <p className={`${T.cardSubtitle} text-sm`}>Selecciona una integración para ver detalles</p>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">

                        {/* Header del detalle */}
                        <div className="flex items-start justify-between">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className={`${T.cardTitle} text-sm`}>{selected.name}</h2>
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${STATUS_STYLE[selected.status]}`}>{selected.status}</span>
                                </div>
                                <p className={`${T.helperText} text-[10px] mt-1`}>Proveedor: {PROVIDER_LABELS[selected.provider]}</p>
                                {selected.accounts?.[0] && (
                                    <p className={`${T.helperText} text-[10px]`}>
                                        Último token: {new Date(selected.accounts[0].updatedAt).toLocaleString()}
                                        {selected.accounts[0].tokenExpiresAt && ` · Expira: ${new Date(selected.accounts[0].tokenExpiresAt).toLocaleString()}`}
                                    </p>
                                )}
                            </div>
                            <button
                                onClick={() => handleDelete(selected)}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest bg-red-500/10 text-red-400 hover:bg-red-500/20 transition"
                            >
                                Desconectar
                            </button>
                        </div>

                        {/* Connect panel */}
                        {(selected.status === 'DISCONNECTED' || selected.status === 'EXPIRED') && (
                            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl space-y-3">
                                <p className={`${T.cardSubtitle} text-xs`}>
                                    {selected.status === 'EXPIRED'
                                        ? `El token expiró. Vuelve a autenticarte para restablecer la conexión con ${PROVIDER_LABELS[selected.provider]}.`
                                        : `Conecta tu cuenta de ${PROVIDER_LABELS[selected.provider]} para activar la sincronización automática.`}
                                </p>

                                {/* HubSpot y Pipedrive: token/API key directo */}
                                {(selected.provider === 'HUBSPOT' || selected.provider === 'PIPEDRIVE') && (
                                    <div className="flex gap-2">
                                        <input
                                            type="password"
                                            value={tokenInput}
                                            onChange={e => setTokenInput(e.target.value)}
                                            placeholder={selected.provider === 'HUBSPOT' ? 'pat-na1-xxxxxxxx...' : 'API key de Pipedrive'}
                                            className={`flex-1 px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border-default)] text-xs ${T.inputText} focus:outline-none focus:border-[var(--brand-primary)]`}
                                        />
                                        <button
                                            onClick={() => saveToken(selected)}
                                            disabled={!tokenInput.trim() || savingToken}
                                            className={`shrink-0 px-4 py-2 rounded-xl text-white text-xs font-bold uppercase tracking-widest disabled:opacity-40 hover:opacity-90 transition ${selected.provider === 'HUBSPOT' ? 'bg-orange-500' : 'bg-green-600'}`}
                                        >
                                            {savingToken ? 'Guardando...' : 'Conectar'}
                                        </button>
                                    </div>
                                )}

                                {/* Zoho, Salesforce, Dynamics365: OAuth */}
                                {['ZOHO', 'SALESFORCE', 'DYNAMICS365'].includes(selected.provider) && (
                                    <button
                                        onClick={() => startOAuth(selected)}
                                        className={`w-full py-2 rounded-xl text-white text-xs font-bold uppercase tracking-widest hover:opacity-90 transition ${
                                            selected.provider === 'ZOHO'        ? 'bg-red-600' :
                                            selected.provider === 'SALESFORCE'  ? 'bg-blue-600' :
                                            'bg-purple-600'
                                        }`}
                                    >
                                        Conectar con {PROVIDER_LABELS[selected.provider]} via OAuth
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Tabs */}
                        <div className="flex gap-1 border-b border-[var(--border-default)]">
                            {(['logs', 'mappings'] as const).map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`px-4 py-2 text-xs font-bold uppercase tracking-widest transition border-b-2 -mb-px ${
                                        activeTab === tab
                                            ? 'border-[var(--brand-primary)] text-[var(--brand-primary)]'
                                            : 'border-transparent text-[var(--tx-helperText-color,#999)] hover:text-[var(--tx-cardTitle-color)]'
                                    }`}
                                >
                                    {tab === 'logs' ? 'Historial de Sync' : 'Mapeo de Campos'}
                                </button>
                            ))}
                        </div>

                        {/* Sync logs */}
                        {activeTab === 'logs' && (
                            <div className="space-y-2">
                                {logs.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-12 gap-2">
                                        <p className={`${T.cardSubtitle} text-sm`}>Sin eventos de sincronización aún.</p>
                                        <p className={`${T.helperText} text-xs text-center max-w-xs`}>Los eventos aparecerán aquí cuando un contacto cambie a LEAD o CLIENTE.</p>
                                    </div>
                                )}
                                {logs.map(log => {
                                    const contactLabel = log.meta?.name || log.meta?.phone || log.entityId || '—';
                                    const lifecycle    = log.meta?.lifecycleStage as string | undefined;
                                    const isSuccess    = log.status === 'SUCCESS';
                                    const isFailed     = log.status === 'FAILED';

                                    return (
                                        <div key={log.id} className={`p-4 rounded-xl border ${isFailed ? 'border-red-500/30 bg-red-500/5' : 'border-[var(--border-default)] bg-[var(--bg-card)]'}`}>
                                            <div className="flex items-start justify-between gap-3">

                                                {/* Left: status + entity info */}
                                                <div className="flex items-center gap-3 min-w-0">
                                                    {/* Status dot */}
                                                    <span className={`shrink-0 w-2 h-2 rounded-full mt-0.5 ${isSuccess ? 'bg-[var(--brand-primary)]' : isFailed ? 'bg-red-500' : 'bg-yellow-400'}`} />

                                                    <div className="min-w-0">
                                                        {/* Contact identifier */}
                                                        <p className={`${T.tableCell} text-xs font-semibold truncate`}>{contactLabel}</p>

                                                        {/* Tags row */}
                                                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide ${SYNC_STATUS_STYLE[log.status]}`}>
                                                                {log.status}
                                                            </span>
                                                            <span className={`text-[9px] px-1.5 py-0.5 rounded bg-[var(--bg-input)] ${T.helperText} uppercase`}>
                                                                {log.entityType}
                                                            </span>
                                                            <span className={`text-[9px] px-1.5 py-0.5 rounded bg-[var(--bg-input)] ${T.helperText} uppercase`}>
                                                                {log.operation}
                                                            </span>
                                                            <span className={`text-[9px] px-1.5 py-0.5 rounded bg-[var(--bg-input)] ${T.helperText}`}>
                                                                {log.direction === 'PUSH' ? 'Wabee → HubSpot' : 'HubSpot → Wabee'}
                                                            </span>
                                                            {lifecycle && (
                                                                <span className={`text-[9px] px-1.5 py-0.5 rounded bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] font-bold uppercase`}>
                                                                    {lifecycle}
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Error message */}
                                                        {log.errorMessage && (
                                                            <p className="text-red-400 text-[10px] mt-1 truncate">{log.errorMessage}</p>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Right: timestamp */}
                                                <span className={`${T.helperText} text-[10px] shrink-0 mt-0.5`}>
                                                    {new Date(log.createdAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Field mappings */}
                        {activeTab === 'mappings' && (
                            <div>
                                {(!selected.fieldMappings || selected.fieldMappings.length === 0) ? (
                                    <p className={`${T.cardSubtitle} text-xs text-center py-6`}>Sin mapeos configurados. Los mapeos se configurarán al implementar el conector.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {selected.fieldMappings.map(m => (
                                            <div key={m.id} className="flex items-center gap-3 p-3 bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl text-xs">
                                                <span className={`${T.helperText} shrink-0`}>{m.entityType}</span>
                                                <span className={`${T.tableCell}`}>{m.wabeeField}</span>
                                                <span className={`${T.helperText}`}>→</span>
                                                <span className={`${T.tableCell}`}>{m.externalField}</span>
                                                <span className={`${T.helperText} ml-auto`}>{m.direction}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Create modal */}
            {showCreate && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
                        <h2 className={`${T.cardTitle} text-sm`}>Conectar CRM</h2>

                        <div className="space-y-3">
                            <div>
                                <label className={`${T.labelText} text-[10px] block mb-1`}>Proveedor *</label>
                                <select
                                    value={form.provider}
                                    onChange={e => setForm(f => ({ ...f, provider: e.target.value as CrmProvider }))}
                                    className={`w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border-default)] text-xs ${T.inputText} focus:outline-none focus:border-[var(--brand-primary)]`}
                                >
                                    {(Object.entries(PROVIDER_LABELS) as [CrmProvider, string][]).map(([val, label]) => (
                                        <option key={val} value={val}>{label}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className={`${T.labelText} text-[10px] block mb-1`}>Nombre de referencia *</label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    placeholder="Ej: HubSpot Producción"
                                    className={`w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border-default)] text-xs ${T.inputText} focus:outline-none focus:border-[var(--brand-primary)]`}
                                />
                            </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                            <button
                                onClick={() => setShowCreate(false)}
                                className={`flex-1 py-2 rounded-xl border border-[var(--border-default)] text-xs ${T.buttonText} hover:bg-[var(--bg-input)] transition`}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCreate}
                                disabled={!form.name.trim()}
                                className="flex-1 py-2 rounded-xl bg-[var(--brand-primary)] text-white text-xs font-bold uppercase tracking-widest disabled:opacity-40 hover:opacity-90 transition"
                            >
                                Crear
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
