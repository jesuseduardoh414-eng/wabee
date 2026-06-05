import React, { useState, useEffect, useCallback } from 'react';
import { Building2, Search, Filter, ArrowUpRight, Plus, Users, Zap, MoreVertical, Loader2 } from 'lucide-react';
import { T, S } from '@/lib/text-tokens';
import { 
    superAdminOrgsApi, 
    SuperAdminOrganization, 
    SuperAdminStats,
    GetOrganizationsParams 
} from '@/api/wabee/super-admin-orgs.api';
import { OrganizationUsersModal } from '@/components/super-admin/OrganizationUsersModal';
import { ImpersonationStore } from '@/lib/impersonation.store';
import { useToast } from '@/context/ToastContext';

export const OrganizationsPage = () => {
    // Estados de datos
    const [organizations, setOrganizations] = useState<SuperAdminOrganization[]>([]);
    const [stats, setStats] = useState<SuperAdminStats | null>(null);
    const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 0 });
    const { success: toastSuccess, error: toastError } = useToast();
    
    // Estados de UI
    const [loading, setLoading] = useState(true);
    const [loadingStats, setLoadingStats] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [sortBy, setSortBy] = useState('createdAt');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    
    // Modal de usuarios
    const [selectedOrg, setSelectedOrg] = useState<{ id: string, name: string } | null>(null);
    const [isUsersModalOpen, setIsUsersModalOpen] = useState(false);

    // Debounce manual para la búsqueda
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setPagination(prev => ({ ...prev, page: 1 })); // Reset a página 1 al buscar
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Cargar estadísticas
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

    // Cargar organizaciones
    const loadOrganizations = useCallback(async () => {
        try {
            setLoading(true);
            const params: GetOrganizationsParams = {
                page: pagination.page,
                pageSize: pagination.pageSize,
                search: debouncedSearch,
                status: statusFilter,
                sortBy,
                sortOrder
            };
            const response = await superAdminOrgsApi.getOrganizations(params);
            setOrganizations(response.items);
            setPagination(prev => ({
                ...prev,
                total: response.pagination.total,
                totalPages: response.pagination.totalPages
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
            setPagination(prev => ({ ...prev, page: newPage }));
        }
    };

    const handleImpersonate = async (tenantId: string, tenantName: string) => {
        try {
            setLoading(true);
            const data = await superAdminOrgsApi.impersonate(tenantId);
            
            // Usar el Store centralizado para persistencia atómica y consistente
            ImpersonationStore.start({
                realUser: localStorage.getItem('wabee_user'),
                realRole: localStorage.getItem('wabee_role'),
                impersonationToken: data.token,
                targetUserId: data.targetUser.id,
                targetUserName: tenantName,
                targetRole: data.targetUser.role,
                targetUser: {
                    id: data.targetUser.id,
                    profile: { name: tenantName }
                },
                orgId: tenantId,
                orgName: tenantName
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
        <div className="wabee-admin-page p-4 sm:p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div>
                    <span className="wabee-admin-page__eyebrow">Super admin · ecosistema</span>
                    <h1 className={`wabee-admin-page__title ${T.pageTitle} ${S.displayMd}`}>Ecosistema de <span className="text-[var(--brand-primary)]">organizaciones</span></h1>
                    <p className={`${T.pageSubtitle} ${S.body}`}>Monitorea, filtra y administra todas las instancias activas de Wabee desde una capa visual más clara y ejecutiva.</p>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { 
                        label: 'Total Orgs', 
                        value: stats?.totalOrganizations.toLocaleString() || '0', 
                        icon: Building2, 
                        color: 'text-[var(--state-info)]',
                        loading: loadingStats
                    },
                    { 
                        label: 'Usuarios Activos', 
                        value: stats?.activeUsers.toLocaleString() || '0', 
                        icon: Users, 
                        color: 'text-[var(--brand-primary)]',
                        loading: loadingStats
                    },
                    { 
                        label: stats?.topPlanName || 'Plan Pro', 
                        value: stats?.topPlanCount.toLocaleString() || '0', 
                        icon: Zap, 
                        color: 'text-[var(--state-success)]',
                        loading: loadingStats
                    },
                    { 
                        label: 'Crecimiento', 
                        value: stats ? `${(stats.growthPercentage ?? 0) > 0 ? '+' : ''}${stats.growthPercentage}%` : '0%', 
                        icon: ArrowUpRight, 
                        color: (stats?.growthPercentage ?? 0) > 0 ? 'text-[var(--state-success)]' : (stats?.growthPercentage ?? 0) < 0 ? 'text-[var(--state-danger)]' : 'text-[var(--text-muted)]',
                        loading: loadingStats
                    },
                ].map((stat, i) => (
                    <div key={i} className="wabee-admin-stat bg-[var(--bg-card)] border border-[var(--border-default)] p-6 rounded-[2rem] hover:border-[var(--brand-primary)]/30 transition-all group relative overflow-hidden">
                        {stat.loading && (
                            <div className="absolute inset-0 bg-[var(--bg-card)]/50 backdrop-blur-[1px] flex items-center justify-center z-10">
                                <Loader2 className="animate-spin text-[var(--brand-primary)]/40" size={20} />
                            </div>
                        )}
                        <div className="flex items-center justify-between mb-4">
                            <div className={`wabee-admin-stat__icon w-12 h-12 rounded-2xl bg-[var(--bg-surface)] flex items-center justify-center ${stat.color}`}>
                                <stat.icon size={20} />
                            </div>
                            <MoreVertical size={16} className="text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" />
                        </div>
                        <p className={`${T.kpiLabel} ${S.meta}`}>{stat.label}</p>
                        <p className={`${T.kpiValue} ${S.kpiMd} mt-1 text-[var(--text-strong)]`}>{stat.value}</p>
                    </div>
                ))}
            </div>

            {/* Filters & Search */}
            <div className="wabee-admin-toolbar flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={18} />
                    <input 
                        type="text" 
                        placeholder="Buscar por nombre, slug o ID..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className={`w-full bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl py-3 pl-12 pr-4 ${T.inputText} ${S.body} focus:border-[var(--brand-primary)]/50 outline-none transition-all placeholder:text-[var(--text-muted)]/50`}
                    />
                </div>
                <div className="flex gap-2">
                    <select 
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className={`px-4 py-3 bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl ${T.inputText} ${S.body} outline-none focus:border-[var(--brand-primary)]/50 transition-all`}
                    >
                        <option value="">Todos los estados</option>
                        <option value="active">Activas</option>
                        <option value="suspended">Suspendidas</option>
                    </select>
                    <button className="flex items-center gap-2 px-5 py-3 border border-[var(--border-default)] rounded-xl text-[var(--text-muted)] hover:bg-[var(--bg-hover)] transition-all">
                        <Filter size={18} /> <span className={`${T.navText} ${S.body}`}>Filtros</span>
                    </button>
                </div>
            </div>

            {/* Organizations Table */}
            <div className="wabee-admin-table bg-[var(--bg-page)] border border-[var(--border-default)] rounded-[2.4rem] overflow-hidden shadow-2xl relative">
                {loading && (
                    <div className="absolute top-0 left-0 w-full h-[2px] bg-[var(--brand-primary)]/10 z-20">
                        <div className="h-full bg-[var(--brand-primary)] animate-progress-indeterminate" />
                    </div>
                )}
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-[var(--border-default)] bg-[var(--bg-surface)]">
                                {['Organización', 'Plan', 'Estado', 'Usuarios', 'Creado'].map((h, i) => (
                                    <th key={i} className={`p-5 px-8 ${T.tableHeader} ${S.meta}`}>{h}</th>
                                ))}
                                <th className={`p-5 px-8 ${T.tableHeader} ${S.meta}`}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-default)]">
                            {loading && organizations.length === 0 ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={6} className="p-8">
                                            <div className="h-8 bg-[var(--bg-surface)] rounded-lg w-full" />
                                        </td>
                                    </tr>
                                ))
                            ) : organizations.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-20 text-center">
                                        <Building2 size={48} className="mx-auto text-[var(--text-muted)]/20 mb-4" />
                                        <h3 className={`${T.emptyStateTitle} ${S.displaySm}`}>No se encontraron organizaciones</h3>
                                        <p className={`${T.emptyStateBody} ${S.body} mt-2`}>Intenta ajustar los filtros o términos de búsqueda.</p>
                                    </td>
                                </tr>
                            ) : (
                                organizations.map((org) => (
                                    <tr key={org.id} className="group hover:bg-[var(--brand-primary)]/[0.02] transition-colors cursor-pointer">
                                        <td className="p-5 px-8">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-[var(--bg-card)] border border-[var(--border-default)] flex items-center justify-center text-xl group-hover:border-[var(--brand-primary)]/30 transition-all relative overflow-hidden">
                                                    <Building2 size={20} className="text-[var(--text-muted)]" />
                                                </div>
                                                <div>
                                                    <p className={`${T.tableCell} ${S.body} font-bold text-[var(--text-strong)]`}>{org.name}</p>
                                                    <p className={`${T.helperText} ${S.meta} group-hover:text-[var(--brand-primary)] transition-colors uppercase tracking-tighter`}>{org.slug}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-5 px-8">
                                            <span className={`px-3 py-1 rounded-full border ${T.badgeText} ${S.meta} ${
                                                org.plan.isPro 
                                                ? 'border-[var(--brand-primary)]/30 text-[var(--brand-primary)] bg-[var(--brand-primary)]/10' 
                                                : 'border-[var(--border-default)] text-[var(--text-muted)] bg-[var(--bg-surface)]'
                                            }`}>
                                                {org.plan.name}
                                            </span>
                                        </td>
                                        <td className="p-5 px-8">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${
                                                    org.status === 'active' 
                                                    ? 'bg-[var(--state-success)] shadow-[0_0_8px_var(--state-success)]' 
                                                    : 'bg-[var(--state-danger)] shadow-[0_0_8px_var(--state-danger)]'
                                                }`} />
                                                <span className={`${T.sectionSubtitle} ${S.body} font-medium ${
                                                    org.status === 'active' ? 'text-[var(--state-success)]' : 'text-[var(--state-danger)]'
                                                }`}>
                                                    {org.status === 'active' ? 'Activa' : 'Suspendida'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-5 px-8">
                                            <div className="flex items-center gap-2 group-hover:text-[var(--brand-primary)] transition-colors">
                                                <Users size={14} className={`${T.helperText}`} />
                                                <span className={`${T.tableCell} ${S.body} text-[var(--text-strong)]`}>{org.usersCount}</span>
                                            </div>
                                        </td>
                                        <td className="p-5 px-8">
                                            <p className={`${T.helperText} ${S.meta}`}>
                                                {new Date(org.createdAt).toLocaleDateString()}
                                            </p>
                                        </td>
                                        <td className="p-5 px-8">
                                            <div className="flex items-center gap-2">
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedOrg({ id: org.id, name: org.name });
                                                        setIsUsersModalOpen(true);
                                                    }}
                                                    title="Ver Usuarios y Suplantar"
                                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--brand-primary)] text-white hover:opacity-90 transition-all shadow-lg shadow-[var(--brand-primary)]/20"
                                                >
                                                    <Users size={14} />
                                                    Ver Usuarios
                                                </button>
                                                
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleImpersonate(org.id, org.name);
                                                    }}
                                                    title="Suplantación Automática (Acceso Rápido)"
                                                    className={`p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/10 transition-all ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                    disabled={loading}
                                                >
                                                    <Zap size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="p-6 border-t border-[var(--border-default)] bg-[var(--bg-surface)]/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className={`${T.helperText} ${S.meta}`}>
                        Mostrando <span className={`${T.sectionSubtitle} font-bold`}>{organizations.length}</span> de <span className={`${T.sectionSubtitle} font-bold`}>{pagination.total}</span> organizaciones
                    </p>
                    <div className="flex items-center gap-4">
                        <p className={`${T.helperText} ${S.meta}`}>
                            Página <span className={`${T.sectionSubtitle} font-bold`}>{pagination.page}</span> de <span className={`${T.sectionSubtitle} font-bold`}>{pagination.totalPages || 1}</span>
                        </p>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => handlePageChange(pagination.page - 1)}
                                disabled={pagination.page <= 1 || loading}
                                className="px-4 py-2 border border-[var(--border-default)] rounded-lg text-xs font-bold text-[var(--text-muted)] hover:bg-[var(--bg-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                                Anterior
                            </button>
                            <button 
                                onClick={() => handlePageChange(pagination.page + 1)}
                                disabled={pagination.page >= pagination.totalPages || loading}
                                className="px-4 py-2 border border-[var(--border-default)] rounded-lg text-xs font-bold text-[var(--text-muted)] hover:bg-[var(--bg-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
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
