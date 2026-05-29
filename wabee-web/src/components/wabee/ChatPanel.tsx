import { useState, useEffect, useRef } from 'react';
import { Message, markThreadRead } from '@/api/wabee/inbox.api';
import EmojiPicker, { Theme, EmojiClickData } from 'emoji-picker-react';
import { Send, Smile, Paperclip, StickyNote, UserRound, Hand, MoreHorizontal } from 'lucide-react';
import { WhatsAppMessageBubble } from './inbox/WhatsAppMessageBubble';
import { useStickyAutoScroll } from './inbox/useStickyAutoScroll';
import { T, S } from '@/lib/text-tokens';
import { useToast } from '@/context/ToastContext';
import ThreadHandlingModeBadge from './ThreadHandlingModeBadge';

interface Props {
    messages: Message[];
    contactName: string;
    contactPhone?: string;
    onSendMessage: (text: string) => Promise<void>;
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

function getContactInitials(contactName: string) {
    const parts = contactName.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
        return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
    }
    return contactName.slice(0, 2).toUpperCase() || 'WB';
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

export default function ChatPanel({
    messages,
    contactName,
    contactPhone,
    onSendMessage,
    onBack: _onBack,
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
    void _onBack;
    const [inputText, setInputText] = useState('');
    const [sending, setSending] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const emojiPickerRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
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

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
                setShowEmojiPicker(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSubmit = async (event?: React.FormEvent) => {
        event?.preventDefault();
        if (!inputText.trim() || sending) return;

        setSending(true);
        setShowEmojiPicker(false);
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

    const handleEmojiClick = (emojiData: EmojiClickData) => {
        setInputText((prev) => prev + emojiData.emoji);
    };

    const handlePaperclipClick = () => {
        showToast('Adjuntar archivos estará disponible próximamente', 'info');
    };

    const phoneLabel = formatPhone(contactPhone);
    const initials = getContactInitials(contactName);

    return (
        <div className="flex h-full flex-col overflow-hidden bg-[#f7f4eb]" data-thread-status={threadStatus ?? undefined}>
            <div className="min-h-[80px] shrink-0 border-b border-[rgba(26,26,26,0.08)] bg-[rgba(255,255,255,0.78)] px-4 py-4 backdrop-blur-xl md:px-5">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[rgba(255,140,0,0.2)] bg-[rgba(255,245,236,0.95)] text-[20px] font-semibold text-[#ff8c00]">
                            {initials}
                        </div>
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h3 className="truncate text-[18px] font-bold leading-tight text-[#0f172a] md:text-[20px]">
                                    {contactName}
                                </h3>
                                <ThreadHandlingModeBadge mode={handlingMode ?? null} aiPaused={aiPaused} />
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-[rgba(15,23,42,0.62)]">
                                {phoneLabel && <span>{phoneLabel}</span>}
                                <span className="inline-flex items-center gap-1.5 text-[#1ea35b]">
                                    <span className="h-2 w-2 rounded-full bg-[#1ea35b]" />
                                    En línea
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-3">
                        {onTakeThread && !onUnassignThread && (
                            <button
                                onClick={onTakeThread}
                                className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#ff8c00] px-5 text-[14px] font-bold text-white shadow-[0_10px_22px_rgba(255,140,0,0.2)] transition hover:brightness-105"
                                title="Tomar chat"
                            >
                                <Hand className="h-4 w-4" />
                                Tomar chat
                            </button>
                        )}
                        {onUnassignThread && (
                            <button
                                onClick={onUnassignThread}
                                className="inline-flex h-11 items-center rounded-xl border border-[rgba(255,140,0,0.22)] bg-white px-4 text-[14px] font-semibold text-[#ff8c00] transition hover:bg-[rgba(255,140,0,0.04)]"
                                title="Liberar chat"
                            >
                                Liberar
                            </button>
                        )}
                        {assignmentControl}
                        {onOpenContact && (
                            <button
                                onClick={onOpenContact}
                                className="inline-flex h-11 items-center gap-2 rounded-xl border border-[rgba(26,26,26,0.12)] bg-white px-5 text-[14px] font-semibold text-[#3b3b3b] transition hover:bg-[rgba(26,26,26,0.03)]"
                                title="Ver ficha del contacto"
                            >
                                <UserRound className="h-4 w-4" />
                                Contacto
                            </button>
                        )}
                        {onToggleNotes && (
                            <button
                                onClick={onToggleNotes}
                                className={`inline-flex h-11 items-center gap-2 rounded-xl border px-5 text-[14px] font-semibold transition ${
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
                            className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-[rgba(26,26,26,0.45)] transition hover:bg-white"
                            title="Más acciones"
                        >
                            <MoreHorizontal className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </div>

            <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="relative flex-1 overflow-y-auto px-7 py-7 custom-scrollbar"
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
                <div className="shrink-0 border-t border-[rgba(26,26,26,0.08)] bg-[rgba(255,255,255,0.78)] px-4 py-4 backdrop-blur-xl md:px-6">
                    <div className="flex items-end gap-3">
                        <div className="relative flex-shrink-0" ref={emojiPickerRef}>
                            {showEmojiPicker && (
                                <div className="absolute bottom-16 left-0 z-50 overflow-hidden rounded-2xl shadow-2xl">
                                    <EmojiPicker theme={Theme.DARK} onEmojiClick={handleEmojiClick} width={320} height={450} />
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                className={`flex h-12 w-12 items-center justify-center rounded-full border transition ${
                                    showEmojiPicker
                                        ? 'border-[rgba(255,140,0,0.18)] bg-[rgba(255,140,0,0.08)] text-[#ff8c00]'
                                        : 'border-[rgba(26,26,26,0.08)] bg-white text-[rgba(26,26,26,0.56)] hover:border-[rgba(255,140,0,0.2)]'
                                }`}
                            >
                                <Smile className="h-5 w-5" />
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={handlePaperclipClick}
                            title="Adjuntar archivo (próximamente)"
                            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border border-[rgba(26,26,26,0.08)] bg-white text-[rgba(26,26,26,0.56)] transition hover:bg-[rgba(255,140,0,0.04)]"
                        >
                            <Paperclip className="h-5 w-5" />
                        </button>

                        <form onSubmit={handleSubmit} className="flex flex-1 items-end gap-3">
                            <div className="relative flex-1">
                                <textarea
                                    ref={textareaRef}
                                    rows={1}
                                    value={inputText}
                                    onChange={(event) => setInputText(event.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Escribe un mensaje..."
                                    disabled={sending}
                                    className={`${T.inputText} ${S.body} w-full resize-none overflow-y-auto rounded-[20px] border border-[rgba(26,26,26,0.08)] bg-[rgba(255,255,255,0.92)] px-5 py-4 leading-relaxed text-[#0f172a] outline-none transition placeholder:text-[rgba(15,23,42,0.45)] focus:border-[rgba(255,140,0,0.22)] focus:ring-2 focus:ring-[rgba(255,140,0,0.08)] custom-scrollbar`}
                                    style={{ maxHeight: '120px' }}
                                />
                                {sending && (
                                    <div className="absolute right-4 top-4">
                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-t-[#ff8c00] border-transparent" />
                                    </div>
                                )}
                            </div>
                            <button
                                type="submit"
                                disabled={!inputText.trim() || sending}
                                className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full transition ${
                                    !inputText.trim() || sending
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
