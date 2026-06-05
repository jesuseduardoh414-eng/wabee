import React, { useState, useRef } from 'react';
import {
    UserPlus, Mail, Shield, Trash2, Clock, MoreVertical,
    UserX, UserCheck, Eye, CheckCircle, AlertTriangle, Users,
    Loader2
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from '../api/client';
import { useToast } from '../context/ToastContext';
import { useDialog } from '../context/DialogContext';
import { ImpersonationStore } from '../lib/impersonation.store';
import { T, S } from '@/lib/text-tokens';

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
// Sub-componente: Badge de estado
// ──────────────────────────────────────────────────────────────
const StatusBadge: React.FC<{ status: Member['status'] }> = ({ status }) => {
    const map = {
        ACTIVE: { label: 'Activo', cls: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30', icon: CheckCircle },
        SUSPENDED: { label: 'Suspendido', cls: 'bg-[var(--state-danger)]/15 text-[var(--state-danger)] border-[var(--state-danger)]/30', icon: AlertTriangle },
        INVITED: { label: 'Invitado', cls: 'bg-[var(--brand-primary)]/15 text-[var(--brand-primary)] border-[var(--brand-primary)]/30', icon: Clock },
        REMOVED: { label: 'Removido', cls: 'bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border-default)]', icon: UserX },
    };
    const conf = map[status] || map.ACTIVE;
    const Icon = conf.icon;
    return (
        <span className={`inline-flex items-center gap-1 ${T.badgeText} ${S.meta} font-black px-2 py-0.5 rounded border ${conf.cls}`}>
            <Icon size={10} />
            {conf.label}
        </span>
    );
};

// ──────────────────────────────────────────────────────────────
// Sub-componente: Menú de acciones por fila
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

    // Cerrar al clic fuera
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
    const canSuspend = !isSelf && member.status === 'ACTIVE';
    const canReactivate = member.status === 'SUSPENDED';
    const canImpersonate = !isSelf && (member.status === 'ACTIVE');

    // Si no hay ninguna acción disponible no mostrar menú
    if (!canSuspend && !canReactivate && !canImpersonate) {
        return (
            <span className="text-[10px] text-[#3a3a2a] italic px-2">—</span>
        );
    }

    return (
        <div className="relative" ref={ref}>
            <button
                id={`row-actions-${member.userId}`}
                onClick={() => setOpen(!open)}
                disabled={isLoading}
                className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--brand-primary)] transition-all disabled:opacity-50"
                title="Acciones"
            >
                {isLoading
                    ? <Loader2 size={16} className="animate-spin text-[var(--brand-primary)]" />
                    : <MoreVertical size={16} />
                }
            </button>

            {open && (
                <div className="absolute right-0 top-8 z-50 w-48 bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl shadow-2xl py-1 animate-in fade-in zoom-in-95 duration-150">
                    {canSuspend && (
                        <button
                            onClick={() => { setOpen(false); onSuspend(member); }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--state-danger)] hover:bg-[var(--state-danger)]/10 transition-all"
                        >
                            <UserX size={14} />
                            Suspender
                        </button>
                    )}
                    {canReactivate && (
                        <button
                            onClick={() => { setOpen(false); onReactivate(member); }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-emerald-500 hover:bg-emerald-500/10 transition-all"
                        >
                            <UserCheck size={14} />
                            Reactivar
                        </button>
                    )}
                    {canImpersonate && (
                        <button
                            onClick={() => { setOpen(false); onImpersonate(member); }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/10 transition-all"
                        >
                            <Eye size={14} />
                            Suplantar usuario
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

// ──────────────────────────────────────────────────────────────
// Modal de suspensión con motivo opcional
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-[var(--bg-card)] border border-[var(--border-default)] w-full max-w-md rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-[var(--state-danger)]/15 border border-[var(--state-danger)]/30 flex items-center justify-center shrink-0">
                        <UserX size={18} className="text-[var(--state-danger)]" />
                    </div>
                    <h3 className={`${T.sectionTitle} ${S.headingMd} text-[var(--text-strong)]`}>Suspender miembro</h3>
                </div>
                <p className={`${T.helperText} ${S.body} mb-6`}>
                    Suspenderás a <span className="text-[var(--text-strong)] font-bold">{member.name}</span>.
                    No podrá acceder a la plataforma hasta ser reactivado.
                </p>

                <div className="space-y-2 mb-6">
                    <label className={`${T.labelText} ${S.meta} block mb-1 ml-1 text-[var(--text-muted)]`}>
                        Motivo (opcional)
                    </label>
                    <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Ej: Violación de política de uso..."
                        rows={3}
                        className={`${T.inputText} ${S.body} w-full bg-[var(--bg-input)] border border-[var(--border-default)] rounded-2xl p-3.5 focus:border-[var(--brand-primary)] outline-none transition-all resize-none`}
                    />
                </div>

                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isLoading}
                        className={`${T.buttonText} ${S.body} flex-1 py-3 rounded-2xl bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[var(--text-strong)] transition-all disabled:opacity-50`}
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={() => onConfirm(reason)}
                        disabled={isLoading}
                        className={`${T.buttonText} ${S.body} flex-1 py-3 rounded-2xl bg-[var(--state-danger)] text-white hover:brightness-110 transition-all shadow-lg shadow-red-500/20 disabled:opacity-50 flex items-center justify-center gap-2`}
                    >
                        {isLoading && <Loader2 size={16} className="animate-spin" />}
                        Suspender
                    </button>
                </div>
            </div>
        </div>
    );
};

// ──────────────────────────────────────────────────────────────
// Página principal
// ──────────────────────────────────────────────────────────────
export const TeamPage = () => {
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

    // ── Estados locales ──────────────────────────────────────
    const [isInviteOpen, setIsInviteOpen] = useState(false);
    const [newInvite, setNewInvite] = useState({ email: '', role: 'AGENT' });
    const [suspendTarget, setSuspendTarget] = useState<Member | null>(null);
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

    // ── Queries ──────────────────────────────────────────────
    const { data: members = [], isLoading: membersLoading } = useQuery<Member[]>({
        queryKey: ['members', orgId],
        queryFn: async () => {
            const { data } = await client.get(`/orgs/${orgId}/members`, { params: { limit: 100 } });
            return data.items || [];
        },
        enabled: !!orgId && isAdmin,
    });

    const { data: invitations = [], isLoading: invitesLoading } = useQuery<any[]>({
        queryKey: ['invitations', orgId],
        queryFn: async () => {
            const { data } = await client.get(`/orgs/${orgId}/invitations`);
            return data;
        },
        enabled: !!orgId && isAdmin,
    });

    // ── Mutations: Invitar ───────────────────────────────────
    const inviteMutation = useMutation({
        mutationFn: (payload: any) => client.post(`/orgs/${orgId}/invitations`, payload),
        onSuccess: () => {
            toastSuccess('Invitación enviada con éxito');
            setNewInvite({ email: '', role: 'AGENT' });
            setIsInviteOpen(false);
            queryClient.invalidateQueries({ queryKey: ['invitations', orgId] });
        },
        onError: (err: any) => toastError(err.response?.data?.error?.message || 'Error al enviar invitación'),
    });

    // ── Mutations: Revocar ───────────────────────────────────
    const revokeMutation = useMutation({
        mutationFn: (id: string) => client.delete(`/orgs/${orgId}/invitations/${id}`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invitations', orgId] }),
        onError: () => toastError('Error al revocar invitación'),
    });

    // ── Mutations: Suspender ─────────────────────────────────
    const suspendMutation = useMutation({
        mutationFn: ({ userId, reason }: { userId: string; reason: string }) =>
            client.post(`/orgs/${orgId}/members/${userId}/suspend`, { reason }),
        onSuccess: () => {
            toastSuccess('Miembro suspendido correctamente');
            queryClient.invalidateQueries({ queryKey: ['members', orgId] });
        },
        onError: (err: any) =>
            toastError(err.response?.data?.error?.message || 'Error al suspender al miembro'),
        onSettled: () => setActionLoadingId(null),
    });

    // ── Mutations: Reactivar ─────────────────────────────────
    const reactivateMutation = useMutation({
        mutationFn: (userId: string) =>
            client.post(`/orgs/${orgId}/members/${userId}/reactivate`),
        onSuccess: () => {
            toastSuccess('Miembro reactivado correctamente');
            queryClient.invalidateQueries({ queryKey: ['members', orgId] });
        },
        onError: (err: any) =>
            toastError(err.response?.data?.error?.message || 'Error al reactivar al miembro'),
        onSettled: () => setActionLoadingId(null),
    });

    // ── Mutations: Suplantar ─────────────────────────────────
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
            // Pequeño delay para que el toast sea visible antes del reload
            setTimeout(() => window.location.reload(), 800);
        },
        onError: (err: any) =>
            toastError(err.response?.data?.error?.message || 'Error al iniciar suplantación'),
        onSettled: () => setActionLoadingId(null),
    });

    // ── Handlers ─────────────────────────────────────────────
    const handleInvite = (e: React.FormEvent) => {
        e.preventDefault();
        inviteMutation.mutate(newInvite);
    };

    const handleRevoke = async (id: string) => {
        const ok = await confirm({
            title: 'Revocar Invitación',
            description: '¿Estás seguro de revocar esta invitación?',
            isDestructive: true,
            confirmText: 'Revocar',
        });
        if (!ok) return;
        revokeMutation.mutate(id);
    };

    const handleSuspendConfirm = (reason: string) => {
        if (!suspendTarget) return;
        setActionLoadingId(suspendTarget.userId);
        suspendMutation.mutate({ userId: suspendTarget.userId, reason });
        setSuspendTarget(null);
    };

    const handleReactivate = async (member: Member) => {
        const ok = await confirm({
            title: 'Reactivar miembro',
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
                <div className="space-y-2">
                    <p>Vas a navegar como <strong>{member.name}</strong>.</p>
                    <p className="text-amber-400 text-xs">Todas las acciones realizadas quedarán registradas en el audit log con tu identidad real.</p>
                </div>
            ),
            confirmText: 'Iniciar suplantación',
        });
        if (!ok) return;
        setActionLoadingId(member.userId);
        impersonateMutation.mutate(member.userId);
    };

    // ── Render ───────────────────────────────────────────────
    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex justify-between items-end">
                <div>
                    <h2 className={`${T.pageTitle} ${S.displayMd} mb-2`}>Mi <span className="text-[var(--brand-primary)]">Equipo</span></h2>
                    <p className={`${T.pageSubtitle} ${S.body}`}>Gestiona los miembros de tu organización y sus permisos.</p>
                </div>
                {isAdmin && (
                    <button
                        onClick={() => setIsInviteOpen(true)}
                        className={`${T.buttonPrimaryText} ${S.body} flex items-center gap-2 bg-[var(--brand-primary)] px-6 py-3 rounded-xl hover:brightness-110 transition-all shadow-lg`}
                    >
                        <UserPlus size={20} />
                        Invitar Miembro
                    </button>
                )}
            </div>

            {/* ── TABLA DE MIEMBROS ── */}
            <div className="dashboard-card border-[var(--border-default)]">
                <div className="flex items-center gap-3 mb-6">
                    <Users className="text-[var(--brand-primary)]" size={20} />
                    <h3 className={`${T.sectionTitle} ${S.headingMd} text-[var(--text-strong)]`}>Colaboradores</h3>
                    <span className={`${T.helperText} ${S.meta} ml-auto text-[var(--text-muted)]`}>{members.length} miembros</span>
                </div>

                {membersLoading ? (
                    <div className="py-12 text-center flex items-center justify-center gap-2">
                        <Loader2 size={16} className="animate-spin text-[var(--brand-primary)]" />
                        <span className={`${T.helperText} ${S.body} text-[var(--text-muted)]`}>Cargando miembros...</span>
                    </div>
                ) : members.length === 0 ? (
                    <div className="py-12 text-center bg-[var(--bg-card)] rounded-2xl border border-dashed border-[var(--border-default)]">
                        <p className={`${T.helperText} ${S.body} text-[var(--text-muted)]`}>No hay miembros en esta organización.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className={`${T.tableHeader} ${S.meta} text-left border-b border-[var(--border-default)]`}>
                                    <th className="pb-4 px-4 font-black uppercase tracking-widest text-[var(--text-muted)]">Colaborador</th>
                                    <th className="pb-4 px-4 font-black uppercase tracking-widest text-[var(--text-muted)]">Rol</th>
                                    <th className="pb-4 px-4 font-black uppercase tracking-widest text-[var(--text-muted)]">Estado</th>
                                    <th className="pb-4 px-4 font-black uppercase tracking-widest text-[var(--text-muted)]">2FA</th>
                                    <th className="pb-4 px-4 font-black uppercase tracking-widest text-[var(--text-muted)]">Ingresó</th>
                                    {isAdmin && <th className="pb-4 px-4 text-right font-black uppercase tracking-widest text-[var(--text-muted)]">Acciones</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-default)]">
                                {members.map((member) => (
                                    <tr
                                        key={member.userId}
                                        className={`group hover:bg-[var(--bg-hover)]/30 transition-all ${member.status === 'SUSPENDED' ? 'opacity-60' : ''}`}
                                    >
                                        {/* Colaborador */}
                                        <td className="py-4 px-4">
                                            <div className="flex items-center gap-3">
                                                <div className="relative">
                                                    <img
                                                        src={member.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name || 'U')}&background=262626&color=ead018`}
                                                        alt={member.name}
                                                        className="w-9 h-9 rounded-xl object-cover border border-[var(--border-default)]"
                                                    />
                                                    {member.userId === currentUserId && (
                                                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-[var(--brand-primary)] rounded-full border border-[var(--bg-page)]" title="Tú" />
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className={`${T.tableCell} ${S.body} font-bold truncate text-[var(--text-strong)]`}>
                                                        {member.name}
                                                        {member.userId === currentUserId && (
                                                            <span className={`${T.badgeText} ${S.meta} ml-1.5 text-[var(--brand-primary)]/60 font-black uppercase`}> (tú)</span>
                                                        )}
                                                    </p>
                                                    <p className={`${T.helperText} ${S.meta} truncate text-[var(--text-muted)]`}>{member.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        {/* Rol */}
                                        <td className="py-4 px-4">
                                            <span className={`${T.badgeText} ${S.meta} font-black bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] px-2 py-1 rounded uppercase tracking-wider`}>
                                                {member.role}
                                            </span>
                                        </td>
                                        {/* Estado */}
                                        <td className="py-4 px-4">
                                            <StatusBadge status={member.status} />
                                        </td>
                                        {/* 2FA */}
                                        <td className="py-4 px-4">
                                            {member.twoFactorEnabled ? (
                                                <span className={`flex items-center gap-1 ${T.badgeText} ${S.meta} font-bold text-emerald-400`}>
                                                    <CheckCircle size={12} /> Activo
                                                </span>
                                            ) : (
                                                <span className={`${T.helperText} ${S.meta}`}>—</span>
                                            )}
                                        </td>
                                        {/* Fecha */}
                                        <td className={`py-4 px-4 ${T.tableCell} ${S.meta}`}>
                                            {new Date(member.joinedAt).toLocaleDateString('es-MX', {
                                                day: '2-digit', month: 'short', year: 'numeric'
                                            })}
                                        </td>
                                        {/* Acciones */}
                                        {isAdmin && (
                                            <td className="py-4 px-4 text-right">
                                                <RowActions
                                                    member={member}
                                                    currentUserId={currentUserId}
                                                    onSuspend={setSuspendTarget}
                                                    onReactivate={handleReactivate}
                                                    onImpersonate={handleImpersonate}
                                                    loadingId={actionLoadingId}
                                                />
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ── INVITACIONES PENDIENTES ── */}
            <div className="dashboard-card border-[var(--border-default)]">
                <div className="flex items-center gap-3 mb-6">
                    <Mail className="text-[var(--brand-primary)]" size={20} />
                    <h3 className={`${T.sectionTitle} ${S.headingMd} text-[var(--text-strong)]`}>Invitaciones Pendientes</h3>
                </div>

                {invitesLoading ? (
                    <div className="py-8 text-center flex items-center justify-center gap-2 animate-pulse">
                        <Loader2 size={14} className="animate-spin text-[var(--brand-primary)]" /> 
                        <span className={`${T.helperText} ${S.meta} text-[var(--text-muted)]`}>Cargando...</span>
                    </div>
                ) : invitations.length === 0 ? (
                    <div className="py-10 text-center bg-[var(--bg-card)] rounded-2xl border border-dashed border-[var(--border-default)]">
                        <p className={`${T.helperText} ${S.body} text-[var(--text-muted)]`}>No hay invitaciones pendientes.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className={`${T.tableHeader} ${S.meta} text-left border-b border-[var(--border-default)]`}>
                                    <th className="pb-4 px-4 font-black uppercase tracking-widest text-[var(--text-muted)]">Email</th>
                                    <th className="pb-4 px-4 font-black uppercase tracking-widest text-[var(--text-muted)]">Rol</th>
                                    <th className="pb-4 px-4 font-black uppercase tracking-widest text-[var(--text-muted)]">Expiración</th>
                                    <th className="pb-4 px-4 text-right font-black uppercase tracking-widest text-[var(--text-muted)]">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-default)]">
                                {invitations.map((invite: any) => (
                                    <tr key={invite.id} className="group hover:bg-[var(--bg-hover)]/30 transition-all">
                                        <td className="py-4 px-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-[var(--bg-surface)] flex items-center justify-center text-[var(--brand-primary)]">
                                                    <Mail size={14} />
                                                </div>
                                                <span className={`${T.tableCell} ${S.body} font-medium text-[var(--text-strong)]`}>{invite.email}</span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-4">
                                            <span className={`${T.badgeText} ${S.meta} font-black bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] px-2 py-1 rounded uppercase tracking-wider`}>
                                                {invite.role?.name || 'AGENT'}
                                            </span>
                                        </td>
                                        <td className={`py-4 px-4 ${T.tableCell} ${S.meta}`}>
                                            {new Date(invite.expiresAt).toLocaleDateString()}
                                        </td>
                                        <td className="py-4 px-4 text-right">
                                            <button
                                                onClick={() => handleRevoke(invite.id)}
                                                className="p-2 text-red-400 opacity-0 group-hover:opacity-100 hover:bg-red-400/10 rounded-lg transition-all"
                                                title="Revocar invitación"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ── MODAL INVITAR ── */}
            {isInviteOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-[#000]/80 backdrop-blur-sm" onClick={() => setIsInviteOpen(false)} />
                    <div className="relative bg-[var(--bg-card)] border border-[var(--border-default)] w-full max-w-md rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-200">
                        <h3 className={`${T.sectionTitle} ${S.headingLg} text-[var(--text-strong)] mb-2`}>Enviar <span className="text-[var(--brand-primary)]">Invitación</span></h3>
                        <p className={`${T.helperText} ${S.body} text-[var(--text-muted)] mb-6`}>El invitado recibirá un link de acceso por correo.</p>

                        <form onSubmit={handleInvite} className="space-y-6">
                            <div className="space-y-2">
                                <label className={`${T.labelText} ${S.meta} block mb-1 ml-1 text-[var(--text-muted)]`}>Email del Invitado</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={18} />
                                    <input
                                        type="email"
                                        required
                                        value={newInvite.email}
                                        onChange={(e) => setNewInvite({ ...newInvite, email: e.target.value })}
                                        className={`${T.inputText} ${S.body} w-full bg-[var(--bg-input)] border border-[var(--border-default)] rounded-2xl py-3.5 pl-12 pr-4 focus:border-[var(--brand-primary)] outline-none transition-all text-[var(--text-strong)]`}
                                        placeholder="ejemplo@empresa.com"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className={`${T.labelText} ${S.meta} block mb-1 ml-1 text-[var(--text-muted)]`}>Rol Asignado</label>
                                <div className="grid grid-cols-2 gap-4">
                                    {['SUPERVISOR', 'AGENT'].map((r) => (
                                        <div
                                            key={r}
                                            onClick={() => setNewInvite({ ...newInvite, role: r })}
                                            className={`cursor-pointer p-4 rounded-2xl border-2 transition-all text-center ${newInvite.role === r
                                                ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5'
                                                : 'border-[var(--border-default)] bg-[var(--bg-input)] hover:border-[var(--bg-hover)]'
                                                }`}
                                        >
                                            <Shield size={20} className={`mx-auto mb-2 ${newInvite.role === r ? 'text-[var(--brand-primary)]' : 'text-[var(--text-muted)]'}`} />
                                            <p className={`${T.cardTitle} ${S.meta} ${newInvite.role === r ? 'text-[var(--text-strong)]' : 'text-[var(--text-muted)]'}`}>
                                                {r === 'SUPERVISOR' ? 'Supervisor' : 'Agente'}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-4 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsInviteOpen(false)}
                                    className={`${T.buttonText} ${S.body} flex-1 py-3.5 rounded-2xl bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[var(--text-strong)] transition-all`}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={inviteMutation.isPending}
                                    className={`${T.buttonPrimaryText} ${S.body} flex-1 py-3.5 rounded-2xl bg-[var(--brand-primary)] hover:brightness-110 transition-all shadow-lg shadow-[var(--brand-primary)]/20 disabled:opacity-50 flex items-center justify-center gap-2`}
                                >
                                    {inviteMutation.isPending && <Loader2 size={16} className="animate-spin" />}
                                    Enviar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── MODAL SUSPENDER ── */}
            <SuspendModal
                member={suspendTarget}
                onConfirm={handleSuspendConfirm}
                onClose={() => setSuspendTarget(null)}
                isLoading={suspendMutation.isPending}
            />
        </div>
    );
};
