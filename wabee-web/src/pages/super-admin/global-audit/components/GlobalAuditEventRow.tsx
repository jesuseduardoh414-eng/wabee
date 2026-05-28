import React from 'react';
import { 
    ShieldAlert, 
    ShieldCheck, 
    Info, 
    ExternalLink, 
    User,
    Key,
    Settings,
    CreditCard,
    Zap
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { GlobalAuditEventListItem, AuditSeverity, AuditCategory } from '../types/globalAudit.types';
import { T, S } from '@/lib/text-tokens';

interface Props {
    event: GlobalAuditEventListItem;
    onViewDetail: (id: string) => void;
}

const getSeverityStyles = (severity: AuditSeverity) => {
    switch (severity) {
        case 'critical':
            return 'bg-red-500/10 border-red-500/20 text-red-500';
        case 'warning':
            return 'bg-yellow-500/10 border-yellow-500/20 text-yellow-600';
        case 'success':
            return 'bg-green-500/10 border-green-500/20 text-green-600';
        default:
            return 'bg-blue-500/10 border-blue-500/20 text-blue-600';
    }
};

const getCategoryIcon = (category: AuditCategory) => {
    switch (category) {
        case 'auth': return ShieldAlert;
        case 'billing': return CreditCard;
        case 'system': return Settings;
        case 'user': return User;
        case 'super_admin': return Key;
        default: return Info;
    }
};

export const GlobalAuditEventRow: React.FC<Props> = ({ event, onViewDetail }) => {
    const Icon = getCategoryIcon(event.category);
    const severityClass = getSeverityStyles(event.severity);
    const timeAgo = formatDistanceToNow(new Date(event.createdAt), { addSuffix: true, locale: es });

    return (
        <div className="p-6 flex flex-col sm:flex-row sm:items-center gap-6 group hover:bg-[var(--brand-primary)]/[0.02] transition-colors border-b border-[var(--border-default)] last:border-0">
            {/* Icon Status */}
            <div className={`w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center border ${severityClass}`}>
                <Icon size={24} />
            </div>

            {/* Event Info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                    <p className={`${T.tableCell} ${S.body} font-black group-hover:text-[var(--brand-primary)] transition-colors text-[var(--text-strong)]`}>
                        {event.eventType}
                    </p>
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${
                        event.severity === 'critical' ? 'border-red-500/30 text-red-600 bg-red-500/5' : 'border-[var(--border-default)] text-[var(--text-muted)]'
                    }`}>
                        {event.severity}
                    </span>
                    {event.isImpersonation && (
                        <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded border border-purple-500/30 text-purple-600 bg-purple-500/5 flex items-center gap-1">
                            <Zap size={10} /> Suplantación
                        </span>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <p className={`${T.helperText} ${S.meta} flex items-center gap-1.5`}>
                        <User size={12} className="opacity-40" />
                        <span className={`${T.tableCell} ${S.meta}`}>{event.actorEmail || 'Sistema'}</span>
                    </p>
                    <span className="text-[var(--border-default)] hidden sm:block">•</span>
                    <p className={`${T.helperText} ${S.meta} italic`}>
                        Contexto: <span className={`${T.helperText} ${S.meta} opacity-80`}>{event.message}</span>
                    </p>
                </div>
            </div>

            {/* Actions & Time */}
            <div className="flex items-center gap-6 shrink-0">
                <p className={`${T.helperText} ${S.meta} opacity-40 font-medium`}>{timeAgo}</p>
                <button 
                    onClick={() => onViewDetail(event.id)}
                    className="p-2 text-[var(--text-muted)] hover:text-[var(--brand-primary)] transition-colors rounded-lg hover:bg-[var(--bg-hover)]"
                    title="Ver detalle completo"
                >
                    <ExternalLink size={18} />
                </button>
            </div>
        </div>
    );
};
