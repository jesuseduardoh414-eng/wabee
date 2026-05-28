import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { contactsApi } from '@/api/wabee/contacts.api';
import { resolveThread } from '@/api/wabee/inbox.api';
import { getChannels, Channel } from '@/api/wabee/whatsapp.api';
import { T, S } from '@/lib/text-tokens';
import { ImportContactsModal } from './contacts/components/ImportContactsModal';
import { CreateContactModal } from './contacts/components/CreateContactModal';
import { ContactDetailModal } from './contacts/components/ContactDetailModal';
import {
    Users,
    Upload,
    PlusCircle,
    MessageCircle,
    Search,
    ChevronDown,
    ExternalLink,
    Filter,
    ArrowRight,
    Zap,
    X,
    Tag,
    Layers
} from 'lucide-react';
import { useToast } from '@/context/ToastContext';
import { usePlanEnforcement } from '@/hooks/usePlanEnforcement';

interface SelectChannelModalProps {
    channels: Channel[];
    onSelect: (channelId: string) => void;
    onClose: () => void;
    isResolving: boolean;
}

const SelectChannelModal: React.FC<SelectChannelModalProps> = ({ channels, onSelect, onClose, isResolving }) => {
    const currentTenantKey = 'default';
    const lastChannelId = localStorage.getItem(`wabee:last_channel:${currentTenantKey}`);
    const [selectedId, setSelectedId] = useState(lastChannelId && channels.find(c => c.id === lastChannelId) ? lastChannelId : channels[0].id);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-[40px] w-full max-w-md overflow-hidden shadow-2xl relative">
                <div className="absolute top-0 right-0 p-8">
                    <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--brand-primary)] transition-colors p-2">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-10 space-y-8">
                    <div className="space-y-4">
                    <div className="w-16 h-16 bg-[var(--brand-primary)]/10 rounded-3xl flex items-center justify-center text-[var(--brand-primary)] border border-[var(--brand-primary)]/20 shadow-lg">
                        <MessageCircle size={32} />
                    </div>
                        <div>
                            <h2 className={`${T.sectionTitle} ${S.headingLg} italic tracking-tighter uppercase`}>Canal <span className="text-[var(--brand-primary)]">WhatsApp</span></h2>
                            <p className={`${T.helperText} ${S.body} text-[var(--text-muted)] mt-2 leading-relaxed`}>Se detectaron múltiples canales vinculados. Selecciona el origen de la comunicación.</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {channels.map((channel: Channel) => (
                            <label
                                key={channel.id}
                                className={`flex items-center p-5 border-2 rounded-3xl cursor-pointer transition-all active:scale-[0.98] ${selectedId === channel.id
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
                                    <div className={`${T.helperText} ${S.meta} uppercase mt-0.5 opacity-60 text-[var(--text-muted)]`}>
                                        {channel.displayPhone}
                                    </div>
                                </div>
                                {selectedId === channel.id && (
                                    <div className="w-2 h-2 rounded-full bg-[var(--brand-primary)] shadow-[0_0_10px_var(--brand-primary)]"></div>
                                )}
                            </label>
                        ))}
                    </div>

                    <div className="flex gap-4 pt-4">
                        <button
                            onClick={onClose}
                            className={`flex-1 bg-[var(--bg-card)] py-4 rounded-2xl border border-[var(--border-default)] hover:bg-[var(--bg-elevated)] transition-all ${T.buttonText}`}
                        >
                            Abortar
                        </button>
                        <button
                            onClick={() => onSelect(selectedId)}
                            disabled={isResolving}
                            className={`${T.buttonPrimaryText} ${S.meta} flex-1 bg-[var(--brand-primary)] py-4 rounded-2xl uppercase shadow-xl hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2`}
                        >
                            {isResolving ? (
                                <div className="w-4 h-4 border-2 border-[var(--brand-primary-foreground)]/20 border-t-[var(--brand-primary-foreground)] rounded-full animate-spin"></div>
                            ) : (
                                <>Garantizar Conexión <ArrowRight size={14} /></>
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

    // Mock or useAuth if available - assume user is present or handled by layout
    const { user } = { user: true };

    // Sync URL params to state
    useEffect(() => {
        const gid = searchParams.get('groupId') || '';
        const sid = searchParams.get('segmentId') || '';
        if (gid !== params.groupId || sid !== params.segmentId) {
            setParams(prev => ({ ...prev, groupId: gid, segmentId: sid, page: 1 }));
        }
    }, [searchParams]);

    const handleWhatsAppClick = async (contact: any) => {
        if (!contact.phone) {
            toastWarn('Este contacto no tiene un teléfono válido.');
            return;
        }

        if (!user) {
            toastError('Por favor inicia sesión.');
            return;
        }

        setResolvingId(contact.id);
        try {
            // 1. Fetch connected channels
            const connectedChannels = await getChannels({ status: 'CONNECTED' });

            if (connectedChannels.length === 0) {
                toastWarn('No tienes canales de WhatsApp conectados. Por favor, conecta un número en Configuración.');
                return;
            }

            if (connectedChannels.length === 1) {
                // Flow for single channel: direct
                await executeResolveAndNavigate(contact.id, connectedChannels[0].id);
            } else {
                // Flow for multiple channels: show modal
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

            // Save last channel for this tenant context
            const currentTenantKey = 'default';
            localStorage.setItem(`wabee:last_channel:${currentTenantKey}`, channelId);

            // Navigate to inbox
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
        <div className="p-8 max-w-7xl mx-auto space-y-10 bg-[var(--bg-page)] min-h-screen text-left">
            <header className="flex justify-between items-end gap-6">
                <div className="space-y-2">
                    <h1 className={`${T.pageTitle} ${S.displayMd}`}>CRM <span className="text-[var(--brand-primary)]">Inteligente</span></h1>
                    <p className={`${T.pageSubtitle} ${S.body} max-w-md`}>Gestiona tus relaciones, segmentación dinámica y flujos de conversión en tiempo real.</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <div className="flex gap-4 mb-1">
                        <button
                            onClick={() => setShowImport(true)}
                            disabled={isContactsDisabled || isLimitReached}
                            className={`${T.buttonText} ${S.meta} flex items-center gap-3 px-6 py-3 bg-[var(--bg-input)] border border-[var(--border-default)] rounded-2xl hover:border-[var(--brand-primary)]/50 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed`}
                            title={isContactsDisabled ? "Módulo no incluido en tu plan" : isLimitReached ? "Límite de contactos alcanzado" : ""}
                        >
                            <Upload size={16} strokeWidth={3} />
                            Importar CSV
                        </button>
                        <button
                            onClick={() => setShowCreate(true)}
                            disabled={isContactsDisabled || isLimitReached}
                            className={`${T.buttonPrimaryText} ${S.meta} bg-[var(--brand-primary)] px-8 py-3 rounded-2xl shadow-xl hover:brightness-110 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed`}
                            title={isContactsDisabled ? "Módulo no incluido en tu plan" : isLimitReached ? "Límite de contactos alcanzado" : ""}
                        >
                            <PlusCircle size={18} />
                            Nuevo Contacto
                        </button>
                    </div>
                    {isLimitReached && !isContactsDisabled && (
                        <p className={`${T.helperText} ${S.meta} text-orange-500 uppercase tracking-tighter italic animate-pulse`}>
                            ⚠ Has alcanzado tu límite de {contactLimit} contactos
                        </p>
                    )}
                    {isContactsDisabled && (
                        <p className={`${T.helperText} ${S.meta} text-red-500 uppercase tracking-tighter italic`}>
                            Módulo de contactos restringido por tu plan
                        </p>
                    )}
                </div>
            </header>


            {showImport && (
                <ImportContactsModal
                    onClose={() => setShowImport(false)}
                    onSuccess={() => { loadContacts(); }}
                />
            )}

            {showCreate && (
                <CreateContactModal
                    onClose={() => setShowCreate(false)}
                    onSuccess={() => { loadContacts(); }}
                />
            )}

            {showDetailId && (
                <ContactDetailModal
                    contactId={showDetailId}
                    onClose={() => setShowDetailId(null)}
                    onSuccess={() => { loadContacts(); }}
                />
            )}

            {showChannelSelect && (
                <SelectChannelModal
                    channels={showChannelSelect.channels}
                    onSelect={(channelId) => executeResolveAndNavigate(showChannelSelect.contact.id, channelId)}
                    onClose={() => setShowChannelSelect(null)}
                    isResolving={resolvingId === showChannelSelect.contact.id}
                />
            )}

            {params.groupId && (
                <div className="bg-blue-500/5 border border-blue-500/20 p-5 rounded-3xl flex justify-between items-center animate-in fade-in slide-in-from-left-4 overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[50px] pointer-events-none"></div>
                    <div className="flex items-center gap-4 text-blue-400">
                        <div className="h-10 w-10 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                        </div>
                        <div>
                            <span className={`${T.helperText} ${S.meta} opacity-50 block mb-0.5 uppercase`}>Filtrado activo</span>
                            <span className={`${T.sectionTitle} ${S.body} text-white italic uppercase`}>Grupo de Pertenencia Específico</span>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            setParams({ ...params, groupId: '', page: 1 });
                            setSearchParams({});
                        }}
                        className={`${T.buttonText} ${S.meta} text-blue-400 hover:text-blue-300 bg-blue-500/10 px-6 py-2 rounded-xl transition-all border border-blue-500/20`}
                    >
                        Cerrar Vista
                    </button>
                </div>
            )}

            {params.segmentId && (
                <div className="bg-indigo-500/5 border border-indigo-500/20 p-5 rounded-3xl flex justify-between items-center animate-in fade-in slide-in-from-left-4 overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-[50px] pointer-events-none"></div>
                    <div className="flex items-center gap-4 text-indigo-400">
                        <div className="h-10 w-10 bg-indigo-500/10 rounded-xl flex items-center justify-center border border-indigo-500/20">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        </div>
                        <div>
                            <span className={`${T.helperText} ${S.meta} opacity-50 block mb-0.5 uppercase`}>Visión Dinámica</span>
                            <span className={`${T.sectionTitle} ${S.body} text-white italic uppercase`}>Segmento de Datos Inteligente</span>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            setParams({ ...params, segmentId: '', page: 1 });
                            setSearchParams({});
                        }}
                        className={`${T.buttonText} ${S.meta} text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 px-6 py-2 rounded-xl transition-all border border-indigo-500/20`}
                    >
                        Salir del Segmento
                    </button>
                </div>
            )}

            {/* FILTERS */}
            <div className="bg-[var(--bg-card)] p-6 rounded-3xl border border-[var(--border-default)] shadow-2xl flex flex-wrap gap-6 items-center">
                <div className="flex-1 min-w-[300px] relative group">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                        <svg className="w-5 h-5 text-[var(--text-muted)]/30 group-focus-within:text-[var(--brand-primary)] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                    <input
                        type="text"
                        placeholder="Buscar por identidad, telefonía o correo..."
                        className={`${T.inputText} ${S.body} w-full pl-12 pr-6 py-4 bg-[var(--bg-input)] border border-[var(--border-default)] rounded-2xl outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/50 focus:border-[var(--brand-primary)] transition-all placeholder:text-[var(--text-muted)]`}
                        value={params.search}
                        onChange={(e) => setParams({ ...params, search: e.target.value, page: 1 })}
                    />
                </div>
                <div className="relative group">
                    <select
                        className={`${T.inputText} ${S.meta} pl-6 pr-12 py-4 bg-[var(--bg-input)] border border-[var(--border-default)] rounded-2xl outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/50 focus:border-[var(--brand-primary)] transition-all appearance-none cursor-pointer min-w-[220px] uppercase`}
                        value={params.lifecycleStatus}
                        onChange={(e) => setParams({ ...params, lifecycleStatus: e.target.value, page: 1 })}
                    >
                        <option value="" className="bg-[var(--bg-card)]">Todo el Ecosistema</option>
                        <option value="NEW" className="bg-[var(--bg-card)]">Nuevo Ingreso</option>
                        <option value="LEAD" className="bg-[var(--bg-card)]">Lead Calificado</option>
                        <option value="ACTIVE" className="bg-[var(--bg-card)]">Vínculo Activo</option>
                        <option value="CUSTOMER" className="bg-[var(--bg-card)]">Cliente Fidelizado</option>
                        <option value="INACTIVE" className="bg-[var(--bg-card)]">Inactivo</option>
                    </select>
                    <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                        <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                </div>
            </div>

            {/* TABLE SECTION */}
            <div className="bg-[var(--bg-card)] rounded-[32px] border border-[var(--border-default)] shadow-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-[var(--bg-surface)] border-b border-[var(--border-default)]">
                                <th className={`${T.tableHeader} ${S.meta} px-8 py-6 uppercase italic`}>Identidad</th>
                                <th className={`${T.tableHeader} ${S.meta} px-8 py-6 uppercase italic`}>Telefonía</th>
                                <th className={`${T.tableHeader} ${S.meta} px-8 py-6 uppercase italic text-center`}>Protocolo</th>
                                <th className={`${T.tableHeader} ${S.meta} px-8 py-6 uppercase italic`}>Estado Global</th>
                                <th className={`${T.tableHeader} ${S.meta} px-8 py-6 uppercase italic`}>Segmentos</th>
                                <th className={`${T.tableHeader} ${S.meta} px-8 py-6 uppercase italic text-right`}>Comandos</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-default)]">
                            {loading && (
                                <tr><td colSpan={6} className="px-8 py-20 text-center"><div className="flex justify-center flex-col items-center gap-4"><div className="w-12 h-12 border-4 border-[var(--brand-primary)]/10 border-t-[var(--brand-primary)] rounded-full animate-spin"></div><p className={`${T.helperText} ${S.meta} uppercase animate-pulse`}>Escaneando Base de Datos...</p></div></td></tr>
                            )}
                            {!loading && contacts.length === 0 && (
                                <tr><td colSpan={6} className={`${T.helperText} ${S.meta} px-8 py-20 text-center italic uppercase opacity-30`}>Sin registros detectados en este canal</td></tr>
                            )}
                            {contacts.map(c => (
                                <tr key={c.id} className="hover:bg-[var(--brand-primary)]/[0.02] transition-colors group">
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-primary)]/80 flex items-center justify-center text-[var(--brand-primary-foreground)] font-black text-sm border-2 border-[var(--bg-card)] shadow-lg">
                                                {(c.name || 'S').charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className={`${T.tableCell} ${S.body} group-hover:text-[var(--brand-primary)] transition-colors duration-300`}>{c.name || 'Sin nombre'}</p>
                                                <p className={`${T.helperText} ${S.meta} uppercase`}>{c.email || 'SIN CORREO'}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className={`${T.tableCell} ${S.body} px-8 py-5 text-indigo-400 font-mono tracking-tight`}>{c.phone}</td>
                                    <td className="px-8 py-5 text-center">
                                        <span className={`${T.badgeText} ${S.meta} inline-block px-3 py-1 rounded-full uppercase border ${c.status === 'ACTIVE' ? 'bg-green-500/10 text-green-600 border-green-500/20' : 'bg-red-500/10 text-red-600 border-red-500/20'}`}>
                                            {c.status}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="relative inline-block group/select">
                                            <select
                                                className={`${T.badgeText} ${S.meta} pl-3 pr-8 py-1.5 rounded-xl uppercase outline-none border-b-2 transition-all cursor-pointer appearance-none bg-[var(--bg-input)] ${getStatusColor(c.lifecycleStatus)} border-transparent hover:border-[var(--brand-primary)]`}
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
                                            <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none opacity-50">
                                                <svg className="w-3 h-3 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="flex flex-wrap gap-1.5 max-w-[200px]">
                                            {(c.tags || []).slice(0, 3).map((t: string) => (
                                                <span key={t} className={`${T.badgeText} ${S.meta} bg-[var(--bg-input)] text-[color:var(--tx-helperText-color)] hover:text-[var(--text-strong)] px-2 py-0.5 rounded uppercase border border-[var(--border-default)] group-hover:border-[var(--brand-primary)]/30 transition-colors truncate max-w-[100px]`} title={t}>
                                                    {t}
                                                </span>
                                            ))}
                                            {(c.tags || []).length > 3 && (
                                                <div className="relative group/more flex items-center">
                                                    <span className={`${T.badgeText} ${S.meta} bg-[var(--bg-input)] text-[var(--brand-primary)] px-2 py-0.5 rounded uppercase border border-[var(--brand-primary)]/20 group-hover:border-[var(--brand-primary)]/50 transition-colors cursor-help`}>
                                                        +{(c.tags || []).length - 3}
                                                    </span>
                                                    {/* Tooltip personalizado en lista */}
                                                    <div className="absolute opacity-0 invisible group-hover/more:opacity-100 group-hover/more:visible transition-all duration-200 z-[60] bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[var(--bg-card)] border border-[var(--border-default)] shadow-2xl rounded-xl p-3 min-w-[140px]">
                                                        <div className="flex flex-col gap-1.5">
                                                            <div className={`${T.helperText} ${S.meta} uppercase border-b border-[var(--border-default)] pb-1.5 mb-0.5 text-[var(--text-muted)]`}>Segmentos Ocultos</div>
                                                            {(c.tags || []).slice(3).map((hidTag: string) => (
                                                                <div key={hidTag} className="flex items-center gap-1.5">
                                                                    <div className="w-1 h-1 rounded-full bg-[var(--brand-primary)]"></div>
                                                                    <span className={`${T.helperText} ${S.meta} uppercase truncate max-w-[160px]`}>{hidTag}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        {/* Flechita del Tooltip */}
                                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#2a2a1a]"></div>
                                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#121208] -mt-[1px]"></div>
                                                    </div>
                                                </div>
                                            )}
                                            {(c.tags || []).length === 0 && <span className={`${T.helperText} ${S.meta} italic uppercase text-[var(--text-muted)]`}>Sin Tags</span>}
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="flex justify-end items-center gap-4">
                                            <button
                                                onClick={() => handleWhatsAppClick(c)}
                                                disabled={resolvingId === c.id}
                                                className={`group/wp flex items-center gap-2 uppercase px-4 py-2 rounded-xl transition-all [font-family:var(--tx-buttonText-font)] font-black tracking-widest text-[10px] ${resolvingId === c.id ? 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]' : 'bg-green-500/10 text-green-600 hover:bg-green-500 hover:'}`}
                                            >
                                                <svg className={`w-4 h-4 ${resolvingId === c.id ? 'animate-spin' : 'group-hover/wp:scale-125 transition-transform'}`} fill="currentColor" viewBox="0 0 24 24">
                                                    {resolvingId === c.id ? (
                                                        <path d="M12 4V2m0 20v-2m8-8h2M2 12h2m15.364-7.364l-1.414 1.414M6.05 17.95l-1.414 1.414M17.95 17.95l1.414 1.414M6.05 6.05L4.636 4.636M12 12a4 4 0 110-8 4 4 0 010 8z" />
                                                    ) : (
                                                        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.438 9.889-9.889.002-5.462-4.415-9.89-9.875-9.89-5.451 0-9.89 4.437-9.892 9.886 0 2.235.614 4.09 1.761 5.764l-.999 3.649 3.725-.912zm10.53-7.234c-.287-.144-1.693-.836-1.956-.932-.262-.095-.453-.144-.644.144-.191.287-.74.932-.907 1.123-.167.191-.334.215-.62.072-.287-.144-1.21-.447-2.305-1.424-.852-.76-1.428-1.698-1.594-1.986-.167-.287-.018-.442.126-.583.13-.127.287-.334.43-.502.144-.167.191-.287.287-.478.095-.191.048-.359-.024-.502-.072-.144-.644-1.553-.883-2.126-.233-.558-.469-.482-.644-.491-.167-.008-.358-.01-.55-.01s-.501.072-.764.359c-.263.287-1.003.98-1.003 2.39s1.027 2.77 1.17 2.962c.144.191 2.02 3.085 4.895 4.327.684.296 1.218.473 1.634.605.687.218 1.313.187 1.807.113.551-.082 1.693-.693 1.932-1.362.24-.669.24-1.242.167-1.362-.072-.12-.263-.191-.55-.335z" />
                                                    )}
                                                </svg>
                                                {resolvingId === c.id ? 'Accediendo...' : 'Chat'}
                                            </button>
                                            <button
                                                onClick={() => setShowDetailId(c.id)}
                                                className={`p-2.5 rounded-xl bg-[var(--bg-input)] ${T.helperText} hover:text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/10 transition-all border border-transparent hover:border-[var(--brand-primary)]/20`}
                                                title="Detalle del Contacto"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {/* PAGINATION */}
                    <div className="bg-[var(--bg-surface)] px-8 py-5 flex items-center justify-between border-t border-[var(--border-default)]">
                        <div className="flex items-center gap-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-[var(--brand-primary)] shadow-[0_0_8px_var(--brand-primary)]"></div>
                            <span className={`${T.helperText} ${S.meta} uppercase italic opacity-60 text-[var(--text-muted)]`}>Población detectada: <span className={`${T.helperText} not-italic`}>{total} Registros</span></span>
                        </div>
                        <div className="flex gap-4">
                            <button
                                disabled={params.page === 1}
                                onClick={() => setParams({ ...params, page: params.page - 1 })}
                                className={`${T.buttonText} ${S.meta} bg-[var(--bg-input)] px-6 py-2.5 rounded-xl uppercase border border-[var(--border-default)] hover:border-[var(--brand-primary)]/50 transition-all disabled:opacity-20 disabled:grayscale`}
                            >
                                ← Anterior
                            </button>
                            <button
                                disabled={params.page * params.pageSize >= total}
                                onClick={() => setParams({ ...params, page: params.page + 1 })}
                                className={`${T.buttonText} ${S.meta} bg-[var(--bg-input)] px-6 py-2.5 rounded-xl uppercase border border-[var(--border-default)] hover:border-[var(--brand-primary)]/50 transition-all disabled:opacity-20 disabled:grayscale`}
                            >
                                Siguiente →
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ContactsPage;
