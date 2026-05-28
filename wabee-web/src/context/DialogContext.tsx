import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { AlertTriangle, Info, CheckCircle, HelpCircle } from 'lucide-react';
import { T, S } from '@/lib/text-tokens';

export interface DialogOptions {
    title: string;
    description?: ReactNode;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
    type?: 'confirm' | 'info';
    content?: ReactNode; // Componente personalizado para renderizar
}

interface DialogContextValue {
    confirm: (options: DialogOptions) => Promise<boolean>;
    info: (options: DialogOptions) => Promise<void>;
}

const DialogContext = createContext<DialogContextValue | undefined>(undefined);

export const useDialog = () => {
    const context = useContext(DialogContext);
    if (!context) throw new Error('useDialog must be used within DialogProvider');
    return context;
};

export const DialogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [options, setOptions] = useState<DialogOptions | null>(null);
    const [resolver, setResolver] = useState<{ resolve: (value: boolean) => void } | null>(null);

    const confirm = useCallback((opts: DialogOptions): Promise<boolean> => {
        return new Promise((resolve) => {
            setOptions({ ...opts, type: 'confirm' });
            setResolver({ resolve });
            setIsOpen(true);
        });
    }, []);

    const info = useCallback((opts: Omit<DialogOptions, 'type'>): Promise<void> => {
        return new Promise((resolve) => {
            setOptions({ ...opts, type: 'info', cancelText: 'Cerrar' });
            // Pasamos un wrapper en lugar de una function, porque el state guarda objetos
            setResolver({ resolve: () => resolve() });
            setIsOpen(true);
        });
    }, []);

    const handleClose = useCallback((value: boolean) => {
        setIsOpen(false);
        if (resolver) resolver.resolve(value);
    }, [resolver]);

    const getIcon = () => {
        if (!options) return null;
        if (options.type === 'info') return <Info className="text-blue-400 w-6 h-6" />;
        if (options.isDestructive) return <AlertTriangle className="text-[var(--state-danger)] w-6 h-6" />;
        return <HelpCircle className="text-[var(--brand-primary)] w-6 h-6" />;
    };

    const getIconBg = () => {
        if (!options) return {};
        if (options.type === 'info') return { backgroundColor: 'color-mix(in srgb, #60a5fa 20%, transparent)', color: '#60a5fa' };
        if (options.isDestructive) return { backgroundColor: 'color-mix(in srgb, var(--state-danger) 20%, transparent)', color: 'var(--state-danger)' };
        return { backgroundColor: 'color-mix(in srgb, var(--brand-primary) 20%, transparent)', color: 'var(--brand-primary)' };
    };

    return (
        <DialogContext.Provider value={{ confirm, info }}>
            {children}

            <Transition show={isOpen} as={React.Fragment}>
                <Dialog as="div" className="relative z-[9999]" onClose={() => handleClose(false)}>
                    <Transition.Child
                        as={React.Fragment}
                        enter="ease-out duration-300"
                        enterFrom="opacity-0"
                        enterTo="opacity-100"
                        leave="ease-in duration-200"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                    >
                        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
                    </Transition.Child>

                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-4 text-center">
                            <Transition.Child
                                as={React.Fragment}
                                enter="ease-out duration-300"
                                enterFrom="opacity-0 scale-95"
                                enterTo="opacity-100 scale-100"
                                leave="ease-in duration-200"
                                leaveFrom="opacity-100 scale-100"
                                leaveTo="opacity-0 scale-95"
                            >
                                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-3xl bg-[var(--bg-card)] border border-[var(--border-default)] p-8 text-left align-middle shadow-2xl transition-all">
                                    <div className="flex items-start gap-4">
                                        <div className="shrink-0 rounded-full p-3" style={getIconBg()}>
                                            {getIcon()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <Dialog.Title as="h3" className={`${T.sectionTitle} ${S.headingSm} mb-2`}>
                                                {options?.title}
                                            </Dialog.Title>

                                            {options?.description && (
                                                <div className="mt-2">
                                                    {typeof options.description === 'string' ? (
                                                        <p className={`${T.sectionSubtitle} ${S.body}`}>{options.description}</p>
                                                    ) : (
                                                        options.description
                                                    )}
                                                </div>
                                            )}

                                            {options?.content && (
                                                <div className="mt-4 bg-[var(--bg-input)] rounded-xl border border-[var(--border-default)] p-4 max-h-64 overflow-y-auto text-sm text-[color:var(--tx-helperText-color)] font-mono break-words">
                                                    {options.content}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-8 flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
                                        <button
                                            type="button"
                                            className={`inline-flex justify-center rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-6 py-3.5 ${T.buttonText} ${S.body} text-[color:var(--tx-helperText-color)] hover:text-[var(--brand-primary)] align-middle transition-all`}
                                            onClick={() => handleClose(false)}
                                        >
                                            <span style={{ height: '20px', display: 'flex', alignItems: 'center' }}>
                                                {options?.cancelText || 'Cancelar'}
                                            </span>
                                        </button>

                                        {options?.type === 'confirm' && (
                                            <button
                                                type="button"
                                                className={`inline-flex justify-center rounded-2xl border border-transparent px-6 py-3.5 transition-all shadow-lg ${T.buttonPrimaryText} ${S.body} align-middle ${options.isDestructive
 ? 'bg-[var(--state-danger)] text-white hover:brightness-110 shadow-red-500/20'
 : 'bg-[var(--brand-primary)] hover:scale-[1.02] shadow-2xl'
 }`}
                                                onClick={() => handleClose(true)}
                                            >
                                                <span style={{ height: '20px', display: 'flex', alignItems: 'center' }}>
                                                    {options?.confirmText || 'Confirmar'}
                                                </span>
                                            </button>
                                        )}
                                    </div>
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </Dialog>
            </Transition>
        </DialogContext.Provider>
    );
};
