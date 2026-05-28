import React, { useState, useEffect } from 'react';
import { ShieldAlert, UserCheck, Loader2 } from 'lucide-react';
import { superAdminOrgsApi, CurrentImpersonation, GetOrganizationsParams 
} from '../api/wabee/super-admin-orgs.api';
import { ImpersonationStore } from '../lib/impersonation.store';
import { useToast } from '../context/ToastContext';

export const SuperAdminImpersonationBanner: React.FC = () => {
    const { success: toastSuccess, error: toastError } = useToast();
    // Fast initial check using the centralized store
    const [isImpersonating, setIsImpersonating] = useState(ImpersonationStore.isActive());
    const [impersonationData, setImpersonationData] = useState<CurrentImpersonation['data'] | null>(null);
    const [isStopping, setIsStopping] = useState(false);
    const [isValidating, setIsValidating] = useState(false);

    useEffect(() => {
        if (isImpersonating) {
            validateSession();
        }
    }, []);

    const validateSession = async () => {
        setIsValidating(true);
        try {
            const status = await superAdminOrgsApi.getImpersonationCurrent();
            if (status.success && status.isImpersonating && status.data) {
                setImpersonationData(status.data);
            } else {
                // El backend dice que ya no somos impersonators o la sesión expiró/invalidó
                ImpersonationStore.stop();
                setIsImpersonating(false);
                if (status.reason) {
                    toastError(`Sesión de suplantación finalizada: ${status.reason}`);
                }
            }
        } catch (error) {
            console.error("Error validating impersonation session", error);
        } finally {
            setIsValidating(false);
        }
    };

    const handleStop = async () => {
        if (isStopping) return;
        setIsStopping(true);
        try {
            await superAdminOrgsApi.stopImpersonation();
            ImpersonationStore.stop();
            setIsImpersonating(false);
            toastSuccess('Has vuelto a tu sesión de Super Admin');
        } catch (err: any) {
            toastError(err.response?.data?.error?.message || 'Error al detener suplantación.');
            // Forzar limpieza local si falla el server
            ImpersonationStore.forceClean();
            setIsImpersonating(false);
            window.location.href = '/dashboard';
        } finally {
            setIsStopping(false);
        }
    };

    if (!isImpersonating) return null;

    return (
        <div className="flex items-center justify-between gap-4 px-4 py-2 bg-gradient-to-r from-orange-600/90 via-red-600/90 to-orange-600/90 border-b border-orange-400/30 backdrop-blur-md sticky top-0 z-[100] shadow-xl animate-in slide-in-from-top duration-500">
            <div className="flex items-center gap-3 min-w-0">
                <div className="shrink-0 w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center shadow-inner">
                    {isValidating ? (
                        <Loader2 size={14} className="text-white animate-spin" />
                    ) : (
                        <ShieldAlert size={16} className="text-white animate-pulse" />
                    )}
                </div>
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="text-xs font-black text-white uppercase tracking-widest leading-none">
                            MODO SUPLANTACIÓN ACTIVO
                        </p>
                        {impersonationData?.effectiveRole && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/20 text-orange-100 font-bold border border-white/10 uppercase">
                                {impersonationData.effectiveRole}
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-orange-50 font-medium truncate mt-0.5">
                        {impersonationData ? (
                            <>Viendo como <span className="font-bold underline decoration-white/30">{impersonationData.targetUserEmail}</span> en <span className="font-bold underline italic opacity-90">{impersonationData.impersonatedOrgName}</span></>
                        ) : (
                            "Validando identidad suplantada..."
                        )}
                    </p>
                </div>
            </div>

            <button
                onClick={handleStop}
                disabled={isStopping}
                className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-full font-bold text-xs bg-white text-red-600 hover:bg-orange-50 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-wait shadow-lg shadow-black/20 group"
            >
                {isStopping ? (
                    <Loader2 size={13} className="animate-spin" />
                ) : (
                    <UserCheck size={14} className="group-hover:rotate-12 transition-transform" />
                )}
                {isStopping ? 'Restaurando...' : 'Finalizar Suplantación'}
            </button>
        </div>
    );
};
