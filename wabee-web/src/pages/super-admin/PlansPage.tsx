import React, { useState, useEffect, useMemo } from 'react';
import { Package, Plus, Search, Filter, SortDesc, Eye, Layers } from 'lucide-react';
import { T, S } from '@/lib/text-tokens';
import { Plan, superAdminPlansApi } from '@/api/wabee/plans.api';

import { PlanFormModal } from './PlanFormModal';
import { PlanVersionsDrawer } from './PlanVersionsDrawer';
import { DeletePlanModal } from './components/DeletePlanModal';
import { PlanCard } from './components/PlanCard';
import { PlanStatusConfirmModal } from './components/PlanStatusConfirmModal';

export const PlansPage = () => {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);

    // Filter & Sort States
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all'|'active'|'draft'|'archived'|'deleted'>('all');
    const [sortBy, setSortBy] = useState<'popular'|'price'|'name'>('popular');
    const [includeDeleted, setIncludeDeleted] = useState(false);

    // Modals
    const [showForm, setShowForm] = useState(false);
    const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
    const [showVersions, setShowVersions] = useState<Plan | null>(null);
    const [deletingPlan, setDeletingPlan] = useState<Plan | null>(null);
    const [confirmAction, setConfirmAction] = useState<{ plan: Plan, action: 'publish' | 'withdraw' | 'archive' } | null>(null);

    const loadPlans = async () => {
        try {
            setLoading(true);
            const data = await superAdminPlansApi.listPlans(includeDeleted);
            setPlans(data);
        } catch (error) {
            console.error('Error loading plans:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPlans();
    }, [includeDeleted]); // Recargar si cambia includeDeleted

    // Computed Plans List
    const filteredAndSortedPlans = useMemo(() => {
        let result = [...plans];

        // Status filter
        if (statusFilter !== 'all') {
            if (statusFilter === 'deleted') {
                result = result.filter(p => !!p.deletedAt);
            } else if (statusFilter === 'active') {
                result = result.filter(p => p.currentVersion?.isPublished && p.status !== 'archived' && !p.deletedAt);
            } else if (statusFilter === 'draft') {
                result = result.filter(p => (!p.currentVersion?.isPublished) && p.status !== 'archived' && !p.deletedAt);
            } else if (statusFilter === 'archived') {
                result = result.filter(p => p.status === 'archived' && !p.deletedAt);
            }
        }

        // Search query
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(p => 
                p.name.toLowerCase().includes(q) || 
                p.code.toLowerCase().includes(q)
            );
        }

        // Sorting
        result.sort((a, b) => {
            if (sortBy === 'popular') {
                // Mayor a menor orgs activas
                const popDiff = b.activeOrgsCount - a.activeOrgsCount;
                if (popDiff !== 0) return popDiff;
                return a.name.localeCompare(b.name);
            }
            if (sortBy === 'price') {
                const priceA = a.currentVersion?.price || 0;
                const priceB = b.currentVersion?.price || 0;
                return priceB - priceA;
            }
            if (sortBy === 'name') {
                return a.name.localeCompare(b.name);
            }
            return 0;
        });

        return result;
    }, [plans, statusFilter, searchQuery, sortBy]);

    // Handlers
    const handleCreate = () => {
        setEditingPlan(null);
        setShowForm(true);
    };

    const handleEdit = (plan: Plan) => {
        setEditingPlan(plan);
        setShowForm(true);
    };

    const handlePublishToggle = (plan: Plan) => {
        const isPublished = plan.currentVersion?.isPublished || false;
        setConfirmAction({ plan, action: isPublished ? 'withdraw' : 'publish' });
    };

    const handleArchive = (plan: Plan) => {
        setConfirmAction({ plan, action: 'archive' });
    };

    const handleUnarchive = async (plan: Plan) => {
        try {
            setLoading(true);
            await superAdminPlansApi.patchPlan(plan.id, { status: 'draft' });
            await loadPlans();
        } catch (e: any) {
            alert(e.response?.data?.error?.message || 'Error al desarchivar plan');
            setLoading(false);
        }
    };

    const handleConfirmStatusChange = async () => {
        if (!confirmAction) return;
        const { plan, action } = confirmAction;
        
        try {
            setLoading(true);
            if (action === 'publish' || action === 'withdraw') {
                await superAdminPlansApi.publishPlan(plan.id, action === 'publish');
            } else if (action === 'archive') {
                await superAdminPlansApi.archivePlan(plan.id);
            }
            await loadPlans();
            setConfirmAction(null);
        } catch (e: any) {
            // Error handling is managed by the modal's onConfirm internal try/catch if we pass it,
            // but here we just need to ensure the loading state is reset if needed or let the modal handle it.
            console.error('Action failed:', e);
            throw e; // Modal expects it to throw to show its errorMsg
        }
    };

    const handleConfirmDelete = async () => {
        if (!deletingPlan) return;
        await superAdminPlansApi.deletePlan(deletingPlan.id);
        setDeletingPlan(null);
        await loadPlans();
    };

    const handleRestore = async (plan: Plan) => {
        try {
            setLoading(true);
            await superAdminPlansApi.restorePlan(plan.id);
            await loadPlans();
        } catch (e: any) {
            alert(e.response?.data?.error?.message || 'Error al restaurar plan');
            setLoading(false);
        }
    };

    return (
        <div className="mx-auto w-full max-w-7xl space-y-6 p-4 animate-in fade-in duration-300 sm:space-y-8 sm:p-6 lg:p-8">
            {/* Header */}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl flex-1">
                    <h1 className={`${T.pageTitle} ${S.displayMd}`}>Planes <span className="text-[var(--brand-primary)]">Comerciales</span></h1>
                    <p className={`${T.pageSubtitle} ${S.body}`}>Gestiona el catálogo de planes, precios y versiones vigentes.</p>
                </div>
                <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:w-auto lg:flex-shrink-0 lg:justify-end">
                    <label className={`flex items-center justify-center gap-2 rounded-full px-1 py-1 cursor-pointer ${T.helperText} ${S.meta} text-[var(--text-muted)] transition-colors hover:text-[var(--text-strong)] sm:justify-start`}>
                        <div className="relative">
                            <input type="checkbox" className="sr-only" checked={includeDeleted} onChange={(e) => setIncludeDeleted(e.target.checked)} />
                            <div className={`block w-10 h-6 rounded-full transition-colors ${includeDeleted ? 'bg-[var(--brand-primary)]' : 'bg-[var(--border-default)]'}`}></div>
                            <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${includeDeleted ? 'transform translate-x-4' : ''}`}></div>
                        </div>
                        Mostrar Eliminados
                    </label>

                    <button 
                        onClick={handleCreate}
                        className={`inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--brand-primary)] px-6 py-3 text-white ${T.buttonPrimaryText} ${S.body} shadow-lg shadow-[var(--brand-primary)]/20 transition-all hover:scale-[1.02] sm:w-auto sm:min-w-[220px]`}
                    >
                        <Plus size={20} /> Crear Plan
                    </button>
                </div>
            </div>

            {/* Toolbar Filters */}
            <div className="flex flex-col gap-4 rounded-[1.75rem] border border-[var(--border-default)] bg-[var(--bg-card)] p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-1 items-center gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-2.5 transition-colors focus-within:border-[var(--brand-primary)]/50">
                    <Search size={18} className="text-[var(--text-muted)]" />
                    <input 
                        type="text" 
                        placeholder="Buscar por nombre o código..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className={`bg-transparent outline-none w-full ${T.inputText} ${S.body} text-[var(--text-strong)] placeholder:text-[var(--text-muted)]/50`}
                    />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:min-w-[460px] lg:justify-end">
                    <div className="flex min-w-0 items-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-2.5">
                        <Filter size={16} className="text-[var(--text-muted)]" />
                        <select 
                            value={statusFilter} 
                            onChange={(e) => setStatusFilter(e.target.value as any)}
                            className={`min-w-0 flex-1 bg-transparent outline-none ${T.inputText} ${S.body} text-[var(--text-strong)] cursor-pointer`}
                        >
                            <option value="all">Todos los estados</option>
                            <option value="active">Publicados</option>
                            <option value="draft">Borradores</option>
                            <option value="archived">Archivados</option>
                            {includeDeleted && <option value="deleted">Eliminados</option>}
                        </select>
                    </div>

                    <div className="flex min-w-0 items-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-2.5">
                        <SortDesc size={16} className="text-[var(--text-muted)]" />
                        <select 
                            value={sortBy} 
                            onChange={(e) => setSortBy(e.target.value as any)}
                            className={`min-w-0 flex-1 bg-transparent outline-none ${T.inputText} ${S.body} text-[var(--text-strong)] cursor-pointer`}
                        >
                            <option value="popular">Más populares</option>
                            <option value="price">Precio (Mayor a menor)</option>
                            <option value="name">Alfabético</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Listado */}
            {loading && plans.length === 0 ? (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="animate-pulse bg-[var(--bg-card)] rounded-[2rem] h-[600px] border border-[var(--border-default)]" />
                    ))}
                </div>
            ) : filteredAndSortedPlans.length === 0 ? (
                <div className="text-center py-20 border border-[var(--border-default)] bg-[var(--bg-card)] rounded-[2rem] flex flex-col items-center">
                    <div className="w-20 h-20 bg-[var(--bg-surface)] rounded-full flex items-center justify-center mb-6 border border-[var(--border-default)]">
                        <Layers size={32} className="text-[var(--text-muted)] opacity-50" />
                    </div>
                    <h3 className={`${T.emptyStateTitle} ${S.displaySm}`}>Catálogo vacío</h3>
                    <p className={`${T.emptyStateBody} ${S.body} mt-2 max-w-sm mx-auto`}>
                        {searchQuery || statusFilter !== 'all' 
                            ? "No hay planes que coincidan con los filtros seleccionados." 
                            : "No hay planes comerciales configurados. Crea el primer plan para empezar a vender."}
                    </p>
                    {(!searchQuery && statusFilter === 'all') && (
                        <button onClick={handleCreate} className={`mt-8 flex items-center gap-2 px-6 py-3 bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] border border-[var(--brand-primary)]/30 rounded-xl ${T.buttonText} ${S.body} hover:bg-[var(--brand-primary)]/20 transition-all font-bold`}>
                            <Plus size={18} /> Crear Primer Plan
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {filteredAndSortedPlans.map((plan) => (
                        <PlanCard 
                            key={plan.id}
                            plan={plan}
                            onEdit={handleEdit}
                            onPublishToggle={handlePublishToggle}
                            onArchive={handleArchive}
                            onDelete={setDeletingPlan}
                            onRestore={handleRestore}
                            onUnarchive={handleUnarchive}
                            onShowVersions={setShowVersions}
                        />
                    ))}
                </div>
            )}

            {/* Modals */}
            {showForm && (
                <PlanFormModal 
                    plan={editingPlan} 
                    onClose={() => setShowForm(false)} 
                    onSaved={() => {
                        setShowForm(false);
                        loadPlans();
                    }} 
                />
            )}

            {showVersions && (
                <PlanVersionsDrawer 
                    planId={showVersions.id} 
                    planName={showVersions.name}
                    onClose={() => setShowVersions(null)} 
                />
            )}

            {deletingPlan && (
                <DeletePlanModal 
                    plan={deletingPlan}
                    onClose={() => setDeletingPlan(null)}
                    onConfirm={handleConfirmDelete}
                />
            )}

            {confirmAction && (
                <PlanStatusConfirmModal 
                    plan={confirmAction.plan}
                    action={confirmAction.action}
                    onClose={() => setConfirmAction(null)}
                    onConfirm={handleConfirmStatusChange}
                />
            )}
        </div>
    );
};
