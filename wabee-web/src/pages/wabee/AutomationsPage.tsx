import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { automationsApi, AutomationFlow, AutomationTrigger, AutomationFlowVersion } from '@/api/wabee/automations.api';
import { useToast } from '@/context/ToastContext';
import { useDialog } from '@/context/DialogContext';
import { textTokens as T } from '@/lib/text-tokens';

const TRIGGER_LABELS: Record<AutomationTrigger, string> = {
    CONVERSATION_STARTED: 'Conversación iniciada',
    KEYWORD_MATCH: 'Palabra clave detectada',
    CONTACT_CREATED: 'Contacto creado',
    CONTACT_LIFECYCLE_CHANGED: 'Cambio de ciclo de vida',
    CAMPAIGN_REPLY: 'Respuesta a campaña',
    INBOUND_MESSAGE: 'Mensaje entrante',
};

const STATUS_STYLE: Record<string, string> = {
    ACTIVE: 'bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]',
    PAUSED: 'bg-yellow-500/20 text-yellow-500',
    DRAFT: 'bg-[var(--border-default)] text-[var(--tx-helperText-color,#999)]',
    ARCHIVED: 'bg-red-500/10 text-red-400',
};

const DEFAULT_STEPS_JSON = JSON.stringify(
    {
        startNodeId: 'welcome',
        nodes: {
            welcome: {
                id: 'welcome',
                type: 'message',
                text: 'Hola, bienvenido a nuestro asistente.',
                next: 'ask_name',
            },
            ask_name: {
                id: 'ask_name',
                type: 'question',
                text: '¿Cuál es tu nombre?',
                field: 'name',
                next: 'end',
            },
            end: { id: 'end', type: 'end' },
        },
    },
    null,
    2
);

export default function AutomationsPage() {
    const [flows, setFlows] = useState<AutomationFlow[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<AutomationFlow | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [stepsJson, setStepsJson] = useState(DEFAULT_STEPS_JSON);
    const [jsonError, setJsonError] = useState<string | null>(null);
    const [publishing, setPublishing] = useState(false);

    const [form, setForm] = useState({
        name: '',
        description: '',
        trigger: 'CONVERSATION_STARTED' as AutomationTrigger,
    });

    const { success: toastSuccess, error: toastError } = useToast();
    const navigate = useNavigate();
    const { confirm } = useDialog();

    useEffect(() => {
        load();
    }, []);

    const load = async () => {
        setLoading(true);
        try {
            const data = await automationsApi.list();
            setFlows(data);
            if (data.length === 1 && !selected) {
                await loadFlow(data[0].id);
            }
        } catch {
            // silent
        }
        setLoading(false);
    };

    const loadFlow = async (id: string) => {
        try {
            const data = await automationsApi.get(id);
            setSelected(data);
            const active = data.versions?.find((version) => version.isActive);
            setStepsJson(active ? JSON.stringify(active.stepsJson, null, 2) : DEFAULT_STEPS_JSON);
            setJsonError(null);
        } catch {
            // silent
        }
    };

    const handleCreate = async () => {
        if (!form.name.trim()) return;

        try {
            await automationsApi.create({
                name: form.name,
                description: form.description || undefined,
                trigger: form.trigger,
            });
            setForm({ name: '', description: '', trigger: 'CONVERSATION_STARTED' });
            setShowCreate(false);
            await load();
            toastSuccess('Automatización creada');
        } catch (e: any) {
            toastError(e.message);
        }
    };

    const handlePublish = async () => {
        if (!selected) return;

        try {
            JSON.parse(stepsJson);
            setJsonError(null);
        } catch (e: any) {
            setJsonError(`JSON inválido: ${e.message}`);
            return;
        }

        setPublishing(true);
        try {
            await automationsApi.publish(selected.id, JSON.parse(stepsJson));
            await loadFlow(selected.id);
            await load();
            toastSuccess('Versión publicada y flujo activado');
        } catch (e: any) {
            toastError(e.message);
        }
        setPublishing(false);
    };

    const handleToggle = async (flow: AutomationFlow) => {
        try {
            if (flow.status === 'ACTIVE') {
                await automationsApi.pause(flow.id);
                toastSuccess('Automatización pausada');
            } else {
                await automationsApi.activate(flow.id);
                toastSuccess('Automatización activada');
            }

            await load();
            if (selected?.id === flow.id) {
                await loadFlow(flow.id);
            }
        } catch (e: any) {
            toastError(e.message);
        }
    };

    const handleDelete = async (flow: AutomationFlow) => {
        const ok = await confirm({
            title: 'Eliminar automatización',
            description: `¿Eliminar "${flow.name}"? Se eliminarán todas sus versiones.`,
            isDestructive: true,
            confirmText: 'Eliminar',
        });

        if (!ok) return;

        try {
            await automationsApi.delete(flow.id);
            if (selected?.id === flow.id) {
                setSelected(null);
            }
            await load();
            toastSuccess('Automatización eliminada');
        } catch (e: any) {
            toastError(e.message);
        }
    };

    return (
        <div className="flex h-full flex-col overflow-hidden bg-[var(--bg-surface)]">
            <div className="shrink-0 border-b border-[var(--border-default)] px-4 pb-4 pt-4 sm:px-6 sm:pt-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                        <h1 className={`${T.pageTitle} text-2xl`}>Automatizaciones</h1>
                        <p className={`${T.cardSubtitle} mt-1 max-w-xl text-xs`}>
                            Crea flujos de conversación automáticos con triggers, preguntas y condiciones.
                        </p>
                    </div>
                    <button
                        onClick={() => setShowCreate(true)}
                        className="w-full rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-xs font-bold uppercase tracking-widest text-white transition hover:opacity-90 sm:w-auto sm:py-2"
                    >
                        + Nueva
                    </button>
                </div>
            </div>

            <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
                <div className="shrink-0 overflow-y-auto border-b border-[var(--border-default)] lg:w-80 lg:border-b-0 lg:border-r">
                    {loading && <p className={`${T.cardSubtitle} p-6 text-center text-xs`}>Cargando...</p>}

                    {!loading && flows.length === 0 && (
                        <div className="p-6 text-center">
                            <p className={`${T.cardSubtitle} mb-3 text-xs`}>Sin automatizaciones aún.</p>
                            <button onClick={() => setShowCreate(true)} className="text-xs text-[var(--brand-primary)] hover:underline">
                                Crear la primera
                            </button>
                        </div>
                    )}

                    {flows.map((flow) => (
                        <button
                            key={flow.id}
                            onClick={() => loadFlow(flow.id)}
                            className={`w-full border-b border-[var(--border-default)] px-4 py-3 text-left transition hover:bg-[var(--bg-card)] ${
                                selected?.id === flow.id ? 'border-l-2 border-l-[var(--brand-primary)] bg-[var(--bg-card)]' : ''
                            }`}
                        >
                            <div className="flex items-center justify-between gap-2">
                                <p className={`${T.menuText} truncate text-sm`}>{flow.name}</p>
                                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold ${STATUS_STYLE[flow.status] ?? STATUS_STYLE.DRAFT}`}>
                                    {flow.status}
                                </span>
                            </div>
                            <p className={`${T.helperText} mt-0.5 text-[10px]`}>{TRIGGER_LABELS[flow.trigger]}</p>
                        </button>
                    ))}
                </div>

                {!selected ? (
                    <div className="flex flex-1 items-center justify-center p-6">
                        <p className={`${T.cardSubtitle} text-center text-sm`}>Selecciona una automatización para editarla.</p>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                        <div className="space-y-4 sm:space-y-6">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div className="min-w-0">
                                    <h2 className={`${T.cardTitle} text-sm`}>{selected.name}</h2>
                                    {selected.description && <p className={`${T.cardSubtitle} mt-1 text-xs`}>{selected.description}</p>}
                                    <p className={`${T.helperText} mt-1 text-[10px]`}>Trigger: {TRIGGER_LABELS[selected.trigger]}</p>
                                </div>

                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:flex">
                                    <button
                                        onClick={() => navigate(`/dashboard/wabee/automations/${selected.id}/builder`)}
                                        className="rounded-lg bg-[var(--brand-primary)]/10 px-3 py-2 text-xs font-bold uppercase tracking-widest text-[var(--brand-primary)] transition hover:bg-[var(--brand-primary)]/20"
                                    >
                                        Builder visual
                                    </button>
                                    <button
                                        onClick={() => handleToggle(selected)}
                                        className={`rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-widest transition ${
                                            selected.status === 'ACTIVE'
                                                ? 'bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30'
                                                : 'bg-[var(--brand-primary)]/20 text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/30'
                                        }`}
                                    >
                                        {selected.status === 'ACTIVE' ? 'Pausar' : 'Activar'}
                                    </button>
                                    <button
                                        onClick={() => handleDelete(selected)}
                                        className="rounded-lg bg-red-500/10 px-3 py-2 text-xs font-bold uppercase tracking-widest text-red-400 transition hover:bg-red-500/20"
                                    >
                                        Eliminar
                                    </button>
                                </div>
                            </div>

                            {selected.versions && selected.versions.length > 0 && (
                                <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4">
                                    <h3 className={`${T.cardTitle} mb-3 text-xs`}>Versiones</h3>
                                    <div className="space-y-2">
                                        {selected.versions.map((version: AutomationFlowVersion) => (
                                            <div
                                                key={version.id}
                                                className="flex flex-col gap-2 rounded-lg border border-[var(--border-default)]/70 px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className={T.tableCell}>v{version.version}</span>
                                                    {version.isActive && (
                                                        <span className="rounded bg-[var(--brand-primary)]/20 px-1.5 py-0.5 text-[9px] font-bold text-[var(--brand-primary)]">
                                                            ACTIVA
                                                        </span>
                                                    )}
                                                </div>
                                                <span className={`${T.helperText} text-[10px]`}>
                                                    {version.publishedAt ? new Date(version.publishedAt).toLocaleString() : 'Draft'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4">
                                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <h3 className={`${T.cardTitle} text-xs`}>Editor de pasos (JSON)</h3>
                                        <p className={`${T.helperText} mt-1 text-[10px]`}>
                                            Tipos de nodo: <code>message</code> · <code>question</code> · <code>condition</code> · <code>assign</code> · <code>webhook</code> · <code>end</code>
                                        </p>
                                    </div>
                                    <button
                                        onClick={handlePublish}
                                        disabled={publishing}
                                        className="w-full rounded-lg bg-[var(--brand-primary)] px-3 py-2 text-xs font-bold uppercase tracking-widest text-white transition hover:opacity-90 disabled:opacity-40 sm:w-auto"
                                    >
                                        {publishing ? 'Publicando...' : 'Publicar versión'}
                                    </button>
                                </div>

                                {jsonError && (
                                    <p className="mb-2 rounded border border-red-500/20 bg-red-500/10 p-2 text-xs text-red-400">{jsonError}</p>
                                )}

                                <textarea
                                    value={stepsJson}
                                    onChange={(e) => setStepsJson(e.target.value)}
                                    rows={24}
                                    spellCheck={false}
                                    className={`min-h-[320px] w-full resize-y rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 font-mono text-xs ${T.inputText} focus:border-[var(--brand-primary)] focus:outline-none sm:resize-none`}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {showCreate && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
                    <div className="w-full rounded-t-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 shadow-2xl sm:max-w-md sm:rounded-2xl sm:p-6">
                        <div className="space-y-4">
                            <h2 className={`${T.cardTitle} text-sm`}>Nueva automatización</h2>

                            <div className="space-y-3">
                                <div>
                                    <label className={`${T.labelText} mb-1 block text-[10px]`}>Nombre *</label>
                                    <input
                                        type="text"
                                        value={form.name}
                                        onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
                                        placeholder="Ej: Bienvenida a leads"
                                        className={`w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-xs ${T.inputText} focus:border-[var(--brand-primary)] focus:outline-none`}
                                    />
                                </div>

                                <div>
                                    <label className={`${T.labelText} mb-1 block text-[10px]`}>Descripción</label>
                                    <input
                                        type="text"
                                        value={form.description}
                                        onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))}
                                        placeholder="Opcional"
                                        className={`w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-xs ${T.inputText} focus:border-[var(--brand-primary)] focus:outline-none`}
                                    />
                                </div>

                                <div>
                                    <label className={`${T.labelText} mb-1 block text-[10px]`}>Trigger *</label>
                                    <select
                                        value={form.trigger}
                                        onChange={(e) => setForm((current) => ({ ...current, trigger: e.target.value as AutomationTrigger }))}
                                        className={`w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-xs ${T.inputText} focus:border-[var(--brand-primary)] focus:outline-none`}
                                    >
                                        {(Object.entries(TRIGGER_LABELS) as [AutomationTrigger, string][]).map(([value, label]) => (
                                            <option key={value} value={value}>
                                                {label}
                                            </option>
                                        ))}
                                    </select>
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
