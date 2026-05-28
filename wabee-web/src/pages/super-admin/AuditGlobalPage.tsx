import React, { useState } from 'react';
import { 
    ShieldAlert, 
    ShieldCheck, 
    Info, 
    Search, 
    Filter, 
    Calendar, 
    User,
    RefreshCw
} from 'lucide-react';
import { T, S } from '@/lib/text-tokens';
import { useGlobalAuditEvents, useGlobalAuditDetail } from './global-audit/hooks/useGlobalAuditEvents';
import { GlobalAuditEventList } from './global-audit/components/GlobalAuditEventList';
import { GlobalAuditEventDetailsDrawer } from './global-audit/components/GlobalAuditEventDetailsDrawer';
import { GlobalAuditFilters } from './global-audit/types/globalAudit.types';

export const AuditGlobalPage: React.FC = () => {
    const [page, setPage] = useState(1);
    const [limit] = useState(20);
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [filters, setFilters] = useState<GlobalAuditFilters>({
        search: '',
        category: undefined,
        severity: undefined,
        outcome: undefined
    });
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Hooks de datos
    const { 
        data: auditData, 
        isLoading, 
        isFetching,
        refetch 
    } = useGlobalAuditEvents(page, limit, {
        ...filters,
        search: filters.search && filters.search.length >= 2 ? filters.search : undefined // Solo buscar si hay 2+ caracteres
    });

    const { 
        data: detailData, 
        isLoading: isLoadingDetail 
    } = useGlobalAuditDetail(selectedEventId);

    // Handlers
    const handleFilterChange = (key: keyof GlobalAuditFilters, value: any) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setPage(1); // Reset a primera página al filtrar
    };

    const handleClearFilters = () => {
        setFilters({ search: '', category: undefined, severity: undefined, outcome: undefined });
        setPage(1);
    };

    const handleViewDetail = (id: string) => {
        setSelectedEventId(id);
        setIsDrawerOpen(true);
    };

    const handleCloseDrawer = () => {
        setIsDrawerOpen(false);
        // No limpiamos el ID inmediatamente para evitar parpadeo en la animación de cierre
        setTimeout(() => setSelectedEventId(null), 500);
    };

    const hasActiveFilters = filters.category || filters.severity || filters.outcome;

    return (
        <div className="p-4 sm:p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div>
                    <h1 className={`${T.pageTitle} ${S.displayMd}`}>Auditoría <span className="text-[var(--brand-primary)]">Global</span></h1>
                    <p className={`${T.pageSubtitle} ${S.body}`}>Registro en tiempo real de eventos críticos en todo el ecosistema WABEE.</p>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={() => refetch()}
                        disabled={isFetching}
                        className="flex items-center gap-2 px-5 py-3 border border-[var(--border-default)] rounded-xl text-[var(--text-muted)] hover:bg-[var(--bg-hover)] transition-all disabled:opacity-50"
                    >
                        <RefreshCw size={18} className={isFetching ? 'animate-spin' : ''} /> 
                        <span className={`${T.navText} ${S.body}`}>Refrescar</span>
                    </button>
    
                </div>
            </div>

            {/* Quick Stats (Calculated from Data) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Alertas Críticas', count: auditData?.items.filter(i => i.severity === 'critical').length || 0, color: 'text-red-400', bg: 'bg-red-500/10', icon: ShieldAlert },
                    { label: 'Acciones Org', count: auditData?.items.filter(i => i.category === 'org').length || 0, color: 'text-[var(--brand-primary)]', bg: 'bg-[var(--brand-primary)]/10', icon: User },
                    { label: 'Eventos Sistema', count: auditData?.items.filter(i => i.category === 'system' || i.category === 'auth').length || 0, color: 'text-blue-400', bg: 'bg-blue-500/10', icon: Info },
                    { label: 'Total Eventos', count: auditData?.pagination.total || 0, color: 'text-green-400', bg: 'bg-green-500/10', icon: ShieldCheck },
                ].map((f, i) => (
                    <div key={i} className={`flex items-center justify-between p-4 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] text-left shadow-sm`}>
                        <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg ${f.bg} ${f.color} flex items-center justify-center`}>
                                <f.icon size={16} />
                            </div>
                             <div>
                                 <p className={`${T.helperText} ${S.meta} uppercase tracking-widest opacity-70 transition-opacity`}>{f.label}</p>
                                 <p className={`${T.kpiValue} ${S.body} font-black text-[var(--text-strong)]`}>{f.count}</p>
                             </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Search & Filter Bar */}
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={18} />
                        <input 
                            type="text" 
                            value={filters.search}
                            onChange={(e) => handleFilterChange('search', e.target.value)}
                            placeholder="Buscar por mensaje, actor o ID de destino..." 
                            className={`w-full bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl py-3 pl-12 pr-4 ${T.inputText} ${S.body} outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)] transition-all placeholder:text-[var(--text-muted)]`}
                        />
                    </div>
                    <button 
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className={`flex items-center gap-2 px-5 py-3 border rounded-xl transition-all ${showAdvanced || hasActiveFilters ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5 text-[var(--brand-primary)]' : 'border-[var(--border-default)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'}`}
                    >
                        <Filter size={18} /> 
                        <span className={`${T.navText} ${S.body}`}>Filtrado Avanzado</span>
                        {hasActiveFilters && <div className="w-2 h-2 rounded-full bg-[var(--brand-primary)]" />}
                    </button>
                    {(hasActiveFilters || filters.search) && (
                         <button 
                            onClick={handleClearFilters}
                            className="px-4 py-2 text-[var(--text-muted)] hover:text-red-400 transition-colors text-sm font-medium"
                         >
                             Limpiar
                         </button>
                    )}
                </div>

                {/* Advanced Filter Panel */}
                {showAdvanced && (
                    <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-2xl p-6 grid grid-cols-1 sm:grid-cols-3 gap-6 animate-in slide-in-from-top-4 duration-300">
                        {/* Categoría */}
                        <div className="space-y-2">
                            <label className={`${T.helperText} ${S.meta} text-[var(--text-muted)] uppercase tracking-widest`}>Categoría</label>
                            <select 
                                value={filters.category || ''}
                                onChange={(e) => handleFilterChange('category', e.target.value)}
                                className={`ui-select ${T.inputText} ${S.body}`}
                                style={{ colorScheme: 'dark' }}
                            >
                                <option value="">Todas las categorías</option>
                                <option value="auth">Seguridad / Auth</option>
                                <option value="org">Operaciones ERP (Inbox/Contactos)</option>
                                <option value="templates">Plantillas de WhatsApp</option>
                                <option value="ai">Inteligencia Artificial</option>
                                <option value="widget">Web Widgets</option>
                                <option value="integrations">Integraciones y Herramientas</option>
                                <option value="channels">Canales de Comunicación</option>
                                <option value="campaigns">Campañas Masivas</option>
                                <option value="org">Equipo y Organización</option>
                                <option value="org">Equipo y Organización</option>
                                <option value="super_admin">Administración WABEE</option>
                                <option value="system">Sistema / Config</option>
                                <option value="billing">Plan y Facturación</option>
                            </select>
                        </div>

                        {/* Severidad */}
                        <div className="space-y-2">
                            <label className={`${T.helperText} ${S.meta} text-[var(--text-muted)] uppercase tracking-widest`}>Severidad</label>
                            <select 
                                value={filters.severity || ''}
                                onChange={(e) => handleFilterChange('severity', e.target.value)}
                                className={`ui-select ${T.inputText} ${S.body}`}
                                style={{ colorScheme: 'dark' }}
                            >
                                <option value="">Todas</option>
                                <option value="info">Información</option>
                                <option value="success">Éxitos</option>
                                <option value="warning">Advertencias</option>
                                <option value="critical">Críticos / Errores</option>
                            </select>
                        </div>

                        {/* Resultado */}
                        <div className="space-y-2">
                            <label className={`${T.helperText} ${S.meta} text-[var(--text-muted)] uppercase tracking-widest`}>Resultado</label>
                            <select 
                                value={filters.outcome || ''}
                                onChange={(e) => handleFilterChange('outcome', e.target.value)}
                                className={`ui-select ${T.inputText} ${S.body}`}
                                style={{ colorScheme: 'dark' }}
                            >
                                <option value="">Todo</option>
                                <option value="success">Solo Éxitos</option>
                                <option value="failure">Solo Fallos</option>
                            </select>
                        </div>
                    </div>
                )}
            </div>

            {/* Main Content: Audit List */}
            <GlobalAuditEventList 
                events={auditData?.items || []}
                pagination={auditData?.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 }}
                isLoading={isLoading}
                onViewDetail={handleViewDetail}
                onPageChange={(p) => setPage(p)}
            />

            {/* Detail Drawer */}
            <GlobalAuditEventDetailsDrawer 
                event={detailData?.data || null}
                isOpen={isDrawerOpen}
                onClose={handleCloseDrawer}
            />
        </div>
    );
};
