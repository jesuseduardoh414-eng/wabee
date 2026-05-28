import React, { useEffect, useState } from 'react';
import { contactsApi } from '@/api/wabee/contacts.api';
import { X, User, Phone, Mail, Tag, Save, Trash2, Calendar, ShieldCheck, Zap } from 'lucide-react';
import { T, S } from '@/lib/text-tokens';

interface ContactDetailModalProps {
    contactId: string;
    onClose: () => void;
    onSuccess: () => void;
}

export const ContactDetailModal: React.FC<ContactDetailModalProps> = ({ contactId, onClose, onSuccess }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [contact, setContact] = useState<any>(null);
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
                setContact(data);
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
                setError('No se pudo cargar la información del contacto.');
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
        if (!window.confirm('¿Estás seguro de que deseas eliminar este contacto? Esta acción es irreversible.')) return;

        setSaving(true);
        try {
            await contactsApi.delete(contactId);
            onSuccess();
            onClose();
        } catch (err: any) {
            setError('Error al eliminar el contacto.');
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-[var(--brand-primary)]/10 border-t-[var(--brand-primary)] rounded-full animate-spin"></div>
                    <p className={`${T.helperText} ${S.meta} uppercase tracking-widest animate-pulse italic`}>Accediendo a la Bóveda de Datos...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="bg-[var(--bg-card)] backdrop-blur-xl border border-[var(--border-default)] rounded-[40px] shadow-[0_32px_120px_-20px_rgba(0,0,0,0.8)] w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-500">

                {/* Header */}
                <div className="p-10 pb-6 flex justify-between items-start bg-gradient-to-b from-[var(--brand-primary)]/5 to-transparent">
                    <div className="flex items-center gap-6">
                        <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-primary)]/80 flex items-center justify-center text-[var(--brand-primary-foreground)] text-3xl font-black italic shadow-2xl shadow-[var(--brand-primary)]/20 border-2 border-[var(--bg-card)]">
                            {(formData.name || 'S').charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h2 className={`${T.sectionTitle} ${S.headingLg} italic tracking-tighter uppercase mb-2`}>
                                Perfil <span className="text-[var(--brand-primary)]">Estratégico</span>
                            </h2>
                            <p className={`${T.helperText} ${S.meta} opacity-60 uppercase italic`}>ID: {contactId.substring(0, 8)}...{contactId.slice(-4)}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-3 bg-[var(--bg-input)] border border-[var(--border-default)] rounded-2xl text-[var(--text-muted)] hover:text-[var(--text-strong)] hover:border-[var(--brand-primary)]/40 transition-all active:scale-90"
                    >
                        <X size={20} strokeWidth={3} />
                    </button>
                </div>

                {/* Body Content */}
                <div className="px-10 pb-10 overflow-y-auto space-y-8">

                    {/* Stats/Status Row */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-[var(--bg-input)] border border-[var(--border-default)] p-5 rounded-3xl group hover:border-[var(--brand-primary)]/20 transition-all">
                            <span className={`${T.helperText} ${S.meta} uppercase opacity-40 block mb-2`}>Ciclo de Vida</span>
                            <div className="flex items-center gap-2 text-[var(--brand-primary)]">
                                <Zap size={14} />
                                <span className={`${T.sectionTitle} ${S.body} uppercase italic tracking-tight`}>{formData.lifecycleStatus}</span>
                            </div>
                        </div>
                        <div className="bg-[var(--bg-input)] border border-[var(--border-default)] p-5 rounded-3xl group hover:border-[var(--brand-primary)]/20 transition-all">
                            <span className={`${T.helperText} ${S.meta} uppercase opacity-40 block mb-2`}>Estado Global</span>
                            <div className="flex items-center gap-2 text-green-500">
                                <ShieldCheck size={14} />
                                <span className={`${T.sectionTitle} ${S.body} uppercase italic tracking-tight`}>{formData.status}</span>
                            </div>
                        </div>
                        <div className="bg-[var(--bg-input)] border border-[var(--border-default)] p-5 rounded-3xl group hover:border-[var(--brand-primary)]/20 transition-all">
                            <span className={`${T.helperText} ${S.meta} uppercase opacity-40 block mb-2`}>Sincronización</span>
                            <div className="flex items-center gap-2 text-indigo-400">
                                <Calendar size={14} />
                                <span className={`${T.sectionTitle} ${S.body} uppercase italic tracking-tight`}>Reciente</span>
                            </div>
                        </div>
                    </div>

                    {/* Editor Form */}
                    <div className="grid grid-cols-2 gap-6">
                        {/* Name */}
                        <div className="space-y-2 group">
                            <label className={`${T.helperText} ${S.meta} uppercase ml-2 opacity-50 group-focus-within:opacity-100 transition-opacity`}>Identidad</label>
                            <div className="relative">
                                <User size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-[var(--brand-primary)] transition-colors" />
                                <input
                                    type="text"
                                    className={`${T.inputText} ${S.body} w-full pl-14 pr-6 py-4 bg-[var(--bg-input)] border border-[var(--border-default)] text-[var(--text-strong)] rounded-[24px] outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/50 focus:border-[var(--brand-primary)] transition-all`}
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* Phone */}
                        <div className="space-y-2 group">
                            <label className={`${T.helperText} ${S.meta} uppercase ml-2 opacity-50 group-focus-within:opacity-100 transition-opacity`}>Protocolo Telefónico</label>
                            <div className="relative">
                                <Phone size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-[var(--brand-primary)] transition-colors" />
                                <input
                                    type="tel"
                                    className={`${T.inputText} ${S.body} w-full pl-14 pr-6 py-4 bg-[var(--bg-input)] border border-[var(--border-default)] text-[var(--text-strong)] rounded-[24px] outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/50 focus:border-[var(--brand-primary)] transition-all opacity-50`}
                                    value={formData.phone}
                                    disabled
                                />
                            </div>
                        </div>

                        {/* Email */}
                        <div className="space-y-2 group col-span-2">
                            <label className={`${T.helperText} ${S.meta} uppercase ml-2 opacity-50 group-focus-within:opacity-100 transition-opacity`}>Correo Electrónico de Enlace</label>
                            <div className="relative">
                                <Mail size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-[var(--brand-primary)] transition-colors" />
                                <input
                                    type="email"
                                    className={`${T.inputText} ${S.body} w-full pl-14 pr-6 py-4 bg-[var(--bg-input)] border border-[var(--border-default)] text-[var(--text-strong)] rounded-[24px] outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/50 focus:border-[var(--brand-primary)] transition-all`}
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* Tags */}
                        <div className="space-y-3 group col-span-2">
                            <label className={`${T.helperText} ${S.meta} uppercase flex items-center gap-2`}>
                                <Tag size={12} className="text-[var(--text-muted)]" />
                                ETIQUETAS
                            </label>

                            {formData.tags.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {formData.tags.map(tag => (
                                        <span key={tag} className={`${T.badgeText} ${S.meta} flex items-center gap-1.5 bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] px-3 py-1.5 rounded-xl border border-[var(--brand-primary)]/20 group-hover/tag:border-[var(--brand-primary)]/50 transition-colors shadow-lg shadow-[var(--brand-primary)]/5 uppercase tracking-widest`}>
                                            {tag}
                                            <button
                                                type="button"
                                                onClick={() => setFormData(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }))}
                                                className="ml-1 text-[var(--brand-primary)]/50 hover:text-red-500 transition-colors focus:outline-none"
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
                                    className={`${T.inputText} ${S.body} w-full pl-6 pr-12 py-4 bg-[var(--bg-input)] border border-[var(--border-default)] text-[var(--text-strong)] rounded-[20px] outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/50 focus:border-[var(--brand-primary)] transition-all placeholder:text-[var(--text-muted)]`}
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
                                    placeholder="Presiona Enter para agregar..."
                                />
                                <div className="absolute right-5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-[var(--brand-primary)] transition-colors">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                                </div>
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 animate-shake">
                            <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]"></div>
                            <p className={`${T.helperText} ${S.meta} text-red-500 uppercase tracking-widest`}>{error}</p>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="px-10 py-8 bg-[var(--bg-card)] border-t border-[var(--border-default)] flex justify-between items-center gap-4">
                    <button
                        onClick={handleDelete}
                        disabled={saving}
                        className={`${T.buttonText} ${S.meta} bg-red-500/10 text-red-500 px-6 py-4 rounded-2xl uppercase border border-red-500/20 hover:bg-red-500 hover:text-white transition-all active:scale-95 disabled:opacity-30 disabled:grayscale flex items-center gap-2`}
                    >
                        <Trash2 size={16} />
                        Eliminar
                    </button>

                    <div className="flex gap-4">
                        <button
                            onClick={onClose}
                            className={`${T.buttonText} ${S.meta} px-8 py-4 text-[var(--text-muted)] uppercase tracking-[0.2em] hover:text-[var(--text-strong)] transition-all`}
                        >
                            Cerrar
                        </button>
                        <button
                            onClick={handleUpdate}
                            disabled={saving}
                            className={`${T.buttonPrimaryText} ${S.meta} bg-[var(--brand-primary)] px-10 py-4 rounded-2xl uppercase shadow-xl hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 border-[var(--brand-primary)] disabled:opacity-30 disabled:grayscale`}
                        >
                            {saving ? (
                                <div className="w-4 h-4 border-2 border-[var(--brand-primary-foreground)]/20 border-t-[var(--brand-primary-foreground)] rounded-full animate-spin"></div>
                            ) : (
                                <>Garantizar Cambios <Save size={16} /></>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
