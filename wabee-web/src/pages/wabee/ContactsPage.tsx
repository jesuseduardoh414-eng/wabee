import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { TourButton } from '../../components/TourButton';
import { contactsApi } from '@/api/wabee/contacts.api';
import { resolveThread } from '@/api/wabee/inbox.api';
import { getChannels, Channel } from '@/api/wabee/whatsapp.api';
import { T, S } from '@/lib/text-tokens';
import { ImportContactsModal } from './contacts/components/ImportContactsModal';
import { CreateContactModal } from './contacts/components/CreateContactModal';
import { ContactDetailModal } from './contacts/components/ContactDetailModal';
import { Upload, PlusCircle, MessageCircle, ArrowRight, X } from 'lucide-react';
import { useToast } from '@/context/ToastContext';
import { usePlanEnforcement } from '@/hooks/usePlanEnforcement';

interface SelectChannelModalProps {
    channels: Channel[];
    onSelect: (channelId: string) => void;
    onClose: () => void;
    isResolving: boolean;
}

const COPY = {
    title: 'CRM Inteligente',
    subtitle: 'Gestiona tus relaciones, segmentación dinámica y flujos de conversión en tiempo real.',
    importCsv: 'Importar CSV',
    newContact: 'Nuevo Contacto',
    planRestricted: 'Módulo de contactos restringido por tu plan',
    limitReached: (limit: number | string | null) => `⚠ Has alcanzado tu límite de ${limit ?? 'tu'} contactos`,
    activeFilter: 'Filtrado activo',
    specificGroup: 'Grupo de Pertenencia Específico',
    closeView: 'Cerrar Vista',
    dynamicView: 'Visión Dinámica',
    smartSegment: 'Segmento de Datos Inteligente',
    leaveSegment: 'Salir del Segmento',
    searchPlaceholder: 'Buscar por identidad, telefonía o correo...',
    allEcosystem: 'Todo el Ecosistema',
    newEntry: 'Nuevo Ingreso',
    qualifiedLead: 'Lead Calificado',
    activeLink: 'Vínculo Activo',
    loyalCustomer: 'Cliente Fidelizado',
    inactive: 'Inactivo',
    identity: 'Identidad',
    telephony: 'Telefonía',
    protocol: 'Protocolo',
    globalStatus: 'Estado Global',
    segments: 'Segmentos',
    commands: 'Comandos',
    scanning: 'Escaneando Base de Datos...',
    noRecords: 'Sin registros detectados en este canal',
    noName: 'Sin nombre',
    noEmail: 'SIN CORREO',
    noTags: 'Sin Tags',
    hiddenSegments: 'Segmentos Ocultos',
    detailTitle: 'Detalle del Contacto',
    viewDetail: 'Ver detalle',
    accessing: 'Accediendo...',
    chat: 'Chat',
    population: (total: number) => `Población detectada: ${total} Registros`,
    previous: '← Anterior',
    next: 'Siguiente →',
    whatsappChannel: 'Canal WhatsApp',
    multipleChannels: 'Se detectaron múltiples canales vinculados. Selecciona el origen de la comunicación.',
    abort: 'Abortar',
    ensureConnection: 'Garantizar Conexión',
    invalidPhone: 'Este contacto no tiene un teléfono válido.',
    loginRequired: 'Por favor inicia sesión.',
    noChannels: 'No tienes canales de WhatsApp conectados. Por favor, conecta un número en Configuración.',
} as const;

function formatContactPhone(phone?: string | null) {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');

    if (digits.length === 13 && digits.startsWith('521')) {
        return `+52 ${digits.slice(3)}`;
    }
    if (digits.length === 12 && digits.startsWith('52')) {
        return `+52 ${digits.slice(2)}`;
    }
    if (digits.length === 10) {
        return `+52 ${digits}`;
    }

    return phone;
}

const SelectChannelModal: React.FC<SelectChannelModalProps> = ({ channels, onSelect, onClose, isResolving }) => {
    const currentTenantKey = 'default';
    const lastChannelId = localStorage.getItem(`wabee:last_channel:${currentTenantKey}`);
    const [selectedId, setSelectedId] = useState(lastChannelId && channels.find(c => c.id === lastChannelId) ? lastChannelId : channels[0].id);

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-6 backdrop-blur-sm animate-in fade-in duration-300 sm:items-center">
            <div className="relative w-full max-w-md overflow-hidden rounded-[32px] border border-[var(--border-default)] bg-[var(--bg-card)] shadow-2xl sm:rounded-[40px]">
                <div className="absolute right-0 top-0 p-5 sm:p-8">
                    <button onClick={onClose} className="p-2 text-[var(--text-muted)] transition-colors hover:text-[var(--brand-primary)]">
                        <X size={24} />
                    </button>
                </div>

                <div className="space-y-6 p-5 sm:space-y-8 sm:p-10">
                    <div className="space-y-4">
                        <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-[var(--brand-primary)]/20 bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] shadow-lg">
                            <MessageCircle size={32} />
                        </div>
                        <div>
                            <h2 className={`${T.sectionTitle} ${S.headingLg} italic tracking-tighter uppercase`}>
                                {COPY.whatsappChannel.split(' ')[0]} <span className="text-[var(--brand-primary)]">{COPY.whatsappChannel.split(' ').slice(1).join(' ')}</span>
                            </h2>
                            <p className={`${T.helperText} ${S.body} mt-2 leading-relaxed text-[var(--text-muted)]`}>{COPY.multipleChannels}</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {channels.map((channel: Channel) => (
                            <label
                                key={channel.id}
                                className={`flex cursor-pointer items-center rounded-3xl border-2 p-4 transition-all active:scale-[0.98] sm:p-5 ${selectedId === channel.id
                                    ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5 shadow-lg shadow-[var(--brand-primary)]/5'
                                    : 'border-[var(--border-default)] bg-[var(--bg-input)] hover:border-[var(--brand-primary)]/30'}`}
                            >
                                <input
                                    type="radio"
                                    name="channel"
                                    className="hidden"
                                    checked={selectedId === channel.id}
                                    onChange={() => setSelectedId(channel.id)}
                                />
                                <div className="flex-1">
                                    <div className={`${T.cardTitle} ${S.body} uppercase ${selectedId === channel.id ? 'text-[var(--brand-primary)]' : 'text-[var(--text-strong)]'}`}>
                                        {channel.name}
                                    </div>
                                    <div className={`${T.helperText} ${S.meta} mt-0.5 uppercase opacity-60 text-[var(--text-muted)]`}>
                                        {channel.displayPhone}
                                    </div>
                                </div>
                                {selectedId === channel.id && <div className="h-2 w-2 rounded-full bg-[var(--brand-primary)] shadow-[0_0_10px_var(--brand-primary)]"></div>}
                            </label>
                        ))}
                    </div>

                    <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:gap-4 sm:pt-4">
                        <button
                            onClick={onClose}
                            className={`flex-1 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] py-4 transition-all hover:bg-[var(--bg-elevated)] ${T.buttonText}`}
                        >
                            {COPY.abort}
                        </button>
                        <button
                            onClick={() => onSelect(selectedId)}
                            disabled={isResolving}
                            className={`${T.buttonPrimaryText} ${S.meta} flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--brand-primary)] py-4 uppercase shadow-xl transition-all hover:brightness-110 active:scale-95`}
                        >
                            {isResolving ? (
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--brand-primary-foreground)]/20 border-t-[var(--brand-primary-foreground)]"></div>
                            ) : (
                                <>{COPY.ensureConnection} <ArrowRight size={14} /></>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ContactsPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [contacts, setContacts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [showImport, setShowImport] = useState(false);
    const [showCreate, setShowCreate] = useState(false);
    const [showDetailId, setShowDetailId] = useState<string | null>(null);
    const [resolvingId, setResolvingId] = useState<string | null>(null);
    const [showChannelSelect, setShowChannelSelect] = useState<{ contact: any, channels: Channel[] } | null>(null);
    const [params, setParams] = useState({
        search: '',
        status: '',
        lifecycleStatus: '',
        groupId: searchParams.get('groupId') || '',
        segmentId: searchParams.get('segmentId') || '',
        page: 1,
        pageSize: 15
    });

    const { error: toastError, warning: toastWarn } = useToast();
    const { user } = { user: true };

    useEffect(() => {
        const gid = searchParams.get('groupId') || '';
        const sid = searchParams.get('segmentId') || '';
        if (gid !== params.groupId || sid !== params.segmentId) {
            setParams(prev => ({ ...prev, groupId: gid, segmentId: sid, page: 1 }));
        }
    }, [searchParams]);

    const handleWhatsAppClick = async (contact: any) => {
        if (!contact.phone) {
            toastWarn(COPY.invalidPhone);
            return;
        }

        if (!user) {
            toastError(COPY.loginRequired);
            return;
        }

        setResolvingId(contact.id);
        try {
            const connectedChannels = await getChannels({ status: 'CONNECTED' });

            if (connectedChannels.length === 0) {
                toastWarn(COPY.noChannels);
                return;
            }

            if (connectedChannels.length === 1) {
                await executeResolveAndNavigate(contact.id, connectedChannels[0].id);
            } else {
                setShowChannelSelect({ contact, channels: connectedChannels });
            }
        } catch (error: any) {
            console.error('Error pre-flight channels:', error);
            toastError(error.message || 'Error al verificar canales');
        } finally {
            setResolvingId(null);
        }
    };

    const executeResolveAndNavigate = async (contactId: string, channelId: string) => {
        setResolvingId(contactId);
        try {
            const { threadId } = await resolveThread(contactId, channelId);
            const currentTenantKey = 'default';
            localStorage.setItem(`wabee:last_channel:${currentTenantKey}`, channelId);
            navigate(`/dashboard/wabee/inbox?threadId=${threadId}&channelId=${channelId}`);
        } catch (error: any) {
            console.error('Error resolving thread:', error);
            toastError(error.message || 'Error al intentar abrir el chat');
        } finally {
            setResolvingId(null);
            setShowChannelSelect(null);
        }
    };

    const loadContacts = async () => {
        if (!user) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const data = await contactsApi.list(params);
            setContacts(data.items);
            setTotal(data.meta.total);
        } catch (error) {
            console.error('Error loading contacts:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadContacts();
    }, [params]);

    const handleUpdateLifecycle = async (id: string, newStatus: string) => {
        try {
            await contactsApi.updateLifecycle(id, newStatus);
            loadContacts();
        } catch (error: any) {
            toastError(error.message || 'Error al actualizar ciclo de vida');
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'NEW': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
            case 'LEAD': return 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20';
            case 'ACTIVE': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
            case 'CUSTOMER': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
            case 'BLOCKED': return 'bg-red-500/10 text-red-500 border-red-500/20';
            default: return 'bg-[var(--bg-input)] text-[var(--text-muted)] border-[var(--border-default)]';
        }
    };

    const { isModuleEnabled, hasReachedLimit, getLimitValue } = usePlanEnforcement();
    const isContactsDisabled = !isModuleEnabled('contacts');
    const isLimitReached = hasReachedLimit('contacts');
    const contactLimit = getLimitValue('contacts');

    return (
        <div className="mx-auto min-h-screen max-w-7xl space-y-8 bg-[var(--bg-page)] px-4 py-6 text-left sm:space-y-10 sm:px-6 sm:py-8 lg:px-8">
            <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-xl space-y-2">
                    <h1 className={`${T.pageTitle} ${S.displayMd}`}>CRM <span className="text-[var(--brand-primary)]">Inteligente</span></h1>
                    <p className={`${T.pageSubtitle} ${S.body} max-w-md`}>{COPY.subtitle}</p>
                </div>
                <div className="flex flex-col gap-2 lg:items-end">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:flex lg:flex-wrap lg:justify-end">
                        <TourButton moduleKey="contacts" />
                        <button
                            data-tour="contacts-import"
                            onClick={() => setShowImport(true)}
                            disabled={isContactsDisabled || isLimitReached}
                            className={`${T.buttonText} ${S.meta} flex items-center justify-center gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] px-5 py-3 transition-all hover:border-[var(--brand-primary)]/50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 sm:px-6`}
                            title={isContactsDisabled ? COPY.planRestricted : isLimitReached ? COPY.limitReached(contactLimit) : ''}
                        >
                            <Upload size={16} strokeWidth={3} />
                            {COPY.importCsv}
                        </button>
                        <button
                            data-tour="contacts-create"
                            onClick={() => setShowCreate(true)}
                            disabled={isContactsDisabled || isLimitReached}
                            className={`${T.buttonPrimaryText} ${S.meta} flex items-center justify-center gap-2 rounded-2xl bg-[var(--brand-primary)] px-5 py-3 shadow-xl transition-all hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:grayscale disabled:opacity-30 sm:px-8`}
                            title={isContactsDisabled ? COPY.planRestricted : isLimitReached ? COPY.limitReached(contactLimit) : ''}
                        >
                            <PlusCircle size={18} />
                            {COPY.newContact}
                        </button>
                    </div>
                    {isLimitReached && !isContactsDisabled && (
                        <p className={`${T.helperText} ${S.meta} text-orange-500 uppercase tracking-tighter italic animate-pulse`}>
                            {COPY.limitReached(contactLimit)}
                        </p>
                    )}
                    {isContactsDisabled && (
                        <p className={`${T.helperText} ${S.meta} text-red-500 uppercase tracking-tighter italic`}>
                            {COPY.planRestricted}
                        </p>
                    )}
                </div>
            </header>

            {showImport && <ImportContactsModal onClose={() => setShowImport(false)} onSuccess={() => { loadContacts(); }} />}
            {showCreate && <CreateContactModal onClose={() => setShowCreate(false)} onSuccess={() => { loadContacts(); }} />}
            {showDetailId && <ContactDetailModal contactId={showDetailId} onClose={() => setShowDetailId(null)} onSuccess={() => { loadContacts(); }} />}
            {showChannelSelect && (
                <SelectChannelModal
                    channels={showChannelSelect.channels}
                    onSelect={(channelId) => executeResolveAndNavigate(showChannelSelect.contact.id, channelId)}
                    onClose={() => setShowChannelSelect(null)}
                    isResolving={resolvingId === showChannelSelect.contact.id}
                />
            )}

            {params.groupId && (
                <div className="relative flex flex-col gap-4 overflow-hidden rounded-3xl border border-blue-500/20 bg-blue-500/5 p-4 animate-in fade-in slide-in-from-left-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                    <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 bg-blue-500/5 blur-[50px]"></div>
                    <div className="flex items-center gap-4 text-blue-400">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10">
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                        </div>
                        <div>
                            <span className={`${T.helperText} ${S.meta} mb-0.5 block uppercase opacity-50`}>{COPY.activeFilter}</span>
                            <span className={`${T.sectionTitle} ${S.body} italic uppercase text-white`}>{COPY.specificGroup}</span>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            setParams({ ...params, groupId: '', page: 1 });
                            setSearchParams({});
                        }}
                        className={`${T.buttonText} ${S.meta} rounded-xl border border-blue-500/20 bg-blue-500/10 px-6 py-2 text-blue-400 transition-all hover:text-blue-300`}
                    >
                        {COPY.closeView}
                    </button>
                </div>
            )}

            {params.segmentId && (
                <div className="relative flex flex-col gap-4 overflow-hidden rounded-3xl border border-indigo-500/20 bg-indigo-500/5 p-4 animate-in fade-in slide-in-from-left-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                    <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 bg-indigo-500/5 blur-[50px]"></div>
                    <div className="flex items-center gap-4 text-indigo-400">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-500/20 bg-indigo-500/10">
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        </div>
                        <div>
                            <span className={`${T.helperText} ${S.meta} mb-0.5 block uppercase opacity-50`}>{COPY.dynamicView}</span>
                            <span className={`${T.sectionTitle} ${S.body} italic uppercase text-white`}>{COPY.smartSegment}</span>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            setParams({ ...params, segmentId: '', page: 1 });
                            setSearchParams({});
                        }}
                        className={`${T.buttonText} ${S.meta} rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-6 py-2 text-indigo-400 transition-all hover:text-indigo-300`}
                    >
                        {COPY.leaveSegment}
                    </button>
                </div>
            )}

            <div data-tour="contacts-search" className="flex flex-col gap-4 rounded-3xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 shadow-2xl sm:p-6 lg:flex-row lg:items-center lg:gap-6">
                <div className="group relative w-full min-w-0 flex-1">
                    <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center">
                        <svg className="h-5 w-5 text-[var(--text-muted)]/30 transition-colors group-focus-within:text-[var(--brand-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                    <input
                        type="text"
                        placeholder={COPY.searchPlaceholder}
                        className={`${T.inputText} ${S.body} w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] py-4 pl-12 pr-6 outline-none transition-all placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/50`}
                        value={params.search}
                        onChange={(e) => setParams({ ...params, search: e.target.value, page: 1 })}
                    />
                </div>
                <div className="group relative w-full lg:w-auto">
                    <select
                        className={`${T.inputText} ${S.meta} w-full min-w-0 cursor-pointer appearance-none rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] py-4 pl-6 pr-12 uppercase outline-none transition-all focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/50 lg:min-w-[220px]`}
                        value={params.lifecycleStatus}
                        onChange={(e) => setParams({ ...params, lifecycleStatus: e.target.value, page: 1 })}
                    >
                        <option value="" className="bg-[var(--bg-card)]">{COPY.allEcosystem}</option>
                        <option value="NEW" className="bg-[var(--bg-card)]">{COPY.newEntry}</option>
                        <option value="LEAD" className="bg-[var(--bg-card)]">{COPY.qualifiedLead}</option>
                        <option value="ACTIVE" className="bg-[var(--bg-card)]">{COPY.activeLink}</option>
                        <option value="CUSTOMER" className="bg-[var(--bg-card)]">{COPY.loyalCustomer}</option>
                        <option value="INACTIVE" className="bg-[var(--bg-card)]">{COPY.inactive}</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center">
                        <svg className="h-4 w-4 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                </div>
            </div>

            <div data-tour="contacts-table" className="overflow-hidden rounded-[32px] border border-[var(--border-default)] bg-[var(--bg-card)] shadow-2xl">
                <div className="divide-y divide-[var(--border-default)] md:hidden">
                    {loading && (
                        <div className="px-6 py-16 text-center">
                            <div className="flex flex-col items-center justify-center gap-4">
                                <div className="h-12 w-12 animate-spin rounded-full border-4 border-[var(--brand-primary)]/10 border-t-[var(--brand-primary)]"></div>
                                <p className={`${T.helperText} ${S.meta} uppercase animate-pulse`}>{COPY.scanning}</p>
                            </div>
                        </div>
                    )}
                    {!loading && contacts.length === 0 && (
                        <div className={`${T.helperText} ${S.meta} px-6 py-16 text-center italic uppercase opacity-30`}>{COPY.noRecords}</div>
                    )}
                    {!loading && contacts.map(c => (
                        <article key={c.id} className="space-y-4 p-4 sm:p-5">
                            <div className="flex items-start gap-4">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-[var(--bg-card)] bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-primary)]/80 text-sm font-black text-[var(--brand-primary-foreground)] shadow-lg">
                                    {(c.name || 'S').charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className={`${T.tableCell} ${S.body} break-words`}>{c.name || COPY.noName}</p>
                                    <p className={`${T.helperText} ${S.meta} mt-1 break-all uppercase`}>{c.email || COPY.noEmail}</p>
                                    <p className={`${T.tableCell} ${S.body} mt-2 break-all font-mono tracking-tight text-indigo-400`}>{formatContactPhone(c.phone)}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                                <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
                                    <span className={`${T.helperText} ${S.meta} mb-2 block uppercase opacity-50`}>{COPY.protocol}</span>
                                    <span className={`${T.badgeText} ${S.meta} inline-block rounded-full border px-3 py-1 uppercase ${c.status === 'ACTIVE' ? 'bg-green-500/10 text-green-600 border-green-500/20' : 'bg-red-500/10 text-red-600 border-red-500/20'}`}>
                                        {c.status}
                                    </span>
                                </div>

                                <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
                                    <span className={`${T.helperText} ${S.meta} mb-2 block uppercase opacity-50`}>{COPY.globalStatus}</span>
                                    <div className="relative">
                                        <select
                                            className={`${T.badgeText} ${S.meta} w-full appearance-none rounded-xl border bg-[var(--bg-input)] py-2 pl-3 pr-8 uppercase outline-none transition-all ${getStatusColor(c.lifecycleStatus)}`}
                                            value={c.lifecycleStatus}
                                            onChange={(e) => handleUpdateLifecycle(c.id, e.target.value)}
                                        >
                                            <option value="NEW" className="bg-[var(--bg-card)]">NUEVO</option>
                                            <option value="LEAD" className="bg-[var(--bg-card)]">LEAD</option>
                                            <option value="ACTIVE" className="bg-[var(--bg-card)]">ACTIVO</option>
                                            <option value="CUSTOMER" className="bg-[var(--bg-card)]">CLIENTE</option>
                                            <option value="INACTIVE" className="bg-[var(--bg-card)]">INACTIVO</option>
                                            <option value="BLOCKED" className="bg-[var(--bg-card)]">BLOQUEADO</option>
                                        </select>
                                        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center opacity-50">
                                            <svg className="h-3 w-3 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
                                    <span className={`${T.helperText} ${S.meta} mb-2 block uppercase opacity-50`}>{COPY.segments}</span>
                                    <div className="flex flex-wrap gap-1.5">
                                        {(c.tags || []).slice(0, 4).map((t: string) => (
                                            <span key={t} className={`${T.badgeText} ${S.meta} max-w-full truncate rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 uppercase text-[color:var(--tx-helperText-color)]`} title={t}>
                                                {t}
                                            </span>
                                        ))}
                                        {(c.tags || []).length === 0 && <span className={`${T.helperText} ${S.meta} italic uppercase text-[var(--text-muted)]`}>{COPY.noTags}</span>}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => handleWhatsAppClick(c)}
                                    disabled={resolvingId === c.id}
                                    className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-3 uppercase transition-all [font-family:var(--tx-buttonText-font)] text-[10px] font-black tracking-widest ${resolvingId === c.id ? 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]' : 'bg-green-500/10 text-green-600 hover:bg-green-500/15'}`}
                                >
                                    <svg className={`h-4 w-4 ${resolvingId === c.id ? 'animate-spin' : 'transition-transform group-hover/wp:scale-125'}`} fill="currentColor" viewBox="0 0 24 24">
                                        {resolvingId === c.id ? (
                                            <path d="M12 4V2m0 20v-2m8-8h2M2 12h2m15.364-7.364l-1.414 1.414M6.05 17.95l-1.414 1.414M17.95 17.95l1.414 1.414M6.05 6.05L4.636 4.636M12 12a4 4 0 110-8 4 4 0 010 8z" />
                                        ) : (
                                            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.438 9.889-9.889.002-5.462-4.415-9.89-9.875-9.89-5.451 0-9.89 4.437-9.892 9.886 0 2.235.614 4.09 1.761 5.764l-.999 3.649 3.725-.912zm10.53-7.234c-.287-.144-1.693-.836-1.956-.932-.262-.095-.453-.144-.644.144-.191.287-.74.932-.907 1.123-.167.191-.334.215-.62.072-.287-.144-1.21-.447-2.305-1.424-.852-.76-1.428-1.698-1.594-1.986-.167-.287-.018-.442.126-.583.13-.127.287-.334.43-.502.144-.167.191-.287.287-.478.095-.191.048-.359-.024-.502-.072-.144-.644-1.553-.883-2.126-.233-.558-.469-.482-.644-.491-.167-.008-.358-.01-.55-.01s-.501.072-.764.359c-.263.287-1.003.98-1.003 2.39s1.027 2.77 1.17 2.962c.144.191 2.02 3.085 4.895 4.327.684.296 1.218.473 1.634.605.687.218 1.313.187 1.807.113.551-.082 1.693-.693 1.932-1.362.24-.669.24-1.242.167-1.362-.072-.12-.263-.191-.55-.335z" />
                                        )}
                                    </svg>
                                    {resolvingId === c.id ? COPY.accessing : COPY.chat}
                                </button>
                                <button
                                    onClick={() => setShowDetailId(c.id)}
                                    className={`flex items-center justify-center gap-2 rounded-2xl border border-transparent bg-[var(--bg-input)] px-4 py-3 uppercase transition-all hover:border-[var(--brand-primary)]/20 hover:bg-[var(--brand-primary)]/10 hover:text-[var(--brand-primary)] ${T.helperText}`}
                                    title={COPY.detailTitle}
                                >
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                    {COPY.viewDetail}
                                </button>
                            </div>
                        </article>
                    ))}
                </div>

                <div className="hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[920px] border-collapse text-left">
                        <thead>
                            <tr className="border-b border-[var(--border-default)] bg-[var(--bg-surface)]">
                                <th className={`${T.tableHeader} ${S.meta} px-8 py-6 uppercase italic`}>{COPY.identity}</th>
                                <th className={`${T.tableHeader} ${S.meta} px-8 py-6 uppercase italic`}>{COPY.telephony}</th>
                                <th className={`${T.tableHeader} ${S.meta} px-8 py-6 text-center uppercase italic`}>{COPY.protocol}</th>
                                <th className={`${T.tableHeader} ${S.meta} px-8 py-6 uppercase italic`}>{COPY.globalStatus}</th>
                                <th className={`${T.tableHeader} ${S.meta} px-8 py-6 uppercase italic`}>{COPY.segments}</th>
                                <th className={`${T.tableHeader} ${S.meta} px-8 py-6 text-right uppercase italic`}>{COPY.commands}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-default)]">
                            {loading && (
                                <tr><td colSpan={6} className="px-8 py-20 text-center"><div className="flex flex-col items-center justify-center gap-4"><div className="h-12 w-12 animate-spin rounded-full border-4 border-[var(--brand-primary)]/10 border-t-[var(--brand-primary)]"></div><p className={`${T.helperText} ${S.meta} uppercase animate-pulse`}>{COPY.scanning}</p></div></td></tr>
                            )}
                            {!loading && contacts.length === 0 && (
                                <tr><td colSpan={6} className={`${T.helperText} ${S.meta} px-8 py-20 text-center italic uppercase opacity-30`}>{COPY.noRecords}</td></tr>
                            )}
                            {contacts.map(c => (
                                <tr key={c.id} className="group transition-colors hover:bg-[var(--brand-primary)]/[0.02]">
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-4">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[var(--bg-card)] bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-primary)]/80 text-sm font-black text-[var(--brand-primary-foreground)] shadow-lg">
                                                {(c.name || 'S').charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className={`${T.tableCell} ${S.body} transition-colors duration-300 group-hover:text-[var(--brand-primary)]`}>{c.name || COPY.noName}</p>
                                                <p className={`${T.helperText} ${S.meta} uppercase`}>{c.email || COPY.noEmail}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className={`${T.tableCell} ${S.body} px-8 py-5 font-mono tracking-tight text-indigo-400`}>{formatContactPhone(c.phone)}</td>
                                    <td className="px-8 py-5 text-center">
                                        <span className={`${T.badgeText} ${S.meta} inline-block rounded-full border px-3 py-1 uppercase ${c.status === 'ACTIVE' ? 'bg-green-500/10 text-green-600 border-green-500/20' : 'bg-red-500/10 text-red-600 border-red-500/20'}`}>
                                            {c.status}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="relative inline-block">
                                            <select
                                                className={`${T.badgeText} ${S.meta} appearance-none rounded-xl border-b-2 border-transparent bg-[var(--bg-input)] py-1.5 pl-3 pr-8 uppercase outline-none transition-all hover:border-[var(--brand-primary)] ${getStatusColor(c.lifecycleStatus)}`}
                                                value={c.lifecycleStatus}
                                                onChange={(e) => handleUpdateLifecycle(c.id, e.target.value)}
                                            >
                                                <option value="NEW" className="bg-[var(--bg-card)]">NUEVO</option>
                                                <option value="LEAD" className="bg-[var(--bg-card)]">LEAD</option>
                                                <option value="ACTIVE" className="bg-[var(--bg-card)]">ACTIVO</option>
                                                <option value="CUSTOMER" className="bg-[var(--bg-card)]">CLIENTE</option>
                                                <option value="INACTIVE" className="bg-[var(--bg-card)]">INACTIVO</option>
                                                <option value="BLOCKED" className="bg-[var(--bg-card)]">BLOQUEADO</option>
                                            </select>
                                            <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center opacity-50">
                                                <svg className="h-3 w-3 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="flex max-w-[200px] flex-wrap gap-1.5">
                                            {(c.tags || []).slice(0, 3).map((t: string) => (
                                                <span key={t} className={`${T.badgeText} ${S.meta} max-w-[100px] truncate rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-0.5 uppercase text-[color:var(--tx-helperText-color)] transition-colors group-hover:border-[var(--brand-primary)]/30 hover:text-[var(--text-strong)]`} title={t}>
                                                    {t}
                                                </span>
                                            ))}
                                            {(c.tags || []).length > 3 && (
                                                <div className="group/more relative flex items-center">
                                                    <span className={`${T.badgeText} ${S.meta} cursor-help rounded border border-[var(--brand-primary)]/20 bg-[var(--bg-input)] px-2 py-0.5 uppercase text-[var(--brand-primary)] transition-colors group-hover:border-[var(--brand-primary)]/50`}>
                                                        +{(c.tags || []).length - 3}
                                                    </span>
                                                    <div className="invisible absolute bottom-full left-1/2 z-[60] mb-2 min-w-[140px] -translate-x-1/2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-3 opacity-0 shadow-2xl transition-all duration-200 group-hover/more:visible group-hover/more:opacity-100">
                                                        <div className="flex flex-col gap-1.5">
                                                            <div className={`${T.helperText} ${S.meta} mb-0.5 border-b border-[var(--border-default)] pb-1.5 uppercase text-[var(--text-muted)]`}>{COPY.hiddenSegments}</div>
                                                            {(c.tags || []).slice(3).map((hidTag: string) => (
                                                                <div key={hidTag} className="flex items-center gap-1.5">
                                                                    <div className="h-1 w-1 rounded-full bg-[var(--brand-primary)]"></div>
                                                                    <span className={`${T.helperText} ${S.meta} max-w-[160px] truncate uppercase`}>{hidTag}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-[#2a2a1a]"></div>
                                                        <div className="absolute left-1/2 top-full -mt-[1px] -translate-x-1/2 border-4 border-transparent border-t-[#121208]"></div>
                                                    </div>
                                                </div>
                                            )}
                                            {(c.tags || []).length === 0 && <span className={`${T.helperText} ${S.meta} italic uppercase text-[var(--text-muted)]`}>{COPY.noTags}</span>}
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="flex items-center justify-end gap-4">
                                            <button
                                                onClick={() => handleWhatsAppClick(c)}
                                                disabled={resolvingId === c.id}
                                                className={`group/wp flex items-center gap-2 rounded-xl px-4 py-2 uppercase transition-all [font-family:var(--tx-buttonText-font)] text-[10px] font-black tracking-widest ${resolvingId === c.id ? 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]' : 'bg-green-500/10 text-green-600 hover:bg-green-500/15'}`}
                                            >
                                                <svg className={`h-4 w-4 ${resolvingId === c.id ? 'animate-spin' : 'transition-transform group-hover/wp:scale-125'}`} fill="currentColor" viewBox="0 0 24 24">
                                                    {resolvingId === c.id ? (
                                                        <path d="M12 4V2m0 20v-2m8-8h2M2 12h2m15.364-7.364l-1.414 1.414M6.05 17.95l-1.414 1.414M17.95 17.95l1.414 1.414M6.05 6.05L4.636 4.636M12 12a4 4 0 110-8 4 4 0 010 8z" />
                                                    ) : (
                                                        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.438 9.889-9.889.002-5.462-4.415-9.89-9.875-9.89-5.451 0-9.89 4.437-9.892 9.886 0 2.235.614 4.09 1.761 5.764l-.999 3.649 3.725-.912zm10.53-7.234c-.287-.144-1.693-.836-1.956-.932-.262-.095-.453-.144-.644.144-.191.287-.74.932-.907 1.123-.167.191-.334.215-.62.072-.287-.144-1.21-.447-2.305-1.424-.852-.76-1.428-1.698-1.594-1.986-.167-.287-.018-.442.126-.583.13-.127.287-.334.43-.502.144-.167.191-.287.287-.478.095-.191.048-.359-.024-.502-.072-.144-.644-1.553-.883-2.126-.233-.558-.469-.482-.644-.491-.167-.008-.358-.01-.55-.01s-.501.072-.764.359c-.263.287-1.003.98-1.003 2.39s1.027 2.77 1.17 2.962c.144.191 2.02 3.085 4.895 4.327.684.296 1.218.473 1.634.605.687.218 1.313.187 1.807.113.551-.082 1.693-.693 1.932-1.362.24-.669.24-1.242.167-1.362-.072-.12-.263-.191-.55-.335z" />
                                                    )}
                                                </svg>
                                                {resolvingId === c.id ? COPY.accessing : COPY.chat}
                                            </button>
                                            <button
                                                onClick={() => setShowDetailId(c.id)}
                                                className={`rounded-xl border border-transparent bg-[var(--bg-input)] p-2.5 transition-all hover:border-[var(--brand-primary)]/20 hover:bg-[var(--brand-primary)]/10 hover:text-[var(--brand-primary)] ${T.helperText}`}
                                                title={COPY.detailTitle}
                                            >
                                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="flex flex-col gap-4 border-t border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-5">
                    <div className="flex items-center gap-3">
                        <div className="h-1.5 w-1.5 rounded-full bg-[var(--brand-primary)] shadow-[0_0_8px_var(--brand-primary)]"></div>
                        <span className={`${T.helperText} ${S.meta} uppercase italic text-[var(--text-muted)] opacity-60`}>{COPY.population(total)}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:flex sm:gap-4">
                        <button
                            disabled={params.page === 1}
                            onClick={() => setParams({ ...params, page: params.page - 1 })}
                            className={`${T.buttonText} ${S.meta} rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-4 py-2.5 uppercase transition-all hover:border-[var(--brand-primary)]/50 disabled:grayscale disabled:opacity-20 sm:px-6`}
                        >
                            {COPY.previous}
                        </button>
                        <button
                            disabled={params.page * params.pageSize >= total}
                            onClick={() => setParams({ ...params, page: params.page + 1 })}
                            className={`${T.buttonText} ${S.meta} rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-4 py-2.5 uppercase transition-all hover:border-[var(--brand-primary)]/50 disabled:grayscale disabled:opacity-20 sm:px-6`}
                        >
                            {COPY.next}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ContactsPage;
