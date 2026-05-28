import React, { useState } from 'react';
import { Trash2, AlertCircle, X, Loader2 } from 'lucide-react';
import { T, S } from '@/lib/text-tokens';
import { Plan } from '@/api/wabee/plans.api';

interface DeletePlanModalProps {
    plan: Plan;
    onClose: () => void;
    onConfirm: () => Promise<void>;
}

export const DeletePlanModal: React.FC<DeletePlanModalProps> = ({ plan, onClose, onConfirm }) => {
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const handleConfirm = async () => {
        try {
            setLoading(true);
            setErrorMsg(null);
            await onConfirm();
        } catch (e: any) {
            setErrorMsg(e.response?.data?.error?.message || 'Error al eliminar el plan');
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-[2rem] w-full max-w-md shadow-2xl p-8 relative animate-in zoom-in-95 duration-200">
                <button onClick={onClose} disabled={loading} className="absolute top-6 right-6 p-2 rounded-full hover:bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-strong)] transition-colors">
                    <X size={20} />
                </button>
                
                <div className="mb-6 flex justify-center">
                    <div className="w-20 h-20 rounded-full bg-[var(--state-danger)]/10 flex items-center justify-center border-4 border-[var(--state-danger)]/5">
                        <Trash2 className="text-[var(--state-danger)]" size={32} />
                    </div>
                </div>

                <h2 className={`${T.cardTitle} ${S.displaySm} text-center mb-3`}>Eliminar Plan</h2>
                <p className={`${T.helperText} ${S.body} text-center text-[var(--text-muted)] mb-8 max-w-[90%] mx-auto`}>
                    ¿Estás seguro de que deseas eliminar lógicamente el plan <strong className="text-[var(--text-strong)]">{plan.name}</strong>?
                    <br/><br/>
                    Esta acción lo ocultará de la vista base permanentemente.
                </p>

                {errorMsg && (
                    <div className="mb-8 p-4 rounded-xl bg-[var(--state-danger)]/10 border border-[var(--state-danger)]/20 flex gap-3 text-[var(--state-danger)]">
                        <AlertCircle size={20} className="shrink-0 mt-0.5" />
                        <p className={`${T.menuText} ${S.body}`}>{errorMsg}</p>
                    </div>
                )}

                <div className="flex gap-4">
                    <button 
                        onClick={onClose} 
                        disabled={loading}
                        className={`flex-1 py-3.5 px-4 rounded-xl border border-[var(--border-default)] hover:border-[var(--text-muted)] hover:bg-[var(--bg-surface)] ${T.buttonText} ${S.body} transition-colors text-[var(--text-strong)]`}
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleConfirm}
                        disabled={loading}
                        className={`flex-1 py-3.5 px-4 rounded-xl bg-[var(--state-danger)] text-white hover:bg-[var(--state-danger)]/90 ${T.buttonPrimaryText} ${S.body} flex items-center justify-center gap-2 transition-colors shadow-lg shadow-[var(--state-danger)]/20`}
                    >
                        {loading ? <Loader2 size={18} className="animate-spin" /> : 'Sí, Eliminar'}
                    </button>
                </div>
            </div>
        </div>
    );
};
