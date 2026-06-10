import React, { useState } from 'react';
import { T, S } from '@/lib/text-tokens';
import { templatesApi, CreateTemplatePayload } from '@/api/wabee/templates.api';
import { useToast } from '@/context/ToastContext';

interface Props {
    isOpen: boolean;
    channelId: string;
    onClose: () => void;
    onSuccess: () => void;
}

const LANGUAGES = [
    { code: 'es_MX', label: 'Español (México)' },
    { code: 'es_ES', label: 'Español (España)' },
    { code: 'en_US', label: 'Inglés (EE.UU.)' },
    { code: 'en_GB', label: 'Inglés (Reino Unido)' },
    { code: 'pt_BR', label: 'Portugués (Brasil)' },
];

const EMPTY: CreateTemplatePayload = {
    name: '',
    category: 'UTILITY',
    language: 'es_MX',
    headerText: '',
    body: '',
    footer: '',
};

function replaceVars(text: string) {
    return text.replace(/\{\{(\d+)\}\}/g, (_, n) => `[variable ${n}]`);
}

export default function CreateTemplateModal({ isOpen, channelId, onClose, onSuccess }: Props) {
    const [form, setForm] = useState<CreateTemplatePayload>(EMPTY);
    const [loading, setLoading] = useState(false);
    const [fieldError, setFieldError] = useState('');
    const { success: toastSuccess, error: toastError } = useToast();

    const set = (key: keyof CreateTemplatePayload, value: string) =>
        setForm(prev => ({ ...prev, [key]: value }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFieldError('');

        if (!/^[a-z0-9_]+$/.test(form.name)) {
            setFieldError('El nombre solo puede tener minúsculas, números y guiones bajos.');
            return;
        }
        if (!form.body.trim()) {
            setFieldError('El cuerpo del mensaje es obligatorio.');
            return;
        }

        setLoading(true);
        try {
            const payload: CreateTemplatePayload = {
                name: form.name,
                category: form.category,
                language: form.language,
                body: form.body,
                ...(form.headerText?.trim() && { headerText: form.headerText.trim() }),
                ...(form.footer?.trim() && { footer: form.footer.trim() }),
            };
            await templatesApi.createTemplate(channelId, payload);
            toastSuccess('Plantilla enviada a revisión de Meta.');
            setForm(EMPTY);
            onSuccess();
            onClose();
        } catch (err: any) {
            toastError(err.message || 'Error al crear la plantilla');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="flex w-full max-w-4xl animate-scale-in flex-col overflow-hidden rounded-3xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-2xl lg:flex-row" style={{ maxHeight: '90vh' }}>

                {/* Form column */}
                <div className="flex flex-1 flex-col overflow-y-auto">
                    {/* Header */}
                    <div className="sticky top-0 z-10 flex items-start justify-between border-b border-[var(--border-default)] bg-[var(--bg-card)]/95 p-6 backdrop-blur-md sm:p-8">
                        <div>
                            <h2 className={`${T.sectionTitle} ${S.displayMd} uppercase tracking-tighter`}>
                                Nueva <span className="text-[var(--brand-primary)]">Plantilla</span>
                            </h2>
                            <p className={`${T.helperText} ${S.body} mt-1 font-medium text-[color:var(--text-muted)]`}>
                                La plantilla será enviada a revisión de Meta antes de publicarse.
                            </p>
                        </div>
                        <button onClick={onClose} className="p-2 text-[color:var(--text-muted)] transition-colors hover:text-[color:var(--text-strong)]">
                            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-6 p-6 sm:p-8">
                        {/* Name */}
                        <div>
                            <label className={`${T.labelText} ${S.meta} mb-2 block font-black uppercase tracking-[0.2em] text-[color:var(--text-muted)]`}>
                                Nombre de plantilla *
                            </label>
                            <input
                                type="text"
                                value={form.name}
                                onChange={e => set('name', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                                placeholder="ej: bienvenida_cliente"
                                maxLength={512}
                                required
                                className={`${T.inputText} w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-5 py-3 font-mono text-sm text-[var(--text-strong)] outline-none transition-all placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/50`}
                            />
                            <p className={`${T.helperText} mt-1.5 text-[10px] text-[color:var(--text-muted)] opacity-70`}>
                                Solo minúsculas, números y guiones bajos. Ej: <span className="font-mono">bienvenida_cliente_2024</span>
                            </p>
                        </div>

                        {/* Category + Language */}
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <label className={`${T.labelText} ${S.meta} mb-2 block font-black uppercase tracking-[0.2em] text-[color:var(--text-muted)]`}>
                                    Categoría *
                                </label>
                                <select
                                    value={form.category}
                                    onChange={e => set('category', e.target.value)}
                                    className={`${T.inputText} ${S.body} w-full cursor-pointer appearance-none rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-5 py-3 text-[10px] font-black uppercase tracking-widest text-[var(--text-strong)] outline-none transition-all focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/50`}
                                >
                                    <option value="UTILITY">Utilidad</option>
                                    <option value="MARKETING">Marketing</option>
                                    <option value="AUTHENTICATION">Autenticación</option>
                                </select>
                            </div>
                            <div>
                                <label className={`${T.labelText} ${S.meta} mb-2 block font-black uppercase tracking-[0.2em] text-[color:var(--text-muted)]`}>
                                    Idioma *
                                </label>
                                <select
                                    value={form.language}
                                    onChange={e => set('language', e.target.value)}
                                    className={`${T.inputText} ${S.body} w-full cursor-pointer appearance-none rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-5 py-3 text-[10px] font-black uppercase tracking-widest text-[var(--text-strong)] outline-none transition-all focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/50`}
                                >
                                    {LANGUAGES.map(l => (
                                        <option key={l.code} value={l.code}>{l.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Header (optional) */}
                        <div>
                            <label className={`${T.labelText} ${S.meta} mb-2 block font-black uppercase tracking-[0.2em] text-[color:var(--text-muted)]`}>
                                Encabezado <span className="font-normal normal-case tracking-normal opacity-60">(opcional, máx. 60 caracteres)</span>
                            </label>
                            <input
                                type="text"
                                value={form.headerText}
                                onChange={e => set('headerText', e.target.value)}
                                placeholder="ej: ¡Bienvenido a Wabee!"
                                maxLength={60}
                                className={`${T.inputText} w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-5 py-3 text-sm text-[var(--text-strong)] outline-none transition-all placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/50`}
                            />
                        </div>

                        {/* Body */}
                        <div>
                            <label className={`${T.labelText} ${S.meta} mb-2 block font-black uppercase tracking-[0.2em] text-[color:var(--text-muted)]`}>
                                Cuerpo del mensaje *
                            </label>
                            <textarea
                                value={form.body}
                                onChange={e => set('body', e.target.value)}
                                placeholder="ej: Hola {{1}}, tu pedido {{2}} está listo para recoger."
                                maxLength={1024}
                                rows={5}
                                required
                                className={`${T.inputText} w-full resize-y rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-5 py-3 text-sm text-[var(--text-strong)] outline-none transition-all placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/50`}
                            />
                            <p className={`${T.helperText} mt-1.5 text-[10px] text-[color:var(--text-muted)] opacity-70`}>
                                Usa <span className="font-mono">{'{{1}}'}</span>, <span className="font-mono">{'{{2}}'}</span>… para variables dinámicas. Máx. 1024 caracteres.
                            </p>
                        </div>

                        {/* Footer (optional) */}
                        <div>
                            <label className={`${T.labelText} ${S.meta} mb-2 block font-black uppercase tracking-[0.2em] text-[color:var(--text-muted)]`}>
                                Pie de página <span className="font-normal normal-case tracking-normal opacity-60">(opcional, máx. 60 caracteres)</span>
                            </label>
                            <input
                                type="text"
                                value={form.footer}
                                onChange={e => set('footer', e.target.value)}
                                placeholder="ej: Este mensaje fue enviado por Wabee"
                                maxLength={60}
                                className={`${T.inputText} w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-5 py-3 text-sm text-[var(--text-strong)] outline-none transition-all placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/50`}
                            />
                        </div>

                        {fieldError && (
                            <p className="rounded-xl border border-[var(--state-danger)]/20 bg-[var(--state-danger)]/10 px-4 py-3 text-xs font-bold text-[var(--state-danger)]">
                                {fieldError}
                            </p>
                        )}

                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className={`${T.buttonPrimaryText} flex-1 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] px-6 py-3.5 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] transition-all hover:text-[var(--text-strong)]`}
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={loading || !form.name || !form.body}
                                className={`${T.buttonPrimaryText} flex-1 rounded-2xl bg-[var(--brand-primary)] px-6 py-3.5 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-[var(--brand-primary)]/20 transition-all hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40`}
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                        Enviando...
                                    </span>
                                ) : 'Crear Plantilla'}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Preview column */}
                <div className="hidden w-80 flex-shrink-0 border-l border-[var(--border-default)] bg-[var(--bg-muted)] p-6 lg:flex lg:flex-col xl:w-96">
                    <p className={`${T.labelText} ${S.meta} mb-4 font-black uppercase tracking-[0.2em] text-[color:var(--text-muted)]`}>
                        Vista previa
                    </p>

                    {/* Phone mockup */}
                    <div className="flex flex-1 items-start justify-center pt-4">
                        <div className="w-full max-w-[260px]">
                            <div
                                className="relative overflow-hidden rounded-[28px] border-4 border-[var(--text-strong)] shadow-2xl"
                                style={{ background: '#0d1117', minHeight: 320 }}
                            >
                                {/* WhatsApp-like chat bg */}
                                <div
                                    className="absolute inset-0 opacity-10"
                                    style={{
                                        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.3'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                                    }}
                                />

                                <div className="relative flex flex-col gap-3 p-3 pt-8">
                                    {/* Template bubble */}
                                    <div className="ml-auto max-w-[90%] overflow-hidden rounded-[16px] rounded-tr-sm bg-[#005c4b] shadow-lg">
                                        {form.headerText?.trim() && (
                                            <div className="border-b border-white/10 px-3 py-2">
                                                <p className="text-xs font-bold leading-snug text-white">
                                                    {form.headerText}
                                                </p>
                                            </div>
                                        )}
                                        <div className="px-3 py-2">
                                            <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-white/90">
                                                {form.body
                                                    ? replaceVars(form.body)
                                                    : <span className="italic opacity-40">Escribe el cuerpo del mensaje...</span>
                                                }
                                            </p>
                                        </div>
                                        {form.footer?.trim() && (
                                            <div className="border-t border-white/10 px-3 py-1.5">
                                                <p className="text-[10px] leading-snug text-white/50">
                                                    {form.footer}
                                                </p>
                                            </div>
                                        )}
                                        <div className="flex items-center justify-end gap-1 px-3 pb-2">
                                            <span className="text-[9px] text-white/40">ahora</span>
                                            <svg className="h-3 w-3 text-[#53bdeb]" viewBox="0 0 16 11" fill="currentColor">
                                                <path d="M11.071.653a.75.75 0 0 1 .012 1.06l-5.86 6.08-2.214-2.192a.75.75 0 0 0-1.058 1.063l2.75 2.723a.75.75 0 0 0 1.055.003l6.386-6.626a.75.75 0 0 0-1.071-1.05l.001-.06Z" />
                                                <path d="M14.571.653a.75.75 0 0 1 .012 1.06l-5.86 6.08-.701-.694 5.488-5.694a.75.75 0 0 1 1.06.012l.001-.764Z" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Meta info */}
                            <div className="mt-4 space-y-2 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] opacity-60">Categoría</span>
                                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${form.category === 'MARKETING' ? 'bg-[var(--state-info)]/10 text-[var(--state-info)]' : form.category === 'AUTHENTICATION' ? 'bg-[var(--state-warning)]/10 text-[var(--state-warning)]' : 'bg-[var(--state-success)]/10 text-[var(--state-success)]'}`}>
                                        {form.category}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] opacity-60">Idioma</span>
                                    <span className="font-mono text-[10px] font-bold text-[var(--brand-primary)]">{form.language}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] opacity-60">Estado</span>
                                    <span className="rounded-full bg-[var(--state-warning)]/10 px-2 py-0.5 text-[9px] font-black uppercase text-[var(--state-warning)]">PENDING</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
