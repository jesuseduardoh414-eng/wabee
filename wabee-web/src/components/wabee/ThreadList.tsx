import { useNavigate } from 'react-router-dom';
import type { Thread } from '@/api/wabee/inbox.api';

interface Props {
    threads: Thread[];
}

export default function ThreadList({ threads }: Props) {
    const navigate = useNavigate();

    const formatTimestamp = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Ahora';
        if (diffMins < 60) return `${diffMins}m`;
        if (diffHours < 24) return `${diffHours}h`;
        if (diffDays < 7) return `${diffDays}d`;
        return date.toLocaleDateString();
    };

    const getStatusBadge = (status: string) => {
        const colors = {
            OPEN: 'bg-[var(--state-success)]/10 text-[var(--state-success)]',
            SNOOZED: 'bg-[var(--state-warning)]/10 text-[var(--state-warning)]',
            CLOSED: 'bg-[var(--bg-hover)] text-[var(--text-muted)]',
        };
        return colors[status as keyof typeof colors] || 'bg-[var(--bg-hover)] text-[var(--text-muted)]';
    };

    if (threads.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-[var(--text-muted)]">
                <svg
                    className="w-16 h-16 mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                </svg>
                <p className="text-lg font-medium">No hay conversaciones</p>
                <p className="text-sm">Las conversaciones aparecerán aquí</p>
            </div>
        );
    }

    return (
        <div className="divide-y divide-[var(--border-default)]">
            {threads.map((thread) => (
                <div
                    key={thread.id}
                    onClick={() => navigate(`/inbox/${thread.id}`)}
                    className="p-4 hover:bg-[var(--bg-hover)] cursor-pointer transition-colors"
                >
                    <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold text-[var(--text-strong)] truncate">
                                    {thread.contactName || thread.remotePhone}
                                </h4>
                                {thread.metadata?.lastMessageSource === 'campaign' && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-100/10 text-blue-400 border border-blue-500/30">
                                        Campaign
                                    </span>
                                )}
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${getStatusBadge(thread.status)}`}>
                                    {thread.status}
                                </span>
                            </div>
                            <p className="text-[10px] text-[var(--text-muted)]">{thread.remotePhone}</p>
                        </div>
                        <span className="text-[10px] text-[var(--text-muted)] ml-2 flex-shrink-0">
                            {formatTimestamp(thread.lastMessageAt)}
                        </span>
                    </div>

                    {thread.lastMessagePreview && (
                        <div className="flex items-center gap-2">
                            <p className="text-sm text-[var(--text-body)] truncate">
                                {thread.lastMessagePreview}
                            </p>
                        </div>
                    )}

                    {thread.unreadCount > 0 && (
                        <div className="mt-2 flex justify-end">
                            <span className="bg-primary-600  text-[10px] font-bold px-2 py-0.5 rounded-full">
                                {thread.unreadCount} mensajes nuevos
                            </span>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
