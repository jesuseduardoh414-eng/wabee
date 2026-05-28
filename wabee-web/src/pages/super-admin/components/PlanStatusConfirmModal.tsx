
import React, { useState } from 'react';
import { Play, EyeOff, Archive, AlertCircle, X, Loader2 } from 'lucide-react';
import { T, S } from '@/lib/text-tokens';
import { Plan } from '@/api/wabee/plans.api';

interface PlanStatusConfirmModalProps {
    plan: Plan;
    action: 'publish' | 'withdraw' | 'archive';
    onClose: () => void;
    onConfirm: () => Promise<void>;
}

export const PlanStatusConfirmModal: React.FC<PlanStatusConfirmModalProps> = ({ 
    plan, 
    action, 
    onClose, 
    onConfirm 
}) => {
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const isPublish = action === 'publish';
    const isWithdraw = action === 'withdraw';
    const isArchive = action === 'archive';

    const getIcon = () => {
        if (isPublish) return <Play className="text-[var(--state-success)]" size={32} fill="currentColor" />;
        if (isWithdraw) return <EyeOff className="text-[var(--state-warning)]" size={32} />;
        return <Archive className="text-[var(--state-warning)]" size={32} />;
    };

    const getTitle = () => {
        if (isPublish) return 'Publicar Plan';
        if (isWithdraw) return 'Retirar del Catálogo';
        return 'Archivar Plan';
    };

    const getMessage = () => {
        if (isPublish) return <>¿Estás seguro de que deseas <strong className="text-[var(--text-strong)] font-bold">PUBLICAR</strong> el plan <strong className="text-[var(--text-strong)]">{plan.name}</strong> en el catálogo público?</>;
        if (isWithdraw) return <>¿Estás seguro de que deseas <strong className="text-[var(--text-strong)] font-bold">RETIRAR</strong> el plan <strong className="text-[var(--text-strong)]">{plan.name}</strong> del catálogo?</>;
        return <>¿Estás seguro de que deseas <strong className="text-[var(--text-strong)] font-bold">ARCHIVAR</strong> el plan <strong className="text-[var(--text-strong)]">{plan.name}</strong>? Se retirará de la vista base.</>;
    };

    const getConfirmText = () => {
        if (isPublish) return 'Sí, Publicar';
        if (isWithdraw) return 'Sí, Retirar';
        return 'Sí, Archivar';
    };

    const getConfirmColor = () => {
        if (isPublish) return 'bg-[var(--state-success)] shadow-[var(--state-success)]/20';
        return 'bg-[var(--state-warning)] shadow-[var(--state-warning)]/20';
    };

    const handleConfirm = async () => {
        try {
            setLoading(true);
            setErrorMsg(null);
            await onConfirm();
            onClose();
        } catch (e: any) {
            setErrorMsg(e.response?.data?.error?.message || 'Error al procesar la acción');
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-[2.5rem] w-full max-w-md shadow-2xl p-10 relative animate-in zoom-in-95 duration-300 translate-y-[-10%]">
                <button onClick={onClose} disabled={loading} className="absolute top-8 right-8 p-2 rounded-full hover:bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-strong)] transition-colors">
                    <X size={20} />
                </button>
                
                <div className="mb-8 flex justify-center">
                    <div className={`w-24 h-24 rounded-full flex items-center justify-center border-4 ${
                        isPublish ? 'bg-[var(--state-success)]/10 border-[var(--state-success)]/5' : 'bg-[var(--state-warning)]/10 border-[var(--state-warning)]/5'
                    }`}>
                        {getIcon()}
                    </div>
                </div>

                <h2 className={`${T.cardTitle} ${S.displaySm} text-center mb-4 font-black tracking-tight`}>{getTitle()}</h2>
                <div className={`${T.helperText} ${S.body} text-center text-[var(--text-muted)] mb-10 leading-relaxed`}>
                    {getMessage()}
                </div>

                {errorMsg && (
                    <div className="mb-8 p-4 rounded-2xl bg-[var(--state-danger)]/10 border border-[var(--state-danger)]/20 flex gap-3 text-[var(--state-danger)]">
                        <AlertCircle size={20} className="shrink-0 mt-0.5" />
                        <p className={`${T.menuText} ${S.body}`}>{errorMsg}</p>
                    </div>
                )}

                <div className="flex gap-4">
                    <button 
                        onClick={onClose} 
                        disabled={loading}
                        className={`flex-1 py-4 px-6 rounded-2xl border border-[var(--border-default)] hover:border-[var(--text-muted)] hover:bg-[var(--bg-surface)] ${T.buttonText} ${S.body} transition-all text-[var(--text-strong)] font-bold`}
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleConfirm}
                        disabled={loading}
                        className={`flex-1 py-4 px-6 rounded-2xl text-white ${getConfirmColor()} hover:opacity-90 ${T.buttonPrimaryText} ${S.body} flex items-center justify-center gap-2 transition-all shadow-xl font-bold`}
                    >
                        {loading ? <Loader2 size={20} className="animate-spin" /> : getConfirmText()}
                    </button>
                </div>
            </div>
        </div>
    );
};
