import React, { useState, useRef, useEffect } from 'react';
import { History, ArrowRight, MoreVertical, Edit2, Play, EyeOff, Archive, Trash2, RotateCcw, Check, Building2, Star } from 'lucide-react';
import { T, S } from '@/lib/text-tokens';
import { Plan } from '@/api/wabee/plans.api';

interface PlanCardProps {
    plan: Plan;
    onEdit: (plan: Plan) => void;
    onPublishToggle: (plan: Plan) => void;
    onArchive: (plan: Plan) => void;
    onDelete: (plan: Plan) => void;
    onRestore: (plan: Plan) => void;
    onUnarchive: (plan: Plan) => void;
    onShowVersions: (plan: Plan) => void;
}

export const PlanCard: React.FC<PlanCardProps> = ({
    plan,
    onEdit,
    onPublishToggle,
    onArchive,
    onDelete,
    onRestore,
    onUnarchive,
    onShowVersions
}) => {
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const cv = plan.currentVersion;
    const isPublished = cv?.isPublished;
    const isArchived = plan.status === 'archived';
    const isDeleted = !!plan.deletedAt;

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setShowMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getUnifiedStatus = () => {
        if (isDeleted) return { label: 'Eliminado', classes: 'border-[var(--state-danger)]/30 bg-[var(--state-danger)]/10 text-[var(--state-danger)]' };
        if (isArchived) return { label: 'Archivado', classes: 'border-[var(--state-warning)]/30 bg-[var(--state-warning)]/10 text-[var(--state-warning)]' };
        
        if (!cv) return { label: 'Custom', classes: 'border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-muted)]' };

        const syncStatus = cv.stripeSyncStatus;
        const isFree = Number(cv.monthlyPrice) === 0 && Number(cv.annualPrice) === 0;

        // 1. Procesos o Errores de Sincronización (Prioridad 1)
        if (!isFree) {
            if (syncStatus === 'PENDING') return { label: 'Sincronizando...', classes: 'border-[var(--brand-primary)]/30 bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] animate-pulse' };
            if (syncStatus === 'FAILED') return { label: 'Sync Fallido ✕', classes: 'border-[var(--state-danger)]/30 bg-[var(--state-danger)]/10 text-[var(--state-danger)]' };
            if (syncStatus === 'PARTIAL') return { label: 'Sync Parcial ⚠', classes: 'border-[var(--state-warning)]/30 bg-[var(--state-warning)]/10 text-[var(--state-warning)]' };
        }

        // 2. Estado Publicado (Si está READY o es Gratis)
        if (isPublished) {
            return { label: 'Publicado ✓', classes: 'border-[var(--state-success)]/30 bg-[var(--state-success)]/10 text-[var(--state-success)]' };
        }

        // 3. Borrador
        return { label: 'Borrador', classes: 'border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-muted)]' };
    };

    const statusInfo = getUnifiedStatus();

    const formatNumber = (price: number) => 
        new Intl.NumberFormat('es-MX', { minimumFractionDigits: 0 }).format(price);

    const formatLimitLabel = (key: string) => {
        const labels: Record<string, string> = {
            users: 'Usuarios',
            aiAgents: 'Agentes IA',
            ai_calls: 'Tokens IA',
            aiTokensPerMonth: 'Tokens IA',
            channels: 'Canales',
            contacts: 'Contactos',
            documents: 'Documentos',
            storage_bytes: 'Almacenamiento',
            storageMb: 'Almacenamiento',
            automations: 'Automatizaciones',
            campaignsPerMonth: 'Campañas',
        };

        return labels[key] || key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim();
    };

    const formatStorageValue = (value: number, key: string) => {
        if (value === -1) return 'Ilimitado';
        if (key === 'storage_bytes') {
            const gb = value / (1024 * 1024 * 1024);
            return gb >= 1 ? `${Number.isInteger(gb) ? gb : gb.toFixed(1)} GB` : `${Math.round(value / (1024 * 1024))} MB`;
        }
        if (key === 'storageMb') {
            return value >= 1024 ? `${Number.isInteger(value / 1024) ? value / 1024 : (value / 1024).toFixed(1)} GB` : `${value} MB`;
        }
        return value.toLocaleString('es-MX');
    };

    const formatLimitText = (key: string, rawValue: unknown) => {
        const label = formatLimitLabel(key);
        const value = typeof rawValue === 'number' ? rawValue : Number(rawValue);

        if (!Number.isFinite(value)) return `${String(rawValue)} ${label}`.toUpperCase();
        if (value === -1) return `${label}: Ilimitado`.toUpperCase();
        if (key === 'storage_bytes' || key === 'storageMb') return `${label}: ${formatStorageValue(value, key)}`.toUpperCase();
        if (key === 'ai_calls' || key === 'aiTokensPerMonth') return `${label}: ${value.toLocaleString('es-MX')}`.toUpperCase();

        return `${value.toLocaleString('es-MX')} ${label}`.toUpperCase();
    };

    return (
        <div className={`group flex flex-col bg-[var(--bg-card)] border-2 rounded-[2rem] transition-all relative min-h-[550px] ${
            plan.isPopular && !isDeleted 
                ? 'border-[var(--brand-primary)] shadow-[0_0_40px_-10px_rgb(var(--brand-primary-rgb)/0.25)]' 
                : 'border-[var(--border-default)] hover:border-[var(--text-muted)]/30'
        } ${isDeleted ? 'opacity-60 grayscale' : ''}`}>
            
            {/* Pop badge centered top */}
            {plan.isPopular && !isDeleted && (
                <div className="absolute left-1/2 -translate-x-1/2 -top-4 px-6 py-1.5 rounded-full bg-[var(--brand-primary)] text-[#0f0f11] font-bold text-xs tracking-widest uppercase flex items-center gap-1.5 z-10 shadow-md">
                    <Star size={14} fill="currentColor" /> RECOMENDADO
                </div>
            )}

            {/* Header Redesign */}
            <div className="px-5 pt-8 pb-2 flex flex-col gap-3 relative sm:px-8 sm:pt-10">
                {/* Fila 1: Badges y Menú */}
                <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2 relative">
                        {/* Etiqueta de Estado Unificada */}
                        <span className={`px-2 py-0.5 rounded border ${statusInfo.classes} font-bold text-[0.6rem] uppercase tracking-wider`}>
                            {statusInfo.label}
                        </span>
                    </div>

                    {/* Menú de acciones */}
                    <div className="relative" ref={menuRef}>
                        <button onClick={() => setShowMenu(!showMenu)} className="p-1 hover:bg-[var(--bg-surface)] rounded-full transition-colors text-[var(--text-muted)]">
                            <MoreVertical size={20} />
                        </button>
                        {showMenu && (
                            <div className="absolute top-8 right-0 z-20 w-48 bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl shadow-[0_8px_30px_rgb(0_0_0/0.4)] py-1 overflow-visible">
                                <div className="px-4 py-2 border-b border-[var(--border-default)]/50">
                                    <span className={`text-[0.6rem] tracking-widest uppercase text-[var(--text-muted)] opacity-70`}>Code: {plan.code}</span>
                                </div>
                                {!isDeleted && (
                                    <>
                                        <button onClick={() => { onEdit(plan); setShowMenu(false); }} className={`w-full text-left px-4 py-2.5 hover:bg-[var(--bg-surface)] text-[var(--text-strong)] ${T.menuText} ${S.body} flex items-center gap-2 transition-colors border-b border-[var(--border-default)]/30`}>
                                            <Edit2 size={16} className="text-[var(--brand-primary)]" /> Configurar Plan
                                        </button>
                                        <button onClick={() => { onPublishToggle(plan); setShowMenu(false); }} className={`w-full text-left px-4 py-2.5 hover:bg-[var(--bg-surface)] text-[var(--text-strong)] ${T.menuText} ${S.body} flex items-center gap-2 transition-colors border-b border-[var(--border-default)]/30`}>
                                            {isPublished ? (
                                                <><EyeOff size={16} className="text-[var(--state-warning)]" /> Retirar Catálogo</>
                                            ) : (
                                                <><Play size={16} fill="currentColor" className="text-[var(--state-success)]" /> Publicar Plan</>
                                            )}
                                        </button>
                                        {isArchived && (
                                            <button onClick={() => { onUnarchive(plan); setShowMenu(false); }} className={`w-full text-left px-4 py-2.5 hover:bg-[var(--bg-surface)] text-[var(--text-strong)] ${T.menuText} ${S.body} flex items-center gap-2 transition-colors border-b border-[var(--border-default)]/30`}>
                                                <RotateCcw size={16} className="text-[var(--state-success)]" /> Desarchivar Plan
                                            </button>
                                        )}
                                        {!isPublished && !isArchived && (
                                            <button onClick={() => { onArchive(plan); setShowMenu(false); }} className={`w-full text-left px-4 py-2.5 hover:bg-[var(--bg-surface)] text-[var(--text-strong)] ${T.menuText} ${S.body} flex items-center gap-2 transition-colors border-b border-[var(--border-default)]/30`}>
                                                <Archive size={16} className="text-[var(--state-warning)]" /> Archivar Catálogo
                                            </button>
                                        )}
                                    </>
                                )}
                                {isDeleted ? (
                                    <button onClick={() => { onRestore(plan); setShowMenu(false); }} className={`w-full text-left px-4 py-2.5 hover:bg-[var(--bg-surface)] text-[var(--text-strong)] ${T.menuText} ${S.body} flex items-center gap-2 transition-colors`}>
                                        <RotateCcw size={16} className="text-[var(--state-success)]" /> Restaurar Plan
                                    </button>
                                ) : (
                                    <button onClick={() => { onDelete(plan); setShowMenu(false); }} className={`w-full text-left px-4 py-2.5 hover:bg-[var(--state-danger)]/10 text-[var(--state-danger)] ${T.menuText} ${S.body} flex items-center gap-2 transition-colors`}>
                                        <Trash2 size={16} /> Eliminar Plan
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Fila 2: Nombre del Plan */}
                <div className="flex-1">
                    <h3 className={`${T.cardTitle} ${S.headingSm} text-[var(--text-strong)]`}>{plan.name}</h3>
                </div>
            </div>

            {/* Pricing */}
            <div className="px-5 pb-6 flex flex-col gap-1 sm:px-8 sm:pb-8">
                {cv ? (
                    <>
                        <div className="flex items-baseline gap-1.5">
                            <span className={`${T.kpiValue} ${S.displaySm} text-[var(--text-strong)]`}>
                                ${formatNumber(cv.monthlyPrice)}
                            </span>
                            <span className={`${T.sectionSubtitle} ${S.headingSm} text-[var(--text-strong)] opacity-80`}>
                                {cv.currency.toUpperCase()}
                            </span>
                            <span className={`${T.helperText} ${S.meta} uppercase tracking-widest mb-1.5`}>
                                / mes
                            </span>
                        </div>
                        {/* Sin anualidad: la facturación es solo mensual. */}
                    </>
                ) : (
                    <span className={`${T.pageTitle} ${S.displaySm} text-[var(--text-strong)] italic h-[72px] flex items-center tracking-tight`}>
                        Custom
                    </span>
                )}
            </div>

            <div className="mx-5 bg-[var(--border-default)] h-[1px] sm:mx-8" />

            {/* Limits summary */}
            <div className="px-5 py-6 flex-1 space-y-4 sm:px-8 sm:py-8">
                {cv ? Object.entries(cv.limitsJson || {}).slice(0, 6).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded-full bg-[var(--brand-primary)]/20 flex items-center justify-center shrink-0">
                            <Check size={12} className="text-[var(--brand-primary)]" strokeWidth={4} />
                        </div>
                        <span className={`${T.sectionSubtitle} ${S.body} uppercase tracking-widest font-bold opacity-90`}>
                            {formatLimitText(key, val)}
                        </span>
                    </div>
                )) : (
                    <div className="text-[var(--text-muted)] text-sm tracking-wide">
                        Solución a medida
                    </div>
                )}
                
                {cv && Object.keys(cv.limitsJson || {}).length > 6 && (
                    <div className="flex items-center gap-3 opacity-60">
                        <div className="w-5 h-5 flex items-center justify-center shrink-0 text-[var(--text-muted)]">
                            <MoreVertical size={16} />
                        </div>
                        <span className={`text-[var(--text-muted)] text-xs font-bold uppercase tracking-widest`}>
                            +{Object.keys(cv.limitsJson || {}).length - 6} límites más
                        </span>
                    </div>
                )}

                <div className="pt-6 space-y-3 opacity-80 mt-auto">
                    <div className="flex items-center gap-3 group">
                        <div className="w-5 h-5 flex items-center justify-center shrink-0">
                            <Building2 size={16} className={`${T.helperText} group-hover:text-[var(--brand-primary)] transition-colors`} />
                        </div>
                        <span className={`${T.helperText} ${S.meta} group-hover:text-[var(--brand-primary)] transition-colors uppercase tracking-widest font-bold`}>
                            <strong className="text-[var(--brand-primary)] group-hover:text-[var(--brand-primary)] transition-colors">{plan.activeOrgsCount}</strong> Organizaciones
                        </span>
                    </div>
                    <div className="flex items-center gap-3 group/vers cursor-pointer" onClick={() => onShowVersions(plan)}>
                        <div className="w-5 h-5 flex items-center justify-center shrink-0">
                            <History size={16} className={`${T.helperText} group-hover/vers:text-[var(--brand-primary)] transition-colors`} />
                        </div>
                        <span className={`${T.helperText} ${S.meta} group-hover/vers:text-[var(--brand-primary)] transition-colors uppercase tracking-widest font-bold flex items-center gap-2`}>
                            <strong className="text-[var(--brand-primary)]">{plan.versionsCount}</strong> Versiones <ArrowRight size={14} className="opacity-0 group-hover/vers:opacity-100 transition-opacity" />
                        </span>
                    </div>
                </div>
            </div>

        </div>
    );
};
