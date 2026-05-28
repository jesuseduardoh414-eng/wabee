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
    AlertCircle,
    ArrowUpRight,
    Bot,
    Brain,
    CheckCircle2,
    Clock,
    DollarSign,
    MessageSquare,
    PlayCircle,
    Sparkles,
    Target,
    TrendingUp,
    User,
    Users,
    XCircle,
    Zap,
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
import { T, S } from '@/lib/text-tokens';

type DashboardPeriod = 'today' | '7d' | '30d' | 'custom';

export const DashboardPage = () => {
    const [period, setPeriod] = useState<DashboardPeriod>('7d');
    const [customRange, setCustomRange] = useState({ from: '', to: '' });

    const dateRange = useMemo(() => {
        const to = new Date().toISOString().split('T')[0];
        let from = '';
        const d = new Date();

        if (period === 'today') {
            from = to;
        } else if (period === '7d') {
            d.setDate(d.getDate() - 7);
            from = d.toISOString().split('T')[0];
        } else if (period === '30d') {
            d.setDate(d.getDate() - 30);
            from = d.toISOString().split('T')[0];
        } else {
            from = customRange.from;
        }

        return { from, to: period === 'custom' ? customRange.to : to };
    }, [period, customRange]);

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
    const highlightedAgent = agents?.[0];
    const automationRate = `${((summary?.automationRate || 0) * 100).toFixed(0)}%`;
    const responseRate = `${((summary?.conversationRate || 0) * 100).toFixed(1)}%`;
    const todayLabel = new Intl.DateTimeFormat('es-MX', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
    }).format(new Date());

    const warmShadow = '0 24px 60px color-mix(in srgb, var(--text-strong), transparent 90%)';
    const pageShellStyle: React.CSSProperties = {
        borderColor: 'var(--border-default)',
        background: 'color-mix(in srgb, var(--bg-page), white 6%)',
        color: 'var(--text-strong)',
        boxShadow: '0 30px 80px color-mix(in srgb, var(--text-strong), transparent 94%)',
    };
    const heroBackdropStyle: React.CSSProperties = {
        borderColor: 'color-mix(in srgb, var(--border-default), white 12%)',
        background: [
            'linear-gradient(135deg, color-mix(in srgb, var(--chart-4), transparent 90%) 0%, color-mix(in srgb, var(--bg-card), white 18%) 42%, color-mix(in srgb, var(--brand-primary), transparent 84%) 100%)',
            'var(--bg-page)',
        ].join(', '),
    };
    const darkPanelStyle: React.CSSProperties = {
        background: 'linear-gradient(180deg, color-mix(in srgb, var(--bg-elevated), black 10%), var(--bg-elevated))',
        color: 'color-mix(in srgb, var(--text-strong), white 10%)',
        boxShadow: warmShadow,
    };
    const lightPanelStyle: React.CSSProperties = {
        borderColor: 'color-mix(in srgb, var(--border-default), white 12%)',
        background: 'color-mix(in srgb, var(--bg-card), white 18%)',
        boxShadow: '0 20px 45px color-mix(in srgb, var(--text-strong), transparent 94%)',
    };
    const tagStyle: React.CSSProperties = {
        borderColor: 'color-mix(in srgb, var(--border-default), white 14%)',
        background: 'color-mix(in srgb, var(--bg-card), white 30%)',
        color: 'color-mix(in srgb, var(--text-body), black 18%)',
    };
    const activeFilterStyle: React.CSSProperties = {
        borderColor: 'color-mix(in srgb, var(--chart-5), white 8%)',
        background: 'linear-gradient(135deg, var(--chart-5) 0%, var(--brand-primary) 100%)',
        color: 'var(--text-inverse)',
        boxShadow: '0 14px 28px color-mix(in srgb, var(--chart-5), transparent 78%)',
    };
    const chartStroke = 'var(--chart-axis)';
    const chartGrid = 'var(--chart-grid)';
    const tooltipStyle = {
        backgroundColor: 'var(--chart-tooltip-bg)',
        color: 'var(--chart-tooltip-text)',
        border: 'none',
        borderRadius: '16px',
        fontSize: '12px',
    };

    return (
        <div className="min-h-screen rounded-[32px] border p-4 md:p-6" style={pageShellStyle}>
            <div className="rounded-[28px] border p-4 md:p-6" style={heroBackdropStyle}>
                <section className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
                    <aside className="rounded-[30px] p-5" style={darkPanelStyle}>
                        <div className="mb-6 flex items-center gap-3">
                            <div
                                className="flex h-14 w-14 items-center justify-center rounded-[18px] text-xl font-black shadow-[0_16px_30px_rgba(255,140,0,0.35)]"
                                style={{
                                    background: 'linear-gradient(180deg, var(--chart-5) 0%, var(--brand-primary) 100%)',
                                    color: 'var(--text-inverse)',
                                }}
                            >
                                W
                            </div>
                            <div>
                                <p className="text-lg font-black tracking-tight text-[var(--text-strong)]">Wabee</p>
                                <p className="text-sm text-[var(--text-body)]">Conversation OS</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <SidebarFeature
                                icon={<Sparkles size={15} />}
                                title="Canal activo"
                                text={`${health?.channels?.[0]?.name || 'WhatsApp ventas MX'}`}
                                hint={`${inbox?.pending || 0} conversaciones esperando seguimiento`}
                                active
                            />
                            <SidebarFeature
                                icon={<MessageSquare size={15} />}
                                title="Inbox"
                                text={`${inbox?.open || 0} hilos abiertos`}
                                hint={`${inbox?.assigned || 0} asignados al equipo`}
                            />
                            <SidebarFeature
                                icon={<Users size={15} />}
                                title="Contactos"
                                text={`${summary?.leadsGenerated || 0} leads nuevos`}
                                hint="Lectura rapida del embudo"
                            />
                            <SidebarFeature
                                icon={<Bot size={15} />}
                                title="IA"
                                text={`${aiVsHuman?.aiHandled || 0} hilos resueltos`}
                                hint={`${aiVsHuman?.takeovers || 0} handoffs humanos`}
                            />
                        </div>

                        <div className="mt-6 rounded-[24px] p-4 bg-[color:color-mix(in_srgb,var(--bg-card),white_8%)]">
                            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--brand-primary)]">Pulso operativo</p>
                            <h3 className="mt-2 text-2xl font-black leading-none text-[var(--text-strong)]">{automationRate}</h3>
                            <p className="mt-2 text-sm text-[var(--text-body)]">
                                Automatizacion actual con lectura clara para saber cuando intervenir.
                            </p>
                        </div>
                    </aside>

                    <div className="space-y-6">
                        <header className="rounded-[30px] border p-5 backdrop-blur" style={lightPanelStyle}>
                            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                                <div className="max-w-3xl">
                                    <span className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em]" style={tagStyle}>
                                        <Sparkles size={14} className="text-[var(--chart-4)]" />
                                        Martes operativo
                                    </span>
                                    <p className="mt-4 text-xs font-bold uppercase tracking-[0.24em] text-[var(--text-muted)]">
                                        {todayLabel}
                                    </p>
                                    <h1 className="mt-2 max-w-4xl text-4xl font-black leading-[0.95] tracking-[-0.05em] text-[var(--text-strong)] md:text-6xl">
                                        Todo el equipo sabe que atender primero
                                    </h1>
                                    <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--text-body)] md:text-lg">
                                        El dashboard deja de sentirse tecnico y se convierte en una vista operativa
                                        con contexto, accion y lectura inmediata para ventas, soporte e inteligencia.
                                    </p>
                                </div>

                                <div className="flex flex-col items-start gap-3 xl:items-end">
                                    <div className="flex flex-wrap gap-2">
                                        {(['today', '7d', '30d', 'custom'] as const).map((value) => (
                                            <button
                                                key={value}
                                                onClick={() => setPeriod(value)}
                                                className={`rounded-full border px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] transition-all ${
                                                    period === value
                                                        ? ''
                                                        : 'bg-[color:color-mix(in_srgb,var(--bg-card),white_32%)] text-[var(--text-body)]'
                                                }`}
                                                style={period === value ? activeFilterStyle : { borderColor: 'color-mix(in srgb, var(--border-default), white 14%)' }}
                                            >
                                                {value === 'today' ? 'Hoy' : value}
                                            </button>
                                        ))}
                                    </div>

                                    {period === 'custom' && (
                                        <div className="flex flex-wrap gap-2">
                                            <input
                                                type="date"
                                                value={customRange.from}
                                                onChange={(e) => setCustomRange((current) => ({ ...current, from: e.target.value }))}
                                                className="rounded-2xl border bg-[color:color-mix(in_srgb,var(--bg-card),white_26%)] px-3 py-2 text-xs text-[var(--text-strong)] outline-none"
                                                style={{ borderColor: 'color-mix(in srgb, var(--border-default), white 14%)' }}
                                            />
                                            <input
                                                type="date"
                                                value={customRange.to}
                                                onChange={(e) => setCustomRange((current) => ({ ...current, to: e.target.value }))}
                                                className="rounded-2xl border bg-[color:color-mix(in_srgb,var(--bg-card),white_26%)] px-3 py-2 text-xs text-[var(--text-strong)] outline-none"
                                                style={{ borderColor: 'color-mix(in srgb, var(--border-default), white 14%)' }}
                                            />
                                        </div>
                                    )}

                                    <div className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em]" style={tagStyle}>
                                        <PlayCircle size={14} className="text-[var(--text-strong)]" />
                                        Flujo principal
                                    </div>
                                </div>
                            </div>
                        </header>

                        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <HeroMetricCard
                                label="Leads nuevos"
                                value={summary?.leadsGenerated ?? 0}
                                helper="+18% vs ayer"
                            />
                            <HeroMetricCard
                                label="IA resolviendo"
                                value={automationRate}
                                helper={`${aiVsHuman?.takeovers || 0} chats listos para handoff`}
                            />
                            <HeroMetricCard
                                label="Campana activa"
                                value={highlightedCampaign ? `${Math.round((highlightedCampaign.delivered || 0) / 100) / 10}k` : '0'}
                                helper="entregados en esta ventana"
                            />
                            <HeroMetricCard
                                label="Respuesta"
                                value={responseRate}
                                helper={`${summary?.avgFirstResponseTime || 0} min promedio`}
                            />
                        </section>

                        <section className="grid gap-6 2xl:grid-cols-[1.25fr_0.95fr]">
                            <article className="rounded-[30px] border p-6" style={lightPanelStyle}>
                                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                    <div>
                                        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">
                                            Conversacion prioritaria
                                        </p>
                                        <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-[var(--text-strong)]">
                                            Hay trabajo claro para hacer hoy
                                        </h2>
                                    </div>
                                    <span className="rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] bg-[var(--bg-elevated)] text-[var(--text-strong)]">
                                        IA pausada
                                    </span>
                                </div>

                                <div className="mt-5 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                                    <div className="rounded-[26px] p-5 bg-[color:color-mix(in_srgb,var(--bg-card),white_10%)]">
                                        <div className="space-y-3">
                                            <ChatBubble
                                                mode="client"
                                                text="Hola, quiero ver como funcionaria Wabee con mi equipo comercial."
                                            />
                                            <ChatBubble
                                                mode="agent"
                                                text="Te comparto una propuesta y agendamos una demostracion."
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <MiniInsight
                                            icon={<DollarSign size={15} />}
                                            title="Revenue atribuido"
                                            value={`$${summary?.revenueAttributed?.toLocaleString() || 0}`}
                                        />
                                        <MiniInsight
                                            icon={<Target size={15} />}
                                            title="Total conversaciones"
                                            value={`${summary?.totalConversations || 0}`}
                                        />
                                        <MiniInsight
                                            icon={<Clock size={15} />}
                                            title="Tiempo de respuesta"
                                            value={`${summary?.avgFirstResponseTime || 0}m`}
                                        />
                                    </div>
                                </div>
                            </article>

                            <article className="rounded-[30px] p-6" style={darkPanelStyle}>
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">
                                            Resumen ejecutivo
                                        </p>
                                        <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--text-strong)]">
                                            Lo urgente, sin ruido
                                        </h2>
                                    </div>
                                    <span className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] bg-[color:color-mix(in_srgb,var(--brand-primary),transparent_86%)] text-[var(--brand-primary)]">
                                        Live
                                    </span>
                                </div>

                                <ul className="mt-6 space-y-3">
                                    <ExecutiveLine
                                        icon={<AlertCircle size={15} />}
                                        text={`${health?.crmErrors || 0} errores CRM detectados`}
                                    />
                                    <ExecutiveLine
                                        icon={<MessageSquare size={15} />}
                                        text={`${inbox?.pending || 0} conversaciones superaron SLA`}
                                    />
                                    <ExecutiveLine
                                        icon={<Zap size={15} />}
                                        text={`${inbox?.human_queue || 0} chats esperan cola humana`}
                                    />
                                </ul>

                                <div className="mt-6 rounded-[24px] bg-[color:color-mix(in_srgb,var(--bg-card),white_8%)] p-4">
                                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                                        Campana destacada
                                    </p>
                                    <h3 className="mt-2 text-xl font-black text-[var(--text-strong)]">
                                        {highlightedCampaign?.name || 'Sin campanas activas'}
                                    </h3>
                                    <p className="mt-2 text-sm text-[var(--text-body)]">
                                        {highlightedCampaign
                                            ? `${highlightedCampaign.delivered} entregados y ${highlightedCampaign.responded} respuestas`
                                            : 'Cuando exista actividad, este bloque mostrara el mejor pulso comercial.'}
                                    </p>
                                </div>
                            </article>
                        </section>

                        <section className="grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
                            <article className="rounded-[30px] border p-6" style={lightPanelStyle}>
                                <div className="mb-6 flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">
                                            Rendimiento general
                                        </p>
                                        <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--text-strong)]">
                                            Conversaciones, leads e ingresos
                                        </h2>
                                    </div>
                                    <span className="rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em]" style={tagStyle}>
                                        Dashboard concept
                                    </span>
                                </div>

                                <div className="h-[320px] min-h-[320px] rounded-[26px] p-3 bg-[color:color-mix(in_srgb,var(--bg-card),white_10%)]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={timeSeries || []}>
                                            <defs>
                                                <linearGradient id="wabeeRevenueFill" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="var(--chart-5)" stopOpacity={0.28} />
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
                                            <Legend verticalAlign="top" height={40} wrapperStyle={{ fontWeight: 900, fontSize: '12px' }} />
                                            <Area type="monotone" dataKey="revenue" stroke="var(--chart-5)" strokeWidth={3} fill="url(#wabeeRevenueFill)" name="Revenue" />
                                            <Area type="monotone" dataKey="leads" stroke="var(--brand-primary)" strokeWidth={2.4} fill="transparent" name="Leads" />
                                            <Area type="monotone" dataKey="conversations" stroke="var(--chart-4)" strokeWidth={2} fill="transparent" name="Hilos" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </article>

                            <article className="rounded-[30px] border p-6" style={lightPanelStyle}>
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">
                                            IA y handoff
                                        </p>
                                        <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--text-strong)]">
                                            Eficiencia operativa
                                        </h2>
                                    </div>
                                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[color:color-mix(in_srgb,var(--chart-4),transparent_88%)] text-[var(--chart-4)]">
                                        <Brain size={18} />
                                    </div>
                                </div>

                                <div className="mt-5 h-[210px] min-h-[210px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={[
                                                    { name: 'IA', value: aiVsHuman?.aiHandled || 0 },
                                                    { name: 'Humano', value: aiVsHuman?.humanHandled || 0 },
                                                ]}
                                                innerRadius={56}
                                                outerRadius={82}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                <Cell fill="var(--brand-primary)" />
                                                <Cell fill="var(--bg-elevated)" />
                                            </Pie>
                                            <Tooltip contentStyle={tooltipStyle} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>

                                <div className="mt-2 rounded-[22px] p-4 bg-[color:color-mix(in_srgb,var(--bg-card),white_10%)]">
                                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                                        Automatizacion actual
                                    </p>
                                    <div className="mt-2 flex items-end justify-between gap-3">
                                        <span className="text-4xl font-black leading-none tracking-[-0.05em] text-[var(--text-strong)]">
                                            {automationRate}
                                        </span>
                                        <span className="rounded-full bg-[var(--bg-elevated)] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--text-strong)]">
                                            {aiVsHuman?.takeovers || 0} takeovers
                                        </span>
                                    </div>
                                </div>
                            </article>
                        </section>

                        <section className="grid gap-6 xl:grid-cols-[1.02fr_1fr]">
                            <article className="rounded-[30px] border p-6" style={lightPanelStyle}>
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">
                                            Equipo
                                        </p>
                                        <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--text-strong)]">
                                            Desempeno visible del equipo
                                        </h2>
                                    </div>
                                    <div className="rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em]" style={tagStyle}>
                                        {agents?.length || 0} agentes
                                    </div>
                                </div>

                                <div className="mt-5 space-y-3">
                                    {(agents || []).slice(0, 4).map((agent) => (
                                        <div
                                            key={agent.agentId}
                                            className="flex items-center justify-between rounded-[22px] border px-4 py-4 bg-[color:color-mix(in_srgb,var(--bg-card),white_12%)]"
                                            style={{ borderColor: 'color-mix(in srgb, var(--border-default), white 12%)' }}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--bg-elevated)] text-[var(--text-strong)]">
                                                    <User size={18} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black uppercase tracking-[0.08em] text-[var(--text-strong)]">
                                                        {agent.agentId.split('-')[0]}
                                                    </p>
                                                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                                                        {agent.messagesSent} mensajes
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-2xl font-black leading-none tracking-[-0.04em] text-[var(--text-strong)]">
                                                    {agent.avgResponseTime}m
                                                </p>
                                                <p className="mt-1 text-[11px] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
                                                    respuesta
                                                </p>
                                            </div>
                                        </div>
                                    ))}

                                    {!agents?.length && (
                                        <EmptyState text="Cuando haya actividad del equipo, esta columna se llenara con su pulso real." />
                                    )}
                                </div>
                            </article>

                            <article className="rounded-[30px] p-6" style={darkPanelStyle}>
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">
                                            Estado del inbox
                                        </p>
                                        <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--text-strong)]">
                                            Operacion y alertas
                                        </h2>
                                    </div>
                                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[color:color-mix(in_srgb,var(--brand-primary),transparent_86%)] text-[var(--brand-primary)]">
                                        <MessageSquare size={18} />
                                    </div>
                                </div>

                                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                                    <StatusTile label="Hilos abiertos" value={inbox?.open || 0} tone="success" icon={<CheckCircle2 size={16} />} />
                                    <StatusTile label="Pendientes" value={inbox?.pending || 0} tone="warning" icon={<Clock size={16} />} />
                                    <StatusTile label="Cola humana" value={inbox?.human_queue || 0} tone="danger" icon={<AlertCircle size={16} />} />
                                    <StatusTile label="Cerrados" value={inbox?.closed || 0} tone="neutral" icon={<XCircle size={16} />} />
                                </div>

                                <div className="mt-5 rounded-[24px] bg-[color:color-mix(in_srgb,var(--bg-card),white_8%)] p-4">
                                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                                        Asignacion actual
                                    </p>
                                    <div className="mt-3 grid grid-cols-2 gap-3">
                                        <AssignmentTile label="Asignados" value={inbox?.assigned || 0} />
                                        <AssignmentTile label="No asignados" value={inbox?.unassigned || 0} warning />
                                    </div>
                                </div>
                            </article>
                        </section>

                        {highlightedAgent && (
                            <section className="rounded-[30px] border p-6" style={lightPanelStyle}>
                                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">
                                            Insight final
                                        </p>
                                        <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--text-strong)]">
                                            El panel ahora cuenta una historia operativa
                                        </h2>
                                    </div>
                                    <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em]" style={tagStyle}>
                                        <ArrowUpRight size={14} />
                                        Agente destacado {highlightedAgent.agentId.split('-')[0]}
                                    </div>
                                </div>
                            </section>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
};

function SidebarFeature({
    icon,
    title,
    text,
    hint,
    active = false,
}: {
    icon: React.ReactNode;
    title: string;
    text: string;
    hint: string;
    active?: boolean;
}) {
    return (
        <div
            className={`rounded-[22px] border px-4 py-4 transition-all ${
                active
                    ? 'bg-[linear-gradient(135deg,color-mix(in_srgb,var(--brand-primary),transparent_82%)_0%,color-mix(in_srgb,var(--chart-5),transparent_88%)_100%)]'
                    : 'bg-[color:color-mix(in_srgb,var(--bg-card),white_4%)]'
            }`}
            style={{ borderColor: active ? 'color-mix(in srgb, var(--brand-primary), transparent 68%)' : 'color-mix(in srgb, var(--border-default), transparent 30%)' }}
        >
            <div className="flex items-center gap-2 text-[var(--text-strong)]">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[color:color-mix(in_srgb,var(--bg-card),white_8%)]">
                    {icon}
                </div>
                <span className="text-xs font-black uppercase tracking-[0.18em]">{title}</span>
            </div>
            <p className="mt-3 text-sm font-black text-[var(--text-strong)]">{text}</p>
            <p className="mt-1 text-xs leading-5 text-[var(--text-body)]">{hint}</p>
        </div>
    );
}

function HeroMetricCard({
    label,
    value,
    helper,
}: {
    label: string;
    value: string | number;
    helper: string;
}) {
    return (
        <article
            className="rounded-[28px] border px-5 py-5"
            style={{
                borderColor: 'color-mix(in srgb, var(--border-default), white 12%)',
                background: 'color-mix(in srgb, var(--bg-card), white 18%)',
                boxShadow: '0 20px 45px color-mix(in srgb, var(--text-strong), transparent 94%)',
            }}
        >
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">{label}</p>
            <strong className="mt-3 block text-4xl font-black leading-none tracking-[-0.06em] text-[var(--text-strong)]">
                {value}
            </strong>
            <p className="mt-3 text-sm leading-6 text-[var(--text-body)]">{helper}</p>
        </article>
    );
}

function ChatBubble({ mode, text }: { mode: 'client' | 'agent'; text: string }) {
    const isClient = mode === 'client';

    return (
        <div
            className={`max-w-[92%] rounded-[22px] px-4 py-3 text-sm leading-6 shadow-sm ${
                isClient
                    ? 'bg-[color:color-mix(in_srgb,var(--bg-card),white_24%)] text-[var(--text-body)]'
                    : 'ml-auto bg-[var(--bg-elevated)] text-[var(--text-strong)]'
            }`}
        >
            {text}
        </div>
    );
}

function MiniInsight({
    icon,
    title,
    value,
}: {
    icon: React.ReactNode;
    title: string;
    value: string;
}) {
    return (
        <div
            className="rounded-[22px] border p-4"
            style={{
                borderColor: 'color-mix(in srgb, var(--border-default), white 12%)',
                background: 'color-mix(in srgb, var(--bg-card), white 12%)',
            }}
        >
            <div className="flex items-center gap-2 text-[var(--text-muted)]">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[color:color-mix(in_srgb,var(--bg-card),white_24%)] text-[var(--chart-5)]">
                    {icon}
                </div>
                <span className="text-[11px] font-black uppercase tracking-[0.16em]">{title}</span>
            </div>
            <p className="mt-3 text-2xl font-black leading-none tracking-[-0.04em] text-[var(--text-strong)]">{value}</p>
        </div>
    );
}

function ExecutiveLine({ icon, text }: { icon: React.ReactNode; text: string }) {
    return (
        <li className="flex items-center gap-3 rounded-[20px] bg-[color:color-mix(in_srgb,var(--bg-card),white_8%)] px-4 py-3 text-sm text-[var(--text-body)]">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[color:color-mix(in_srgb,var(--bg-card),white_10%)] text-[var(--brand-primary)]">
                {icon}
            </span>
            <span>{text}</span>
        </li>
    );
}

function StatusTile({
    label,
    value,
    tone,
    icon,
}: {
    label: string;
    value: number;
    tone: 'success' | 'warning' | 'danger' | 'neutral';
    icon: React.ReactNode;
}) {
    const toneMap = {
        success: 'border-[color:color-mix(in_srgb,var(--state-success),transparent_78%)] bg-[color:color-mix(in_srgb,var(--state-success),transparent_90%)] text-[var(--state-success)]',
        warning: 'border-[color:color-mix(in_srgb,var(--state-warning),transparent_80%)] bg-[color:color-mix(in_srgb,var(--state-warning),transparent_90%)] text-[var(--state-warning)]',
        danger: 'border-[color:color-mix(in_srgb,var(--state-danger),transparent_80%)] bg-[color:color-mix(in_srgb,var(--state-danger),transparent_90%)] text-[var(--state-danger)]',
        neutral: 'border-[color:color-mix(in_srgb,var(--text-body),transparent_82%)] bg-[color:color-mix(in_srgb,var(--bg-card),white_6%)] text-[var(--text-strong)]',
    };

    return (
        <div className={`rounded-[22px] border p-4 ${toneMap[tone]}`}>
            <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-black uppercase tracking-[0.16em] opacity-90">{label}</span>
                <span className="opacity-70">{icon}</span>
            </div>
            <p className="mt-3 text-3xl font-black leading-none tracking-[-0.05em]">{value}</p>
        </div>
    );
}

function AssignmentTile({
    label,
    value,
    warning = false,
}: {
    label: string;
    value: number;
    warning?: boolean;
}) {
    return (
        <div
            className={`rounded-[20px] px-4 py-4 ${
                warning
                    ? 'bg-[color:color-mix(in_srgb,var(--state-danger),transparent_88%)] text-[var(--state-danger)]'
                    : 'bg-[color:color-mix(in_srgb,var(--bg-card),white_8%)] text-[var(--text-strong)]'
            }`}
        >
            <p className="text-[11px] font-black uppercase tracking-[0.16em] opacity-75">{label}</p>
            <p className="mt-2 text-3xl font-black leading-none tracking-[-0.05em]">{value}</p>
        </div>
    );
}

function EmptyState({ text }: { text: string }) {
    return (
        <div
            className="rounded-[22px] border border-dashed px-4 py-6 text-sm leading-6 text-[var(--text-body)]"
            style={{
                borderColor: 'color-mix(in srgb, var(--border-default), white 12%)',
                background: 'color-mix(in srgb, var(--bg-card), white 14%)',
            }}
        >
            {text}
        </div>
    );
}
