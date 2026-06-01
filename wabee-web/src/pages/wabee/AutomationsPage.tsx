import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { automationsApi, AutomationFlow, AutomationTrigger, AutomationFlowVersion } from '@/api/wabee/automations.api';
import { useToast } from '@/context/ToastContext';
import { useDialog } from '@/context/DialogContext';
import { textTokens as T } from '@/lib/text-tokens';

const TRIGGER_LABELS: Record<AutomationTrigger, string> = {
    CONVERSATION_STARTED:      'Conversación iniciada',
    KEYWORD_MATCH:             'Palabra clave detectada',
    CONTACT_CREATED:           'Contacto creado',
    CONTACT_LIFECYCLE_CHANGED: 'Cambio de ciclo de vida',
    CAMPAIGN_REPLY:            'Respuesta a campaña',
    INBOUND_MESSAGE:           'Mensaje entrante',
};

const STATUS_STYLE: Record<string, string> = {
    ACTIVE:   'bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]',
    PAUSED:   'bg-yellow-500/20 text-yellow-500',
    DRAFT:    'bg-[var(--border-default)] text-[var(--tx-helperText-color,#999)]',
    ARCHIVED: 'bg-red-500/10 text-red-400',
};

const DEFAULT_STEPS_JSON = JSON.stringify({
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
}, null, 2);

export default function AutomationsPage() {
    const [flows, setFlows] = useState<AutomationFlow[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<AutomationFlow | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [stepsJson, setStepsJson] = useState(DEFAULT_STEPS_JSON);
    const [jsonError, setJsonError] = useState<string | null>(null);
    const [publishing, setPublishing] = useState(false);

    const [form, setForm] = useState({ name: '', description: '', trigger: 'CONVERSATION_STARTED' as AutomationTrigger });

    const { success: toastSuccess, error: toastError } = useToast();
    const navigate = useNavigate();
    const { confirm } = useDialog();

    useEffect(() => { load(); }, []);

    const load = async () => {
        setLoading(true);
        try {
            const data = await automationsApi.list();
            setFlows(data);
        } catch { /* silent */ }
        setLoading(false);
    };

    const loadFlow = async (id: string) => {
        try {
            const data = await automationsApi.get(id);
            setSelected(data);
            const active = data.versions?.find(v => v.isActive);
            setStepsJson(active ? JSON.stringify(active.stepsJson, null, 2) : DEFAULT_STEPS_JSON);
            setJsonError(null);
        } catch { /* silent */ }
    };

    const handleCreate = async () => {
        if (!form.name.trim()) return;
        try {
            await automationsApi.create({ name: form.name, description: form.description || undefined, trigger: form.trigger });
            setForm({ name: '', description: '', trigger: 'CONVERSATION_STARTED' });
            setShowCreate(false);
            await load();
            toastSuccess('Automatización creada');
        } catch (e: any) { toastError(e.message); }
    };

    const handlePublish = async () => {
        if (!selected) return;
        try {
            JSON.parse(stepsJson);
            setJsonError(null);
        } catch (e: any) {
            setJsonError('JSON inválido: ' + e.message);
            return;
        }
        setPublishing(true);
        try {
            await automationsApi.publish(selected.id, JSON.parse(stepsJson));
            await loadFlow(selected.id);
            await load();
            toastSuccess('Versión publicada y flujo activado');
        } catch (e: any) { toastError(e.message); }
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
            if (selected?.id === flow.id) await loadFlow(flow.id);
        } catch (e: any) { toastError(e.message); }
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
            if (selected?.id === flow.id) setSelected(null);
            await load();
            toastSuccess('Automatización eliminada');
        } catch (e: any) { toastError(e.message); }
    };

    return (
        <div className="h-full flex flex-col bg-[var(--bg-surface)] overflow-hidden">

            {/* Header */}
            <div className="shrink-0 px-6 pt-6 pb-4 border-b border-[var(--border-default)]">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className={`${T.pageTitle} text-2xl`}>Automatizaciones</h1>
                        <p className={`${T.cardSubtitle} text-xs mt-1`}>Crea flujos de conversación automáticos con triggers, preguntas y condiciones.</p>
                    </div>
                    <button
                        onClick={() => setShowCreate(true)}
                        className="px-4 py-2 rounded-xl bg-[var(--brand-primary)] text-white text-xs font-bold uppercase tracking-widest hover:opacity-90 transition"
                    >
                        + Nueva
                    </button>
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 flex overflow-hidden">

                {/* Left: flow list */}
                <div className="w-80 shrink-0 border-r border-[var(--border-default)] overflow-y-auto">
                    {loading && <p className={`${T.cardSubtitle} text-xs p-6 text-center`}>Cargando...</p>}
                    {!loading && flows.length === 0 && (
                        <div className="p-6 text-center">
                            <p className={`${T.cardSubtitle} text-xs mb-3`}>Sin automatizaciones aún.</p>
                            <button onClick={() => setShowCreate(true)} className="text-xs text-[var(--brand-primary)] hover:underline">Crear la primera</button>
                        </div>
                    )}
                    {flows.map(flow => (
                        <button
                            key={flow.id}
                            onClick={() => loadFlow(flow.id)}
                            className={`w-full text-left px-4 py-3 border-b border-[var(--border-default)] hover:bg-[var(--bg-card)] transition ${selected?.id === flow.id ? 'bg-[var(--bg-card)] border-l-2 border-l-[var(--brand-primary)]' : ''}`}
                        >
                            <div className="flex items-center justify-between gap-2">
                                <p className={`${T.menuText} text-sm truncate`}>{flow.name}</p>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 ${STATUS_STYLE[flow.status] ?? STATUS_STYLE.DRAFT}`}>
                                    {flow.status}
                                </span>
                            </div>
                            <p className={`${T.helperText} text-[10px] mt-0.5`}>{TRIGGER_LABELS[flow.trigger]}</p>
                        </button>
                    ))}
                </div>

                {/* Right: flow detail + editor */}
                {!selected ? (
                    <div className="flex-1 flex items-center justify-center">
                        <p className={`${T.cardSubtitle} text-sm`}>Selecciona una automatización para editarla</p>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">

                        {/* Info + actions */}
                        <div className="flex items-start justify-between">
                            <div>
                                <h2 className={`${T.cardTitle} text-sm`}>{selected.name}</h2>
                                {selected.description && <p className={`${T.cardSubtitle} text-xs mt-1`}>{selected.description}</p>}
                                <p className={`${T.helperText} text-[10px] mt-1`}>Trigger: {TRIGGER_LABELS[selected.trigger]}</p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => navigate(`/dashboard/wabee/automations/${selected.id}/builder`)}
                                    className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/20 transition"
                                >
                                    Builder Visual
                                </button>
                                <button
                                    onClick={() => handleToggle(selected)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition ${
                                        selected.status === 'ACTIVE'
                                            ? 'bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30'
                                            : 'bg-[var(--brand-primary)]/20 text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/30'
                                    }`}
                                >
                                    {selected.status === 'ACTIVE' ? 'Pausar' : 'Activar'}
                                </button>
                                <button
                                    onClick={() => handleDelete(selected)}
                                    className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest bg-red-500/10 text-red-400 hover:bg-red-500/20 transition"
                                >
                                    Eliminar
                                </button>
                            </div>
                        </div>

                        {/* Versions */}
                        {selected.versions && selected.versions.length > 0 && (
                            <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-4">
                                <h3 className={`${T.cardTitle} text-xs mb-3`}>Versiones</h3>
                                <div className="space-y-2">
                                    {selected.versions.map((v: AutomationFlowVersion) => (
                                        <div key={v.id} className="flex items-center justify-between text-xs">
                                            <span className={`${T.tableCell}`}>v{v.version}</span>
                                            {v.isActive && (
                                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--brand-primary)]/20 text-[var(--brand-primary)] font-bold">ACTIVA</span>
                                            )}
                                            <span className={`${T.helperText} text-[10px]`}>
                                                {v.publishedAt ? new Date(v.publishedAt).toLocaleString() : 'Draft'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Steps JSON editor */}
                        <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-4">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className={`${T.cardTitle} text-xs`}>Editor de pasos (JSON)</h3>
                                <button
                                    onClick={handlePublish}
                                    disabled={publishing}
                                    className="px-3 py-1.5 rounded-lg bg-[var(--brand-primary)] text-white text-xs font-bold uppercase tracking-widest disabled:opacity-40 hover:opacity-90 transition"
                                >
                                    {publishing ? 'Publicando...' : 'Publicar versión'}
                                </button>
                            </div>
                            <p className={`${T.helperText} text-[10px] mb-3`}>
                                Tipos de nodo: <code>message</code> · <code>question</code> · <code>condition</code> · <code>assign</code> · <code>webhook</code> · <code>end</code>
                            </p>
                            {jsonError && (
                                <p className="mb-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded p-2">{jsonError}</p>
                            )}
                            <textarea
                                value={stepsJson}
                                onChange={e => setStepsJson(e.target.value)}
                                rows={24}
                                spellCheck={false}
                                className={`w-full rounded-lg bg-[var(--bg-input)] border border-[var(--border-default)] px-3 py-2 text-xs font-mono ${T.inputText} focus:outline-none focus:border-[var(--brand-primary)] resize-none`}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Create modal */}
            {showCreate && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
                        <h2 className={`${T.cardTitle} text-sm`}>Nueva automatización</h2>

                        <div className="space-y-3">
                            <div>
                                <label className={`${T.labelText} text-[10px] block mb-1`}>Nombre *</label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    placeholder="Ej: Bienvenida a leads"
                                    className={`w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border-default)] text-xs ${T.inputText} focus:outline-none focus:border-[var(--brand-primary)]`}
                                />
                            </div>

                            <div>
                                <label className={`${T.labelText} text-[10px] block mb-1`}>Descripción</label>
                                <input
                                    type="text"
                                    value={form.description}
                                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                    placeholder="Opcional"
                                    className={`w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border-default)] text-xs ${T.inputText} focus:outline-none focus:border-[var(--brand-primary)]`}
                                />
                            </div>

                            <div>
                                <label className={`${T.labelText} text-[10px] block mb-1`}>Trigger *</label>
                                <select
                                    value={form.trigger}
                                    onChange={e => setForm(f => ({ ...f, trigger: e.target.value as AutomationTrigger }))}
                                    className={`w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border-default)] text-xs ${T.inputText} focus:outline-none focus:border-[var(--brand-primary)]`}
                                >
                                    {(Object.entries(TRIGGER_LABELS) as [AutomationTrigger, string][]).map(([val, label]) => (
                                        <option key={val} value={val}>{label}</option>
                                    ))}
                                </select>
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
