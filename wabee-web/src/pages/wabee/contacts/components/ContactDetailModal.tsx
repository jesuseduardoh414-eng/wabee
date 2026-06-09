import React, { useEffect, useState } from 'react';
import { contactsApi } from '@/api/wabee/contacts.api';
import { X, User, Phone, Mail, Tag, Save, Trash2, Calendar, ShieldCheck, Zap } from 'lucide-react';
import { T, S } from '@/lib/text-tokens';

interface ContactDetailModalProps {
    contactId: string;
    onClose: () => void;
    onSuccess: () => void;
}

const COPY = {
    loading: 'Accediendo a la Bóveda de Datos...',
    loadError: 'No se pudo cargar la información del contacto.',
    confirmDelete: '¿Estás seguro de que deseas eliminar este contacto? Esta acción es irreversible.',
    deleteError: 'Error al eliminar el contacto.',
    title: 'Perfil',
    highlight: 'Estratégico',
    lifecycle: 'Ciclo de Vida',
    globalStatus: 'Estado Global',
    sync: 'Sincronización',
    identity: 'Identidad',
    phoneProtocol: 'Protocolo Telefónico',
    linkedEmail: 'Correo Electrónico de Enlace',
    tags: 'Etiquetas',
    tagPlaceholder: 'Presiona Enter para agregar...',
    recent: 'Reciente',
    close: 'Cerrar',
    delete: 'Eliminar',
    save: 'Garantizar Cambios',
} as const;

function formatContactPhone(phone?: string | null) {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');

    if (digits.length === 13 && digits.startsWith('521')) return `+52 ${digits.slice(3)}`;
    if (digits.length === 12 && digits.startsWith('52')) return `+52 ${digits.slice(2)}`;
    if (digits.length === 10) return `+52 ${digits}`;

    return phone;
}

export const ContactDetailModal: React.FC<ContactDetailModalProps> = ({ contactId, onClose, onSuccess }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: '',
        tags: [] as string[],
        lifecycleStatus: '',
        status: ''
    });
    const [tagInput, setTagInput] = useState('');

    useEffect(() => {
        const loadContact = async () => {
            try {
                const data = await contactsApi.get(contactId);
                setFormData({
                    name: data.name || '',
                    phone: data.phone || '',
                    email: data.email || '',
                    tags: data.tags || [],
                    lifecycleStatus: data.lifecycleStatus || 'NEW',
                    status: data.status || 'ACTIVE'
                });
            } catch (err: any) {
                console.error('Error loading contact:', err);
                setError(COPY.loadError);
            } finally {
                setLoading(false);
            }
        };
        loadContact();
    }, [contactId]);

    const handleUpdate = async () => {
        setSaving(true);
        setError(null);
        try {
            await contactsApi.update(contactId, formData);
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Error updating contact:', err);
            setError(err.message || 'Error al actualizar el contacto');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm(COPY.confirmDelete)) return;

        setSaving(true);
        try {
            await contactsApi.delete(contactId);
            onSuccess();
            onClose();
        } catch (err: any) {
            setError(COPY.deleteError);
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-[var(--brand-primary)]/10 border-t-[var(--brand-primary)]"></div>
                    <p className={`${T.helperText} ${S.meta} uppercase tracking-widest animate-pulse italic`}>{COPY.loading}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/60 p-3 pt-6 backdrop-blur-md animate-in fade-in duration-300 md:items-center md:p-4 md:pt-4">
            <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] border border-[var(--border-default)] bg-[var(--bg-card)] shadow-[0_32px_120px_-20px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-500 md:max-h-[90vh] md:rounded-[40px]">
                <div className="flex items-start justify-between gap-4 bg-gradient-to-b from-[var(--brand-primary)]/5 to-transparent p-5 pb-4 md:p-10 md:pb-6">
                    <div className="flex min-w-0 items-center gap-4 md:gap-6">
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] border-2 border-[var(--bg-card)] bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-primary)]/80 text-2xl font-black italic text-[var(--brand-primary-foreground)] shadow-2xl shadow-[var(--brand-primary)]/20 md:h-20 md:w-20 md:rounded-3xl md:text-3xl">
                            {(formData.name || 'S').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                            <h2 className={`${T.sectionTitle} ${S.headingLg} mb-1 text-[28px] leading-[0.95] italic tracking-tighter uppercase md:mb-2 md:text-[inherit]`}>
                                {COPY.title} <span className="text-[var(--brand-primary)]">{COPY.highlight}</span>
                            </h2>
                            <p className={`${T.helperText} ${S.meta} break-all uppercase italic opacity-60 md:break-normal`}>
                                ID: {contactId.substring(0, 8)}...{contactId.slice(-4)}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="shrink-0 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-2.5 text-[var(--text-muted)] transition-all hover:border-[var(--brand-primary)]/40 hover:text-[var(--text-strong)] active:scale-90 md:p-3"
                    >
                        <X size={20} strokeWidth={3} />
                    </button>
                </div>

                <div className="space-y-5 overflow-y-auto px-5 pb-5 md:space-y-8 md:px-10 md:pb-10">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 md:gap-4">
                        <div className="rounded-[22px] border border-[var(--border-default)] bg-[var(--bg-input)] p-4 transition-all hover:border-[var(--brand-primary)]/20 md:rounded-3xl md:p-5">
                            <span className={`${T.helperText} ${S.meta} mb-2 block uppercase opacity-40`}>{COPY.lifecycle}</span>
                            <div className="flex items-center gap-2 text-[var(--brand-primary)]">
                                <Zap size={14} />
                                <span className={`${T.sectionTitle} ${S.body} uppercase italic tracking-tight`}>{formData.lifecycleStatus}</span>
                            </div>
                        </div>
                        <div className="rounded-[22px] border border-[var(--border-default)] bg-[var(--bg-input)] p-4 transition-all hover:border-[var(--brand-primary)]/20 md:rounded-3xl md:p-5">
                            <span className={`${T.helperText} ${S.meta} mb-2 block uppercase opacity-40`}>{COPY.globalStatus}</span>
                            <div className="flex items-center gap-2 text-green-500">
                                <ShieldCheck size={14} />
                                <span className={`${T.sectionTitle} ${S.body} uppercase italic tracking-tight`}>{formData.status}</span>
                            </div>
                        </div>
                        <div className="rounded-[22px] border border-[var(--border-default)] bg-[var(--bg-input)] p-4 transition-all hover:border-[var(--brand-primary)]/20 md:rounded-3xl md:p-5">
                            <span className={`${T.helperText} ${S.meta} mb-2 block uppercase opacity-40`}>{COPY.sync}</span>
                            <div className="flex items-center gap-2 text-indigo-400">
                                <Calendar size={14} />
                                <span className={`${T.sectionTitle} ${S.body} uppercase italic tracking-tight`}>{COPY.recent}</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
                        <div className="space-y-2 group">
                            <label className={`${T.helperText} ${S.meta} ml-2 uppercase opacity-50 transition-opacity group-focus-within:opacity-100`}>{COPY.identity}</label>
                            <div className="relative">
                                <User size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] transition-colors group-focus-within:text-[var(--brand-primary)]" />
                                <input
                                    type="text"
                                    className={`${T.inputText} ${S.body} w-full rounded-[20px] border border-[var(--border-default)] bg-[var(--bg-input)] py-3.5 pl-14 pr-5 text-[var(--text-strong)] outline-none transition-all focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/50 md:rounded-[24px] md:py-4`}
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2 group">
                            <label className={`${T.helperText} ${S.meta} ml-2 uppercase opacity-50 transition-opacity group-focus-within:opacity-100`}>{COPY.phoneProtocol}</label>
                            <div className="relative">
                                <Phone size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] transition-colors group-focus-within:text-[var(--brand-primary)]" />
                                <input
                                    type="tel"
                                    className={`${T.inputText} ${S.body} w-full rounded-[20px] border border-[var(--border-default)] bg-[var(--bg-input)] py-3.5 pl-14 pr-5 text-[var(--text-strong)] opacity-50 outline-none transition-all focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/50 md:rounded-[24px] md:py-4`}
                                    value={formatContactPhone(formData.phone)}
                                    disabled
                                />
                            </div>
                        </div>

                        <div className="space-y-2 group md:col-span-2">
                            <label className={`${T.helperText} ${S.meta} ml-2 uppercase opacity-50 transition-opacity group-focus-within:opacity-100`}>{COPY.linkedEmail}</label>
                            <div className="relative">
                                <Mail size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] transition-colors group-focus-within:text-[var(--brand-primary)]" />
                                <input
                                    type="email"
                                    className={`${T.inputText} ${S.body} w-full rounded-[20px] border border-[var(--border-default)] bg-[var(--bg-input)] py-3.5 pl-14 pr-5 text-[var(--text-strong)] outline-none transition-all focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/50 md:rounded-[24px] md:py-4`}
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-3 group md:col-span-2">
                            <label className={`${T.helperText} ${S.meta} flex items-center gap-2 uppercase`}>
                                <Tag size={12} className="text-[var(--text-muted)]" />
                                {COPY.tags}
                            </label>

                            {formData.tags.length > 0 && (
                                <div className="mb-2 flex flex-wrap gap-2">
                                    {formData.tags.map(tag => (
                                        <span key={tag} className={`${T.badgeText} ${S.meta} flex items-center gap-1.5 rounded-xl border border-[var(--brand-primary)]/20 bg-[var(--brand-primary)]/10 px-3 py-1.5 uppercase tracking-widest text-[var(--brand-primary)] shadow-lg shadow-[var(--brand-primary)]/5 transition-colors`}>
                                            {tag}
                                            <button
                                                type="button"
                                                onClick={() => setFormData(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }))}
                                                className="ml-1 text-[var(--brand-primary)]/50 transition-colors hover:text-red-500 focus:outline-none"
                                            >
                                                <X size={10} strokeWidth={3} />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}

                            <div className="relative">
                                <input
                                    type="text"
                                    className={`${T.inputText} ${S.body} w-full rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-input)] py-3.5 pl-5 pr-12 text-[var(--text-strong)] outline-none transition-all placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/50 md:rounded-[20px] md:py-4`}
                                    value={tagInput}
                                    onChange={(e) => setTagInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            const value = tagInput.trim().toUpperCase();
                                            if (value && !formData.tags.includes(value)) {
                                                setFormData(prev => ({ ...prev, tags: [...prev.tags, value] }));
                                            }
                                            setTagInput('');
                                        }
                                    }}
                                    placeholder={COPY.tagPlaceholder}
                                />
                                <div className="absolute right-5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] transition-colors group-focus-within:text-[var(--brand-primary)]">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                                </div>
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="flex items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 animate-shake">
                            <div className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]"></div>
                            <p className={`${T.helperText} ${S.meta} text-red-500 uppercase tracking-widest`}>{error}</p>
                        </div>
                    )}
                </div>

                <div className="flex flex-col-reverse items-stretch justify-between gap-3 border-t border-[var(--border-default)] bg-[var(--bg-card)] px-5 py-4 md:flex-row md:items-center md:gap-4 md:px-10 md:py-8">
                    <button
                        onClick={handleDelete}
                        disabled={saving}
                        className={`${T.buttonText} ${S.meta} flex w-full items-center justify-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-3.5 uppercase text-red-500 transition-all hover:bg-red-500 hover:text-white active:scale-95 disabled:grayscale disabled:opacity-30 md:w-auto md:px-6 md:py-4`}
                    >
                        <Trash2 size={16} />
                        {COPY.delete}
                    </button>

                    <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:gap-4">
                        <button
                            onClick={onClose}
                            className={`${T.buttonText} ${S.meta} w-full px-6 py-3.5 text-center uppercase tracking-[0.18em] text-[var(--text-muted)] transition-all hover:text-[var(--text-strong)] md:w-auto md:px-8 md:py-4`}
                        >
                            {COPY.close}
                        </button>
                        <button
                            onClick={handleUpdate}
                            disabled={saving}
                            className={`${T.buttonPrimaryText} ${S.meta} flex w-full items-center justify-center gap-2 rounded-2xl border-[var(--brand-primary)] bg-[var(--brand-primary)] px-6 py-3.5 uppercase shadow-xl transition-all hover:brightness-110 active:scale-95 disabled:grayscale disabled:opacity-30 md:w-auto md:px-10 md:py-4`}
                        >
                            {saving ? (
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--brand-primary-foreground)]/20 border-t-[var(--brand-primary-foreground)]"></div>
                            ) : (
                                <>{COPY.save} <Save size={16} /></>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
