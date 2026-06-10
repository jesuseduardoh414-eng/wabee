import React, { useState, useMemo } from 'react';
import { T, S } from '@/lib/text-tokens';
import { templatesApi, CreateTemplatePayload, TemplateButton } from '@/api/wabee/templates.api';
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

type Category = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';

function detectVarCount(text: string): number {
    const matches = text.match(/\{\{(\d+)\}\}/g);
    if (!matches) return 0;
    return Math.max(...matches.map(m => parseInt(m.replace(/\D/g, ''))));
}

function fillExamples(text: string, examples: string[]) {
    return text.replace(/\{\{(\d+)\}\}/g, (_, n) => {
        const v = examples[parseInt(n) - 1];
        return v?.trim() ? v : `[variable ${n}]`;
    });
}

const CATEGORY_LABEL: Record<Category, string> = {
    MARKETING: 'Marketing',
    UTILITY: 'Utilidad',
    AUTHENTICATION: 'Autenticación',
};

const CATEGORY_HINT: Record<Category, string> = {
    MARKETING: 'Promociones, ofertas, anuncios y boletines.',
    UTILITY: 'Confirmaciones, recordatorios, notificaciones de cuenta.',
    AUTHENTICATION: 'Códigos OTP de un solo uso para verificar identidad.',
};

export default function CreateTemplateModal({ isOpen, channelId, onClose, onSuccess }: Props) {
    const [name, setName] = useState('');
    const [category, setCategory] = useState<Category>('UTILITY');
    const [language, setLanguage] = useState('es_MX');

    // MARKETING / UTILITY fields
    const [headerText, setHeaderText] = useState('');
    const [body, setBody] = useState('');
    const [examples, setExamples] = useState<string[]>([]);
    const [footer, setFooter] = useState('');
    const [buttons, setButtons] = useState<TemplateButton[]>([]);

    // AUTHENTICATION fields
    const [securityRec, setSecurityRec] = useState(true);
    const [expiryMinutes, setExpiryMinutes] = useState<string>('10');

    const [loading, setLoading] = useState(false);
    const [fieldError, setFieldError] = useState('');
    const { success: toastSuccess, error: toastError } = useToast();

    const varCount = useMemo(() => detectVarCount(body), [body]);

    const reset = () => {
        setName(''); setCategory('UTILITY'); setLanguage('es_MX');
        setHeaderText(''); setBody(''); setExamples([]); setFooter(''); setButtons([]);
        setSecurityRec(true); setExpiryMinutes('10'); setFieldError('');
    };

    const handleClose = () => { reset(); onClose(); };

    // Button helpers
    const addButton = (type: TemplateButton['type']) => {
        if (buttons.length >= 3) return;
        setButtons(prev => [...prev, { type, text: '', url: '', phone: '' }]);
    };
    const updateButton = (i: number, field: keyof TemplateButton, val: string) =>
        setButtons(prev => prev.map((b, idx) => idx === i ? { ...b, [field]: val } : b));
    const removeButton = (i: number) => setButtons(prev => prev.filter((_, idx) => idx !== i));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFieldError('');

        if (!/^[a-z0-9_]+$/.test(name)) {
            setFieldError('El nombre solo puede tener minúsculas, números y guiones bajos.');
            return;
        }

        if (category !== 'AUTHENTICATION') {
            if (!body.trim()) { setFieldError('El cuerpo del mensaje es obligatorio.'); return; }
            if (varCount > 0) {
                const missing = Array.from({ length: varCount }, (_, i) => examples[i]?.trim()).findIndex(v => !v);
                if (missing !== -1) { setFieldError(`Ingresa un ejemplo para {{${missing + 1}}}.`); return; }
            }
            for (const btn of buttons) {
                if (!btn.text.trim()) { setFieldError('Todos los botones deben tener texto.'); return; }
                if (btn.type === 'URL' && !btn.url?.trim()) { setFieldError('Ingresa la URL del botón.'); return; }
                if (btn.type === 'PHONE_NUMBER' && !btn.phone?.trim()) { setFieldError('Ingresa el teléfono del botón.'); return; }
            }
        }

        setLoading(true);
        try {
            let payload: CreateTemplatePayload;

            if (category === 'AUTHENTICATION') {
                payload = {
                    category: 'AUTHENTICATION',
                    name,
                    language,
                    addSecurityRecommendation: securityRec,
                    ...(expiryMinutes && { codeExpirationMinutes: parseInt(expiryMinutes) }),
                };
            } else {
                payload = {
                    category,
                    name,
                    language,
                    body,
                    ...(varCount > 0 && { bodyExamples: Array.from({ length: varCount }, (_, i) => examples[i] || `ejemplo_${i + 1}`) }),
                    ...(headerText.trim() && { headerText: headerText.trim() }),
                    ...(footer.trim() && { footer: footer.trim() }),
                    ...(buttons.length > 0 && { buttons }),
                };
            }

            await templatesApi.createTemplate(channelId, payload);
            toastSuccess('Plantilla enviada a revisión de Meta.');
            reset();
            onSuccess();
            onClose();
        } catch (err: any) {
            const msg = err.detail ? `${err.message}: ${err.detail}` : (err.message || 'Error al crear la plantilla');
            toastError(msg);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const previewBody = varCount > 0 ? fillExamples(body, examples) : body;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="flex w-full max-w-4xl animate-scale-in flex-col overflow-hidden rounded-3xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-2xl lg:flex-row" style={{ maxHeight: '90vh' }}>

                {/* ── Form column ── */}
                <div className="flex flex-1 flex-col overflow-y-auto">
                    {/* Header */}
                    <div className="sticky top-0 z-10 flex items-start justify-between border-b border-[var(--border-default)] bg-[var(--bg-card)]/95 p-6 backdrop-blur-md sm:p-8">
                        <div>
                            <h2 className={`${T.sectionTitle} ${S.displayMd} uppercase tracking-tighter`}>
                                Nueva <span className="text-[var(--brand-primary)]">Plantilla</span>
                            </h2>
                            <p className={`${T.helperText} ${S.body} mt-1 font-medium text-[color:var(--text-muted)]`}>
                                Enviada a revisión de Meta antes de publicarse.
                            </p>
                        </div>
                        <button onClick={handleClose} className="p-2 text-[color:var(--text-muted)] transition-colors hover:text-[color:var(--text-strong)]">
                            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-6 p-6 sm:p-8">

                        {/* Name + Language */}
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <label className={`${T.labelText} ${S.meta} mb-2 block font-black uppercase tracking-[0.2em] text-[color:var(--text-muted)]`}>Nombre *</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                                    placeholder="ej: confirmacion_pedido"
                                    maxLength={512}
                                    required
                                    className={`${T.inputText} w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-5 py-3 font-mono text-sm text-[var(--text-strong)] outline-none transition-all placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/50`}
                                />
                                <p className={`${T.helperText} mt-1 text-[10px] text-[color:var(--text-muted)] opacity-70`}>Solo minúsculas, números y guiones bajos.</p>
                            </div>
                            <div>
                                <label className={`${T.labelText} ${S.meta} mb-2 block font-black uppercase tracking-[0.2em] text-[color:var(--text-muted)]`}>Idioma *</label>
                                <select value={language} onChange={e => setLanguage(e.target.value)} className={`${T.inputText} ${S.body} w-full cursor-pointer appearance-none rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-5 py-3 text-[10px] font-black uppercase tracking-widest text-[var(--text-strong)] outline-none transition-all focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/50`}>
                                    {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Category selector */}
                        <div>
                            <label className={`${T.labelText} ${S.meta} mb-3 block font-black uppercase tracking-[0.2em] text-[color:var(--text-muted)]`}>Categoría *</label>
                            <div className="grid grid-cols-3 gap-2">
                                {(['MARKETING', 'UTILITY', 'AUTHENTICATION'] as Category[]).map(cat => (
                                    <button
                                        key={cat}
                                        type="button"
                                        onClick={() => setCategory(cat)}
                                        className={`rounded-2xl border p-3 text-left transition-all ${category === cat ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/10' : 'border-[var(--border-default)] bg-[var(--bg-input)] hover:border-[var(--brand-primary)]/40'}`}
                                    >
                                        <span className={`block text-[9px] font-black uppercase tracking-widest ${category === cat ? 'text-[var(--brand-primary)]' : 'text-[var(--text-muted)]'}`}>{CATEGORY_LABEL[cat]}</span>
                                        <span className="mt-1 block text-[9px] leading-tight text-[var(--text-muted)] opacity-70">{CATEGORY_HINT[cat]}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* ── AUTHENTICATION fields ── */}
                        {category === 'AUTHENTICATION' && (
                            <div className="space-y-4 rounded-2xl border border-[var(--brand-primary)]/20 bg-[var(--brand-primary)]/5 p-5">
                                <p className={`${T.labelText} ${S.meta} font-black uppercase tracking-[0.15em] text-[var(--brand-primary)]`}>Configuración OTP</p>
                                <p className="text-[10px] text-[var(--text-muted)]">Meta genera automáticamente el cuerpo del mensaje con el código y el botón "Copiar código". Solo configura las opciones de seguridad.</p>

                                {/* Preview of what Meta generates */}
                                <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-3">
                                    <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)] opacity-60">Vista previa generada por Meta</p>
                                    <p className="text-xs text-[var(--text-strong)]"><span className="font-bold">123456</span> es tu código de verificación.</p>
                                    {securityRec && <p className="text-[10px] text-[var(--text-muted)]">Por tu seguridad, no lo compartas con nadie.</p>}
                                    {expiryMinutes && <p className="text-[10px] text-[var(--text-muted)]">Este código vence en {expiryMinutes} minutos.</p>}
                                    <div className="mt-2 rounded-lg border border-[var(--brand-primary)]/30 py-1.5 text-center text-[10px] font-bold text-[var(--brand-primary)]">📋 Copiar código</div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <input id="security-rec" type="checkbox" checked={securityRec} onChange={e => setSecurityRec(e.target.checked)} className="h-4 w-4 accent-[var(--brand-primary)]" />
                                    <label htmlFor="security-rec" className="text-sm text-[var(--text-strong)]">Agregar aviso de seguridad <span className="text-[var(--text-muted)]">("No lo compartas con nadie")</span></label>
                                </div>

                                <div>
                                    <label className={`${T.labelText} ${S.meta} mb-2 block font-black uppercase tracking-[0.2em] text-[color:var(--text-muted)]`}>
                                        Expiración <span className="font-normal normal-case tracking-normal opacity-60">(minutos, opcional)</span>
                                    </label>
                                    <input
                                        type="number"
                                        value={expiryMinutes}
                                        onChange={e => setExpiryMinutes(e.target.value)}
                                        min={1} max={90}
                                        placeholder="10"
                                        className={`${T.inputText} w-32 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-4 py-2.5 text-sm text-[var(--text-strong)] outline-none transition-all focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/50`}
                                    />
                                </div>
                            </div>
                        )}

                        {/* ── MARKETING / UTILITY fields ── */}
                        {category !== 'AUTHENTICATION' && (
                            <>
                                {/* Header */}
                                <div>
                                    <label className={`${T.labelText} ${S.meta} mb-2 block font-black uppercase tracking-[0.2em] text-[color:var(--text-muted)]`}>
                                        Encabezado <span className="font-normal normal-case tracking-normal opacity-60">(opcional, máx. 60 caracteres)</span>
                                    </label>
                                    <input type="text" value={headerText} onChange={e => setHeaderText(e.target.value)} placeholder="ej: ¡Tu pedido está listo!" maxLength={60}
                                        className={`${T.inputText} w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-5 py-3 text-sm text-[var(--text-strong)] outline-none transition-all placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/50`} />
                                </div>

                                {/* Body */}
                                <div>
                                    <label className={`${T.labelText} ${S.meta} mb-2 block font-black uppercase tracking-[0.2em] text-[color:var(--text-muted)]`}>Cuerpo del mensaje *</label>
                                    <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="ej: Hola {{1}}, tu pedido #{{2}} fue confirmado." maxLength={1024} rows={4} required
                                        className={`${T.inputText} w-full resize-y rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-5 py-3 text-sm text-[var(--text-strong)] outline-none transition-all placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/50`} />
                                    <p className={`${T.helperText} mt-1.5 text-[10px] text-[color:var(--text-muted)] opacity-70`}>Usa <span className="font-mono">{'{{1}}'}</span>, <span className="font-mono">{'{{2}}'}</span>… para variables dinámicas.</p>
                                </div>

                                {/* Variable examples */}
                                {varCount > 0 && (
                                    <div className="rounded-2xl border border-[var(--brand-primary)]/20 bg-[var(--brand-primary)]/5 p-4">
                                        <p className={`${T.labelText} ${S.meta} mb-3 font-black uppercase tracking-[0.2em] text-[var(--brand-primary)]`}>
                                            Ejemplos de variables <span className="font-normal normal-case tracking-normal opacity-70 text-[var(--text-muted)]">— requeridos por Meta</span>
                                        </p>
                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                            {Array.from({ length: varCount }, (_, i) => (
                                                <div key={i}>
                                                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                                                        Variable <span className="font-mono text-[var(--brand-primary)]">{`{{${i + 1}}}`}</span>
                                                    </label>
                                                    <input type="text" value={examples[i] || ''} onChange={e => { const next = [...examples]; next[i] = e.target.value; setExamples(next); }} placeholder={i === 0 ? 'Juan García' : i === 1 ? 'PED-00123' : `valor_${i + 1}`} maxLength={100} required
                                                        className={`${T.inputText} w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-4 py-2.5 text-sm text-[var(--text-strong)] outline-none transition-all placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/50`} />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Footer */}
                                <div>
                                    <label className={`${T.labelText} ${S.meta} mb-2 block font-black uppercase tracking-[0.2em] text-[color:var(--text-muted)]`}>
                                        Pie de página <span className="font-normal normal-case tracking-normal opacity-60">(opcional, máx. 60 caracteres)</span>
                                    </label>
                                    <input type="text" value={footer} onChange={e => setFooter(e.target.value)} placeholder="ej: Este mensaje fue enviado por Wabee" maxLength={60}
                                        className={`${T.inputText} w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-5 py-3 text-sm text-[var(--text-strong)] outline-none transition-all placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/50`} />
                                </div>

                                {/* Buttons */}
                                <div>
                                    <div className="mb-3 flex items-center justify-between">
                                        <label className={`${T.labelText} ${S.meta} font-black uppercase tracking-[0.2em] text-[color:var(--text-muted)]`}>
                                            Botones <span className="font-normal normal-case tracking-normal opacity-60">(opcional, máx. 3)</span>
                                        </label>
                                        {buttons.length < 3 && (
                                            <div className="flex gap-2">
                                                <button type="button" onClick={() => addButton('QUICK_REPLY')} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] transition-all hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]">+ Respuesta</button>
                                                <button type="button" onClick={() => addButton('URL')} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] transition-all hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]">+ URL</button>
                                                <button type="button" onClick={() => addButton('PHONE_NUMBER')} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] transition-all hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]">+ Teléfono</button>
                                            </div>
                                        )}
                                    </div>
                                    {buttons.length > 0 && (
                                        <div className="space-y-3">
                                            {buttons.map((btn, i) => (
                                                <div key={i} className="flex items-start gap-2 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-3">
                                                    <div className="flex flex-1 flex-col gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${btn.type === 'QUICK_REPLY' ? 'bg-[var(--state-success)]/10 text-[var(--state-success)]' : btn.type === 'URL' ? 'bg-[var(--state-info)]/10 text-[var(--state-info)]' : 'bg-[var(--state-warning)]/10 text-[var(--state-warning)]'}`}>
                                                                {btn.type === 'QUICK_REPLY' ? 'Respuesta' : btn.type === 'URL' ? 'Enlace URL' : 'Teléfono'}
                                                            </span>
                                                        </div>
                                                        <input type="text" value={btn.text} onChange={e => updateButton(i, 'text', e.target.value)} placeholder="Texto del botón (máx. 25)" maxLength={25} required
                                                            className={`${T.inputText} w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-2 text-sm text-[var(--text-strong)] outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)]/50`} />
                                                        {btn.type === 'URL' && (
                                                            <input type="url" value={btn.url || ''} onChange={e => updateButton(i, 'url', e.target.value)} placeholder="https://ejemplo.com" required
                                                                className={`${T.inputText} w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-2 text-sm text-[var(--text-strong)] outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)]/50`} />
                                                        )}
                                                        {btn.type === 'PHONE_NUMBER' && (
                                                            <input type="tel" value={btn.phone || ''} onChange={e => updateButton(i, 'phone', e.target.value)} placeholder="+521234567890" required
                                                                className={`${T.inputText} w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-2 text-sm text-[var(--text-strong)] outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)]/50`} />
                                                        )}
                                                    </div>
                                                    <button type="button" onClick={() => removeButton(i)} className="mt-1 rounded-lg p-1.5 text-[var(--state-danger)] opacity-60 transition-all hover:opacity-100">
                                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {fieldError && (
                            <p className="rounded-xl border border-[var(--state-danger)]/20 bg-[var(--state-danger)]/10 px-4 py-3 text-xs font-bold text-[var(--state-danger)]">{fieldError}</p>
                        )}

                        <div className="flex gap-3 pt-2">
                            <button type="button" onClick={handleClose} className={`${T.buttonPrimaryText} flex-1 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] px-6 py-3.5 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] transition-all hover:text-[var(--text-strong)]`}>Cancelar</button>
                            <button type="submit" disabled={loading || !name || (category !== 'AUTHENTICATION' && !body)}
                                className={`${T.buttonPrimaryText} flex-1 rounded-2xl bg-[var(--brand-primary)] px-6 py-3.5 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-[var(--brand-primary)]/20 transition-all hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40`}>
                                {loading ? <span className="flex items-center justify-center gap-2"><span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />Enviando...</span> : 'Crear Plantilla'}
                            </button>
                        </div>
                    </form>
                </div>

                {/* ── Preview column ── */}
                <div className="hidden w-80 flex-shrink-0 border-l border-[var(--border-default)] bg-[var(--bg-muted)] p-6 lg:flex lg:flex-col xl:w-96">
                    <p className={`${T.labelText} ${S.meta} mb-4 font-black uppercase tracking-[0.2em] text-[color:var(--text-muted)]`}>Vista previa</p>

                    <div className="flex flex-1 items-start justify-center pt-4">
                        <div className="w-full max-w-[260px]">
                            <div className="relative overflow-hidden rounded-[28px] border-4 border-[var(--text-strong)] shadow-2xl" style={{ background: '#0d1117', minHeight: 320 }}>
                                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.3'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }} />
                                <div className="relative flex flex-col gap-3 p-3 pt-8">
                                    {category === 'AUTHENTICATION' ? (
                                        /* OTP preview */
                                        <div className="mx-auto w-[90%] overflow-hidden rounded-[16px] rounded-tr-sm bg-[#1a1a2e] shadow-lg">
                                            <div className="px-3 py-3">
                                                <p className="text-[11px] leading-relaxed text-white/90">
                                                    <span className="font-bold text-white">123456</span> es tu código de verificación.
                                                </p>
                                                {securityRec && <p className="mt-1 text-[10px] text-white/60">Por tu seguridad, no lo compartas con nadie.</p>}
                                                {expiryMinutes && <p className="mt-1 text-[10px] text-white/50">Este código vence en {expiryMinutes} minutos.</p>}
                                            </div>
                                            <div className="border-t border-white/10 py-2 text-center text-[10px] font-bold text-[#53bdeb]">📋 Copiar código</div>
                                        </div>
                                    ) : (
                                        /* Normal template preview */
                                        <div className="ml-auto max-w-[90%] overflow-hidden rounded-[16px] rounded-tr-sm bg-[#005c4b] shadow-lg">
                                            {headerText?.trim() && <div className="border-b border-white/10 px-3 py-2"><p className="text-xs font-bold text-white">{headerText}</p></div>}
                                            <div className="px-3 py-2">
                                                <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-white/90">
                                                    {previewBody || <span className="italic opacity-40">Escribe el cuerpo del mensaje...</span>}
                                                </p>
                                            </div>
                                            {footer?.trim() && <div className="border-t border-white/10 px-3 py-1.5"><p className="text-[10px] text-white/50">{footer}</p></div>}
                                            {buttons.length > 0 && (
                                                <div className="border-t border-white/10">
                                                    {buttons.map((btn, i) => (
                                                        <div key={i} className="border-b border-white/10 py-2 text-center text-[10px] font-bold text-[#53bdeb] last:border-0">
                                                            {btn.type === 'URL' ? '🔗 ' : btn.type === 'PHONE_NUMBER' ? '📞 ' : '↩ '}
                                                            {btn.text || 'Botón'}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            <div className="flex items-center justify-end gap-1 px-3 pb-2">
                                                <span className="text-[9px] text-white/40">ahora</span>
                                                <svg className="h-3 w-3 text-[#53bdeb]" viewBox="0 0 16 11" fill="currentColor"><path d="M11.071.653a.75.75 0 0 1 .012 1.06l-5.86 6.08-2.214-2.192a.75.75 0 0 0-1.058 1.063l2.75 2.723a.75.75 0 0 0 1.055.003l6.386-6.626a.75.75 0 0 0-1.071-1.05l.001-.06Z" /><path d="M14.571.653a.75.75 0 0 1 .012 1.06l-5.86 6.08-.701-.694 5.488-5.694a.75.75 0 0 1 1.06.012l.001-.764Z" /></svg>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="mt-4 space-y-2 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] opacity-60">Categoría</span>
                                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${{ MARKETING: 'bg-[var(--state-info)]/10 text-[var(--state-info)]', AUTHENTICATION: 'bg-[var(--state-warning)]/10 text-[var(--state-warning)]', UTILITY: 'bg-[var(--state-success)]/10 text-[var(--state-success)]' }[category]}`}>{CATEGORY_LABEL[category]}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] opacity-60">Idioma</span>
                                    <span className="font-mono text-[10px] font-bold text-[var(--brand-primary)]">{language}</span>
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
