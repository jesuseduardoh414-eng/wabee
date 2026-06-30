import React, { useState } from 'react';
import { contactsApi } from '@/api/wabee/contacts.api';
import { Filter, Tag, UserCheck, X, Layers, ArrowRight } from 'lucide-react';
import { useToast } from '@/context/ToastContext';
import { T, S } from '@/lib/text-tokens';

interface CreateSegmentModalProps {
    onClose: () => void;
    onSuccess: () => void;
    initialData?: any;
}

const COPY = {
    edit: 'Editar',
    segment: 'Segmento',
    smart: '',
    editHelp: 'Modifica las reglas de este segmento.',
    createHelp: 'Define las reglas para agrupar contactos automáticamente.',
    name: 'Nombre del segmento',
    namePlaceholder: 'Ej: Clientes VIP Veracruz',
    description: 'Descripción',
    descriptionPlaceholder: '¿Qué contactos incluye este segmento?',
    algorithm: 'Filtros',
    lifecycle: 'Ciclo de vida',
    tags: 'Etiquetas',
    addTagPlaceholder: 'Presiona Enter para agregar...',
    cancel: 'Cancelar',
    save: 'Guardar',
} as const;

export const CreateSegmentModal: React.FC<CreateSegmentModalProps> = ({ onClose, onSuccess, initialData }) => {
    const [loading, setLoading] = useState(false);
    const [tagInput, setTagInput] = useState('');
    const [formData, setFormData] = useState({
        name: initialData?.name || '',
        description: initialData?.description || '',
        filter: {
            lifecycleStatus: initialData?.filter?.lifecycleStatus || ([] as string[]),
            tagsAny: initialData?.filter?.tagsAny || ([] as string[])
        }
    });

    const { error: toastError } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (initialData) {
                await contactsApi.updateSegment(initialData.id, formData);
            } else {
                await contactsApi.createSegment(formData);
            }
            onSuccess();
            onClose();
        } catch (error: any) {
            toastError(error.message || 'Error al crear el segmento');
        } finally {
            setLoading(false);
        }
    };

    const toggleLifecycle = (status: string) => {
        setFormData(prev => {
            const current = prev.filter.lifecycleStatus;
            const next = current.includes(status)
                ? current.filter((s: string) => s !== status)
                : [...current, status];
            return {
                ...prev,
                filter: { ...prev.filter, lifecycleStatus: next }
            };
        });
    };

    const addTag = () => {
        const tag = tagInput.trim().toUpperCase();
        if (tag && !formData.filter.tagsAny.includes(tag)) {
            setFormData(prev => ({
                ...prev,
                filter: {
                    ...prev.filter,
                    tagsAny: [...prev.filter.tagsAny, tag]
                }
            }));
            setTagInput('');
        }
    };

    const removeTag = (tagToRemove: string) => {
        setFormData(prev => ({
            ...prev,
            filter: {
                ...prev.filter,
                tagsAny: prev.filter.tagsAny.filter((t: string) => t !== tagToRemove)
            }
        }));
    };

    const lifecycleOptions = [
        { id: 'NEW', label: 'Nuevo' },
        { id: 'LEAD', label: 'Lead' },
        { id: 'ACTIVE', label: 'Activo' },
        { id: 'CUSTOMER', label: 'Cliente' },
        { id: 'INACTIVE', label: 'Inactivo' },
        { id: 'BLOCKED', label: 'Bloqueado' }
    ];

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/80 p-4 pt-6 backdrop-blur-sm animate-in fade-in duration-300 sm:items-center">
            <div className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-[28px] border border-[var(--border-default)] bg-[var(--bg-card)] shadow-2xl sm:max-h-[90vh] sm:rounded-[40px]">
                <div className="absolute right-0 top-0 z-10 p-4 sm:p-6">
                    <button
                        onClick={onClose}
                        className="rounded-full bg-[var(--bg-card)]/60 p-2 text-[var(--text-muted)] backdrop-blur-md transition-colors hover:text-[var(--brand-primary)]"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="custom-scrollbar flex-1 overflow-y-auto p-5 sm:p-8 md:p-10">
                    <div className="space-y-6 sm:space-y-8">
                        <div className="space-y-4">
                            <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-[var(--brand-primary)]/20 bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] shadow-lg">
                                <Layers size={32} />
                            </div>
                            <div>
                                <h2 className={`${T.sectionTitle} ${S.headingLg} italic tracking-tighter uppercase`}>
                                    {initialData ? COPY.edit : COPY.segment} <span className="text-[var(--brand-primary)]">{initialData ? COPY.segment : COPY.smart}</span>
                                </h2>
                                <p className={`${T.helperText} ${S.body} mt-2 leading-relaxed text-[var(--text-muted)]`}>
                                    {initialData ? COPY.editHelp : COPY.createHelp}
                                </p>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className={`${T.helperText} ${S.meta} ml-1 block uppercase text-[var(--text-muted)]`}>{COPY.name}</label>
                                    <input
                                        required
                                        placeholder={COPY.namePlaceholder}
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className={`${T.inputText} ${S.body} w-full rounded-2xl border border-[var(--border-input)] bg-[var(--bg-input)] px-5 py-4 text-[var(--text-strong)] outline-none transition-all focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/50`}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className={`${T.helperText} ${S.meta} ml-1 block uppercase text-[var(--text-muted)]`}>{COPY.description}</label>
                                    <textarea
                                        className={`${T.inputText} ${S.body} h-24 w-full resize-none rounded-2xl border border-[var(--border-input)] bg-[var(--bg-input)] px-5 py-4 text-[var(--text-strong)] outline-none transition-all focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/50`}
                                        placeholder={COPY.descriptionPlaceholder}
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-5 rounded-[28px] border border-[var(--border-default)] bg-[var(--bg-muted)] p-4 shadow-inner sm:rounded-[32px] sm:p-6">
                                <h3 className={`${T.sectionTitle} ${S.meta} ml-1 flex items-center gap-2 uppercase italic text-[var(--brand-primary)]`}>
                                    <Filter size={14} /> {COPY.algorithm}
                                </h3>

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className={`${T.helperText} ${S.meta} ml-1 flex items-center gap-2 uppercase text-[var(--text-muted)]`}>
                                            <UserCheck size={12} /> {COPY.lifecycle}
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            {lifecycleOptions.map(option => (
                                                <button
                                                    key={option.id}
                                                    type="button"
                                                    onClick={() => toggleLifecycle(option.id)}
                                                    className={`${T.badgeText} ${S.meta} rounded-full border px-3 py-1.5 uppercase transition-all ${formData.filter.lifecycleStatus.includes(option.id)
                                                        ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]'
                                                        : 'border-[var(--border-default)] bg-[var(--bg-page)] text-[var(--text-muted)] hover:border-[var(--brand-primary)]/50'
                                                        }`}
                                                >
                                                    {option.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className={`${T.helperText} ${S.meta} ml-1 flex items-center gap-2 uppercase text-[var(--text-muted)]`}>
                                            <Tag size={12} /> {COPY.tags}
                                        </label>
                                        <div className="mb-2 flex flex-wrap gap-1.5">
                                            {formData.filter.tagsAny.map((tag: string) => (
                                                <span key={tag} className={`${T.badgeText} ${S.meta} flex items-center gap-1.5 rounded-lg border border-[var(--brand-primary)]/20 bg-[var(--brand-primary)]/10 px-2.5 py-1 text-[var(--brand-primary)]`}>
                                                    {tag}
                                                    <button type="button" onClick={() => removeTag(tag)} className="transition-colors hover:text-[var(--text-strong)]">
                                                        <X size={10} />
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                        <div className="group relative">
                                            <input
                                                type="text"
                                                placeholder={COPY.addTagPlaceholder}
                                                className={`${T.inputText} ${S.body} w-full rounded-xl border border-[var(--border-input)] bg-[var(--bg-input)] py-3 pl-4 pr-12 text-[var(--text-strong)] outline-none transition-all focus:ring-1 focus:ring-[var(--brand-primary)]`}
                                                value={tagInput}
                                                onChange={e => setTagInput(e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        addTag();
                                                    }
                                                }}
                                            />
                                            <button
                                                type="button"
                                                onClick={addTag}
                                                className="absolute right-2 top-2 rounded-lg p-1.5 text-[var(--brand-primary)] transition-colors hover:bg-[var(--brand-primary)]/10"
                                            >
                                                <ArrowRight size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:gap-4 sm:pt-4">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className={`order-2 flex-1 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] py-4 transition-all hover:bg-[var(--bg-elevated)] sm:order-1 ${T.buttonText}`}
                                >
                                    {COPY.cancel}
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className={`${T.buttonPrimaryText} ${S.meta} order-1 flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--brand-primary)] py-4 uppercase shadow-xl transition-all hover:brightness-110 active:scale-95 sm:order-2`}
                                >
                                    {loading ? (
                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--brand-primary-foreground)]/20 border-t-[var(--brand-primary-foreground)]"></div>
                                    ) : (
                                        <>{COPY.save} <ArrowRight size={14} /></>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};
