import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Users as UsersIcon, UserPlus, Mail, Shield,
    Trash2, Clock, CheckCircle, Loader2,
    ShieldAlert, Smartphone, MoreVertical,
    UserX, UserCheck, Eye, AlertTriangle
} from 'lucide-react';
import client from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useDialog } from '../../context/DialogContext';
import { ImpersonationStore } from '../../lib/impersonation.store';
import { T, S } from '@/lib/text-tokens';
import { usePlanEnforcement } from '../../hooks/usePlanEnforcement';

// ──────────────────────────────────────────────────────────────
// Tipos
// ──────────────────────────────────────────────────────────────
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

// ──────────────────────────────────────────────────────────────
// Badge de estado
// ──────────────────────────────────────────────────────────────
const StatusDot: React.FC<{ status: Member['status'] }> = ({ status }) => {
    const map = {
        ACTIVE: { cls: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]', label: 'ACTIVO', text: 'text-emerald-500' },
        SUSPENDED: { cls: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]', label: 'SUSPENDIDO', text: 'text-red-500' },
        INVITED: { cls: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]', label: 'INVITADO', text: 'text-amber-500' },
        REMOVED: { cls: 'bg-[var(--border-default)]', label: 'REMOVIDO', text: 'text-[var(--text-muted)]' },
    };
    const normalizedStatus = (status || '').toUpperCase() as any;
    const conf = map[normalizedStatus as keyof typeof map] || map.ACTIVE;
    return (
        <span className={`flex items-center gap-2 ${S.meta} font-black uppercase tracking-[2px] ${conf.text}`}>
            <span className={`w-2 h-2 rounded-full ${conf.cls}`} />
            {conf.label}
        </span>
    );
};

// ──────────────────────────────────────────────────────────────
// Menú de acciones por fila
// ──────────────────────────────────────────────────────────────
interface RowActionsProps {
    member: Member;
    currentUserId: string;
    onSuspend: (m: Member) => void;
    onReactivate: (m: Member) => void;
    onImpersonate: (m: Member) => void;
    loadingId: string | null;
}

const RowActions: React.FC<RowActionsProps> = ({
    member, currentUserId, onSuspend, onReactivate, onImpersonate, loadingId
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
                className="w-10 h-10 rounded-xl flex items-center justify-center text-[var(--tx-buttonText-color)] hover:text-[var(--brand-primary)] hover:bg-[var(--bg-hover)] border border-transparent hover:border-[var(--brand-primary)] transition-all disabled:opacity-50 group"
                title="Acciones"
            >
                {isLoading
                    ? <Loader2 size={18} className="animate-spin text-[var(--brand-primary)]" />
                    : <MoreVertical size={18} className="group-hover:scale-110 transition-transform" />
                }
            </button>

            {open && (
                <div className="absolute right-0 top-12 z-50 w-60 bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-[1.5rem] shadow-2xl py-3 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
                    {/* Header del menú */}
                    <div className="px-5 py-3 border-b border-[var(--border-default)] mb-2 bg-[var(--bg-card)]">
                        <p className={`${T.tableHeader} ${S.meta} truncate`}>{member.name}</p>
                    </div>

                    <div className="px-2 space-y-1">
                        {canSuspend && (
                            <button
                                onClick={() => { setOpen(false); onSuspend(member); }}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl ${S.meta} font-black uppercase tracking-widest text-red-500 hover:bg-red-500/10 transition-all`}
                            >
                                <UserX size={16} />
                                Suspender acceso
                            </button>
                        )}

                        {canReactivate && (
                            <button
                                onClick={() => { setOpen(false); onReactivate(member); }}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl ${S.meta} font-black uppercase tracking-widest text-emerald-500 hover:bg-emerald-500/10 transition-all`}
                            >
                                <UserCheck size={16} />
                                Reactivar acceso
                            </button>
                        )}

                        {canImpersonate && (
                            <button
                                onClick={() => { setOpen(false); onImpersonate(member); }}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl ${T.buttonText} ${S.meta} text-[var(--brand-primary)] hover:bg-[var(--bg-hover)] transition-all`}
                            >
                                <Eye size={16} />
                                Suplantar usuario
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

// ──────────────────────────────────────────────────────────────
// Modal de suspensión con motivo
// ──────────────────────────────────────────────────────────────
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-[var(--bg-page)] opacity-80 backdrop-blur-md" onClick={onClose} />
            <div className="relative bg-[var(--bg-card)] border border-[var(--border-default)] w-full max-w-md rounded-[3rem] p-10 sm:p-14 shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden text-center">
                <div className="absolute -top-20 -right-20 w-48 h-48 bg-red-500 rounded-full opacity-5 blur-[80px]"></div>
                
                <div className="w-20 h-20 rounded-[2rem] bg-red-500 border border-red-500 flex items-center justify-center mx-auto mb-8 shadow-inner bg-opacity-10 border-opacity-20">
                    <UserX size={32} className="text-red-500" />
                </div>
                
                <h3 className={`${T.sectionTitle} ${S.headingLg} mb-4`}>Suspender <span className="text-red-500">Miembro</span></h3>
                <p className={`${T.helperText} ${S.body} mb-10 opacity-60`}>
                    <span className="font-bold">{member.name}</span> perderá el acceso a la plataforma inmediatamente. Podrás reactivarlo más tarde.
                </p>

                <div className="space-y-3 mb-10 text-left">
                    <label className={`${T.labelText} ${S.meta} ml-4 text-[var(--brand-primary)]`}>
                        Motivo (Opcional)
                    </label>
                    <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Ej: Baja voluntaria, falta de actividad..."
                        rows={3}
                        className={`w-full bg-[var(--bg-input)] border border-[var(--border-default)] rounded-[1.5rem] p-6 text-sm ${T.inputText} focus:border-[var(--brand-primary)] outline-none transition-all resize-none shadow-inner`}
                    />
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isLoading}
                        className={`flex-1 py-5 rounded-[1.25rem] ${T.buttonText} ${S.body} bg-[var(--bg-elevated)] border border-[var(--border-default)] transition-all disabled:opacity-50 hover:border-[var(--brand-primary)]`}
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={() => onConfirm(reason)}
                        disabled={isLoading}
                        className={`flex-[2] py-4 rounded-2xl ${T.buttonText} ${S.ui} bg-[var(--state-danger)] text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2`}
                    >
                        {isLoading && <Loader2 size={14} className="animate-spin" />}
                        Suspender ahora
                    </button>
                </div>
            </div>
        </div>
    );
};

// ──────────────────────────────────────────────────────────────
// Página principal
// ──────────────────────────────────────────────────────────────
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

    // ── Enforcement ──────────────────────────────────────────
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

    // ── Queries ──────────────────────────────────────────────
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

    // ── Mutations ────────────────────────────────────────────
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
        onError: (err: any) =>
            toastError(err.response?.data?.error?.message || 'Error al suspender al miembro'),
        onSettled: () => setActionLoadingId(null),
    });

    const reactivateMutation = useMutation({
        mutationFn: (userId: string) =>
            client.post(`/orgs/${orgId}/members/${userId}/reactivate`),
        onSuccess: () => {
            toastSuccess('Miembro reactivado correctamente');
            queryClient.invalidateQueries({ queryKey: ['org', 'members', orgId] });
        },
        onError: (err: any) =>
            toastError(err.response?.data?.error?.message || 'Error al reactivar al miembro'),
        onSettled: () => setActionLoadingId(null),
    });

    const impersonateMutation = useMutation({
        mutationFn: (userId: string) =>
            client.post(`/orgs/${orgId}/members/${userId}/impersonate`, { reason: 'Revisión administrativa' }),
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
                    avatar: target?.avatar || ''
                },
                orgId,
            });
            toastSuccess(`Suplantando a ${target?.name || userId}…`);
            setTimeout(() => window.location.reload(), 800);
        },
        onError: (err: any) =>
            toastError(err.response?.data?.error?.message || 'Error al iniciar suplantación'),
        onSettled: () => setActionLoadingId(null),
    });

    // ── Handlers ─────────────────────────────────────────────
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
                    <div className="flex items-start gap-2 bg-amber-400/10 border border-amber-400/20 rounded-xl p-3">
                        <AlertTriangle size={14} className="text-amber-400 mt-0.5 shrink-0" />
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

    // ── Render ────────────────────────────────────────────────
    return (
        <div className="space-y-10 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-8">
                <div>
                    <h1 className={`${T.pageTitle} ${S.displayMd}`}>Equipo de <span className="text-[var(--ty-accent)]">Trabajo</span></h1>
                    <p className={`${T.pageSubtitle} ${S.body}`}>Gestiona los accesos, roles y niveles de seguridad de tus colaboradores.</p>
                </div>
                {isAdmin && (
                    <div className="flex flex-col items-end gap-3">
                        <button
                            onClick={() => !isUsersBlocked && setIsInviteModalOpen(true)}
                            disabled={isUsersBlocked}
                            className={`flex items-center gap-3 bg-[var(--brand-primary)] px-10 py-5 rounded-[1.5rem] ${T.buttonPrimaryText} ${S.body} transition-all shadow-lg ${
                                isUsersBlocked 
                                ? 'opacity-50 grayscale cursor-not-allowed' 
                                : 'hover:scale-[1.02] active:scale-[0.98]'
                            }`}
                        >
                            <UserPlus size={20} />
                            Invitar Nuevo
                        </button>
                        
                        <div className={`flex items-center gap-2 ${S.meta} font-bold tracking-wider ${isUsersBlocked ? 'text-red-400' : 'text-[var(--brand-primary)] opacity-70'}`}>
                            <UsersIcon size={14} />
                            USO DEL PLAN: {usageLabel}
                            {isUsersBlocked && (
                                <span className="ml-2 bg-red-500/10 text-red-500 px-2 py-0.5 rounded-md text-[10px] border border-red-500/20">
                                    LÍMITE ALCANZADO
                                </span>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-[2rem] p-8 flex items-center gap-6 group hover:border-[var(--brand-primary)] transition-all relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-[var(--brand-primary)] rounded-full opacity-5 blur-[40px]"></div>
                    <div 
                        style={{ backgroundColor: 'color-mix(in srgb, var(--brand-primary) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--brand-primary) 20%, transparent)' }}
                        className="w-14 h-14 rounded-2xl border flex items-center justify-center text-[var(--brand-primary)] shadow-inner group-hover:scale-110 transition-transform duration-500"
                    >
                        <UsersIcon size={28} />
                    </div>
                    <div>
                        <p className={`${T.kpiLabel} ${S.meta}`}>Activos</p>
                        <p className={`${T.kpiValue} ${S.displaySm} mt-1`}>
                            {members.filter((m) => m.status === 'ACTIVE').length}
                        </p>
                    </div>
                </div>
                <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-[2rem] p-8 flex items-center gap-6 group hover:border-orange-500 transition-all relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500 rounded-full opacity-5 blur-[40px]"></div>
                    <div className="w-14 h-14 rounded-2xl bg-orange-500 bg-opacity-10 border border-orange-500 border-opacity-20 flex items-center justify-center text-orange-400 shadow-inner group-hover:scale-110 transition-transform duration-500">
                        <Mail size={28} />
                    </div>
                    <div>
                        <p className={`${T.kpiLabel} ${S.meta}`}>Invitaciones</p>
                        <p className={`${T.kpiValue} ${S.displaySm} mt-1`}>{invitations.length}</p>
                    </div>
                </div>
                <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-[2rem] p-8 flex items-center gap-6 group hover:border-green-500 transition-all relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-green-500 rounded-full opacity-5 blur-[40px]"></div>
                    <div className="w-14 h-14 rounded-2xl bg-green-500 bg-opacity-10 border border-green-500 border-opacity-20 flex items-center justify-center text-green-400 shadow-inner group-hover:scale-110 transition-transform duration-500">
                        <Smartphone size={28} />
                    </div>
                    <div>
                        <p className={`${T.kpiLabel} ${S.meta}`}>Con 2FA</p>
                        <p className={`${T.kpiValue} ${S.displaySm} mt-1`}>
                            {members.filter((m) => m.twoFactorEnabled).length}
                        </p>
                    </div>
                </div>
            </div>

            {/* Tabla de miembros */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-[3rem] overflow-hidden shadow-2xl relative">
                <div className="absolute top-0 right-0 w-80 h-80 bg-[var(--brand-primary)] rounded-full opacity-5 blur-[100px] pointer-events-none"></div>
                <div className="px-10 py-8 border-b border-[var(--border-default)] flex items-center justify-between bg-[var(--bg-surface)] bg-opacity-50 backdrop-blur-sm">
                    <h3 className={`${T.cardTitle} ${S.meta}`}>Colaboradores</h3>
                    <div className="flex gap-3 items-center px-4 py-2 bg-green-500 bg-opacity-10 rounded-full border border-green-500 border-opacity-20">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                        <span className={`${S.meta} text-green-500 opacity-80 font-black uppercase tracking-widest`}>Sincronizado</span>
                    </div>
                </div>

                {loadingMembers ? (
                    <div className="py-24 text-center">
                        <Loader2 className="animate-spin text-[var(--brand-primary)] mx-auto mb-6" size={40} />
                        <p className={`${T.helperText} ${S.meta}`}>Sincronizando equipo...</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className={`${T.tableHeader} ${S.meta} border-b border-[var(--border-default)] bg-[var(--bg-elevated)]`}>
                                    <th className="py-6 px-10 text-left">Usuario</th>
                                    <th className="py-6 px-10 text-left">Rol / Nivel</th>
                                    <th className="py-6 px-10 text-left">Estado</th>
                                    <th className="py-6 px-10 text-left">Seguridad</th>
                                    <th className="py-6 px-10 text-left">Ingreso</th>
                                    <th className="py-6 px-10 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-default)]">
                                {members.map((member) => (
                                    <tr
                                        key={member.userId}
                                        className={`group hover:bg-[var(--bg-hover)] transition-all duration-500 ${member.status?.toUpperCase() === 'SUSPENDED' ? 'bg-red-500/5' : ''}`}
                                    >
                                        {/* Usuario */}
                                        <td className="py-6 px-10">
                                            <div className="flex items-center gap-5">
                                                <div className="relative w-12 h-12 rounded-[1.25rem] overflow-hidden bg-[var(--bg-elevated)] border border-[var(--border-default)] shrink-0 group-hover:scale-105 transition-transform duration-500 shadow-inner">
                                                    <img
                                                        src={member.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=ead018&color=121208`}
                                                        alt="Avatar"
                                                        className="w-full h-full object-cover"
                                                    />
                                                    {member.userId === currentUserId && (
                                                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-[var(--brand-primary)] rounded-full border-2 border-[var(--bg-page)] shadow-lg" />
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className={`${T.tableCell} ${S.body} truncate font-bold group-hover:text-[var(--brand-primary)] transition-colors`}>
                                                        {member.name}
                                                        {member.userId === currentUserId && (
                                                            <span className="ml-2 text-[10px] text-[var(--ty-accent)] opacity-60">(TÚ)</span>
                                                        )}
                                                    </p>
                                                    <p className={`${T.helperText} ${S.meta} mt-0.5 truncate`}>{member.email}</p>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Rol */}
                                        <td className="py-6 px-10">
                                            {member.role === 'ADMIN' || member.role === 'SUPER_ADMIN' ? (
                                                <span 
                                                    style={{ backgroundColor: 'color-mix(in srgb, var(--brand-primary) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--brand-primary) 20%, transparent)' }}
                                                    className="inline-flex items-center px-4 py-1.5 rounded-xl border text-[var(--brand-primary)] uppercase font-bold text-[0.7rem] tracking-wider transition-colors"
                                                >
                                                    <Shield size={14} className="mr-2" />
                                                    {member.role}
                                                </span>
                                            ) : (
                                                <span className={`inline-flex items-center px-4 py-1.5 rounded-xl border transition-colors bg-[var(--bg-elevated)] border-[var(--border-default)] ${T.statusText} opacity-80 group-hover:opacity-100`}>
                                                    <Shield size={14} className="mr-2" />
                                                    {member.role}
                                                </span>
                                            )}
                                        </td>

                                        {/* Estado */}
                                        <td className="py-6 px-10">
                                            <StatusDot status={member.status} />
                                        </td>

                                        {/* Seguridad */}
                                        <td className="py-6 px-10">
                                            <div className="flex items-center gap-3">
                                                {member.twoFactorEnabled ? (
                                                    <div className="p-2 rounded-lg bg-emerald-500 bg-opacity-10 border border-emerald-500 border-opacity-20 text-emerald-500">
                                                        <CheckCircle size={18} />
                                                    </div>
                                                ) : (
                                                    <div className="p-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-default)] text-[color:var(--tx-helperText-color)] transition-colors hover:text-[var(--brand-primary)]">
                                                        <ShieldAlert size={18} />
                                                    </div>
                                                )}
                                                <span className={`${T.statusText} ${member.twoFactorEnabled ? 'text-emerald-500' : 'opacity-80'}`}>
                                                    {member.twoFactorEnabled ? '2FA ACTIVO' : 'SIN 2FA'}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Ingreso */}
                                        <td className="py-6 px-10">
                                            <p className={`${T.tableCell} ${S.meta} opacity-70`}>
                                                {new Date(member.joinedAt).toLocaleDateString('es-MX', {
                                                    day: '2-digit', month: 'short', year: 'numeric'
                                                })}
                                            </p>
                                        </td>

                                        {/* Acciones */}
                                        <td className="py-6 px-10 text-right">
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
                                                <span className="text-[#a0a080] opacity-50">——</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Invitaciones pendientes */}
            {invitations.length > 0 && (
                <div className="pt-4">
                    <h3 className={`${T.sectionTitle} ${S.meta} mb-8 ml-6`}>
                        Invitaciones Pendientes
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {invitations.map((invite: any) => (
                            <div key={invite.id} className="bg-[var(--bg-card)] bg-opacity-50 border-2 border-[var(--border-default)] border-dashed rounded-[2.5rem] p-8 flex flex-col justify-between group hover:border-[var(--brand-primary)] transition-all duration-500 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500 rounded-full opacity-5 blur-[40px]"></div>
                                <div className="flex items-start justify-between mb-6 relative">
                                    <div 
                                        style={{ backgroundColor: 'color-mix(in srgb, var(--brand-primary) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--brand-primary) 10%, transparent)' }}
                                        className="w-12 h-12 rounded-[1.25rem] border flex items-center justify-center text-[var(--brand-primary)] shadow-inner group-hover:scale-110 transition-transform duration-500"
                                    >
                                        <Mail size={24} />
                                    </div>
                                    <span className={`${T.statusText} ${S.meta} text-orange-400 bg-orange-400 bg-opacity-10 border border-orange-400 border-opacity-20 px-3 py-1 rounded-full shadow-sm`}>
                                        Enviada
                                    </span>
                                </div>
                                <div className="mb-8 relative">
                                    <p className={`${T.cardTitle} ${S.body} truncate`}>{invite.email}</p>
                                    <div className="flex items-center gap-2 mt-2">
                                        <Shield size={12} className="text-[var(--text-muted)]" />
                                        <p className={`${T.helperText} ${S.meta}`}>
                                            ROL: {invite.role?.slug || invite.role?.name || 'AGENT'}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Clock size={12} className="text-[var(--text-muted)]" />
                                        <p className={`${T.helperText} ${S.meta}`}>
                                            EXPIRA: {new Date(invite.expiresAt).toLocaleDateString('es-MX')}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-4 relative">
                                    <button
                                        onClick={() => handleRevoke(invite.id)}
                                        className={`flex-1 w-full py-4 border-2 border-[var(--state-danger)] border-opacity-20 text-[var(--state-danger)] rounded-[1.25rem] ${T.buttonText} ${S.body} hover:bg-[var(--state-danger)] hover:text-white transition-all`}
                                    >
                                        Revocar
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Modal Invitar */}
            {isInviteModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-[var(--bg-page)] opacity-80 backdrop-blur-md" onClick={() => setIsInviteModalOpen(false)} />
                    <div className="relative bg-[var(--bg-card)] border border-[var(--brand-primary)] border-opacity-30 w-full max-w-xl rounded-[3rem] p-10 sm:p-14 shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
                        <div className="absolute -top-40 -left-40 w-96 h-96 bg-[var(--brand-primary)] rounded-full opacity-10 blur-[150px] pointer-events-none"></div>
                        <div className="flex items-center gap-6 mb-10">
                            <div 
                                style={{ backgroundColor: 'color-mix(in srgb, var(--brand-primary) 10%, transparent)' }}
                                className="w-16 h-16 rounded-[1.5rem] flex items-center justify-center text-[var(--brand-primary)] shadow-inner"
                            >
                                <UserPlus size={32} />
                            </div>
                            <div>
                                <h2 className={`${T.sectionTitle} ${S.headingLg}`}>Invitar <span className="text-[var(--ty-accent)]">Colaborador</span></h2>
                                <p className={`${T.helperText} ${S.body} opacity-50`}>Envía una llave de acceso a tu nuevo miembro.</p>
                            </div>
                        </div>

                        <div className="space-y-8 relative">
                            <div className="space-y-3">
                                <label className={`${T.labelText} ${S.meta} ml-4 text-[var(--brand-primary)]`}>Email Corporativo</label>
                                <input
                                    type="email"
                                    value={newInvite.email}
                                    onChange={(e) => setNewInvite({ ...newInvite, email: e.target.value })}
                                    placeholder="ejemplo@wabee.app"
                                    className={`w-full bg-[var(--bg-input)] border-2 border-[var(--border-default)] rounded-[1.5rem] py-5 px-8 text-sm ${T.inputText} focus:border-[var(--brand-primary)] outline-none transition-all shadow-inner`}
                                />
                            </div>

                            <div className="space-y-3">
                                <label className={`${T.labelText} ${S.meta} ml-4 text-[var(--brand-primary)]`}>Asignar Rol</label>
                                <div className="grid grid-cols-2 gap-5">
                                    {['SUPERVISOR', 'AGENT'].map((r) => (
                                        <div
                                            key={r}
                                            onClick={() => setNewInvite({ ...newInvite, role: r })}
                                            style={newInvite.role === r ? { backgroundColor: 'color-mix(in srgb, var(--brand-primary) 10%, transparent)', borderColor: 'var(--brand-primary)' } : {}}
                                            className={`cursor-pointer p-6 rounded-[1.5rem] border-2 transition-all flex flex-col items-center gap-3 relative overflow-hidden group/role ${
                                                newInvite.role === r
                                                ? ''
                                                : 'border-[var(--border-default)] bg-[var(--bg-card)] hover:border-[var(--brand-primary)]'
                                                }`}
                                        >
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${newInvite.role === r ? 'bg-[var(--brand-primary)] ' : 'bg-[var(--bg-elevated)] text-[color:var(--tx-helperText-color)] group-hover/role:text-[var(--brand-primary)]'}`}>
                                                <Shield size={22} />
                                            </div>
                                            <p className={`${T.buttonText} ${S.meta} ${newInvite.role === r ? 'text-[var(--brand-primary)]' : 'text-[color:var(--tx-helperText-color)] group-hover/role:text-[var(--brand-primary)]'}`}>
                                                {r === 'SUPERVISOR' ? 'Supervisor' : 'Agente'}
                                            </p>
                                            {newInvite.role === r && (
                                                <div className="absolute top-2 right-2">
                                                    <CheckCircle size={14} className="text-[var(--brand-primary)]" />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-5 pt-4">
                                <button
                                    onClick={() => setIsInviteModalOpen(false)}
                                    className={`flex-1 py-5 bg-[var(--bg-elevated)] border-2 border-[var(--border-default)] rounded-[1.5rem] ${T.buttonText} ${S.body} text-[color:var(--tx-helperText-color)] hover:text-[var(--brand-primary)] transition-all`}
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={() => inviteMutation.mutate(newInvite)}
                                    disabled={!newInvite.email || inviteMutation.isPending}
                                    className={`flex-[2] py-5 rounded-[1.5rem] ${T.buttonPrimaryText} ${S.body} transition-all flex items-center justify-center gap-3 ${
 !newInvite.email || inviteMutation.isPending
 ? 'bg-[var(--bg-elevated)] text-[color:var(--tx-helperText-color)] opacity-60 cursor-not-allowed shadow-none'
 : 'bg-[var(--brand-primary)] hover:scale-[1.02] shadow-2xl'
 }`}
                                >
                                    {inviteMutation.isPending ? <Loader2 size={20} className="animate-spin" /> : <UserPlus size={20} />}
                                    Enviar Invitación
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Suspender */}
            <SuspendModal
                member={suspendTarget}
                onConfirm={handleSuspendConfirm}
                onClose={() => setSuspendTarget(null)}
                isLoading={suspendMutation.isPending}
            />
        </div>
    );
};
