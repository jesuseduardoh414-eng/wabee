import React from 'react';
import { GlobalAuditEventListItem, GlobalAuditPagination } from '../types/globalAudit.types';
import { GlobalAuditEventRow } from './GlobalAuditEventRow';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { T, S } from '@/lib/text-tokens';

interface Props {
    events: GlobalAuditEventListItem[];
    pagination: GlobalAuditPagination;
    isLoading: boolean;
    onViewDetail: (id: string) => void;
    onPageChange: (page: number) => void;
}

export const GlobalAuditEventList: React.FC<Props> = ({ 
    events, 
    pagination, 
    isLoading, 
    onViewDetail, 
    onPageChange 
}) => {
    if (isLoading && events.length === 0) {
        return (
            <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-[2.5rem] p-12 flex flex-col items-center justify-center animate-pulse">
                <div className="w-16 h-16 rounded-full bg-[var(--bg-hover)] mb-4" />
                <div className="h-4 w-48 bg-[var(--bg-hover)] rounded mb-2" />
                <div className="h-3 w-32 bg-[var(--bg-hover)] rounded opacity-50" />
            </div>
        );
    }

    if (events.length === 0) {
        return (
            <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-[2.5rem] p-16 flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 rounded-[2rem] bg-blue-500/10 text-blue-500 flex items-center justify-center mb-6">
                    <ShieldCheck size={40} />
                </div>
                <h3 className={`${T.pageTitle} ${S.displaySm} mb-2`}>No hay eventos registrados</h3>
                <p className={`${T.pageSubtitle} ${S.body} opacity-60 max-w-sm`}>
                    No se han encontrado registros de auditoría en el sistema con los criterios actuales.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-[2.5rem] overflow-hidden shadow-2xl">
                <div className="divide-y divide-[var(--border-default)]">
                    {events.map((event) => (
                        <GlobalAuditEventRow 
                            key={event.id} 
                            event={event} 
                            onViewDetail={onViewDetail} 
                        />
                    ))}
                </div>

                {/* Footer / Pagination */}
                <div className="p-6 border-t border-[var(--border-default)] bg-[var(--bg-surface)]/30 flex items-center justify-between">
                    <div className={`${T.helperText} ${S.meta} text-[var(--text-muted)]`}>
                        Mostrando <span className="font-bold text-[var(--text-strong)]">{events.length}</span> de <span className="font-bold text-[var(--text-strong)]">{pagination.total}</span> eventos
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <button 
                            disabled={pagination.page <= 1 || isLoading}
                            onClick={() => onPageChange(pagination.page - 1)}
                            className="px-4 py-2 rounded-xl border border-[var(--border-default)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                            Anterior
                        </button>
                        <div className={`px-4 py-2 bg-[var(--bg-hover)] rounded-xl font-bold ${T.tableCell} ${S.meta}`}>
                            Pág. {pagination.page} de {pagination.totalPages}
                        </div>
                        <button 
                            disabled={pagination.page >= pagination.totalPages || isLoading}
                            onClick={() => onPageChange(pagination.page + 1)}
                            className="px-4 py-2 rounded-xl border border-[var(--border-default)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                            Siguiente
                        </button>
                    </div>
                </div>
            </div>
            
            {isLoading && (
                <div className="flex justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--brand-primary)]" />
                </div>
            )}
        </div>
    );
};
