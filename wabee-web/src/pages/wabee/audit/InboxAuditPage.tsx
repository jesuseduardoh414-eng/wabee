import { useState, useEffect } from 'react';
import { inboxAuditApi, AttentionSummary, AttentionChatDetail, InboxAuditEvent, AttentionFilters } from '@/api/wabee/audit.api';
import { getChannels, Channel } from '@/api/wabee/whatsapp.api';
import { T, S } from '@/lib/text-tokens';

function fmtMs(ms: number | null): string {
    if (ms == null) return '—';
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
    return `${(ms / 3600000).toFixed(1)}h`;
}

function fmtDate(d: string | null): string {
    if (!d) return '—';
    return new Date(d).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
}

const EVENT_LABELS: Record<string, string> = {
    THREAD_TAKEN: 'Tomado',
    HUMAN_MESSAGE_SENT: 'Mensaje enviado',
    THREAD_ASSIGNED: 'Asignado',
    THREAD_REASSIGNED: 'Reasignado',
    THREAD_UNASSIGNED: 'Liberado',
    THREAD_CLOSED: 'Cerrado',
    THREAD_REOPENED: 'Reabierto',
    INTERNAL_NOTE_ADDED: 'Nota interna',
    AI_HANDOFF_TO_HUMAN: 'IA→Humano',
    AI_MESSAGE_SENT: 'Msg IA',
    THREAD_RESOLVED: 'Resuelto',
    TEMPLATE_SENT: 'Template',
};

const CONV_LABEL: Record<string, string> = {
    ai_only: 'Solo IA',
    human_only: 'Solo humano',
    hybrid: 'Híbrido',
};

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
    return (
        <div className="flex min-h-[116px] flex-col gap-1 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4">
            <span className={`${T.kpiLabel} ${S.meta} opacity-70`}>{label}</span>
            <span className={`${T.kpiValue} ${S.headingLg} leading-none text-[var(--brand-primary)]`}>{value}</span>
            {sub && <span className={`${T.helperText} ${S.meta} opacity-50`}>{sub}</span>}
        </div>
    );
}

function TimelineModal({ threadId, onClose }: { threadId: string; onClose: () => void }) {
    const [events, setEvents] = useState<InboxAuditEvent[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        inboxAuditApi.getThreadTimeline(threadId).then(setEvents).catch(console.error).finally(() => setLoading(false));
    }, [threadId]);

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
            <div
                className="flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-[28px] border border-[var(--border-default)] bg-[var(--bg-elevated)] shadow-2xl sm:max-h-[80vh] sm:max-w-xl sm:rounded-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-[var(--border-default)] p-4">
                    <span className={`${T.sectionTitle} ${S.meta} text-[var(--brand-primary)]`}>
                        Timeline · {threadId.slice(0, 8)}...
                    </span>
                    <button onClick={onClose} className="text-lg leading-none text-[color:var(--tx-helperText-color)] transition-colors hover:text-[var(--brand-primary)]">
                        ×
                    </button>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto p-4">
                    {loading && <p className={`${T.helperText} ${S.body} py-8 text-center`}>Cargando...</p>}
                    {!loading && events.length === 0 && <p className={`${T.helperText} ${S.body} py-8 text-center`}>Sin eventos registrados.</p>}
                    {events.map((ev, i) => (
                        <div key={ev.id || i} className="flex items-start gap-3">
                            <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--brand-primary)]" />
                            <div className="flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className={`${T.statusText} ${S.meta} font-bold uppercase tracking-widest text-[var(--brand-primary)]`}>
                                        {EVENT_LABELS[ev.eventType] || ev.eventType}
                                    </span>
                                    {ev.actorDisplayName && <span className={`${T.helperText} ${S.meta} opacity-60`}>· {ev.actorDisplayName}</span>}
                                </div>
                                <p className={`${T.helperText} ${S.meta} opacity-50`}>{fmtDate(ev.occurredAt)}</p>
                                {ev.description && <p className={`${T.helperText} ${S.meta} mt-0.5 opacity-80`}>{ev.description}</p>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default function InboxAuditPage() {
    const [channels, setChannels] = useState<Channel[]>([]);
    const [summary, setSummary] = useState<AttentionSummary | null>(null);
    const [details, setDetails] = useState<AttentionChatDetail[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [selectedThread, setSelectedThread] = useState<string | null>(null);

    const today = new Date().toISOString().split('T')[0];
    const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

    const [filters, setFilters] = useState<AttentionFilters & { eventType?: string }>({
        from: monthAgo,
        to: today,
        limit: 50,
        offset: 0,
    });

    useEffect(() => {
        getChannels().then(setChannels).catch(console.error);
    }, []);

    function load(f = filters) {
        setLoading(true);
        Promise.all([inboxAuditApi.getSummary(f), inboxAuditApi.getDetails(f)])
            .then(([s, d]) => {
                setSummary(s);
                setDetails(d.items);
                setTotal(d.total);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }

    useEffect(() => {
        load();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    function handleFilter(key: string, val: string) {
        const next = { ...filters, [key]: val || undefined };
        setFilters(next as any);
    }

    function applyFilters() {
        load(filters as any);
    }

    const inputCls = `${T.inputText} ${S.meta} w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2.5 font-bold text-[color:var(--tx-inputText-color)] transition-colors focus:border-[var(--brand-primary)] focus:outline-none`;

    return (
        <div className="flex h-full flex-col gap-6 overflow-y-auto">
            <div>
                <h2 className={`${T.pageTitle} ${S.headingLg}`}>
                    Auditoría de <span className="text-[var(--brand-primary)]">Atención</span>
                </h2>
                <p className={`${T.pageSubtitle} ${S.meta} mt-1 uppercase tracking-widest opacity-50`}>
                    Trazabilidad operativa de agentes en el inbox
                </p>
            </div>

            <div className="rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-card)] p-4 sm:p-5">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="flex flex-col gap-1">
                        <label className={`${T.labelText} ${S.meta} opacity-50`}>Desde</label>
                        <input type="date" value={filters.from || ''} onChange={(e) => handleFilter('from', e.target.value)} className={inputCls} />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className={`${T.labelText} ${S.meta} opacity-50`}>Hasta</label>
                        <input type="date" value={filters.to || ''} onChange={(e) => handleFilter('to', e.target.value)} className={inputCls} />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className={`${T.labelText} ${S.meta} opacity-50`}>Canal</label>
                        <select value={filters.channelId || ''} onChange={(e) => handleFilter('channelId', e.target.value)} className={`${inputCls} cursor-pointer`}>
                            <option className="bg-[var(--bg-card)] text-[color:var(--tx-inputText-color)]" value="">Todos</option>
                            {channels.map((c) => (
                                <option className="bg-[var(--bg-card)] text-[color:var(--tx-inputText-color)]" key={c.id} value={c.id}>
                                    {c.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className={`${T.labelText} ${S.meta} opacity-50`}>Tipo de acción</label>
                        <select value={filters.eventType || ''} onChange={(e) => handleFilter('eventType', e.target.value)} className={`${inputCls} cursor-pointer`}>
                            <option className="bg-[var(--bg-card)] text-[color:var(--tx-inputText-color)]" value="">Todas</option>
                            {Object.entries(EVENT_LABELS).map(([k, v]) => (
                                <option className="bg-[var(--bg-card)] text-[color:var(--tx-inputText-color)]" key={k} value={k}>
                                    {v}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <button
                        onClick={applyFilters}
                        className={`${T.buttonPrimaryText} ${S.meta} rounded-xl bg-[var(--brand-primary)] px-4 py-2.5 shadow-lg transition-all hover:brightness-110 active:scale-95`}
                    >
                        {loading ? 'Cargando...' : 'Filtrar'}
                    </button>
                    <a
                        href={inboxAuditApi.exportCsv(filters as any)}
                        download="audit_attention.csv"
                        className={`${T.buttonText} ${S.meta} rounded-xl border border-[var(--border-default)] px-4 py-2.5 text-center text-[color:var(--tx-helperText-color)] shadow-sm transition-all hover:bg-[var(--bg-hover)]`}
                    >
                        ↓ CSV
                    </a>
                </div>
            </div>

            {summary && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <KpiCard label="Chats únicos" value={summary.uniqueChats} />
                    <KpiCard label="Mensajes enviados" value={summary.messagesSent} />
                    <KpiCard label="Chats tomados" value={summary.chatsTaken} />
                    <KpiCard label="Cerrados" value={summary.chatsClosed} />
                    <KpiCard label="Reasignados" value={summary.chatsReassigned} />
                    <KpiCard label="Liberados" value={summary.chatsReleased} />
                    <KpiCard label="1ª respuesta prom" value={fmtMs(summary.avgFirstResponseMs)} />
                    <KpiCard label="Resolución prom" value={fmtMs(summary.avgResolutionMs)} />
                    <KpiCard label="Cola→Agente prom" value={fmtMs(summary.avgHumanQueueResponseMs)} />
                </div>
            )}

            <div className="overflow-hidden rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-card)] shadow-xl">
                <div className="flex items-center justify-between border-b border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-3">
                    <span className={`${T.sectionTitle} ${S.meta} text-[color:var(--tx-helperText-color)]`}>
                        Detalle de chats — {total} registros
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[1100px] text-[color:var(--tx-helperText-color)]">
                        <thead className="bg-[var(--bg-elevated)]">
                            <tr className="border-b border-[var(--border-default)] text-[color:var(--tx-tableHeader-color)]">
                                {['Contacto', 'Canal', 'Apertura', '1ª intervención', 'Últ. actividad', 'Estado', 'Msgs', 'IA→H', 'Tipo', 'Acciones', ''].map((h) => (
                                    <th key={h} className={`${T.tableHeader} ${S.meta} px-3 py-2 text-left opacity-70`}>
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {details.length === 0 && (
                                <tr>
                                    <td colSpan={11} className={`${T.helperText} ${S.body} py-10 text-center opacity-50`}>
                                        Sin datos para los filtros seleccionados.
                                    </td>
                                </tr>
                            )}
                            {details.map((d) => (
                                <tr key={d.threadId} className="border-b border-[var(--border-default)] transition-colors hover:bg-[var(--bg-hover)]">
                                    <td className="max-w-[160px] px-3 py-2">
                                        <div className={`${T.tableCell} ${S.body} truncate font-bold uppercase tracking-tight text-[color:var(--tx-tableCell-color)]`}>
                                            {d.contactName || d.threadId.slice(0, 8)}
                                        </div>
                                    </td>
                                    <td className={`${T.tableCell} ${S.meta} px-3 py-2 whitespace-nowrap`}>{d.channel || '—'}</td>
                                    <td className={`${T.tableCell} ${S.meta} px-3 py-2 whitespace-nowrap`}>{fmtDate(d.openedAt)}</td>
                                    <td className={`${T.tableCell} ${S.meta} px-3 py-2 whitespace-nowrap`}>{fmtDate(d.firstHumanAt)}</td>
                                    <td className={`${T.tableCell} ${S.meta} px-3 py-2 whitespace-nowrap`}>{fmtDate(d.lastHumanAt)}</td>
                                    <td className="px-3 py-2">
                                        <span
                                            className={`${T.statusText} ${S.meta} rounded border border-current px-1.5 py-0.5 font-bold uppercase tracking-wider ${
                                                d.finalStatus === 'CLOSED' ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-600'
                                            }`}
                                        >
                                            {d.finalStatus || '—'}
                                        </span>
                                    </td>
                                    <td className={`${T.tableCell} ${S.meta} px-3 py-2 text-center`}>{d.messagesSentByAgent}</td>
                                    <td className="px-3 py-2 text-center">
                                        {d.hadAiHandoff ? <span className="font-bold text-[var(--brand-primary)]">✓</span> : <span className="opacity-30">—</span>}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-2">
                                        <span
                                            className={`${T.statusText} ${S.meta} rounded border border-current px-2 py-1 font-bold uppercase tracking-wider ${
                                                d.conversationType === 'hybrid'
                                                    ? 'bg-purple-500/10 text-purple-600'
                                                    : d.conversationType === 'ai_only'
                                                      ? 'bg-blue-500/10 text-blue-500'
                                                      : 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]'
                                            }`}
                                        >
                                            {CONV_LABEL[d.conversationType]}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="flex max-w-[180px] flex-wrap gap-1">
                                            {d.actions.slice(0, 4).map((a) => (
                                                <span
                                                    key={a}
                                                    className="rounded border border-[var(--border-default)] bg-[var(--bg-elevated)] px-1.5 py-0.5 text-[8px] font-bold text-[color:var(--tx-helperText-color)] shadow-sm"
                                                >
                                                    {EVENT_LABELS[a] || a}
                                                </span>
                                            ))}
                                            {d.actions.length > 4 && <span className={`${T.helperText} ${S.meta} opacity-50`}>+{d.actions.length - 4}</span>}
                                        </div>
                                    </td>
                                    <td className="px-3 py-2">
                                        <button
                                            onClick={() => setSelectedThread(d.threadId)}
                                            className={`${T.buttonText} ${S.meta} text-[var(--brand-primary)] opacity-70 transition-opacity hover:opacity-100`}
                                        >
                                            Ver
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedThread && <TimelineModal threadId={selectedThread} onClose={() => setSelectedThread(null)} />}
        </div>
    );
}
