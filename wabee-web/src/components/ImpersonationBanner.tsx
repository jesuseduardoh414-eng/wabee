import React, { useState, useEffect } from 'react';
import { ShieldAlert, X, UserCheck } from 'lucide-react';
import { ImpersonationStore } from '../lib/impersonation.store';
import { useToast } from '../context/ToastContext';
import client from '../api/client';

/**
 * ImpersonationBanner
 * Banner fijo en la parte superior del DashboardLayout.
 * Solo visible cuando hay una sesión de suplantación activa.
 * Al salir: llama al endpoint /stop, restaura el token real y recarga.
 */
export const ImpersonationBanner: React.FC = () => {
    const [state, setState] = useState(ImpersonationStore.get());
    const [isStopping, setIsStopping] = useState(false);
    const { error: toastError } = useToast();

    // Re-verificar si el estado de impersonación cambia (ej. el store se limpia externamente)
    useEffect(() => {
        const refresh = () => setState(ImpersonationStore.get());
        window.addEventListener('storage', refresh);
        return () => window.removeEventListener('storage', refresh);
    }, []);

    if (!state || !state.isImpersonating) return null;

    const handleStop = async () => {
        if (isStopping) return;
        setIsStopping(true);
        try {
            await client.post(`/orgs/${state.orgId}/impersonation/stop`);
        } catch (err: any) {
            const code = err.response?.data?.error?.code;
            // Si el backend ya terminó la sesión automáticamente, simplemente restauramos
            if (code !== 'IMPERSONATION_ENDED' && code !== 'STOP_ERROR') {
                toastError('Error al detener suplantación. Restaurando sesión manualmente.');
            }
        } finally {
            ImpersonationStore.stop();
            window.location.reload();
        }
    };

    const displayName = state.targetUserName || state.targetUserId.slice(0, 8);

    return (
        <div className="flex items-center justify-between gap-4 px-4 py-2.5 bg-gradient-to-r from-amber-500/20 via-amber-400/10 to-amber-500/20 border-b-2 border-amber-400/40 backdrop-blur-sm animate-in slide-in-from-top duration-300">
            {/* Icono + texto */}
            <div className="flex items-center gap-3 min-w-0">
                <div className="shrink-0 w-7 h-7 rounded-full bg-amber-400/20 border border-amber-400/50 flex items-center justify-center">
                    <ShieldAlert size={14} className="text-amber-400" />
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-bold text-amber-200 leading-tight truncate">
                        Modo Suplantación Activo
                    </p>
                    <p className="text-xs text-amber-400/80 truncate">
                        Navegando como&nbsp;
                        <span className="font-black text-amber-300">{displayName}</span>
                        &nbsp;— Todas las acciones son auditadas con tu identidad real.
                    </p>
                </div>
            </div>

            {/* Botón salir */}
            <button
                onClick={handleStop}
                disabled={isStopping}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs bg-amber-400 text-[#121208] hover:bg-amber-300 transition-all disabled:opacity-60 disabled:cursor-wait shadow-lg shadow-amber-400/20"
                id="impersonation-stop-btn"
            >
                {isStopping ? (
                    <span className="animate-spin inline-block w-3 h-3 border border-[#121208] border-t-transparent rounded-full" />
                ) : (
                    <UserCheck size={13} />
                )}
                {isStopping ? 'Saliendo...' : 'Salir de suplantación'}
            </button>
        </div>
    );
};
