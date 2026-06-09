import React, { useState } from 'react';
import { contactsApi } from '@/api/wabee/contacts.api';
import { X, User, Phone, Mail, Tag, ArrowRight } from 'lucide-react';
import { T, S } from '@/lib/text-tokens';

interface CreateContactModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

const COPY = {
    required: 'Nombre y teléfono son obligatorios.',
    invalidPhone: 'Formato de teléfono inválido. Usa +52...',
    title: 'Nuevo',
    highlighted: 'Contacto',
    subtitle: 'Expande tu base de datos estratégica',
    fullName: 'Identidad Completa',
    fullNamePlaceholder: 'P. ej. Juan Pérez',
    phoneProtocol: 'Protocolo Telefónico (E.164)',
    phonePlaceholder: '+52 7713437831',
    email: 'Correo Electrónico',
    emailPlaceholder: 'usuario@dominio.com',
    tags: 'Etiquetas de Segmentación (separadas por coma)',
    tagsPlaceholder: 'VIP, Lead, Inversor...',
    abort: 'Abortar',
    submit: 'Inyectar Registro',
} as const;

export const CreateContactModal: React.FC<CreateContactModalProps> = ({ onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: '',
        tags: ''
    });

    const isPhoneValid = (phone: string) => /^\+?[1-9]\d{1,14}$/.test(phone.replace(/\s+/g, ''));

    const handleCreate = async () => {
        if (!formData.name || !formData.phone) {
            setError(COPY.required);
            return;
        }

        if (!isPhoneValid(formData.phone)) {
            setError(COPY.invalidPhone);
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

            if (formData.email.trim()) cleanedData.email = formData.email.trim();
            if (formData.tags.trim()) cleanedData.tags = formData.tags;

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
        <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-6 backdrop-blur-md animate-in fade-in duration-300 sm:items-center">
            <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-[28px] border border-[var(--border-default)] bg-[var(--bg-card)] shadow-[0_32px_120px_-20px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-500 sm:rounded-[40px]">
                <div className="flex items-start justify-between gap-4 p-5 pb-4 sm:p-10 sm:pb-6">
                    <div className="min-w-0">
                        <h2 className={`${T.sectionTitle} ${S.headingLg} mb-2 italic tracking-tighter uppercase`}>
                            {COPY.title} <span className="text-[var(--brand-primary)]">{COPY.highlighted}</span>
                        </h2>
                        <p className={`${T.helperText} ${S.body} uppercase italic opacity-80`}>{COPY.subtitle}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="shrink-0 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-3 text-[var(--text-muted)] transition-all hover:border-[var(--brand-primary)]/40 hover:text-[var(--text-strong)] active:scale-90"
                    >
                        <X size={20} strokeWidth={3} />
                    </button>
                </div>

                <div className="flex-1 space-y-5 overflow-y-auto px-5 pb-5 sm:space-y-6 sm:px-10 sm:pb-10">
                    <div className="space-y-2 group">
                        <label className={`${T.helperText} ${S.meta} ml-2 uppercase opacity-50 transition-opacity group-focus-within:opacity-100`}>{COPY.fullName}</label>
                        <div className="relative">
                            <div className="pointer-events-none absolute inset-y-0 left-5 flex items-center text-[var(--text-muted)]">
                                <User size={18} />
                            </div>
                            <input
                                type="text"
                                placeholder={COPY.fullNamePlaceholder}
                                className={`${T.inputText} ${S.body} w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] py-4 pl-14 pr-6 text-[var(--text-strong)] outline-none transition-all placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/50`}
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-2 group">
                        <label className={`${T.helperText} ${S.meta} ml-2 uppercase opacity-50 transition-opacity group-focus-within:opacity-100`}>{COPY.phoneProtocol}</label>
                        <div className="relative">
                            <div className="pointer-events-none absolute inset-y-0 left-5 flex items-center text-[var(--text-muted)]">
                                <Phone size={18} />
                            </div>
                            <input
                                type="tel"
                                placeholder={COPY.phonePlaceholder}
                                className={`${T.inputText} ${S.body} w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] py-4 pl-14 pr-6 text-[var(--text-strong)] outline-none transition-all placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/50`}
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-2 group">
                        <label className={`${T.helperText} ${S.meta} ml-2 uppercase opacity-50 transition-opacity group-focus-within:opacity-100`}>{COPY.email}</label>
                        <div className="relative">
                            <div className="pointer-events-none absolute inset-y-0 left-5 flex items-center text-[var(--text-muted)]">
                                <Mail size={18} />
                            </div>
                            <input
                                type="email"
                                placeholder={COPY.emailPlaceholder}
                                className={`${T.inputText} ${S.body} w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] py-4 pl-14 pr-6 text-[var(--text-strong)] outline-none transition-all placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/50`}
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-2 group">
                        <label className={`${T.helperText} ${S.meta} ml-2 uppercase opacity-50 transition-opacity group-focus-within:opacity-100`}>{COPY.tags}</label>
                        <div className="relative">
                            <div className="pointer-events-none absolute inset-y-0 left-5 flex items-center text-[var(--text-muted)]">
                                <Tag size={18} />
                            </div>
                            <input
                                type="text"
                                placeholder={COPY.tagsPlaceholder}
                                className={`${T.inputText} ${S.body} w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] py-4 pl-14 pr-6 text-[var(--text-strong)] outline-none transition-all placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/50`}
                                value={formData.tags}
                                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="flex items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 animate-shake">
                            <div className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]"></div>
                            <p className={`${T.helperText} ${S.meta} text-red-500 uppercase tracking-widest`}>{error}</p>
                        </div>
                    )}
                </div>

                <div className="flex flex-col gap-3 border-t border-[var(--border-default)] bg-[var(--bg-card)] px-5 py-4 sm:flex-row sm:gap-4 sm:px-10 sm:py-6">
                    <button
                        onClick={onClose}
                        className={`flex-1 rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-card)] py-4 transition-all hover:bg-[var(--bg-elevated)] active:scale-95 ${T.buttonText}`}
                    >
                        {COPY.abort}
                    </button>
                    <button
                        onClick={handleCreate}
                        disabled={loading}
                        className={`${T.buttonPrimaryText} ${S.meta} flex flex-[1.4] items-center justify-center gap-2 rounded-[24px] bg-[var(--brand-primary)] py-4 uppercase shadow-xl transition-all hover:brightness-110 active:scale-95 disabled:grayscale disabled:opacity-30`}
                    >
                        {loading ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--brand-primary-foreground)]/20 border-t-[var(--brand-primary-foreground)]"></div>
                        ) : (
                            <>{COPY.submit} <ArrowRight size={14} /></>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
