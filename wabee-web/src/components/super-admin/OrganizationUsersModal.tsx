import React, { useEffect, useState } from 'react';
import {
    Users, ShieldAlert, UserCheck, Loader2, X,
} from 'lucide-react';
import { OrganizationMember, superAdminOrgsApi } from '@/api/wabee/super-admin-orgs.api';
import { ImpersonationStore } from '@/lib/impersonation.store';
import { useToast } from '@/context/ToastContext';
import { T, S } from '@/lib/text-tokens';

interface OrganizationUsersModalProps {
    isOpen: boolean;
    onClose: () => void;
    organization: {
        id: string;
        name: string;
    } | null;
}

function MemberModalCard({
    member,
    impersonatingId,
    onImpersonate,
}: {
    member: OrganizationMember;
    impersonatingId: string | null;
    onImpersonate: (member: OrganizationMember) => void;
}) {
    return (
        <div className="rounded-[1.5rem] border border-[var(--border-default)] bg-[var(--bg-elevated)]/50 p-4">
            <div className="flex items-start gap-3">
                <img
                    src={member.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name || 'U')}&background=262626&color=ead018`}
                    alt={member.name}
                    className="h-10 w-10 shrink-0 rounded-xl border border-[var(--border-default)] object-cover"
                />
                <div className="min-w-0 flex-1">
                    <p className={`${T.tableCell} ${S.body} truncate font-bold text-[var(--text-strong)]`}>{member.name || 'Sin nombre'}</p>
                    <p className={`${T.helperText} ${S.meta} truncate text-[var(--text-muted)]`}>{member.email}</p>
                </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                    <p className={`${T.kpiLabel} ${S.meta} mb-1`}>Rol</p>
                    <span className={`${T.badgeText} ${S.meta} rounded px-2 py-1 font-black uppercase tracking-wider bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]`}>
                        {member.role}
                    </span>
                </div>
                <div>
                    <p className={`${T.kpiLabel} ${S.meta} mb-1`}>Estado</p>
                    <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${
                            member.status === 'active'
                                ? 'bg-[var(--state-success)] shadow-[0_0_8px_var(--state-success)]'
                                : 'bg-[var(--state-danger)] shadow-[0_0_8px_var(--state-danger)]'
                        }`} />
                        <span className={`${S.body} text-xs font-medium capitalize ${member.status === 'active' ? 'text-[var(--state-success)]' : 'text-[var(--state-danger)]'}`}>
                            {member.status}
                        </span>
                    </div>
                </div>
            </div>

            <div className="mt-4">
                {member.status === 'active' ? (
                    <button
                        onClick={() => onImpersonate(member)}
                        disabled={impersonatingId !== null}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand-primary)] px-4 py-2 shadow-lg shadow-[var(--brand-primary)]/20 transition-all hover:brightness-110 disabled:opacity-50"
                    >
                        {impersonatingId === member.userId ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
                        <span className={`${T.buttonPrimaryText} ${S.meta} font-black`}>
                            {impersonatingId === member.userId ? 'Iniciando...' : 'Suplantar'}
                        </span>
                    </button>
                ) : (
                    <span className={`${T.helperText} ${S.meta} italic text-[var(--text-muted)] opacity-50`}>Usuario no activo</span>
                )}
            </div>
        </div>
    );
}

export function OrganizationUsersModal({ isOpen, onClose, organization }: OrganizationUsersModalProps) {
    const [members, setMembers] = useState<OrganizationMember[]>([]);
    const [loading, setLoading] = useState(false);
    const [impersonatingId, setImpersonatingId] = useState<string | null>(null);
    const { success: toastSuccess, error: toastError } = useToast();

    useEffect(() => {
        if (isOpen && organization) {
            loadMembers();
        }
    }, [isOpen, organization]);

    const loadMembers = async () => {
        if (!organization) return;
        setLoading(true);
        try {
            const data = await superAdminOrgsApi.getMembers(organization.id);
            setMembers(data);
        } catch (error) {
            toastError('Error al cargar miembros');
        } finally {
            setLoading(false);
        }
    };

    const handleImpersonate = async (member: OrganizationMember) => {
        if (!organization) return;

        setImpersonatingId(member.userId);
        try {
            const response = await superAdminOrgsApi.impersonate(organization.id, member.userId);
            if (response.success && response.token) {
                ImpersonationStore.start({
                    realUser: localStorage.getItem('wabee_user'),
                    realRole: localStorage.getItem('wabee_role'),
                    impersonationToken: response.token,
                    targetUserId: member.userId,
                    targetUserName: member.name || member.email,
                    targetRole: member.role,
                    targetUser: {
                        id: member.userId,
                        email: member.email,
                        profile: { name: member.name },
                    },
                    orgId: organization.id,
                    orgName: organization.name,
                });

                toastSuccess(`Suplantando a ${member.email}`);
            }
        } catch (error: any) {
            toastError(error.response?.data?.error?.message || 'Error al iniciar suplantación');
        } finally {
            setImpersonatingId(null);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
            <div className="absolute inset-0 bg-black/80 shadow-2xl backdrop-blur-sm" onClick={onClose} />

            <div className="relative flex max-h-[100dvh] w-full flex-col overflow-hidden rounded-t-[2rem] border border-[var(--border-default)] bg-[var(--bg-card)] px-5 py-6 shadow-2xl sm:max-h-[85vh] sm:max-w-4xl sm:rounded-[2.5rem] sm:p-8">
                <div className="mb-5 flex items-start justify-between gap-3 sm:mb-6">
                    <div className="flex items-start gap-3 sm:items-center sm:gap-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--brand-primary)]/20 bg-[var(--brand-primary)]/10 sm:h-12 sm:w-12">
                            <Users className="h-5 w-5 text-[var(--brand-primary)] sm:h-6 sm:w-6" />
                        </div>
                        <div className="min-w-0">
                            <h3 className={`${T.sectionTitle} ${S.headingLg} text-[var(--text-strong)]`}>
                                Miembros de <span className="text-[var(--brand-primary)]">{organization?.name}</span>
                            </h3>
                            <p className={`${T.helperText} ${S.body} mt-1 text-[var(--text-muted)]`}>
                                Selecciona un usuario activo para suplantar su identidad y explorar el sistema desde su perspectiva.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-xl p-2 text-[var(--text-muted)] transition-all hover:bg-[var(--bg-hover)]"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="min-h-[320px] flex-1 overflow-y-auto pr-0 sm:pr-2">
                    {loading ? (
                        <div className="flex h-full flex-col items-center justify-center gap-3 py-10">
                            <Loader2 className="h-10 w-10 animate-spin text-[var(--brand-primary)]" />
                            <p className={`${T.helperText} ${S.body}`}>Cargando equipo administrativo...</p>
                        </div>
                    ) : members.length === 0 ? (
                        <div className="flex h-full flex-col items-center justify-center gap-3 py-10 opacity-40">
                            <ShieldAlert className="h-16 w-16" />
                            <p className={`${T.helperText} ${S.body}`}>No se encontraron miembros en esta organización</p>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 gap-4 lg:hidden">
                                {members.map((member) => (
                                    <MemberModalCard
                                        key={member.id}
                                        member={member}
                                        impersonatingId={impersonatingId}
                                        onImpersonate={handleImpersonate}
                                    />
                                ))}
                            </div>

                            <div className="hidden lg:block">
                                <table className="w-full min-w-[760px]">
                                    <thead>
                                        <tr className={`${T.tableHeader} ${S.meta} border-b border-[var(--border-default)] text-left`}>
                                            <th className="px-4 pb-4 font-black uppercase tracking-widest text-[var(--text-muted)]">Colaborador</th>
                                            <th className="px-4 pb-4 font-black uppercase tracking-widest text-[var(--text-muted)]">Rol</th>
                                            <th className="px-4 pb-4 font-black uppercase tracking-widest text-[var(--text-muted)]">Estado</th>
                                            <th className="px-4 pb-4 text-right font-black uppercase tracking-widest text-[var(--text-muted)]">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--border-default)]">
                                        {members.map((member) => (
                                            <tr key={member.id} className="group transition-all hover:bg-[var(--bg-hover)]/30">
                                                <td className="px-4 py-5">
                                                    <div className="flex items-center gap-3">
                                                        <img
                                                            src={member.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name || 'U')}&background=262626&color=ead018`}
                                                            alt={member.name}
                                                            className="h-10 w-10 rounded-xl border border-[var(--border-default)] object-cover"
                                                        />
                                                        <div className="min-w-0">
                                                            <p className={`${T.tableCell} ${S.body} truncate font-bold text-[var(--text-strong)]`}>{member.name || 'Sin nombre'}</p>
                                                            <p className={`${T.helperText} ${S.meta} truncate text-[var(--text-muted)]`}>{member.email}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-5">
                                                    <span className={`${T.badgeText} ${S.meta} rounded px-2 py-1 font-black uppercase tracking-wider bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]`}>
                                                        {member.role}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-5">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`h-2 w-2 rounded-full ${
                                                            member.status === 'active'
                                                                ? 'bg-[var(--state-success)] shadow-[0_0_8px_var(--state-success)]'
                                                                : 'bg-[var(--state-danger)] shadow-[0_0_8px_var(--state-danger)]'
                                                        }`} />
                                                        <span className={`${S.body} text-xs font-medium capitalize ${member.status === 'active' ? 'text-[var(--state-success)]' : 'text-[var(--state-danger)]'}`}>
                                                            {member.status}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-5 text-right">
                                                    {member.status === 'active' ? (
                                                        <button
                                                            onClick={() => handleImpersonate(member)}
                                                            disabled={impersonatingId !== null}
                                                            className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand-primary)] px-4 py-2 shadow-lg shadow-[var(--brand-primary)]/20 transition-all hover:brightness-110 disabled:opacity-50"
                                                        >
                                                            {impersonatingId === member.userId ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
                                                            <span className={`${T.buttonPrimaryText} ${S.meta} font-black`}>
                                                                {impersonatingId === member.userId ? 'Iniciando...' : 'Suplantar'}
                                                            </span>
                                                        </button>
                                                    ) : (
                                                        <span className={`${T.helperText} ${S.meta} italic text-[var(--text-muted)] opacity-50`}>
                                                            Usuario no activo
                                                        </span>
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
            </div>
        </div>
    );
}
