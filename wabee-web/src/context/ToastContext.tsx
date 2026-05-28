import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Info, XCircle, X } from 'lucide-react';

export type ToastSeverity = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
    id: string;
    message: string;
    severity: ToastSeverity;
    duration?: number;
}

interface ToastContextValue {
    showToast: (message: string, severity: ToastSeverity, duration?: number) => void;
    success: (message: string, duration?: number) => void;
    error: (message: string, duration?: number) => void;
    warning: (message: string, duration?: number) => void;
    info: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) throw new Error('useToast must be used within a ToastProvider');
    return context;
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const showToast = useCallback((message: string, severity: ToastSeverity, duration: number = 4000) => {
        const id = Math.random().toString(36).substring(2, 9);
        const newToast: ToastMessage = { id, message, severity, duration };

        setToasts((prev) => [...prev, newToast]);

        if (duration > 0) {
            setTimeout(() => removeToast(id), duration);
        }
    }, [removeToast]);

    const success = useCallback((message: string, duration?: number) => showToast(message, 'success', duration), [showToast]);
    const error = useCallback((message: string, duration: number = 6000) => showToast(message, 'error', duration), [showToast]);
    const warning = useCallback((message: string, duration?: number) => showToast(message, 'warning', duration), [showToast]);
    const info = useCallback((message: string, duration?: number) => showToast(message, 'info', duration), [showToast]);

    const value = { showToast, success, error, warning, info };

    return (
        <ToastContext.Provider value={value}>
            {children}
            <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
                {toasts.map((toast) => (
                    <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
                ))}
            </div>
        </ToastContext.Provider>
    );
};

const ToastItem: React.FC<{ toast: ToastMessage; onClose: () => void }> = ({ toast, onClose }) => {
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    const getStyles = () => {
        switch (toast.severity) {
            case 'success':
                return 'bg-[#1c2a1c] border-[#22c55e]/30 text-[#22c55e]';
            case 'error':
                return 'bg-[#2a1c1c] border-red-500/30 text-red-500';
            case 'warning':
                return 'bg-[#2a2a11] border-[#ead018]/30 text-[#ead018]';
            case 'info':
            default:
                return 'bg-[#1c1c2a] border-[#3b82f6]/30 text-[#3b82f6]';
        }
    };

    const getIcon = () => {
        switch (toast.severity) {
            case 'success': return <CheckCircle size={20} className="shrink-0" />;
            case 'error': return <XCircle size={20} className="shrink-0" />;
            case 'warning': return <AlertTriangle size={20} className="shrink-0" />;
            case 'info':
            default: return <Info size={20} className="shrink-0" />;
        }
    };

    return (
        <div
            role="alert"
            aria-live="assertive"
            className={`pointer-events-auto flex items-start gap-3 px-5 py-4 rounded-2xl shadow-2xl border backdrop-blur-md animate-in slide-in-from-right-8 fade-in duration-300 w-80 max-w-full ${getStyles()}`}
        >
            {getIcon()}
            <p className="text-sm font-bold flex-1 leading-snug break-words mt-0.5">{toast.message}</p>
            <button
                onClick={onClose}
                className="opacity-70 hover:opacity-100 transition-opacity p-1 -mr-2 -mt-1 shrink-0"
                aria-label="Cerrar notificación"
            >
                <X size={16} />
            </button>
        </div>
    );
};
