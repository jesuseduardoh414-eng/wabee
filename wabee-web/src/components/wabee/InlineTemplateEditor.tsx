import React, { useState, useRef, useEffect } from 'react';
import { Template } from '@/api/wabee/templates.api';
import { InputDescriptor, tokenizeTemplateText, TokenSegment, TemplateComponent, TemplateButton } from '@/utils/templateInputParser';
import { Image, Video, FileText, Link as LinkIcon, AlertCircle, X, Edit2, Download } from 'lucide-react';
import { resolveMediaPreviewUrl } from '@/modules/wabee/campaigns/templateMediaPreview';
import { T, S } from '@/lib/text-tokens';

interface InlineVarChipProps {
    id: string; // DOM id
    placeholderId?: string; // logical ID like 'body_var_1'
    index: number;
    value: string;
    required: boolean;
    onChange: (value: string) => void;
    autoFocus?: boolean;
}

const InlineVarChip: React.FC<InlineVarChipProps> = ({ id, placeholderId, index, value, required, onChange, autoFocus }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [localVal, setLocalVal] = useState(value);
    const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);
    const maxLength = 1024;

    useEffect(() => {
        setLocalVal(value);
    }, [value]);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            if (inputRef.current instanceof HTMLTextAreaElement) {
                inputRef.current.style.height = 'auto';
                inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
            }
        }
    }, [isEditing]);

    const handleSave = () => {
        onChange(localVal.trim());
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSave();
        } else if (e.key === 'Escape') {
            setLocalVal(value);
            setIsEditing(false);
        }
    };

    const isEmpty = !value || value.trim() === '';
    const isError = required && isEmpty;
    const isOverLength = localVal.length > maxLength;
    const isMultiline = localVal.length > 40 || localVal.includes('\n');

    if (isEditing) {
        return (
            <span className="inline-flex relative items-center mx-1 align-top relative group" data-placeholder-index={placeholderId}>
                {isMultiline ? (
                    <textarea
                        ref={inputRef as any}
                        value={localVal}
                        onChange={(e) => {
                            setLocalVal(e.target.value);
                            e.target.style.height = 'auto';
                            e.target.style.height = `${e.target.scrollHeight}px`;
                        }}
                        onBlur={handleSave}
                        onKeyDown={handleKeyDown}
                        className={`min-w-[120px] max-w-full bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] border ${isOverLength || isError ? 'border-red-500' : 'border-[var(--brand-primary)]/50'} rounded px-2 py-0.5 text-[11px] font-bold outline-none shadow-sm resize-none overflow-hidden ${T.buttonPrimaryText}`}
                        rows={1}
                    />
                ) : (
                    <input
                        ref={inputRef as any}
                        type="text"
                        value={localVal}
                        onChange={(e) => setLocalVal(e.target.value)}
                        onBlur={handleSave}
                        onKeyDown={handleKeyDown}
                        className={`min-w-[60px] bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] border ${isOverLength || isError ? 'border-red-500' : 'border-[var(--brand-primary)]/50'} rounded px-2 py-0.5 text-[11px] font-bold outline-none shadow-sm ${T.buttonPrimaryText}`}
                        style={{ width: `${Math.max(localVal.length + 2, 6)}ch` }}
                    />
                )}
                {isOverLength && (
                    <span className="absolute -bottom-4 left-0 text-[9px] text-red-500 font-bold whitespace-nowrap">Excede {maxLength} carácteres</span>
                )}
                <button
                    onMouseDown={(e) => { e.preventDefault(); setLocalVal(''); inputRef.current?.focus(); }}
                    className="absolute -right-2 -top-2 bg-[var(--bg-elevated)] text-[color:var(--tx-sectionTitle-color)] border border-[var(--border-default)] rounded-full p-0.5 hidden group-hover:block shadow-sm"
                >
                    <X size={10} />
                </button>
            </span>
        );
    }

    return (
        <span
            id={`chip-var-${id}`}
            data-placeholder-index={placeholderId}
            onClick={() => setIsEditing(true)}
            tabIndex={0}
            onFocus={() => setIsEditing(true)}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setIsEditing(true);
                }
            }}
            className={`inline-flex items-center mx-1 cursor-text px-2 py-0.5 rounded text-[11px] font-bold transition-colors align-bottom border select-none
            ${isError ? 'bg-red-500/10 text-red-500 border-red-500/30 hover:bg-red-500/20' : 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] border-[var(--brand-primary)]/30 hover:bg-[var(--brand-primary)]/20'} ${T.buttonPrimaryText}`}
            title={value ? value : 'Variable requerida'}
        >
            <span className="truncate max-w-[150px] inline-block">
                {isEmpty ? `{{${index}}}` : value}
            </span>
        </span>
    );
};

interface InlineTemplateEditorProps {
    template: Template;
    inputs: InputDescriptor[];
    values: Record<string, string>;
    onChange: (id: string, value: string) => void;
    focusedId?: string | null;
    templateInputMapping?: Record<string, any> | null;
    tenantId?: string;
    apiUrl?: string;
}

export function InlineTemplateEditor({ template, inputs, values, onChange, focusedId, templateInputMapping, tenantId, apiUrl }: InlineTemplateEditorProps) {
    useEffect(() => {
        if (focusedId) {
            // Find the first chip matching the placeholderId 
            const el = document.querySelector(`[data-placeholder-index="${focusedId}"]`) as HTMLElement;
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.focus(); // Triggers edit mode
            }
        }
    }, [focusedId]);

    const renderTextWithVars = (text: string, idPrefix: string) => {
        const segments = tokenizeTemplateText(text);
        return (
            <span className="leading-relaxed">
                {segments.map((seg, i) => {
                    if (seg.type === 'var' && seg.index !== undefined) {
                        const cid = `${idPrefix}${seg.index}`;
                        return (
                            <InlineVarChip
                                key={i}
                                id={`${cid}_${i}`} // unique DOM id
                                placeholderId={cid} // for querySelector
                                index={seg.index}
                                value={values[cid] || ''}
                                required={true}
                                onChange={(val) => onChange(cid, val)}
                            />
                        );
                    }
                    return <span key={i} className="whitespace-pre-wrap">{seg.text}</span>;
                })}
            </span>
        );
    };

    const header = template.components.find(c => c.type === 'HEADER');
    const body = template.components.find(c => c.type === 'BODY');
    const footer = template.components.find(c => c.type === 'FOOTER');
    const buttons = template.components.find(c => c.type === 'BUTTONS');

    const headerMediaInput = inputs.find(i => i.componentType === 'HEADER' && i.kind === 'MEDIA');

    const [headerMediaUrl, setHeaderMediaUrl] = useState<string | null>(null);
    const [headerMediaErr, setHeaderMediaErr] = useState<string | null>(null);
    const [headerMediaLoading, setHeaderMediaLoading] = useState(false);

    useEffect(() => {
        if (!headerMediaInput) return;

        // El input se llama inlineValues (values) pero en el Wizard el media se mapea en templateInputMapping.
        // O también podríamos extraerlo de values si ambos están ahí. 
        // El Wizard guarda el valor del media en `values[headerMediaInput.id]` mediante updateInlineValue.
        const v = values[headerMediaInput.id] || templateInputMapping?.[headerMediaInput.id]?.value || null;

        setHeaderMediaErr(null);
        if (!v || v === 'Subiendo...') {
            setHeaderMediaUrl(null);
            return;
        }

        setHeaderMediaLoading(true);
        resolveMediaPreviewUrl({
            value: v,
            apiUrl: apiUrl || import.meta.env.VITE_API_URL || '',

            tenantId: tenantId || ''
        })
            .then((url) => {
                if (!url) setHeaderMediaErr('No se pudo cargar el archivo');
                setHeaderMediaUrl(url);
            })
            .catch(() => setHeaderMediaErr('No se pudo cargar el archivo'))
            .finally(() => setHeaderMediaLoading(false));
    }, [template?.id, headerMediaInput?.id, values[headerMediaInput?.id || ''], templateInputMapping, apiUrl, tenantId]);

    return (
        <div className="bg-[#e4dfd5] rounded-xl w-full h-full max-w-[560px] shadow-sm relative overflow-y-auto custom-scrollbar">
            <div className="bg-white rounded-lg shadow-sm p-3 space-y-2 relative before:absolute before:content-[''] before:w-3 before:h-3 before:bg-white before:top-0 before:-left-1.5 before:[clip-path:polygon(100%_0,0_0,100%_100%)]">
                {/* HEADER */}
                {header && (
                    <div className="font-bold text-sm text-gray-800 mb-1">
                        {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(header.format || '') && (
                            <div className="w-full rounded-xl overflow-hidden border border-yellow-500/20 mb-2">
                                {headerMediaLoading ? (
                                    <div className="w-full h-[180px] bg-gray-200 animate-pulse flex items-center justify-center">
                                        <div className="w-8 h-8 rounded-full bg-gray-300" />
                                    </div>
                                ) : headerMediaErr ? (
                                    <div className="flex flex-col items-center justify-center gap-2 bg-red-50 p-6 text-xs text-red-500">
                                        <AlertCircle size={20} />
                                        <span>{headerMediaErr}</span>
                                    </div>
                                ) : headerMediaUrl ? (
                                    <>
                                        {header.format === 'IMAGE' && (
                                            <img src={headerMediaUrl} alt="Header Media" className="w-full max-h-[420px] object-contain" />
                                        )}
                                        {header.format === 'VIDEO' && (
                                            <video src={headerMediaUrl} controls className="w-full max-h-[420px] object-contain bg-black" />
                                        )}
                                        {header.format === 'DOCUMENT' && (
                                            <div className="flex items-center justify-between bg-gray-50 p-3 border-t border-gray-200">
                                                <div className="flex items-center gap-2">
                                                    <div className="p-2 bg-white rounded-lg shadow-sm">
                                                        <FileText size={20} className="text-gray-500" />
                                                    </div>
                                                    <span className="text-xs font-semibold text-gray-700 truncate max-w-[150px]">Documento</span>
                                                </div>
                                                <a href={headerMediaUrl} target="_blank" rel="noreferrer" className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-100 text-[#00a884] transition-colors">
                                                    <Download size={14} />
                                                </a>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="flex items-center gap-2 bg-gray-100 p-3 text-xs text-gray-500 border border-gray-200 border-dashed m-1 rounded">
                                        {header.format === 'IMAGE' && <Image size={14} />}
                                        {header.format === 'VIDEO' && <Video size={14} />}
                                        {header.format === 'DOCUMENT' && <FileText size={14} />}
                                        Encabezado Multimedia (Configurar en el panel lateral)
                                    </div>
                                )}
                            </div>
                        )}
                        {header.format === 'TEXT' && header.text && renderTextWithVars(header.text, 'header_var_')}
                    </div>
                )}

                {/* BODY */}
                <div className="text-[13px] text-gray-800 break-words">
                    {body?.text ? renderTextWithVars(body.text, 'body_var_') : <span className="italic text-gray-400">Sin cuerpo de mensaje</span>}
                </div>

                {/* FOOTER */}
                {footer?.text && (
                    <div className="text-[11px] text-gray-500 uppercase mt-2">
                        {footer.text}
                    </div>
                )}
            </div>

            {/* BUTTONS */}
            {buttons && buttons.buttons && buttons.buttons.length > 0 && (
                <div className="mt-2 space-y-1">
                    {buttons.buttons.map((btn: TemplateButton, idx: number) => (
                        <div key={idx} className="bg-white rounded-lg shadow-sm p-2 text-center text-[#00a884] text-xs font-medium cursor-default">
                            {btn.type === 'URL' && btn.url?.includes('{{') ? (
                                <div className="flex items-center justify-center gap-1 flex-wrap">
                                    <LinkIcon size={12} className="text-gray-400" />
                                    <span>{btn.text}</span>
                                    <span className="text-gray-400 mx-1">→</span>
                                    <span className="text-gray-600 block line-clamp-1 truncate max-w-[200px]" title={btn.url}>
                                        {renderTextWithVars(btn.url, `button_url_${idx}_var_`)}
                                    </span>
                                </div>
                            ) : (
                                <span>{btn.text}</span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
