import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { contactsApi } from '@/api/wabee/contacts.api';
import { T, S } from '@/lib/text-tokens';
import { Plus, Trash2, Users, Search, X, PlusCircle, UserPlus, UserMinus, Layers, ArrowRight, Zap } from 'lucide-react';
import { useToast } from '@/context/ToastContext';
import { useDialog } from '@/context/DialogContext';

const COPY = {
    badge: 'Manual Cluster',
    title: 'Agrupación',
    highlight: 'Manual',
    subtitle: 'Organiza tus leads y clientes en listas estáticas para un control total.',
    newGroup: 'Nuevo Grupo',
    loading: 'Cargando...',
    noGroups: 'Sin Grupos',
    startFirstGroup: 'Iniciar Primer Grupo',
    noDescription: 'Sin descripción.',
    members: 'Miembros',
    manage: 'Gestionar',
    viewAll: 'Ver Todos',
    createTitle: 'Nuevo',
    createHighlight: 'Grupo',
    createSubtitle: 'Creación de Clúster',
    groupName: 'Nombre del Grupo',
    groupNamePlaceholder: 'Ej: Clientes VIP',
    groupDescription: 'Descripción (Opcional)',
    groupDescriptionPlaceholder: 'Propósito del grupo...',
    cancel: 'Cancelar',
    createGroup: 'Crear Grupo',
    manageTitle: 'Gestión:',
    membersSync: 'Sincronización de Miembros',
    addContacts: 'Añadir Contactos',
    searchPlaceholder: 'Buscar nombre o teléfono...',
    noResults: 'Sin resultados',
    currentMembers: 'Miembros Actuales',
    emptyGroup: 'Grupo vacío',
    consolidate: 'Consolidar y Sincronizar',
    confirmDeleteTitle: 'Eliminar Grupo',
    confirmDeleteDescription: '¿Estás seguro de eliminar este clúster? Se perderá la agrupación manual.',
    deleteAction: 'Eliminar',
    groupCreated: 'Grupo creado exitosamente',
    createError: 'Error al crear grupo',
    groupDeleted: 'Grupo eliminado',
    deleteError: 'Error al eliminar grupo',
    contactAdded: 'Contacto añadido al grupo',
    addError: 'Error al añadir contacto',
    contactRemoved: 'Contacto removido',
    removeError: 'Error al quitar contacto',
    unknownContact: 'Desconocido',
    noName: 'Sin Nombre',
} as const;

function formatContactPhone(phone?: string | null) {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 13 && digits.startsWith('521')) return `+52 ${digits.slice(3)}`;
    if (digits.length === 12 && digits.startsWith('52')) return `+52 ${digits.slice(2)}`;
    if (digits.length === 10) return `+52 ${digits}`;
    return phone;
}

const GroupsPage: React.FC = () => {
    const navigate = useNavigate();
    const [groups, setGroups] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { error: toastError, success: toastSuccess } = useToast();
    const { confirm } = useDialog();
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState<any>(null);
    const [groupMembers, setGroupMembers] = useState<any[]>([]);
    const [availableContacts, setAvailableContacts] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [newGroupData, setNewGroupData] = useState({ name: '', description: '' });
    const [addingMemberId, setAddingMemberId] = useState<string | null>(null);

    const loadGroups = async () => {
        setLoading(true);
        try {
            const data = await contactsApi.listGroups();
            setGroups(data);
        } catch (error) {
            console.error('Error loading groups:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadGroups();
    }, []);

    const handleCreateGroup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newGroupData.name.trim()) return;

        try {
            await contactsApi.createGroup(newGroupData);
            setIsCreateModalOpen(false);
            setNewGroupData({ name: '', description: '' });
            toastSuccess(COPY.groupCreated);
            loadGroups();
        } catch (error: any) {
            toastError(error.message || COPY.createError);
        }
    };

    const handleDeleteGroup = async (id: string) => {
        const isConfirmed = await confirm({
            title: COPY.confirmDeleteTitle,
            description: COPY.confirmDeleteDescription,
            isDestructive: true,
            confirmText: COPY.deleteAction
        });
        if (!isConfirmed) return;

        try {
            await contactsApi.deleteGroup(id);
            toastSuccess(COPY.groupDeleted);
            loadGroups();
        } catch (error: any) {
            toastError(error.message || COPY.deleteError);
        }
    };

    const openMembersModal = async (group: any) => {
        setSelectedGroup(group);
        setIsMembersModalOpen(true);
        setGroupMembers([]);
        refreshMembers(group.id);
    };

    const refreshMembers = async (groupId: string) => {
        try {
            const members = await contactsApi.getGroupContacts(groupId);
            setGroupMembers(members);
        } catch (error) {
            console.error('Error loading members:', error);
        }
    };

    const handleSearchContacts = async (query: string) => {
        setSearchQuery(query);
        if (query.length < 2) {
            setAvailableContacts([]);
            return;
        }
        try {
            const result = await contactsApi.list({ search: query, pageSize: 5 });
            const nonMembers = result.items.filter((c: any) => !groupMembers.some(m => m.id === c.id));
            setAvailableContacts(nonMembers);
        } catch (error) {
            console.error('Search error:', error);
        }
    };

    const addContactToGroup = async (contactId: string) => {
        setAddingMemberId(contactId);
        try {
            await contactsApi.addContactsToGroup(selectedGroup.id, [contactId]);
            await refreshMembers(selectedGroup.id);
            setSearchQuery('');
            setAvailableContacts([]);
            toastSuccess(COPY.contactAdded);
        } catch (error: any) {
            toastError(error.message || COPY.addError);
        } finally {
            setAddingMemberId(null);
        }
    };

    const removeContactFromGroup = async (contactId: string) => {
        try {
            await contactsApi.removeContactsFromGroup(selectedGroup.id, [contactId]);
            toastSuccess(COPY.contactRemoved);
            refreshMembers(selectedGroup.id);
        } catch (error: any) {
            toastError(error.message || COPY.removeError);
        }
    };

    return (
        <div className="mx-auto min-h-screen max-w-7xl space-y-8 bg-[var(--bg-page)] px-4 py-6 sm:px-6 sm:py-8">
            <header className="flex flex-col gap-6 border-b border-[var(--border-default)] pb-6 sm:pb-8 md:flex-row md:items-end md:justify-between">
                <div className="space-y-3">
                    <div className="flex w-fit items-center gap-2 rounded-full border border-[var(--brand-primary)]/10 bg-[var(--brand-primary)]/5 px-3 py-1">
                        <Zap size={12} className="text-[var(--brand-primary)]" />
                        <span className={`${T.badgeText} text-[9px] text-[var(--brand-primary)]`}>{COPY.badge}</span>
                    </div>
                    <h1 className={`${T.pageTitle} ${S.displayMd}`}>
                        {COPY.title} <span className="text-[var(--brand-primary)]">{COPY.highlight}</span>
                    </h1>
                    <p className={`${T.pageSubtitle} ${S.body} max-w-lg opacity-80`}>{COPY.subtitle}</p>
                </div>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className={`group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-[var(--brand-primary)] px-6 py-3.5 shadow-xl transition-all hover:brightness-110 active:scale-95 sm:w-auto sm:px-8 ${T.buttonPrimaryText}`}
                >
                    <PlusCircle size={16} strokeWidth={3} />
                    <span>{COPY.newGroup}</span>
                </button>
            </header>

            <div className="grid grid-cols-1 gap-5 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
                {loading && (
                    <div className="col-span-full flex flex-col items-center gap-6 py-20">
                        <div className="h-12 w-12 animate-spin rounded-full border-t-2 border-[var(--brand-primary)]"></div>
                        <p className={`${T.helperText} ${S.meta} animate-pulse`}>{COPY.loading}</p>
                    </div>
                )}

                {!loading && groups.length === 0 && (
                    <div className="group relative col-span-full overflow-hidden rounded-[32px] border border-[var(--border-default)] bg-[var(--bg-elevated)] py-24 text-center shadow-2xl sm:rounded-[40px] sm:py-32">
                        <div className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 bg-[var(--brand-primary)]/5 blur-[100px] transition-all duration-700 group-hover:bg-[var(--brand-primary)]/10"></div>
                        <div className="relative z-10 px-6">
                            <Users size={40} className="mx-auto mb-6 text-[var(--text-muted)]/20" />
                            <h3 className={`${T.emptyStateTitle} ${S.displayMd} mb-2 text-center`}>{COPY.noGroups}</h3>
                            <button
                                onClick={() => setIsCreateModalOpen(true)}
                                className={`mt-4 rounded-xl border border-[var(--brand-primary)]/20 bg-[var(--bg-card)] px-8 py-3 text-[var(--brand-primary)] transition-all hover:bg-[var(--brand-primary)] ${T.buttonPrimaryText}`}
                            >
                                {COPY.startFirstGroup}
                            </button>
                        </div>
                    </div>
                )}

                {groups.map(g => (
                    <article key={g.id} className="group relative flex flex-col rounded-[28px] border border-[var(--border-default)] bg-[var(--bg-card)]/40 p-5 shadow-2xl backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-[var(--brand-primary)]/30 sm:rounded-[32px] sm:p-7">
                        <div className="relative z-10 mb-6 flex items-start justify-between">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--border-default)] bg-[var(--bg-muted)] shadow-inner transition-all group-hover:scale-105">
                                <Layers size={22} className="text-[var(--brand-primary)]" />
                            </div>
                            <button
                                onClick={() => handleDeleteGroup(g.id)}
                                className="rounded-xl border border-transparent bg-[var(--bg-page)]/50 p-2.5 text-[var(--text-muted)] transition-all hover:border-[var(--state-danger)]/20 hover:text-[var(--state-danger)]"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>

                        <div className="relative z-10 flex-1 space-y-2">
                            <h3 className={`${T.cardTitle} ${S.headingLg} break-words transition-colors group-hover:text-[var(--brand-primary)]`}>{g.name}</h3>
                            <p className={`${T.cardSubtitle} ${S.body} min-h-[2.5rem] opacity-60`}>{g.description || COPY.noDescription}</p>
                        </div>

                        <div className="relative z-10 mt-6 flex flex-col gap-4 sm:mt-8 sm:gap-5">
                            <div className="flex items-center gap-2">
                                <span className={`${T.badgeText} flex items-center gap-1.5 rounded-md border border-[var(--brand-primary)]/10 bg-[var(--brand-primary)]/5 px-2.5 py-1 text-[var(--brand-primary)]`}>
                                    <Users size={10} /> {g._count?.contactGroups || 0} {COPY.members}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => openMembersModal(g)}
                                    className={`flex items-center justify-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-muted)] py-3 transition-all hover:bg-[var(--bg-elevated)] ${T.buttonText}`}
                                >
                                    <UserPlus size={12} /> {COPY.manage}
                                </button>
                                <button
                                    onClick={() => navigate(`/dashboard/wabee/contacts?groupId=${g.id}`)}
                                    className={`flex items-center justify-center gap-2 rounded-xl border border-[var(--brand-primary)]/20 bg-[var(--brand-primary)]/5 py-3 text-[var(--brand-primary)] transition-all hover:bg-[var(--brand-primary)] ${T.buttonPrimaryText}`}
                                >
                                    {COPY.viewAll} <ArrowRight size={12} />
                                </button>
                            </div>
                        </div>
                    </article>
                ))}
            </div>

            {isCreateModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/80 p-4 pt-6 backdrop-blur-sm animate-in fade-in duration-300 sm:items-center">
                    <div className="w-full max-w-md overflow-hidden rounded-[28px] border border-[var(--border-default)] bg-[var(--bg-elevated)] shadow-2xl animate-in zoom-in-95 duration-200 sm:rounded-[32px]">
                        <div className="flex items-start justify-between gap-4 p-5 pb-4 sm:p-8">
                            <div>
                                <h2 className={`${T.sectionTitle} ${S.headingLg} mb-1`}>{COPY.createTitle} <span className="text-[var(--brand-primary)]">{COPY.createHighlight}</span></h2>
                                <p className={`${T.sectionSubtitle} ${S.meta} opacity-60`}>{COPY.createSubtitle}</p>
                            </div>
                            <button
                                onClick={() => setIsCreateModalOpen(false)}
                                className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-3 text-[var(--text-muted)] shadow-xl transition-all hover:text-[var(--text-strong)]"
                            >
                                <X size={16} strokeWidth={3} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateGroup} className="space-y-5 p-5 pt-0 sm:space-y-6 sm:p-8 sm:pt-0">
                            <div className="space-y-4">
                                <div className="group space-y-2">
                                    <label className={`${T.labelText} ${S.meta} ml-2 opacity-50`}>{COPY.groupName}</label>
                                    <input
                                        required
                                        value={newGroupData.name}
                                        onChange={e => setNewGroupData({ ...newGroupData, name: e.target.value })}
                                        placeholder={COPY.groupNamePlaceholder}
                                        className={`w-full rounded-2xl border border-[var(--border-input)] bg-[var(--bg-input)] px-5 py-4 font-bold outline-none transition-all placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)] ${T.inputText}`}
                                    />
                                </div>
                                <div className="group space-y-2">
                                    <label className={`${T.labelText} ${S.meta} ml-2 opacity-50`}>{COPY.groupDescription}</label>
                                    <textarea
                                        value={newGroupData.description}
                                        onChange={e => setNewGroupData({ ...newGroupData, description: e.target.value })}
                                        className={`h-24 w-full resize-none rounded-2xl border border-[var(--border-input)] bg-[var(--bg-input)] px-5 py-4 font-bold leading-relaxed outline-none transition-all placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)] ${T.inputText}`}
                                        placeholder={COPY.groupDescriptionPlaceholder}
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className={`flex-1 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] py-4 transition-all hover:bg-[var(--bg-elevated)] ${T.buttonText}`}
                                >
                                    {COPY.cancel}
                                </button>
                                <button
                                    type="submit"
                                    className={`flex-1 rounded-2xl bg-[var(--brand-primary)] py-4 shadow-lg transition-all hover:brightness-110 active:scale-95 ${T.buttonPrimaryText}`}
                                >
                                    {COPY.createGroup}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isMembersModalOpen && !!selectedGroup && (
                <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/90 p-4 pt-6 backdrop-blur-sm animate-in fade-in duration-300 sm:items-center">
                    <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] border border-[var(--border-default)] bg-[var(--bg-elevated)] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-200 sm:max-h-[85vh] sm:rounded-[32px]">
                        <div className="flex items-start justify-between gap-4 border-b border-[var(--border-default)] p-5 pb-4 sm:p-8 sm:pb-6">
                            <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-4 border-[var(--bg-elevated)] bg-[var(--brand-primary)] shadow-xl sm:h-14 sm:w-14">
                                    <Users size={22} className="text-[var(--brand-primary-foreground)] sm:size-6" />
                                </div>
                                <div className="min-w-0">
                                    <h2 className={`${T.sectionTitle} ${S.headingLg} leading-none break-words`}>
                                        {COPY.manageTitle} <span className="text-[var(--brand-primary)]">{selectedGroup.name}</span>
                                    </h2>
                                    <p className={`${T.sectionSubtitle} ${S.meta} mt-1 opacity-60`}>{COPY.membersSync}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsMembersModalOpen(false)}
                                className="shrink-0 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-3 text-[var(--text-muted)] transition-all hover:text-[var(--text-strong)]"
                            >
                                <X size={20} strokeWidth={3} />
                            </button>
                        </div>

                        <div className="grid flex-1 grid-cols-1 overflow-y-auto md:grid-cols-2">
                            <div className="flex flex-col gap-5 border-b border-[var(--border-default)] bg-[var(--bg-page)]/30 p-5 md:border-b-0 md:border-r md:p-8">
                                <div className="space-y-3">
                                    <h3 className={`${T.cardSubtitle} ${S.meta} flex items-center gap-2 text-[var(--brand-primary)]`}>
                                        <Plus size={14} /> {COPY.addContacts}
                                    </h3>
                                    <div className="group relative">
                                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--brand-primary)]/30 group-focus-within:text-[var(--brand-primary)]" size={16} />
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={e => handleSearchContacts(e.target.value)}
                                            placeholder={COPY.searchPlaceholder}
                                            className={`w-full rounded-2xl border border-[var(--border-input)] bg-[var(--bg-input)] py-4 pl-12 pr-6 outline-none transition-all placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)]/50 ${T.inputText}`}
                                        />
                                    </div>
                                </div>

                                <div className="min-h-[8rem] flex-1 space-y-2 overflow-y-auto no-scrollbar">
                                    {searchQuery.length >= 2 && availableContacts.length === 0 ? (
                                        <div className={`${T.emptyStateBody} ${S.meta} py-12 text-center opacity-30`}>
                                            {COPY.noResults}
                                        </div>
                                    ) : (
                                        availableContacts.map(c => (
                                            <button
                                                key={c.id}
                                                onClick={() => addContactToGroup(c.id)}
                                                disabled={addingMemberId === c.id}
                                                className="group/item flex w-full items-center justify-between rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)]/50 p-4 text-left transition-all hover:border-[var(--brand-primary)]/40 hover:bg-[var(--brand-primary)]/5"
                                            >
                                                <div className="flex min-w-0 items-center gap-3">
                                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-page)] text-[10px] font-bold text-[var(--brand-primary)]">
                                                        {(c.name || 'S')[0].toUpperCase()}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className={`${T.cardSubtitle} truncate text-xs uppercase`}>{c.name || COPY.unknownContact}</div>
                                                        <div className={`${T.helperText} truncate text-[9px] font-mono opacity-80`}>{formatContactPhone(c.phone)}</div>
                                                    </div>
                                                </div>
                                                <div className="rounded-lg bg-[var(--text-strong)]/5 p-2 transition-all group-hover/item:bg-[var(--brand-primary)]">
                                                    {addingMemberId === c.id ? (
                                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--brand-primary-foreground)]/20 border-t-[var(--brand-primary-foreground)]"></div>
                                                    ) : (
                                                        <UserPlus size={14} />
                                                    )}
                                                </div>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-col gap-5 p-5 md:p-8">
                                <div className="flex items-center justify-between rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 shadow-inner">
                                    <h3 className={`${T.helperText} ${S.meta} opacity-50`}>{COPY.currentMembers}</h3>
                                    <span className={`${S.kpiMd} font-bold italic tracking-tighter`}><span className="text-[var(--brand-primary)]">{groupMembers.length}</span></span>
                                </div>

                                <div className="min-h-[8rem] flex-1 space-y-2 overflow-y-auto no-scrollbar">
                                    {groupMembers.length === 0 ? (
                                        <div className={`${T.emptyStateBody} ${S.meta} py-16 text-center opacity-30 sm:py-20`}>
                                            {COPY.emptyGroup}
                                        </div>
                                    ) : (
                                        groupMembers.map(m => (
                                            <div key={m.id} className="group/member flex items-center justify-between rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)]/40 p-3 transition-all hover:border-[var(--state-danger)]/20">
                                                <div className="flex min-w-0 items-center gap-3">
                                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-page)] text-[9px] font-bold text-[var(--brand-primary)]">
                                                        {(m.name || 'C')[0].toUpperCase()}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className={`${T.cardSubtitle} truncate text-xs`}>{m.name || COPY.noName}</div>
                                                        <div className={`${T.helperText} truncate text-[9px] font-mono opacity-80`}>{formatContactPhone(m.phone)}</div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => removeContactFromGroup(m.id)}
                                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition-all hover:bg-[var(--state-danger)]/5 hover:text-[var(--state-danger)]"
                                                >
                                                    <UserMinus size={14} />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-[var(--border-default)] bg-[var(--bg-page)] p-5 sm:p-8">
                            <button
                                onClick={() => { setIsMembersModalOpen(false); loadGroups(); }}
                                className={`flex w-full items-center justify-center gap-3 rounded-2xl bg-[var(--brand-primary)] py-4 shadow-xl transition-all hover:brightness-110 active:scale-95 ${T.buttonPrimaryText}`}
                            >
                                {COPY.consolidate}
                                <Zap size={14} fill="currentColor" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GroupsPage;
