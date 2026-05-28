import React, { useState } from 'react';
import { contactsApi } from '@/api/wabee/contacts.api';
import {
    Filter,
    Tag,
    UserCheck,
    Search,
    X,
    Layers,
    ArrowRight,
    ChevronDown
} from 'lucide-react';
import { useToast } from '@/context/ToastContext';
import { T, S } from '@/lib/text-tokens';

interface CreateSegmentModalProps {
    onClose: () => void;
    onSuccess: () => void;
    initialData?: any;
}

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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-[40px] w-full max-w-lg shadow-2xl relative max-h-[90vh] flex flex-col overflow-hidden">
                <div className="absolute top-0 right-0 p-6 z-10">
                    <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--brand-primary)] transition-colors p-2 bg-[var(--bg-card)]/50 backdrop-blur-md rounded-full">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-8 md:p-10 overflow-y-auto custom-scrollbar flex-1">
                    <div className="space-y-8">
                        <div className="space-y-4">
                            <div className="w-16 h-16 bg-[var(--brand-primary)]/10 rounded-3xl flex items-center justify-center text-[var(--brand-primary)] border border-[var(--brand-primary)]/20 shadow-lg">
                                <Layers size={32} />
                            </div>
                            <div>
                                <h2 className={`${T.sectionTitle} ${S.headingLg} italic tracking-tighter uppercase`}>
                                    {initialData ? 'Editar' : 'Segmento'} <span className="text-[var(--brand-primary)]">{initialData ? 'Segmento' : 'Inteligente'}</span>
                                </h2>
                                <p className={`${T.helperText} ${S.body} text-[var(--text-muted)] mt-2 leading-relaxed`}>
                                    {initialData ? 'Modifica las reglas de filtrado para este segmento.' : 'Define reglas dinámicas para automatizar tu audiencia en tiempo real.'}
                                </p>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className={`${T.helperText} ${S.meta} uppercase ml-1 block text-[var(--text-muted)]`}>Nombre del Segmento</label>
                                    <input
                                        required
                                        placeholder="Ej: Clientes VIP Veracruz"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className={`${T.inputText} ${S.body} w-full bg-[var(--bg-input)] border border-[var(--border-input)] text-[var(--text-strong)] rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/50 focus:border-[var(--brand-primary)] transition-all`}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className={`${T.helperText} ${S.meta} uppercase ml-1 block text-[var(--text-muted)]`}>Descripción</label>
                                    <textarea
                                        className={`${T.inputText} ${S.body} w-full bg-[var(--bg-input)] border border-[var(--border-input)] text-[var(--text-strong)] rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/50 focus:border-[var(--brand-primary)] transition-all h-20 resize-none`}
                                        placeholder="¿Qué contactos incluye este segmento?"
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="bg-[var(--bg-muted)] p-6 rounded-[32px] border border-[var(--border-default)] space-y-5 shadow-inner">
                                <h3 className={`${T.sectionTitle} ${S.meta} text-[var(--brand-primary)] uppercase italic ml-1 flex items-center gap-2`}>
                                    <Filter size={14} /> Algoritmo de Filtrado
                                </h3>

                                <div className="space-y-4">
                                    {/* Ciclo de Vida - Multi Select */}
                                    <div className="space-y-2">
                                        <label className={`${T.helperText} ${S.meta} uppercase ml-1 flex items-center gap-2 text-[var(--text-muted)]`}>
                                            <UserCheck size={12} /> Ciclo de Vida
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            {lifecycleOptions.map(option => (
                                                <button
                                                    key={option.id}
                                                    type="button"
                                                    onClick={() => toggleLifecycle(option.id)}
                                                    className={`${T.badgeText} ${S.meta} px-3 py-1.5 rounded-full uppercase border transition-all ${formData.filter.lifecycleStatus.includes(option.id)
                                                        ? 'bg-[var(--brand-primary)] border-[var(--brand-primary)] '
                                                        : 'bg-[var(--bg-page)] border-[var(--border-default)] text-[var(--text-muted)] hover:border-[var(--brand-primary)]/50'
                                                        }`}
                                                >
                                                    {option.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Etiquetas - Multi Select con Input */}
                                    <div className="space-y-2">
                                        <label className={`${T.helperText} ${S.meta} uppercase ml-1 flex items-center gap-2 text-[var(--text-muted)]`}>
                                            <Tag size={12} /> Etiquetas
                                        </label>
                                        <div className="flex flex-wrap gap-1.5 mb-2">
                                            {formData.filter.tagsAny.map((tag: string) => (
                                                <span key={tag} className={`${T.badgeText} ${S.meta} flex items-center gap-1.5 bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] border border-[var(--brand-primary)]/20 px-2.5 py-1 rounded-lg`}>
                                                    {tag}
                                                    <button type="button" onClick={() => removeTag(tag)} className="hover:text-[var(--text-strong)]">
                                                        <X size={10} />
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                        <div className="relative group">
                                            <input
                                                type="text"
                                                placeholder="Presiona Enter para agregar..."
                                                className={`${T.inputText} ${S.body} w-full pl-4 pr-12 py-3 bg-[var(--bg-input)] border border-[var(--border-input)] text-[var(--text-strong)] rounded-xl outline-none focus:ring-1 focus:ring-[var(--brand-primary)] transition-all`}
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
                                                className="absolute right-2 top-2 p-1.5 text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/10 rounded-lg transition-colors"
                                            >
                                                <ArrowRight size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className={`flex-1 bg-[var(--bg-card)] py-4 rounded-2xl border border-[var(--border-default)] hover:bg-[var(--bg-elevated)] transition-all order-2 sm:order-1 ${T.buttonText}`}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className={`${T.buttonPrimaryText} ${S.meta} flex-1 bg-[var(--brand-primary)] py-4 rounded-2xl uppercase shadow-xl hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 order-1 sm:order-2`}
                                >
                                    {loading ? (
                                        <div className="w-4 h-4 border-2 border-[var(--brand-primary-foreground)]/20 border-t-[var(--brand-primary-foreground)] rounded-full animate-spin"></div>
                                    ) : (
                                        <>Guardar y Ejecutar <ArrowRight size={14} /></>
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
