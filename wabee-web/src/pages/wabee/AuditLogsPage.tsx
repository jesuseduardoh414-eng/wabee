import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { auditApi, AuditLogFilter, AuditLog } from '@/api/wabee/audit.api';
import { ShieldAlert, Search, Filter, Download, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { useToast } from '@/context/ToastContext';
import { useDialog } from '@/context/DialogContext';
import InboxAuditPage from './audit/InboxAuditPage';
import { T, S } from '@/lib/text-tokens';

type Tab = 'system' | 'attention';

export default function AuditLogsPage() {
    const [activeTab, setActiveTab] = useState<Tab>('system');

    const [filters, setFilters] = useState<AuditLogFilter>({
        limit: 20,
        offset: 0,
        action: '',
        modelType: ''
    });

    const { error: toastError, success: toastSuccess } = useToast();
    const { confirm } = useDialog();

    const { data: result, isLoading } = useQuery({
        queryKey: ['wabee-audit-logs', filters],
        queryFn: () => auditApi.getLogs(filters)
    });

    const handleNextPage = () => {
        if (result && result.offset + result.limit < result.total) {
            setFilters(prev => ({ ...prev, offset: prev.offset! + prev.limit! }));
        }
    };

    const handlePrevPage = () => {
        if (result && result.offset > 0) {
            setFilters(prev => ({ ...prev, offset: Math.max(0, prev.offset! - prev.limit!) }));
        }
    };

    const handleExport = async () => {
        try {
            const data = await auditApi.exportLogs({ ...filters, limit: 1000 });
            const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `audit_logs_${new Date().toISOString()}.json`;
            a.click();
            window.URL.revokeObjectURL(url);
            toastSuccess('Registros exportados exitosamente');
        } catch (error) {
            console.error('Export failed', error);
            toastError('Error exportando los registros.');
        }
    };

    const logs = result?.items || [];
    const total = result?.total || 0;
    const currentOffset = result?.offset || 0;

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--bg-card)] border border-[var(--border-default)] p-6 rounded-3xl shadow-xl">
                <div>
                    <h1 className={`${T.pageTitle} ${S.displayMd} flex items-center gap-3`}>
                        <ShieldAlert className="text-[var(--state-danger)]" size={32} />
                        Registro de <span className="text-[var(--brand-primary)]">Auditoría</span>
                    </h1>
                    <p className={`${T.pageSubtitle} ${S.meta} mt-1 uppercase tracking-widest`}>
                        Registro inmutable de acciones críticas — Solo Administradores
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-xl p-1 w-fit">
                {([
                    { key: 'system',    label: 'Auditoría de Sistema' },
                    { key: 'attention', label: 'Auditoría de Atención' },
                ] as { key: Tab; label: string }[]).map(t => (
                    <button
                        key={t.key}
                        onClick={() => setActiveTab(t.key)}
                        className={`${T.buttonPrimaryText} ${S.ui} px-4 py-1.5 rounded-lg transition-all ${
 activeTab === t.key
 ? 'bg-[var(--brand-primary)] shadow-lg'
 : 'text-[color:var(--tx-helperText-color)] hover:text-[var(--brand-primary)]'
 }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Tab: Auditoría de Atención */}
            {activeTab === 'attention' && <InboxAuditPage />}

            {/* Tab: Auditoría de Sistema */}
            {activeTab === 'system' && (
                <>
                    {/* Filters row */}
                    <div className="flex flex-wrap items-center gap-3 bg-[var(--bg-card)] border border-[var(--border-default)] p-4 rounded-2xl">
                        <div className="flex items-center gap-2 bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl px-3 py-2">
                            <Filter size={14} className="text-[color:var(--tx-helperText-color)]" />
                            <select
                                className={`${T.inputText} ${S.meta} bg-transparent outline-none cursor-pointer font-bold uppercase tracking-wider`}
                                value={filters.modelType || ''}
                                onChange={(e) => setFilters({ ...filters, modelType: e.target.value, offset: 0 })}
                            >
                                <option value="" className="bg-[var(--bg-card)]">Todas las Entidades</option>
                                <option value="campaign" className="bg-[var(--bg-card)]">Campañas</option>
                                <option value="AiProfile" className="bg-[var(--bg-card)]">Perfiles IA</option>
                                <option value="Role" className="bg-[var(--bg-card)]">Roles</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-2 bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl px-3 py-2">
                            <Search size={14} className="text-[color:var(--tx-helperText-color)]" />
                            <input
                                type="text"
                                placeholder="Buscar acción..."
                                className={`${T.inputText} ${S.meta} bg-transparent outline-none w-24 focus:w-32 transition-all font-bold uppercase`}
                                value={filters.action || ''}
                                onChange={(e) => setFilters({ ...filters, action: e.target.value.toUpperCase(), offset: 0 })}
                            />
                        </div>

                        <button
                            onClick={handleExport}
                            className="p-2 bg-[var(--brand-primary)]  rounded-xl hover:scale-105 transition-transform"
                            title="Exportar a JSON"
                        >
                            <Download size={18} />
                        </button>
                    </div>

                    {/* Table */}
                    <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-3xl overflow-hidden shadow-2xl">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-[var(--bg-elevated)] border-b border-[var(--border-default)]">
                                    <tr>
                                        <th className={`${T.tableHeader} ${S.meta} p-4 w-40 opacity-80`}>Fecha</th>
                                        <th className={`${T.tableHeader} ${S.meta} p-4 opacity-80`}>Usuario</th>
                                        <th className={`${T.tableHeader} ${S.meta} p-4 opacity-80`}>Acción</th>
                                        <th className={`${T.tableHeader} ${S.meta} p-4 opacity-80`}>Entidad</th>
                                        <th className={`${T.tableHeader} ${S.meta} p-4 text-center opacity-80`}>Detalle</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={5} className="p-10 text-center">
                                                <div className="flex justify-center">
                                                    <div className="w-6 h-6 border-2 border-[var(--brand-primary)] border-t-transparent rounded-full animate-spin"></div>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : logs.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className={`${T.helperText} ${S.body} p-10 text-center opacity-60`}>
                                                No se encontraron registros de auditoría.
                                            </td>
                                        </tr>
                                    ) : (
                                        logs.map((log) => (
                                            <tr key={log.id} className="border-b border-[var(--border-default)] last:border-0 hover:bg-[var(--bg-hover)] transition-colors">
                                                <td className={`${T.tableCell} ${S.meta} p-4 text-[var(--brand-primary)] font-bold`}>
                                                    {new Date(log.createdAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex flex-col">
                                                        <span className={`${T.tableCell} ${S.meta} font-bold`}>{log.actor?.name || 'Sistema'}</span>
                                                        <span className={`${T.helperText} ${S.meta}`}>{log.actor?.email || 'N/A'}</span>
                                                    </div>
                                                </td>
                                                 <td className="p-4">
                                                    <span className={`${T.statusText} ${S.meta} font-black px-3 py-1 rounded inline-block border border-current uppercase tracking-wider ${
                                                        log.action.includes('DELETE') || log.action.includes('CANCEL') || log.action.includes('FAILED')
                                                            ? 'bg-red-500/10 text-red-500 border-red-500/20'
                                                            : log.action.includes('PARTIAL_FAILURE')
                                                                ? 'bg-orange-500/10 text-orange-500 border-orange-500/20'
                                                                : log.action.includes('UPDATE') || log.action.includes('PAUSE')
                                                                    ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                                                                    : 'bg-green-500/10 text-green-600 border-green-500/20'
                                                    }`}>
                                                        {log.action}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex flex-col">
                                                        <span className={`${T.tableCell} ${S.meta} font-bold`}>{log.modelType}</span>
                                                        <span className={`${T.helperText} ${S.meta} uppercase font-mono`}>{log.modelId ? log.modelId.split('-')[0] + '...' : '-'}</span>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <button
                                                        className="p-2 bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-xl hover:text-[var(--brand-primary)] hover:border-[var(--brand-primary)] transition-all text-[color:var(--tx-helperText-color)]"
                                                        onClick={async () => {
                                                            await confirm({
                                                                title: 'Detalles del Audit Log',
                                                                description: `IP: ${log.ipAddress}\nValores Nuevos:\n${JSON.stringify(log.newValues, null, 2)}`,
                                                                confirmText: 'Cerrar'
                                                            });
                                                        }}
                                                    >
                                                        <Eye size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="p-4 border-t border-[var(--border-default)] bg-[var(--bg-elevated)] flex items-center justify-between">
                            <p className={`${T.helperText} ${S.meta} uppercase tracking-widest`}>
                                Mostrando {logs.length > 0 ? currentOffset + 1 : 0} - {Math.min(currentOffset + (filters.limit || 20), total)} de {total}
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    className={`${T.buttonText} ${S.meta} py-2 px-4 bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl hover:text-[var(--brand-primary)] hover:border-[var(--brand-primary)] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-sm`}
                                    onClick={handlePrevPage}
                                    disabled={currentOffset === 0}
                                >
                                    <ChevronLeft size={16} /> Anterior
                                </button>
                                <button
                                    className={`${T.buttonText} ${S.meta} py-2 px-4 bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl hover:text-[var(--brand-primary)] hover:border-[var(--brand-primary)] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-sm`}
                                    onClick={handleNextPage}
                                    disabled={currentOffset + (filters.limit || 20) >= total}
                                >
                                    Siguiente <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
