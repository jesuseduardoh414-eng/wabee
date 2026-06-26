import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    getDashboardSummary,
    getDashboardHealth,
    getDashboardAiVsHuman,
    getDashboardTopCampaigns,
    getDashboardAgentsPerformance,
    getDashboardInboxStatus,
    getDashboardTimeSeries,
    DashboardSummary,
    OperationalHealth,
    AiVsHumanStats,
    TopCampaign,
    AgentPerformance,
    InboxStatus,
    DashboardTimeSeries,
} from '@/api/wabee/dashboard.api';
import {
    ArrowRight,
    Bot,
    Brain,
    CheckCircle2,
    Clock,
    MessageSquare,
    User,
    Users,
} from 'lucide-react';
import {
    Area,
    AreaChart,
    CartesianGrid,
    Cell,
    Legend,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { Link } from 'react-router-dom';

type DashboardPeriod = 'today' | '7d' | '30d';

export const DashboardPage = () => {
    const [period, setPeriod] = useState<DashboardPeriod>('7d');

    const dateRange = useMemo(() => {
        const to = new Date().toISOString().split('T')[0];
        const d = new Date();
        if (period === '7d') d.setDate(d.getDate() - 7);
        if (period === '30d') d.setDate(d.getDate() - 30);
        const from = period === 'today' ? to : d.toISOString().split('T')[0];
        return { from, to };
    }, [period]);

    const { data: summary } = useQuery<DashboardSummary>({
        queryKey: ['dashboard-summary', dateRange],
        queryFn: () => getDashboardSummary(dateRange.from, dateRange.to),
    });
    const { data: health } = useQuery<OperationalHealth>({
        queryKey: ['dashboard-health'],
        queryFn: getDashboardHealth,
        refetchInterval: 30000,
    });
    const { data: aiVsHuman } = useQuery<AiVsHumanStats>({
        queryKey: ['dashboard-ai-vs-human', dateRange],
        queryFn: () => getDashboardAiVsHuman(dateRange.from, dateRange.to),
    });
    const { data: topCampaigns } = useQuery<TopCampaign[]>({
        queryKey: ['dashboard-top-campaigns', dateRange],
        queryFn: () => getDashboardTopCampaigns(dateRange.from, dateRange.to),
    });
    const { data: agents } = useQuery<AgentPerformance[]>({
        queryKey: ['dashboard-agents', dateRange],
        queryFn: () => getDashboardAgentsPerformance(dateRange.from, dateRange.to),
    });
    const { data: inbox } = useQuery<InboxStatus>({
        queryKey: ['dashboard-inbox'],
        queryFn: getDashboardInboxStatus,
        refetchInterval: 10000,
    });
    const { data: timeSeries } = useQuery<DashboardTimeSeries[]>({
        queryKey: ['dashboard-timeseries', dateRange],
        queryFn: () => getDashboardTimeSeries(dateRange.from, dateRange.to),
    });

    const highlightedCampaign = topCampaigns?.[0];
    const automationRate = `${((summary?.automationRate || 0) * 100).toFixed(0)}%`;
    const unassigned = inbox?.unassigned ?? 0;
    const pending = inbox?.pending ?? 0;
    const humanQueue = inbox?.human_queue ?? 0;
    const crmErrors = health?.crmErrors ?? 0;
    const allClear = crmErrors === 0 && pending === 0 && humanQueue === 0;

    const todayLabel = new Intl.DateTimeFormat('es-MX', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
    }).format(new Date());
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
    const subtitle =
        unassigned > 0
            ? `Tienes ${unassigned} ${unassigned === 1 ? 'conversación' : 'conversaciones'} sin asignar. Empieza por ahí.`
            : 'Todo está al día. Buen trabajo. 👌';

    const cardBorder: React.CSSProperties = { borderColor: 'var(--border-default)' };
    const chartStroke = 'var(--chart-axis)';
    const chartGrid = 'var(--chart-grid)';
    const tooltipStyle = {
        backgroundColor: 'var(--chart-tooltip-bg)',
        color: 'var(--chart-tooltip-text)',
        border: 'none',
        borderRadius: '12px',
        fontSize: '12px',
    };

    return (
        <div className="min-h-screen p-4 sm:p-6 md:p-8" style={{ background: 'var(--bg-page)' }}>
            <div className="mx-auto w-full max-w-6xl space-y-6">
                {/* ─── Encabezado: saludo + filtro de periodo ─── */}
                <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">
                            {todayLabel.charAt(0).toUpperCase() + todayLabel.slice(1)}
                        </p>
                        <h1 className="mt-1 text-3xl font-black tracking-tight text-[var(--text-strong)] sm:text-4xl">
                            {greeting}
                        </h1>
                        <p className="mt-1.5 text-[15px] text-[var(--text-body)]">{subtitle}</p>
                    </div>

                    <div className="flex gap-1.5 rounded-full border p-1" style={{ ...cardBorder, background: 'var(--bg-card)' }}>
                        {(['today', '7d', '30d'] as const).map((value) => (
                            <button
                                key={value}
                                onClick={() => setPeriod(value)}
                                className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                                    period === value
                                        ? 'bg-[var(--brand-primary)] text-[var(--text-inverse)]'
                                        : 'text-[var(--text-body)] hover:text-[var(--text-strong)]'
                                }`}
                            >
                                {value === 'today' ? 'Hoy' : value === '7d' ? '7 días' : '30 días'}
                            </button>
                        ))}
                    </div>
                </header>

                {/* ─── Acción primaria: necesita tu atención ─── */}
                <section className="rounded-3xl border p-6 shadow-sm sm:p-8" style={{ ...cardBorder, background: 'var(--bg-card)' }}>
                    <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex-1">
                            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--brand-primary)]">
                                Necesita tu atención
                            </p>
                            <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-1">
                                <span className="text-6xl font-black leading-none tracking-tight text-[var(--text-strong)]">
                                    {unassigned}
                                </span>
                                <span className="mb-1 text-lg font-bold text-[var(--text-body)]">
                                    {unassigned === 1 ? 'conversación sin asignar' : 'conversaciones sin asignar'}
                                </span>
                            </div>
                            <p className="mt-2 max-w-md text-sm text-[var(--text-muted)]">
                                {unassigned > 0
                                    ? 'Nadie las está atendiendo todavía. Asígnalas para que tu equipo pueda responder.'
                                    : 'No hay conversaciones esperando asignación.'}
                            </p>
                            <div className="mt-5 flex flex-wrap gap-3">
                                <Link
                                    to="/dashboard/wabee/inbox"
                                    className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-primary)] px-5 py-2.5 text-sm font-bold text-[var(--text-inverse)] transition-all hover:brightness-95"
                                >
                                    Ir al inbox <ArrowRight size={16} />
                                </Link>
                                <Link
                                    to="/dashboard/wabee/inbox"
                                    className="inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-bold text-[var(--text-strong)] transition-all hover:bg-[var(--bg-elevated)]"
                                    style={cardBorder}
                                >
                                    Asignar a un agente
                                </Link>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-6 rounded-2xl border p-5 lg:gap-8" style={{ ...cardBorder, background: 'var(--bg-page)' }}>
                            <Glance label="Abiertas" value={inbox?.open ?? 0} />
                            <Glance label="Asignadas" value={inbox?.assigned ?? 0} />
                            <Glance label="En cola humana" value={humanQueue} />
                        </div>
                    </div>
                </section>

                {/* ─── 3 métricas clave ─── */}
                <section className="grid gap-4 sm:grid-cols-3">
                    <Metric
                        label="Hilos abiertos"
                        value={inbox?.open ?? 0}
                        hint={`${inbox?.assigned ?? 0} asignado · ${inbox?.unassigned ?? 0} sin asignar`}
                    />
                    <Metric
                        label="Tiempo de respuesta"
                        value={`${summary?.avgFirstResponseTime ?? 0} min`}
                        hint="Promedio en este periodo"
                    />
                    <Metric
                        label="IA resolviendo"
                        value={automationRate}
                        hint={`${aiVsHuman?.takeovers ?? 0} requieren intervención`}
                    />
                </section>

                {/* ─── Barra de estado ─── */}
                <div
                    className="flex items-center gap-3 rounded-2xl border px-5 py-4 text-sm font-medium"
                    style={
                        allClear
                            ? { borderColor: 'color-mix(in srgb, var(--state-success), transparent 70%)', background: 'color-mix(in srgb, var(--state-success), transparent 92%)', color: 'var(--state-success)' }
                            : { borderColor: 'color-mix(in srgb, var(--state-warning), transparent 70%)', background: 'color-mix(in srgb, var(--state-warning), transparent 92%)', color: 'var(--state-warning)' }
                    }
                >
                    <CheckCircle2 size={18} />
                    <span>
                        {allClear
                            ? 'Todo en orden — 0 errores CRM · 0 conversaciones fuera de SLA · 0 esperando cola humana.'
                            : `Atención: ${crmErrors} errores CRM · ${pending} fuera de SLA · ${humanQueue} en cola humana.`}
                    </span>
                </div>

                {/* ─── Gráficas ─── */}
                <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                    <article className="rounded-3xl border p-5 shadow-sm sm:p-6" style={{ ...cardBorder, background: 'var(--bg-card)' }}>
                        <div className="mb-4 flex items-center justify-between">
                            <div>
                                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">Rendimiento</p>
                                <h2 className="mt-1 text-xl font-black text-[var(--text-strong)]">Conversaciones, leads e ingresos</h2>
                            </div>
                            <span className="rounded-full border px-3 py-1 text-[11px] font-bold text-[var(--text-body)]" style={cardBorder}>
                                {period === 'today' ? 'Hoy' : period === '7d' ? 'Últimos 7 días' : 'Últimos 30 días'}
                            </span>
                        </div>
                        <div className="h-[260px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={timeSeries || []}>
                                    <defs>
                                        <linearGradient id="wabeeRevenueFill" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="var(--chart-5)" stopOpacity={0.25} />
                                            <stop offset="95%" stopColor="var(--chart-5)" stopOpacity={0.02} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
                                    <XAxis
                                        dataKey="timestamp"
                                        tick={{ fill: chartStroke, fontSize: 11 }}
                                        axisLine={false}
                                        tickLine={false}
                                        tickFormatter={(value) => value.split('-').slice(1).join('/')}
                                    />
                                    <YAxis tick={{ fill: chartStroke, fontSize: 11 }} axisLine={false} tickLine={false} />
                                    <Tooltip contentStyle={tooltipStyle} />
                                    <Legend verticalAlign="top" height={32} wrapperStyle={{ fontWeight: 700, fontSize: '12px' }} />
                                    <Area type="monotone" dataKey="revenue" stroke="var(--chart-5)" strokeWidth={2.5} fill="url(#wabeeRevenueFill)" name="Ingresos" />
                                    <Area type="monotone" dataKey="leads" stroke="var(--brand-primary)" strokeWidth={2} fill="transparent" name="Leads" />
                                    <Area type="monotone" dataKey="conversations" stroke="var(--chart-4)" strokeWidth={2} fill="transparent" name="Hilos" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </article>

                    <article className="rounded-3xl border p-5 shadow-sm sm:p-6" style={{ ...cardBorder, background: 'var(--bg-card)' }}>
                        <div className="mb-2 flex items-center justify-between">
                            <div>
                                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">IA y handoff</p>
                                <h2 className="mt-1 text-xl font-black text-[var(--text-strong)]">Eficiencia operativa</h2>
                            </div>
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--chart-4)]" style={{ background: 'color-mix(in srgb, var(--chart-4), transparent 88%)' }}>
                                <Brain size={18} />
                            </div>
                        </div>
                        <div className="h-[180px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={[
                                            { name: 'IA', value: aiVsHuman?.aiHandled || 0 },
                                            { name: 'Humano', value: aiVsHuman?.humanHandled || 0 },
                                        ]}
                                        innerRadius={50}
                                        outerRadius={72}
                                        paddingAngle={4}
                                        dataKey="value"
                                    >
                                        <Cell fill="var(--brand-primary)" />
                                        <Cell fill="var(--bg-elevated)" />
                                    </Pie>
                                    <Tooltip contentStyle={tooltipStyle} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="mt-2 flex items-end justify-between rounded-2xl border p-4" style={{ ...cardBorder, background: 'var(--bg-page)' }}>
                            <div>
                                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">Automatización</p>
                                <span className="text-3xl font-black tracking-tight text-[var(--text-strong)]">{automationRate}</span>
                            </div>
                            <span className="rounded-full bg-[var(--bg-elevated)] px-3 py-1 text-[11px] font-bold text-[var(--text-strong)]">
                                {aiVsHuman?.takeovers ?? 0} takeovers
                            </span>
                        </div>
                    </article>
                </section>

                {/* ─── Equipo + Campaña destacada ─── */}
                <section className="grid gap-4 lg:grid-cols-2">
                    <article className="rounded-3xl border p-5 shadow-sm sm:p-6" style={{ ...cardBorder, background: 'var(--bg-card)' }}>
                        <div className="mb-4 flex items-center justify-between">
                            <div>
                                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">Equipo</p>
                                <h2 className="mt-1 text-xl font-black text-[var(--text-strong)]">Desempeño del equipo</h2>
                            </div>
                            <span className="rounded-full border px-3 py-1 text-[11px] font-bold text-[var(--text-body)]" style={cardBorder}>
                                {agents?.length || 0} agentes
                            </span>
                        </div>
                        <div className="space-y-2.5">
                            {(agents || []).slice(0, 4).map((agent) => (
                                <div
                                    key={agent.agentId}
                                    className="flex items-center justify-between rounded-2xl border px-4 py-3"
                                    style={{ ...cardBorder, background: 'var(--bg-page)' }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--bg-elevated)] text-[var(--text-strong)]">
                                            <User size={16} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-[var(--text-strong)]">{agent.agentId.split('-')[0]}</p>
                                            <p className="text-xs text-[var(--text-muted)]">{agent.messagesSent} mensajes</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-black text-[var(--text-strong)]">{agent.avgResponseTime}m</p>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">respuesta</p>
                                    </div>
                                </div>
                            ))}
                            {!agents?.length && (
                                <div className="rounded-2xl border border-dashed px-4 py-8 text-center text-sm text-[var(--text-muted)]" style={cardBorder}>
                                    Cuando haya actividad del equipo, aparecerá aquí.
                                </div>
                            )}
                        </div>
                    </article>

                    <article className="rounded-3xl border p-5 shadow-sm sm:p-6" style={{ ...cardBorder, background: 'var(--bg-card)' }}>
                        <div className="mb-4 flex items-center justify-between">
                            <div>
                                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">Campaña destacada</p>
                                <h2 className="mt-1 text-xl font-black text-[var(--text-strong)]">{highlightedCampaign?.name || 'Sin campañas activas'}</h2>
                            </div>
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--brand-primary)]" style={{ background: 'color-mix(in srgb, var(--brand-primary), transparent 88%)' }}>
                                <MessageSquare size={18} />
                            </div>
                        </div>
                        {highlightedCampaign ? (
                            <div className="grid grid-cols-2 gap-3">
                                <Glance label="Entregados" value={highlightedCampaign.delivered ?? 0} />
                                <Glance label="Respuestas" value={highlightedCampaign.responded ?? 0} />
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-dashed px-4 py-8 text-center text-sm text-[var(--text-muted)]" style={cardBorder}>
                                Crea una campaña para ver su pulso comercial aquí.
                            </div>
                        )}
                        <Link
                            to="/dashboard/wabee/campaigns"
                            className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[var(--brand-primary)] hover:underline"
                        >
                            Ver campañas <ArrowRight size={15} />
                        </Link>
                    </article>
                </section>
            </div>
        </div>
    );
};

function Glance({ label, value }: { label: string; value: number }) {
    return (
        <div>
            <p className="text-3xl font-black leading-none text-[var(--text-strong)]">{value}</p>
            <p className="mt-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">{label}</p>
        </div>
    );
}

function Metric({ label, value, hint }: { label: string; value: string | number; hint: string }) {
    return (
        <article className="rounded-3xl border p-5 shadow-sm sm:p-6" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">{label}</p>
            <strong className="mt-2 block text-4xl font-black leading-none tracking-tight text-[var(--text-strong)]">{value}</strong>
            <p className="mt-2.5 text-sm text-[var(--text-body)]">{hint}</p>
        </article>
    );
}

export default DashboardPage;
