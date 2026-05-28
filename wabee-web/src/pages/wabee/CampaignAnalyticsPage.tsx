import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
    BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer, FunnelChart, Funnel, LabelList,
    Cell
} from 'recharts';
import {
    getCampaignAnalyticsSummary,
    getCampaignAnalyticsTimeSeries,
    getCampaignAnalyticsFunnel,
    getCampaignAnalyticsErrors,
    getCampaignAnalyticsRecipients,
    CampaignAnalyticsSummary,
    CampaignAnalyticsTimeSeries,
    CampaignAnalyticsFunnel,
    CampaignAnalyticsError,
    CampaignAnalyticsRecipient,
    CampaignAnalyticsRecipientsResponse
} from '@/api/wabee/campaigns.api';
import { T, S } from '@/lib/text-tokens';
import {
    BarChart3,
    Calendar,
    ChevronLeft,
    MessageSquare,
    Users,
    Send,
    CheckCircle2,
    AlertCircle,
    TrendingUp,
    DollarSign,
    MousePointer2,
    Filter,
    ArrowUpRight,
    Search,
    Brain,
    User,
    ArrowRightLeft,
    ChevronRight,
    Target,
    Zap,
    ArrowLeft
} from 'lucide-react';
import { apiClient } from '@/api/wabee/client';

export default function CampaignAnalyticsPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [period, setPeriod] = useState<'all' | '24h' | '7d'>('all');
    const [page, setPage] = useState(1);

    // ─── Queries ──────────────────────────────────────────────────────────────
    const { data: summary, isLoading: loadingSummary } = useQuery<CampaignAnalyticsSummary>({
        queryKey: ['campaign-analytics-summary', id],
        queryFn: () => getCampaignAnalyticsSummary(id!)
    });

    const { data: timeSeries, isLoading: loadingTimeSeries } = useQuery<CampaignAnalyticsTimeSeries[]>({
        queryKey: ['campaign-analytics-timeseries', id, period],
        queryFn: () => getCampaignAnalyticsTimeSeries(id!, period)
    });

    const { data: funnel, isLoading: loadingFunnel } = useQuery<CampaignAnalyticsFunnel[]>({
        queryKey: ['campaign-analytics-funnel', id],
        queryFn: () => getCampaignAnalyticsFunnel(id!)
    });

    const { data: errors, isLoading: loadingErrors } = useQuery<CampaignAnalyticsError[]>({
        queryKey: ['campaign-analytics-errors', id],
        queryFn: () => getCampaignAnalyticsErrors(id!)
    });

    const { data: recipients, isLoading: loadingRecipients } = useQuery<CampaignAnalyticsRecipientsResponse>({
        queryKey: ['campaign-analytics-recipients', id, page],
        queryFn: () => getCampaignAnalyticsRecipients(id!, page)
    });

    if (loadingSummary) {
        return (
            <div className="min-h-screen bg-[var(--bg-page)] p-8 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-[var(--brand-primary)]"></div>
            </div>
        );
    }

    const { 
        campaignInfo, 
        coreMetrics, 
        conversationalImpact, 
        commercialImpact 
    } = summary || {
        campaignInfo: {} as any,
        coreMetrics: {} as any,
        conversationalImpact: {} as any,
        commercialImpact: {} as any
    };

    return (
        <div className="min-h-screen bg-[var(--bg-page)] text-[color:var(--text-body)] font-sans overflow-x-hidden selection:bg-[var(--brand-primary)] selection:">
            {/* Header */}
            <header className="border-b border-[var(--border-default)] bg-[var(--bg-page)]/80 backdrop-blur-md sticky top-0 z-50 px-8 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => navigate(-1)}
                        className="p-2 hover:bg-[var(--bg-elevated)] rounded-xl transition-all border border-transparent hover:border-[var(--border-default)]"
                    >
                        <ArrowLeft className="w-5 h-5 text-[color:var(--brand-primary)]" />
                    </button>
                    <div>
                        <h1 className={`${T.pageTitle} ${S.displayMd} text-[color:var(--text-strong)]`}>{campaignInfo?.name}</h1>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className={`${T.badgeText} ${S.meta} px-2 py-0.5 rounded-full uppercase tracking-widest ${
                                campaignInfo?.status === 'COMPLETED' ? 'bg-green-500/10 text-green-500' : 
                                campaignInfo?.status === 'IN_PROGRESS' ? 'bg-[var(--brand-primary)]/10 text-[color:var(--brand-primary)]' : 'bg-[var(--bg-elevated)] text-[color:var(--tx-helperText-color)]'
                            }`}>
                                {campaignInfo?.status}
                            </span>
                            <span className={`${T.helperText} ${S.meta} opacity-60 font-bold`}>— {campaignInfo?.channelName} ({campaignInfo?.channelPhone})</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex bg-[var(--bg-card)] p-1 rounded-xl border border-[var(--border-default)]">
                        {(['all', '24h', '7d'] as const).map((p) => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                className={`${T.buttonPrimaryText} ${S.meta} px-4 py-1.5 rounded-lg transition-all ${
 period === p ? 'bg-[var(--brand-primary)] ' : 'text-[color:var(--text-body)] hover:text-[color:var(--brand-primary)]'
 }`}
                            >
                                {p === 'all' ? 'Todo' : p}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            <main className="p-8 space-y-8 max-w-7xl mx-auto">
                {/* Top KPI Grid */}
                <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <KpiCard title="Enviados" value={coreMetrics?.sent} icon={<Target className="w-4 h-4" />} color="text-[color:var(--text-strong)]" />
                    <KpiCard title="Entregados" value={coreMetrics?.delivered} subValue={`${((coreMetrics?.deliveryRate || 0) * 100).toFixed(1)}%`} icon={<CheckCircle2 className="w-4 h-4" />} color="text-blue-500" />
                    <KpiCard title="Leídos" value={coreMetrics?.read} subValue={`${((coreMetrics?.readRate || 0) * 100).toFixed(1)}%`} icon={<MousePointer2 className="w-4 h-4" />} color="text-green-500" />
                    <KpiCard title="Fallidos" value={coreMetrics?.failed} icon={<AlertCircle className="w-4 h-4" />} color="text-red-500" />
                </section>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Funnel Section */}
                    <div className="lg:col-span-1 bg-[var(--bg-card)] rounded-3xl p-6 border border-[var(--border-default)] shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform">
                            <TrendingUp className="w-32 h-32 text-[color:var(--brand-primary)]" />
                        </div>
                        <h2 className={`${T.sectionTitle} ${S.headingMd} mb-8 flex items-center gap-2`}>
                             <div className="w-1.5 h-1.5 rounded-full bg-[var(--brand-primary)] animate-pulse"></div>
                             Embudo de Conversión
                        </h2>
                        
                        <div className="h-[400px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <FunnelChart>
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: '12px', fontSize: '10px', color: 'var(--text-strong)' }}
                                        itemStyle={{ color: 'var(--brand-primary)' }}
                                    />
                                    <Funnel data={funnel || []} dataKey="value" nameKey="label">
                                        <LabelList 
                                            position="right" 
                                            dataKey="label" 
                                            fontSize={9} 
                                            fontWeight="900"
                                            content={(props: any) => {
                                                const { x, y, width, height, value } = props;
                                                return (
                                                    <text 
                                                        x={x + width + 10} 
                                                        y={y + height / 2} 
                                                        fill="var(--tx-cardTitle-color)" 
                                                        textAnchor="start" 
                                                        dominantBaseline="middle" 
                                                        className={`${T.cardTitle} ${S.meta}`}
                                                    >
                                                        {value}
                                                    </text>
                                                );
                                            }}
                                        />
                                        {funnel?.map((_entry: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill="var(--brand-primary)" />
                                        ))}
                                    </Funnel>
                                </FunnelChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Evolutionary Charts */}
                    <div className="lg:col-span-2 space-y-8">
                        <div className="bg-[var(--bg-card)] rounded-3xl p-6 border border-[var(--border-default)] shadow-2xl">
                            <h2 className={`${T.sectionTitle} ${S.headingMd} mb-8 flex items-center gap-2`}>
                                <BarChart3 className="w-4 h-4 text-[color:var(--brand-primary)]" />
                                Evolución Temporal
                            </h2>
                            <div className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={timeSeries || []}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
                                        <XAxis 
                                            dataKey="timestamp" 
                                            tickFormatter={(ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 
                                            fontSize={9} 
                                            tick={{ fill: 'var(--tx-helperText-color)' }}
                                            axisLine={{ stroke: 'var(--border-default)' }}
                                        />
                                        <YAxis fontSize={9} tick={{ fill: 'var(--tx-helperText-color)' }} axisLine={{ stroke: 'var(--border-default)' }} />
                                        <Tooltip 
                                             contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: '12px', fontSize: '10px', color: 'var(--tx-messageText-color)' }}
                                        />
                                        <Legend iconType="circle" wrapperStyle={{ fontSize: '9px', paddingTop: '20px', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--tx-helperText-color)' }} />
                                        <Line type="monotone" dataKey="sent" stroke="var(--tx-helperText-color)" strokeWidth={2} dot={false} name="Enviados" />
                                        <Line type="monotone" dataKey="delivered" stroke="var(--state-info)" strokeWidth={2} dot={false} name="Entregados" />
                                        <Line type="monotone" dataKey="read" stroke="var(--state-success)" strokeWidth={2} name="Leídos" dot={false} />
                                        <Line type="monotone" dataKey="failed" stroke="var(--state-danger)" strokeWidth={2} name="Fallidos" dot={false} strokeDasharray="5 5" />
                                        <Line type="monotone" dataKey="responded" stroke="var(--brand-primary)" strokeWidth={2} name="Respondidos" dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Error Breakdown */}
                        <div className="bg-[var(--bg-card)] rounded-3xl p-6 border border-[var(--border-default)] shadow-2xl">
                            <h2 className={`${T.sectionTitle} ${S.headingMd} mb-8 flex items-center gap-2`}>
                                <AlertCircle className="w-4 h-4 text-red-400" />
                                Análisis de Errores
                            </h2>
                            <div className="space-y-4">
                                {errors?.map((err: CampaignAnalyticsError, idx: number) => (
                                    <div key={idx} className="space-y-1.5">
                                        <div className={`${T.badgeText} ${S.meta} flex justify-between uppercase`}>
                                            <span className="text-[color:var(--text-muted)]">{err.error_type}</span>
                                            <span className="text-[color:var(--text-strong)]">{err.count} ({err.percentage.toFixed(1)}%)</span>
                                        </div>
                                        <div className="h-2 bg-[var(--bg-page)] rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-red-500/50 transition-all duration-1000" 
                                                style={{ width: `${err.percentage}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                                {(!errors || errors.length === 0) && (
                                    <p className={`${T.helperText} ${S.meta} text-green-500/50 uppercase italic`}>No se detectaron errores de envío.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Conversational & Commercial Impact */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Impacto Conversacional */}
                    <div className="bg-[var(--bg-card)] border-l-4 border-l-purple-500 rounded-3xl p-6 border border-[var(--border-default)] shadow-2xl bg-gradient-to-br from-[var(--bg-card)] to-[var(--bg-background)]">
                        <h2 className={`${T.sectionTitle} ${S.headingMd} mb-8 flex items-center gap-2 text-purple-400`}>
                            <MessageSquare className="w-4 h-4 text-purple-400" />
                            Impacto Conversacional
                        </h2>
                        <div className="grid grid-cols-2 gap-4">
                            <StatsBox label="Respondieron" value={conversationalImpact?.responded} subLabel={`Tasa: ${((Number(conversationalImpact?.responseRate) || 0) * 100).toFixed(1)}%`} theme="purple" />
                            <StatsBox label="Hilos Creados" value={conversationalImpact?.threadsGenerated} subLabel={`Tasa: ${((Number(conversationalImpact?.conversationRate) || 0) * 100).toFixed(1)}%`} theme="purple" />
                            <StatsBox label="Atendido por IA" value={conversationalImpact?.aiHandled} subLabel="Automatizado" theme="purple" />
                            <StatsBox label="Takeovers (Escalación)" value={conversationalImpact?.takeovers} subLabel={`Tasa: ${((Number(conversationalImpact?.aiToHumanRate) || 0) * 100).toFixed(1)}%`} theme="purple" />
                        </div>
                    </div>

                    {/* Impacto Comercial */}
                    <div className="bg-[var(--bg-card)] border-l-4 border-l-[var(--brand-primary)] rounded-3xl p-6 border border-[var(--border-default)] shadow-2xl bg-gradient-to-br from-[var(--bg-card)] to-[var(--bg-background)]">
                        <h2 className={`${T.sectionTitle} ${S.headingMd} mb-8 flex items-center gap-2 text-[var(--ty-accent)]`}>
                            <TrendingUp className="w-4 h-4" />
                            Impacto Comercial (ROI)
                        </h2>
                        <div className="grid grid-cols-2 gap-4">
                            <StatsBox label="Leads Generados" value={commercialImpact?.leadsGenerated} subLabel={`Conv: ${((Number(commercialImpact?.leadConversionRate) || 0) * 100).toFixed(1)}%`} theme="yellow" />
                            <StatsBox label="Deals Creados" value={commercialImpact?.dealsGenerated} subLabel={`Conv: ${((Number(commercialImpact?.dealConversionRate) || 0) * 100).toFixed(1)}%`} theme="yellow" />
                            <StatsBox label="Revenue Atribuido" value={`$${commercialImpact?.revenueAttributed?.toLocaleString()}`} subLabel="Directo" theme="yellow" />
                            <StatsBox label="Revenue / Campaña" value={`$${commercialImpact?.revenuePerCampaign?.toLocaleString()}`} subLabel="Venta Proyectada" theme="yellow" />
                        </div>
                    </div>
                </div>

                {/* Recipients Table */}
                <section className="bg-[var(--bg-card)] rounded-3xl border border-[var(--border-default)] shadow-2xl overflow-hidden">
                    <div className="p-6 border-b border-[var(--border-default)] flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <h2 className={`${T.sectionTitle} ${S.headingMd} flex items-center gap-2`}>
                             <Users className="w-4 h-4 text-[var(--ty-accent)]" />
                             Detalle de Destinatarios
                        </h2>
                        <div className="flex items-center gap-4">
                             <div className="relative group">
                                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--tx-helperText-color)] group-focus-within:text-[color:var(--brand-primary)] transition-colors" />
                                <input 
                                    type="text" 
                                    placeholder="BUSCAR CONTACTO..." 
                                    className={`${T.inputText} ${S.meta} bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl pl-9 pr-4 py-2 text-[color:var(--tx-inputText-color)] outline-none focus:border-[var(--brand-primary)]/50 min-w-[250px] transition-all`}
                                />
                             </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-[var(--bg-elevated)]">
                                    <th className={`${T.tableHeader} ${S.meta} px-6 py-4`}>Contacto</th>
                                    <th className={`${T.tableHeader} ${S.meta} px-6 py-4`}>Teléfono</th>
                                    <th className={`${T.tableHeader} ${S.meta} px-6 py-4 text-center`}>Estado</th>
                                    <th className={`${T.tableHeader} ${S.meta} px-6 py-4`}>Actualizado</th>
                                    <th className={`${T.tableHeader} ${S.meta} px-6 py-4 text-right`}>Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-default)]/30">
                                {recipients?.items?.map((m: CampaignAnalyticsRecipient) => (
                                    <tr key={m.id} className="hover:bg-[var(--bg-elevated)] transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className={`${T.tableCell} ${S.body} font-bold uppercase tracking-tight text-[color:var(--text-strong)]`}>{m.contact_name}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className={`${T.helperText} ${S.meta} font-mono`}>{m.phone}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex justify-center">
                                                <span className={`${T.badgeText} ${S.meta} px-2 py-0.5 rounded-md border border-current ${
                                                    m.status === 'READ' ? 'text-green-400 bg-green-400/10' :
                                                    m.status === 'DELIVERED' ? 'text-blue-400 bg-blue-400/10' :
                                                    m.status === 'FAILED' ? 'text-red-400 bg-red-400/10' : 'text-[color:var(--tx-helperText-color)] bg-[var(--bg-elevated)]'
                                                }`}>
                                                    {m.status}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className={`${T.tableCell} ${S.body} text-[var(--ty-muted)] uppercase`}>{new Date(m.updatedAt).toLocaleString()}</div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {m.threadId ? (
                                                <button 
                                                    onClick={() => navigate(`/wabee/inbox?threadId=${m.threadId}&view=fullscreen`)}
                                                    className={`${T.buttonText} ${S.meta} inline-flex items-center gap-1.5 text-[var(--ty-accent)] hover:brightness-125 hover:translate-x-1 transition-all`}
                                                >
                                                    Ver Chat <TrendingUp className="w-3 h-3" />
                                                </button>
                                            ) : (
                                                <span className={`${T.helperText} ${S.meta} opacity-30`}>Sin hilo</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="p-6 border-t border-[var(--border-default)] flex items-center justify-between">
                        <div className={`${T.helperText} ${S.meta} uppercase text-[color:var(--text-muted)]`}>
                            Mostrando <span className="text-[color:var(--text-strong)] italic">{recipients?.items?.length}</span> de <span className="text-[color:var(--text-strong)] italic">{recipients?.total}</span> destinatarios
                        </div>
                        <div className="flex gap-2">
                             <button 
                                disabled={page === 1}
                                onClick={() => setPage(p => p - 1)}
                                className={`${T.buttonText} ${S.meta} px-3 py-1.5 rounded-lg border border-[var(--border-default)] hover:bg-[var(--bg-elevated)] disabled:opacity-20`}
                             >
                                ANTERIOR
                             </button>
                             <button 
                                disabled={!recipients?.items || (recipients?.items?.length || 0) < 50}
                                onClick={() => setPage(p => p + 1)}
                                className={`${T.buttonText} ${S.meta} px-3 py-1.5 rounded-lg border border-[var(--border-default)] hover:bg-[var(--bg-elevated)] disabled:opacity-20`}
                             >
                                SIGUIENTE
                             </button>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}

interface KpiCardProps {
    title: string;
    value?: number | string;
    subValue?: string;
    icon: React.ReactNode;
    color: string;
}

function KpiCard({ title, value, subValue, icon, color }: KpiCardProps) {
    return (
        <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-3xl p-6 shadow-xl relative overflow-hidden group hover:border-[var(--brand-primary)]/30 transition-all">
            <div className={`absolute top-0 right-0 p-6 opacity-[0.05] group-hover:scale-110 transition-transform ${color}`}>
                {icon}
            </div>
            <p className={`${T.sectionTitle} ${S.meta} mb-1 text-[color:var(--text-strong)]`}>{title}</p>
            <div className="flex items-baseline gap-2">
                <span className={`${T.kpiValue} ${S.displayLg} ${color}`}>{value?.toLocaleString() ?? 0}</span>
                {subValue && <span className={`${T.helperText} ${S.meta} text-[color:var(--text-muted)]`}>{subValue}</span>}
            </div>
        </div>
    );
}

interface StatsBoxProps {
    label: string;
    value?: number | string;
    subLabel: string;
    theme: 'purple' | 'yellow';
}

function StatsBox({ label, value, subLabel, theme }: StatsBoxProps) {
    const isPurple = theme === 'purple';
    return (
        <div className={`p-4 rounded-2xl border transition-all ${
            isPurple 
                ? 'bg-purple-900/5 border-purple-500/10 hover:border-purple-500/30' 
                : 'bg-[var(--brand-primary)]/5 border-[var(--brand-primary)]/10 hover:border-[var(--brand-primary)]/30'
        }`}>
            <p className={`${T.sectionTitle} ${S.meta} mb-1 text-[color:var(--text-strong)]`}>{label}</p>
            <p className={`${T.kpiValue} ${S.kpiLg} ${isPurple ? 'text-purple-400' : 'text-[color:var(--text-strong)]'}`}>{value ?? 0}</p>
            <p className={`${T.helperText} ${S.meta} mt-0.5 text-[color:var(--text-muted)]`}>— {subLabel}</p>
        </div>
    );
}
