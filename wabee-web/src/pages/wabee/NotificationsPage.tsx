import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi, Notification } from '@/api/wabee/notifications.api';
import { Bell, CheckCircle, Trash2, Info, AlertTriangle, ShieldAlert } from 'lucide-react';
import { NotificationSeverityIcon } from '@/components/wabee/NotificationSeverityIcon';
import { T, S } from '@/lib/text-tokens';

export default function NotificationsPage() {
    const queryClient = useQueryClient();

    const { data: notifications = [], isLoading } = useQuery({
        queryKey: ['wabee-notifications'],
        queryFn: notificationsApi.getNotifications,
        refetchInterval: 10000
    });

    const markAsReadMutation = useMutation({
        mutationFn: notificationsApi.markAsRead,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wabee-notifications'] })
    });

    const markAllAsReadMutation = useMutation({
        mutationFn: notificationsApi.markAllAsRead,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wabee-notifications'] })
    });

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--bg-card)] border border-[var(--border-default)] p-6 rounded-3xl shadow-xl">
                <div>
                    <h1 className={`${T.pageTitle} ${S.displaySm} flex items-center gap-3`}>
                        <Bell className="text-[var(--brand-primary)]" size={32} />
                        Centro de Notificaciones
                    </h1>
                    <p className={`${T.helperText} ${S.meta} mt-1 uppercase tracking-widest`}>
                        Gestiona tus alertas del sistema WABEE
                    </p>
                </div>
                <div>
                    <button
                        onClick={() => markAllAsReadMutation.mutate()}
                        className={`${T.buttonPrimaryText} ${S.meta} flex items-center gap-2 bg-[var(--brand-primary)] px-4 py-2 rounded-xl uppercase hover:scale-105 transition-transform`}
                    >
                        <CheckCircle size={14} />
                        Marcar todas leídas
                    </button>
                </div>
            </div>

            <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-3xl p-6 shadow-2xl">
                {isLoading ? (
                    <div className="flex justify-center py-20">
                        <div className="w-8 h-8 border-4 border-[var(--brand-primary)] border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 opacity-40 grayscale">
                        <Bell size={48} className="mb-4" style={{ color: 'var(--tx-emptyStateTitle-color)' }} />
                        <p className={`${T.emptyStateTitle} ${S.body}`}>No tienes notificaciones</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {notifications.map((notif: Notification) => (
                            <div
                                key={notif.id}
                                className={`flex items-start gap-4 p-4 rounded-2xl border ${notif.isRead ? 'bg-[var(--bg-surface)] border-[var(--border-default)] opacity-60' : 'bg-[var(--bg-elevated)] border-[var(--brand-primary)]/30'} transition-all hover:border-[var(--brand-primary)]/50`}
                            >
                                <div className="mt-1 bg-[var(--bg-input)] p-3 rounded-xl border border-[var(--border-default)]">
                                    <NotificationSeverityIcon type={notif.type} severity={notif.severity} size={24} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start">
                                        <h3 className={`${T.cardTitle} ${S.body} ${notif.isRead ? 'opacity-80' : ''}`} style={!notif.isRead ? { color: 'var(--brand-primary)' } : undefined}>
                                            {notif.title}
                                        </h3>
                                        <span className={`${T.helperText} ${S.meta} shrink-0 ml-4`}>
                                            {new Date(notif.createdAt).toLocaleString()}
                                        </span>
                                    </div>
                                    <p className={`${T.messageText} ${S.body} mt-1 ${notif.isRead ? 'opacity-80' : ''}`}>
                                        {notif.message}
                                    </p>

                                    {!notif.isRead && (
                                        <button
                                            onClick={() => markAsReadMutation.mutate(notif.id)}
                                            className={`${T.buttonPrimaryText} ${S.ui} mt-3 text-[var(--brand-primary)] border border-[var(--brand-primary)]/30 px-3 py-1 rounded-lg hover:bg-[var(--brand-primary)] hover: transition-colors`}
                                        >
                                            Marcar leída
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
