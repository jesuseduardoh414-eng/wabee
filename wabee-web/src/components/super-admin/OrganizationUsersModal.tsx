import React, { useEffect, useState } from 'react';
import { 
    Users, ShieldAlert, UserCheck, Loader2, X, Shield, Mail
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
            toastError("Error al cargar miembros");
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
                    realToken: localStorage.getItem('wabee_token') || '',
                    realUser: localStorage.getItem('wabee_user'),
                    realRole: localStorage.getItem('wabee_role'),
                    impersonationToken: response.token,
                    targetUserId: member.userId,
                    targetUserName: member.name || member.email,
                    targetRole: member.role,
                    targetUser: {
                        id: member.userId,
                        email: member.email,
                        profile: { name: member.name }
                    },
                    orgId: organization.id,
                    orgName: organization.name
                });
                
                toastSuccess(`Suplantando a ${member.email}`);
                
                // ImpersonationStore.start() ahora dispara window.location.href automáticamente
            }
        } catch (error: any) {
            toastError(error.response?.data?.error?.message || "Error al iniciar suplantación");
        } finally {
            setImpersonatingId(null);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm shadow-2xl" onClick={onClose} />
            
            <div className="relative bg-[var(--bg-card)] border border-[var(--border-default)] w-full max-w-4xl max-h-[85vh] rounded-[2.5rem] p-8 shadow-2xl flex flex-col animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-[var(--brand-primary)]/10 border border-[var(--brand-primary)]/20 flex items-center justify-center">
                            <Users className="w-6 h-6 text-[var(--brand-primary)]" />
                        </div>
                        <div>
                            <h3 className={`${T.sectionTitle} ${S.headingLg} text-[var(--text-strong)]`}>
                                Miembros de <span className="text-[var(--brand-primary)]">{organization?.name}</span>
                            </h3>
                            <p className={`${T.helperText} ${S.body} text-[var(--text-muted)] mt-1`}>
                                Selecciona un usuario activo para suplantar su identidad y explorar el sistema desde su perspectiva.
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 rounded-xl hover:bg-[var(--bg-hover)] text-[var(--text-muted)] transition-all"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto min-h-[350px] pr-2">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-full gap-3 py-10">
                            <Loader2 className="w-10 h-10 animate-spin text-[var(--brand-primary)]" />
                            <p className={`${T.helperText} ${S.body}`}>Cargando equipo administrativo...</p>
                        </div>
                    ) : members.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full gap-3 py-10 opacity-40">
                            <ShieldAlert className="w-16 h-16" />
                            <p className={`${T.helperText} ${S.body}`}>No se encontraron miembros en esta organización</p>
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead>
                                <tr className={`${T.tableHeader} ${S.meta} text-left border-b border-[var(--border-default)]`}>
                                    <th className="pb-4 px-4 font-black uppercase tracking-widest text-[var(--text-muted)]">Colaborador</th>
                                    <th className="pb-4 px-4 font-black uppercase tracking-widest text-[var(--text-muted)]">Rol</th>
                                    <th className="pb-4 px-4 font-black uppercase tracking-widest text-[var(--text-muted)]">Estado</th>
                                    <th className="pb-4 px-4 text-right font-black uppercase tracking-widest text-[var(--text-muted)]">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-default)]">
                                {members.map((member) => (
                                    <tr key={member.id} className="group hover:bg-[var(--bg-hover)]/30 transition-all">
                                        <td className="py-5 px-4">
                                            <div className="flex items-center gap-3">
                                                <div className="relative">
                                                    <img
                                                        src={member.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name || 'U')}&background=262626&color=ead018`}
                                                        alt={member.name}
                                                        className="w-10 h-10 rounded-xl object-cover border border-[var(--border-default)]"
                                                    />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className={`${T.tableCell} ${S.body} font-bold text-[var(--text-strong)] truncate`}>
                                                        {member.name || 'Sin Nombre'}
                                                    </p>
                                                    <p className={`${T.helperText} ${S.meta} text-[var(--text-muted)] truncate`}>
                                                        {member.email}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-5 px-4">
                                            <span className={`${T.badgeText} ${S.meta} font-black bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] px-2 py-1 rounded uppercase tracking-wider`}>
                                                {member.role}
                                            </span>
                                        </td>
                                        <td className="py-5 px-4">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${
                                                    member.status === 'active' 
                                                    ? 'bg-[var(--state-success)] shadow-[0_0_8px_var(--state-success)]' 
                                                    : 'bg-[var(--state-danger)] shadow-[0_0_8px_var(--state-danger)]'
                                                }`} />
                                                <span className={`${S.body} font-medium capitalize text-xs ${
                                                    member.status === 'active' ? 'text-[var(--state-success)]' : 'text-[var(--state-danger)]'
                                                }`}>
                                                    {member.status}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-5 px-4 text-right">
                                            {member.status === 'active' ? (
                                                <button 
                                                    onClick={() => handleImpersonate(member)}
                                                    disabled={impersonatingId !== null}
                                                    className="inline-flex items-center gap-2 bg-[var(--brand-primary)] px-4 py-2 rounded-xl hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-[var(--brand-primary)]/20 disabled:opacity-50"
                                                >
                                                    {impersonatingId === member.userId ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <UserCheck className="w-4 h-4" />
                                                    )}
                                                    <span className={`${T.buttonPrimaryText} ${S.meta} font-black`}>
                                                        {impersonatingId === member.userId ? 'Iniciando...' : 'Suplantar'}
                                                    </span>
                                                </button>
                                            ) : (
                                                <span className={`${T.helperText} ${S.meta} italic text-[var(--text-muted)] opacity-50`}>
                                                    Usuario no-activo
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
