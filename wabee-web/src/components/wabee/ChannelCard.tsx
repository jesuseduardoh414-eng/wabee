import { Channel } from '@/api/wabee/whatsapp.api';
import { T, S } from '@/lib/text-tokens';

interface Props {
    channel: Channel;
    onCheckHealth: (id: string) => void;
    onArchive: (id: string) => void;
    onConfigAi?: (id: string) => void;
    loadingHealth: boolean;
}

export default function ChannelCard({ channel, onCheckHealth, onArchive, onConfigAi, loadingHealth }: Props) {
    const isIncomplete = !channel.phoneNumberId || !channel.wabaId;

    const getStatusBadge = () => {
        if (isIncomplete) return 'bg-[var(--state-warning)]/10 text-[color:var(--state-warning)] border border-[var(--state-warning)]/20';
        const colors = {
            CONNECTED: 'bg-[var(--state-success)]/10 text-[color:var(--state-success)] border border-[var(--state-success)]/20',
            ERROR: 'bg-[var(--state-danger)]/10 text-[color:var(--state-danger)] border border-[var(--state-danger)]/20',
            DISCONNECTED: 'bg-[var(--state-danger)]/10 text-[color:var(--state-danger)] border border-[var(--state-danger)]/20',
        };
        return colors[channel.status as keyof typeof colors] || 'bg-[var(--bg-elevated)] text-[color:var(--text-muted)] border border-[var(--border-default)]';
    };

    return (
        <div className={`bg-[var(--bg-card)] rounded-2xl shadow-xl border p-6 transition-all group ${isIncomplete ? 'border-[var(--state-warning)]/30' : 'border-[var(--border-default)] hover:border-[var(--brand-primary)]/30'}`}>
            <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                        <h3 className={`${T.cardTitle} ${S.displaySm} truncate max-w-[150px] group-hover:text-[color:var(--brand-primary)] transition-colors`} title={channel.name}>
                            {channel.name}
                        </h3>
                        {/* Traffic Light Health Badge */}
                        <div
                            className={`w-3 h-3 rounded-full flex-shrink-0 ${channel.healthStatus === 'GREEN' ? 'bg-[var(--state-success)] shadow-[0_0_8px_var(--state-success)]' :
                                channel.healthStatus === 'YELLOW' ? 'bg-[var(--state-warning)] animate-pulse' :
                                    channel.healthStatus === 'RED' ? 'bg-[var(--state-danger)] animate-pulse' :
                                        'bg-[var(--bg-elevated)]'
                                }`}
                            title={`Salud: ${channel.healthStatus || 'UNKNOWN'}
Último Check: ${channel.lastHealthCheckAt ? new Date(channel.lastHealthCheckAt).toLocaleTimeString() : 'N/A'}
${channel.lastErrorMessage ? `Error: ${channel.lastErrorMessage}` : ''}`}
                        />
                    </div>
                    <p className={`${T.helperText} ${S.body} text-[color:var(--text-muted)] font-medium`}>{channel.displayPhone || 'Sin número'}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                    <span className={`px-2.5 py-0.5 rounded-full ${T.badgeText} ${S.meta} ${getStatusBadge()}`}>
                        {isIncomplete ? 'INCOMPLETE' : channel.status}
                    </span>
                    {channel.healthStatus === 'RED' && (
                        <span className={`${T.badgeText} ${S.meta} text-[color:var(--state-danger)] bg-[var(--state-danger)]/10 px-2 py-0.5 rounded border border-[var(--state-danger)]/20 uppercase tracking-tighter`}>
                            ERROR CRÍTICO
                        </span>
                    )}
                </div>
            </div>

            <div className="space-y-2 mb-4 bg-[var(--bg-page)] p-3 rounded-xl border border-[var(--border-default)]">
                <div className="flex justify-between items-center">
                    <span className={`${T.labelText} ${S.meta} text-[color:var(--text-muted)] opacity-60 uppercase`}>Phone ID</span>
                    <span className={`${T.helperText} ${S.meta} text-[color:var(--text-strong)] font-mono overflow-hidden text-ellipsis`}>{channel.phoneNumberId || '—'}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className={`${T.labelText} ${S.meta} text-[color:var(--text-muted)] opacity-60 uppercase`}>WABA ID</span>
                    <span className={`${T.helperText} ${S.meta} text-[color:var(--text-strong)] font-mono overflow-hidden text-ellipsis`}>{channel.wabaId || '—'}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className={`${T.labelText} ${S.meta} text-[color:var(--text-muted)] opacity-60 uppercase`}>Webhook</span>
                    <span className={`${T.helperText} ${S.meta} font-mono ${channel.webhookStatus === 'VERIFIED' ? 'text-[color:var(--state-success)]' : 'text-[color:var(--state-warning)]'}`}>{channel.webhookStatus || 'UNKNOWN'}</span>
                </div>
            </div>

            <div className="pt-4 border-t border-[var(--border-default)] flex gap-2">
                <button
                    onClick={() => onCheckHealth(channel.id)}
                    disabled={loadingHealth || isIncomplete}
                    className={`flex-1 px-4 py-2 rounded-xl transition-all text-sm font-bold flex items-center justify-center gap-2 ${loadingHealth
                        ? 'bg-[var(--bg-elevated)] text-[color:var(--text-muted)] cursor-not-allowed'
                        : isIncomplete
                            ? 'bg-[var(--bg-elevated)] text-[color:var(--text-muted)]/50 cursor-not-allowed'
                            : 'bg-[var(--brand-primary)]  hover:brightness-110 shadow-lg shadow-[var(--brand-primary)]/10 active:scale-95'
                        } ${T.buttonPrimaryText}`}
                >
                    {loadingHealth && (
                        <svg className="animate-spin h-4 w-4 text-[#121208]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    )}
                    <span className={`${T.buttonPrimaryText} ${S.ui} truncate`}>
                        {loadingHealth ? 'Verificando...' : isIncomplete ? 'Faltan Datos' : 'Verificar Salud'}
                    </span>
                </button>

                {onConfigAi && (
                    <button
                        onClick={() => onConfigAi(channel.id)}
                        disabled={isIncomplete}
                        className={`p-2 rounded-xl transition-all border ${isIncomplete ? 'text-[color:var(--text-muted)]/50 border-[var(--border-default)] cursor-not-allowed' : 'text-[color:var(--brand-primary)] border-[var(--brand-primary)]/30 hover:border-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/10'}`}
                        title="Configuración Atención IA"
                    >
                         <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    </button>
                )}

                <button
                    onClick={() => onArchive(channel.id)}
                    className="p-2 text-[color:var(--state-danger)] hover:bg-[var(--state-danger)]/10 rounded-xl transition-all border border-[var(--border-default)] hover:border-[var(--state-danger)]/30"
                    title="Eliminar (Archivar)"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
            </div>

            <div className={`mt-4 flex justify-between items-center ${T.helperText} ${S.meta} opacity-40 uppercase tracking-widest`}>
                <span>WhatsApp Cloud API</span>
                <span>{channel.createdAt ? new Date(channel.createdAt).toLocaleDateString() : '—'}</span>
            </div>
        </div>
    );
}
