import React, { useState } from 'react';
import { T, S } from '@/lib/text-tokens';
import { ConnectChannelData } from '@/api/wabee/whatsapp.api';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: ConnectChannelData) => Promise<void>;
}

export default function ChannelFormModal({ isOpen, onClose, onSubmit }: Props) {
    const [formData, setFormData] = useState<ConnectChannelData>({
        name: '',
        wabaId: '',
        phoneNumberId: '',
        purpose: 'GENERAL',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await onSubmit(formData);
            setFormData({
                name: '',
                wabaId: '',
                phoneNumberId: '',
                purpose: 'GENERAL',
            });
            onClose();
        } catch (err: any) {
            setError(err.message || 'Error al conectar el canal');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-scale-in">
                <div className="p-8 border-b border-[var(--border-default)] sticky top-0 bg-[var(--bg-card)]/95 backdrop-blur-md z-10 flex justify-between items-start">
                    <div>
                        <h2 className={`${T.sectionTitle} ${S.displayMd} tracking-tighter uppercase`}>Conexión Manual</h2>
                        <p className={`${T.helperText} ${S.body} text-[color:var(--text-muted)] mt-1 font-medium`}>
                            Configura las credenciales de tu cuenta de WhatsApp Cloud API
                        </p>
                    </div>
                    <button onClick={onClose} className="text-[color:var(--text-muted)] hover:text-[color:var(--text-strong)] p-2 transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 text-red-500 px-5 py-4 rounded-2xl flex items-center gap-3 animate-shake">
                            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            <span className="text-sm font-bold">{error}</span>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <label className={`${T.labelText} ${S.meta} block text-[color:var(--text-muted)] uppercase tracking-widest mb-2`}>
                                Nombre del Canal
                            </label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                                className="w-full px-4 py-3 bg-[var(--bg-page)] border border-[var(--border-default)] text-[color:var(--text-strong)] rounded-xl focus:ring-2 focus:ring-[var(--brand-primary)]/50 focus:border-[var(--brand-primary)] outline-none transition-all placeholder:text-[color:var(--text-muted)]"
                                placeholder="Ej: Soporte Principal"
                            />
                        </div>

                        <div>
                            <label className={`${T.labelText} ${S.meta} block text-[color:var(--text-muted)] uppercase tracking-widest mb-2`}>
                                WABA ID
                            </label>
                            <input
                                type="text"
                                name="wabaId"
                                value={formData.wabaId}
                                onChange={(e) => setFormData({ ...formData, wabaId: e.target.value })}
                                required
                                className="w-full px-4 py-3 bg-[var(--bg-page)] border border-[var(--border-default)] text-[color:var(--text-strong)] rounded-xl focus:ring-2 focus:ring-[var(--brand-primary)]/50 focus:border-[var(--brand-primary)] outline-none transition-all placeholder:text-[color:var(--text-muted)] font-mono text-sm"
                                placeholder="123456789012345"
                            />
                        </div>

                        <div>
                            <label className={`${T.labelText} ${S.meta} block text-[color:var(--text-muted)] uppercase tracking-widest mb-2`}>
                                Phone Number ID
                            </label>
                            <input
                                type="text"
                                name="phoneNumberId"
                                value={formData.phoneNumberId}
                                onChange={(e) => setFormData({ ...formData, phoneNumberId: e.target.value })}
                                required
                                className="w-full px-4 py-3 bg-[var(--bg-page)] border border-[var(--border-default)] text-[color:var(--text-strong)] rounded-xl focus:ring-2 focus:ring-[var(--brand-primary)]/50 focus:border-[var(--brand-primary)] outline-none transition-all placeholder:text-[color:var(--text-muted)] font-mono text-sm"
                                placeholder="123456789012345"
                            />
                        </div>
                    </div>

                    <div className="bg-[var(--brand-primary)]/5 border border-[var(--brand-primary)]/20 p-5 rounded-2xl flex gap-4">
                        <div className="p-2 bg-[var(--brand-primary)]/10 rounded-lg h-fit">
                            <svg className="w-5 h-5 text-[color:var(--brand-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <p className={`${T.helperText} ${S.meta} text-[color:var(--text-muted)] leading-relaxed`}>
                            <strong className="text-[color:var(--brand-primary)] font-bold uppercase tracking-tighter">Nota:</strong> No necesitas ingresar el Access Token. El sistema usará automáticamente la sesión vinculada durante el proceso de OAuth de Meta.
                        </p>
                    </div>

                    <div className="flex gap-4 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="flex-1 px-4 py-4 bg-[var(--bg-elevated)] rounded-2xl transition-all disabled:opacity-50 active:scale-95"
                        >
                            <span className={`${T.buttonText} ${S.body} text-[color:var(--text-muted)] hover:text-[color:var(--text-strong)]`}>Cancelar</span>
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-4 bg-[var(--brand-primary)] rounded-2xl transition-all shadow-xl shadow-[var(--brand-primary)]/10 disabled:opacity-50 active:scale-95"
                        >
                            <span className={`${T.buttonPrimaryText} ${S.body} text-[var(--brand-primary-foreground)]`}>
                                {loading ? (
                                    <div className="flex items-center justify-center gap-2">
                                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        <span>Conectando</span>
                                    </div>
                                ) : 'Vincular'}
                            </span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
