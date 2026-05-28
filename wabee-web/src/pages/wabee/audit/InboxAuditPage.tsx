import { useState, useEffect } from 'react';
import { inboxAuditApi, AttentionSummary, AttentionChatDetail, InboxAuditEvent, AttentionFilters } from '@/api/wabee/audit.api';
import { getChannels, Channel } from '@/api/wabee/whatsapp.api';
import { T, S } from '@/lib/text-tokens';

// ─── Formateo de tiempo ────────────────────────────────────────────────────────
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
    THREAD_TAKEN: 'Tomado', HUMAN_MESSAGE_SENT: 'Mensaje enviado',
    THREAD_ASSIGNED: 'Asignado', THREAD_REASSIGNED: 'Reasignado', THREAD_UNASSIGNED: 'Liberado',
    THREAD_CLOSED: 'Cerrado', THREAD_REOPENED: 'Reabierto', INTERNAL_NOTE_ADDED: 'Nota interna',
    AI_HANDOFF_TO_HUMAN: 'IA→Humano', AI_MESSAGE_SENT: 'Msg IA', THREAD_RESOLVED: 'Resuelto', TEMPLATE_SENT: 'Template',
};
const CONV_LABEL: Record<string, string> = { ai_only: 'Solo IA', human_only: 'Solo Humano', hybrid: 'Híbrido' };

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
    return (
        <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-4 flex flex-col gap-1 min-w-[130px]">
            <span className={`${T.kpiLabel} ${S.meta} opacity-70`}>{label}</span>
            <span className={`${T.kpiValue} ${S.headingLg} text-[var(--brand-primary)] leading-none`}>{value}</span>
            {sub && <span className={`${T.helperText} ${S.meta} opacity-50`}>{sub}</span>}
        </div>
    );
}

// ─── Timeline Modal ────────────────────────────────────────────────────────────
function TimelineModal({ threadId, onClose }: { threadId: string; onClose: () => void }) {
    const [events, setEvents] = useState<InboxAuditEvent[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        inboxAuditApi.getThreadTimeline(threadId)
            .then(setEvents)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [threadId]);

    return (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-2xl w-full max-w-xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b border-[var(--border-default)]">
                    <span className={`${T.sectionTitle} ${S.meta} text-[var(--brand-primary)]`}>Timeline · {threadId.slice(0, 8)}…</span>
                    <button onClick={onClose} className="text-[color:var(--tx-helperText-color)] hover:text-[var(--brand-primary)] transition-colors text-lg leading-none">✕</button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {loading && <p className={`${T.helperText} ${S.body} text-center py-8`}>Cargando…</p>}
                    {!loading && events.length === 0 && <p className={`${T.helperText} ${S.body} text-center py-8`}>Sin eventos registrados.</p>}
                    {events.map((ev, i) => (
                        <div key={ev.id || i} className="flex gap-3 items-start">
                            <div className="w-2 h-2 mt-1.5 rounded-full bg-[var(--brand-primary)] shrink-0" />
                            <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`${T.statusText} ${S.meta} text-[var(--brand-primary)] uppercase tracking-widest font-bold`}>
                                        {EVENT_LABELS[ev.eventType] || ev.eventType}
                                    </span>
                                    {ev.actorDisplayName && (
                                        <span className={`${T.helperText} ${S.meta} opacity-60`}>· {ev.actorDisplayName}</span>
                                    )}
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

// ─── Main Page ─────────────────────────────────────────────────────────────────
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
        Promise.all([
            inboxAuditApi.getSummary(f),
            inboxAuditApi.getDetails(f),
        ]).then(([s, d]) => {
            setSummary(s);
            setDetails(d.items);
            setTotal(d.total);
        }).catch(console.error)
          .finally(() => setLoading(false));
    }

    useEffect(() => { load(); }, []);

    function handleFilter(key: string, val: string) {
        const next = { ...filters, [key]: val || undefined };
        setFilters(next as any);
    }

    function applyFilters() { load(filters as any); }

    const inputCls = `${T.inputText} ${S.meta} bg-[var(--bg-input)] border border-[var(--border-default)] text-[color:var(--tx-inputText-color)] rounded px-2 py-1.5 focus:outline-none focus:border-[var(--brand-primary)] transition-colors font-bold`;

    return (
        <div className="flex flex-col gap-6 p-6 h-full overflow-y-auto">

            {/* Header */}
            <div>
                <h2 className={`${T.pageTitle} ${S.headingLg} text-[var(--brand-primary)]`}>Auditoría de <span className="text-[color:var(--tx-sectionTitle-color)]">Atención</span></h2>
                <p className={`${T.pageSubtitle} ${S.meta} mt-0.5 opacity-50 uppercase tracking-widest`}>Trazabilidad operativa de agentes en el Inbox</p>
            </div>

            {/* Filtros */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-4 flex flex-wrap gap-3 items-end">
                <div className="flex flex-col gap-1">
                    <label className={`${T.labelText} ${S.meta} opacity-50`}>Desde</label>
                    <input type="date" value={filters.from || ''} onChange={e => handleFilter('from', e.target.value)} className={inputCls} />
                </div>
                <div className="flex flex-col gap-1">
                    <label className={`${T.labelText} ${S.meta} opacity-50`}>Hasta</label>
                    <input type="date" value={filters.to || ''} onChange={e => handleFilter('to', e.target.value)} className={inputCls} />
                </div>
                <div className="flex flex-col gap-1">
                    <label className={`${T.labelText} ${S.meta} opacity-50`}>Canal</label>
                    <select value={filters.channelId || ''} onChange={e => handleFilter('channelId', e.target.value)} className={`${inputCls} cursor-pointer`}>
                        <option className="bg-[var(--bg-card)] text-[color:var(--tx-inputText-color)]" value="">Todos</option>
                        {channels.map(c => <option className="bg-[var(--bg-card)] text-[color:var(--tx-inputText-color)]" key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <div className="flex flex-col gap-1">
                    <label className={`${T.labelText} ${S.meta} opacity-50`}>Tipo de acción</label>
                    <select value={filters.eventType || ''} onChange={e => handleFilter('eventType', e.target.value)} className={`${inputCls} cursor-pointer`}>
                        <option className="bg-[var(--bg-card)] text-[color:var(--tx-inputText-color)]" value="">Todas</option>
                        {Object.entries(EVENT_LABELS).map(([k, v]) => <option className="bg-[var(--bg-card)] text-[color:var(--tx-inputText-color)]" key={k} value={k}>{v}</option>)}
                    </select>
                </div>
                <button
                    onClick={applyFilters}
                    className={`${T.buttonPrimaryText} ${S.meta} bg-[var(--brand-primary)] hover:brightness-110 px-4 py-1.5 rounded transition-all active:scale-95 shadow-lg self-end`}
                >
                    {loading ? 'Cargando…' : 'Filtrar'}
                </button>
                {/* Exportar CSV */}
                <a
                    href={inboxAuditApi.exportCsv(filters as any)}
                    download="audit_attention.csv"
                    className={`${T.buttonText} ${S.meta} text-[color:var(--tx-helperText-color)] border border-[var(--border-default)] hover:bg-[var(--bg-hover)] px-4 py-1.5 rounded transition-all self-end shadow-sm`}
                >
                    ↓ CSV
                </a>
            </div>

            {/* KPI Cards */}
            {summary && (
                <div className="flex flex-wrap gap-3">
                    <KpiCard label="Chats únicos"      value={summary.uniqueChats} />
                    <KpiCard label="Mensajes enviados" value={summary.messagesSent} />
                    <KpiCard label="Chats tomados"     value={summary.chatsTaken} />
                    <KpiCard label="Cerrados"          value={summary.chatsClosed} />
                    <KpiCard label="Reasignados"       value={summary.chatsReassigned} />
                    <KpiCard label="Liberados"         value={summary.chatsReleased} />
                    <KpiCard label="1ª Respuesta Prom" value={fmtMs(summary.avgFirstResponseMs)} />
                    <KpiCard label="Resolución Prom"   value={fmtMs(summary.avgResolutionMs)} />
                    <KpiCard label="Cola→Agente Prom"  value={fmtMs(summary.avgHumanQueueResponseMs)} />
                </div>
            )}

            {/* Tabla de Detalle */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl overflow-hidden shadow-xl mt-4">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-default)] bg-[var(--bg-elevated)]">
                    <span className={`${T.sectionTitle} ${S.meta} text-[color:var(--tx-helperText-color)]`}>
                        Detalle de Chats — {total} registros
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-[color:var(--tx-helperText-color)]">
                        <thead className="bg-[var(--bg-elevated)]">
                            <tr className="border-b border-[var(--border-default)] text-[color:var(--tx-tableHeader-color)]">
                                {['Contacto','Canal','Apertura','1ª Intervención','Últ. Actividad','Estado','Msgs','IA→H','Tipo','Acciones',''].map(h => (
                                    <th key={h} className={`${T.tableHeader} ${S.meta} px-3 py-2 text-left opacity-70`}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {details.length === 0 && (
                                <tr><td colSpan={11} className={`${T.helperText} ${S.body} text-center py-10 opacity-50`}>Sin datos para los filtros seleccionados.</td></tr>
                            )}
                            {details.map(d => (
                                <tr key={d.threadId} className="border-b border-[var(--border-default)] hover:bg-[var(--bg-hover)] transition-colors">
                                    <td className="px-3 py-2 max-w-[120px] truncate">
                                        <div className={`${T.tableCell} ${S.body} font-bold text-[color:var(--tx-tableCell-color)] uppercase tracking-tight`}>{d.contactName || d.threadId.slice(0, 8)}</div>
                                    </td>
                                    <td className={`${T.tableCell} ${S.meta} px-3 py-2 whitespace-nowrap`}>{d.channel || '—'}</td>
                                    <td className={`${T.tableCell} ${S.meta} px-3 py-2 whitespace-nowrap`}>{fmtDate(d.openedAt)}</td>
                                    <td className={`${T.tableCell} ${S.meta} px-3 py-2 whitespace-nowrap`}>{fmtDate(d.firstHumanAt)}</td>
                                    <td className={`${T.tableCell} ${S.meta} px-3 py-2 whitespace-nowrap`}>{fmtDate(d.lastHumanAt)}</td>
                                    <td className="px-3 py-2">
                                        <span className={`${T.statusText} ${S.meta} px-1.5 py-0.5 rounded border border-current uppercase font-bold tracking-wider ${
                                            d.finalStatus === 'CLOSED' ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-600'
                                        }`}>{d.finalStatus || '—'}</span>
                                    </td>
                                    <td className={`${T.tableCell} ${S.meta} px-3 py-2 text-center`}>{d.messagesSentByAgent}</td>
                                    <td className="px-3 py-2 text-center">
                                        {d.hadAiHandoff ? <span className="text-[var(--brand-primary)] font-black">✓</span> : <span className="opacity-30">—</span>}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap">
                                        <span className={`${T.statusText} ${S.meta} px-2 py-1 uppercase tracking-wider font-bold rounded border border-current ${
                                            d.conversationType === 'hybrid'     ? 'bg-purple-500/10 text-purple-600' :
                                            d.conversationType === 'ai_only'    ? 'bg-blue-500/10 text-blue-500' :
                                                                                  'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]'
                                        }`}>{CONV_LABEL[d.conversationType]}</span>
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="flex flex-wrap gap-1 max-w-[180px]">
                                            {d.actions.slice(0, 4).map(a => (
                                                <span key={a} className="px-1.5 py-0.5 bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded shadow-sm text-[8px] font-bold text-[color:var(--tx-helperText-color)]">
                                                    {EVENT_LABELS[a] || a}
                                                </span>
                                            ))}
                                            {d.actions.length > 4 && <span className={`${T.helperText} ${S.meta} opacity-50`}>+{d.actions.length - 4}</span>}
                                        </div>
                                    </td>
                                    <td className="px-3 py-2">
                                        <button
                                            onClick={() => setSelectedThread(d.threadId)}
                                            className={`${T.buttonText} ${S.meta} text-[var(--brand-primary)] opacity-60 hover:opacity-100 transition-opacity`}
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

            {/* Timeline Modal */}
            {selectedThread && (
                <TimelineModal threadId={selectedThread} onClose={() => setSelectedThread(null)} />
            )}
        </div>
    );
}
