import React, { useState } from 'react';
import { TourButton } from '../../components/TourButton';
import { useQuery } from '@tanstack/react-query';
import { auditApi, AuditLogFilter } from '@/api/wabee/audit.api';
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
        modelType: '',
    });

    const { error: toastError, success: toastSuccess } = useToast();
    const { confirm } = useDialog();

    const { data: result, isLoading } = useQuery({
        queryKey: ['wabee-audit-logs', filters],
        queryFn: () => auditApi.getLogs(filters),
    });

    const handleNextPage = () => {
        if (result && result.offset + result.limit < result.total) {
            setFilters((prev) => ({ ...prev, offset: prev.offset! + prev.limit! }));
        }
    };

    const handlePrevPage = () => {
        if (result && result.offset > 0) {
            setFilters((prev) => ({ ...prev, offset: Math.max(0, prev.offset! - prev.limit!) }));
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
        <div className="mx-auto max-w-7xl space-y-6 px-4 py-5 sm:space-y-8 sm:px-6 sm:py-6">
            <div className="rounded-[28px] border border-[var(--border-default)] bg-[var(--bg-card)] p-5 shadow-xl sm:p-6">
                <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h1 className={`${T.pageTitle} ${S.displayMd} flex flex-wrap items-center gap-3`}>
                                <ShieldAlert className="text-[var(--state-danger)]" size={28} />
                                <span>Registro de</span>
                                <span className="text-[var(--brand-primary)]">Auditoría</span>
                            </h1>
                            <p className={`${T.pageSubtitle} ${S.meta} uppercase tracking-widest`}>
                                Registro inmutable de acciones críticas — solo administradores
                            </p>
                        </div>
                        <TourButton moduleKey="audit" />
                    </div>
                </div>
            </div>

            <div data-tour="audit-tabs" className="inline-flex w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-1 sm:w-auto">
                {([
                    { key: 'system', label: 'Auditoría de sistema' },
                    { key: 'attention', label: 'Auditoría de atención' },
                ] as { key: Tab; label: string }[]).map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`${T.buttonPrimaryText} ${S.ui} flex-1 rounded-xl px-4 py-2 text-center transition-all sm:flex-none ${
                            activeTab === tab.key
                                ? 'bg-[var(--brand-primary)] shadow-lg'
                                : 'text-[color:var(--tx-helperText-color)] hover:text-[var(--brand-primary)]'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'attention' && <InboxAuditPage />}

            {activeTab === 'system' && (
                <>
                    <div data-tour="audit-filters" className="rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-card)] p-4 sm:p-5">
                        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
                            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2">
                                <Filter size={14} className="shrink-0 text-[color:var(--tx-helperText-color)]" />
                                <select
                                    className={`${T.inputText} ${S.meta} w-full cursor-pointer bg-transparent font-bold uppercase tracking-wider outline-none`}
                                    value={filters.modelType || ''}
                                    onChange={(e) => setFilters({ ...filters, modelType: e.target.value, offset: 0 })}
                                >
                                    <option value="" className="bg-[var(--bg-card)]">Todas las entidades</option>
                                    <option value="campaign" className="bg-[var(--bg-card)]">Campañas</option>
                                    <option value="AiProfile" className="bg-[var(--bg-card)]">Perfiles IA</option>
                                    <option value="Role" className="bg-[var(--bg-card)]">Roles</option>
                                </select>
                            </div>

                            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2">
                                <Search size={14} className="shrink-0 text-[color:var(--tx-helperText-color)]" />
                                <input
                                    type="text"
                                    placeholder="Buscar acción..."
                                    className={`${T.inputText} ${S.meta} w-full bg-transparent font-bold uppercase outline-none`}
                                    value={filters.action || ''}
                                    onChange={(e) => setFilters({ ...filters, action: e.target.value.toUpperCase(), offset: 0 })}
                                />
                            </div>

                            <button
                                onClick={handleExport}
                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-primary)] transition-transform hover:scale-105"
                                title="Exportar a JSON"
                            >
                                <Download size={18} />
                            </button>
                        </div>
                    </div>

                    <div data-tour="audit-table" className="overflow-hidden rounded-[28px] border border-[var(--border-default)] bg-[var(--bg-card)] shadow-2xl">
                        <div className="overflow-x-auto">
                            <table className="min-w-[760px] w-full border-collapse text-left">
                                <thead className="border-b border-[var(--border-default)] bg-[var(--bg-elevated)]">
                                    <tr>
                                        <th className={`${T.tableHeader} ${S.meta} w-36 p-4 opacity-80`}>Fecha</th>
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
                                                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--brand-primary)] border-t-transparent" />
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
                                            <tr
                                                key={log.id}
                                                className="border-b border-[var(--border-default)] transition-colors hover:bg-[var(--bg-hover)] last:border-0"
                                            >
                                                <td className={`${T.tableCell} ${S.meta} p-4 font-bold text-[var(--brand-primary)]`}>
                                                    {new Date(log.createdAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex flex-col">
                                                        <span className={`${T.tableCell} ${S.meta} font-bold`}>{log.actor?.name || 'Sistema'}</span>
                                                        <span className={`${T.helperText} ${S.meta}`}>{log.actor?.email || 'N/A'}</span>
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <span
                                                        className={`${T.statusText} ${S.meta} inline-block rounded border px-3 py-1 font-bold uppercase tracking-wider ${
                                                            log.action.includes('DELETE') || log.action.includes('CANCEL') || log.action.includes('FAILED')
                                                                ? 'border-red-500/20 bg-red-500/10 text-red-500'
                                                                : log.action.includes('PARTIAL_FAILURE')
                                                                  ? 'border-orange-500/20 bg-orange-500/10 text-orange-500'
                                                                  : log.action.includes('UPDATE') || log.action.includes('PAUSE')
                                                                    ? 'border-blue-500/20 bg-blue-500/10 text-blue-500'
                                                                    : 'border-green-500/20 bg-green-500/10 text-green-600'
                                                        }`}
                                                    >
                                                        {log.action}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex flex-col">
                                                        <span className={`${T.tableCell} ${S.meta} font-bold`}>{log.modelType}</span>
                                                        <span className={`${T.helperText} ${S.meta} font-mono uppercase`}>
                                                            {log.modelId ? `${log.modelId.split('-')[0]}...` : '-'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <button
                                                        className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-2 text-[color:var(--tx-helperText-color)] transition-all hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
                                                        onClick={async () => {
                                                            await confirm({
                                                                title: 'Detalles del audit log',
                                                                description: `IP: ${log.ipAddress}\nValores nuevos:\n${JSON.stringify(log.newValues, null, 2)}`,
                                                                confirmText: 'Cerrar',
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

                        <div className="flex flex-col gap-3 border-t border-[var(--border-default)] bg-[var(--bg-elevated)] p-4 sm:flex-row sm:items-center sm:justify-between">
                            <p className={`${T.helperText} ${S.meta} uppercase tracking-widest`}>
                                Mostrando {logs.length > 0 ? currentOffset + 1 : 0} - {Math.min(currentOffset + (filters.limit || 20), total)} de {total}
                            </p>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                <button
                                    className={`${T.buttonText} ${S.meta} flex items-center justify-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-2 shadow-sm transition-all hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] disabled:cursor-not-allowed disabled:opacity-50`}
                                    onClick={handlePrevPage}
                                    disabled={currentOffset === 0}
                                >
                                    <ChevronLeft size={16} /> Anterior
                                </button>
                                <button
                                    className={`${T.buttonText} ${S.meta} flex items-center justify-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-2 shadow-sm transition-all hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] disabled:cursor-not-allowed disabled:opacity-50`}
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
