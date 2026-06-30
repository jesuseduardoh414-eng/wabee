import React from 'react';
import { 
    Activity, Users, Building2, Zap, 
    ArrowUpRight, ArrowDownRight, Globe, 
    Server, Cpu, ShieldCheck, Database 
} from 'lucide-react';
import { T, S } from '@/lib/text-tokens';

export const DashboardGlobalPage = () => {
    return (
        <div className="p-4 sm:p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div>
                    <h1 className={`${T.pageTitle} ${S.displayMd}`}>Dashboard <span className="text-[var(--brand-primary)]">Global</span></h1>
                    <p className={`${T.pageSubtitle} ${S.body}`}>Estado general del ecosistema WABEE en tiempo real.</p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    <span className={`${T.helperText} ${S.meta} uppercase tracking-widest`}>Sistema Online</span>
                </div>
            </div>

            {/* Main KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'MRR Agregado', value: '$124,500', trend: '+12.5%', isUp: true, icon: Zap },
                    { label: 'Orgs Activas', value: '1,240', trend: '+48', isUp: true, icon: Building2 },
                    { label: 'Usuarios Totales', value: '45.2k', trend: '+1.2k', isUp: true, icon: Users },
                    { label: 'Conversaciones', value: '1.2M', trend: '-2%', isUp: false, icon: Activity },
                ].map((kpi, i) => (
                    <div key={i} className="bg-[var(--bg-card)] border border-[var(--border-default)] p-8 rounded-[2.5rem] relative overflow-hidden group hover:border-[var(--brand-primary)]/30 transition-all">
                        <div className="flex items-start justify-between mb-4">
                            <div className={`w-12 h-12 rounded-2xl bg-[var(--brand-primary)]/10 flex items-center justify-center text-[var(--brand-primary)] ${T.buttonPrimaryText}`}>
                                <kpi.icon size={24} />
                            </div>
                            <div className={`flex items-center gap-1 ${kpi.isUp ? 'text-green-500' : 'text-red-500'}`}>
                                {kpi.isUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                <span className={`${S.meta} font-bold`}>{kpi.trend}</span>
                            </div>
                        </div>
                        <p className={`${T.kpiLabel} ${S.meta}`}>{kpi.label}</p>
                        <p className={`${T.kpiValue} ${S.displayMd} mt-1`}>{kpi.value}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Health Overview */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-[2.5rem] p-8">
                        <h3 className={`${T.sectionTitle} ${S.headingLg} mb-8`}>Infraestructura & Salud</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            {[
                                { label: 'API Gateway', status: 'Optimal', load: '24%', icon: Server, color: 'text-green-500' },
                                { label: 'AI Engine', status: 'High Load', load: '82%', icon: Cpu, color: 'text-yellow-500' },
                                { label: 'Database Cluster', status: 'Optimal', load: '12%', icon: Database, color: 'text-green-500' },
                                { label: 'Auth Service', status: 'Optimal', load: '5%', icon: ShieldCheck, color: 'text-green-500' },
                            ].map((s, i) => (
                                <div key={i} className="flex items-center gap-4 p-5 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl">
                                    <div className={`w-10 h-10 rounded-xl bg-[var(--bg-card)] flex items-center justify-center ${s.color}`}>
                                        <s.icon size={20} />
                                    </div>
                                    <div className="flex-1">
                                        <p className={`${T.cardTitle} ${S.meta}`}>{s.label}</p>
                                        <div className="flex items-center justify-between mt-1">
                                            <span className={`${S.meta} font-bold ${s.color}`}>{s.status}</span>
                                            <span className={`${T.helperText} ${S.meta}`}>Uso: {s.load}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-[2.5rem] p-8 h-64 flex flex-col items-center justify-center text-center opacity-40 border-dashed">
                        <Activity size={48} className="mb-4 text-[var(--brand-primary)]" />
                        <p className={`${T.cardTitle} ${S.body}`}>Gráfico de Actividad Agregada</p>
                        <p className={`${T.helperText} ${S.meta} mt-1`}>Visualización de tráfico global por hora (Integración pendiente)</p>
                    </div>
                </div>

                {/* Regional Activity */}
                <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-[2.5rem] p-8">
                    <h3 className={`${T.cardTitle} ${S.headingMd} mb-8 flex items-center gap-3`}>
                        <Globe size={18} className="text-[var(--brand-primary)]" />
                        Actividad Regional
                    </h3>
                    <div className="space-y-6">
                        {[
                            { region: 'México / LATAM', share: 65, flag: '🇲🇽' },
                            { region: 'Estados Unidos', share: 22, flag: '🇺🇸' },
                            { region: 'España / Europa', share: 10, flag: '🇪🇸' },
                            { region: 'Otros', share: 3, flag: '🌐' },
                        ].map((r, i) => (
                            <div key={i} className="space-y-2">
                                <div className="flex justify-between items-center px-1">
                                    <p className={`${T.helperText} ${S.meta} font-bold uppercase tracking-widest flex items-center gap-2`}>
                                        <span>{r.flag}</span> {r.region}
                                    </p>
                                    <span className={`${T.helperText} ${S.meta} font-bold`}>{r.share}%</span>
                                </div>
                                <div className="h-1.5 bg-[var(--bg-surface)] rounded-full overflow-hidden">
                                    <div className={`h-full bg-[var(--brand-primary)] rounded-full ${T.buttonPrimaryText}`} style={{ width: `${r.share}%` }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
