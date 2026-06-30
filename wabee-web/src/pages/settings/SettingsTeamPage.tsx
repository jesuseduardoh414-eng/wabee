import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Users as UsersIcon,
    UserPlus,
    Mail,
    Shield,
    Trash2,
    Clock,
    CheckCircle,
    Loader2,
    ShieldAlert,
    Smartphone,
    MoreVertical,
    UserX,
    UserCheck,
    Eye,
    AlertTriangle,
} from 'lucide-react';
import client from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useDialog } from '../../context/DialogContext';
import { ImpersonationStore } from '../../lib/impersonation.store';
import { T, S } from '@/lib/text-tokens';
import { usePlanEnforcement } from '../../hooks/usePlanEnforcement';

interface Member {
    userId: string;
    name: string;
    email: string;
    avatar?: string;
    role: string;
    twoFactorEnabled: boolean;
    status: 'ACTIVE' | 'SUSPENDED' | 'INVITED' | 'REMOVED';
    joinedAt: string;
}

const StatusDot: React.FC<{ status: Member['status'] }> = ({ status }) => {
    const map = {
        ACTIVE: { cls: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]', label: 'ACTIVO', text: 'text-emerald-500' },
        SUSPENDED: { cls: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]', label: 'SUSPENDIDO', text: 'text-red-500' },
        INVITED: { cls: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]', label: 'INVITADO', text: 'text-amber-500' },
        REMOVED: { cls: 'bg-[var(--border-default)]', label: 'REMOVIDO', text: 'text-[var(--text-muted)]' },
    };
    const normalizedStatus = (status || '').toUpperCase() as keyof typeof map;
    const conf = map[normalizedStatus] || map.ACTIVE;
    return (
        <span className={`flex items-center gap-2 ${S.meta} font-bold uppercase tracking-[2px] ${conf.text}`}>
            <span className={`h-2 w-2 rounded-full ${conf.cls}`} />
            {conf.label}
        </span>
    );
};

interface RowActionsProps {
    member: Member;
    currentUserId: string;
    onSuspend: (m: Member) => void;
    onReactivate: (m: Member) => void;
    onImpersonate: (m: Member) => void;
    loadingId: string | null;
}

const RowActions: React.FC<RowActionsProps> = ({
    member, currentUserId, onSuspend, onReactivate, onImpersonate, loadingId,
}) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const isSelf = member.userId === currentUserId;
    const isLoading = loadingId === member.userId;
    const status = (member.status || '').toUpperCase();
    const canSuspend = !isSelf && status === 'ACTIVE';
    const canReactivate = status === 'SUSPENDED';
    const canImpersonate = !isSelf && status === 'ACTIVE';

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setOpen(!open)}
                disabled={isLoading}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-transparent text-[var(--tx-buttonText-color)] transition-all hover:border-[var(--brand-primary)] hover:bg-[var(--bg-hover)] hover:text-[var(--brand-primary)] disabled:opacity-50"
                title="Acciones"
            >
                {isLoading ? <Loader2 size={18} className="animate-spin text-[var(--brand-primary)]" /> : <MoreVertical size={18} />}
            </button>

            {open && (
                <div className="absolute right-0 top-12 z-50 w-60 overflow-hidden rounded-[1.5rem] border border-[var(--border-default)] bg-[var(--bg-elevated)] py-3 shadow-2xl">
                    <div className="mb-2 border-b border-[var(--border-default)] bg-[var(--bg-card)] px-5 py-3">
                        <p className={`${T.tableHeader} ${S.meta} truncate`}>{member.name}</p>
                    </div>

                    <div className="space-y-1 px-2">
                        {canSuspend && (
                            <button
                                onClick={() => { setOpen(false); onSuspend(member); }}
                                className={`w-full rounded-xl px-4 py-3 text-left ${S.meta} font-bold uppercase tracking-widest text-red-500 transition-all hover:bg-red-500/10`}
                            >
                                <span className="flex items-center gap-3">
                                    <UserX size={16} />
                                    Suspender acceso
                                </span>
                            </button>
                        )}

                        {canReactivate && (
                            <button
                                onClick={() => { setOpen(false); onReactivate(member); }}
                                className={`w-full rounded-xl px-4 py-3 text-left ${S.meta} font-bold uppercase tracking-widest text-emerald-500 transition-all hover:bg-emerald-500/10`}
                            >
                                <span className="flex items-center gap-3">
                                    <UserCheck size={16} />
                                    Reactivar acceso
                                </span>
                            </button>
                        )}

                        {canImpersonate && (
                            <button
                                onClick={() => { setOpen(false); onImpersonate(member); }}
                                className={`w-full rounded-xl px-4 py-3 text-left ${T.buttonText} ${S.meta} text-[var(--brand-primary)] transition-all hover:bg-[var(--bg-hover)]`}
                            >
                                <span className="flex items-center gap-3">
                                    <Eye size={16} />
                                    Suplantar usuario
                                </span>
                            </button>
                        )}

                        {!canSuspend && !canReactivate && !canImpersonate && (
                            <div className="px-4 py-3">
                                <p className={`${T.helperText} ${S.meta} italic`}>
                                    {isSelf ? 'No puedes actuar sobre ti mismo' : 'Sin acciones disponibles'}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

interface SuspendModalProps {
    member: Member | null;
    onConfirm: (reason: string) => void;
    onClose: () => void;
    isLoading: boolean;
}

const SuspendModal: React.FC<SuspendModalProps> = ({ member, onConfirm, onClose, isLoading }) => {
    const [reason, setReason] = useState('');
    if (!member) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 animate-in fade-in duration-300 sm:items-center sm:p-4">
            <div className="absolute inset-0 bg-[var(--bg-page)] opacity-80 backdrop-blur-md" onClick={onClose} />
            <div className="relative w-full rounded-t-[2rem] border border-[var(--border-default)] bg-[var(--bg-card)] px-6 py-8 text-center shadow-2xl sm:max-w-md sm:rounded-[3rem] sm:p-12">
                <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-red-500 opacity-5 blur-[80px]" />

                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-[1.5rem] border border-red-500 border-opacity-20 bg-red-500 bg-opacity-10 shadow-inner sm:h-20 sm:w-20 sm:rounded-[2rem]">
                    <UserX size={30} className="text-red-500" />
                </div>

                <h3 className={`${T.sectionTitle} ${S.headingLg} mb-3`}>Suspender <span className="text-red-500">miembro</span></h3>
                <p className={`${T.helperText} ${S.body} mb-8 opacity-60`}>
                    <span className="font-bold">{member.name}</span> perderá el acceso a la plataforma inmediatamente. Podrás reactivarlo más tarde.
                </p>

                <div className="mb-8 space-y-3 text-left">
                    <label className={`${T.labelText} ${S.meta} ml-4 text-[var(--brand-primary)]`}>
                        Motivo (opcional)
                    </label>
                    <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Ej: Baja voluntaria, falta de actividad..."
                        rows={3}
                        className={`w-full resize-none rounded-[1.5rem] border border-[var(--border-default)] bg-[var(--bg-input)] p-5 text-sm ${T.inputText} shadow-inner outline-none transition-all focus:border-[var(--brand-primary)]`}
                    />
                </div>

                <div className="flex flex-col gap-4 sm:flex-row">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isLoading}
                        className={`flex-1 rounded-[1.25rem] border border-[var(--border-default)] bg-[var(--bg-elevated)] py-4 ${T.buttonText} ${S.body} transition-all hover:border-[var(--brand-primary)] disabled:opacity-50`}
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={() => onConfirm(reason)}
                        disabled={isLoading}
                        className={`flex flex-[2] items-center justify-center gap-2 rounded-2xl bg-[var(--state-danger)] py-4 text-white ${T.buttonText} ${S.ui} transition-all disabled:opacity-50`}
                    >
                        {isLoading && <Loader2 size={14} className="animate-spin" />}
                        Suspender ahora
                    </button>
                </div>
            </div>
        </div>
    );
};

function MemberCard({
    member, currentUserId, isAdmin, actionLoadingId, onSuspend, onReactivate, onImpersonate,
}: {
    member: Member;
    currentUserId: string;
    isAdmin: boolean;
    actionLoadingId: string | null;
    onSuspend: (m: Member) => void;
    onReactivate: (m: Member) => void;
    onImpersonate: (m: Member) => void;
}) {
    return (
        <div className={`rounded-[1.75rem] border border-[var(--border-default)] bg-[var(--bg-elevated)]/40 p-4 ${member.status?.toUpperCase() === 'SUSPENDED' ? 'bg-red-500/5' : ''}`}>
            <div className="flex items-start gap-4">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[1rem] border border-[var(--border-default)] bg-[var(--bg-elevated)] shadow-inner">
                    <img
                        src={member.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=ead018&color=121208`}
                        alt="Avatar"
                        className="h-full w-full object-cover"
                    />
                    {member.userId === currentUserId && (
                        <span className="absolute -right-1 -top-1 h-4 w-4 rounded-full border-2 border-[var(--bg-page)] bg-[var(--brand-primary)] shadow-lg" />
                    )}
                </div>
                <div className="min-w-0 flex-1">
                    <p className={`${T.tableCell} ${S.body} truncate font-bold`}>
                        {member.name}
                        {member.userId === currentUserId && <span className="ml-2 text-[10px] text-[var(--ty-accent)] opacity-60">(Tú)</span>}
                    </p>
                    <p className={`${T.helperText} ${S.meta} mt-0.5 truncate`}>{member.email}</p>
                </div>
                {isAdmin && (
                    <div className="shrink-0">
                        <RowActions
                            member={member}
                            currentUserId={currentUserId}
                            onSuspend={onSuspend}
                            onReactivate={onReactivate}
                            onImpersonate={onImpersonate}
                            loadingId={actionLoadingId}
                        />
                    </div>
                )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                    <p className={`${T.kpiLabel} ${S.meta} mb-1`}>Rol / nivel</p>
                    {member.role === 'ADMIN' || member.role === 'SUPER_ADMIN' ? (
                        <span
                            style={{ backgroundColor: 'color-mix(in srgb, var(--brand-primary) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--brand-primary) 20%, transparent)' }}
                            className="inline-flex items-center rounded-xl border px-3 py-1.5 text-[0.7rem] font-bold uppercase tracking-wider text-[var(--brand-primary)]"
                        >
                            <Shield size={13} className="mr-2" />
                            {member.role}
                        </span>
                    ) : (
                        <span className={`inline-flex items-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-1.5 ${T.statusText}`}>
                            <Shield size={13} className="mr-2" />
                            {member.role}
                        </span>
                    )}
                </div>
                <div>
                    <p className={`${T.kpiLabel} ${S.meta} mb-1`}>Estado</p>
                    <StatusDot status={member.status} />
                </div>
                <div>
                    <p className={`${T.kpiLabel} ${S.meta} mb-1`}>Seguridad</p>
                    <span className={`${T.statusText} flex items-center gap-2 ${member.twoFactorEnabled ? 'text-emerald-500' : 'opacity-80'}`}>
                        {member.twoFactorEnabled ? <CheckCircle size={16} /> : <ShieldAlert size={16} />}
                        {member.twoFactorEnabled ? '2FA activo' : 'Sin 2FA'}
                    </span>
                </div>
                <div>
                    <p className={`${T.kpiLabel} ${S.meta} mb-1`}>Ingreso</p>
                    <p className={`${T.tableCell} ${S.meta} opacity-70`}>
                        {new Date(member.joinedAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                </div>
            </div>
        </div>
    );
}

export const SettingsTeamPage = () => {
    const queryClient = useQueryClient();
    const { error: toastError, success: toastSuccess } = useToast();
    const { confirm } = useDialog();

    const orgId = localStorage.getItem('wabee_orgId') || '';
    const role = (localStorage.getItem('wabee_role') || '').toUpperCase();
    const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';
    const currentUserId = (() => {
        try { return JSON.parse(localStorage.getItem('wabee_user') || '{}').id || ''; }
        catch { return ''; }
    })();

    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [newInvite, setNewInvite] = useState({ email: '', role: 'AGENT' });
    const [suspendTarget, setSuspendTarget] = useState<Member | null>(null);
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

    const { hasReachedLimit, getLimitValue, summary, isLoading: loadingPlan } = usePlanEnforcement();
    const totalUsersLimitRaw = getLimitValue('users');
    const isUnlimitedUsersPlan = totalUsersLimitRaw === -1 || summary?.plan?.code === 'TRIAL';
    const totalUsersLimit = isUnlimitedUsersPlan ? -1 : totalUsersLimitRaw;
    const isUsersBlocked = isUnlimitedUsersPlan ? false : hasReachedLimit('users');
    const currentUsersUsage = summary?.usage?.users || 0;
    const usageLabel = loadingPlan
        ? 'cargando...'
        : totalUsersLimit === -1
            ? `${currentUsersUsage}/Ilimitado`
            : totalUsersLimit === null
                ? `${currentUsersUsage}/--`
                : `${currentUsersUsage}/${totalUsersLimit}`;

    const { data: membersData, isLoading: loadingMembers } = useQuery({
        queryKey: ['org', 'members', orgId],
        queryFn: async () => {
            const { data } = await client.get(`/orgs/${orgId}/members`, { params: { limit: 100 } });
            return data;
        },
        enabled: !!orgId,
    });

    const { data: invitations = [], isLoading: loadingInvites } = useQuery<any[]>({
        queryKey: ['org', 'invites', orgId],
        queryFn: async () => {
            const { data } = await client.get(`/orgs/${orgId}/invitations`);
            return data;
        },
        enabled: !!orgId,
    });

    const members: Member[] = membersData?.items || [];

    const inviteMutation = useMutation({
        mutationFn: (payload: any) => client.post(`/orgs/${orgId}/invitations`, payload),
        onSuccess: () => {
            toastSuccess('Invitación enviada correctamente');
            setIsInviteModalOpen(false);
            setNewInvite({ email: '', role: 'AGENT' });
            queryClient.invalidateQueries({ queryKey: ['org', 'invites', orgId] });
        },
        onError: (err: any) => toastError(err.response?.data?.error?.message || 'Error al enviar invitación'),
    });

    const revokeMutation = useMutation({
        mutationFn: (id: string) => client.delete(`/orgs/${orgId}/invitations/${id}`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['org', 'invites', orgId] }),
        onError: () => toastError('Error al revocar invitación'),
    });

    const suspendMutation = useMutation({
        mutationFn: ({ userId, reason }: { userId: string; reason: string }) =>
            client.post(`/orgs/${orgId}/members/${userId}/suspend`, { reason }),
        onSuccess: () => {
            toastSuccess('Miembro suspendido correctamente');
            queryClient.invalidateQueries({ queryKey: ['org', 'members', orgId] });
        },
        onError: (err: any) => toastError(err.response?.data?.error?.message || 'Error al suspender al miembro'),
        onSettled: () => setActionLoadingId(null),
    });

    const reactivateMutation = useMutation({
        mutationFn: (userId: string) => client.post(`/orgs/${orgId}/members/${userId}/reactivate`),
        onSuccess: () => {
            toastSuccess('Miembro reactivado correctamente');
            queryClient.invalidateQueries({ queryKey: ['org', 'members', orgId] });
        },
        onError: (err: any) => toastError(err.response?.data?.error?.message || 'Error al reactivar al miembro'),
        onSettled: () => setActionLoadingId(null),
    });

    const impersonateMutation = useMutation({
        mutationFn: (userId: string) => client.post(`/orgs/${orgId}/members/${userId}/impersonate`, { reason: 'Revisión administrativa' }),
        onSuccess: (res, userId) => {
            const { impersonateToken } = res.data;
            const target = members.find((m) => m.userId === userId);
            ImpersonationStore.start({
                realUser: localStorage.getItem('wabee_user') || null,
                realRole: localStorage.getItem('wabee_role') || null,
                impersonationToken: impersonateToken,
                targetUserId: userId,
                targetUserName: target?.name || userId,
                targetRole: target?.role || 'AGENT',
                targetUser: {
                    id: userId,
                    name: target?.name || userId,
                    email: target?.email || '',
                    avatar: target?.avatar || '',
                },
                orgId,
            });
            toastSuccess(`Suplantando a ${target?.name || userId}...`);
            setTimeout(() => window.location.reload(), 800);
        },
        onError: (err: any) => toastError(err.response?.data?.error?.message || 'Error al iniciar suplantación'),
        onSettled: () => setActionLoadingId(null),
    });

    const handleSuspendConfirm = (reason: string) => {
        if (!suspendTarget) return;
        setActionLoadingId(suspendTarget.userId);
        suspendMutation.mutate({ userId: suspendTarget.userId, reason });
        setSuspendTarget(null);
    };

    const handleReactivate = async (member: Member) => {
        const ok = await confirm({
            title: 'Reactivar acceso',
            description: `¿Reactivar a ${member.name}? Recuperará acceso inmediato a la plataforma.`,
            confirmText: 'Reactivar',
        });
        if (!ok) return;
        setActionLoadingId(member.userId);
        reactivateMutation.mutate(member.userId);
    };

    const handleImpersonate = async (member: Member) => {
        const ok = await confirm({
            title: 'Suplantar usuario',
            description: (
                <div className="space-y-3">
                    <p>Navegarás como <strong>{member.name}</strong>.</p>
                    <div className="flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3">
                        <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-400" />
                        <p className="text-xs text-amber-300">Todas las acciones quedan auditadas con tu identidad real de administrador.</p>
                    </div>
                </div>
            ),
            confirmText: 'Iniciar suplantación',
        });
        if (!ok) return;
        setActionLoadingId(member.userId);
        impersonateMutation.mutate(member.userId);
    };

    const handleRevoke = async (id: string) => {
        const ok = await confirm({
            title: 'Revocar invitación',
            description: '¿Revocar esta invitación pendiente?',
            isDestructive: true,
            confirmText: 'Revocar',
        });
        if (!ok) return;
        revokeMutation.mutate(id);
    };

    return (
        <div className="space-y-6 px-4 py-5 animate-in fade-in duration-500 sm:space-y-8 sm:px-6 sm:py-6">
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                <div className="max-w-2xl">
                    <h1 className={`${T.pageTitle} ${S.displayMd}`}>Equipo de <span className="text-[var(--ty-accent)]">Trabajo</span></h1>
                    <p className={`${T.pageSubtitle} ${S.body}`}>Gestiona los accesos, roles y niveles de seguridad de tus colaboradores.</p>
                </div>
                {isAdmin && (
                    <div className="flex w-full flex-col gap-3 md:w-auto md:items-end">
                        <button
                            onClick={() => !isUsersBlocked && setIsInviteModalOpen(true)}
                            disabled={isUsersBlocked}
                            className={`flex w-full items-center justify-center gap-3 rounded-[1.5rem] bg-[var(--brand-primary)] px-6 py-4 ${T.buttonPrimaryText} ${S.body} shadow-lg transition-all md:w-auto md:min-w-[220px] ${
                                isUsersBlocked ? 'cursor-not-allowed grayscale opacity-50' : 'hover:scale-[1.02] active:scale-[0.98]'
                            }`}
                        >
                            <UserPlus size={20} />
                            Invitar nuevo
                        </button>

                        <div className={`flex flex-wrap items-center gap-2 ${S.meta} font-bold tracking-wider md:justify-end ${isUsersBlocked ? 'text-red-400' : 'text-[var(--brand-primary)] opacity-70'}`}>
                            <UsersIcon size={14} />
                            USO DEL PLAN: {usageLabel}
                            {isUsersBlocked && (
                                <span className="rounded-md border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[10px] text-red-500">
                                    LÍMITE ALCANZADO
                                </span>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <div className="group relative flex items-center gap-5 overflow-hidden rounded-[2rem] border border-[var(--border-default)] bg-[var(--bg-card)] p-6 transition-all hover:border-[var(--brand-primary)] sm:p-8">
                    <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-[var(--brand-primary)] opacity-5 blur-[40px]" />
                    <div
                        style={{ backgroundColor: 'color-mix(in srgb, var(--brand-primary) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--brand-primary) 20%, transparent)' }}
                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border text-[var(--brand-primary)] shadow-inner transition-transform duration-500 group-hover:scale-110"
                    >
                        <UsersIcon size={28} />
                    </div>
                    <div>
                        <p className={`${T.kpiLabel} ${S.meta}`}>Activos</p>
                        <p className={`${T.kpiValue} ${S.displaySm} mt-1`}>{members.filter((m) => m.status === 'ACTIVE').length}</p>
                    </div>
                </div>

                <div className="group relative flex items-center gap-5 overflow-hidden rounded-[2rem] border border-[var(--border-default)] bg-[var(--bg-card)] p-6 transition-all hover:border-orange-500 sm:p-8">
                    <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-orange-500 opacity-5 blur-[40px]" />
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-orange-500 border-opacity-20 bg-orange-500 bg-opacity-10 text-orange-400 shadow-inner transition-transform duration-500 group-hover:scale-110">
                        <Mail size={28} />
                    </div>
                    <div>
                        <p className={`${T.kpiLabel} ${S.meta}`}>Invitaciones</p>
                        <p className={`${T.kpiValue} ${S.displaySm} mt-1`}>{invitations.length}</p>
                    </div>
                </div>

                <div className="group relative flex items-center gap-5 overflow-hidden rounded-[2rem] border border-[var(--border-default)] bg-[var(--bg-card)] p-6 transition-all hover:border-green-500 sm:p-8">
                    <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-green-500 opacity-5 blur-[40px]" />
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-green-500 border-opacity-20 bg-green-500 bg-opacity-10 text-green-400 shadow-inner transition-transform duration-500 group-hover:scale-110">
                        <Smartphone size={28} />
                    </div>
                    <div>
                        <p className={`${T.kpiLabel} ${S.meta}`}>Con 2FA</p>
                        <p className={`${T.kpiValue} ${S.displaySm} mt-1`}>{members.filter((m) => m.twoFactorEnabled).length}</p>
                    </div>
                </div>
            </div>

            <div className="relative overflow-hidden rounded-[2rem] border border-[var(--border-default)] bg-[var(--bg-card)] shadow-2xl sm:rounded-[3rem]">
                <div className="absolute right-0 top-0 h-80 w-80 rounded-full bg-[var(--brand-primary)] opacity-5 blur-[100px] pointer-events-none" />
                <div className="flex flex-col gap-3 border-b border-[var(--border-default)] bg-[var(--bg-surface)] bg-opacity-50 px-5 py-5 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-6">
                    <h3 className={`${T.cardTitle} ${S.meta}`}>Colaboradores</h3>
                    <div className="flex items-center gap-3 self-start rounded-full border border-green-500 border-opacity-20 bg-green-500 bg-opacity-10 px-4 py-2 sm:self-auto">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                        <span className={`${S.meta} font-bold uppercase tracking-widest text-green-500 opacity-80`}>Sincronizado</span>
                    </div>
                </div>

                {loadingMembers ? (
                    <div className="py-24 text-center">
                        <Loader2 className="mx-auto mb-6 animate-spin text-[var(--brand-primary)]" size={40} />
                        <p className={`${T.helperText} ${S.meta}`}>Sincronizando equipo...</p>
                    </div>
                ) : members.length === 0 ? (
                    <div className="px-5 py-12 text-center sm:px-8">
                        <p className={`${T.helperText} ${S.body} opacity-60`}>No hay colaboradores registrados todavía.</p>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 gap-4 p-4 sm:p-5 lg:hidden">
                            {members.map((member) => (
                                <MemberCard
                                    key={member.userId}
                                    member={member}
                                    currentUserId={currentUserId}
                                    isAdmin={isAdmin}
                                    actionLoadingId={actionLoadingId}
                                    onSuspend={setSuspendTarget}
                                    onReactivate={handleReactivate}
                                    onImpersonate={handleImpersonate}
                                />
                            ))}
                        </div>

                        <div className="hidden overflow-x-auto lg:block">
                            <table className="w-full min-w-[980px] border-collapse">
                                <thead>
                                    <tr className={`${T.tableHeader} ${S.meta} border-b border-[var(--border-default)] bg-[var(--bg-elevated)]`}>
                                        <th className="px-10 py-6 text-left">Usuario</th>
                                        <th className="px-10 py-6 text-left">Rol / Nivel</th>
                                        <th className="px-10 py-6 text-left">Estado</th>
                                        <th className="px-10 py-6 text-left">Seguridad</th>
                                        <th className="px-10 py-6 text-left">Ingreso</th>
                                        <th className="px-10 py-6 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border-default)]">
                                    {members.map((member) => (
                                        <tr key={member.userId} className={`group transition-all duration-500 hover:bg-[var(--bg-hover)] ${member.status?.toUpperCase() === 'SUSPENDED' ? 'bg-red-500/5' : ''}`}>
                                            <td className="px-10 py-6">
                                                <div className="flex items-center gap-5">
                                                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[1.25rem] border border-[var(--border-default)] bg-[var(--bg-elevated)] shadow-inner transition-transform duration-500 group-hover:scale-105">
                                                        <img
                                                            src={member.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=ead018&color=121208`}
                                                            alt="Avatar"
                                                            className="h-full w-full object-cover"
                                                        />
                                                        {member.userId === currentUserId && (
                                                            <span className="absolute -right-1 -top-1 h-4 w-4 rounded-full border-2 border-[var(--bg-page)] bg-[var(--brand-primary)] shadow-lg" />
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className={`${T.tableCell} ${S.body} truncate font-bold transition-colors group-hover:text-[var(--brand-primary)]`}>
                                                            {member.name}
                                                            {member.userId === currentUserId && <span className="ml-2 text-[10px] text-[var(--ty-accent)] opacity-60">(Tú)</span>}
                                                        </p>
                                                        <p className={`${T.helperText} ${S.meta} mt-0.5 truncate`}>{member.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-10 py-6">
                                                {member.role === 'ADMIN' || member.role === 'SUPER_ADMIN' ? (
                                                    <span
                                                        style={{ backgroundColor: 'color-mix(in srgb, var(--brand-primary) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--brand-primary) 20%, transparent)' }}
                                                        className="inline-flex items-center rounded-xl border px-4 py-1.5 text-[0.7rem] font-bold uppercase tracking-wider text-[var(--brand-primary)] transition-colors"
                                                    >
                                                        <Shield size={14} className="mr-2" />
                                                        {member.role}
                                                    </span>
                                                ) : (
                                                    <span className={`inline-flex items-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-1.5 ${T.statusText} opacity-80 transition-colors group-hover:opacity-100`}>
                                                        <Shield size={14} className="mr-2" />
                                                        {member.role}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-10 py-6">
                                                <StatusDot status={member.status} />
                                            </td>
                                            <td className="px-10 py-6">
                                                <div className="flex items-center gap-3">
                                                    {member.twoFactorEnabled ? (
                                                        <div className="rounded-lg border border-emerald-500 border-opacity-20 bg-emerald-500 bg-opacity-10 p-2 text-emerald-500">
                                                            <CheckCircle size={18} />
                                                        </div>
                                                    ) : (
                                                        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] p-2 text-[color:var(--tx-helperText-color)] transition-colors hover:text-[var(--brand-primary)]">
                                                            <ShieldAlert size={18} />
                                                        </div>
                                                    )}
                                                    <span className={`${T.statusText} ${member.twoFactorEnabled ? 'text-emerald-500' : 'opacity-80'}`}>
                                                        {member.twoFactorEnabled ? '2FA ACTIVO' : 'SIN 2FA'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-10 py-6">
                                                <p className={`${T.tableCell} ${S.meta} opacity-70`}>
                                                    {new Date(member.joinedAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                </p>
                                            </td>
                                            <td className="px-10 py-6 text-right">
                                                {isAdmin ? (
                                                    <RowActions
                                                        member={member}
                                                        currentUserId={currentUserId}
                                                        onSuspend={setSuspendTarget}
                                                        onReactivate={handleReactivate}
                                                        onImpersonate={handleImpersonate}
                                                        loadingId={actionLoadingId}
                                                    />
                                                ) : (
                                                    <span className="opacity-50">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>

            {invitations.length > 0 && (
                <div className="pt-2">
                    <h3 className={`${T.sectionTitle} ${S.meta} mb-5 ml-1 sm:ml-2`}>Invitaciones pendientes</h3>
                    {loadingInvites ? (
                        <div className="py-8 text-center">
                            <Loader2 size={18} className="mx-auto mb-3 animate-spin text-[var(--brand-primary)]" />
                            <span className={`${T.helperText} ${S.meta}`}>Cargando invitaciones...</span>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {invitations.map((invite: any) => (
                                <div key={invite.id} className="group relative flex flex-col justify-between overflow-hidden rounded-[2rem] border-2 border-dashed border-[var(--border-default)] bg-[var(--bg-card)] bg-opacity-50 p-6 transition-all duration-500 hover:border-[var(--brand-primary)] sm:p-8">
                                    <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-orange-500 opacity-5 blur-[40px]" />
                                    <div className="relative mb-6 flex items-start justify-between">
                                        <div
                                            style={{ backgroundColor: 'color-mix(in srgb, var(--brand-primary) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--brand-primary) 10%, transparent)' }}
                                            className="flex h-12 w-12 items-center justify-center rounded-[1.25rem] border text-[var(--brand-primary)] shadow-inner transition-transform duration-500 group-hover:scale-110"
                                        >
                                            <Mail size={24} />
                                        </div>
                                        <span className={`${T.statusText} ${S.meta} rounded-full border border-orange-400 border-opacity-20 bg-orange-400 bg-opacity-10 px-3 py-1 text-orange-400 shadow-sm`}>
                                            Enviada
                                        </span>
                                    </div>
                                    <div className="relative mb-8">
                                        <p className={`${T.cardTitle} ${S.body} truncate`}>{invite.email}</p>
                                        <div className="mt-2 flex items-center gap-2">
                                            <Shield size={12} className="text-[var(--text-muted)]" />
                                            <p className={`${T.helperText} ${S.meta}`}>ROL: {invite.role?.slug || invite.role?.name || 'AGENT'}</p>
                                        </div>
                                        <div className="mt-1 flex items-center gap-2">
                                            <Clock size={12} className="text-[var(--text-muted)]" />
                                            <p className={`${T.helperText} ${S.meta}`}>EXPIRA: {new Date(invite.expiresAt).toLocaleDateString('es-MX')}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleRevoke(invite.id)}
                                        className={`relative w-full rounded-[1.25rem] border-2 border-[var(--state-danger)] border-opacity-20 py-4 text-[var(--state-danger)] transition-all hover:bg-[var(--state-danger)] hover:text-white ${T.buttonText} ${S.body}`}
                                    >
                                        <span className="flex items-center justify-center gap-2">
                                            <Trash2 size={16} />
                                            Revocar
                                        </span>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {isInviteModalOpen && (
                <div className="fixed inset-0 z-50 flex items-end justify-center p-0 animate-in fade-in duration-300 sm:items-center sm:p-4">
                    <div className="absolute inset-0 bg-[var(--bg-page)] opacity-80 backdrop-blur-md" onClick={() => setIsInviteModalOpen(false)} />
                    <div className="relative max-h-[100dvh] w-full overflow-y-auto rounded-t-[2rem] border border-[var(--brand-primary)] border-opacity-30 bg-[var(--bg-card)] px-6 py-8 shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:max-w-xl sm:rounded-[3rem] sm:p-12">
                        <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-[var(--brand-primary)] opacity-10 blur-[150px]" />
                        <div className="relative mb-8 flex items-start gap-4 sm:mb-10 sm:items-center sm:gap-6">
                            <div
                                style={{ backgroundColor: 'color-mix(in srgb, var(--brand-primary) 10%, transparent)' }}
                                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.25rem] text-[var(--brand-primary)] shadow-inner sm:h-16 sm:w-16 sm:rounded-[1.5rem]"
                            >
                                <UserPlus size={28} />
                            </div>
                            <div className="min-w-0">
                                <h2 className={`${T.sectionTitle} ${S.headingLg}`}>Invitar <span className="text-[var(--ty-accent)]">colaborador</span></h2>
                                <p className={`${T.helperText} ${S.body} opacity-50`}>Envía una llave de acceso a tu nuevo miembro.</p>
                            </div>
                        </div>

                        <div className="relative space-y-6 sm:space-y-8">
                            <div className="space-y-3">
                                <label className={`${T.labelText} ${S.meta} ml-4 text-[var(--brand-primary)]`}>Email corporativo</label>
                                <input
                                    type="email"
                                    value={newInvite.email}
                                    onChange={(e) => setNewInvite({ ...newInvite, email: e.target.value })}
                                    placeholder="ejemplo@wabee.app"
                                    className={`w-full rounded-[1.5rem] border-2 border-[var(--border-default)] bg-[var(--bg-input)] px-6 py-4 text-sm ${T.inputText} shadow-inner outline-none transition-all focus:border-[var(--brand-primary)] sm:px-8 sm:py-5`}
                                />
                            </div>

                            <div className="space-y-3">
                                <label className={`${T.labelText} ${S.meta} ml-4 text-[var(--brand-primary)]`}>Asignar rol</label>
                                <div className="grid grid-cols-2 gap-4 sm:gap-5">
                                    {['SUPERVISOR', 'AGENT'].map((r) => (
                                        <div
                                            key={r}
                                            onClick={() => setNewInvite({ ...newInvite, role: r })}
                                            style={newInvite.role === r ? { backgroundColor: 'color-mix(in srgb, var(--brand-primary) 10%, transparent)', borderColor: 'var(--brand-primary)' } : {}}
                                            className={`group/role relative flex cursor-pointer flex-col items-center gap-3 overflow-hidden rounded-[1.5rem] border-2 p-4 transition-all sm:p-6 ${
                                                newInvite.role === r ? '' : 'border-[var(--border-default)] bg-[var(--bg-card)] hover:border-[var(--brand-primary)]'
                                            }`}
                                        >
                                            <div className={`flex h-12 w-12 items-center justify-center rounded-xl transition-all ${newInvite.role === r ? 'bg-[var(--brand-primary)] ' : 'bg-[var(--bg-elevated)] text-[color:var(--tx-helperText-color)] group-hover/role:text-[var(--brand-primary)]'}`}>
                                                <Shield size={22} />
                                            </div>
                                            <p className={`${T.buttonText} ${S.meta} ${newInvite.role === r ? 'text-[var(--brand-primary)]' : 'text-[color:var(--tx-helperText-color)] group-hover/role:text-[var(--brand-primary)]'}`}>
                                                {r === 'SUPERVISOR' ? 'Supervisor' : 'Agente'}
                                            </p>
                                            {newInvite.role === r && (
                                                <div className="absolute right-2 top-2">
                                                    <CheckCircle size={14} className="text-[var(--brand-primary)]" />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex flex-col gap-4 pt-2 sm:flex-row sm:gap-5 sm:pt-4">
                                <button
                                    onClick={() => setIsInviteModalOpen(false)}
                                    className={`flex-1 rounded-[1.5rem] border-2 border-[var(--border-default)] bg-[var(--bg-elevated)] py-4 text-[color:var(--tx-helperText-color)] transition-all hover:text-[var(--brand-primary)] sm:py-5 ${T.buttonText} ${S.body}`}
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={() => inviteMutation.mutate(newInvite)}
                                    disabled={!newInvite.email || inviteMutation.isPending}
                                    className={`flex flex-[2] items-center justify-center gap-3 rounded-[1.5rem] py-4 transition-all sm:py-5 ${T.buttonPrimaryText} ${S.body} ${
                                        !newInvite.email || inviteMutation.isPending
                                            ? 'cursor-not-allowed bg-[var(--bg-elevated)] text-[color:var(--tx-helperText-color)] opacity-60 shadow-none'
                                            : 'bg-[var(--brand-primary)] shadow-2xl hover:scale-[1.02]'
                                    }`}
                                >
                                    {inviteMutation.isPending ? <Loader2 size={20} className="animate-spin" /> : <UserPlus size={20} />}
                                    Enviar invitación
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <SuspendModal
                member={suspendTarget}
                onConfirm={handleSuspendConfirm}
                onClose={() => setSuspendTarget(null)}
                isLoading={suspendMutation.isPending}
            />
        </div>
    );
};
