import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
    getCampaigns,
    operateCampaign,
    Campaign
} from '@/api/wabee/campaigns.api';
import { connectCampaignStream, RealtimeEventType } from '@/services/wabee/realtime.client';
import CampaignWizard from '@/components/wabee/CampaignWizard';
import { T, S } from '@/lib/text-tokens';
import {
    Send,
    Plus,
    Pause,
    Play,
    XCircle,
    AlertCircle,
    BarChart3,
    MoreVertical,
    CheckCircle2,
    Clock,
    Search,
    Wifi,
    WifiOff,
    Calendar,
} from 'lucide-react';
import { useToast } from '@/context/ToastContext';
import { useDialog } from '@/context/DialogContext';

// ─── Connection status indicator ──────────────────────────────────────────────
type ConnectionState = 'connecting' | 'live' | 'polling' | 'offline';

export default function CampaignsPage() {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [showWizard, setShowWizard] = useState(false);
    const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');

    const { error: toastError, success: toastSuccess } = useToast();
    const { confirm } = useDialog();

    // States for the dropdown and editing logic
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
    const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);
    const menuButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

    // Refs para SSE y polling
    const streamRef = useRef<{ close: () => void } | null>(null);
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── Fetch completo de campañas ─────────────────────────────────────────────
    const fetchCampaigns = useCallback(async (suppressLoading = false) => {
        try {
            if (!suppressLoading) setLoading(true);
            const data = await getCampaigns();
            setCampaigns(data);
            setError(null);
        } catch (err: any) {
            console.error('Error fetching campaigns:', err);
            setError(err.message || 'Error al cargar las campañas');
        } finally {
            if (!suppressLoading) setLoading(false);
        }
    }, []);

    // ── Patch local de una campaña sin refetch ─────────────────────────────────
    const patchCampaign = useCallback((campaignId: string, payload: Partial<Campaign>) => {
        setCampaigns(prev => prev.map(c =>
            c.id === campaignId ? { ...c, ...payload } : c
        ));
    }, []);

    // ── Fallback polling ───────────────────────────────────────────────────────
    // Corre cada 5s mientras la página esté abierta.
    // NO se detiene automáticamente: el usuario puede iniciar campañas en cualquier momento.
    const startPolling = useCallback(() => {
        if (pollingRef.current) return; // ya corre
        setConnectionState('polling');
        console.log('[CampaignsPage] Activando polling fallback cada 5s.');

        pollingRef.current = setInterval(async () => {
            try {
                const data = await getCampaigns();
                setCampaigns(data);
            } catch (err) {
                console.error('[CampaignsPage] Error en polling:', err);
            }
        }, 5000);
    }, []);

    const stopPolling = useCallback(() => {
        if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }
    }, []);

    // ── Manejador de eventos SSE ───────────────────────────────────────────────
    const handleRealtimeEvent = useCallback((event: RealtimeEventType) => {
        if (event.type === 'campaign.metrics' || event.type === 'campaign.status') {
            patchCampaign(event.campaignId, event.payload as Partial<Campaign>);
        }
    }, [patchCampaign]);

    // ── Conectar SSE al montar, desconectar al desmontar ──────────────────────
    useEffect(() => {
        // Carga inicial
        fetchCampaigns();

        // Abrir stream SSE
        setConnectionState('connecting');
        streamRef.current = connectCampaignStream(handleRealtimeEvent, {
            maxRetries: 3,
            onConnected: () => {
                // SSE conectó exitosamente → detener polling si estaba activo
                stopPolling();
                setConnectionState('live');
            },
            onFallback: () => {
                // SSE falló 3 veces → activar polling
                setConnectionState('polling');
                startPolling();
            },
        });

        return () => {
            streamRef.current?.close();
            stopPolling();
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Acciones de campaña ────────────────────────────────────────────────────
    const handleAction = async (id: string, action: 'START' | 'PAUSE' | 'RESUME' | 'CANCEL') => {
        try {
            await operateCampaign(id, action);
            // Si SSE está activo, el evento llegará solo.
            // Si estamos en polling o offline, haeer fetch inmediato para reflejar el cambio.
            if (connectionState !== 'live') {
                await fetchCampaigns(true);
            }
        } catch (err: any) {
            toastError(err.message || 'Error al ejecutar acción sobre la campaña');
        }
    };

    const handleDelete = async (id: string) => {
        const isConfirmed = await confirm({
            title: 'Eliminar Campaña',
            description: '¿Estás seguro de que deseas eliminar esta campaña de forma permanente?',
            isDestructive: true,
            confirmText: 'Eliminar'
        });
        if (!isConfirmed) return;

        try {
            setLoading(true);
            const { deleteCampaign } = await import('@/api/wabee/campaigns.api');
            await deleteCampaign(id);
            toastSuccess('Campaña eliminada correctamente');
            await fetchCampaigns();
        } catch (err: any) {
            toastError(err.message || 'Error al eliminar campaña');
            setLoading(false);
        }
    };

    // ── Helpers de UI ──────────────────────────────────────────────────────────
    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'IN_PROGRESS': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
            case 'COMPLETED': return 'bg-green-500/10 text-green-500 border-green-500/20';
            case 'PAUSED': return 'bg-[#ead018]/10 text-[#ead018] border-[#ead018]/20';
            case 'SCHEDULED': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
            case 'CANCELED': return 'bg-red-500/10 text-red-500 border-red-500/20';
            default: return 'bg-[#2a2a1a] text-[#a0a080] border-[#3a3a2a]';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'IN_PROGRESS': return <Play size={10} className="fill-current" />;
            case 'COMPLETED': return <CheckCircle2 size={10} />;
            case 'PAUSED': return <Pause size={10} className="fill-current" />;
            case 'SCHEDULED': return <Clock size={10} />;
            case 'CANCELED': return <XCircle size={10} />;
            default: return <AlertCircle size={10} />;
        }
    };

    const getConnectionBadge = () => {
        switch (connectionState) {
            case 'live':
                return (
                    <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-green-400">
                        <Wifi size={10} />
                        <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400"></span>
                        </span>
                        En vivo
                    </span>
                );
            case 'polling':
                return (
                    <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-[var(--brand-primary)]">
                        <WifiOff size={10} />
                        Polling (5s)
                    </span>
                );
            case 'connecting':
                return (
                    <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-[color:var(--tx-helperText-color)]">
                        <span className="animate-spin w-2 h-2 border border-[color:var(--tx-helperText-color)] border-t-transparent rounded-full"></span>
                        Conectando...
                    </span>
                );
            default:
                return null;
        }
    };

    const filteredCampaigns = campaigns.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-6 max-w-7xl mx-auto min-h-screen">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <h1 className={`${T.pageTitle} ${S.displayLg}`}>Campaigns Hub</h1>
                        {getConnectionBadge()}
                    </div>
                    <p className={`${T.pageSubtitle} ${S.body} mt-1`}>
                        Gestiona y monitorea tus campañas masivas de WhatsApp Cloud API.
                    </p>
                </div>
                <button
                    onClick={() => setShowWizard(true)}
                    className={`${T.buttonPrimaryText} ${S.body} px-6 py-3 bg-[var(--brand-primary)] rounded-2xl hover:brightness-110 transition-all font-black shadow-xl shadow-[#ead018]/10 flex items-center gap-2 active:scale-95 group`}
                >
                    <Plus size={18} className="group-hover:rotate-90 transition-transform" />
                    Nueva Campaña
                </button>
            </div>

            <div className="mb-8 relative max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--tx-helperText-color)]" size={16} />
                <input
                    type="text"
                    placeholder="Buscar campaña por nombre..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={`${T.inputText} ${S.body} w-full bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl py-2.5 pl-11 pr-4 focus:outline-none focus:border-[var(--brand-primary)] transition-all font-bold`}
                />
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center h-80 bg-[var(--bg-card)] rounded-3xl border border-[var(--border-default)]">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--brand-primary)]"></div>
                    <p className={`${T.helperText} ${S.meta} mt-4 uppercase tracking-[0.3em]`}>Cargando Motor...</p>
                </div>
            ) : error ? (
                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-8 text-center">
                    <p className={`${T.helperText} ${S.body} text-red-500`}>{error}</p>
                </div>
            ) : filteredCampaigns.length === 0 ? (
                <div className="bg-[var(--bg-card)] rounded-3xl border border-[var(--border-default)] p-20 text-center shadow-2xl">
                    <div className="w-20 h-20 bg-[var(--bg-elevated)] rounded-full mx-auto mb-6 flex items-center justify-center border border-[var(--border-default)] text-[color:var(--tx-helperText-color)]">
                        <Send size={32} />
                    </div>
                    <h3 className={`${T.emptyStateTitle} ${S.headingLg} mb-2`}>No hay campañas activas</h3>
                    <p className={`${T.emptyStateBody} ${S.body} mb-8 max-w-sm mx-auto`}>Crea tu primera campaña para empezar a conectar con tus clientes masivamente.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {filteredCampaigns.map((campaign) => (
                        <div key={campaign.id} className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-2xl p-5 hover:border-[var(--brand-primary)] transition-all group relative overflow-hidden shadow-sm">
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-[var(--bg-elevated)] rounded-xl flex items-center justify-center border border-[var(--border-default)] text-[var(--brand-primary)] group-hover:bg-[var(--brand-primary)]/10 transition-colors">
                                        <Send size={20} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className={`${T.cardTitle} ${S.headingMd}`}>{campaign.name}</h3>
                                            <span className={`${T.statusText} ${S.ui} px-2 py-0.5 font-bold rounded-full border flex items-center gap-1.5 transition-all uppercase tracking-widest ${getStatusStyle(campaign.status)}`}>
                                                {getStatusIcon(campaign.status)}
                                                {campaign.status}
                                            </span>
                                        </div>
                                        <p className={`${T.helperText} ${S.meta}`}>
                                            Canal: <span className="text-[var(--ty-strong)]">{campaign.channel?.name || 'Varios'}</span> •
                                            Audiencia: <span className="text-[var(--ty-strong)]">{campaign.audienceType}</span> ({campaign.estimatedRecipients})
                                        </p>
                                    </div>
                                </div>

                                {/* KPI counters — se actualizan vía SSE o polling */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-12 flex-1 max-w-3xl px-4">
                                    <div className="text-center md:text-left">
                                        <p className={`${T.kpiLabel} ${S.meta} mb-1`}>Enviados</p>
                                        <p className={`${T.kpiValue} ${S.kpiMd} tabular-nums`}>{campaign.sentCount || 0}</p>
                                    </div>
                                    <div className="text-center md:text-left">
                                        <p className={`${T.kpiLabel} ${S.meta} mb-1`}>Entregados</p>
                                        <p className={`${T.kpiValue} ${S.kpiMd} tabular-nums`}>{campaign.deliveredCount || 0}</p>
                                    </div>
                                    <div className="text-center md:text-left">
                                        <p className={`${T.kpiLabel} ${S.meta} mb-1`}>Leídos</p>
                                        <p className={`${T.kpiValue} ${S.kpiMd} tabular-nums`}>{campaign.readCount || 0}</p>
                                    </div>
                                    <div className="text-center md:text-left">
                                        <p className={`${T.kpiLabel} ${S.meta} mb-1 text-red-500/70`}>Fallidos</p>
                                        <p className={`${T.kpiValue} ${S.kpiMd} tabular-nums text-red-500`}>{campaign.failedCount || 0}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    {/* DRAFT sin scheduledAt: inicio manual */}
                                    {campaign.status === 'DRAFT' && !campaign.scheduledAt && (
                                        <button
                                            onClick={() => handleAction(campaign.id, 'START')}
                                            className={`${T.buttonText} ${S.meta} px-4 py-2 bg-green-500 text-white rounded-lg hover:brightness-110 transition-all active:scale-95 shadow-lg`}
                                        >
                                            Iniciar
                                        </button>
                                    )}
                                    {/* SCHEDULED: badge con fecha, sin botón START */}
                                    {campaign.status === 'SCHEDULED' && campaign.scheduledAt && (
                                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                                            <Calendar size={11} className="text-purple-500 shrink-0" />
                                            <span className={`${T.statusText} ${S.meta} text-purple-600 uppercase tracking-widest font-bold whitespace-nowrap`}>
                                                {new Date(campaign.scheduledAt).toLocaleString('es-MX', {
                                                    day: '2-digit', month: '2-digit', year: '2-digit',
                                                    hour: '2-digit', minute: '2-digit',
                                                })}
                                            </span>
                                        </div>
                                    )}
                                    {campaign.status === 'IN_PROGRESS' && (
                                        <button
                                            onClick={() => handleAction(campaign.id, 'PAUSE')}
                                            className="p-2 bg-[var(--bg-elevated)] text-[var(--brand-primary)] border border-[var(--border-default)] rounded-lg hover:bg-[var(--brand-primary)]/10 transition-all active:scale-95"
                                            title="Pausar"
                                        >
                                            <Pause size={14} className="fill-current" />
                                        </button>
                                    )}
                                    {campaign.status === 'PAUSED' && (
                                        <button
                                            onClick={() => handleAction(campaign.id, 'RESUME')}
                                            className="p-2 bg-[var(--brand-primary)]  rounded-lg hover:brightness-110 transition-all active:scale-95"
                                            title="Reanudar"
                                        >
                                            <Play size={14} className="fill-current" />
                                        </button>
                                    )}
                                     <Link 
                                        to={`/dashboard/wabee/campaigns/${campaign.id}/analytics`}
                                        className="p-2 text-[color:var(--tx-helperText-color)] hover:text-[var(--brand-primary)] transition-colors"
                                        title="Ver Análisis Detallado"
                                    >
                                        <BarChart3 size={16} />
                                    </Link>

                                    {/* Action Menu */}
                                    <div className="relative">
                                        <button
                                            ref={(el) => { menuButtonRefs.current[campaign.id] = el; }}
                                            onClick={() => {
                                                if (openMenuId === campaign.id) {
                                                    setOpenMenuId(null);
                                                    setMenuPosition(null);
                                                } else {
                                                    const btn = menuButtonRefs.current[campaign.id];
                                                    if (btn) {
                                                        const rect = btn.getBoundingClientRect();
                                                        setMenuPosition({
                                                            top: rect.bottom + 8,
                                                            right: window.innerWidth - rect.right,
                                                        });
                                                    }
                                                    setOpenMenuId(campaign.id);
                                                }
                                            }}
                                            className="p-2 text-[color:var(--tx-helperText-color)] hover:text-[var(--brand-primary)] transition-colors"
                                        >
                                            <MoreVertical size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Progress bar */}
                            <div className="absolute bottom-0 left-0 h-0.5 bg-[var(--brand-primary)]/20 w-full overflow-hidden">
                                <div
                                    className="h-full bg-[var(--brand-primary)] transition-all duration-700 ease-out"
                                    style={{
                                        width: `${campaign.estimatedRecipients > 0
                                            ? Math.min((campaign.sentCount / campaign.estimatedRecipients) * 100, 100)
                                            : 0}%`
                                    }}
                                ></div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Dropdown menu con fixed para evitar recorte */}
            {openMenuId && menuPosition && (() => {
                const campaign = filteredCampaigns.find(c => c.id === openMenuId);
                if (!campaign) return null;
                return (
                    <>
                        <div
                            className="fixed inset-0 z-[9998]"
                            onClick={() => { setOpenMenuId(null); setMenuPosition(null); }}
                        />
                        <div
                            className="fixed w-48 bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-xl shadow-2xl z-[9999] overflow-hidden"
                            style={{ top: menuPosition.top, right: menuPosition.right }}
                        >
                            {(campaign.status === 'DRAFT' || campaign.status === 'SCHEDULED') && (
                                <button
                                    onClick={() => {
                                        setOpenMenuId(null);
                                        setMenuPosition(null);
                                        setEditingCampaign(campaign);
                                        setShowWizard(true);
                                    }}
                                    className={`${T.buttonText} ${S.meta} w-full text-left px-4 py-3 text-[color:var(--tx-helperText-color)] hover:text-[var(--brand-primary)] hover:bg-[var(--bg-hover)] transition-colors border-b border-[var(--border-default)]`}
                                >
                                    ✏️ Configurar
                                </button>
                            )}
                            {(campaign.status === 'SCHEDULED' || campaign.status === 'IN_PROGRESS' || campaign.status === 'PAUSED') && (
                                <button
                                    onClick={() => {
                                        setOpenMenuId(null);
                                        setMenuPosition(null);
                                        handleAction(campaign.id, 'CANCEL');
                                    }}
                                    className={`${T.buttonPrimaryText} ${S.meta} w-full text-left px-4 py-3 text-[var(--brand-primary)] hover: hover:bg-[var(--brand-primary)] transition-colors border-b border-[var(--border-default)]`}
                                >
                                    ⏹ Cancelar
                                </button>
                            )}
                            {/* Eliminar: solo si canMutate (DRAFT o SCHEDULED) */}
                            {(() => {
                                const canMutate = ['DRAFT', 'SCHEDULED'].includes(campaign.status);
                                return canMutate ? (
                                    <button
                                        onClick={() => {
                                            setOpenMenuId(null);
                                            setMenuPosition(null);
                                            handleDelete(campaign.id);
                                        }}
                                        className={`${T.buttonText} ${S.meta} w-full text-left px-4 py-3 text-red-500 hover:text-white hover:bg-red-500 transition-colors`}
                                    >
                                        🗑️ Eliminar
                                    </button>
                                ) : (
                                    <div
                                        title="No se puede modificar una campaña completada o en progreso."
                                        className={`${T.buttonText} ${S.meta} w-full text-left px-4 py-3 text-[#3a3a2a] cursor-not-allowed flex items-center gap-2`}
                                    >
                                        🗑️ <span>Eliminar</span>
                                        <span className="text-[8px] font-medium normal-case tracking-normal text-[#3a3a2a] ml-auto">No disponible</span>
                                    </div>
                                );
                            })()}
                        </div>
                    </>
                );
            })()}

            {showWizard && (
                <CampaignWizard
                    initialData={editingCampaign || undefined}
                    onClose={() => {
                        setShowWizard(false);
                        setEditingCampaign(null);
                    }}
                    onSuccess={() => {
                        setShowWizard(false);
                        setEditingCampaign(null);
                        fetchCampaigns(true);
                    }}
                />
            )}
        </div>
    );
}
