import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { T, S } from '@/lib/text-tokens';
import {
    ArrowLeft,
    Bot,
    MessageSquare,
    Inbox,
    Plus,
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
        if (date.toDateString() === yesterday.toDateString()) return 'Ayer';
        return date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
    };

    const getThreadInitials = (thread: Thread) => {
        const label = thread.contactName || thread.remotePhone || 'WB';
        const parts = label.trim().split(/\s+/).filter(Boolean);
        if (parts.length >= 2) return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
        return label.slice(0, 2).toUpperCase();
    };

    const getFilterCount = (tabId: InboxFilter) => {
        if (tabId === 'all') return threads.filter((t) => t.status !== 'CLOSED').length;
        if (tabId === 'ai') return threads.filter((t) => t.handlingMode === 'ai' || t.handlingMode === 'copilot').length;
        if (tabId === 'human_queue') return threads.filter((t) => t.handlingMode === 'human_queue').length;
        if (tabId === 'mine') return threads.filter((t) => t.assignedUserId === currentUser.id).length;
        if (tabId === 'taken') return threads.filter((t) => !!t.assignedUserId || t.handlingMode === 'human').length;
        if (tabId === 'unassigned') return threads.filter((t) => !t.assignedUserId && t.status !== 'CLOSED').length;
        if (tabId === 'closed') return threads.filter((t) => t.status === 'CLOSED').length;
        return 0;
    };

    const connectedChannels = channels.filter((c) => c.status === 'CONNECTED').length;
    const unreadThreadsCount = threads.filter((t) => t.unreadCount > 0).length;

    return (
        <div
            className={`flex bg-[#FBFBF4] text-[var(--text-strong)] overflow-hidden font-sans ${
                isFullScreen
                    ? 'h-screen w-screen border-none rounded-none'
                    : 'h-[calc(100vh-72px)] rounded-[28px] border border-[rgba(26,26,26,0.08)] shadow-[0_18px_46px_rgba(26,26,26,0.1)]'
            }`}
        >
            {/* Channel rail */}
            <aside className="w-[60px] bg-[#F7F7EC] flex flex-col items-center py-3 gap-3 border-r border-[rgba(26,26,26,0.08)] shrink-0 z-20">
                <div className="w-[38px] h-[38px] rounded-[10px] bg-[var(--brand-primary)] flex items-center justify-center shadow-[0_4px_12px_rgba(255,140,0,0.24)]">
                    <span className="text-[17px] font-bold text-white">W</span>
                </div>
                <div className="w-6 h-px bg-[rgba(26,26,26,0.08)]" />

                <div className="flex-1 w-full flex flex-col items-center gap-2 overflow-y-auto no-scrollbar px-2">
                    {channels.map((channel) => (
                        <button
                            key={channel.id}
                            onClick={() => handleChannelSelect(channel.id)}
                            className={`w-10 h-10 rounded-[10px] flex items-center justify-center transition-all relative flex-shrink-0 border text-[13px] font-bold ${
                                selectedChannelId === channel.id
                                    ? 'bg-white border-[rgba(255,140,0,0.18)] text-[var(--brand-primary)] shadow-[0_1px_4px_rgba(26,26,26,0.06)]'
                                    : 'bg-transparent border-transparent text-[rgba(26,26,26,0.4)] hover:bg-[rgba(26,26,26,0.04)]'
                            }`}
                            title={channel.name || channel.displayPhone}
                        >
                            {(channel.name?.[0] || 'C').toUpperCase()}
                            <span className={`absolute bottom-[3px] right-[3px] w-[7px] h-[7px] rounded-full border-[1.5px] ${
                                selectedChannelId === channel.id ? 'border-white' : 'border-[#F7F7EC]'
                            } ${channel.status === 'CONNECTED' ? 'bg-green-500' : 'bg-[rgba(26,26,26,0.22)]'}`} />
                        </button>
                    ))}
                </div>
            </aside>

            {/* Thread list sidebar */}
            <aside className="w-[344px] bg-white border-r border-[rgba(26,26,26,0.08)] flex flex-col shrink-0 relative z-10">
                {/* Header */}
                <div className="px-4 pt-4 pb-3 border-b border-[rgba(26,26,26,0.08)] shrink-0">
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-3 min-w-0">
                            {isFullScreen && (
                                <button
                                    onClick={() => setSearchParams((prev) => { prev.set('view', 'standard'); return prev; })}
                                    className="p-1.5 hover:bg-[rgba(26,26,26,0.05)] rounded-lg transition-colors text-[var(--brand-primary)]"
                                >
                                    <ArrowLeft size={16} />
                                </button>
                            )}
                            <div>
                                <h1 className={`${T.pageTitle} ${S.headingLg} tracking-tight`}>Mensajes</h1>
                                <p className={`${T.helperText} ${S.meta} mt-0.5 text-[rgba(26,26,26,0.5)]`}>
                                    {filteredThreads.length} conversaciones · {unreadThreadsCount} sin leer
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`${T.helperText} ${S.meta} text-[rgba(26,26,26,0.4)]`}>
                                {connectedChannels}/{channels.length}
                            </span>
                            <button className="w-[30px] h-[30px] rounded-[8px] flex items-center justify-center border border-[rgba(26,26,26,0.12)] text-[rgba(26,26,26,0.5)] hover:bg-[rgba(26,26,26,0.04)] transition-colors">
                                <Plus size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="mt-3 flex items-center gap-2 px-3 h-[38px] bg-[#FBFBF4] border border-[rgba(26,26,26,0.1)] rounded-[10px] focus-within:border-[var(--brand-primary)] transition-colors">
                        <svg className="w-4 h-4 text-[rgba(26,26,26,0.35)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Buscar conversaciones…"
                            className={`${T.inputText} ${S.body} bg-transparent border-none w-full focus:ring-0 text-[var(--text-strong)]`}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {/* Filter chips — horizontal scrollable */}
                <div className="flex gap-1.5 px-4 py-3 overflow-x-auto no-scrollbar border-b border-[rgba(26,26,26,0.08)] shrink-0">
                    {FILTER_TABS.filter((tab) => !tab.roles || tab.roles.includes(currentUser.role)).map((tab) => {
                        const count = getFilterCount(tab.id);
                        const isActive = filter === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setFilter(tab.id as InboxFilter)}
                                className={`flex-shrink-0 h-[30px] px-[11px] rounded-full flex items-center gap-1.5 text-[12.5px] font-semibold transition-all whitespace-nowrap border ${
                                    isActive
                                        ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)]'
                                        : 'bg-[#FBFBF4] text-[rgba(26,26,26,0.65)] border-[rgba(26,26,26,0.1)] hover:bg-[rgba(26,26,26,0.04)]'
                                }`}
                            >
                                {tab.label}
                                {count > 0 && (
                                    <span className={`text-[11px] font-bold px-[5px] min-w-[16px] h-4 rounded-full flex items-center justify-center ${
                                        isActive ? 'bg-white/20 text-white' : 'bg-[rgba(26,26,26,0.06)] text-[rgba(26,26,26,0.5)]'
                                    }`}>
                                        {count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Assignee filter (admin/supervisor) */}
                {['ADMIN', 'SUPERVISOR'].includes(currentUser.role) && assignees.length > 0 && (
                    <div className="px-4 py-2 shrink-0 border-b border-[rgba(26,26,26,0.08)]">
                        <select
                            value={assigneeFilter}
                            onChange={(e) => setAssigneeFilter(e.target.value)}
                            className={`${T.inputText} ${S.meta} w-full bg-[#FBFBF4] border border-[rgba(26,26,26,0.1)] rounded-[8px] px-3 py-2 outline-none focus:border-[var(--brand-primary)] transition-colors text-[rgba(26,26,26,0.6)]`}
                        >
                            <option value="">Todos los agentes</option>
                            {assignees.map((a) => (
                                <option key={a.id} value={a.id}>{a.name}</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Thread list */}
                <div className="flex-1 overflow-y-auto custom-scrollbar py-2 px-2">
                    {loadingThreads && threads.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                            <div className="animate-spin rounded-full h-7 w-7 border-2 border-t-[var(--brand-primary)] border-transparent" />
                            <span className={`${T.helperText} ${S.meta} text-[rgba(26,26,26,0.4)] uppercase tracking-wider`}>Cargando…</span>
                        </div>
                    ) : filteredThreads.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center px-8">
                            <Inbox className="w-7 h-7 mb-3 text-[rgba(26,26,26,0.22)]" />
                            <span className={`${T.helperText} ${S.meta} text-[rgba(26,26,26,0.4)]`}>
                                No hay conversaciones{filter !== 'all' ? ' en este filtro' : ''}.
                            </span>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-0.5">
                            {filteredThreads.map((thread) => {
                                const isSelected = selectedThreadId === thread.id;
                                const hasUnread = thread.unreadCount > 0;
                                const isAiThread = thread.handlingMode === 'ai' || thread.handlingMode === 'copilot';
                                const needsHuman = thread.handlingMode === 'human_queue';

                                return (
                                    <button
                                        key={thread.id}
                                        onClick={() => handleThreadSelect(thread.id)}
                                        className={`w-full text-left flex items-start gap-3 px-3 py-3 rounded-[10px] transition-all relative ${
                                            isSelected
                                                ? 'bg-[rgba(255,140,0,0.06)]'
                                                : 'hover:bg-[rgba(26,26,26,0.03)]'
                                        }`}
                                        style={isSelected ? { boxShadow: 'inset 3px 0 0 0 var(--brand-primary)' } : {}}
                                    >
                                        {/* Avatar */}
                                        <div className="relative flex-shrink-0">
                                            <div className={`w-11 h-11 rounded-full flex items-center justify-center text-[13px] font-bold border relative ${
                                                isSelected || hasUnread
                                                    ? 'bg-[rgba(255,140,0,0.1)] border-[rgba(255,140,0,0.18)] text-[var(--brand-primary)]'
                                                    : 'bg-[rgba(26,26,26,0.05)] border-[rgba(26,26,26,0.08)] text-[rgba(26,26,26,0.6)]'
                                            }`}>
                                                {getThreadInitials(thread)}
                                            </div>
                                            {/* Mode dot */}
                                            {needsHuman && (
                                                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-white border-2 border-white flex items-center justify-center">
                                                    <span className="w-2 h-2 rounded-full bg-[var(--brand-primary)] animate-pulse" />
                                                </span>
                                            )}
                                            {isAiThread && !needsHuman && (
                                                <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-white border-[1.5px] border-white flex items-center justify-center">
                                                    <Bot className={`w-2.5 h-2.5 ${thread.aiPaused ? 'text-amber-500' : 'text-[rgba(26,26,26,0.4)]'}`} />
                                                </span>
                                            )}
                                            {thread.assignedUserId && !needsHuman && !isAiThread && (
                                                <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white" title="Asignado" />
                                            )}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-baseline gap-2">
                                                <span
                                                    className={`${T.cardTitle} ${S.body} truncate transition-colors ${hasUnread ? 'font-bold' : ''}`}
                                                    style={isSelected ? { color: 'var(--brand-primary)' } : {}}
                                                >
                                                    {thread.contactName || thread.remotePhone}
                                                </span>
                                                <span
                                                    className={`${T.helperText} flex-shrink-0 text-[10.5px] font-medium ${hasUnread ? 'font-bold' : ''}`}
                                                    style={{ color: hasUnread ? 'var(--brand-primary)' : 'rgba(26,26,26,0.4)', fontFamily: 'ui-monospace, monospace' }}
                                                >
                                                    {formatThreadTime(thread.lastMessageAt)}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center gap-2 mt-0.5">
                                                <p className={`${T.helperText} ${S.meta} truncate flex-1 ${hasUnread ? 'text-[rgba(26,26,26,0.7)] font-medium' : 'text-[rgba(26,26,26,0.45)]'}`}>
                                                    {thread.lastMessagePreview || ''}
                                                </p>
                                                {hasUnread && (
                                                    <span className="flex-shrink-0 min-w-[18px] h-[18px] px-[5px] rounded-full bg-[var(--brand-primary)] text-white text-[11px] font-bold flex items-center justify-center">
                                                        {thread.unreadCount}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap overflow-hidden">
                                                {needsHuman && (
                                                    <span className="inline-flex items-center rounded-full bg-[rgba(255,140,0,0.1)] border border-[rgba(255,140,0,0.22)] px-[7px] py-[2px] text-[9.5px] font-bold uppercase tracking-[0.04em] text-[var(--brand-primary)] whitespace-nowrap">
                                                        En cola
                                                    </span>
                                                )}
                                                {isAiThread && !needsHuman && (
                                                    <span className="inline-flex items-center gap-[3px] rounded-full bg-[rgba(255,215,0,0.18)] border border-[rgba(26,26,26,0.08)] px-[7px] py-[2px] text-[9.5px] font-bold uppercase tracking-[0.04em] text-[rgba(26,26,26,0.55)] whitespace-nowrap">
                                                        IA
                                                    </span>
                                                )}
                                                {thread.handlingMode === 'human' && (
                                                    <span className="inline-flex items-center rounded-full bg-[rgba(255,140,0,0.08)] border border-[rgba(255,140,0,0.18)] px-[7px] py-[2px] text-[9.5px] font-bold uppercase tracking-[0.04em] text-[var(--brand-primary)] whitespace-nowrap">
                                                        Humano
                                                    </span>
                                                )}
                                                {thread.assignedUserId === currentUser.id && (
                                                    <span className="inline-flex items-center rounded-full bg-[rgba(255,140,0,0.06)] border border-[rgba(255,140,0,0.14)] px-[7px] py-[2px] text-[9.5px] font-bold uppercase tracking-[0.04em] text-[var(--brand-primary)] whitespace-nowrap">
                                                        Mío
                                                    </span>
                                                )}
                                                {thread.status === 'CLOSED' && (
                                                    <span className="inline-flex items-center rounded-full bg-[rgba(26,26,26,0.04)] border border-[rgba(26,26,26,0.08)] px-[7px] py-[2px] text-[9.5px] font-bold uppercase tracking-[0.04em] text-[rgba(26,26,26,0.4)] whitespace-nowrap">
                                                        Cerrado
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </aside>

            {/* Main chat area */}
            <main className="flex-1 bg-[#FBFBF4] relative flex flex-col h-full z-0">
                {activeThread ? (
                    <div className="h-full flex flex-col">
                        {/* Action bar */}
                        <div className="h-[52px] bg-white px-4 border-b border-[rgba(26,26,26,0.08)] flex items-center justify-between gap-3 z-10 shrink-0">
                            <div className="flex items-center gap-2">
                                {activeThread.assignedUserId ? (
                                    <div className="flex items-center gap-2">
                                        <span className="inline-flex items-center gap-1.5 px-[10px] h-[34px] rounded-[8px] text-[12.5px] font-semibold border border-[rgba(255,140,0,0.2)] bg-[rgba(255,140,0,0.06)] text-[var(--brand-primary)]">
                                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-primary)]" />
                                            {activeThread.assignedUserId === currentUser.id ? 'Asignado a mí' : 'Asignado'}
                                        </span>
                                        {(activeThread.assignedUserId === currentUser.id || ['SUPERVISOR', 'ADMIN'].includes(currentUser.role)) && (
                                            <button
                                                onClick={handleUnassign}
                                                className="px-3 h-[34px] rounded-[8px] border border-[rgba(255,140,0,0.22)] text-[var(--brand-primary)] bg-white text-[12.5px] font-semibold hover:bg-[rgba(255,140,0,0.04)] transition-colors"
                                            >
                                                Liberar
                                            </button>
                                        )}
                                        {['SUPERVISOR', 'ADMIN'].includes(currentUser.role) && assignees.length > 0 && (
                                            <select
                                                onChange={(e) => { if (e.target.value) handleAssignThread(e.target.value); e.target.value = ''; }}
                                                className="h-[34px] rounded-[8px] border border-[rgba(26,26,26,0.12)] bg-white px-3 text-[12px] text-[rgba(26,26,26,0.55)]"
                                                defaultValue=""
                                            >
                                                <option value="" disabled>Reasignar…</option>
                                                {assignees.map((a) => <option key={a.id} value={a.id}>{a.name || a.email}</option>)}
                                            </select>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleTakeThread}
                                            className="px-3 h-[34px] rounded-[8px] bg-[var(--brand-primary)] text-white text-[12.5px] font-semibold hover:brightness-105 transition-all active:scale-95 shadow-[0_2px_8px_rgba(255,140,0,0.22)]"
                                        >
                                            Tomar chat
                                        </button>
                                        {['SUPERVISOR', 'ADMIN'].includes(currentUser.role) && assignees.length > 0 && (
                                            <select
                                                onChange={(e) => { if (e.target.value) handleAssignThread(e.target.value); e.target.value = ''; }}
                                                className="h-[34px] rounded-[8px] border border-[rgba(26,26,26,0.12)] bg-white px-3 text-[12px] text-[rgba(26,26,26,0.45)]"
                                                defaultValue=""
                                            >
                                                <option value="" disabled>Asignar a…</option>
                                                {assignees.map((a) => <option key={a.id} value={a.id}>{a.name || a.email}</option>)}
                                            </select>
                                        )}
                                    </div>
                                )}

                                <div className="w-px h-5 bg-[rgba(26,26,26,0.1)] mx-0.5" />
                                <ThreadHandlingModeBadge mode={activeThread.handlingMode as any} aiPaused={activeThread.aiPaused} />
                            </div>

                            <div className="flex items-center gap-2">
                                <span className={`${T.helperText} ${S.meta} text-[rgba(26,26,26,0.4)] hidden md:block`}>
                                    Estado: {activeThread.status}
                                </span>
                            </div>
                        </div>

                        {/* AI paused banner */}
                        {activeThread.aiPaused && (
                            <div className="bg-[rgba(255,140,0,0.08)] border-b border-[rgba(255,140,0,0.18)] px-5 py-3 flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-2 text-[var(--brand-primary)]">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                    <span className="text-[12px] font-semibold text-[rgba(26,26,26,0.7)]">
                                        IA en pausa — atención humana activa en esta conversación.
                                    </span>
                                </div>
                                <button
                                    onClick={handleResumeAi}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-white border border-[rgba(255,140,0,0.22)] text-[var(--brand-primary)] text-[12px] font-semibold hover:bg-[rgba(255,140,0,0.04)] transition-colors"
                                >
                                    Reanudar IA
                                </button>
                            </div>
                        )}

                        <div className="flex-1 overflow-hidden">
                            <ChatPanel
                                messages={messages}
                                contactName={activeThread.contactName || activeThread.remotePhone || 'Usuario'}
                                contactPhone={activeThread.remotePhone}
                                onSendMessage={handleSendMessage}
                                threadId={activeThread.id}
                                isNotesOpen={isNotesOpen}
                                onToggleNotes={() => setIsNotesOpen(!isNotesOpen)}
                                canReply={
                                    activeThread.assignedUserId === currentUser.id ||
                                    ['SUPERVISOR', 'ADMIN'].includes(currentUser.role)
                                }
                                onOpenContact={activeThread.contactId ? () => setContactDetailId(activeThread.contactId!) : undefined}
                                threadStatus={activeThread.status}
                                handlingMode={activeThread.handlingMode as any}
                                aiPaused={activeThread.aiPaused}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="h-full w-full flex flex-col items-center justify-center text-center px-8">
                        <div className="mb-5">
                            <div className="w-[72px] h-[72px] rounded-[14px] bg-white border border-[rgba(26,26,26,0.08)] flex items-center justify-center text-[var(--brand-primary)] shadow-[0_4px_12px_rgba(26,26,26,0.06)] mx-auto">
                                <MessageSquare className="w-8 h-8" />
                            </div>
                        </div>
                        <h2 className={`${T.emptyStateTitle} ${S.displayLg} mb-2`}>Selecciona una conversación</h2>
                        <p className={`${T.emptyStateBody} ${S.body} max-w-xs mx-auto text-[rgba(26,26,26,0.5)]`}>
                            Empieza por la bandeja de prioridad o por tus conversaciones asignadas para atender y dar seguimiento.
                        </p>
                    </div>
                )}

                {isNotesOpen && (
                    <div
                        className="absolute inset-0 z-20 bg-[rgba(26,26,26,0.16)] backdrop-blur-[1px]"
                        onClick={() => setIsNotesOpen(false)}
                    />
                )}
            </main>

            {/* Notes sidebar */}
            <aside
                ref={notesSidebarRef}
                className={`fixed right-0 top-0 h-full w-[320px] bg-white border-l border-[rgba(26,26,26,0.08)] shadow-[0_0_32px_rgba(26,26,26,0.12)] z-30 transition-transform duration-300 ease-in-out flex flex-col ${
                    isNotesOpen ? 'translate-x-0' : 'translate-x-full'
                }`}
            >
                <div className="h-[64px] px-4 flex items-center justify-between border-b border-[rgba(26,26,26,0.08)] shrink-0">
                    <span className="inline-flex items-center gap-2 text-[rgba(26,26,26,0.55)] text-[11px] font-bold uppercase tracking-[0.12em]">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Notas internas
                    </span>
                    <button
                        onClick={() => setIsNotesOpen(false)}
                        className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[rgba(26,26,26,0.4)] hover:bg-[rgba(26,26,26,0.05)] transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-3">
                    {notes.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center text-[rgba(26,26,26,0.3)] gap-3">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <p className="text-[13px]">Aún no hay notas internas.<br />Solo tu equipo puede verlas.</p>
                        </div>
                    ) : (
                        notes.map((note) => {
                            const isAiSuggestion = note.body.startsWith('[AI_SUGGESTION]');
                            const displayBody = isAiSuggestion ? note.body.replace('[AI_SUGGESTION]', '').trim() : note.body;
                            return (
                                <div
                                    key={note.id}
                                    className={`p-3 rounded-[10px] border relative group ${
                                        note.isPinned
                                            ? 'bg-[rgba(255,215,0,0.1)] border-[rgba(26,26,26,0.08)]'
                                            : 'bg-[#FBFBF4] border-[rgba(26,26,26,0.08)]'
                                    }`}
                                >
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-[12px] font-semibold text-[rgba(26,26,26,0.65)]">
                                            {isAiSuggestion ? 'Copiloto IA' : note.authorName || (note.createdById === currentUser.id ? 'Tú' : 'Sistema')}
                                        </span>
                                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handlePinNote(note.id, note.isPinned)} className="p-1 rounded hover:bg-[rgba(26,26,26,0.06)]">
                                                <svg className={`w-3 h-3 ${note.isPinned ? 'text-[var(--brand-primary)]' : 'text-[rgba(26,26,26,0.35)]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                                                </svg>
                                            </button>
                                            <button onClick={() => handleDeleteNote(note.id)} className="p-1 rounded hover:bg-red-500/10 text-red-500">
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-[13px] text-[rgba(26,26,26,0.72)] leading-relaxed">{displayBody}</p>
                                    <span className="block mt-2 text-[10.5px] font-medium text-[rgba(26,26,26,0.35)]" style={{ fontFamily: 'ui-monospace,monospace' }}>
                                        {new Date(note.createdAt).toLocaleDateString()}
                                    </span>
                                </div>
                            );
                        })
                    )}
                </div>

                <form onSubmit={handleAddNote} className="p-4 border-t border-[rgba(26,26,26,0.08)] shrink-0">
                    <textarea
                        className="w-full bg-[#FBFBF4] border border-[rgba(26,26,26,0.1)] rounded-[10px] p-3 text-[13px] text-[var(--text-strong)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)] outline-none transition-all placeholder:text-[rgba(26,26,26,0.35)] resize-none custom-scrollbar"
                        placeholder="Escribe una nota privada…"
                        rows={2}
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        style={{ maxHeight: 90 }}
                    />
                    <button
                        type="submit"
                        disabled={!newNote.trim()}
                        className="mt-2 w-full h-[40px] rounded-[10px] bg-[var(--brand-primary)] text-white text-[13px] font-semibold hover:brightness-105 disabled:opacity-30 disabled:grayscale transition-all flex items-center justify-center gap-2"
                    >
                        Guardar nota
                    </button>
                </form>
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
