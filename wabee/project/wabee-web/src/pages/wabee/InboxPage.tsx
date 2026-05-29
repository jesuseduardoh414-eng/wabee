import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { T, S } from '@/lib/text-tokens';
import {
    ArrowLeft,
    Bot,
    MessageSquare,
    Inbox,
} from 'lucide-react';
import {
    getThreadMessages,
    sendMessageToThread,
    getThreadById,
    getThreadNotes,
    createThreadNote,
    updateThreadNote,
    deleteThreadNote,
    assignThread,
    Message,
    Thread,
    ThreadNote,
    getChannelThreads,
    Assignee,
    getAssignableUsers,
    takeThread,
    unassignThread,
} from '@/api/wabee/inbox.api';
import { getChannels, Channel } from '@/api/wabee/whatsapp.api';
import ChatPanel from '@/components/wabee/ChatPanel';
import ThreadHandlingModeBadge from '@/components/wabee/ThreadHandlingModeBadge';
import { ContactDetailModal } from '@/pages/wabee/contacts/components/ContactDetailModal';
import { useToast } from '@/context/ToastContext';
import { useDialog } from '@/context/DialogContext';

type FilterTab = {
    id: InboxFilter;
    label: string;
    roles?: string[];
};

const FILTER_TABS: FilterTab[] = [
    { id: 'all', label: 'Todos' },
    { id: 'ai', label: 'IA activa' },
    { id: 'human_queue', label: 'Prioridad' },
    { id: 'taken', label: 'Asignados', roles: ['ADMIN', 'SUPERVISOR'] },
    { id: 'mine', label: 'Para mi' },
    { id: 'unassigned', label: 'Sin asignar', roles: ['ADMIN', 'SUPERVISOR'] },
    { id: 'closed', label: 'Cerrados' },
] as const;

type InboxFilter = 'all' | 'ai' | 'human_queue' | 'taken' | 'mine' | 'closed' | 'unassigned';

export default function InboxPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const isFullScreen = searchParams.get('view') !== 'standard';

    const [channels, setChannels] = useState<Channel[]>([]);
    const [threads, setThreads] = useState<Thread[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [notes, setNotes] = useState<ThreadNote[]>([]);
    const [assignees, setAssignees] = useState<Assignee[]>([]);

    const [loadingThreads, setLoadingThreads] = useState(false);
    const [isNotesOpen, setIsNotesOpen] = useState(false);
    const [newNote, setNewNote] = useState('');
    const [filter, setFilter] = useState<InboxFilter>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [contactDetailId, setContactDetailId] = useState<string | null>(null);
    const [assigneeFilter, setAssigneeFilter] = useState<string>('');

    const notesSidebarRef = useRef<HTMLDivElement>(null);

    const { error: toastError, success: toastSuccess } = useToast();
    const { confirm } = useDialog();

    const savedUser = localStorage.getItem('wabee_user');
    const currentUser = savedUser ? JSON.parse(savedUser) : { id: 'unknown', role: 'AGENT' };

    const selectedChannelId = searchParams.get('channelId');
    const selectedThreadId = searchParams.get('threadId');

    useEffect(() => {
        getChannels()
            .then((data) => {
                setChannels(data);
                if (data.length > 0 && !selectedChannelId) {
                    const connected = data.find((channel) => channel.status === 'CONNECTED') || data[0];
                    setSearchParams((prev) => {
                        prev.set('channelId', connected.id);
                        return prev;
                    });
                }
            })
            .catch((err) => console.error('Error loading channels', err));

        if (['ADMIN', 'SUPERVISOR'].includes(currentUser.role)) {
            getAssignableUsers()
                .then((data) => setAssignees(data))
                .catch((err) => console.error('Error loading assignees', err));
        }
    }, []);

    useEffect(() => {
        if (!selectedChannelId) return;

        const loadThreads = async () => {
            setLoadingThreads(true);
            try {
                const data = await getChannelThreads(selectedChannelId);
                if (selectedThreadId && !data.find((thread) => thread.id === selectedThreadId)) {
                    try {
                        const extraThread = await getThreadById(selectedThreadId);
                        setThreads([extraThread, ...data]);
                    } catch (error) {
                        console.error('Error loading specific threadId from URL', error);
                        setThreads(data);
                    }
                } else {
                    setThreads(data);
                }
            } catch (error) {
                console.error('Error loading threads', error);
            } finally {
                setLoadingThreads(false);
            }
        };

        loadThreads();

        const interval = setInterval(async () => {
            try {
                const refreshed = await getChannelThreads(selectedChannelId);
                setThreads((prev) => {
                    if (selectedThreadId && !refreshed.find((thread) => thread.id === selectedThreadId)) {
                        const currentExtra = prev.find((thread) => thread.id === selectedThreadId);
                        return currentExtra ? [currentExtra, ...refreshed] : refreshed;
                    }
                    return refreshed;
                });
            } catch (error) {
                console.error('Polling threads error', error);
            }
        }, 8000);

        return () => clearInterval(interval);
    }, [selectedChannelId, selectedThreadId]);

    useEffect(() => {
        if (!selectedThreadId || !selectedChannelId) return;

        const fetchMessages = async () => {
            try {
                const data = await getThreadMessages(selectedChannelId, selectedThreadId);
                setMessages(data.items);
            } catch (error) {
                console.error('Error loading messages', error);
            }
        };

        fetchMessages();
        const interval = setInterval(fetchMessages, 5000);
        return () => clearInterval(interval);
    }, [selectedThreadId, selectedChannelId]);

    useEffect(() => {
        if (!selectedThreadId || !isNotesOpen) return;

        const loadNotes = async () => {
            try {
                const data = await getThreadNotes(selectedThreadId);
                setNotes(data);
            } catch (error) {
                console.error('Error loading notes', error);
            }
        };

        loadNotes();
    }, [selectedThreadId, isNotesOpen]);

    const handleChannelSelect = (channelId: string) => {
        setSearchParams({ channelId });
        setMessages([]);
    };

    const handleThreadSelect = (threadId: string) => {
        if (!selectedChannelId) return;
        setSearchParams({ channelId: selectedChannelId, threadId });
    };

    const handleSendMessage = async (text: string) => {
        if (!selectedThreadId) return;
        try {
            await sendMessageToThread(selectedThreadId, text);
            if (selectedChannelId) {
                const data = await getThreadMessages(selectedChannelId, selectedThreadId);
                setMessages(data.items);
            }
        } catch (error) {
            console.error('Failed to send', error);
            toastError('Error al enviar mensaje');
        }
    };

    const handleTakeThread = async () => {
        if (!selectedThreadId) return;
        try {
            const updated = await takeThread(selectedThreadId);
            setThreads((prev) =>
                prev.map((thread) =>
                    thread.id === updated.id
                        ? { ...thread, assignedUserId: currentUser.id, handlingMode: 'human', aiPaused: true }
                        : thread
                )
            );
            toastSuccess('Chat tomado exitosamente.');
        } catch (error: any) {
            console.error('Take error', error);
            toastError(error.message || 'Error al tomar el chat. Es posible que otro agente ya lo haya tomado.');
        }
    };

    const handleResumeAi = async () => {
        if (!selectedThreadId) return;
        try {
            const { resumeAi } = await import('@/api/wabee/inbox.api');
            await resumeAi(selectedThreadId);
            setThreads((prev) =>
                prev.map((thread) =>
                    thread.id === selectedThreadId ? { ...thread, aiPaused: false, handlingMode: 'ai' } : thread
                )
            );
            toastSuccess('IA reanudada para este chat.');
        } catch (error: any) {
            toastError(error.message || 'Error al reanudar IA');
        }
    };

    const handleAssignThread = async (targetUserId: string) => {
        if (!selectedThreadId) return;
        try {
            const updated = await assignThread(selectedThreadId, targetUserId);
            setThreads((prev) =>
                prev.map((thread) =>
                    thread.id === updated.id ? { ...thread, assignedUserId: updated.assignedUserId } : thread
                )
            );
            toastSuccess('Chat asignado correctamente.');
        } catch (error) {
            console.error('Assign error', error);
            toastError('Error al asignar chat.');
        }
    };

    const handleUnassign = async () => {
        if (!selectedThreadId) return;
        try {
            const updated = await unassignThread(selectedThreadId);
            setThreads((prev) =>
                prev.map((thread) =>
                    thread.id === updated.id
                        ? { ...thread, assignedUserId: null, handlingMode: updated.handlingMode }
                        : thread
                )
            );
            toastSuccess('Chat liberado.');
        } catch (error) {
            console.error('Unassign error', error);
            toastError('Error al liberar el chat.');
        }
    };

    const handleAddNote = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!selectedThreadId || !newNote.trim()) return;
        try {
            const note = await createThreadNote(selectedThreadId, newNote);
            setNotes((prev) =>
                [note, ...prev].sort((a, b) => {
                    if (a.isPinned === b.isPinned) {
                        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                    }
                    return a.isPinned ? -1 : 1;
                })
            );
            setNewNote('');
        } catch (error) {
            console.error('Note creation error', error);
            toastError('Error al fijar nota');
        }
    };

    const handlePinNote = async (noteId: string, currentPinned: boolean) => {
        if (!selectedThreadId) return;
        try {
            const updated = await updateThreadNote(selectedThreadId, noteId, { isPinned: !currentPinned });
            setNotes((prev) =>
                prev
                    .map((note) => (note.id === updated.id ? updated : note))
                    .sort((a, b) => {
                        if (a.isPinned === b.isPinned) {
                            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                        }
                        return a.isPinned ? -1 : 1;
                    })
            );
        } catch (error) {
            console.error('Note pin error', error);
        }
    };

    const handleDeleteNote = async (noteId: string) => {
        if (!selectedThreadId) return;

        const isConfirmed = await confirm({
            title: 'Eliminar Nota',
            description: '¿Estás seguro de eliminar esta nota?',
            isDestructive: true,
            confirmText: 'Eliminar',
        });
        if (!isConfirmed) return;

        try {
            await deleteThreadNote(selectedThreadId, noteId);
            setNotes((prev) => prev.filter((note) => note.id !== noteId));
            toastSuccess('Nota eliminada');
        } catch (error) {
            console.error('Note delete error', error);
            toastError('Error al eliminar nota');
        }
    };

    const activeThread = threads.find((thread) => thread.id === selectedThreadId);

    const filteredThreads = threads.filter((thread) => {
        const matchesSearch =
            !searchQuery ||
            thread.contactName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            thread.remotePhone.includes(searchQuery);

        if (!matchesSearch) return false;
        if (assigneeFilter && thread.assignedUserId !== assigneeFilter) return false;

        if (filter === 'ai') return thread.handlingMode === 'ai' || thread.handlingMode === 'copilot';
        if (filter === 'human_queue') return thread.handlingMode === 'human_queue';
        if (filter === 'taken') return !!thread.assignedUserId || thread.handlingMode === 'human';
        if (filter === 'mine') return thread.assignedUserId === currentUser.id;
        if (filter === 'closed') return thread.status === 'CLOSED';
        if (filter === 'unassigned') return !thread.assignedUserId;

        return true;
    });

    const formatThreadTime = (timestamp?: string | null) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        if (Number.isNaN(date.getTime())) return '';

        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);

        if (date.toDateString() === now.toDateString()) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }

        if (date.toDateString() === yesterday.toDateString()) {
            return 'Ayer';
        }

        return date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
    };

    const getThreadInitials = (thread: Thread) => {
        const label = thread.contactName || thread.remotePhone || 'WB';
        const parts = label.trim().split(/\s+/).filter(Boolean);
        if (parts.length >= 2) {
            return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
        }
        return label.slice(0, 2).toUpperCase();
    };

    const connectedChannels = channels.filter((channel) => channel.status === 'CONNECTED').length;
    const unreadThreadsCount = threads.filter((thread) => thread.unreadCount > 0).length;
    const priorityThreadsCount = threads.filter((thread) => thread.handlingMode === 'human_queue').length;
    const mineThreadsCount = threads.filter((thread) => thread.assignedUserId === currentUser.id).length;

    return (
        <div
            className={`flex bg-[linear-gradient(180deg,#fbfaf6_0%,#f4efe4_100%)] text-[var(--text-strong)] overflow-hidden font-sans selection:bg-[var(--brand-primary)]/20 ${
                isFullScreen
                    ? 'h-screen w-screen border-none rounded-none'
                    : 'h-[calc(100vh-72px)] rounded-[28px] border border-[rgba(197,176,136,0.28)] shadow-[0_18px_46px_rgba(122,102,62,0.14)]'
            }`}
        >
            <aside className="w-[68px] bg-[rgba(255,251,243,0.88)] backdrop-blur-xl flex flex-col items-center py-4 gap-3 border-r border-[rgba(197,176,136,0.22)] shrink-0 z-20">
                <div className="w-10 h-10 rounded-2xl bg-[linear-gradient(135deg,#f9e6a5_0%,#efc96d_100%)] flex items-center justify-center shadow-[0_10px_22px_rgba(210,173,92,0.22)]">
                    <MessageSquare className="w-5 h-5 text-[#6f5310]" />
                </div>

                <div className="flex-1 w-full flex flex-col items-center gap-3 overflow-y-auto no-scrollbar px-2">
                    {channels.map((channel) => (
                        <button
                            key={channel.id}
                            onClick={() => handleChannelSelect(channel.id)}
                            className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all relative group flex-shrink-0 border ${
                                selectedChannelId === channel.id
                                    ? 'bg-[rgba(255,245,214,0.96)] ring-1 ring-[rgba(226,181,78,0.5)] border-[rgba(226,181,78,0.45)] shadow-[0_0_0_4px_rgba(245,214,132,0.18)]'
                                    : 'bg-[rgba(255,255,255,0.9)] hover:bg-[rgba(255,247,228,0.92)] border-[rgba(197,176,136,0.22)]'
                            }`}
                            title={channel.name || channel.displayPhone}
                        >
                            <span
                                className={`text-[11px] font-black transition-colors ${
                                    selectedChannelId === channel.id ? 'text-[var(--brand-primary)]' : 'text-[var(--text-muted)]'
                                }`}
                            >
                                {(channel.name?.[0] || 'C').toUpperCase()}
                            </span>
                            <div
                                className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 border-2 border-[color:color-mix(in_srgb,var(--bg-card),black_8%)] rounded-full ${
                                    channel.status === 'CONNECTED' ? 'bg-green-500' : 'bg-red-500'
                                }`}
                            />
                        </button>
                    ))}
                </div>
            </aside>

            <aside className="w-[360px] bg-[rgba(255,252,246,0.94)] border-r border-[rgba(197,176,136,0.2)] flex flex-col shrink-0 relative z-10">
                <div className="px-5 pt-5 pb-4 border-b border-[rgba(197,176,136,0.18)] shrink-0 bg-[rgba(255,250,242,0.96)]">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                            {isFullScreen && (
                                <button
                                    onClick={() => {
                                        setSearchParams((prev) => {
                                            prev.set('view', 'standard');
                                            return prev;
                                        });
                                    }}
                                    className="p-2 hover:bg-[var(--bg-input)] rounded-xl transition-colors text-[var(--brand-primary)]"
                                    title="Volver a vista normal"
                                >
                                    <ArrowLeft size={18} />
                                </button>
                            )}
                            <div className="min-w-0">
                                <h1 className={`${T.pageTitle} ${S.headingLg} tracking-tight`}>Mensajes</h1>
                                <p className={`${T.helperText} ${S.meta} mt-1`}>
                                    {filteredThreads.length} conversaciones visibles
                                </p>
                            </div>
                        </div>
                        <div className="px-3 py-1.5 rounded-full bg-[rgba(255,255,255,0.84)] border border-[rgba(197,176,136,0.24)]">
                            <span className={`${T.helperText} ${S.meta} uppercase tracking-[0.22em]`}>
                                {connectedChannels}/{channels.length} online
                            </span>
                        </div>
                    </div>
                </div>

                <div className="px-5 py-4 shrink-0">
                    <div className="bg-[rgba(255,255,255,0.88)] border border-[rgba(197,176,136,0.22)] rounded-2xl flex items-center px-4 py-3 group focus-within:border-[rgba(226,181,78,0.48)] transition-all shadow-[inset_0_1px_2px_rgba(255,255,255,0.6)]">
                        <svg
                            className="w-4 h-4 opacity-70 mr-3 group-focus-within:text-[var(--brand-primary)] transition-colors"
                            style={{ color: 'var(--tx-inputText-color)' }}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2.5}
                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                            />
                        </svg>
                        <input
                            type="text"
                            placeholder="Buscar conversaciones..."
                            className={`${T.inputText} ${S.body} bg-transparent border-none w-full focus:ring-0 placeholder:text-current`}
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                        />
                    </div>
                </div>

                <div className="px-5 pb-3 shrink-0">
                    <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-2xl border border-[rgba(197,176,136,0.2)] bg-[rgba(255,255,255,0.9)] px-3 py-3">
                            <p className={`${T.helperText} ${S.meta}`}>Sin leer</p>
                            <strong className={`${T.cardTitle} ${S.headingMd} mt-1 block`}>{unreadThreadsCount}</strong>
                        </div>
                        <div className="rounded-2xl border border-[rgba(231,190,94,0.26)] bg-[rgba(255,245,220,0.88)] px-3 py-3">
                            <p className={`${T.helperText} ${S.meta} text-[#a27719]`}>Prioridad</p>
                            <strong className={`${T.cardTitle} ${S.headingMd} mt-1 block text-[#5e4514]`}>{priorityThreadsCount}</strong>
                        </div>
                        <div className="rounded-2xl border border-[rgba(226,181,78,0.22)] bg-[rgba(255,249,234,0.9)] px-3 py-3">
                            <p className={`${T.helperText} ${S.meta} text-[var(--brand-primary)]`}>Para mi</p>
                            <strong className={`${T.cardTitle} ${S.headingMd} mt-1 block text-[var(--brand-primary)]`}>{mineThreadsCount}</strong>
                        </div>
                    </div>
                </div>

                <div className="px-5 py-1 flex flex-wrap gap-2 shrink-0 mb-2">
                    {FILTER_TABS.filter((tab) => !tab.roles || tab.roles.includes(currentUser.role)).map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setFilter(tab.id as InboxFilter)}
                            className={`${T.buttonPrimaryText} ${S.meta} px-3 py-2 rounded-2xl transition-all whitespace-nowrap border ${
                                filter === tab.id
                                    ? tab.id === 'human_queue'
                                        ? 'bg-[rgba(255,235,232,0.96)] border-[rgba(231,101,84,0.34)] text-[#ba4437] shadow-[0_6px_14px_rgba(220,120,110,0.14)]'
                                        : 'bg-[linear-gradient(135deg,#f3df9b_0%,#efcb74_100%)] border-[rgba(226,181,78,0.46)] text-[#6f5310] shadow-[0_8px_18px_rgba(214,177,88,0.2)]'
                                    : 'bg-[rgba(255,255,255,0.88)] border-[rgba(197,176,136,0.2)] hover:bg-[rgba(255,248,234,0.96)]'
                            }`}
                            style={
                                filter !== tab.id
                                    ? { color: 'var(--tx-buttonText-color)' }
                                    : tab.id === 'human_queue'
                                        ? { color: '#ba4437' }
                                        : { color: '#6f5310' }
                            }
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {['ADMIN', 'SUPERVISOR'].includes(currentUser.role) && assignees.length > 0 && (
                    <div className="px-5 pb-3 shrink-0">
                        <select
                            value={assigneeFilter}
                            onChange={(event) => setAssigneeFilter(event.target.value)}
                            className={`${T.inputText} ${S.meta} w-full bg-[rgba(255,255,255,0.88)] border rounded-2xl px-3 py-2 outline-none focus:border-[var(--brand-primary)]/50 transition-colors uppercase tracking-wide ${
                                assigneeFilter ? 'border-[var(--brand-primary)]/50 text-[var(--brand-primary)]' : 'border-[var(--border-default)]'
                            }`}
                            style={{ color: assigneeFilter ? 'var(--brand-primary)' : 'var(--tx-inputText-color)' }}
                        >
                            <option value="">Todos los agentes</option>
                            {assignees.map((assignee) => (
                                <option key={assignee.id} value={assignee.id}>
                                    {assignee.name}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto custom-scrollbar px-3 pb-4">
                    {loadingThreads && threads.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-t-[var(--brand-primary)] border-transparent" />
                            <span className={`${T.helperText} ${S.meta} uppercase`}>Escaneando hilos...</span>
                        </div>
                    ) : filteredThreads.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center px-10">
                            <div className="w-16 h-16 rounded-full bg-[var(--bg-input)] flex items-center justify-center mb-4 border border-[var(--border-default)]">
                                <Inbox className="w-8 h-8 opacity-50" style={{ color: 'var(--tx-emptyStateTitle-color)' }} />
                            </div>
                            <span className={`${T.emptyStateTitle} ${S.body} italic`}>
                                No hay hilos {filter === 'all' ? '' : filter === 'mine' ? 'asignados a ti' : 'para este filtro'}
                            </span>
                        </div>
                    ) : (
                        filteredThreads.map((thread) => {
                            const isSelected = selectedThreadId === thread.id;
                            const hasUnread = thread.unreadCount > 0;
                            const isAiThread = thread.handlingMode === 'ai' || thread.handlingMode === 'copilot';
                            const needsHuman = thread.handlingMode === 'human_queue';

                            return (
                                <div
                                    key={thread.id}
                                    onClick={() => handleThreadSelect(thread.id)}
                                    className={`flex items-center gap-3 px-4 py-4 cursor-pointer rounded-[22px] transition-all mb-2 border group ${
                                        isSelected
                                            ? 'bg-[rgba(255,247,228,0.98)] border-[rgba(226,181,78,0.38)] shadow-[inset_4px_0_0_0_rgba(226,181,78,0.9),0_10px_24px_rgba(213,184,116,0.12)]'
                                            : hasUnread
                                                ? 'bg-[rgba(255,251,241,0.96)] border-[rgba(226,181,78,0.16)] hover:bg-[rgba(255,247,233,0.98)]'
                                                : 'border-transparent hover:bg-[rgba(255,255,255,0.84)] hover:border-[rgba(197,176,136,0.18)]'
                                    }`}
                                >
                                    <div className="w-14 h-14 rounded-full bg-[linear-gradient(135deg,#f7dfa5_0%,#ebb960_100%)] flex-shrink-0 overflow-hidden relative shadow-[0_10px_20px_rgba(216,181,96,0.24)]">
                                        <div className="absolute inset-0 flex items-center justify-center text-[13px] font-black text-[#6f5310]">
                                            {getThreadInitials(thread)}
                                        </div>
                                        <div className="absolute inset-0 ring-1 ring-white/10 rounded-full" />
                                        {thread.assignedUserId ? (
                                            <div
                                                className="absolute top-0 right-0 w-5 h-5 bg-[rgba(255,247,226,0.98)] text-[#8a6616] text-[8px] font-black border-2 border-[rgba(255,252,246,0.95)] rounded-full shadow-md flex items-center justify-center"
                                                title="Asignado"
                                            >
                                                {thread.assignedUserId === currentUser.id ? 'M' : 'A'}
                                            </div>
                                        ) : needsHuman ? (
                                            <div
                                                className="absolute top-0 right-0 w-4 h-4 bg-red-500 border-2 border-[color:color-mix(in_srgb,var(--bg-page),black_4%)] rounded-full shadow-lg animate-pulse"
                                                title="Requiere humano"
                                            />
                                        ) : null}
                                        {isAiThread && (
                                            <div
                                                className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 ${
                                                    thread.aiPaused ? 'bg-amber-500' : 'bg-[var(--bg-page)]'
                                                } border-2 ${
                                                    thread.aiPaused ? 'border-amber-500' : 'border-[var(--bg-page)]'
                                                } rounded-full shadow-lg flex items-center justify-center`}
                                            >
                                                <Bot
                                                    className={`w-2.5 h-2.5 ${
                                                        thread.aiPaused ? 'text-[#221300]' : 'text-[var(--brand-primary)]'
                                                    }`}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                                        <div className="flex justify-between items-start gap-3 mb-1">
                                            <div className="min-w-0">
                                                <h3
                                                    className={`${T.cardTitle} ${S.body} truncate pr-1 transition-colors ${
                                                        hasUnread && !isSelected ? 'font-bold' : ''
                                                    }`}
                                                    style={
                                                        isSelected
                                                            ? { color: 'var(--brand-primary)' }
                                                            : hasUnread
                                                                ? { color: 'var(--text-strong)' }
                                                                : undefined
                                                    }
                                                >
                                                    {thread.contactName || thread.remotePhone}
                                                </h3>
                                                <div className="mt-1 flex items-center gap-2 flex-wrap">
                                                    {needsHuman && (
                                                        <span className="inline-flex items-center rounded-full bg-red-500/12 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.2em] text-red-400">
                                                            Humano
                                                        </span>
                                                    )}
                                                    {isAiThread && !needsHuman && (
                                                        <span className="inline-flex items-center rounded-full bg-[var(--brand-primary)]/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.2em] text-[var(--brand-primary)]">
                                                            IA
                                                        </span>
                                                    )}
                                                    {thread.assignedUserId === currentUser.id && (
                                                        <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.2em] text-emerald-400">
                                                            Mio
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <span
                                                className={`${T.helperText} ${S.meta} ${hasUnread ? 'font-black' : ''} shrink-0`}
                                                style={hasUnread ? { color: 'var(--brand-primary)' } : undefined}
                                            >
                                                {formatThreadTime(thread.lastMessageAt)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center gap-3">
                                            <p className={`${T.helperText} ${S.meta} truncate flex-1 pr-2 ${hasUnread ? 'text-[var(--text-strong)]' : 'italic'}`}>
                                                {thread.lastMessagePreview || ''}
                                            </p>
                                            {hasUnread && (
                                                <span className="bg-[linear-gradient(135deg,#f3df9b_0%,#efcb74_100%)] text-[#6f5310] text-[10px] font-black rounded-full h-6 min-w-[24px] px-2 flex items-center justify-center shadow-[0_6px_14px_rgba(214,177,88,0.18)]">
                                                    {thread.unreadCount}
                                                </span>
                                            )}
                                        </div>
                                        {thread.contactName && (
                                            <div className="mt-1 flex items-center gap-2">
                                                <span className={`${T.helperText} ${S.meta} opacity-60`}>
                                                    {thread.remotePhone}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </aside>

            <main className="flex-1 bg-[linear-gradient(180deg,#fffdf8_0%,#f8f4ea_100%)] relative flex flex-col h-full z-0 transition-shadow">
                {activeThread ? (
                    <div className="h-full flex flex-col">
                        <div className="min-h-[60px] bg-[rgba(255,251,244,0.94)] backdrop-blur-xl px-5 border-b border-[rgba(197,176,136,0.18)] flex flex-wrap items-center justify-between gap-3 z-10 shrink-0">
                            <div className="flex items-center gap-3 flex-wrap">
                                {activeThread.assignedUserId ? (
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <div className="flex items-center gap-1.5 bg-[var(--brand-primary)]/10 px-3 py-2 rounded-full border border-[var(--brand-primary)]/20 shadow-sm shadow-[var(--brand-primary)]/5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-[var(--ty-accent)] animate-pulse" />
                                            <span className={`${T.badgeText} ${S.meta} text-[var(--ty-accent)]`}>
                                                {activeThread.assignedUserId === currentUser.id ? 'ASIGNADO A MI' : 'ASIGNADO'}
                                            </span>
                                        </div>
                                        {(activeThread.assignedUserId === currentUser.id ||
                                            ['SUPERVISOR', 'ADMIN'].includes(currentUser.role)) && (
                                            <button
                                                onClick={handleUnassign}
                                                className={`${T.buttonText} ${S.meta} text-red-500 hover:text-red-400 rounded-full border border-red-500/20 px-3 py-2`}
                                            >
                                                Liberar
                                            </button>
                                        )}
                                        {['SUPERVISOR', 'ADMIN'].includes(currentUser.role) && assignees.length > 0 && (
                                            <select
                                                onChange={(event) => {
                                                    if (event.target.value) handleAssignThread(event.target.value);
                                                    event.target.value = '';
                                                }}
                                                className="bg-[var(--bg-input)] border border-[var(--border-default)] text-[var(--text-strong)] text-[10px] rounded-full px-3 flex-1 py-2 uppercase tracking-tighter"
                                                defaultValue=""
                                            >
                                                <option value="" disabled>
                                                    Reasignar...
                                                </option>
                                                {assignees.map((assignee) => (
                                                    <option key={assignee.id} value={assignee.id}>
                                                        {assignee.name || assignee.email}
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex gap-2 flex-wrap">
                                        <button
                                            onClick={handleTakeThread}
                                            className={`${T.buttonPrimaryText} ${S.meta} bg-[var(--brand-primary)] hover:brightness-110 px-4 py-2 rounded-full transition-all active:scale-95 shadow-lg shadow-[var(--brand-primary)]/20`}
                                            title="Tomar la atención como agente resolutor"
                                        >
                                            Tomar chat
                                        </button>
                                        {['SUPERVISOR', 'ADMIN'].includes(currentUser.role) && assignees.length > 0 && (
                                            <select
                                                onChange={(event) => {
                                                    if (event.target.value) handleAssignThread(event.target.value);
                                                    event.target.value = '';
                                                }}
                                                className="bg-[var(--bg-input)] border border-[var(--border-default)] text-[var(--text-muted)] text-[10px] rounded-full px-3 py-2 uppercase tracking-tighter w-32"
                                                defaultValue=""
                                            >
                                                <option value="" disabled>
                                                    Asignar a...
                                                </option>
                                                {assignees.map((assignee) => (
                                                    <option key={assignee.id} value={assignee.id}>
                                                        {assignee.name || assignee.email}
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                )}

                                <div className="w-px h-6 bg-[var(--border-default)] mx-1" />

                                <ThreadHandlingModeBadge mode={activeThread.handlingMode as any} aiPaused={activeThread.aiPaused} />
                            </div>

                            <div className="flex items-center gap-2">
                                <div className="hidden md:flex items-center gap-2 rounded-full bg-[rgba(255,255,255,0.86)] border border-[rgba(197,176,136,0.2)] px-3 py-2">
                                    <Inbox className="w-4 h-4 text-[var(--brand-primary)]" />
                                    <span className={`${T.helperText} ${S.meta}`}>Estado: {activeThread.status}</span>
                                </div>
                            </div>
                        </div>

                        {activeThread.aiPaused && (
                            <div className="bg-[rgba(255,243,215,0.86)] border-b border-[rgba(231,190,94,0.2)] px-6 py-4 flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-2 text-amber-500">
                                    <svg className="w-4 h-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                        />
                                    </svg>
                                    <span className="text-[11px] font-black uppercase tracking-widest">
                                        IA pausada para este chat - atención humana activa
                                    </span>
                                </div>
                                <button
                                    onClick={handleResumeAi}
                                    className={`${T.buttonText} ${S.meta} text-[#121208] bg-amber-500 hover:brightness-110 px-4 py-2 rounded-full transition-all active:scale-95`}
                                    title="Permitir que la IA vuelva a responder solo en esta conversación"
                                >
                                    Reanudar IA
                                </button>
                            </div>
                        )}

                        <div className="flex-1 overflow-hidden">
                            <ChatPanel
                                messages={messages}
                                contactName={activeThread.contactName || activeThread.remotePhone || 'Usuario'}
                                onSendMessage={handleSendMessage}
                                threadId={activeThread.id}
                                isNotesOpen={isNotesOpen}
                                onToggleNotes={() => setIsNotesOpen(!isNotesOpen)}
                                canReply={
                                    activeThread.assignedUserId === currentUser.id ||
                                    ['SUPERVISOR', 'ADMIN'].includes(currentUser.role)
                                }
                                onOpenContact={activeThread.contactId ? () => setContactDetailId(activeThread.contactId!) : undefined}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="h-full w-full bg-[var(--bg-page)] flex flex-col items-center justify-center text-center px-8 relative overflow-hidden">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] h-[320px] bg-[var(--brand-primary)]/5 rounded-full blur-[90px] pointer-events-none" />

                        <div className="mb-6 relative">
                            <div className="w-20 h-20 rounded-[28px] bg-[linear-gradient(135deg,#f7dfa5_0%,#ebb960_100%)] flex items-center justify-center shadow-[0_14px_32px_rgba(216,181,96,0.22)]">
                                <MessageSquare className="w-10 h-10 text-[#6f5310]" />
                            </div>
                        </div>
                        <h1 className={`${T.emptyStateTitle} ${S.displayLg} mb-2 tracking-tight`}>
                            Wabee <span className="text-[var(--brand-primary)]">Inbox</span>
                        </h1>
                        <p className={`${T.emptyStateBody} ${S.body} mb-6 max-w-sm mx-auto`}>
                            Selecciona una conversación para entrar al flujo real de atención, seguimiento y colaboración.
                        </p>
                        <div className="rounded-full border border-[var(--border-default)] bg-[var(--bg-input)] px-4 py-2">
                            <span className={`${T.helperText} ${S.meta}`}>
                                Empieza por la bandeja de prioridad o por tus conversaciones asignadas.
                            </span>
                        </div>
                    </div>
                )}

                {isNotesOpen && (
                    <div
                        className="absolute inset-0 z-20 bg-black/20 backdrop-blur-[1px] transition-opacity"
                        onClick={() => setIsNotesOpen(false)}
                    />
                )}
            </main>

            <aside
                ref={notesSidebarRef}
                className={`fixed right-0 top-0 h-full w-[340px] bg-[var(--bg-surface)] border-l border-[var(--border-default)] shadow-2xl z-30 transition-transform duration-500 ease-in-out transform flex flex-col ${
                    isNotesOpen ? 'translate-x-0' : 'translate-x-full'
                }`}
            >
                <div className="h-11 px-5 flex items-center justify-between border-b border-[var(--border-default)] shrink-0 bg-[var(--bg-surface)]/80 backdrop-blur-xl">
                    <h2 className={`${T.sectionTitle} ${S.headingMd} italic uppercase tracking-widest`}>Internal Notes</h2>
                    <button
                        onClick={() => setIsNotesOpen(false)}
                        className="p-1 transition-colors hover:scale-110"
                        style={{ color: 'var(--tx-sectionTitle-color)' }}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="flex flex-col flex-1 overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
                        {notes.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center opacity-40 grayscale">
                                <svg className="w-12 h-12 mb-4" style={{ color: 'var(--tx-emptyStateTitle-color)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={1}
                                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                    />
                                </svg>
                                <p className={`${T.emptyStateTitle} text-xs uppercase tracking-widest`}>Sin notas internas</p>
                            </div>
                        ) : (
                            notes.map((note) => {
                                const isAiSuggestion = note.body.startsWith('[AI_SUGGESTION]');
                                const displayBody = isAiSuggestion ? note.body.replace('[AI_SUGGESTION]', '').trim() : note.body;

                                return (
                                    <div
                                        key={note.id}
                                        className={`${
                                            isAiSuggestion ? 'bg-purple-900/10 border-purple-500/30' : 'bg-[var(--bg-card)] border-[var(--border-default)]'
                                        } p-4 rounded-2xl border shadow-lg relative group overflow-hidden`}
                                    >
                                        <div
                                            className={`absolute top-0 left-0 w-1 h-full ${
                                                note.isPinned ? 'bg-[var(--brand-primary)]' : isAiSuggestion ? 'bg-purple-500' : 'bg-[var(--border-default)]'
                                            }`}
                                        />
                                        <div className="flex justify-between items-start mb-2 px-1">
                                            <div className="flex items-center gap-2">
                                                {isAiSuggestion ? (
                                                    <div className="w-5 h-5 rounded bg-purple-500/20 text-purple-400 flex items-center justify-center text-[9px] font-black uppercase tracking-tighter">
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                                        </svg>
                                                    </div>
                                                ) : (
                                                    <div className="w-5 h-5 rounded bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] flex items-center justify-center text-[9px] font-black uppercase tracking-tighter">
                                                        {(note.authorName || 'US').substring(0, 2).toUpperCase()}
                                                    </div>
                                                )}
                                                <span className={`${T.cardTitle} ${S.meta}`}>
                                                    {isAiSuggestion ? 'Copiloto IA' : note.authorName || (note.createdById === currentUser.id ? 'Tu' : 'Sistema')}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`${T.helperText} ${S.meta} font-mono`}>
                                                    {new Date(note.createdAt).toLocaleDateString()}
                                                </span>
                                                <button
                                                    onClick={() => handlePinNote(note.id, note.isPinned)}
                                                    className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--bg-input)]"
                                                    title={note.isPinned ? 'Desfijar' : 'Fijar arriba'}
                                                >
                                                    <svg
                                                        className={`w-3.5 h-3.5 ${
                                                            note.isPinned ? 'text-[var(--brand-primary)] fill-[var(--brand-primary)]' : 'text-[var(--text-muted)]'
                                                        }`}
                                                        fill="none"
                                                        stroke="currentColor"
                                                        viewBox="0 0 24 24"
                                                    >
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteNote(note.id)}
                                                    className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/10 text-red-500"
                                                    title="Eliminar"
                                                >
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            strokeWidth={2}
                                                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                                        />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                        <p className={`${T.messageText} ${S.body} pl-1 ${isAiSuggestion ? 'text-purple-200' : 'text-[var(--text-muted)] italic'} mb-2`}>
                                            {displayBody}
                                        </p>

                                        {!isAiSuggestion && (
                                            <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-[var(--border-default)] px-1">
                                                <span className="text-[8px] font-black text-[var(--brand-primary)] uppercase tracking-widest bg-[var(--brand-primary)]/10 px-1.5 py-0.5 rounded">
                                                    {note.authorRole || 'STAFF'}
                                                </span>
                                                <span className={`${T.helperText} text-[9px] font-bold`}>- Registrado por equipo</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    <form onSubmit={handleAddNote} className="p-5 bg-[var(--bg-surface)] border-t border-[var(--border-default)] shrink-0">
                        <textarea
                            className={`${T.inputText} ${S.body} w-full bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl p-3 focus:ring-2 focus:ring-[var(--brand-primary)]/50 focus:border-[var(--brand-primary)] outline-none transition-all placeholder:text-[var(--text-muted)] resize-none font-medium custom-scrollbar`}
                            placeholder="Escribe un comentario privado..."
                            rows={3}
                            value={newNote}
                            onChange={(event) => setNewNote(event.target.value)}
                        />
                        <button
                            type="submit"
                            disabled={!newNote.trim()}
                            className={`${T.buttonPrimaryText} ${S.body} mt-3 w-full bg-[var(--brand-primary)] py-3 rounded-xl uppercase tracking-[0.2em] hover:brightness-110 disabled:opacity-30 disabled:grayscale transition-all shadow-xl shadow-[var(--brand-primary)]/10 active:scale-95 flex items-center justify-center gap-2`}
                        >
                            Fijar nota
                        </button>
                    </form>
                </div>
            </aside>

            {contactDetailId && (
                <ContactDetailModal
                    contactId={contactDetailId}
                    onClose={() => setContactDetailId(null)}
                    onSuccess={() => setContactDetailId(null)}
                />
            )}
        </div>
    );
}
