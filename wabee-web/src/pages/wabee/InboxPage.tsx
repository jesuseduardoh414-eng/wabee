import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { T, S } from '@/lib/text-tokens';
import { 
    ArrowLeft,
    Search,
    MoreVertical,
    Paperclip,
    Send as SendIcon,
    X,
    Pin,
    Trash2,
    CheckCircle2,
    Clock,
    User as UserIcon,
    AlertCircle,
    Zap
} from 'lucide-react';
import { getThreadMessages, sendMessageToThread, getThreadById, getThreadNotes, createThreadNote, updateThreadNote, deleteThreadNote, assignThread, updateThreadStatus, Message, Thread, ThreadNote, getChannelThreads, Assignee, getAssignableUsers, takeThread, unassignThread } from '@/api/wabee/inbox.api';
import { getChannels, Channel } from '@/api/wabee/whatsapp.api';
import ChatPanel from '@/components/wabee/ChatPanel';
import ThreadHandlingModeBadge from '@/components/wabee/ThreadHandlingModeBadge';
import { useToast } from '@/context/ToastContext';
import { useDialog } from '@/context/DialogContext';

export default function InboxPage() {
    // Current Selection State
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    // Detectar modo pantalla completa
    const isFullScreen = searchParams.get('view') !== 'standard';

    const [channels, setChannels] = useState<Channel[]>([]);
    const [threads, setThreads] = useState<Thread[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [notes, setNotes] = useState<ThreadNote[]>([]);
    const [assignees, setAssignees] = useState<Assignee[]>([]);

    // UI State
    const [loadingThreads, setLoadingThreads] = useState(false);
    const [isNotesOpen, setIsNotesOpen] = useState(false);
    const [newNote, setNewNote] = useState('');
    const [filter, setFilter] = useState<'all' | 'ai' | 'human_queue' | 'taken' | 'mine' | 'closed' | 'unassigned'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const notesSidebarRef = useRef<HTMLDivElement>(null);

    const { error: toastError, success: toastSuccess } = useToast();
    const { confirm } = useDialog();

    // Actual Current User
    const savedUser = localStorage.getItem('wabee_user');
    const currentUser = savedUser ? JSON.parse(savedUser) : { id: 'unknown', role: 'AGENT' };

    // Derived State from URL/State
    const selectedChannelId = searchParams.get('channelId');
    const selectedThreadId = searchParams.get('threadId');

    // 1. Load Channels & Assignees on Mount
    useEffect(() => {
        getChannels().then(data => {
            setChannels(data);
            if (data.length > 0 && !selectedChannelId) {
                const connected = data.find(c => c.status === 'CONNECTED') || data[0];
                setSearchParams(prev => {
                    prev.set('channelId', connected.id);
                    return prev;
                });
            }
        }).catch(err => console.error("Error loading channels", err));

        if (['ADMIN', 'SUPERVISOR'].includes(currentUser.role)) {
            getAssignableUsers().then(data => setAssignees(data))
                .catch(err => console.error("Error loading assignees", err));
        }
    }, []);

    // 2. Load Threads when Channel ID changes
    useEffect(() => {
        if (!selectedChannelId) return;

        const loadThreads = async () => {
            setLoadingThreads(true);
            try {
                const data = await getChannelThreads(selectedChannelId);
                const filteredData = data;

                // If we have a selectedThreadId in URL that IS NOT in the current threads list,
                // we should fetch it and add it to the top.
                if (selectedThreadId && !filteredData.find(t => t.id === selectedThreadId)) {
                    try {
                        const extraThread = await getThreadById(selectedThreadId);
                        // Add to top of the list if it belongs to this channel
                        setThreads([extraThread, ...filteredData]);
                    } catch (e) {
                        console.error("Error loading specific threadId from URL", e);
                        setThreads(filteredData);
                    }
                } else {
                    setThreads(filteredData);
                }
            } catch (err) {
                console.error("Error loading threads", err);
            } finally {
                setLoadingThreads(false);
            }
        };

        loadThreads();

        const interval = setInterval(async () => {
            try {
                const threadsData = await getChannelThreads(selectedChannelId);
                const filteredThreads = threadsData;

                setThreads(prev => {
                    // Merge logic: only keep selected thread if it wasn't filtered out by source
                    if (selectedThreadId && !filteredThreads.find(t => t.id === selectedThreadId)) {
                        const currentExtra = prev.find(t => t.id === selectedThreadId);
                        return currentExtra ? [currentExtra, ...filteredThreads] : filteredThreads;
                    }
                    return filteredThreads;
                });
            } catch (e) {
                console.error("Polling threads error", e);
            }
        }, 8000);

        return () => clearInterval(interval);
    }, [selectedChannelId, selectedThreadId]);

    // 3. Load Messages when Thread ID changes
    useEffect(() => {
        if (!selectedThreadId || !selectedChannelId) return;

        const fetchMessages = async () => {
            try {
                const data = await getThreadMessages(selectedChannelId, selectedThreadId);
                setMessages(data.items);
            } catch (err) {
                console.error("Error loading messages", err);
            }
        };

        fetchMessages();
        const interval = setInterval(fetchMessages, 5000);
        return () => clearInterval(interval);
    }, [selectedThreadId, selectedChannelId]);

    // 4. Load Notes when selection or panel opens
    useEffect(() => {
        if (!selectedThreadId || !isNotesOpen) return;

        const loadNotes = async () => {
            try {
                const data = await getThreadNotes(selectedThreadId);
                setNotes(data);
            } catch (err) {
                console.error("Error loading notes", err);
            }
        };

        loadNotes();
    }, [selectedThreadId, isNotesOpen]);

    // Handlers
    const handleChannelSelect = (channelId: string) => {
        setSearchParams({ channelId }); // Clear threadId when switching channels
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
            // Quick optimistic update or just wait for poll? 
            // Let's re-fetch immediately for better UX
            if (selectedChannelId) {
                const data = await getThreadMessages(selectedChannelId, selectedThreadId);
                setMessages(data.items);
            }
        } catch (err) {
            console.error("Failed to send", err);
            toastError("Error al enviar mensaje");
        }
    };

    const handleTakeThread = async () => {
        if (!selectedThreadId) return;
        try {
            const updated = await takeThread(selectedThreadId);
            setThreads(prev => prev.map(t => t.id === updated.id ? { ...t, assignedUserId: currentUser.id, handlingMode: 'human', aiPaused: true } : t));
            toastSuccess("Chat tomado exitosamente.");
        } catch (err: any) {
            console.error("Take error", err);
            toastError(err.message || "Error al tomar el chat. Es posible que otro agente ya lo haya tomado.");
        }
    };

    const handleForceTakeover = async () => {
        if (!selectedThreadId) return;
        try {
            const { forceTakeover } = await import('@/api/wabee/inbox.api');
            await forceTakeover(selectedThreadId);
            setThreads(prev => prev.map(t => t.id === selectedThreadId ? { ...t, assignedUserId: currentUser.id, handlingMode: 'human', aiPaused: true } : t));
            toastSuccess("Control Tomado. IA pausada.");
        } catch (e: any) {
            toastError(e.message || "Error al tomar control");
        }
    };

    const handleResumeAi = async () => {
        if (!selectedThreadId) return;
        try {
            const { resumeAi } = await import('@/api/wabee/inbox.api');
            await resumeAi(selectedThreadId);
            setThreads(prev => prev.map(t => t.id === selectedThreadId ? { ...t, aiPaused: false, handlingMode: 'ai' } : t));
            toastSuccess("IA Reanudada para este chat.");
        } catch (err: any) {
            toastError(err.message || "Error al reanudar IA");
        }
    };

    const handleAssignThread = async (targetUserId: string) => {
        if (!selectedThreadId) return;
        try {
            const updated = await assignThread(selectedThreadId, targetUserId);
            setThreads(prev => prev.map(t => t.id === updated.id ? { ...t, assignedUserId: updated.assignedUserId } : t));
            toastSuccess(`Chat asignado correctamente.`);
        } catch (err: any) {
            console.error("Assign error", err);
            toastError("Error al asignar chat.");
        }
    };

    const handleUnassign = async () => {
        if (!selectedThreadId) return;
        try {
            const updated = await unassignThread(selectedThreadId);
            setThreads(prev => prev.map(t => t.id === updated.id ? { ...t, assignedUserId: null, handlingMode: updated.handlingMode } : t));
            toastSuccess("Chat liberado.");
        } catch (err) {
            console.error("Unassign error", err);
            toastError("Error al liberar el chat.");
        }
    };

    const handleStatusUpdate = async (newStatus: string) => {
        if (!selectedThreadId) return;
        try {
            const updated = await updateThreadStatus(selectedThreadId, newStatus);
            setThreads(prev => prev.map(t => t.id === updated.id ? { ...t, status: updated.status } : t));
        } catch (err) {
            console.error("Status update error", err);
        }
    };

    const handleAddNote = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedThreadId || !newNote.trim()) return;
        try {
            const note = await createThreadNote(selectedThreadId, newNote);
            setNotes(prev => [note, ...prev].sort((a, b) => {
                if (a.isPinned === b.isPinned) return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                return a.isPinned ? -1 : 1;
            }));
            setNewNote('');
        } catch (err) {
            console.error("Note creation error", err);
            toastError("Error al fijar nota");
        }
    };

    const handlePinNote = async (noteId: string, currentPinned: boolean) => {
        if (!selectedThreadId) return;
        try {
            const updated = await updateThreadNote(selectedThreadId, noteId, { isPinned: !currentPinned });
            setNotes(prev => prev.map(n => n.id === updated.id ? updated : n).sort((a, b) => {
                if (a.isPinned === b.isPinned) return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                return a.isPinned ? -1 : 1;
            }));
        } catch (err) {
            console.error("Note pin error", err);
        }
    };

    const handleDeleteNote = async (noteId: string) => {
        if (!selectedThreadId) return;

        const isConfirmed = await confirm({
            title: 'Eliminar Nota',
            description: '¿Estás seguro de eliminar esta nota?',
            isDestructive: true,
            confirmText: 'Eliminar'
        });
        if (!isConfirmed) return;

        try {
            await deleteThreadNote(selectedThreadId, noteId);
            setNotes(prev => prev.filter(n => n.id !== noteId));
            toastSuccess('Nota eliminada');
        } catch (err) {
            console.error("Note delete error", err);
            toastError("Error al eliminar nota");
        }
    };

    // Find current active objects for display
    const activeThread = threads.find(t => t.id === selectedThreadId);

    // Filter threads
    const filteredThreads = threads.filter(t => {
        // Search
        const matchesSearch = !searchQuery ||
            (t.contactName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                t.remotePhone.includes(searchQuery));

        if (!matchesSearch) return false;

        // Operative Tabs mapped exactly to backend states
        if (filter === 'ai') return t.handlingMode === 'ai' || t.handlingMode === 'copilot';
        if (filter === 'human_queue') return t.handlingMode === 'human_queue';
        if (filter === 'taken') return !!t.assignedUserId || t.handlingMode === 'human';
        if (filter === 'mine') return t.assignedUserId === currentUser.id;
        if (filter === 'closed') return t.status === 'CLOSED';
        if (filter === 'unassigned') return !t.assignedUserId;

        return true; 
    });

    return (
        <div className={`flex bg-[var(--bg-page)] text-[var(--text-strong)] overflow-hidden font-sans selection:bg-[var(--brand-primary)]/30 ${
            isFullScreen 
                ? 'h-screen w-screen border-none rounded-none' 
                : 'h-[calc(100vh-72px)] rounded-xl border border-[var(--border-default)] shadow-xl'
        }`}>

            {/* COLUMN 1: CHANNELS (Premium slim list) */}
            <aside className="w-[48px] bg-[var(--bg-card)] flex flex-col items-center py-3 gap-2 border-r border-[var(--border-default)] shrink-0 z-20 shadow-2xl">
                {/* Brand Icon */}
                <div className="w-8 h-8 rounded bg-[var(--brand-primary)] flex items-center justify-center mb-1 shadow-lg shadow-[var(--brand-primary)]/20 group transition-all active:scale-95 cursor-pointer">
                    <svg className="w-5 h-5 text-[var(--brand-primary-foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 12h.01M12 12h.01M16 12h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                </div>

                <div className="flex-1 w-full flex flex-col items-center gap-2 overflow-y-auto no-scrollbar px-1.5">
                    {channels.map(ch => (
                        <button
                            key={ch.id}
                            onClick={() => handleChannelSelect(ch.id)}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all relative group flex-shrink-0 ${selectedChannelId === ch.id ? 'bg-[var(--bg-input)] ring-1 ring-[var(--brand-primary)] shadow-lg shadow-[var(--brand-primary)]/10' : 'bg-[var(--bg-page)] hover:bg-[var(--bg-input)] border border-[var(--border-default)]'
                                }`}
                            title={ch.name || ch.displayPhone}
                        >
                            <span className={`text-[10px] font-black transition-colors ${selectedChannelId === ch.id ? 'text-[var(--brand-primary)]' : 'text-[var(--text-muted)]'}`}>
                                {(ch.name?.[0] || 'C').toUpperCase()}
                            </span>
                            {/* Status Dot */}
                            <div className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 border-[1.5px] border-[var(--bg-card)] rounded-full ${ch.status === 'CONNECTED' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        </button>
                    ))}
                </div>

                {/* Add channel button removed as requested */}

            </aside>

            {/* COLUMN 2: THREADS LIST */}
            <aside className="w-[250px] bg-[var(--bg-page)] border-r border-[var(--border-default)] flex flex-col shrink-0 relative z-10 shadow-xl">
                {/* Header for Thread List */}
                <div className="h-11 px-4 flex items-center gap-3 border-b border-[var(--border-default)] shrink-0 bg-[var(--bg-page)]/50 backdrop-blur-xl">
                    {isFullScreen && (
                        <button 
                            onClick={() => {
                                setSearchParams(prev => {
                                    prev.set('view', 'standard');
                                    return prev;
                                });
                            }}
                            className="p-1.5 hover:bg-[var(--bg-input)] rounded-lg transition-colors text-[var(--brand-primary)]"
                            title="Volver a vista normal"
                        >
                            <ArrowLeft size={18} />
                        </button>
                    )}
                    <h1 className={`${T.pageTitle} ${S.headingLg}`}>Threads</h1>
                    <div className="flex gap-1.5">
                    </div>
                </div>

                {/* Search Bar */}
                <div className="px-4 py-2 shrink-0">
                    <div className="bg-[var(--bg-input)] border border-[var(--border-default)] rounded-lg flex items-center px-2 py-1.5 group focus-within:border-[var(--brand-primary)]/50 transition-all shadow-inner">
                        <svg className="w-3 h-3 opacity-50 mr-2 group-focus-within:text-[var(--brand-primary)] transition-colors" style={{ color: 'var(--tx-inputText-color)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        <input
                            type="text"
                            placeholder="Buscar..."
                            className={`${T.inputText} ${S.body} bg-transparent border-none w-full focus:ring-0 placeholder:text-current `}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {/* Operative Filter Tabs */}
                <div className="px-4 py-1 flex flex-wrap gap-1.5 shrink-0 mb-2">
                    {[
                        { id: 'all', label: 'TODOS' },
                        { id: 'ai', label: 'IA ATENDIENDO' },
                        { id: 'human_queue', label: 'REQUIERE HUMANO' },
                        { id: 'taken', label: 'TOMADOS', roles: ['ADMIN', 'SUPERVISOR'] },
                        { id: 'mine', label: 'MÍOS' },
                        { id: 'unassigned', label: 'SIN ASIGNAR', roles: ['ADMIN', 'SUPERVISOR'] },
                        { id: 'closed', label: 'CERRADOS' },
                    ].filter(tab => !tab.roles || tab.roles.includes(currentUser.role)).map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setFilter(tab.id as any)}
                            className={`${T.buttonPrimaryText} ${S.meta} px-2 py-1 rounded-md transition-all whitespace-nowrap border ${filter === tab.id
 ? (tab.id === 'human_queue' ? 'bg-red-500  border-red-500 shadow-lg shadow-red-500/20' : 'bg-[var(--brand-primary)] border-[var(--brand-primary)] shadow-lg shadow-[var(--brand-primary)]/10')
 : 'bg-[var(--bg-input)] border-[var(--border-default)] hover:opacity-80 hover:bg-[var(--bg-surface)]'
 }`}
                            style={filter !== tab.id ? { color: 'var(--tx-buttonText-color)' } : undefined}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar px-3 pb-4">
                    {loadingThreads && threads.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-t-[var(--brand-primary)] border-transparent"></div>
                            <span className={`${T.helperText} ${S.meta} uppercase`}>Escaneando hilos...</span>
                        </div>
                    ) : filteredThreads.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center px-10">
                            <div className="w-16 h-16 rounded-full bg-[var(--bg-input)] flex items-center justify-center mb-4 border border-[var(--border-default)]">
                                <svg className="w-8 h-8 opacity-50" style={{ color: 'var(--tx-emptyStateTitle-color)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                            </div>
                            <span className={`${T.emptyStateTitle} ${S.body} italic`}>
                                No hay hilos {filter === 'all' ? '' : filter === 'mine' ? 'asignados a ti' : 'sin asignar'}
                            </span>
                        </div>
                    ) : (
                        filteredThreads.map(thread => (
                            <div
                                key={thread.id}
                                onClick={() => handleThreadSelect(thread.id)}
                                className={`flex items-center px-2 py-2 cursor-pointer rounded-lg transition-all mb-0.5 border group
                                    ${selectedThreadId === thread.id
                                        ? 'bg-[var(--brand-primary)]/10 border-[var(--brand-primary)]/20 shadow-lg'
                                        : 'border-transparent hover:bg-[var(--bg-input)] hover:border-[var(--border-default)]'
                                    }
                                `}
                            >
                                {/* Avatar */}
                                <div className="w-8 h-8 rounded-lg bg-[var(--bg-input)] border border-[var(--border-default)] flex-shrink-0 mr-2.5 overflow-hidden relative group-hover:border-[var(--brand-primary)] transition-all shadow-inner">
                                    <svg className="w-full h-full p-1.5 opacity-50" style={{ color: 'var(--tx-cardTitle-color)' }} fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
                                    {/* Assignment Badge */}
                                    {thread.assignedUserId ? (
                                        <div className="absolute top-0 right-0 w-3.5 h-3.5 bg-[var(--brand-primary)]  text-[7px] font-black border-2 border-[var(--bg-card)] rounded-full shadow-lg flex items-center justify-center" title="Asignado">
                                            {thread.assignedUserId === currentUser.id ? 'M' : 'A'}
                                        </div>
                                    ) : thread.handlingMode === 'human_queue' ? (
                                        <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 border-2 border-[var(--bg-card)] rounded-full shadow-lg animate-pulse" title="Requiere Humano"></div>
                                    ) : null}

                                    {/* Mode Indicator Overlay */}
                                    {(thread.handlingMode === 'ai' || thread.handlingMode === 'copilot') && (
                                        <div className={`absolute top-0 left-0 w-3 h-3 ${thread.aiPaused ? 'bg-amber-500' : 'bg-[var(--brand-primary)]'} border border-[var(--bg-card)] rounded-br-[4px] shadow-lg flex items-center justify-center`}>
                                            <svg className="w-2 h-2 text-[var(--brand-primary-foreground)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                        </div>
                                    )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                    <div className="flex justify-between items-baseline mb-0">
                                        <h3 className={`${T.cardTitle} ${S.body} truncate pr-1 transition-colors`} style={selectedThreadId === thread.id ? { color: 'var(--brand-primary)' } : undefined}>
                                            {thread.contactName || thread.remotePhone}
                                        </h3>
                                        <span className={`${T.helperText} ${S.meta} ${thread.unreadCount > 0 ? 'font-black' : ''}`} style={thread.unreadCount > 0 ? { color: 'var(--brand-primary)' } : undefined}>
                                            {new Date(thread.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <p className={`${T.helperText} ${S.meta} truncate flex-1 pr-2 italic`}>
                                            {thread.lastMessagePreview || ''}
                                        </p>
                                        {thread.unreadCount > 0 && (
                                            <span className="bg-[var(--ty-accent)] text-[var(--brand-primary-foreground)] text-[7px] font-black rounded-sm h-3 min-w-[12px] px-1 flex items-center justify-center shadow-lg shadow-[var(--brand-primary)]/20">
                                                {thread.unreadCount}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </aside>

            {/* COLUMN 3: CHAT CONTENT */}
            <main className="flex-1 bg-[var(--bg-page)] relative flex flex-col h-full z-0 transition-shadow">
                {activeThread ? (
                    <div className="h-full flex flex-col">
                        {/* Thread Toolbar (Assignment & Status) */}
                        <div className="h-9 bg-[var(--bg-card)]/90 backdrop-blur-xl px-4 border-b border-[var(--border-default)] flex items-center justify-between z-10 shrink-0">
                            <div className="flex items-center gap-3">
                                {activeThread.assignedUserId ? (
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-1.5 bg-[var(--brand-primary)]/10 px-2 py-1 rounded-lg border border-[var(--brand-primary)]/20 shadow-sm shadow-[var(--brand-primary)]/5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-[var(--ty-accent)] animate-pulse"></div>
                                            <span className={`${T.badgeText} ${S.meta} text-[var(--ty-accent)]`}>
                                                {activeThread.assignedUserId === currentUser.id ? 'ASIGNADO A MÍ' : 'ASIGNADO'}
                                            </span>
                                        </div>
                                        {(activeThread.assignedUserId === currentUser.id || ['SUPERVISOR', 'ADMIN'].includes(currentUser.role)) && (
                                            <button onClick={handleUnassign} className={`${T.buttonText} ${S.meta} text-red-500 hover:text-red-400`}>[ LIBERAR ]</button>
                                        )}
                                        {['SUPERVISOR', 'ADMIN'].includes(currentUser.role) && assignees.length > 0 && (
                                            <select
                                                onChange={(e) => {
                                                    if (e.target.value) handleAssignThread(e.target.value);
                                                    e.target.value = '';
                                                }}
                                                className="bg-[var(--bg-input)] border border-[var(--border-default)] text-[var(--text-strong)] text-[9px] rounded px-1 flex-1 py-1 uppercase tracking-tighter"
                                                defaultValue=""
                                            >
                                                <option value="" disabled>Reasignar...</option>
                                                {assignees.map(a => (
                                                    <option key={a.id} value={a.id}>{a.name || a.email}</option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleTakeThread}
                                            className={`${T.buttonPrimaryText} ${S.meta} bg-[var(--brand-primary)] hover:brightness-110 px-3 py-1.5 rounded transition-all active:scale-95 shadow-lg shadow-[var(--brand-primary)]/20`}
                                            title="Tomar la atención como agente resolutor"
                                        >
                                            Tomar Chat
                                        </button>
                                        {['SUPERVISOR', 'ADMIN'].includes(currentUser.role) && assignees.length > 0 && (
                                            <select
                                                onChange={(e) => {
                                                    if (e.target.value) handleAssignThread(e.target.value);
                                                    e.target.value = '';
                                                }}
                                                className="bg-[var(--bg-input)] border border-[var(--border-default)] text-[var(--text-muted)] text-[9px] rounded px-2 py-1 uppercase tracking-tighter w-28"
                                                defaultValue=""
                                            >
                                                <option value="" disabled>Asignar a...</option>
                                                {assignees.map(a => (
                                                    <option key={a.id} value={a.id}>{a.name || a.email}</option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                )}

                                <div className="w-px h-4 bg-[var(--border-default)] mx-1"></div>
                                
                                <ThreadHandlingModeBadge 
                                    mode={activeThread.handlingMode as any} 
                                    aiPaused={activeThread.aiPaused} 
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                {/* Botones de estado removidos por petición del usuario */}
                            </div>
                        </div>

                        {/* AI Paused Banner */}
                        {activeThread.aiPaused && (
                            <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-2 text-amber-500">
                                    <svg className="w-4 h-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                    <span className="text-[10px] font-black uppercase tracking-widest">IA Pausada para este chat — Atención Humana Activa</span>
                                </div>
                                <button 
                                     onClick={handleResumeAi}
                                     className={`${T.buttonText} ${S.meta} text-[#121208] bg-amber-500 hover:brightness-110 px-3 py-1.5 rounded transition-all active:scale-95`}
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
                                isNotesOpen={isNotesOpen}
                                onToggleNotes={() => setIsNotesOpen(!isNotesOpen)}
                                canReply={activeThread.assignedUserId === currentUser.id || ['SUPERVISOR', 'ADMIN'].includes(currentUser.role)}
                            />
                        </div>
                    </div>
                ) : (
                    /* Default Placeholder State */
                    <div className="h-full w-full bg-[var(--bg-page)] flex flex-col items-center justify-center text-center px-8 relative overflow-hidden">
                        {/* Background subtle decoration */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-[var(--brand-primary)]/5 rounded-full blur-[80px] pointer-events-none"></div>

                        <div className="mb-6 relative">
                            <div className="w-20 h-20 bg-[var(--bg-input)] rounded-xl border border-[var(--border-default)] flex items-center justify-center shadow-2xl rotate-2 hover:rotate-0 transition-transform duration-500">
                                <svg className="w-10 h-10 text-[var(--brand-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-[var(--brand-primary)] rounded-lg flex items-center justify-center animate-bounce shadow-xl">
                                <svg className="w-3 h-3 text-[var(--brand-primary-foreground)]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" /></svg>
                            </div>
                        </div>
                        <h1 className={`${T.emptyStateTitle} ${S.displayLg} italic mb-2 tracking-tighter uppercase`}>WABEE <span className="text-[var(--brand-primary)]">INBOX</span></h1>
                        <p className={`${T.emptyStateBody} ${S.body} mb-6 max-w-sm mx-auto`}>
                            Gestión multi-agente centralizada. Selecciona una conversación para iniciar.
                        </p>
                        <div className="flex items-center gap-2.5 py-2.5 px-4 bg-[var(--bg-input)] rounded-lg border border-[var(--border-default)] shadow-xl">
                            <div className="flex -space-x-2">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="w-6 h-6 rounded-full bg-[var(--brand-primary)]/10 border-2 border-[var(--bg-input)] flex items-center justify-center text-[8px] font-black text-[var(--brand-primary)]">A{i}</div>
                                ))}
                            </div>
                            <div className="w-px h-4 bg-[var(--border-default)]"></div>
                            <div className={`${T.helperText} ${S.ui} flex items-center gap-2`}>
                                <div className="w-1 h-1 rounded-full bg-green-500"></div>
                                Agentes listos
                            </div>
                        </div>
                    </div>
                )}

                {/* Optional Backdrop for Mobile/Click-outside */}
                {isNotesOpen && (
                    <div
                        className="absolute inset-0 z-20 bg-black/20 backdrop-blur-[1px] transition-opacity"
                        onClick={() => setIsNotesOpen(false)}
                    />
                )}
            </main>

            {/* COLUMN 4: INTERNAL NOTES */}
            <aside
                ref={notesSidebarRef}
                className={`fixed right-0 top-0 h-full w-[340px] bg-[var(--bg-surface)] border-l border-[var(--border-default)] shadow-2xl z-30 transition-transform duration-500 ease-in-out transform flex flex-col ${isNotesOpen ? 'translate-x-0' : 'translate-x-full'}`}
            >
                <div className="h-11 px-5 flex items-center justify-between border-b border-[var(--border-default)] shrink-0 bg-[var(--bg-surface)]/80 backdrop-blur-xl">
                    <h2 className={`${T.sectionTitle} ${S.headingMd} italic uppercase tracking-widest`}>Internal Notes</h2>
                    <button onClick={() => setIsNotesOpen(false)} className="p-1 transition-colors hover:scale-110" style={{ color: 'var(--tx-sectionTitle-color)' }}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="flex flex-col flex-1 overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
                        {notes.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center opacity-40 grayscale">
                                <svg className="w-12 h-12 mb-4" style={{ color: 'var(--tx-emptyStateTitle-color)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                <p className={`${T.emptyStateTitle} text-xs uppercase tracking-widest`}>Sin notas internas</p>
                            </div>
                        ) : (
                            notes.map(note => {
                                const isAiSuggestion = note.body.startsWith('[AI_SUGGESTION]');
                                const displayBody = isAiSuggestion ? note.body.replace('[AI_SUGGESTION]', '').trim() : note.body;
                                
                                return (
                                <div key={note.id} className={`${isAiSuggestion ? 'bg-purple-900/10 border-purple-500/30' : 'bg-[var(--bg-card)] border-[var(--border-default)]'} p-4 rounded-2xl border shadow-lg relative group overflow-hidden`}>
                                    <div className={`absolute top-0 left-0 w-1 h-full ${note.isPinned ? 'bg-[var(--brand-primary)]' : isAiSuggestion ? 'bg-purple-500' : 'bg-[var(--border-default)]'}`}></div>
                                    <div className="flex justify-between items-start mb-2 px-1">
                                        <div className="flex items-center gap-2">
                                            {isAiSuggestion ? (
                                                <div className="w-5 h-5 rounded bg-purple-500/20 text-purple-400 flex items-center justify-center text-[9px] font-black uppercase tracking-tighter">
                                                     <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                                </div>
                                            ) : (
                                                <div className="w-5 h-5 rounded bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] flex items-center justify-center text-[9px] font-black uppercase tracking-tighter">
                                                    {(note.authorName || 'US').substring(0, 2).toUpperCase()}
                                                </div>
                                            )}
                                            <span className={`${T.cardTitle} ${S.meta}`}>
                                                {isAiSuggestion ? 'Copiloto IA' : note.authorName || (note.createdById === currentUser.id ? 'Tú' : 'Sistema')}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`${T.helperText} ${S.meta} font-mono`}>{new Date(note.createdAt).toLocaleDateString()}</span>
                                            <button
                                                onClick={() => handlePinNote(note.id, note.isPinned)}
                                                className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--bg-input)]"
                                                title={note.isPinned ? "Desfijar" : "Fijar arriba"}
                                            >
                                                <svg className={`w-3.5 h-3.5 ${note.isPinned ? 'text-[var(--brand-primary)] fill-[var(--brand-primary)]' : 'text-[var(--text-muted)]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                                            </button>
                                            <button
                                                onClick={() => handleDeleteNote(note.id)}
                                                className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/10 text-red-500"
                                                title="Eliminar"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
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
                                            <span className={`${T.helperText} text-[9px] font-bold`}>— Registrado por equipo</span>
                                        </div>
                                    )}
                                </div>
                            )})
                        )}
                    </div>

                    <form onSubmit={handleAddNote} className="p-5 bg-[var(--bg-surface)] border-t border-[var(--border-default)] shrink-0">
                        <textarea
                            className={`${T.inputText} ${S.body} w-full bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl p-3 focus:ring-2 focus:ring-[var(--brand-primary)]/50 focus:border-[var(--brand-primary)] outline-none transition-all placeholder:text-[var(--text-muted)] resize-none font-medium custom-scrollbar`}
                            placeholder="Escribe un comentario privado..."
                            rows={3}
                            value={newNote}
                            onChange={(e) => setNewNote(e.target.value)}
                        />
                        <button
                            type="submit"
                            disabled={!newNote.trim()}
                            className={`${T.buttonPrimaryText} ${S.body} mt-3 w-full bg-[var(--brand-primary)] py-3 rounded-xl uppercase tracking-[0.2em] hover:brightness-110 disabled:opacity-30 disabled:grayscale transition-all shadow-xl shadow-[var(--brand-primary)]/10 active:scale-95 flex items-center justify-center gap-2`}
                        >
                            Fijar Nota
                        </button>
                    </form>
                </div>
            </aside>

        </div>
    );
}
