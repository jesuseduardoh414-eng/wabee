import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { contactsApi } from '@/api/wabee/contacts.api';
import { T, S } from '@/lib/text-tokens';
import {
    Plus,
    Trash2,
    Users,
    Search,
    X,
    PlusCircle,
    UserPlus,
    UserMinus,
    Layers,
    ArrowRight,
    Zap,
    Info
} from 'lucide-react';
import { useToast } from '@/context/ToastContext';
import { useDialog } from '@/context/DialogContext';

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
            toastSuccess('Grupo creado exitosamente');
            loadGroups();
        } catch (error: any) {
            toastError(error.message || 'Error al crear grupo');
        }
    };

    const handleDeleteGroup = async (id: string) => {
        const isConfirmed = await confirm({
            title: 'Eliminar Grupo',
            description: '¿Estás seguro de eliminar este clúster? Se perderá la agrupación manual.',
            isDestructive: true,
            confirmText: 'Eliminar'
        });
        if (!isConfirmed) return;

        try {
            await contactsApi.deleteGroup(id);
            toastSuccess('Grupo eliminado');
            loadGroups();
        } catch (error: any) {
            toastError(error.message || 'Error al eliminar grupo');
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
            const nonMembers = result.items.filter((c: any) =>
                !groupMembers.some(m => m.id === c.id)
            );
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
            toastSuccess('Contacto añadido al grupo');
        } catch (error: any) {
            toastError(error.message || 'Error al añadir contacto');
        } finally {
            setAddingMemberId(null);
        }
    };

    const removeContactFromGroup = async (contactId: string) => {
        try {
            await contactsApi.removeContactsFromGroup(selectedGroup.id, [contactId]);
            toastSuccess('Contacto removido');
            refreshMembers(selectedGroup.id);
        } catch (error: any) {
            toastError(error.message || 'Error al quitar contacto');
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8 bg-[var(--bg-page)] min-h-screen">

            {/* Header Section */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-[var(--border-default)] pb-8">
                <div className="space-y-3">
                    <div className="flex items-center gap-2 bg-[var(--brand-primary)]/5 w-fit px-3 py-1 rounded-full border border-[var(--brand-primary)]/10">
                        <Zap size={12} className="text-[var(--brand-primary)]" />
                        <span className={`${T.badgeText} text-[9px] text-[var(--brand-primary)]`}>Manual Cluster</span>
                    </div>
                    <h1 className={`${T.pageTitle} ${S.displayMd}`}>
                        Agrupación <span className="text-[var(--brand-primary)]">Manual</span>
                    </h1>
                    <p className={`${T.pageSubtitle} ${S.body} max-w-lg opacity-80`}>
                        Organiza tus leads y clientes en listas estáticas para un control total.
                    </p>
                </div>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className={`group relative bg-[var(--brand-primary)] px-8 py-3.5 rounded-xl shadow-xl hover:brightness-110 transition-all active:scale-95 flex items-center gap-2 overflow-hidden ${T.buttonPrimaryText}`}
                >
                    <PlusCircle size={16} strokeWidth={3} />
                    <span>Nuevo Grupo</span>
                </button>
            </header>

            {/* Grid Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading && (
                    <div className="col-span-full py-20 flex flex-col items-center gap-6">
                        <div className="w-12 h-12 border-t-2 border-[var(--brand-primary)] rounded-full animate-spin"></div>
                        <p className={`${T.helperText} ${S.meta} animate-pulse`}>Cargando...</p>
                    </div>
                )}

                {!loading && groups.length === 0 && (
                    <div className="col-span-full py-32 text-center bg-[var(--bg-elevated)] rounded-[40px] border border-[var(--border-default)] shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[var(--brand-primary)]/5 blur-[100px] pointer-events-none group-hover:bg-[var(--brand-primary)]/10 transition-all duration-700"></div>
                        <div className="relative z-10">
                            <Users size={40} className="text-[var(--text-muted)]/20 mx-auto mb-6" />
                            <h3 className={`${T.emptyStateTitle} ${S.displayMd} mb-2 text-center`}>Sin Grupos</h3>
                            <button
                                onClick={() => setIsCreateModalOpen(true)}
                                className={`bg-[var(--bg-card)] text-[var(--brand-primary)] px-8 py-3 rounded-xl border border-[var(--brand-primary)]/20 hover:bg-[var(--brand-primary)] hover: transition-all mt-4 ${T.buttonPrimaryText}`}
                            >
                                Iniciar Primer Grupo
                            </button>
                        </div>
                    </div>
                )}

                {groups.map(g => (
                    <div key={g.id} className="group relative bg-[var(--bg-card)]/40 backdrop-blur-sm border border-[var(--border-default)] rounded-[32px] p-7 flex flex-col shadow-2xl hover:border-[var(--brand-primary)]/30 transition-all hover:-translate-y-1 duration-300">
                        <div className="flex justify-between items-start mb-6 relative z-10">
                            <div className="h-12 w-12 rounded-2xl bg-[var(--bg-muted)] border border-[var(--border-default)] flex items-center justify-center shadow-inner group-hover:scale-105 transition-all">
                                <Layers size={22} className="text-[var(--brand-primary)]" />
                            </div>
                            <button
                                onClick={() => handleDeleteGroup(g.id)}
                                className="p-2.5 bg-[var(--bg-page)]/50 border border-transparent hover:border-[var(--state-danger)]/20 text-[var(--text-muted)] hover:text-[var(--state-danger)] rounded-xl transition-all"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>

                        <div className="space-y-2 relative z-10 flex-1">
                            <h3 className={`${T.cardTitle} ${S.headingLg} group-hover:text-[var(--brand-primary)] transition-colors`}>{g.name}</h3>
                            <p className={`${T.cardSubtitle} ${S.body} opacity-60 line-clamp-2 h-8`}>{g.description || 'Sin descripción.'}</p>
                        </div>

                        <div className="mt-8 flex flex-col gap-5 relative z-10">
                            <div className="flex items-center gap-2">
                                <span className={`${T.badgeText} text-[px] text-[var(--brand-primary)] bg-[var(--brand-primary)]/5 px-2.5 py-1 rounded-md border border-[var(--brand-primary)]/10 flex items-center gap-1.5`}>
                                    <Users size={10} /> {g._count?.contactGroups || 0} Miembros
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => openMembersModal(g)}
                                    className={`bg-[var(--bg-muted)] hover:bg-[var(--bg-elevated)] py-3 rounded-xl border border-[var(--border-default)] transition-all flex items-center justify-center gap-2 ${T.buttonText}`}
                                >
                                    <UserPlus size={12} /> Gestionar
                                </button>
                                <button
                                    onClick={() => navigate(`/dashboard/wabee/contacts?groupId=${g.id}`)}
                                    className={`bg-[var(--brand-primary)]/5 text-[var(--brand-primary)] py-3 rounded-xl border border-[var(--brand-primary)]/20 hover:bg-[var(--brand-primary)] hover: transition-all flex items-center justify-center gap-2 ${T.buttonPrimaryText}`}
                                >
                                    Ver Todos <ArrowRight size={12} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* CREATE MODAL */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-[32px] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-8 pb-4 flex justify-between items-start">
                            <div>
                                <h2 className={`${T.sectionTitle} ${S.headingLg} mb-1`}>Nuevo <span className="text-[var(--brand-primary)]">Grupo</span></h2>
                                <p className={`${T.sectionSubtitle} ${S.meta} opacity-60`}>Creación de Clúster</p>
                            </div>
                            <button
                                onClick={() => setIsCreateModalOpen(false)}
                                className="p-3 bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl text-[var(--text-muted)] hover:text-[var(--text-strong)] transition-all shadow-xl"
                            >
                                <X size={16} strokeWidth={3} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateGroup} className="p-8 pt-4 space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-2 group">
                                    <label className={`${T.labelText} ${S.meta} ml-2 opacity-50`}>Nombre del Grupo</label>
                                    <input
                                        required
                                        value={newGroupData.name}
                                        onChange={e => setNewGroupData({ ...newGroupData, name: e.target.value })}
                                        placeholder="Ej: Clientes VIP"
                                        className={`w-full bg-[var(--bg-input)] border border-[var(--border-input)] rounded-2xl px-5 py-4 outline-none focus:border-[var(--brand-primary)] transition-all font-bold placeholder:text-[var(--text-muted)] ${T.inputText}`}
                                    />
                                </div>
                                <div className="space-y-2 group">
                                    <label className={`${T.labelText} ${S.meta} ml-2 opacity-50`}>Descripción (Opcional)</label>
                                    <textarea
                                        value={newGroupData.description}
                                        onChange={e => setNewGroupData({ ...newGroupData, description: e.target.value })}
                                        className={`w-full bg-[var(--bg-input)] border border-[var(--border-input)] rounded-2xl px-5 py-4 outline-none focus:border-[var(--brand-primary)] transition-all font-bold placeholder:text-[var(--text-muted)] h-24 resize-none leading-relaxed ${T.inputText}`}
                                        placeholder="Propósito del grupo..."
                                    />
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className={`flex-1 bg-[var(--bg-card)] py-4 rounded-2xl border border-[var(--border-default)] hover:bg-[var(--bg-elevated)] transition-all ${T.buttonText}`}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className={`flex-1 bg-[var(--brand-primary)] py-4 rounded-2xl shadow-lg hover:brightness-110 active:scale-95 transition-all ${T.buttonPrimaryText}`}
                                >
                                    Crear Grupo
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MEMBERS MODAL */}
            {isMembersModalOpen && !!selectedGroup && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-[32px] w-full max-w-4xl overflow-hidden shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)] flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="p-8 pb-6 flex justify-between items-center border-b border-[var(--border-default)]">
                            <div className="flex items-center gap-4">
                                <div className="h-14 w-14 rounded-2xl bg-[var(--brand-primary)] flex items-center justify-center shadow-xl border-4 border-[var(--bg-elevated)]">
                                    <Users size={24} className="text-[var(--brand-primary-foreground)]" />
                                </div>
                                <div>
                                    <h2 className={`${T.sectionTitle} ${S.headingLg} leading-none`}>
                                        Gestión: <span className="text-[var(--brand-primary)]">{selectedGroup.name}</span>
                                    </h2>
                                    <p className={`${T.sectionSubtitle} ${S.meta} opacity-60 mt-1`}>Sincronización de Miembros</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsMembersModalOpen(false)}
                                className="p-3 bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl text-[var(--text-muted)] hover:text-[var(--text-strong)] transition-all"
                            >
                                <X size={20} strokeWidth={3} />
                            </button>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2">

                            {/* LEFT SIDE: SEARCH & DISCOVERY */}
                            <div className="p-8 border-r border-[var(--border-default)] flex flex-col space-y-6 bg-[var(--bg-page)]/30">
                                <div className="space-y-3">
                                    <h3 className={`${T.cardSubtitle} ${S.meta} text-[var(--brand-primary)] flex items-center gap-2`}>
                                        <Plus size={14} /> Añadir Contactos
                                    </h3>
                                    <div className="relative group">
                                        <Search className="absolute left-5 top-5 text-[var(--brand-primary)]/30 group-focus-within:text-[var(--brand-primary)]" size={16} />
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={e => handleSearchContacts(e.target.value)}
                                            placeholder="Buscar nombre o teléfono..."
                                            className={`w-full bg-[var(--bg-input)] border border-[var(--border-input)] rounded-2xl pl-12 pr-6 py-4 outline-none focus:border-[var(--brand-primary)]/50 transition-all placeholder:text-[var(--text-muted)] ${T.inputText}`}
                                        />
                                    </div>
                                </div>

                                {/* Discovery Results */}
                                <div className="flex-1 overflow-y-auto no-scrollbar space-y-2">
                                    {searchQuery.length >= 2 && availableContacts.length === 0 ? (
                                        <div className={`${T.emptyStateBody} ${S.meta} py-12 text-center opacity-30`}>
                                            Sin resultados
                                        </div>
                                    ) : (
                                        availableContacts.map(c => (
                                            <button
                                                key={c.id}
                                                onClick={() => addContactToGroup(c.id)}
                                                disabled={addingMemberId === c.id}
                                                className="w-full text-left bg-[var(--bg-card)]/50 border border-[var(--border-default)] p-4 rounded-2xl flex items-center justify-between hover:border-[var(--brand-primary)]/40 hover:bg-[var(--brand-primary)]/5 transition-all group/item"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="h-9 w-9 rounded-xl bg-[var(--bg-page)] flex items-center justify-center font-black text-[10px] text-[var(--brand-primary)]">
                                                        {(c.name || 'S')[0].toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className={`${T.cardSubtitle} uppercase text-xs truncate max-w-[150px]`}>{c.name || 'Desconocido'}</div>
                                                        <div className={`${T.helperText} text-[9px] font-mono opacity-80`}>{c.phone}</div>
                                                    </div>
                                                </div>
                                                <div className="p-2 bg-[var(--text-strong)]/5 rounded-lg group-hover/item:bg-[var(--brand-primary)] group-hover/item: transition-all">
                                                    {addingMemberId === c.id ? (
                                                        <div className="w-4 h-4 border-2 border-[var(--brand-primary-foreground)]/20 border-t-[var(--brand-primary-foreground)] rounded-full animate-spin"></div>
                                                    ) : (
                                                        <UserPlus size={14} />
                                                    )}
                                                </div>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* RIGHT SIDE: CURRENT MEMBERSHIP */}
                            <div className="p-8 flex flex-col space-y-6">
                                <div className="flex justify-between items-center bg-[var(--bg-card)] p-4 rounded-2xl border border-[var(--border-default)] shadow-inner">
                                    <h3 className={`${T.helperText} ${S.meta} opacity-50`}>Miembros Actuales</h3>
                                    <span className={`${S.kpiMd} font-black italic tracking-tighter`}><span className="text-[var(--brand-primary)]">{groupMembers.length}</span></span>
                                </div>

                                <div className="flex-1 overflow-y-auto no-scrollbar space-y-2">
                                    {groupMembers.length === 0 ? (
                                        <div className={`${T.emptyStateBody} ${S.meta} py-20 text-center opacity-30`}>
                                            Grupo vacío
                                        </div>
                                    ) : (
                                        groupMembers.map(m => (
                                            <div key={m.id} className="flex items-center justify-between p-3 bg-[var(--bg-card)]/40 border border-[var(--border-default)] rounded-2xl group/member hover:border-[var(--state-danger)]/20 transition-all">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded-lg bg-[var(--bg-page)] flex items-center justify-center text-[9px] font-black text-[var(--brand-primary)]">
                                                        {(m.name || 'C')[0].toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className={`${T.cardSubtitle} text-xs`}>{m.name || 'Sin Nombre'}</div>
                                                        <div className={`${T.helperText} text-[9px] font-mono opacity-80`}>{m.phone}</div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => removeContactFromGroup(m.id)}
                                                    className="w-8 h-8 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--state-danger)] hover:bg-[var(--state-danger)]/5 rounded-lg transition-all"
                                                >
                                                    <UserMinus size={14} />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Footer Action */}
                        <div className="p-8 bg-[var(--bg-page)] border-t border-[var(--border-default)]">
                            <button
                                onClick={() => { setIsMembersModalOpen(false); loadGroups(); }}
                                className={`w-full bg-[var(--brand-primary)] py-4 rounded-2xl shadow-xl hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-3 ${T.buttonPrimaryText}`}
                            >
                                Consolidar y Sincronizar
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
