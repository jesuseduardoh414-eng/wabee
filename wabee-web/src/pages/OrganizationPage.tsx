import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Building2, Database, Users as UsersIcon, ChevronRight,
    ArrowLeft, Loader2
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import client from '../api/client';
import { T, S } from '@/lib/text-tokens';

export const OrganizationPage = () => {
    const navigate = useNavigate();

    const role = (localStorage.getItem('wabee_role') || 'AGENT').toUpperCase();
    const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';
    const orgId = localStorage.getItem('wabee_orgId');
    const orgName = localStorage.getItem('wabee_orgName') || 'Mi Organización';

    // Stats de organización (solo para admin)
    const { data: orgStats, isLoading: loadingStats } = useQuery({
        queryKey: ['org-stats', orgId],
        queryFn: async () => {
            if (!orgId) return null;
            const res = await client.get(`/orgs/${orgId}/stats`);
            return res.data;
        },
        enabled: !!orgId && isAdmin
    });

    const formatSize = (bytes: number) => {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    if (!isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6">
                <div className="w-16 h-16 bg-[var(--state-danger)]/10 rounded-full flex items-center justify-center text-[var(--state-danger)] mb-4">
                    <Building2 size={32} />
                </div>
                <h2 className={`${T.sectionTitle} ${S.headingMd} mb-2`}>Acceso Restringido</h2>
                <p className={`${T.helperText} ${S.body} max-w-sm`}>
                    Solo los administradores de la organización pueden ver esta información técnica y de almacenamiento.
                </p>
                <button
                    onClick={() => navigate('/dashboard')}
                    className={`${T.buttonText} ${S.body} mt-6 text-[var(--brand-primary)] flex items-center gap-2 hover:underline`}
                >
                    <ArrowLeft size={16} /> Volver al Dashboard
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-full">
            {/* Header */}
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className={`${T.pageTitle} ${S.displayMd}`}>
                        Mi <span className="text-[var(--ty-accent)]">Organización</span>
                    </h1>
                    <p className={`${T.pageSubtitle} ${S.meta} mt-1 uppercase tracking-widest`}>
                        Información detallada y estadísticas técnicas de tu empresa
                    </p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-[var(--brand-primary)]/10 flex items-center justify-center text-[var(--brand-primary)]">
                    <Building2 size={24} />
                </div>
            </div>

            <div className="max-w-5xl">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* ── Columna Principal ── */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* Tarjeta de Información */}
                        <div className="bg-[var(--bg-page)] border border-[var(--border-default)] rounded-3xl p-8 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--brand-primary)]/5 rounded-bl-full -mr-10 -mt-10 group-hover:bg-[var(--brand-primary)]/10 transition-all duration-500" />

                            <div className="relative z-10">
                                <p className={`${T.badgeText} ${S.meta} text-[var(--brand-primary)] font-bold uppercase tracking-[3px] mb-2`}>
                                    Detalles de Empresa
                                </p>
                                <h2 className={`${T.sectionTitle} ${S.displayLg} mb-8 tracking-tighter`}>
                                    {orgName}
                                </h2>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* ID Único */}
                                    <div>
                                        <p className={`${T.labelText} ${S.meta} font-bold uppercase tracking-widest mb-1`}>
                                            ID Único
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <code className={`${T.inputText} ${S.meta} bg-[var(--bg-card)] px-3 py-1.5 rounded-lg font-mono border border-[var(--border-default)]`}>
                                                {orgId}
                                            </code>
                                        </div>
                                    </div>

                                    {/* Nivel de Acceso */}
                                    <div>
                                        <p className={`${T.labelText} ${S.meta} font-bold uppercase tracking-widest mb-1`}>
                                            Tu Nivel de Acceso
                                        </p>
                                        <span className={`inline-flex items-center px-3 py-1 rounded-full bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] ${T.badgeText} ${S.meta} font-bold uppercase tracking-wider border border-[var(--brand-primary)]/20`}>
                                            {role}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Tarjeta de Almacenamiento */}
                        <div className="bg-[var(--bg-page)] border border-[var(--border-default)] rounded-3xl p-8">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-[var(--brand-primary)]/10 flex items-center justify-center text-[var(--brand-primary)]">
                                        <Database size={24} />
                                    </div>
                                    <div>
                                        <h3 className={`${T.sectionTitle} ${S.headingMd}`}>
                                            Almacenamiento Global
                                        </h3>
                                        <p className={`${T.helperText} ${S.meta}`}>
                                            Uso acumulado de medios y archivos
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    {loadingStats ? (
                                        <Loader2 className="animate-spin text-[var(--brand-primary)] ml-auto" size={20} />
                                    ) : (
                                        <>
                                            <p className={`${T.kpiValue} ${S.kpiLg} text-[var(--brand-primary)]`}>
                                                {formatSize(orgStats?.storageUsage || 0)}
                                            </p>
                                            <p className={`${T.helperText} ${S.meta} font-bold uppercase mt-1`}>
                                                Límite: {formatSize(orgStats?.storageLimit || 1024 * 1024 * 50)}
                                            </p>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Barra de progreso */}
                            <div className="space-y-3">
                                <div className="h-3 bg-[var(--bg-card)] border border-[var(--border-default)] rounded-full overflow-hidden p-0.5">
                                    <div
                                        className="h-full bg-[var(--brand-primary)] rounded-full transition-all duration-1000"
                                        style={{
                                            width: `${Math.min(100, ((orgStats?.storageUsage || 0) / (orgStats?.storageLimit || 1024 * 1024 * 50)) * 100)}%`,
                                            boxShadow: '0 0 15px color-mix(in srgb, var(--brand-primary), transparent 70%)'
                                        }}
                                    />
                                </div>
                                <div className={`flex justify-between ${T.badgeText} ${S.meta} font-bold tracking-[2px] uppercase`}>
                                    <span className="text-[var(--ty-dimmed)]">Consumo de Datos</span>
                                    <span className={
                                        ((orgStats?.storageUsage || 0) / (orgStats?.storageLimit || 1)) > 0.8
                                            ? 'text-[var(--state-danger)]'
                                            : 'text-[var(--brand-primary)]'
                                    }>
                                        {Math.round(((orgStats?.storageUsage || 0) / (orgStats?.storageLimit || 1)) * 100)}% Utilizado
                                    </span>
                                </div>
                            </div>

                            {/* Notas informativas */}
                            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <p className={`${T.helperText} ${S.meta} leading-relaxed italic`}>
                                    "El almacenamiento se calcula sumando todos los archivos de avatares, campañas de marketing y archivos multimedia enviados a través de WhatsApp."
                                </p>
                                <div className="bg-[var(--bg-card)] p-4 rounded-2xl border border-[var(--border-default)] flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-[var(--state-info)]/10 flex items-center justify-center text-[var(--state-info)]">
                                        <Database size={16} />
                                    </div>
                                    <p className={`${T.helperText} ${S.meta} leading-tight`}>
                                        Si necesitas más espacio, contacta a nuestro equipo para actualizar tu plan de almacenamiento.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Columna Lateral ── */}
                    <div className="space-y-6">

                        {/* Equipo de Trabajo */}
                        <div className="bg-[var(--bg-page)] border border-[var(--border-default)] rounded-3xl p-6">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                                    <UsersIcon size={20} />
                                </div>
                                <h3 className={`${T.sectionTitle} ${S.headingSm}`}>Equipo de Trabajo</h3>
                            </div>

                            <div className="space-y-4 mb-6">
                                <div className="flex justify-between items-end">
                                    <div>
                                        <p className={`${T.kpiValue} ${S.kpiLg}`}>
                                            {orgStats?.membersCount || 0}
                                        </p>
                                        <p className={`${T.labelText} ${S.meta} uppercase tracking-widest`}>
                                            Miembros Activos
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => navigate('/dashboard/team')}
                                className={`${T.buttonPrimaryText} ${S.meta} w-full py-3.5 bg-[var(--brand-primary)] uppercase tracking-widest rounded-2xl hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group`}
                            >
                                Gestionar Colaboradores
                                <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>

                        {/* Panel de Tips */}
                        <div className="p-6 rounded-3xl border border-[var(--brand-primary)]/10 bg-[var(--bg-page)]">
                            <p className={`${T.sectionTitle} ${S.body} text-[var(--brand-primary)] mb-3 flex items-center gap-2`}>
                                <span className="w-6 h-6 rounded-lg bg-[var(--brand-primary)]/10 flex items-center justify-center text-sm">💡</span>
                                Gestión de Recursos
                            </p>
                            <p className={`${T.helperText} ${S.body} leading-relaxed`}>
                                Como administrador, tienes control total sobre la organización. Puedes añadir nuevos miembros, invitar agentes y monitorear el consumo de recursos de tu plan en tiempo real.
                            </p>
                            <div className="mt-4 pt-4 border-t border-[var(--border-default)]">
                                <p className={`${T.labelText} ${S.meta} font-bold uppercase tracking-widest mb-2`}>
                                    Próximas funciones:
                                </p>
                                <ul className={`${T.helperText} ${S.meta} space-y-1.5 opacity-60`}>
                                    <li>• Logs de Actividad Global</li>
                                    <li>• Reportes Mensuales de Uso</li>
                                    <li>• Límites por Departamento</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
