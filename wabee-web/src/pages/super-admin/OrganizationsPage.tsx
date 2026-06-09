import React, { useState, useEffect, useCallback } from 'react';
import { Building2, Search, Filter, ArrowUpRight, Users, Zap, MoreVertical, Loader2 } from 'lucide-react';
import { T, S } from '@/lib/text-tokens';
import {
    superAdminOrgsApi,
    SuperAdminOrganization,
    SuperAdminStats,
    GetOrganizationsParams,
} from '@/api/wabee/super-admin-orgs.api';
import { OrganizationUsersModal } from '@/components/super-admin/OrganizationUsersModal';
import { ImpersonationStore } from '@/lib/impersonation.store';
import { useToast } from '@/context/ToastContext';

function OrganizationCard({
    org,
    onViewUsers,
    onImpersonate,
    loading,
}: {
    org: SuperAdminOrganization;
    onViewUsers: (org: SuperAdminOrganization) => void;
    onImpersonate: (org: SuperAdminOrganization) => void;
    loading: boolean;
}) {
    return (
        <div className="rounded-[1.75rem] border border-[var(--border-default)] bg-[var(--bg-card)] p-4 shadow-sm">
            <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-muted)]">
                    <Building2 size={18} />
                </div>
                <div className="min-w-0 flex-1">
                    <p className={`${T.tableCell} ${S.body} truncate font-bold text-[var(--text-strong)]`}>{org.name}</p>
                    <p className={`${T.helperText} ${S.meta} mt-0.5 truncate uppercase tracking-tighter`}>{org.slug}</p>
                </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                    <p className={`${T.kpiLabel} ${S.meta} mb-1`}>Plan</p>
                    <span className={`inline-flex rounded-full border px-3 py-1 ${T.badgeText} ${S.meta} ${
                        org.plan.isPro
                            ? 'border-[var(--brand-primary)]/30 bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]'
                            : 'border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-muted)]'
                    }`}>
                        {org.plan.name}
                    </span>
                </div>
                <div>
                    <p className={`${T.kpiLabel} ${S.meta} mb-1`}>Estado</p>
                    <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${
                            org.status === 'active'
                                ? 'bg-[var(--state-success)] shadow-[0_0_8px_var(--state-success)]'
                                : 'bg-[var(--state-danger)] shadow-[0_0_8px_var(--state-danger)]'
                        }`} />
                        <span className={`${T.sectionSubtitle} ${S.body} font-medium ${org.status === 'active' ? 'text-[var(--state-success)]' : 'text-[var(--state-danger)]'}`}>
                            {org.status === 'active' ? 'Activa' : 'Suspendida'}
                        </span>
                    </div>
                </div>
                <div>
                    <p className={`${T.kpiLabel} ${S.meta} mb-1`}>Usuarios</p>
                    <div className="flex items-center gap-2">
                        <Users size={14} className={T.helperText} />
                        <span className={`${T.tableCell} ${S.body} text-[var(--text-strong)]`}>{org.usersCount}</span>
                    </div>
                </div>
                <div>
                    <p className={`${T.kpiLabel} ${S.meta} mb-1`}>Creado</p>
                    <p className={`${T.helperText} ${S.meta}`}>{new Date(org.createdAt).toLocaleDateString('es-MX')}</p>
                </div>
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button
                    onClick={() => onViewUsers(org)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--brand-primary)] px-4 py-2 text-xs font-bold text-[var(--brand-primary-foreground)] shadow-lg shadow-[var(--brand-primary)]/20 transition-all hover:opacity-90"
                >
                    <Users size={14} />
                    Ver usuarios
                </button>
                <button
                    onClick={() => onImpersonate(org)}
                    disabled={loading}
                    className={`inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border-default)] px-4 py-2 text-xs font-bold transition-all ${
                        loading ? 'cursor-not-allowed opacity-50' : 'text-[var(--text-muted)] hover:bg-[var(--brand-primary)]/10 hover:text-[var(--brand-primary)]'
                    }`}
                >
                    <Zap size={14} />
                    Suplantar
                </button>
            </div>
        </div>
    );
}

export const OrganizationsPage = () => {
    const [organizations, setOrganizations] = useState<SuperAdminOrganization[]>([]);
    const [stats, setStats] = useState<SuperAdminStats | null>(null);
    const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 0 });
    const { success: toastSuccess, error: toastError } = useToast();

    const [loading, setLoading] = useState(true);
    const [loadingStats, setLoadingStats] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [sortBy] = useState('createdAt');
    const [sortOrder] = useState<'asc' | 'desc'>('desc');

    const [selectedOrg, setSelectedOrg] = useState<{ id: string; name: string } | null>(null);
    const [isUsersModalOpen, setIsUsersModalOpen] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setPagination((prev) => ({ ...prev, page: 1 }));
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const loadStats = async () => {
        try {
            setLoadingStats(true);
            const data = await superAdminOrgsApi.getStats();
            setStats(data);
        } catch (error) {
            console.error('Error loading super-admin stats:', error);
        } finally {
            setLoadingStats(false);
        }
    };

    const loadOrganizations = useCallback(async () => {
        try {
            setLoading(true);
            const params: GetOrganizationsParams = {
                page: pagination.page,
                pageSize: pagination.pageSize,
                search: debouncedSearch,
                status: statusFilter,
                sortBy,
                sortOrder,
            };
            const response = await superAdminOrgsApi.getOrganizations(params);
            setOrganizations(response.items);
            setPagination((prev) => ({
                ...prev,
                total: response.pagination.total,
                totalPages: response.pagination.totalPages,
            }));
        } catch (error) {
            console.error('Error loading organizations:', error);
        } finally {
            setLoading(false);
        }
    }, [pagination.page, pagination.pageSize, debouncedSearch, statusFilter, sortBy, sortOrder]);

    useEffect(() => {
        loadStats();
    }, []);

    useEffect(() => {
        loadOrganizations();
    }, [loadOrganizations]);

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= pagination.totalPages) {
            setPagination((prev) => ({ ...prev, page: newPage }));
        }
    };

    const handleImpersonate = async (tenantId: string, tenantName: string) => {
        try {
            setLoading(true);
            const data = await superAdminOrgsApi.impersonate(tenantId);

            ImpersonationStore.start({
                realUser: localStorage.getItem('wabee_user'),
                realRole: localStorage.getItem('wabee_role'),
                impersonationToken: data.token,
                targetUserId: data.targetUser.id,
                targetUserName: tenantName,
                targetRole: data.targetUser.role,
                targetUser: {
                    id: data.targetUser.id,
                    profile: { name: tenantName },
                },
                orgId: tenantId,
                orgName: tenantName,
            });

            toastSuccess(`Suplantando administrador de ${tenantName}`);
        } catch (error: any) {
            console.error('Error starting impersonation:', error);
            const message = error.response?.data?.error?.message || 'Error al intentar suplantación';
            toastError(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="wabee-admin-page mx-auto w-full max-w-7xl space-y-6 p-4 animate-in fade-in duration-300 sm:space-y-8 sm:p-6 lg:p-8">
            <div className="flex flex-col gap-4">
                <div>
                    <span className="wabee-admin-page__eyebrow">Super admin · ecosistema</span>
                    <h1 className={`wabee-admin-page__title ${T.pageTitle} ${S.displayMd}`}>
                        Ecosistema de <span className="text-[var(--brand-primary)]">organizaciones</span>
                    </h1>
                    <p className={`${T.pageSubtitle} ${S.body} max-w-3xl`}>
                        Monitorea, filtra y administra todas las instancias activas de Wabee desde una capa visual más clara y ejecutiva.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                    {
                        label: 'Total orgs',
                        value: stats?.totalOrganizations.toLocaleString() || '0',
                        icon: Building2,
                        color: 'text-[var(--state-info)]',
                        loading: loadingStats,
                    },
                    {
                        label: 'Usuarios activos',
                        value: stats?.activeUsers.toLocaleString() || '0',
                        icon: Users,
                        color: 'text-[var(--brand-primary)]',
                        loading: loadingStats,
                    },
                    {
                        label: stats?.topPlanName || 'Plan Pro',
                        value: stats?.topPlanCount.toLocaleString() || '0',
                        icon: Zap,
                        color: 'text-[var(--state-success)]',
                        loading: loadingStats,
                    },
                    {
                        label: 'Crecimiento',
                        value: stats ? `${(stats.growthPercentage ?? 0) > 0 ? '+' : ''}${stats.growthPercentage}%` : '0%',
                        icon: ArrowUpRight,
                        color:
                            (stats?.growthPercentage ?? 0) > 0
                                ? 'text-[var(--state-success)]'
                                : (stats?.growthPercentage ?? 0) < 0
                                  ? 'text-[var(--state-danger)]'
                                  : 'text-[var(--text-muted)]',
                        loading: loadingStats,
                    },
                ].map((stat, i) => (
                    <div key={i} className="wabee-admin-stat group relative overflow-hidden rounded-[2rem] border border-[var(--border-default)] bg-[var(--bg-card)] p-5 transition-all hover:border-[var(--brand-primary)]/30 sm:p-6">
                        {stat.loading && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--bg-card)]/50 backdrop-blur-[1px]">
                                <Loader2 className="animate-spin text-[var(--brand-primary)]/40" size={20} />
                            </div>
                        )}
                        <div className="mb-4 flex items-center justify-between">
                            <div className={`wabee-admin-stat__icon flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--bg-surface)] ${stat.color}`}>
                                <stat.icon size={20} />
                            </div>
                            <MoreVertical size={16} className="cursor-pointer text-[var(--text-muted)] opacity-0 transition-opacity group-hover:opacity-100" />
                        </div>
                        <p className={`${T.kpiLabel} ${S.meta}`}>{stat.label}</p>
                        <p className={`${T.kpiValue} ${S.kpiMd} mt-1 text-[var(--text-strong)]`}>{stat.value}</p>
                    </div>
                ))}
            </div>

            <div className="wabee-admin-toolbar flex flex-col gap-3 rounded-[1.75rem] border border-[var(--border-default)] bg-[var(--bg-card)] p-4 sm:flex-row">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, slug o ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className={`w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] py-3 pl-12 pr-4 ${T.inputText} ${S.body} outline-none transition-all placeholder:text-[var(--text-muted)]/50 focus:border-[var(--brand-primary)]/50`}
                    />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className={`rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-4 py-3 ${T.inputText} ${S.body} outline-none transition-all focus:border-[var(--brand-primary)]/50`}
                    >
                        <option value="">Todos los estados</option>
                        <option value="active">Activas</option>
                        <option value="suspended">Suspendidas</option>
                    </select>
                    <button className="flex items-center justify-center gap-2 rounded-xl border border-[var(--border-default)] px-5 py-3 text-[var(--text-muted)] transition-all hover:bg-[var(--bg-hover)]">
                        <Filter size={18} /> <span className={`${T.navText} ${S.body}`}>Filtros</span>
                    </button>
                </div>
            </div>

            <div className="wabee-admin-table relative overflow-hidden rounded-[2rem] border border-[var(--border-default)] bg-[var(--bg-page)] shadow-2xl sm:rounded-[2.4rem]">
                {loading && (
                    <div className="absolute left-0 top-0 z-20 h-[2px] w-full bg-[var(--brand-primary)]/10">
                        <div className="h-full animate-progress-indeterminate bg-[var(--brand-primary)]" />
                    </div>
                )}

                {loading && organizations.length === 0 ? (
                    <div className="space-y-4 p-4 sm:p-6">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="h-24 animate-pulse rounded-2xl bg-[var(--bg-surface)]" />
                        ))}
                    </div>
                ) : organizations.length === 0 ? (
                    <div className="p-12 text-center sm:p-20">
                        <Building2 size={48} className="mx-auto mb-4 text-[var(--text-muted)]/20" />
                        <h3 className={`${T.emptyStateTitle} ${S.displaySm}`}>No se encontraron organizaciones</h3>
                        <p className={`${T.emptyStateBody} ${S.body} mt-2`}>Intenta ajustar los filtros o términos de búsqueda.</p>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 gap-4 p-4 sm:p-5 xl:hidden">
                            {organizations.map((org) => (
                                <OrganizationCard
                                    key={org.id}
                                    org={org}
                                    loading={loading}
                                    onViewUsers={(item) => {
                                        setSelectedOrg({ id: item.id, name: item.name });
                                        setIsUsersModalOpen(true);
                                    }}
                                    onImpersonate={(item) => handleImpersonate(item.id, item.name)}
                                />
                            ))}
                        </div>

                        <div className="hidden overflow-x-auto xl:block">
                            <table className="w-full min-w-[980px] border-collapse text-left">
                                <thead>
                                    <tr className="border-b border-[var(--border-default)] bg-[var(--bg-surface)]">
                                        {['Organización', 'Plan', 'Estado', 'Usuarios', 'Creado'].map((h, i) => (
                                            <th key={i} className={`p-5 px-8 ${T.tableHeader} ${S.meta}`}>{h}</th>
                                        ))}
                                        <th className={`p-5 px-8 ${T.tableHeader} ${S.meta}`}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border-default)]">
                                    {organizations.map((org) => (
                                        <tr key={org.id} className="group cursor-pointer transition-colors hover:bg-[var(--brand-primary)]/[0.02]">
                                            <td className="p-5 px-8">
                                                <div className="flex items-center gap-4">
                                                    <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] text-xl transition-all group-hover:border-[var(--brand-primary)]/30">
                                                        <Building2 size={20} className="text-[var(--text-muted)]" />
                                                    </div>
                                                    <div>
                                                        <p className={`${T.tableCell} ${S.body} font-bold text-[var(--text-strong)]`}>{org.name}</p>
                                                        <p className={`${T.helperText} ${S.meta} uppercase tracking-tighter transition-colors group-hover:text-[var(--brand-primary)]`}>{org.slug}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-5 px-8">
                                                <span className={`rounded-full border px-3 py-1 ${T.badgeText} ${S.meta} ${
                                                    org.plan.isPro
                                                        ? 'border-[var(--brand-primary)]/30 bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]'
                                                        : 'border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-muted)]'
                                                }`}>
                                                    {org.plan.name}
                                                </span>
                                            </td>
                                            <td className="p-5 px-8">
                                                <div className="flex items-center gap-2">
                                                    <div className={`h-2 w-2 rounded-full ${
                                                        org.status === 'active'
                                                            ? 'bg-[var(--state-success)] shadow-[0_0_8px_var(--state-success)]'
                                                            : 'bg-[var(--state-danger)] shadow-[0_0_8px_var(--state-danger)]'
                                                    }`} />
                                                    <span className={`${T.sectionSubtitle} ${S.body} font-medium ${org.status === 'active' ? 'text-[var(--state-success)]' : 'text-[var(--state-danger)]'}`}>
                                                        {org.status === 'active' ? 'Activa' : 'Suspendida'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-5 px-8">
                                                <div className="flex items-center gap-2 transition-colors group-hover:text-[var(--brand-primary)]">
                                                    <Users size={14} className={T.helperText} />
                                                    <span className={`${T.tableCell} ${S.body} text-[var(--text-strong)]`}>{org.usersCount}</span>
                                                </div>
                                            </td>
                                            <td className="p-5 px-8">
                                                <p className={`${T.helperText} ${S.meta}`}>{new Date(org.createdAt).toLocaleDateString('es-MX')}</p>
                                            </td>
                                            <td className="p-5 px-8">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedOrg({ id: org.id, name: org.name });
                                                            setIsUsersModalOpen(true);
                                                        }}
                                                        title="Ver usuarios y suplantar"
                                                        className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand-primary)] px-3 py-1.5 text-xs font-bold text-[var(--brand-primary-foreground)] shadow-lg shadow-[var(--brand-primary)]/20 transition-all hover:opacity-90"
                                                    >
                                                        <Users size={14} />
                                                        Ver usuarios
                                                    </button>

                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleImpersonate(org.id, org.name);
                                                        }}
                                                        title="Suplantación automática"
                                                        className={`rounded-lg p-2 text-[var(--text-muted)] transition-all hover:bg-[var(--brand-primary)]/10 hover:text-[var(--brand-primary)] ${loading ? 'cursor-not-allowed opacity-50' : ''}`}
                                                        disabled={loading}
                                                    >
                                                        <Zap size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                <div className="flex flex-col gap-3 border-t border-[var(--border-default)] bg-[var(--bg-surface)]/30 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                    <p className={`${T.helperText} ${S.meta}`}>
                        Mostrando <span className={`${T.sectionSubtitle} font-bold`}>{organizations.length}</span> de <span className={`${T.sectionSubtitle} font-bold`}>{pagination.total}</span> organizaciones
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                        <p className={`${T.helperText} ${S.meta}`}>
                            Página <span className={`${T.sectionSubtitle} font-bold`}>{pagination.page}</span> de <span className={`${T.sectionSubtitle} font-bold`}>{pagination.totalPages || 1}</span>
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => handlePageChange(pagination.page - 1)}
                                disabled={pagination.page <= 1 || loading}
                                className="rounded-lg border border-[var(--border-default)] px-4 py-2 text-xs font-bold text-[var(--text-muted)] transition-all hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-30"
                            >
                                Anterior
                            </button>
                            <button
                                onClick={() => handlePageChange(pagination.page + 1)}
                                disabled={pagination.page >= pagination.totalPages || loading}
                                className="rounded-lg border border-[var(--border-default)] px-4 py-2 text-xs font-bold text-[var(--text-muted)] transition-all hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-30"
                            >
                                Siguiente
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <OrganizationUsersModal
                isOpen={isUsersModalOpen}
                onClose={() => setIsUsersModalOpen(false)}
                organization={selectedOrg}
            />
        </div>
    );
};
