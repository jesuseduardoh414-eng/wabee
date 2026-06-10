import React, { useEffect, useRef, useState } from 'react';
import { integrationsApi, ExternalIntegration, CrmProvider, CrmSyncLog, FieldMapping } from '@/api/wabee/integrations.api';
import { useToast } from '@/context/ToastContext';
import { useDialog } from '@/context/DialogContext';
import { textTokens as T } from '@/lib/text-tokens';

const PROVIDER_LABELS: Record<CrmProvider, string> = {
    HUBSPOT: 'HubSpot',
    SALESFORCE: 'Salesforce',
    PIPEDRIVE: 'Pipedrive',
    ZOHO: 'Zoho CRM',
    DYNAMICS365: 'Dynamics 365',
};

const PROVIDER_COLORS: Record<CrmProvider, string> = {
    HUBSPOT: 'bg-orange-500/20 text-orange-400',
    SALESFORCE: 'bg-blue-500/20 text-blue-400',
    PIPEDRIVE: 'bg-green-500/20 text-green-400',
    ZOHO: 'bg-red-500/20 text-red-400',
    DYNAMICS365: 'bg-purple-500/20 text-purple-400',
};

const STATUS_STYLE: Record<string, string> = {
    CONNECTED: 'bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]',
    DISCONNECTED: 'bg-[var(--border-default)] text-[var(--tx-helperText-color,#999)]',
    ERROR: 'bg-red-500/20 text-red-400',
    EXPIRED: 'bg-yellow-500/20 text-yellow-500',
};

const SYNC_STATUS_STYLE: Record<string, string> = {
    SUCCESS: 'text-[var(--brand-primary)]',
    FAILED: 'text-red-400',
    PENDING: 'text-yellow-400',
    SKIPPED: 'text-[var(--tx-helperText-color,#999)]',
};

export default function CrmIntegrationsPage() {
    const [integrations, setIntegrations] = useState<ExternalIntegration[]>([]);
    const [selected, setSelected] = useState<(ExternalIntegration & { fieldMappings?: FieldMapping[] }) | null>(null);
    const [logs, setLogs] = useState<CrmSyncLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState<{ provider: CrmProvider; name: string }>({ provider: 'HUBSPOT', name: '' });
    const [activeTab, setActiveTab] = useState<'mappings' | 'logs'>('logs');
    const [tokenInput, setTokenInput] = useState('');
    const [savingToken, setSavingToken] = useState(false);
    const [seedingTools, setSeedingTools] = useState(false);
    const [syncing, setSyncing] = useState(false);

    const { success: ok, error: err } = useToast();
    const { confirm } = useDialog();
    const oauthHandled = useRef(false);

    useEffect(() => {
        if (oauthHandled.current) return;

        const params = new URLSearchParams(window.location.search);
        const oauthResult = params.get('oauth');
        const provider = params.get('provider');

        if (oauthResult) {
            oauthHandled.current = true;
            window.history.replaceState({}, '', window.location.pathname);

            if (oauthResult === 'ok') {
                ok(`${provider ? PROVIDER_LABELS[provider.toUpperCase() as CrmProvider] ?? provider : 'CRM'} conectado correctamente`);
            } else {
                err('La autenticación OAuth falló. Intenta de nuevo.');
            }
        }
    }, []);

    useEffect(() => {
        load();
    }, []);

    const load = async () => {
        setLoading(true);
        try {
            const data = await integrationsApi.list();
            setIntegrations(data);
        } catch {
            // silent
        }
        setLoading(false);
    };

    const loadDetail = async (id: string) => {
        try {
            const [detail, syncLogs] = await Promise.all([integrationsApi.get(id), integrationsApi.getSyncLogs(id)]);
            setSelected(detail);
            setLogs(syncLogs);
        } catch {
            // silent
        }
    };

    const handleCreate = async () => {
        if (!form.name.trim()) return;

        try {
            await integrationsApi.create(form);
            setShowCreate(false);
            setForm({ provider: 'HUBSPOT', name: '' });
            await load();
            ok('Integración creada');
        } catch (e: any) {
            err(e.message);
        }
    };

    const seedAiTools = async () => {
        setSeedingTools(true);
        try {
            const result = await integrationsApi.seedCrmAiTools();
            if (result.creadas.length > 0) {
                ok(`${result.creadas.length} AI Tools creadas: ${result.creadas.join(', ')}. Asígnalas a tu perfil de IA.`);
            } else {
                ok('Las AI Tools de CRM ya estaban creadas en tu biblioteca.');
            }
        } catch (e: any) {
            err(e.message || 'Error al crear AI Tools');
        } finally {
            setSeedingTools(false);
        }
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

    const apiRoot = ((import.meta.env.VITE_API_URL as string) || 'http://localhost:4000/v1').replace(/\/v1\/?$/, '');

    const startOAuth = (integration: ExternalIntegration) => {
        const tenantId = localStorage.getItem('wabee_orgId') || '';
        const provider = integration.provider.toLowerCase();
        const base = provider === 'hubspot' ? `${apiRoot}/oauth/hubspot/start` : `${apiRoot}/oauth/crm/${provider}/start`;
        window.location.href = `${base}?integration_id=${integration.id}&tenant_id=${tenantId}`;
    };

    const handleSyncPull = async (integration: ExternalIntegration) => {
        setSyncing(true);
        try {
            const result = await integrationsApi.syncPull(integration.id);
            ok(`Sync completado: ${result.imported} importados, ${result.updated} actualizados, ${result.skipped} omitidos`);
            await loadDetail(integration.id);
        } catch (e: any) {
            err(e.message || 'Error al sincronizar contactos');
        } finally {
            setSyncing(false);
        }
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
        } catch (e: any) {
            err(e.message);
        }
    };

    return (
        <div className="flex h-full flex-col overflow-hidden bg-[var(--bg-surface)]">
            <div className="shrink-0 border-b border-[var(--border-default)] px-4 pb-4 pt-4 sm:px-6 sm:pt-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <h1 className={`${T.pageTitle} text-2xl`}>Integraciones CRM</h1>
                        <p className={`${T.cardSubtitle} mt-1 max-w-xl text-xs`}>
                            Conecta WABEE con tu CRM para sincronizar contactos, leads y deals automáticamente.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {integrations.some((integration) => integration.status === 'CONNECTED') && (
                            <button
                                onClick={seedAiTools}
                                disabled={seedingTools}
                                title="Crea las 3 AI Tools de CRM en tu biblioteca para que la IA pueda buscar contactos y crear leads automáticamente"
                                className="rounded-xl border border-[var(--border-default)] px-3 py-3 text-xs font-bold uppercase tracking-widest transition hover:bg-[var(--bg-card)] disabled:opacity-40 sm:py-2"
                            >
                                {seedingTools ? 'Creando...' : '⚡ Activar AI Tools CRM'}
                            </button>
                        )}

                        <button
                            onClick={() => setShowCreate(true)}
                            className="rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-xs font-bold uppercase tracking-widest text-white transition hover:opacity-90 sm:py-2"
                        >
                            + Conectar CRM
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
                <div className="shrink-0 overflow-y-auto border-b border-[var(--border-default)] lg:w-72 lg:border-b-0 lg:border-r">
                    {loading && <p className={`${T.cardSubtitle} p-6 text-center text-xs`}>Cargando...</p>}

                    {!loading && integrations.length === 0 && (
                        <div className="p-6 text-center">
                            <p className={`${T.cardSubtitle} mb-3 text-xs`}>Sin integraciones CRM.</p>
                            <button onClick={() => setShowCreate(true)} className="text-xs text-[var(--brand-primary)] hover:underline">
                                Conectar el primero
                            </button>
                        </div>
                    )}

                    {integrations.map((integration) => (
                        <button
                            key={integration.id}
                            onClick={() => loadDetail(integration.id)}
                            className={`w-full border-b border-[var(--border-default)] px-4 py-3 text-left transition hover:bg-[var(--bg-card)] ${
                                selected?.id === integration.id ? 'border-l-2 border-l-[var(--brand-primary)] bg-[var(--bg-card)]' : ''
                            }`}
                        >
                            <div className="flex items-center justify-between gap-2">
                                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${PROVIDER_COLORS[integration.provider]}`}>
                                    {PROVIDER_LABELS[integration.provider]}
                                </span>
                                <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${STATUS_STYLE[integration.status] ?? ''}`}>
                                    {integration.status}
                                </span>
                            </div>
                            <p className={`${T.menuText} mt-1 truncate text-xs`}>{integration.name}</p>
                            {integration._count && <p className={`${T.helperText} text-[10px]`}>{integration._count.syncLogs} eventos</p>}
                        </button>
                    ))}
                </div>

                {!selected ? (
                    <div className="flex flex-1 items-center justify-center p-6">
                        <p className={`${T.cardSubtitle} text-center text-sm`}>Selecciona una integración para ver detalles.</p>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                        <div className="space-y-4 sm:space-y-6">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h2 className={`${T.cardTitle} text-sm`}>{selected.name}</h2>
                                        <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${STATUS_STYLE[selected.status]}`}>
                                            {selected.status}
                                        </span>
                                    </div>
                                    <p className={`${T.helperText} mt-1 text-[10px]`}>Proveedor: {PROVIDER_LABELS[selected.provider]}</p>
                                    {selected.accounts?.[0] && (
                                        <p className={`${T.helperText} text-[10px]`}>
                                            Último token: {new Date(selected.accounts[0].updatedAt).toLocaleString()}
                                            {selected.accounts[0].tokenExpiresAt &&
                                                ` · Expira: ${new Date(selected.accounts[0].tokenExpiresAt).toLocaleString()}`}
                                        </p>
                                    )}
                                </div>

                                <div className="flex shrink-0 gap-2">
                                    {selected.status === 'CONNECTED' && (
                                        <button
                                            onClick={() => handleSyncPull(selected)}
                                            disabled={syncing}
                                            className="rounded-lg bg-[var(--brand-primary)]/10 px-3 py-2 text-xs font-bold uppercase tracking-widest text-[var(--brand-primary)] transition hover:bg-[var(--brand-primary)]/20 disabled:opacity-40"
                                        >
                                            {syncing ? 'Sincronizando...' : 'Sincronizar'}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleDelete(selected)}
                                        className="rounded-lg bg-red-500/10 px-3 py-2 text-xs font-bold uppercase tracking-widest text-red-400 transition hover:bg-red-500/20"
                                    >
                                        Desconectar
                                    </button>
                                </div>
                            </div>

                            {(selected.status === 'DISCONNECTED' || selected.status === 'EXPIRED') && (
                                <div className="space-y-3 rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-4">
                                    <p className={`${T.cardSubtitle} text-xs`}>
                                        {selected.status === 'EXPIRED'
                                            ? `El token expiró. Vuelve a autenticarte para restablecer la conexión con ${PROVIDER_LABELS[selected.provider]}.`
                                            : `Conecta tu cuenta de ${PROVIDER_LABELS[selected.provider]} para activar la sincronización automática.`}
                                    </p>

                                    {(selected.provider === 'HUBSPOT' || selected.provider === 'PIPEDRIVE') && (
                                        <div className="flex flex-col gap-2 sm:flex-row">
                                            <input
                                                type="password"
                                                value={tokenInput}
                                                onChange={(e) => setTokenInput(e.target.value)}
                                                placeholder={selected.provider === 'HUBSPOT' ? 'pat-na1-xxxxxxxx...' : 'API key de Pipedrive'}
                                                className={`flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-xs ${T.inputText} focus:border-[var(--brand-primary)] focus:outline-none`}
                                            />
                                            <button
                                                onClick={() => saveToken(selected)}
                                                disabled={!tokenInput.trim() || savingToken}
                                                className={`shrink-0 rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-widest text-white transition hover:opacity-90 disabled:opacity-40 ${
                                                    selected.provider === 'HUBSPOT' ? 'bg-orange-500' : 'bg-green-600'
                                                }`}
                                            >
                                                {savingToken ? 'Guardando...' : 'Conectar'}
                                            </button>
                                        </div>
                                    )}

                                    {['ZOHO', 'SALESFORCE', 'DYNAMICS365'].includes(selected.provider) && (
                                        <button
                                            onClick={() => startOAuth(selected)}
                                            className={`w-full rounded-xl py-2 text-xs font-bold uppercase tracking-widest text-white transition hover:opacity-90 ${
                                                selected.provider === 'ZOHO'
                                                    ? 'bg-red-600'
                                                    : selected.provider === 'SALESFORCE'
                                                      ? 'bg-blue-600'
                                                      : 'bg-purple-600'
                                            }`}
                                        >
                                            Conectar con {PROVIDER_LABELS[selected.provider]} vía OAuth
                                        </button>
                                    )}
                                </div>
                            )}

                            <div className="flex gap-1 overflow-x-auto border-b border-[var(--border-default)]">
                                {(['logs', 'mappings'] as const).map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={`-mb-px shrink-0 border-b-2 px-4 py-2 text-xs font-bold uppercase tracking-widest transition ${
                                            activeTab === tab
                                                ? 'border-[var(--brand-primary)] text-[var(--brand-primary)]'
                                                : 'border-transparent text-[var(--tx-helperText-color,#999)] hover:text-[var(--tx-cardTitle-color)]'
                                        }`}
                                    >
                                        {tab === 'logs' ? 'Historial de Sync' : 'Mapeo de Campos'}
                                    </button>
                                ))}
                            </div>

                            {activeTab === 'logs' && (
                                <div className="space-y-2">
                                    {logs.length === 0 && (
                                        <div className="flex flex-col items-center justify-center gap-2 py-12">
                                            <p className={`${T.cardSubtitle} text-center text-sm`}>Sin eventos de sincronización aún.</p>
                                            <p className={`${T.helperText} max-w-xs text-center text-xs`}>
                                                Los eventos aparecerán aquí cuando un contacto cambie a LEAD o CLIENTE.
                                            </p>
                                        </div>
                                    )}

                                    {logs.map((log) => {
                                        const contactLabel = log.meta?.name || log.meta?.phone || log.entityId || '—';
                                        const lifecycle = log.meta?.lifecycleStage as string | undefined;
                                        const isSuccess = log.status === 'SUCCESS';
                                        const isFailed = log.status === 'FAILED';

                                        return (
                                            <div
                                                key={log.id}
                                                className={`rounded-xl border p-4 ${isFailed ? 'border-red-500/30 bg-red-500/5' : 'border-[var(--border-default)] bg-[var(--bg-card)]'}`}
                                            >
                                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                    <div className="flex min-w-0 items-start gap-3">
                                                        <span
                                                            className={`mt-1 h-2 w-2 shrink-0 rounded-full ${isSuccess ? 'bg-[var(--brand-primary)]' : isFailed ? 'bg-red-500' : 'bg-yellow-400'}`}
                                                        />

                                                        <div className="min-w-0">
                                                            <p className={`${T.tableCell} truncate text-xs font-semibold`}>{contactLabel}</p>

                                                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                                                <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${SYNC_STATUS_STYLE[log.status]}`}>
                                                                    {log.status}
                                                                </span>
                                                                <span className={`rounded bg-[var(--bg-input)] px-1.5 py-0.5 text-[9px] uppercase ${T.helperText}`}>
                                                                    {log.entityType}
                                                                </span>
                                                                <span className={`rounded bg-[var(--bg-input)] px-1.5 py-0.5 text-[9px] uppercase ${T.helperText}`}>
                                                                    {log.operation}
                                                                </span>
                                                                <span className={`rounded bg-[var(--bg-input)] px-1.5 py-0.5 text-[9px] ${T.helperText}`}>
                                                                    {log.direction === 'PUSH' ? `Wabee → ${PROVIDER_LABELS[selected.provider]}` : `${PROVIDER_LABELS[selected.provider]} → Wabee`}
                                                                </span>
                                                                {lifecycle && (
                                                                    <span className="rounded bg-[var(--brand-primary)]/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-[var(--brand-primary)]">
                                                                        {lifecycle}
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {log.errorMessage && (
                                                                <p className="mt-1 text-[10px] text-red-400">{log.errorMessage}</p>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <span className={`${T.helperText} shrink-0 text-[10px]`}>
                                                        {new Date(log.createdAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {activeTab === 'mappings' && (
                                <div>
                                    {!selected.fieldMappings || selected.fieldMappings.length === 0 ? (
                                        <p className={`${T.cardSubtitle} py-6 text-center text-xs`}>
                                            Sin mapeos configurados. Los mapeos se configurarán al implementar el conector.
                                        </p>
                                    ) : (
                                        <div className="space-y-2">
                                            {selected.fieldMappings.map((mapping) => (
                                                <div
                                                    key={mapping.id}
                                                    className="flex flex-col gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-3 text-xs sm:flex-row sm:items-center"
                                                >
                                                    <span className={`${T.helperText} shrink-0`}>{mapping.entityType}</span>
                                                    <span className={T.tableCell}>{mapping.wabeeField}</span>
                                                    <span className={T.helperText}>→</span>
                                                    <span className={T.tableCell}>{mapping.externalField}</span>
                                                    <span className={`${T.helperText} sm:ml-auto`}>{mapping.direction}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {showCreate && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
                    <div className="w-full rounded-t-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 shadow-2xl sm:max-w-md sm:rounded-2xl sm:p-6">
                        <div className="space-y-4">
                            <h2 className={`${T.cardTitle} text-sm`}>Conectar CRM</h2>

                            <div className="space-y-3">
                                <div>
                                    <label className={`${T.labelText} mb-1 block text-[10px]`}>Proveedor *</label>
                                    <select
                                        value={form.provider}
                                        onChange={(e) => setForm((current) => ({ ...current, provider: e.target.value as CrmProvider }))}
                                        className={`w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-xs ${T.inputText} focus:border-[var(--brand-primary)] focus:outline-none`}
                                    >
                                        {(Object.entries(PROVIDER_LABELS) as [CrmProvider, string][]).map(([value, label]) => (
                                            <option key={value} value={value}>
                                                {label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className={`${T.labelText} mb-1 block text-[10px]`}>Nombre de referencia *</label>
                                    <input
                                        type="text"
                                        value={form.name}
                                        onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
                                        placeholder="Ej: HubSpot Producción"
                                        className={`w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-xs ${T.inputText} focus:border-[var(--brand-primary)] focus:outline-none`}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                <button
                                    onClick={() => setShowCreate(false)}
                                    className={`rounded-xl border border-[var(--border-default)] px-4 py-3 text-xs transition hover:bg-[var(--bg-input)] ${T.buttonText}`}
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleCreate}
                                    disabled={!form.name.trim()}
                                    className="rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-xs font-bold uppercase tracking-widest text-white transition hover:opacity-90 disabled:opacity-40"
                                >
                                    Crear
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
