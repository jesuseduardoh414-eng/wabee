import React, { useEffect, useState } from 'react';
import { X, History, CheckCircle2, Clock } from 'lucide-react';
import { T, S } from '@/lib/text-tokens';
import { PlanVersion, superAdminPlansApi } from '@/api/wabee/plans.api';

interface PlanVersionsDrawerProps {
    planId: string;
    planName: string;
    onClose: () => void;
}

export const PlanVersionsDrawer: React.FC<PlanVersionsDrawerProps> = ({ planId, planName, onClose }) => {
    const [versions, setVersions] = useState<PlanVersion[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        superAdminPlansApi.getVersions(planId)
            .then(setVersions)
            .finally(() => setLoading(false));
    }, [planId]);

    const formatDate = (d: string | null) =>
        d ? new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

    const formatCurrency = (price: number, currency: string) =>
        new Intl.NumberFormat('es-MX', { style: 'currency', currency: currency.toUpperCase(), minimumFractionDigits: 2 }).format(price);

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative z-10 w-full max-w-lg h-full bg-[var(--bg-card)] border-l border-[var(--border-default)] shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-[var(--border-default)] flex-shrink-0">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <History size={20} className="text-[var(--brand-primary)]" />
                            <h2 className={`${T.cardTitle} ${S.headingLg}`}>Historial de Versiones</h2>
                        </div>
                        <p className={`${T.helperText} ${S.meta}`}>{planName}</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl text-[var(--text-muted)] hover:bg-[var(--bg-hover)] transition-all"><X size={20} /></button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {loading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="animate-pulse bg-[var(--bg-surface)] rounded-2xl h-28" />
                        ))
                    ) : versions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40">
                            <History size={40} className="text-[var(--text-muted)]/20 mb-4" />
                            <p className={`${T.emptyStateBody} ${S.body}`}>Sin historial de versiones</p>
                        </div>
                    ) : (
                        versions.map((v) => (
                            <div key={v.id} className={`p-5 rounded-2xl border transition-all ${v.isCurrent ? 'border-[var(--brand-primary)]/40 bg-[var(--brand-primary)]/[0.04]' : 'border-[var(--border-default)] bg-[var(--bg-surface)]'}`}>
                                {/* Version header */}
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <span className={`${T.cardTitle} ${S.headingLg} text-[var(--brand-primary)]`}>
                                            v{v.versionNumber}
                                        </span>
                                        {v.displayCode && (
                                            <span className={`px-2 py-0.5 rounded-md border border-[var(--border-default)] ${T.helperText} ${S.meta} text-[var(--text-muted)]`}>
                                                {v.displayCode}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {v.isCurrent && (
                                            <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--brand-primary)]/15 ${T.badgeText} ${S.meta} text-[var(--brand-primary)] font-bold`}>
                                                <CheckCircle2 size={12} /> Vigente
                                            </span>
                                        )}
                                        {v.isPublished ? (
                                            <span className={`px-2.5 py-1 rounded-full bg-[var(--state-success)]/10 border border-[var(--state-success)]/20 ${T.badgeText} ${S.meta} text-[var(--state-success)]`}>
                                                Publicada
                                            </span>
                                        ) : (
                                            <span className={`px-2.5 py-1 rounded-full bg-[var(--bg-surface)] border border-[var(--border-default)] ${T.badgeText} ${S.meta} text-[var(--text-muted)]`}>
                                                No publicada
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Pricing */}
                                <p className={`${T.cardTitle} ${S.headingLg} mb-3`}>
                                    {formatCurrency(v.price, v.currency)}
                                    <span className={`${T.helperText} ${S.meta} ml-1`}>/ {v.billingInterval === 'month' ? 'mes' : 'año'}</span>
                                </p>

                                {/* Limits summary */}
                                {v.limitsJson && Object.keys(v.limitsJson || {}).length > 0 && (
                                    <div className={`flex flex-wrap gap-2 mb-3`}>
                                        {Object.entries(v.limitsJson || {}).slice(0, 4).map(([k, val]) => (
                                            <span key={k} className={`px-2 py-0.5 rounded-md bg-[var(--bg-card)] border border-[var(--border-default)] ${T.helperText} ${S.meta} text-[var(--text-muted)]`}>
                                                {k.replace(/([A-Z])/g, ' $1').trim()}: {String(val)}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Dates */}
                                <div className={`flex items-center gap-4 ${T.helperText} ${S.meta} text-[var(--text-muted)]/70`}>
                                    <span className="flex items-center gap-1"><Clock size={12} /> Desde: {formatDate(v.effectiveFrom)}</span>
                                    {v.effectiveTo && <span>Hasta: {formatDate(v.effectiveTo)}</span>}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Info footer */}
                <div className="p-4 border-t border-[var(--border-default)] bg-[var(--bg-surface)]/50 flex-shrink-0">
                    <p className={`${T.helperText} ${S.meta} text-[var(--text-muted)]/60 text-center`}>
                        Las suscripciones existentes conservan el snapshot de la versión que compraron
                    </p>
                </div>
            </div>
        </div>
    );
};
