import React, { useState } from 'react';
import { contactsApi } from '@/api/wabee/contacts.api';
import { X, Upload, FileText, CheckCircle2, AlertCircle, Download, Database } from 'lucide-react';
import { T, S } from '@/lib/text-tokens';

interface ImportContactsModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-[40px] shadow-[0_32px_120px_-20px_rgba(0,0,0,0.8)] w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-500">
                
                {/* Header */}
                <div className="p-10 pb-6 flex justify-between items-start">
                    <div>
                        <h2 className={`${T.sectionTitle} ${S.displayMd} italic tracking-tighter leading-none mb-2 uppercase`}>
                            Importación <span className="text-[var(--brand-primary)]">Masiva</span>
                        </h2>
                        <p className={`${T.pageSubtitle} ${S.meta} opacity-80 uppercase tracking-wide`}>Gestiona tu CRM con carga de archivos CSV</p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-3 bg-[var(--bg-input)] border border-[var(--border-default)] rounded-2xl text-[var(--text-muted)] hover:text-[var(--text-strong)] hover:border-[var(--brand-primary)]/40 transition-all"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="px-10 pb-10 overflow-y-auto flex-1 space-y-8">
                    {!result ? (
                        <div className="space-y-8">
                            {/* Step 1: Template */}
                            <div className="relative group overflow-hidden bg-[var(--bg-input)] border border-[var(--border-default)] p-6 rounded-3xl transition-all hover:border-[var(--brand-primary)]/20">
                                <div className="absolute top-0 left-0 w-1 h-full bg-[var(--brand-primary)]/40"></div>
                                <div className="relative z-10 flex justify-between items-start gap-4">
                                    <div>
                                        <h3 className={`${T.cardTitle} ${S.headingMd} italic tracking-tight uppercase`}>¿Sin formato oficial?</h3>
                                        <p className={`${T.helperText} ${S.body} mt-1 text-[var(--text-muted)]`}>Usa nuestra plantilla para una carga perfecta.</p>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            <span className={`${T.badgeText} ${S.meta} px-2 py-1 bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] uppercase rounded-lg border border-[var(--brand-primary)]/20`}>
                                                ✦ Requerido: name, phone
                                            </span>
                                            <span className={`${T.badgeText} ${S.meta} px-2 py-1 bg-[var(--text-muted)]/10 text-[var(--text-muted)] uppercase rounded-lg border border-[var(--text-muted)]/20`}>
                                                ○ Opcional: email, tags
                                            </span>
                                            <span className={`${T.badgeText} ${S.meta} px-2 py-1 bg-orange-500/10 text-orange-500 uppercase rounded-lg border border-orange-500/20`}>
                                                ⚠ Teléfono: texto plano
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleDownloadTemplate}
                                        className={`${T.buttonPrimaryText} ${S.meta} shrink-0 relative z-10 bg-[var(--brand-primary)]/5 text-[var(--brand-primary)] px-6 py-3 rounded-2xl uppercase border border-[var(--brand-primary)]/20 hover:bg-[var(--brand-primary)] hover: transition-all`}
                                    >
                                        Descargar Plantilla
                                    </button>
                                </div>
                            </div>

                            {/* Step 2: Upload Area */}
                            <div className={`relative group border-2 border-dashed rounded-[40px] p-12 flex flex-col items-center justify-center text-center transition-all duration-500 ${
                                file ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5' : 'border-[var(--border-default)] hover:border-[var(--brand-primary)]/40 bg-[var(--bg-input)]/50 hover:bg-[var(--bg-input)]'
                            }`}>
                                <input 
                                    type="file" 
                                    accept=".csv"
                                    className="absolute inset-0 opacity-0 cursor-pointer z-20"
                                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                                />
                                
                                <div className={`mb-6 p-6 rounded-3xl transition-all duration-500 ${
                                    file ? 'bg-[var(--brand-primary)]  scale-110' : 'bg-[var(--bg-card)] text-[var(--text-muted)] group-hover:scale-110 group-hover:text-[var(--brand-primary)]'
                                }`}>
                                    <Upload size={40} />
                                </div>

                                <div className="space-y-1">
                                    <p className={`${T.buttonText} ${S.headingMd} uppercase italic ${file ? 'text-[var(--text-strong)]' : 'text-[var(--text-muted)] group-hover:text-[var(--text-strong)]'}`}>
                                        {file ? file.name : 'Seleccionar Archivo'}
                                    </p>
                                    <p className={`${T.helperText} ${S.meta} uppercase tracking-widest text-[var(--brand-primary)]/60`}>
                                        {file ? `${(file.size / 1024).toFixed(1)} KB` : 'Máximo 2MB · Formato CSV'}
                                    </p>
                                </div>
                            </div>

                            {error && (
                                <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-[32px] flex items-center gap-4 animate-shake">
                                    <AlertCircle className="text-red-500 shrink-0" size={24} />
                                    <p className={`${T.helperText} ${S.body} text-red-500 uppercase italic tracking-tight`}>{error}</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-10 py-4 animate-in fade-in slide-in-from-top-4 duration-500">
                            {/* Detailed Results Grid */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="bg-green-500/10 border border-green-500/20 p-6 rounded-[32px] transition-all hover:scale-[1.02]">
                                    <div className={`${T.kpiValue} ${S.displayMd} text-green-500 italic tracking-tighter leading-none`}>{result.created}</div>
                                    <div className={`${T.helperText} ${S.meta} text-green-500/80 uppercase tracking-widest mt-2`}>Nuevos</div>
                                </div>
                                <div className="bg-blue-500/10 border border-blue-500/20 p-6 rounded-[32px] transition-all hover:scale-[1.02]">
                                    <div className={`${T.kpiValue} ${S.displayMd} text-blue-500 italic tracking-tighter leading-none`}>{result.updated}</div>
                                    <div className={`${T.helperText} ${S.meta} text-blue-500/80 uppercase tracking-widest mt-2`}>Actualizados</div>
                                </div>
                                <div className="bg-[var(--bg-input)] border border-[var(--border-default)] p-6 rounded-[32px] transition-all hover:scale-[1.02]">
                                    <div className={`${T.kpiValue} ${S.displayMd} text-[var(--text-muted)] italic tracking-tighter leading-none`}>{result.skipped}</div>
                                    <div className={`${T.helperText} ${S.meta} text-[var(--text-muted)]/80 uppercase tracking-widest mt-2`}>Omitidos</div>
                                </div>
                                <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-[32px] transition-all hover:scale-[1.02]">
                                    <div className={`${T.kpiValue} ${S.displayMd} text-red-500 italic tracking-tighter leading-none`}>{result.errors?.length || 0}</div>
                                    <div className={`${T.helperText} ${S.meta} text-red-500/80 uppercase tracking-widest mt-2`}>Errores</div>
                                </div>
                            </div>

                            {/* Error Table */}
                            {result.errors && result.errors.length > 0 && (
                                <div className="bg-[var(--bg-input)] border border-[var(--border-default)] rounded-[32px] overflow-hidden">
                                    <div className="bg-red-500/10 px-8 py-4 border-b border-red-500/20 flex justify-between items-center">
                                        <span className={`${T.sectionTitle} ${S.meta} text-red-500 uppercase tracking-[0.2em]`}>Registro de Errores</span>
                                        <span className={`${T.badgeText} ${S.meta} bg-red-500 text-white px-2 py-1 rounded-lg`}>{result.errors.length}</span>
                                    </div>
                                    <div className="max-h-60 overflow-y-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className={`${T.tableHeader} ${S.meta} text-[var(--text-muted)] uppercase tracking-widest border-b border-[var(--border-default)]`}>
                                                    <th className="px-8 py-4">Fila</th>
                                                    <th className="px-8 py-4">Teléfono</th>
                                                    <th className="px-8 py-4">Descripción del Fallo</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-[var(--border-default)]">
                                                {result.errors.map((e: any, idx: number) => (
                                                    <tr key={idx} className="hover:bg-[var(--text-strong)]/[0.02] transition-colors">
                                                        <td className={`${T.tableCell} ${S.meta} px-8 py-4 text-[var(--brand-primary)] font-mono`}>#{e.row}</td>
                                                        <td className={`${T.tableCell} ${S.meta} px-8 py-4 text-[var(--text-strong)]`}>{e.phone || '--'}</td>
                                                        <td className={`${T.tableCell} ${S.meta} px-8 py-4 text-red-500`}>{e.reason}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {result.created + result.updated > 0 && (
                                <div className="flex items-center gap-4 p-6 bg-[var(--brand-primary)]/10 border border-[var(--brand-primary)]/20 rounded-[28px] animate-pulse">
                                    <div className="bg-[var(--brand-primary)]  p-2 rounded-full">
                                        <CheckCircle2 size={20} />
                                    </div>
                                    <p className={`${T.sectionTitle} ${S.body} text-[var(--brand-primary)] uppercase italic tracking-tight`}>Operación Finalizada con Éxito</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-10 py-8 bg-[var(--bg-card)] border-t border-[var(--border-default)] flex justify-end gap-5">
                    {!result ? (
                        <>
                            <button
                                onClick={onClose}
                                className={`${T.buttonText} ${S.meta} px-8 py-4 text-[var(--text-muted)] uppercase tracking-[0.2em] hover:text-[var(--text-strong)] transition-all`}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleImport}
                                disabled={!file || uploading}
                                className={`${T.buttonPrimaryText} ${S.meta} bg-[var(--brand-primary)] px-10 py-4 rounded-3xl uppercase hover:brightness-110 hover:shadow-[0_0_40px_-5px_var(--brand-primary)] transition-all active:scale-95 disabled:opacity-30 disabled:grayscale flex items-center gap-3`}
                            >
                                {uploading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-[var(--brand-primary-foreground)]/20 border-t-[var(--brand-primary-foreground)] rounded-full animate-spin"></div>
                                        Inyectando...
                                    </>
                                ) : (
                                    <>
                                        Ejecutar Importación
                                        <Database size={16} />
                                    </>
                                )}
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={() => { onSuccess(); onClose(); }}
                            className={`${T.buttonPrimaryText} ${S.meta} w-full bg-[var(--text-strong)] text-[var(--bg-card)] px-10 py-5 rounded-[24px] uppercase tracking-[0.3em] hover:bg-[var(--brand-primary)] hover: transition-all shadow-xl`}
                        >
                            Finalizar Transacción
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
