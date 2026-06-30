import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { TourButton } from '../../components/TourButton';
import { getCampaigns, operateCampaign, Campaign } from '@/api/wabee/campaigns.api';
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

    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
    const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);
    const menuButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

    const streamRef = useRef<{ close: () => void } | null>(null);
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

    const patchCampaign = useCallback((campaignId: string, payload: Partial<Campaign>) => {
        setCampaigns((prev) => prev.map((campaign) => (campaign.id === campaignId ? { ...campaign, ...payload } : campaign)));
    }, []);

    const startPolling = useCallback(() => {
        if (pollingRef.current) return;
        setConnectionState('polling');

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

    const handleRealtimeEvent = useCallback(
        (event: RealtimeEventType) => {
            if (event.type === 'campaign.metrics' || event.type === 'campaign.status') {
                patchCampaign(event.campaignId, event.payload as Partial<Campaign>);
            }
        },
        [patchCampaign]
    );

    useEffect(() => {
        fetchCampaigns();
        setConnectionState('connecting');
        streamRef.current = connectCampaignStream(handleRealtimeEvent, {
            maxRetries: 3,
            onConnected: () => {
                stopPolling();
                setConnectionState('live');
            },
            onFallback: () => {
                setConnectionState('polling');
                startPolling();
            },
        });

        return () => {
            streamRef.current?.close();
            stopPolling();
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleAction = async (id: string, action: 'START' | 'PAUSE' | 'RESUME' | 'CANCEL') => {
        try {
            await operateCampaign(id, action);
            if (connectionState !== 'live') {
                await fetchCampaigns(true);
            }
        } catch (err: any) {
            toastError(err.message || 'Error al ejecutar la acción sobre la campaña');
        }
    };

    const handleDelete = async (id: string) => {
        const isConfirmed = await confirm({
            title: 'Eliminar campaña',
            description: '¿Estás seguro de que deseas eliminar esta campaña de forma permanente?',
            isDestructive: true,
            confirmText: 'Eliminar',
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

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'IN_PROGRESS':
                return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
            case 'COMPLETED':
                return 'bg-green-500/10 text-green-500 border-green-500/20';
            case 'PAUSED':
                return 'bg-[#ead018]/10 text-[#ead018] border-[#ead018]/20';
            case 'SCHEDULED':
                return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
            case 'CANCELED':
                return 'bg-red-500/10 text-red-500 border-red-500/20';
            default:
                return 'bg-[#2a2a1a] text-[#a0a080] border-[#3a3a2a]';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'IN_PROGRESS':
                return <Play size={10} className="fill-current" />;
            case 'COMPLETED':
                return <CheckCircle2 size={10} />;
            case 'PAUSED':
                return <Pause size={10} className="fill-current" />;
            case 'SCHEDULED':
                return <Clock size={10} />;
            case 'CANCELED':
                return <XCircle size={10} />;
            default:
                return <AlertCircle size={10} />;
        }
    };

    const getConnectionBadge = () => {
        switch (connectionState) {
            case 'live':
                return (
                    <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-green-400">
                        <Wifi size={10} />
                        <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-400" />
                        </span>
                        En vivo
                    </span>
                );
            case 'polling':
                return (
                    <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-[var(--brand-primary)]">
                        <WifiOff size={10} />
                        Polling (5s)
                    </span>
                );
            case 'connecting':
                return (
                    <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-[color:var(--tx-helperText-color)]">
                        <span className="h-2 w-2 animate-spin rounded-full border border-[color:var(--tx-helperText-color)] border-t-transparent" />
                        Conectando...
                    </span>
                );
            default:
                return null;
        }
    };

    const filteredCampaigns = campaigns.filter((campaign) => campaign.name.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="mx-auto min-h-screen max-w-7xl px-4 py-5 sm:px-6 sm:py-6">
            <div className="mb-6 flex flex-col gap-4 sm:mb-8 md:flex-row md:items-start md:justify-between">
                <div className="max-w-2xl">
                    <div className="mb-2 flex flex-wrap items-center gap-3">
                        <h1 className={`${T.pageTitle} ${S.displayLg}`}>Campaigns Hub</h1>
                        {getConnectionBadge()}
                    </div>
                    <p className={`${T.pageSubtitle} ${S.body}`}>
                        Gestiona y monitorea tus campañas masivas de WhatsApp Cloud API.
                    </p>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <TourButton moduleKey="campaigns" />
                    <button
                        data-tour="campaigns-create"
                        onClick={() => setShowWizard(true)}
                        className={`${T.buttonPrimaryText} ${S.body} group flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--brand-primary)] px-5 py-3 font-bold shadow-xl shadow-[#ead018]/10 transition-all active:scale-95 md:flex-none md:min-w-[220px] hover:brightness-110`}
                    >
                        <Plus size={18} className="transition-transform group-hover:rotate-90" />
                        Nueva campaña
                    </button>
                </div>
            </div>

            <div data-tour="campaigns-search" className="relative mb-6 max-w-none md:mb-8 md:max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--tx-helperText-color)]" size={16} />
                <input
                    type="text"
                    placeholder="Buscar campaña por nombre..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={`${T.inputText} ${S.body} w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] py-2.5 pl-11 pr-4 font-bold transition-all focus:border-[var(--brand-primary)] focus:outline-none`}
                />
            </div>

            {loading ? (
                <div className="flex h-80 flex-col items-center justify-center rounded-3xl border border-[var(--border-default)] bg-[var(--bg-card)]">
                    <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-[var(--brand-primary)]" />
                    <p className={`${T.helperText} ${S.meta} mt-4 uppercase tracking-[0.3em]`}>Cargando motor...</p>
                </div>
            ) : error ? (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-center sm:p-8">
                    <p className={`${T.helperText} ${S.body} text-red-500`}>{error}</p>
                </div>
            ) : filteredCampaigns.length === 0 ? (
                <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-card)] p-10 text-center shadow-2xl sm:p-16">
                    <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[color:var(--tx-helperText-color)]">
                        <Send size={32} />
                    </div>
                    <h3 className={`${T.emptyStateTitle} ${S.headingLg} mb-2`}>No hay campañas activas</h3>
                    <p className={`${T.emptyStateBody} ${S.body} mx-auto mb-8 max-w-sm`}>
                        Crea tu primera campaña para empezar a conectar con tus clientes de forma masiva.
                    </p>
                </div>
            ) : (
                <div data-tour="campaigns-list" className="grid grid-cols-1 gap-4">
                    {filteredCampaigns.map((campaign) => (
                        <div
                            key={campaign.id}
                            className="group relative overflow-hidden rounded-[28px] border border-[var(--border-default)] bg-[var(--bg-card)] p-4 shadow-sm transition-all hover:border-[var(--brand-primary)] sm:p-5"
                        >
                            <div className="relative z-10 flex flex-col gap-5">
                                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                                    <div className="flex items-start gap-4">
                                        <div className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--brand-primary)] transition-colors group-hover:bg-[var(--brand-primary)]/10">
                                            <Send size={20} />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="mb-2 flex flex-wrap items-center gap-2">
                                                <h3 className={`${T.cardTitle} ${S.headingMd} break-words`}>{campaign.name}</h3>
                                                <span
                                                    className={`${T.statusText} ${S.ui} inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-bold uppercase tracking-widest transition-all ${getStatusStyle(campaign.status)}`}
                                                >
                                                    {getStatusIcon(campaign.status)}
                                                    {campaign.status}
                                                </span>
                                            </div>
                                            <p className={`${T.helperText} ${S.meta} break-words`}>
                                                Canal: <span className="text-[var(--ty-strong)]">{campaign.channel?.name || 'Varios'}</span>
                                                {' · '}
                                                Audiencia: <span className="text-[var(--ty-strong)]">{campaign.audienceType}</span> ({campaign.estimatedRecipients})
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                                        {campaign.status === 'DRAFT' && !campaign.scheduledAt && (
                                            <button
                                                onClick={() => handleAction(campaign.id, 'START')}
                                                className={`${T.buttonText} ${S.meta} rounded-lg bg-green-500 px-4 py-2 text-white shadow-lg transition-all active:scale-95 hover:brightness-110`}
                                            >
                                                Iniciar
                                            </button>
                                        )}
                                        {campaign.status === 'SCHEDULED' && campaign.scheduledAt && (
                                            <div className="flex items-center gap-1.5 rounded-lg border border-purple-500/20 bg-purple-500/10 px-3 py-1.5">
                                                <Calendar size={11} className="shrink-0 text-purple-500" />
                                                <span className={`${T.statusText} ${S.meta} whitespace-nowrap font-bold uppercase tracking-widest text-purple-600`}>
                                                    {new Date(campaign.scheduledAt).toLocaleString('es-MX', {
                                                        day: '2-digit',
                                                        month: '2-digit',
                                                        year: '2-digit',
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                    })}
                                                </span>
                                            </div>
                                        )}
                                        {campaign.status === 'IN_PROGRESS' && (
                                            <button
                                                onClick={() => handleAction(campaign.id, 'PAUSE')}
                                                className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] p-2 text-[var(--brand-primary)] transition-all active:scale-95 hover:bg-[var(--brand-primary)]/10"
                                                title="Pausar"
                                            >
                                                <Pause size={14} className="fill-current" />
                                            </button>
                                        )}
                                        {campaign.status === 'PAUSED' && (
                                            <button
                                                onClick={() => handleAction(campaign.id, 'RESUME')}
                                                className="rounded-lg bg-[var(--brand-primary)] p-2 transition-all active:scale-95 hover:brightness-110"
                                                title="Reanudar"
                                            >
                                                <Play size={14} className="fill-current" />
                                            </button>
                                        )}
                                        <Link
                                            to={`/dashboard/wabee/campaigns/${campaign.id}/analytics`}
                                            className="rounded-lg p-2 text-[color:var(--tx-helperText-color)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--brand-primary)]"
                                            title="Ver análisis detallado"
                                        >
                                            <BarChart3 size={16} />
                                        </Link>
                                        <div className="relative">
                                            <button
                                                ref={(el) => {
                                                    menuButtonRefs.current[campaign.id] = el;
                                                }}
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
                                                className="rounded-lg p-2 text-[color:var(--tx-helperText-color)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--brand-primary)]"
                                                title="Más acciones"
                                            >
                                                <MoreVertical size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 rounded-2xl border border-[var(--border-default)]/60 bg-[var(--bg-page)]/35 p-4 sm:grid-cols-4">
                                    <div className="text-center sm:text-left">
                                        <p className={`${T.kpiLabel} ${S.meta} mb-1`}>Enviados</p>
                                        <p className={`${T.kpiValue} ${S.kpiMd} tabular-nums`}>{campaign.sentCount || 0}</p>
                                    </div>
                                    <div className="text-center sm:text-left">
                                        <p className={`${T.kpiLabel} ${S.meta} mb-1`}>Entregados</p>
                                        <p className={`${T.kpiValue} ${S.kpiMd} tabular-nums`}>{campaign.deliveredCount || 0}</p>
                                    </div>
                                    <div className="text-center sm:text-left">
                                        <p className={`${T.kpiLabel} ${S.meta} mb-1`}>Leídos</p>
                                        <p className={`${T.kpiValue} ${S.kpiMd} tabular-nums`}>{campaign.readCount || 0}</p>
                                    </div>
                                    <div className="text-center sm:text-left">
                                        <p className={`${T.kpiLabel} ${S.meta} mb-1 text-red-500/70`}>Fallidos</p>
                                        <p className={`${T.kpiValue} ${S.kpiMd} tabular-nums text-red-500`}>{campaign.failedCount || 0}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="absolute bottom-0 left-0 h-0.5 w-full overflow-hidden bg-[var(--brand-primary)]/20">
                                <div
                                    className="h-full bg-[var(--brand-primary)] transition-all duration-700 ease-out"
                                    style={{
                                        width: `${campaign.estimatedRecipients > 0 ? Math.min((campaign.sentCount / campaign.estimatedRecipients) * 100, 100) : 0}%`,
                                    }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {openMenuId && menuPosition && (() => {
                const campaign = filteredCampaigns.find((item) => item.id === openMenuId);
                if (!campaign) return null;

                return (
                    <>
                        <div
                            className="fixed inset-0 z-[9998]"
                            onClick={() => {
                                setOpenMenuId(null);
                                setMenuPosition(null);
                            }}
                        />
                        <div
                            className="fixed z-[9999] w-48 overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] shadow-2xl"
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
                                    className={`${T.buttonText} ${S.meta} w-full border-b border-[var(--border-default)] px-4 py-3 text-left text-[color:var(--tx-helperText-color)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--brand-primary)]`}
                                >
                                    Configurar
                                </button>
                            )}
                            {(campaign.status === 'SCHEDULED' || campaign.status === 'IN_PROGRESS' || campaign.status === 'PAUSED') && (
                                <button
                                    onClick={() => {
                                        setOpenMenuId(null);
                                        setMenuPosition(null);
                                        handleAction(campaign.id, 'CANCEL');
                                    }}
                                    className={`${T.buttonPrimaryText} ${S.meta} w-full border-b border-[var(--border-default)] px-4 py-3 text-left text-[var(--brand-primary)] transition-colors hover:bg-[var(--brand-primary)] hover:text-black`}
                                >
                                    Cancelar
                                </button>
                            )}
                            {(() => {
                                const canMutate = ['DRAFT', 'SCHEDULED'].includes(campaign.status);
                                return canMutate ? (
                                    <button
                                        onClick={() => {
                                            setOpenMenuId(null);
                                            setMenuPosition(null);
                                            handleDelete(campaign.id);
                                        }}
                                        className={`${T.buttonText} ${S.meta} w-full px-4 py-3 text-left text-red-500 transition-colors hover:bg-red-500 hover:text-white`}
                                    >
                                        Eliminar
                                    </button>
                                ) : (
                                    <div
                                        title="No se puede modificar una campaña completada o en progreso."
                                        className={`${T.buttonText} ${S.meta} flex w-full cursor-not-allowed items-center gap-2 px-4 py-3 text-left text-[#3a3a2a]`}
                                    >
                                        <span>Eliminar</span>
                                        <span className="ml-auto text-[8px] font-medium normal-case tracking-normal text-[#3a3a2a]">No disponible</span>
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
