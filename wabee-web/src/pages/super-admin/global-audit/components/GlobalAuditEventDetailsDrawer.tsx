import React from 'react';
import { 
    X, 
    Copy, 
    Check, 
    Calendar, 
    User, 
    Shield, 
    Globe, 
    Terminal,
    Database,
    Fingerprint,
    Info
} from 'lucide-react';
import { GlobalAuditEventDetail } from '../types/globalAudit.types';
import { T, S } from '@/lib/text-tokens';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { getAuditEventLabel, getAuditRoleLabel, getAuditTargetTypeLabel } from '../utils/globalAuditLabels';

interface Props {
    event: GlobalAuditEventDetail | null;
    isOpen: boolean;
    onClose: () => void;
}

export const GlobalAuditEventDetailsDrawer: React.FC<Props> = ({ event, isOpen, onClose }) => {
    const [copied, setCopied] = React.useState(false);

    if (!event) return null;

    const handleCopyJson = () => {
        navigator.clipboard.writeText(JSON.stringify(event, null, 2));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const formatDate = (dateStr: string) => {
        return format(new Date(dateStr), "dd 'de' MMMM, yyyy HH:mm:ss", { locale: es });
    };
    const eventLabel = getAuditEventLabel(event.eventType);

    return (
        <>
            {/* Backdrop */}
            <div 
                className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] transition-opacity duration-300 ${
                    isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
                onClick={onClose}
            />

            {/* Cabinet / Drawer */}
            <div 
                className={`fixed top-0 right-0 h-full w-full max-w-2xl bg-[var(--bg-page)] border-l border-[var(--border-default)] shadow-2xl z-[101] transform transition-transform duration-500 ease-out flex flex-col ${
                    isOpen ? 'translate-x-0' : 'translate-x-full'
                }`}
            >
                {/* Header */}
                <div className="p-6 border-b border-[var(--border-default)] flex items-center justify-between bg-[var(--bg-card)]">
                    <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                            event.severity === 'critical' ? 'bg-red-500/10 border-red-500/20 text-red-500' : 
                            'bg-blue-500/10 border-blue-500/20 text-blue-500'
                        }`}>
                            <Shield size={20} />
                        </div>
                        <div>
                            <h2 className={`${T.cardTitle} text-lg font-black text-[var(--text-strong)]`}>Detalle del Evento</h2>
                            <p className={`${T.helperText} text-[10px] uppercase tracking-widest font-bold opacity-60`}>ID: {event.id}</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-[var(--bg-hover)] rounded-xl transition-colors text-[var(--text-muted)]"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
                    
                    {/* Main Summary */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 px-3 py-1 bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] border border-[var(--brand-primary)]/20 rounded-full w-fit">
                            <Info size={14} />
                            <span className="text-[10px] font-black uppercase tracking-widest">{eventLabel}</span>
                        </div>
                        <h3 className={`${T.pageTitle} ${S.displaySm} leading-tight`}>{event.message}</h3>
                        <p className={`${T.helperText} ${S.meta} uppercase tracking-wide text-[var(--text-muted)]/60`}>
                            Código interno: {event.eventType}
                        </p>
                        <p className={`${T.helperText} ${S.body} opacity-70`}>
                            Este evento fue registrado por el servicio de auditoría global para trazabilidad del sistema.
                        </p>
                    </div>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-2 gap-6">
                        <InfoItem 
                            icon={Calendar} 
                            label="Fecha y Hora" 
                            value={formatDate(event.createdAt)} 
                        />
                        <InfoItem 
                            icon={User} 
                            label="Actor" 
                            value={event.actorEmail || 'Sistema'} 
                            subValue={event.actorRole ? `Rol: ${getAuditRoleLabel(event.actorRole)}` : undefined}
                        />
                        <InfoItem 
                            icon={Globe} 
                            label="Dirección IP" 
                            value={event.ipAddress || 'Origen desconocido'} 
                        />
                        <InfoItem 
                            icon={Fingerprint} 
                            label="ID de solicitud" 
                            value={event.requestId || 'No disponible'} 
                        />
                        <InfoItem 
                            icon={Database} 
                            label="Objetivo" 
                            value={event.targetLabel || event.targetId || 'No disponible'} 
                            subValue={`Tipo: ${getAuditTargetTypeLabel(event.targetType)}`}
                        />
                        <InfoItem 
                            icon={Terminal} 
                            label="Agente de usuario" 
                            value={event.userAgent || 'Desconocido'} 
                            isShorten
                        />
                    </div>

                    {/* JSON Data Viewer */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-[10px] uppercase font-black tracking-[0.2em] text-[var(--text-muted)]">Carga de Datos (Payload)</h4>
                            <button 
                                onClick={handleCopyJson}
                                className="flex items-center gap-2 text-[10px] px-3 py-1.5 bg-[var(--bg-hover)] border border-[var(--border-default)] rounded-lg hover:border-[var(--brand-primary)]/30 transition-all font-bold uppercase"
                            >
                                {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                                {copied ? 'Copiado' : 'Copiar JSON'}
                            </button>
                        </div>
                        
                        <div className="bg-[var(--bg-input)] border border-[var(--border-default)] rounded-2xl p-6 font-mono text-xs overflow-x-auto relative group">
                            {event.isSensitive && (
                                <div className="absolute top-4 right-4 px-2 py-1 bg-yellow-500/10 text-yellow-600 border border-yellow-500/20 rounded text-[9px] font-black uppercase tracking-widest">
                                    Datos Sanitizados
                                </div>
                            )}
                            <pre className="text-[var(--text-strong)] leading-relaxed whitespace-pre-wrap break-all">
                                {JSON.stringify({
                                    oldValues: event.oldValues,
                                    newValues: event.newValues,
                                    metadata: event.metadata
                                }, null, 2)}
                            </pre>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-[var(--border-default)] bg-[var(--bg-card)]">
                    <button 
                        onClick={onClose}
                        className="w-full py-4 bg-[var(--bg-hover)] border border-[var(--border-default)] rounded-2xl font-black text-xs uppercase tracking-widest hover:border-[var(--brand-primary)]/30 transition-all"
                    >
                        Cerrar Panel
                    </button>
                </div>
            </div>
        </>
    );
};

const InfoItem = ({ icon: Icon, label, value, subValue, isShorten }: any) => (
    <div className="space-y-1.5">
        <div className="flex items-center gap-2 opacity-40">
            <Icon size={14} />
            <span className="text-[10px] font-black uppercase tracking-wider">{label}</span>
        </div>
        <div>
            <p className={`${T.tableCell} ${S.body} font-black text-[var(--text-strong)] ${isShorten ? 'truncate max-w-[250px]' : ''}`} title={value}>
                {value}
            </p>
            {subValue && <p className="text-[10px] text-[var(--text-muted)] font-medium mt-0.5">{subValue}</p>}
        </div>
    </div>
);
