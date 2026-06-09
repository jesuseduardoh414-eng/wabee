import React, { useState } from 'react';
import { contactsApi } from '@/api/wabee/contacts.api';
import { X, Upload, CheckCircle2, AlertCircle, Database } from 'lucide-react';
import { T, S } from '@/lib/text-tokens';

interface ImportContactsModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

const COPY = {
    title: 'Importación',
    highlight: 'Masiva',
    subtitle: 'Gestiona tu CRM con carga de archivos CSV',
    noFormat: '¿Sin formato oficial?',
    templateHelp: 'Usa nuestra plantilla para una carga perfecta.',
    required: '✦ Requerido: name, phone',
    optional: '◌ Opcional: email, tags',
    phoneRule: '⚠ Teléfono: texto plano',
    downloadTemplate: 'Descargar Plantilla',
    chooseFile: 'Seleccionar Archivo',
    maxFile: 'Máximo 2MB · Formato CSV',
    newItems: 'Nuevos',
    updated: 'Actualizados',
    skipped: 'Omitidos',
    errors: 'Errores',
    errorLog: 'Registro de Errores',
    row: 'Fila',
    phone: 'Teléfono',
    failure: 'Descripción del Fallo',
    success: 'Operación Finalizada con Éxito',
    cancel: 'Cancelar',
    importAction: 'Ejecutar Importación',
    importing: 'Inyectando...',
    finish: 'Finalizar Transacción',
} as const;

export const ImportContactsModal: React.FC<ImportContactsModalProps> = ({ onClose, onSuccess }) => {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    const handleDownloadTemplate = () => {
        const headers = 'name,phone,email,tags\nJuan Perez,5215512345678,juan@ejemplo.com,"cliente,prioridad"';
        const blob = new Blob([headers], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'plantilla_contactos.csv';
        a.click();
    };

    const handleImport = async () => {
        if (!file) return;
        setUploading(true);
        setError(null);
        try {
            const res = await contactsApi.importCSV(file);
            setResult(res);
        } catch (err: any) {
            console.error('Error importing:', err);
            setError(err.message || 'Error al procesar el archivo. Verifica el formato.');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-6 backdrop-blur-md animate-in fade-in duration-300 sm:items-center">
            <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] border border-[var(--border-default)] bg-[var(--bg-card)] shadow-[0_32px_120px_-20px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-500 sm:rounded-[40px]">
                <div className="flex items-start justify-between gap-4 p-5 pb-4 sm:p-10 sm:pb-6">
                    <div className="min-w-0">
                        <h2 className={`${T.sectionTitle} ${S.displayMd} mb-2 leading-none italic tracking-tighter uppercase`}>
                            {COPY.title} <span className="text-[var(--brand-primary)]">{COPY.highlight}</span>
                        </h2>
                        <p className={`${T.pageSubtitle} ${S.meta} uppercase tracking-wide opacity-80`}>{COPY.subtitle}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="shrink-0 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-3 text-[var(--text-muted)] transition-all hover:border-[var(--brand-primary)]/40 hover:text-[var(--text-strong)]"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 space-y-6 overflow-y-auto px-5 pb-5 sm:space-y-8 sm:px-10 sm:pb-10">
                    {!result ? (
                        <div className="space-y-6 sm:space-y-8">
                            <div className="relative overflow-hidden rounded-3xl border border-[var(--border-default)] bg-[var(--bg-input)] p-5 transition-all hover:border-[var(--brand-primary)]/20 sm:p-6">
                                <div className="absolute left-0 top-0 h-full w-1 bg-[var(--brand-primary)]/40"></div>
                                <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div>
                                        <h3 className={`${T.cardTitle} ${S.headingMd} italic tracking-tight uppercase`}>{COPY.noFormat}</h3>
                                        <p className={`${T.helperText} ${S.body} mt-1 text-[var(--text-muted)]`}>{COPY.templateHelp}</p>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            <span className={`${T.badgeText} ${S.meta} rounded-lg border border-[var(--brand-primary)]/20 bg-[var(--brand-primary)]/10 px-2 py-1 uppercase text-[var(--brand-primary)]`}>{COPY.required}</span>
                                            <span className={`${T.badgeText} ${S.meta} rounded-lg border border-[var(--text-muted)]/20 bg-[var(--text-muted)]/10 px-2 py-1 uppercase text-[var(--text-muted)]`}>{COPY.optional}</span>
                                            <span className={`${T.badgeText} ${S.meta} rounded-lg border border-orange-500/20 bg-orange-500/10 px-2 py-1 uppercase text-orange-500`}>{COPY.phoneRule}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleDownloadTemplate}
                                        className={`${T.buttonPrimaryText} ${S.meta} relative z-10 shrink-0 rounded-2xl border border-[var(--brand-primary)]/20 bg-[var(--brand-primary)]/5 px-5 py-3 uppercase text-[var(--brand-primary)] transition-all hover:bg-[var(--brand-primary)]/12 sm:px-6`}
                                    >
                                        {COPY.downloadTemplate}
                                    </button>
                                </div>
                            </div>

                            <div className={`relative flex flex-col items-center justify-center rounded-[32px] border-2 border-dashed p-8 text-center transition-all duration-500 sm:rounded-[40px] sm:p-12 ${
                                file ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5' : 'border-[var(--border-default)] bg-[var(--bg-input)]/50 hover:border-[var(--brand-primary)]/40 hover:bg-[var(--bg-input)]'
                            }`}>
                                <input
                                    type="file"
                                    accept=".csv"
                                    className="absolute inset-0 z-20 cursor-pointer opacity-0"
                                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                                />

                                <div className={`mb-6 rounded-3xl p-5 transition-all duration-500 sm:p-6 ${file ? 'scale-110 bg-[var(--brand-primary)]' : 'bg-[var(--bg-card)] text-[var(--text-muted)]'}`}>
                                    <Upload size={36} />
                                </div>

                                <div className="space-y-1">
                                    <p className={`${T.buttonText} ${S.headingMd} break-all uppercase italic ${file ? 'text-[var(--text-strong)]' : 'text-[var(--text-muted)]'}`}>
                                        {file ? file.name : COPY.chooseFile}
                                    </p>
                                    <p className={`${T.helperText} ${S.meta} uppercase tracking-widest text-[var(--brand-primary)]/60`}>
                                        {file ? `${(file.size / 1024).toFixed(1)} KB` : COPY.maxFile}
                                    </p>
                                </div>
                            </div>

                            {error && (
                                <div className="flex items-center gap-4 rounded-[28px] border border-red-500/20 bg-red-500/10 p-5 animate-shake sm:p-6">
                                    <AlertCircle className="shrink-0 text-red-500" size={24} />
                                    <p className={`${T.helperText} ${S.body} text-red-500 uppercase italic tracking-tight`}>{error}</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-8 py-2 animate-in fade-in slide-in-from-top-4 duration-500 sm:space-y-10 sm:py-4">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4">
                                <div className="rounded-[28px] border border-green-500/20 bg-green-500/10 p-5 transition-all hover:scale-[1.02] sm:rounded-[32px] sm:p-6">
                                    <div className={`${T.kpiValue} ${S.displayMd} leading-none italic tracking-tighter text-green-500`}>{result.created}</div>
                                    <div className={`${T.helperText} ${S.meta} mt-2 uppercase tracking-widest text-green-500/80`}>{COPY.newItems}</div>
                                </div>
                                <div className="rounded-[28px] border border-blue-500/20 bg-blue-500/10 p-5 transition-all hover:scale-[1.02] sm:rounded-[32px] sm:p-6">
                                    <div className={`${T.kpiValue} ${S.displayMd} leading-none italic tracking-tighter text-blue-500`}>{result.updated}</div>
                                    <div className={`${T.helperText} ${S.meta} mt-2 uppercase tracking-widest text-blue-500/80`}>{COPY.updated}</div>
                                </div>
                                <div className="rounded-[28px] border border-[var(--border-default)] bg-[var(--bg-input)] p-5 transition-all hover:scale-[1.02] sm:rounded-[32px] sm:p-6">
                                    <div className={`${T.kpiValue} ${S.displayMd} leading-none italic tracking-tighter text-[var(--text-muted)]`}>{result.skipped}</div>
                                    <div className={`${T.helperText} ${S.meta} mt-2 uppercase tracking-widest text-[var(--text-muted)]/80`}>{COPY.skipped}</div>
                                </div>
                                <div className="rounded-[28px] border border-red-500/20 bg-red-500/10 p-5 transition-all hover:scale-[1.02] sm:rounded-[32px] sm:p-6">
                                    <div className={`${T.kpiValue} ${S.displayMd} leading-none italic tracking-tighter text-red-500`}>{result.errors?.length || 0}</div>
                                    <div className={`${T.helperText} ${S.meta} mt-2 uppercase tracking-widest text-red-500/80`}>{COPY.errors}</div>
                                </div>
                            </div>

                            {result.errors && result.errors.length > 0 && (
                                <div className="overflow-hidden rounded-[28px] border border-[var(--border-default)] bg-[var(--bg-input)] sm:rounded-[32px]">
                                    <div className="flex items-center justify-between border-b border-red-500/20 bg-red-500/10 px-5 py-4 sm:px-8">
                                        <span className={`${T.sectionTitle} ${S.meta} uppercase tracking-[0.2em] text-red-500`}>{COPY.errorLog}</span>
                                        <span className={`${T.badgeText} ${S.meta} rounded-lg bg-red-500 px-2 py-1 text-white`}>{result.errors.length}</span>
                                    </div>
                                    <div className="max-h-60 overflow-y-auto">
                                        <div className="hidden md:block">
                                            <table className="w-full border-collapse text-left">
                                                <thead>
                                                    <tr className={`${T.tableHeader} ${S.meta} border-b border-[var(--border-default)] uppercase tracking-widest text-[var(--text-muted)]`}>
                                                        <th className="px-8 py-4">{COPY.row}</th>
                                                        <th className="px-8 py-4">{COPY.phone}</th>
                                                        <th className="px-8 py-4">{COPY.failure}</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-[var(--border-default)]">
                                                    {result.errors.map((e: any, idx: number) => (
                                                        <tr key={idx} className="transition-colors hover:bg-[var(--text-strong)]/[0.02]">
                                                            <td className={`${T.tableCell} ${S.meta} px-8 py-4 font-mono text-[var(--brand-primary)]`}>#{e.row}</td>
                                                            <td className={`${T.tableCell} ${S.meta} px-8 py-4 text-[var(--text-strong)]`}>{e.phone || '--'}</td>
                                                            <td className={`${T.tableCell} ${S.meta} px-8 py-4 text-red-500`}>{e.reason}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        <div className="divide-y divide-[var(--border-default)] md:hidden">
                                            {result.errors.map((e: any, idx: number) => (
                                                <div key={idx} className="space-y-2 px-5 py-4">
                                                    <p className={`${T.helperText} ${S.meta} uppercase text-[var(--brand-primary)]`}>{COPY.row} #{e.row}</p>
                                                    <p className={`${T.tableCell} ${S.body} break-all`}>{e.phone || '--'}</p>
                                                    <p className={`${T.helperText} ${S.body} text-red-500`}>{e.reason}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {result.created + result.updated > 0 && (
                                <div className="flex items-center gap-4 rounded-[28px] border border-[var(--brand-primary)]/20 bg-[var(--brand-primary)]/10 p-5 animate-pulse sm:p-6">
                                    <div className="rounded-full bg-[var(--brand-primary)] p-2">
                                        <CheckCircle2 size={20} />
                                    </div>
                                    <p className={`${T.sectionTitle} ${S.body} uppercase italic tracking-tight text-[var(--brand-primary)]`}>{COPY.success}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex flex-col gap-3 border-t border-[var(--border-default)] bg-[var(--bg-card)] px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:gap-5 sm:px-10 sm:py-8">
                    {!result ? (
                        <>
                            <button
                                onClick={onClose}
                                className={`${T.buttonText} ${S.meta} w-full px-8 py-3 text-center uppercase tracking-[0.2em] text-[var(--text-muted)] transition-all hover:text-[var(--text-strong)] sm:w-auto sm:py-4`}
                            >
                                {COPY.cancel}
                            </button>
                            <button
                                onClick={handleImport}
                                disabled={!file || uploading}
                                className={`${T.buttonPrimaryText} ${S.meta} flex w-full items-center justify-center gap-3 rounded-3xl bg-[var(--brand-primary)] px-8 py-4 uppercase transition-all hover:brightness-110 hover:shadow-[0_0_40px_-5px_var(--brand-primary)] active:scale-95 disabled:grayscale disabled:opacity-30 sm:w-auto sm:px-10`}
                            >
                                {uploading ? (
                                    <>
                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--brand-primary-foreground)]/20 border-t-[var(--brand-primary-foreground)]"></div>
                                        {COPY.importing}
                                    </>
                                ) : (
                                    <>
                                        {COPY.importAction}
                                        <Database size={16} />
                                    </>
                                )}
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={() => { onSuccess(); onClose(); }}
                            className={`${T.buttonPrimaryText} ${S.meta} w-full rounded-[24px] bg-[var(--text-strong)] px-10 py-5 uppercase tracking-[0.3em] text-[var(--bg-card)] shadow-xl transition-all hover:bg-[var(--brand-primary)]`}
                        >
                            {COPY.finish}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
