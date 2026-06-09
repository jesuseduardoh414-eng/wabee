import { useState, useEffect, useRef } from 'react';
import { Message, markThreadRead } from '@/api/wabee/inbox.api';
import { Send, Paperclip, StickyNote, UserRound, Hand, MoreHorizontal, ArrowLeft } from 'lucide-react';
import { WhatsAppMessageBubble } from './inbox/WhatsAppMessageBubble';
import { useStickyAutoScroll } from './inbox/useStickyAutoScroll';
import { T, S } from '@/lib/text-tokens';
import { useToast } from '@/context/ToastContext';
import ThreadHandlingModeBadge from './ThreadHandlingModeBadge';

const MAX_ATTACHMENT_SIZE_BYTES = 25 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = new Set([
    'image/png',
    'image/jpeg',
    'image/webp',
    'video/mp4',
    'application/pdf',
]);

interface Props {
    messages: Message[];
    contactName: string;
    contactPhone?: string;
    avatarUrl?: string | null;
    onSendMessage: (text: string) => Promise<void>;
    onSendAttachment?: (file: File, caption?: string) => Promise<void>;
    onBack?: () => void;
    threadId?: string;
    isNotesOpen?: boolean;
    onToggleNotes?: () => void;
    canReply?: boolean;
    onOpenContact?: () => void;
    threadStatus?: string;
    handlingMode?: 'ai' | 'human_queue' | 'human' | 'copilot' | 'paused' | null;
    aiPaused?: boolean;
    assignmentBadge?: string | null;
    assignmentControl?: React.ReactNode;
    onTakeThread?: () => void;
    onUnassignThread?: () => void;
}

function formatPhone(phone?: string) {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('52')) {
        return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 8)} ${digits.slice(8)}`;
    }
    if (digits.length === 10) {
        return `+52 ${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6)}`;
    }
    return phone;
}

function formatDayLabel(timestamp?: string) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '';

    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    if (date.toDateString() === now.toDateString()) return 'Hoy';
    if (date.toDateString() === yesterday.toDateString()) return 'Ayer';
    return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

function getErrorMessage(error: any) {
    if (error?.message === 'Network Error') {
        return 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.';
    }

    return (
        error?.response?.data?.message ||
        error?.response?.data?.error?.message ||
        error?.message ||
        'No se pudo adjuntar el archivo'
    );
}

function validateAttachment(file: File) {
    if (!ALLOWED_ATTACHMENT_TYPES.has(file.type)) {
        return 'Formato no permitido. Usa JPG, PNG, WEBP, MP4 o PDF.';
    }

    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
        return 'El archivo supera el l\u00edmite de 25 MB.';
    }

    return null;
}

export default function ChatPanel({
    messages,
    contactName,
    contactPhone,
    avatarUrl,
    onSendMessage,
    onSendAttachment,
    onBack,
    threadId,
    isNotesOpen,
    onToggleNotes,
    canReply = true,
    onOpenContact,
    threadStatus,
    handlingMode,
    aiPaused,
    assignmentControl,
    onTakeThread,
    onUnassignThread,
}: Props) {
    const [inputText, setInputText] = useState('');
    const [sending, setSending] = useState(false);
    const [uploadingFile, setUploadingFile] = useState(false);
    const [showMobileActions, setShowMobileActions] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { showToast } = useToast();

    const { isNearBottomRef, handleScroll, markShouldScroll, scrollToBottom } = useStickyAutoScroll(
        scrollContainerRef,
        [messages.length],
        threadId
    );

    useEffect(() => {
        if (threadId) {
            markThreadRead(threadId).catch((err) => console.error('Could not mark thread read', err));
        }
    }, [threadId, messages.length]);

    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }, [inputText]);

    const handleSubmit = async (event?: React.FormEvent) => {
        event?.preventDefault();
        if (!inputText.trim() || sending || uploadingFile) return;

        setSending(true);
        markShouldScroll();
        try {
            await onSendMessage(inputText);
            setInputText('');
            if (textareaRef.current) textareaRef.current.style.height = 'auto';
        } catch (error) {
            console.error('Error sending message:', error);
        } finally {
            setSending(false);
        }
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSubmit();
        }
    };

    const handlePaperclipClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';

        if (!file) return;

        const validationError = validateAttachment(file);
        if (validationError) {
            showToast(validationError, 'error');
            return;
        }

        if (!onSendAttachment) {
            showToast('No se pudo adjuntar el archivo en esta vista', 'error');
            return;
        }

        setUploadingFile(true);
        setShowMobileActions(false);
        markShouldScroll();

        try {
            await onSendAttachment(file, inputText.trim() || undefined);
            setInputText('');
            if (textareaRef.current) textareaRef.current.style.height = 'auto';
            showToast('Archivo adjuntado correctamente', 'success');
        } catch (error) {
            console.error('Error attaching file:', error);
            showToast(getErrorMessage(error), 'error');
        } finally {
            setUploadingFile(false);
        }
    };

    const phoneLabel = formatPhone(contactPhone);
    const isMobileThreadView = Boolean(onBack);

    return (
        <div className="flex h-full flex-col overflow-hidden bg-[#f7f4eb]" data-thread-status={threadStatus ?? undefined}>
            <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,video/mp4,application/pdf"
                className="hidden"
                onChange={handleFileChange}
            />

            <div className="min-h-[80px] shrink-0 border-b border-[rgba(26,26,26,0.08)] bg-[rgba(255,255,255,0.78)] px-4 py-3 backdrop-blur-xl md:px-4 md:py-3 lg:px-5 lg:py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-4">
                    <div className="flex min-w-0 w-full flex-1 items-center gap-3 md:items-start md:gap-4">
                        {onBack && (
                            <button
                                type="button"
                                onClick={onBack}
                                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[rgba(26,26,26,0.08)] bg-white text-[var(--brand-primary)] transition hover:bg-[rgba(26,26,26,0.03)]"
                                title="Volver"
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </button>
                        )}
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[rgba(255,140,0,0.2)] bg-[rgba(255,245,236,0.95)] text-[#ff8c00] md:h-12 md:w-12">
                            {avatarUrl ? (
                                <img
                                    src={avatarUrl}
                                    alt={contactName}
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <UserRound className="h-5 w-5 md:h-6 md:w-6" />
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-center gap-2">
                                <h3 className="truncate text-[17px] font-bold leading-tight text-[#0f172a] md:text-[20px]">
                                    {contactName}
                                </h3>
                                <div className="shrink-0">
                                    <ThreadHandlingModeBadge mode={handlingMode ?? null} aiPaused={aiPaused} />
                                </div>
                            </div>
                            <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[rgba(15,23,42,0.62)] md:mt-1 md:gap-x-3 md:text-[14px]">
                                {phoneLabel && <span className="truncate">{phoneLabel}</span>}
                                <span className="inline-flex shrink-0 items-center gap-1.5 text-[#1ea35b]">
                                    <span className="h-2 w-2 rounded-full bg-[#1ea35b]" />
                                    En línea
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className={`flex w-full items-center gap-2 overflow-x-auto pb-1 no-scrollbar lg:w-auto lg:flex-wrap lg:justify-end lg:gap-3 lg:overflow-visible lg:pb-0 ${isMobileThreadView ? 'hidden' : ''}`}>
                        {onTakeThread && !onUnassignThread && (
                            <button
                                onClick={onTakeThread}
                                className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-[#ff8c00] px-4 text-[13px] font-bold text-white shadow-[0_10px_22px_rgba(255,140,0,0.2)] transition hover:brightness-105 lg:h-11 lg:px-5 lg:text-[14px]"
                                title="Tomar chat"
                            >
                                <Hand className="h-4 w-4" />
                                Tomar chat
                            </button>
                        )}
                        {onUnassignThread && (
                            <button
                                onClick={onUnassignThread}
                                className="inline-flex h-10 shrink-0 items-center rounded-xl border border-[rgba(255,140,0,0.22)] bg-white px-4 text-[13px] font-semibold text-[#ff8c00] transition hover:bg-[rgba(255,140,0,0.04)] lg:h-11 lg:text-[14px]"
                                title="Liberar chat"
                            >
                                Liberar
                            </button>
                        )}
                        {assignmentControl}
                        {onOpenContact && (
                            <button
                                onClick={onOpenContact}
                                className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-[rgba(26,26,26,0.12)] bg-white px-4 text-[13px] font-semibold text-[#3b3b3b] transition hover:bg-[rgba(26,26,26,0.03)] lg:h-11 lg:px-5 lg:text-[14px]"
                                title="Ver ficha del contacto"
                            >
                                <UserRound className="h-4 w-4" />
                                Contacto
                            </button>
                        )}
                        {onToggleNotes && (
                            <button
                                onClick={onToggleNotes}
                                className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border px-4 text-[13px] font-semibold transition lg:h-11 lg:px-5 lg:text-[14px] ${
                                    isNotesOpen
                                        ? 'border-[rgba(255,140,0,0.22)] bg-[rgba(255,140,0,0.05)] text-[#ff8c00]'
                                        : 'border-[rgba(26,26,26,0.12)] bg-white text-[#3b3b3b] hover:bg-[rgba(26,26,26,0.03)]'
                                }`}
                                title="Notas internas"
                            >
                                <StickyNote className="h-4 w-4" />
                                Notas
                            </button>
                        )}
                        <button
                            type="button"
                            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[rgba(26,26,26,0.45)] transition hover:bg-white lg:h-11 lg:w-11"
                            title="Más acciones"
                        >
                            <MoreHorizontal className="h-5 w-5" />
                        </button>
                    </div>

                    {isMobileThreadView && (
                        <div className="shrink-0">
                            <button
                                type="button"
                                onClick={() => setShowMobileActions((prev) => !prev)}
                                className={`inline-flex h-10 w-10 items-center justify-center rounded-full border bg-white text-[rgba(26,26,26,0.55)] transition hover:bg-[rgba(26,26,26,0.03)] ${
                                    showMobileActions
                                        ? 'border-[rgba(255,140,0,0.18)] shadow-[0_8px_20px_rgba(255,140,0,0.12)]'
                                        : 'border-[rgba(26,26,26,0.08)]'
                                }`}
                                title="Más acciones"
                            >
                                <MoreHorizontal className="h-5 w-5" />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {isMobileThreadView && showMobileActions && (
                <div className="fixed inset-0 z-[120] md:hidden">
                    <button
                        type="button"
                        aria-label="Cerrar acciones"
                        onClick={() => setShowMobileActions(false)}
                        className="absolute inset-0 bg-[rgba(15,23,42,0.18)] backdrop-blur-[2px]"
                    />
                    <div className="absolute right-4 top-[88px] flex w-[min(260px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[22px] border border-[rgba(26,26,26,0.08)] bg-[rgba(255,255,255,0.98)] p-2 shadow-[0_26px_60px_rgba(26,26,26,0.22)] backdrop-blur-xl">
                        <div className="px-3 pb-2 pt-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[rgba(15,23,42,0.38)]">
                            Acciones
                        </div>
                        {onTakeThread && !onUnassignThread && (
                            <button
                                type="button"
                                onClick={() => {
                                    setShowMobileActions(false);
                                    onTakeThread();
                                }}
                                className="flex items-center gap-3 rounded-2xl px-3 py-3 text-left text-[14px] font-semibold text-[#3b3b3b] transition hover:bg-[rgba(255,140,0,0.06)]"
                            >
                                <Hand className="h-4 w-4 text-[#ff8c00]" />
                                Tomar chat
                            </button>
                        )}
                        {onUnassignThread && (
                            <button
                                type="button"
                                onClick={() => {
                                    setShowMobileActions(false);
                                    onUnassignThread();
                                }}
                                className="flex items-center gap-3 rounded-2xl px-3 py-3 text-left text-[14px] font-semibold text-[#3b3b3b] transition hover:bg-[rgba(255,140,0,0.06)]"
                            >
                                <Hand className="h-4 w-4 text-[#ff8c00]" />
                                Liberar chat
                            </button>
                        )}
                        {onOpenContact && (
                            <button
                                type="button"
                                onClick={() => {
                                    setShowMobileActions(false);
                                    onOpenContact();
                                }}
                                className="flex items-center gap-3 rounded-2xl px-3 py-3 text-left text-[14px] font-semibold text-[#3b3b3b] transition hover:bg-[rgba(26,26,26,0.03)]"
                            >
                                <UserRound className="h-4 w-4" />
                                Ver contacto
                            </button>
                        )}
                        {onToggleNotes && (
                            <button
                                type="button"
                                onClick={() => {
                                    setShowMobileActions(false);
                                    onToggleNotes();
                                }}
                                className="flex items-center gap-3 rounded-2xl px-3 py-3 text-left text-[14px] font-semibold text-[#3b3b3b] transition hover:bg-[rgba(26,26,26,0.03)]"
                            >
                                <StickyNote className="h-4 w-4" />
                                {isNotesOpen ? 'Ocultar notas' : 'Ver notas'}
                            </button>
                        )}
                        {assignmentControl && (
                            <div className="mt-2 border-t border-[rgba(26,26,26,0.08)] px-1 pt-2">
                                {assignmentControl}
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className={`relative flex-1 overflow-y-auto custom-scrollbar ${isMobileThreadView ? 'px-4 py-4' : 'px-7 py-7'}`}
            >
                {messages.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center text-center text-[rgba(26,26,26,0.4)]">
                        <span className={`${T.helperText} ${S.meta} rounded-full border border-[rgba(26,26,26,0.08)] bg-white px-4 py-2 uppercase`}>
                            Inicio de la conversación
                        </span>
                    </div>
                ) : (
                    <div className="relative z-10 flex min-h-full flex-col justify-end gap-1">
                        {messages.map((message, index) => {
                            const currentLabel = formatDayLabel(message.timestamp);
                            const previousLabel =
                                index > 0 ? formatDayLabel(messages[index - 1].timestamp) : null;
                            const shouldShowLabel = index === 0 || currentLabel !== previousLabel;

                            return (
                                <div key={message.id}>
                                    {shouldShowLabel && currentLabel && (
                                        <div className="mb-5 mt-1 flex justify-center">
                                            <span className="rounded-full border border-[rgba(26,26,26,0.08)] bg-white px-4 py-1.5 text-[13px] font-medium text-[rgba(15,23,42,0.6)] shadow-sm">
                                                {currentLabel}
                                            </span>
                                        </div>
                                    )}
                                    <WhatsAppMessageBubble
                                        message={message}
                                        onMediaLoad={() => {
                                            if (isNearBottomRef.current) {
                                                scrollToBottom('auto');
                                            }
                                        }}
                                    />
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {canReply ? (
                <div className="shrink-0 border-t border-[rgba(26,26,26,0.08)] bg-[rgba(255,255,255,0.84)] px-2.5 py-2.5 backdrop-blur-xl md:px-6 md:py-4">
                    <div className="flex items-center gap-2 rounded-[22px] border border-[rgba(26,26,26,0.08)] bg-white/90 px-2 py-2 shadow-[0_8px_20px_rgba(15,23,42,0.06)] md:items-end md:gap-3 md:rounded-[24px] md:px-3">
                        <button
                            type="button"
                            onClick={handlePaperclipClick}
                            title="Adjuntar archivo"
                            disabled={uploadingFile}
                            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-[rgba(26,26,26,0.08)] bg-white text-[rgba(26,26,26,0.56)] transition hover:bg-[rgba(255,140,0,0.04)] disabled:cursor-not-allowed disabled:opacity-50 md:h-12 md:w-12"
                        >
                            <Paperclip className="h-5 w-5" />
                        </button>

                        <form onSubmit={handleSubmit} className="flex flex-1 items-center gap-2 md:items-end md:gap-3">
                            <div className="relative flex-1">
                                <textarea
                                    ref={textareaRef}
                                    rows={1}
                                    value={inputText}
                                    onChange={(event) => setInputText(event.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Escribe un mensaje o agrega un comentario al adjunto..."
                                    disabled={sending || uploadingFile}
                                    className={`${T.inputText} ${S.body} min-h-[52px] w-full resize-none overflow-y-auto rounded-[18px] border border-[rgba(26,26,26,0.08)] bg-[rgba(255,255,255,0.96)] px-4 py-3 text-[14px] leading-relaxed text-[#0f172a] outline-none transition placeholder:text-[rgba(15,23,42,0.45)] focus:border-[rgba(255,140,0,0.22)] focus:ring-2 focus:ring-[rgba(255,140,0,0.08)] custom-scrollbar md:min-h-[56px] md:rounded-[20px] md:px-5 md:py-4 md:text-[15px]`}
                                    style={{ maxHeight: '110px' }}
                                />
                                {(sending || uploadingFile) && (
                                    <div className="absolute right-4 top-3.5 md:top-4">
                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-t-[#ff8c00] border-transparent" />
                                    </div>
                                )}
                            </div>
                            <button
                                type="submit"
                                disabled={!inputText.trim() || sending || uploadingFile}
                                className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition md:h-12 md:w-12 ${
                                    !inputText.trim() || sending || uploadingFile
                                        ? 'border border-[rgba(26,26,26,0.08)] bg-white text-[rgba(26,26,26,0.32)]'
                                        : 'bg-[#ff8c00] text-white shadow-[0_10px_20px_rgba(255,140,0,0.18)] hover:brightness-105'
                                }`}
                            >
                                <Send className="h-5 w-5" />
                            </button>
                        </form>
                    </div>
                </div>
            ) : (
                <div className="shrink-0 border-t border-[rgba(26,26,26,0.08)] bg-[rgba(255,255,255,0.78)] px-6 py-5 backdrop-blur-xl">
                    <div className="flex h-[56px] items-center justify-center rounded-[18px] border border-dashed border-[rgba(228,197,142,0.85)] bg-[rgba(255,255,255,0.62)] text-[14px] text-[rgba(15,23,42,0.55)]">
                        <Hand className="mr-3 h-4 w-4 text-[rgba(15,23,42,0.4)]" />
                        Toma el chat para poder responder
                    </div>
                </div>
            )}
        </div>
    );
}
