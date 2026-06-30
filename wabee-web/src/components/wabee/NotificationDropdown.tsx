import React, { useState, useEffect, useRef } from 'react';
import { Bell, CheckCircle, Info, AlertTriangle, ShieldAlert } from 'lucide-react';
import { NotificationSeverityIcon } from './NotificationSeverityIcon';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi, Notification } from '../../api/wabee/notifications.api';
import { useNavigate } from 'react-router-dom';
import { connectCampaignStream, RealtimeEventType } from '../../services/wabee/realtime.client';
import { T, S } from '@/lib/text-tokens';

export const NotificationDropdown = () => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    // Fetch notifications
    const { data: notifications = [] } = useQuery({
        queryKey: ['wabee-notifications'],
        queryFn: notificationsApi.getNotifications,
        enabled: !!localStorage.getItem('wabee_orgId'),
        refetchInterval: 10000 // Polling fallback cada 10 segundos
    });

    // Mutations
    const markAsReadMutation = useMutation({
        mutationFn: notificationsApi.markAsRead,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wabee-notifications'] })
    });

    const markAllAsReadMutation = useMutation({
        mutationFn: notificationsApi.markAllAsRead,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wabee-notifications'] })
    });

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Listen to realtime notifications
    useEffect(() => {
        const handleEvent = (event: RealtimeEventType) => {
            if (event.type === 'new_notification') {
                queryClient.invalidateQueries({ queryKey: ['wabee-notifications'] });
            }
        };

        const stream = connectCampaignStream(handleEvent, { maxRetries: 3 });
        return () => stream.close();
    }, [queryClient]);

    const unreadCount = notifications.filter(n => !n.isRead).length;

    return (
        <div className="relative" ref={dropdownRef}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                className="relative cursor-pointer hover:text-[var(--brand-primary)] transition-all p-1 bg-[var(--bg-card)] border border-[var(--border-default)] rounded flex items-center justify-center min-w-[32px] min-h-[32px]"
            >
                <Bell size={14} className={unreadCount > 0 ? 'text-[var(--brand-primary)]' : 'text-[var(--text-muted)]'} />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-[var(--bg-card)] flex items-center justify-center animate-pulse shadow-sm">
                        <span className="text-[7px] text-white font-bold">{unreadCount > 9 ? '9+' : unreadCount}</span>
                    </span>
                )}
            </div>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-2xl shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
                    <div className="flex justify-between items-center p-3 border-b border-[var(--border-default)] bg-[var(--bg-card)]">
                        <h3 className={`${T.sectionTitle} ${S.meta}`}>Notificaciones</h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={() => markAllAsReadMutation.mutate()}
                                className={`${T.buttonText} ${S.ui} text-[var(--brand-primary)] hover:brightness-110 transition-colors cursor-pointer`}
                            >
                                Marcar todas leídas
                            </button>
                        )}
                    </div>

                    <div className="max-h-80 overflow-y-auto custom-scrollbar">
                        {notifications.length === 0 ? (
                            <div className="p-4 text-center">
                                <span className={`${T.helperText} ${S.meta} uppercase opacity-70`}>No tienes notificaciones nuevas.</span>
                            </div>
                        ) : (
                            notifications.map((notif: Notification) => (
                                <div
                                    key={notif.id}
                                    className={`p-3 border-b border-[var(--border-default)] last:border-0 hover:bg-[var(--bg-hover)] transition-colors cursor-pointer ${notif.isRead ? 'opacity-60' : 'bg-[var(--bg-elevated)]'}`}
                                    onClick={() => {
                                        if (!notif.isRead) markAsReadMutation.mutate(notif.id);
                                    }}
                                >
                                    <div className="flex gap-3 items-start">
                                        <div className="mt-1">
                                            <NotificationSeverityIcon type={notif.type} severity={notif.severity} size={14} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`${T.cardTitle} ${S.body} ${notif.isRead ? 'opacity-80' : ''}`} style={!notif.isRead ? { color: 'var(--brand-primary)' } : undefined}>
                                                {notif.title}
                                            </p>
                                            <p className={`${T.messageText} ${S.meta} line-clamp-2 mt-0.5 ${notif.isRead ? 'opacity-80' : ''}`}>
                                                {notif.message}
                                            </p>
                                            <p className={`${T.helperText} ${S.ui} mt-1`}>
                                                {new Date(notif.createdAt).toLocaleString()}
                                            </p>
                                        </div>
                                        {!notif.isRead && (
                                            <div className={`w-2 h-2 rounded-full bg-[var(--brand-primary)] mt-1 shrink-0 ${T.buttonPrimaryText}`}></div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="p-2 border-t border-[var(--border-default)] bg-[var(--bg-card)]">
                        <button
                            className={`${T.buttonText} ${S.ui} w-full text-center hover:brightness-110 py-1 transition-colors`}
                            style={{ color: 'var(--brand-primary)' }}
                            onClick={() => {
                                setIsOpen(false);
                                navigate('/dashboard/wabee/notifications');
                            }}
                        >
                            Ver Centro de Notificaciones
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
