import React, { useState } from 'react';
import { contactsApi } from '@/api/wabee/contacts.api';
import { X, User, Phone, Mail, Tag, ArrowRight } from 'lucide-react';
import { T, S } from '@/lib/text-tokens';

interface CreateContactModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

export const CreateContactModal: React.FC<CreateContactModalProps> = ({ onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: '',
        tags: ''
    });

    const isPhoneValid = (phone: string) => {
        return /^\+?[1-9]\d{1,14}$/.test(phone.replace(/\s+/g, ''));
    };

    const handleCreate = async () => {
        if (!formData.name || !formData.phone) {
            setError('Nombre y teléfono son obligatorios.');
            return;
        }

        if (!isPhoneValid(formData.phone)) {
            setError('Formato de teléfono inválido. Usa +52...');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const cleanedData: any = {
                name: formData.name.trim(),
                phone: formData.phone.trim().replace(/\s+/g, ''),
                status: 'ACTIVE',
                lifecycleStatus: 'NEW'
            };

            if (formData.email.trim()) {
                cleanedData.email = formData.email.trim();
            }

            if (formData.tags.trim()) {
                cleanedData.tags = formData.tags;
            }

            await contactsApi.create(cleanedData);
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Error creating contact:', err);
            setError(err.message || 'Error al crear el contacto');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="bg-[var(--bg-card)] backdrop-blur-xl border border-[var(--border-default)] rounded-[40px] shadow-[0_32px_120px_-20px_rgba(0,0,0,0.8)] w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-500">

                {/* Header */}
                <div className="p-10 pb-6 flex justify-between items-start">
                    <div>
                        <h2 className={`${T.sectionTitle} ${S.headingLg} italic tracking-tighter uppercase mb-2`}>
                            Nuevo <span className="text-[var(--brand-primary)]">Contacto</span>
                        </h2>
                        <p className={`${T.helperText} ${S.body} opacity-80 uppercase italic`}>Expande tu base de datos estratégica</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-3 bg-[var(--bg-input)] border border-[var(--border-default)] rounded-2xl text-[var(--text-muted)] hover:text-[var(--text-strong)] hover:border-[var(--brand-primary)]/40 transition-all active:scale-90"
                    >
                        <X size={20} strokeWidth={3} />
                    </button>
                </div>

                {/* Form Body */}
                <div className="px-10 pb-10 space-y-6">
                    {/* Name */}
                    <div className="space-y-2 group">
                        <label className={`${T.helperText} ${S.meta} uppercase ml-2 opacity-50 group-focus-within:opacity-100 transition-opacity`}>Identidad Completa</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-[var(--text-muted)]">
                                <User size={18} />
                            </div>
                            <input
                                type="text"
                                placeholder="P. ej. Juan Pérez"
                                className={`${T.inputText} ${S.body} w-full pl-14 pr-6 py-4 bg-[var(--bg-input)] border border-[var(--border-default)] text-[var(--text-strong)] rounded-2xl outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/50 focus:border-[var(--brand-primary)] transition-all placeholder:text-[var(--text-muted)]`}
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Phone */}
                    <div className="space-y-2 group">
                        <label className={`${T.helperText} ${S.meta} uppercase ml-2 opacity-50 group-focus-within:opacity-100 transition-opacity`}>Protocolo Telefónico (E.164)</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-[var(--text-muted)]">
                                <Phone size={18} />
                            </div>
                            <input
                                type="tel"
                                placeholder="+52 1 55 ..."
                                className={`${T.inputText} ${S.body} w-full pl-14 pr-6 py-4 bg-[var(--bg-input)] border border-[var(--border-default)] text-[var(--text-strong)] rounded-2xl outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/50 focus:border-[var(--brand-primary)] transition-all placeholder:text-[var(--text-muted)]`}
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Email */}
                    <div className="space-y-2 group">
                        <label className={`${T.helperText} ${S.meta} uppercase ml-2 opacity-50 group-focus-within:opacity-100 transition-opacity`}>Correo Electrónico</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-[var(--text-muted)]">
                                <Mail size={18} />
                            </div>
                            <input
                                type="email"
                                placeholder="usuario@dominio.com"
                                className={`${T.inputText} ${S.body} w-full pl-14 pr-6 py-4 bg-[var(--bg-input)] border border-[var(--border-default)] text-[var(--text-strong)] rounded-2xl outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/50 focus:border-[var(--brand-primary)] transition-all placeholder:text-[var(--text-muted)]`}
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Tags */}
                    <div className="space-y-2 group">
                        <label className={`${T.helperText} ${S.meta} uppercase ml-2 opacity-50 group-focus-within:opacity-100 transition-opacity`}>Etiquetas de Segmentación (separadas por coma)</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-[var(--text-muted)]">
                                <Tag size={18} />
                            </div>
                            <input
                                type="text"
                                placeholder="VIP, Lead, Inversor..."
                                className={`${T.inputText} ${S.body} w-full pl-14 pr-6 py-4 bg-[var(--bg-input)] border border-[var(--border-default)] text-[var(--text-strong)] rounded-2xl outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/50 focus:border-[var(--brand-primary)] transition-all placeholder:text-[var(--text-muted)]`}
                                value={formData.tags}
                                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 animate-shake">
                            <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]"></div>
                            <p className={`${T.helperText} ${S.meta} text-red-500 uppercase tracking-widest`}>{error}</p>
                        </div>
                    )}

                    {/* Footer Actions */}
                    <div className="flex gap-4 pt-6">
                        <button
                            onClick={onClose}
                            className={`flex-1 bg-[var(--bg-card)] py-5 rounded-[24px] border border-[var(--border-default)] hover:bg-[var(--bg-elevated)] transition-all active:scale-95 ${T.buttonText}`}
                        >
                            Abortar
                        </button>
                        <button
                            onClick={handleCreate}
                            disabled={loading}
                            className={`${T.buttonPrimaryText} ${S.meta} flex-[2] bg-[var(--brand-primary)] py-5 rounded-[24px] uppercase shadow-xl hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-30 disabled:grayscale`}
                        >
                            {loading ? (
                                <div className="w-4 h-4 border-2 border-[var(--brand-primary-foreground)]/20 border-t-[var(--brand-primary-foreground)] rounded-full animate-spin"></div>
                            ) : (
                                <>Inyectar Registro <ArrowRight size={14} /></>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
