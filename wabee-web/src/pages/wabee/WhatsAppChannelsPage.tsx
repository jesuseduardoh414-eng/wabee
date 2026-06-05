import { useState, useEffect } from 'react';
import { T, S } from '@/lib/text-tokens';
import { Link } from 'react-router-dom';
import {
    getChannels,
    connectChannel,
    getChannelHealth,
    Channel,
    ConnectChannelData
} from '@/api/wabee/whatsapp.api';
import ChannelFormModal from '@/components/wabee/ChannelFormModal';
import ChannelCard from '@/components/wabee/ChannelCard';
import ChannelAiConfigSection from '@/components/wabee/ChannelAiConfigSection';
import { usePlanEnforcement } from '@/hooks/usePlanEnforcement';
import { launchEmbeddedSignup, isEmbeddedSignupConfigured } from '@/lib/facebook';
import { embeddedSignupExchange } from '@/api/wabee/whatsapp.api';

export default function WhatsAppChannelsPage() {
    const [channels, setChannels] = useState<Channel[]>([]);
    const [statusFilter, setStatusFilter] = useState<string>(''); // empty means 'ALL'
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [archivingId, setArchivingId] = useState<string | null>(null);
    const [activeAiConfigId, setActiveAiConfigId] = useState<string | null>(null);

    const { isModuleEnabled, hasReachedLimit, getLimitValue } = usePlanEnforcement();
    const isChannelsDisabled = !isModuleEnabled('channels');
    const isLimitReached = hasReachedLimit('channels');
    const channelsLimit = getLimitValue('channels');

    const fetchChannels = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await getChannels({ status: statusFilter || undefined });
            setChannels(data);
        } catch (err: any) {
            console.error('Error loading channels:', err);
            setError(err.message || 'Error al cargar canales');
        } finally {
            setLoading(false);
        }
    };

    const handleLoginWithFacebook = () => {
        const apiBase = import.meta.env.VITE_API_URL.replace('/api', '').replace('/v1', '');
        window.location.href = `${apiBase}/oauth/meta/start?tenant_key=${localStorage.getItem('tenant_key') || ''}`;
    };

    const [connectingEs, setConnectingEs] = useState(false);

    // Embedded Signup (Coexistence): el cliente mantiene su app de WhatsApp Business
    // activa mientras opera el mismo número desde Wabee.
    const handleEmbeddedSignup = async (coexistence: boolean) => {
        if (!isEmbeddedSignupConfigured()) {
            setError('La conexión con Meta aún no está configurada (Embedded Signup). Contacta al administrador.');
            return;
        }
        try {
            setConnectingEs(true);
            setError(null);
            const result = await launchEmbeddedSignup(coexistence);
            await embeddedSignupExchange(result);
            setSuccessMessage(
                coexistence
                    ? 'Número conectado en modo Coexistence. Tu app de WhatsApp Business sigue funcionando.'
                    : 'Número conectado correctamente.'
            );
            setTimeout(() => setSuccessMessage(null), 5000);
            await fetchChannels();
        } catch (err: any) {
            console.error('Embedded Signup error:', err);
            setError('Error al conectar con Meta: ' + (err.message || 'Error desconocido'));
        } finally {
            setConnectingEs(false);
        }
    };

    useEffect(() => {
        fetchChannels();

        const params = new URLSearchParams(window.location.search);
        if (params.get('oauth') === 'ok') {
            window.history.replaceState({}, document.title, window.location.pathname);
            fetchChannels();
        }
    }, [statusFilter]);

    const handleConnectChannel = async (data: ConnectChannelData) => {
        await connectChannel(data);
        await fetchChannels();
    };

    const handleArchiveChannel = (id: string) => {
        setArchivingId(id);
    };

    const handleConfirmArchive = async () => {
        if (!archivingId) return;
        try {
            const { archiveChannel } = await import('@/api/wabee/whatsapp.api');
            await archiveChannel(archivingId);
            setSuccessMessage('Canal archivado correctamente.');
            setTimeout(() => setSuccessMessage(null), 3000);
            fetchChannels();
        } catch (err: any) {
            setError('Error al archivar el canal: ' + (err.message || 'Error desconocido'));
        } finally {
            setArchivingId(null);
        }
    };

    const [checkingHealthMap, setCheckingHealthMap] = useState<Record<string, boolean>>({});

    const handleCheckHealth = async (channelId: string) => {
        setCheckingHealthMap(prev => ({ ...prev, [channelId]: true }));
        setError(null);
        setSuccessMessage(null);
        try {
            const rawHealthData: any = await getChannelHealth(channelId);
            const details = rawHealthData.details || {};
            const normalizedData = {
                ...rawHealthData,
                wabaId: details.wabaId || rawHealthData.wabaId,
                phoneNumberId: details.phoneNumberId || rawHealthData.phoneNumberId,
                webhookStatus: details.webhookStatus || rawHealthData.webhookStatus,
            };

            if (normalizedData) {
                setChannels((prev) =>
                    prev.map((ch) =>
                        ch.id === channelId
                            ? {
                                ...ch,
                                // Solo actualizar campos de salud, NO sobreescribir IDs existentes
                                status: normalizedData.status ?? ch.status,
                                healthStatus: normalizedData.healthStatus ?? ch.healthStatus,
                                lastHealthCheckAt: normalizedData.lastHealthCheckAt ?? ch.lastHealthCheckAt,
                                lastErrorMessage: normalizedData.lastErrorMessage ?? ch.lastErrorMessage,
                                webhookStatus: normalizedData.webhookStatus ?? ch.webhookStatus,
                              }
                            : ch
                    )
                );
                const healthLabel = normalizedData.healthStatus === 'GREEN' ? '✅ Verde'
                    : normalizedData.healthStatus === 'YELLOW' ? '⚠️ Amarillo'
                    : normalizedData.healthStatus === 'RED' ? '❌ Rojo'
                    : '⬜ Desconocido';
                setSuccessMessage(`Salud verificada: ${healthLabel}`);
                setTimeout(() => setSuccessMessage(null), 4000);
            }
        } catch (err: any) {
            console.error('Error checking health:', err);
            setError('Error al verificar salud: ' + (err.message || 'Error desconocido'));
        } finally {
            setCheckingHealthMap(prev => ({ ...prev, [channelId]: false }));
        }
    };

    const [discovering, setDiscovering] = useState(false);
    const [discoveredAssets, setDiscoveredAssets] = useState<any[]>([]);
    const [discoveryInfo, setDiscoveryInfo] = useState<string | null>(null);

    const isDiscoveryNotImplemented = (err: any) => {
        return err.message?.includes('501') || err.status === 501 || err.code === 'DISCOVERY_NOT_IMPLEMENTED';
    };

    const handleDiscover = async () => {
        try {
            setDiscovering(true);
            setError(null);
            setDiscoveryInfo(null);
            const api = await import('@/api/wabee/whatsapp.api');
            const responseInfo = await api.discoverAssets();
            const rawAssets = responseInfo.assets || [];

            if (rawAssets.length === 0) {
                setDiscoveryInfo('No se encontraron activos de WhatsApp en esta cuenta de Meta.');
            } else {
                const groupedMap: Record<string, any> = {};
                rawAssets.forEach(asset => {
                    if (!groupedMap[asset.wabaId]) {
                        groupedMap[asset.wabaId] = {
                            wabaId: asset.wabaId,
                            wabaName: asset.wabaName,
                            phoneNumbers: []
                        };
                    }
                    groupedMap[asset.wabaId].phoneNumbers.push(asset);
                });
                setDiscoveredAssets(Object.values(groupedMap));
            }
        } catch (err: any) {
            console.error('Discovery error:', err);
            if (isDiscoveryNotImplemented(err)) {
                setDiscoveryInfo('El autodescubrimiento de activos de Meta aún no está disponible. Usa "Conexión Manual" o "Conectar con Facebook".');
            } else if (err.code === 'NO_META_SESSION') {
                setError('Error al detectar activos: ' + (err.message || 'Error desconocido'));
            }
        } finally {
            setDiscovering(false);
        }
    };

    return (
        <div className="min-h-screen bg-[var(--bg-page)] text-[color:var(--text-body)] font-sans">
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <h2 className={`${T.pageTitle} ${S.displayMd} text-[color:var(--text-strong)] tracking-tight`}>Canales de WhatsApp</h2>
                        <p className={`${T.helperText} mt-1 font-medium italic text-[color:var(--text-muted)]`}>
                            Gestiona tus conexiones oficiales de WhatsApp Cloud API
                        </p>
                    </div>
                    <div className="flex flex-col items-end gap-3">
                        <div className="flex flex-wrap gap-3">
                            <button
                                onClick={handleDiscover}
                                disabled={discovering || isChannelsDisabled || isLimitReached}
                                className={`px-5 py-2.5 bg-[var(--bg-elevated)] text-[color:var(--brand-primary)] border border-[var(--border-default)] rounded-xl hover:border-[var(--brand-primary)]/50 transition-all font-bold shadow-lg flex items-center gap-2 ${(discovering || isChannelsDisabled || isLimitReached) ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
                                title={isChannelsDisabled ? "Módulo no incluido en tu plan" : isLimitReached ? "Límite de canales alcanzado" : ""}
                            >
                                {discovering ? (
                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                ) : (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                )}
                                <span className={`${T.buttonText} ${S.ui}`}>{discovering ? 'Detectando...' : 'Detectar Activos'}</span>
                            </button>
                            <button
                                onClick={handleLoginWithFacebook}
                                disabled={isChannelsDisabled || isLimitReached}
                                className={`px-5 py-2.5 bg-[#1877F2] text-white rounded-xl hover:brightness-110 transition-all shadow-lg shadow-[#1877F2]/20 flex items-center gap-2 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed ${(isChannelsDisabled || isLimitReached) ? '' : 'active:scale-95'}`}
                                title={isChannelsDisabled ? "Módulo no incluido en tu plan" : isLimitReached ? "Límite de canales alcanzado" : ""}
                            >
                                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                                </svg>
                                <span className={`${T.buttonText} ${S.ui}`}>Conectar con Meta</span>
                            </button>
                            <button
                                onClick={() => handleEmbeddedSignup(true)}
                                disabled={connectingEs || isChannelsDisabled || isLimitReached}
                                className={`px-5 py-2.5 bg-[#25D366] text-white rounded-xl hover:brightness-110 transition-all shadow-lg shadow-[#25D366]/20 flex items-center gap-2 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed ${(connectingEs || isChannelsDisabled || isLimitReached) ? '' : 'active:scale-95'}`}
                                title={isChannelsDisabled ? "Módulo no incluido en tu plan" : isLimitReached ? "Límite de canales alcanzado" : "Conecta tu número manteniendo activa tu app de WhatsApp Business"}
                            >
                                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                                    <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.821 11.821 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.692 5.595l-.999 3.648 3.745-.982z" />
                                </svg>
                                <span className={`${T.buttonText} ${S.ui}`}>{connectingEs ? 'Conectando...' : 'Conectar (mantener mi app)'}</span>
                            </button>
                            <button
                                onClick={() => setModalOpen(true)}
                                disabled={isChannelsDisabled || isLimitReached}
                                className={`px-5 py-2.5 bg-[var(--brand-primary)] rounded-xl hover:brightness-110 transition-all shadow-lg shadow-[var(--brand-primary)]/10 border border-[var(--brand-primary)] disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed ${(isChannelsDisabled || isLimitReached) ? '' : 'active:scale-95'}`}
                                title={isChannelsDisabled ? "Módulo no incluido en tu plan" : isLimitReached ? "Límite de canales alcanzado" : ""}
                            >
                                <span className={`${T.buttonPrimaryText} ${S.ui}`}>Conexión Manual</span>
                            </button>
                        </div>
                        {isLimitReached && !isChannelsDisabled && (
                            <p className={`${T.helperText} ${S.meta} text-orange-500 font-bold uppercase tracking-tighter italic animate-pulse`}>
                                ⚠ Has alcanzado el límite de {channelsLimit} canales de tu plan
                            </p>
                        )}
                        {isChannelsDisabled && (
                            <p className={`${T.helperText} ${S.meta} text-red-500 font-bold uppercase tracking-tighter italic`}>
                                Módulo de canales restringido por tu plan
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex border-b border-[var(--border-default)] mb-10 overflow-x-auto">
                    {[
                        { id: '', label: 'TODOS LOS CANALES', count: null },
                        { id: 'CONNECTED', label: 'CONECTADOS', count: channels.filter(c => c.status === 'CONNECTED').length },
                        { id: 'ERROR', label: 'CON ERRORES', count: channels.filter(c => (c.status as string) === 'ERROR' || (c.status as string) === 'SUSPENDED').length },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setStatusFilter(tab.id)}
                            className={`px-6 py-4 border-b-2 transition-all whitespace-nowrap ${statusFilter === tab.id
                                ? 'border-[var(--brand-primary)]'
                                : 'border-transparent hover:border-[var(--border-default)]'
                                }`}
                        >
                            <span className={`${T.buttonText} ${S.ui} ${statusFilter === tab.id ? 'text-[color:var(--brand-primary)]' : 'text-[color:var(--text-muted)] hover:text-[color:var(--text-strong)]'}`}>
                                {tab.label}
                            </span>
                            {tab.count !== null && (
                                <span className={`ml-2 px-2 py-0.5 rounded-md ${T.badgeText} ${S.meta} ${statusFilter === tab.id ? 'bg-[var(--brand-primary)]/10 text-[color:var(--brand-primary)]' : 'bg-[var(--bg-elevated)] text-[color:var(--text-muted)]'}`}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {discoveredAssets.length > 0 && (
                    <div className="mb-10 p-8 bg-[var(--bg-card)] border border-[var(--brand-primary)]/20 rounded-2xl shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-1 bg-[var(--brand-primary)]/10 rounded-bl-xl border-l border-b border-[var(--brand-primary)]/30">
                            <span className={`${T.helperText} ${S.meta} text-[color:var(--brand-primary)] uppercase tracking-[0.2em] px-2`}>Meta Cloud Detect</span>
                        </div>
                        <div className="flex items-center justify-between mb-6">
                            <h3 className={`${T.sectionTitle} ${S.headingLg} flex items-center gap-3`}>
                                <div className="p-2 bg-[var(--brand-primary)]/10 rounded-lg">
                                    <svg className="w-5 h-5 text-[color:var(--brand-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                                Activos Detectados en Meta
                            </h3>
                            <button
                                onClick={() => setDiscoveredAssets([])}
                                className="text-xs text-[color:var(--text-muted)] hover:text-[color:var(--brand-primary)] font-bold uppercase tracking-widest transition-colors"
                            >
                                [ Ocultar ]
                            </button>
                        </div>
                        <div className="grid grid-cols-1 gap-6">
                            {discoveredAssets.map((biz: any, bizIdx: number) => (
                                <div key={bizIdx} className="bg-[var(--bg-page)] p-5 rounded-2xl border border-[var(--border-default)]">
                                    <div className="flex items-center gap-3 mb-5">
                                        <span className={`bg-[var(--brand-primary)]/10 ${T.badgeText} ${S.meta} text-[color:var(--brand-primary)] px-2 py-0.5 rounded border border-[var(--brand-primary)]/20 uppercase tracking-widest`}>WABA</span>
                                        <span className={`${T.cardTitle} ${S.headingSm}`}>{biz.wabaName}</span>
                                        <div className="flex items-center gap-1.5 ml-auto">
                                            <span className={`${T.helperText} ${S.meta} text-[color:var(--text-muted)] opacity-60 uppercase tracking-tighter`}>ID:</span>
                                            <span className={`${T.helperText} ${S.meta} text-[color:var(--text-strong)] font-mono`}>{biz.wabaId}</span>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {biz.phoneNumbers.map((asset: any, phIdx: number) => {
                                            const alreadyConnected = channels.some(ch => ch.phoneNumberId === asset.phoneNumberId);
                                            return (
                                                <div key={phIdx} className="flex flex-col border border-[var(--border-default)] rounded-xl p-4 hover:border-[var(--brand-primary)]/50 transition-all bg-[var(--bg-page)] group">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <span className={`${T.labelText} ${S.headingSm} group-hover:text-[color:var(--brand-primary)] transition-colors line-clamp-1`}>{asset.verifiedName || 'Sin Nombre'}</span>
                                                        <span className={`${T.badgeText} ${S.meta} px-2 py-0.5 rounded-md ${asset.status === 'APPROVED' || asset.status === 'CONNECTED' ? 'bg-green-500/10 text-green-500' : 'bg-[var(--bg-surface)] text-[color:var(--text-muted)] border border-[var(--border-default)]'}`}>
                                                            {asset.status === 'APPROVED' ? 'Aprobado' : asset.status || 'Desconocido'}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col gap-0.5 mb-4">
                                                        <span className={`${T.helperText} ${S.meta} text-[color:var(--text-muted)] font-mono`}>{asset.displayPhoneNumber}</span>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className={`${T.helperText} ${S.meta} opacity-40 uppercase`}>ID:</span>
                                                            <span className={`${T.helperText} ${S.meta} font-mono opacity-80`}>{asset.phoneNumberId}</span>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleConnectChannel({
                                                            name: asset.verifiedName || `WhatsApp ${asset.displayPhoneNumber}`,
                                                            wabaId: asset.wabaId,
                                                            phoneNumberId: asset.phoneNumberId,
                                                            displayPhone: asset.displayPhoneNumber,
                                                            verifiedName: asset.verifiedName,
                                                            purpose: 'GENERAL'
                                                        })}
                                                        disabled={alreadyConnected || isChannelsDisabled || isLimitReached}
                                                        className={`mt-auto w-full py-2 rounded-lg transition-all shadow-lg ${alreadyConnected || isChannelsDisabled || isLimitReached
                                                            ? 'bg-[var(--bg-surface)] border border-[var(--border-default)] cursor-not-allowed opacity-60'
                                                            : 'bg-[var(--brand-primary)] hover:brightness-110 shadow-[var(--brand-primary)]/10 active:scale-95'}`}
                                                    >
                                                        <span className={`${T.buttonPrimaryText} ${S.ui} ${alreadyConnected ? 'text-[color:var(--text-muted)]' : 'text-[var(--brand-primary-foreground)]'}`}>
                                                            {alreadyConnected ? 'Conectado' : isLimitReached ? 'Límite' : 'Vincular'}
                                                        </span>
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {discoveryInfo && (
                    <div className="mb-8 p-5 bg-[var(--brand-primary)]/5 border border-[var(--brand-primary)]/30 text-[color:var(--brand-primary)] rounded-2xl flex items-center gap-3 animate-fade-in shadow-lg">
                        <div className="bg-[var(--brand-primary)]/20 p-2 rounded-full">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <span className="text-sm font-bold uppercase tracking-tight">{discoveryInfo}</span>
                    </div>
                )}

                {error && (
                    <div className="mb-8 p-5 bg-red-500/10 border border-red-500/30 text-red-500 rounded-2xl flex items-center gap-3 animate-shake shadow-lg">
                        <div className="bg-red-500/20 p-2 rounded-full">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        </div>
                        <span className="text-sm font-bold">{error}</span>
                    </div>
                )}

                {successMessage && (
                    <div className="mb-8 p-5 bg-green-500/10 border border-green-500/30 text-green-500 rounded-2xl flex items-center gap-3 animate-fade-in shadow-xl">
                        <div className="bg-green-500/20 p-2 rounded-full">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <span className="text-sm font-black uppercase tracking-tighter">{successMessage}</span>
                    </div>
                )}

                {loading ? (
                    <div className="flex flex-col items-center justify-center h-80 bg-[var(--bg-card)] rounded-3xl border border-[var(--border-default)] shadow-inner">
                        <div className="relative">
                            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-[var(--brand-primary)]"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="h-6 w-6 bg-[var(--brand-primary)]/20 rounded-full animate-pulse"></div>
                            </div>
                        </div>
                        <div className={`${T.helperText} ${S.meta} mt-6 text-[color:var(--text-muted)] opacity-60 uppercase tracking-[0.3em]`}>Sincronizando...</div>
                    </div>
                ) : (channels?.length || 0) === 0 ? (
                    <div className="bg-[var(--bg-card)] rounded-3xl border border-[var(--border-default)] p-16 text-center shadow-2xl">
                        <div className="w-24 h-24 bg-[var(--bg-page)] rounded-full mx-auto mb-6 flex items-center justify-center border border-[var(--border-default)] group hover:border-[var(--brand-primary)]/30 transition-all">
                            <svg className="w-10 h-10 text-[color:var(--text-muted)] group-hover:text-[color:var(--brand-primary)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                        </div>
                        <h3 className={`${T.emptyStateTitle} ${S.displaySm} mb-2`}>No hay canales activos</h3>
                        <p className={`${T.emptyStateBody} ${S.body} mb-8 max-w-sm mx-auto`}>Conecta tu infraestructura de WhatsApp Cloud API para comenzar a enviar mensajes.</p>
                        <button
                            onClick={() => setModalOpen(true)}
                            disabled={isChannelsDisabled || isLimitReached}
                            className="px-10 py-4 bg-[var(--brand-primary)] rounded-2xl hover:brightness-110 transition-all shadow-xl shadow-[var(--brand-primary)]/10 active:scale-95 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
                        >
                            <span className={`${T.buttonPrimaryText} ${S.body} text-[var(--brand-primary-foreground)]`}>{isLimitReached ? 'Límite alcanzado' : 'Conectar Canal'}</span>
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {channels.map((channel) => (
                            <div key={channel.id} className="relative">
                                <ChannelCard
                                    channel={channel}
                                    onCheckHealth={handleCheckHealth}
                                    onArchive={handleArchiveChannel}
                                    onConfigAi={id => setActiveAiConfigId(activeAiConfigId === id ? null : id)}
                                    loadingHealth={!!checkingHealthMap[channel.id]}
                                />
                                {activeAiConfigId === channel.id && (
                                    <div className="absolute top-full left-0 right-0 z-10 w-[200%] max-w-[800px] mt-2">
                                        <ChannelAiConfigSection
                                            channelId={channel.id}
                                            onClose={() => setActiveAiConfigId(null)}
                                        />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Archive Confirmation Modal */}
            {archivingId && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-3xl shadow-2xl max-w-md w-full p-8 animate-scale-in">
                        <div className="flex items-center gap-4 text-red-500 mb-6">
                            <div className="p-3 bg-red-500/10 rounded-2xl border border-red-500/20">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </div>
                            <h3 className={`${T.sectionTitle} text-2xl font-black uppercase tracking-tighter text-red-500`}>¿Archivar canal?</h3>
                        </div>
                        <p className={`${T.helperText} text-[color:var(--text-muted)] mb-8 font-medium leading-relaxed`}>
                            Esta acción retirará el canal del listado activo, pero <span className="text-[color:var(--text-strong)] border-b border-[var(--brand-primary)]/30">mantendrá intactos todos los chats e hilos</span> de conversación asociados.
                        </p>
                        <div className="flex gap-4">
                            <button
                                onClick={() => setArchivingId(null)}
                                className={`flex-1 px-6 py-3 text-[color:var(--text-muted)] hover:text-[color:var(--text-strong)] bg-[var(--bg-elevated)] rounded-xl font-bold transition-all active:scale-95`}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmArchive}
                                className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl hover:brightness-110 transition-all font-black uppercase tracking-widest shadow-lg shadow-red-600/20 active:scale-95"
                            >
                                Archivar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ChannelFormModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                onSubmit={handleConnectChannel}
            />
        </div>
    );
}
