import { useState, useEffect, useRef } from 'react';
import { Message, markThreadRead } from '@/api/wabee/inbox.api';
import EmojiPicker, { Theme, EmojiClickData } from 'emoji-picker-react';
import { Send, Smile, Paperclip, StickyNote, UserRound } from 'lucide-react';
import { WhatsAppMessageBubble } from './inbox/WhatsAppMessageBubble';
import { useStickyAutoScroll } from './inbox/useStickyAutoScroll';
import { T, S } from '@/lib/text-tokens';
import { useToast } from '@/context/ToastContext';

interface Props {
    messages: Message[];
    contactName: string;
    onSendMessage: (text: string) => Promise<void>;
    onBack?: () => void;
    threadId?: string;
    isNotesOpen?: boolean;
    onToggleNotes?: () => void;
    canReply?: boolean;
    onOpenContact?: () => void;
}

export default function ChatPanel({
    messages,
    contactName,
    onSendMessage,
    onBack: _onBack,
    threadId,
    isNotesOpen,
    onToggleNotes,
    canReply = true,
    onOpenContact,
}: Props) {
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

    return (
        <div className="flex flex-col h-full bg-[linear-gradient(180deg,#fffdf8_0%,#f8f4ea_100%)] relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(243,223,155,0.12)_0,transparent_36%),radial-gradient(circle_at_bottom_right,rgba(243,223,155,0.1)_0,transparent_34%)] pointer-events-none" />

            <div className="min-h-[78px] bg-[rgba(255,251,244,0.94)] backdrop-blur-xl px-6 flex justify-between items-center border-b border-[rgba(197,176,136,0.18)] z-10 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-[linear-gradient(135deg,#f7dfa5_0%,#ebb960_100%)] flex items-center justify-center overflow-hidden shadow-[0_10px_20px_rgba(216,181,96,0.22)]">
                        <svg className="w-6 h-6 text-[#6f5310]" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                        </svg>
                    </div>
                    <div className="flex flex-col justify-center">
                        <h3 className={`${T.cardTitle} ${S.headingMd} leading-tight tracking-tight`}>{contactName}</h3>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                            <p className={`${T.helperText} ${S.meta}`}>En linea</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 text-[var(--text-muted)]" style={{ color: 'var(--tx-buttonText-color)' }}>
                    {onOpenContact && (
                        <button
                            onClick={onOpenContact}
                            title="Ver ficha del contacto"
                            className="p-2.5 rounded-full border bg-[rgba(255,255,255,0.88)] border-[rgba(197,176,136,0.22)] hover:border-[rgba(226,181,78,0.42)] hover:bg-[rgba(255,248,234,0.95)] transition-all active:scale-95 flex items-center gap-1.5 px-3.5"
                            style={{ color: 'var(--tx-buttonText-color)' }}
                        >
                            <UserRound className="w-4 h-4" />
                            <span className={`${S.meta} uppercase font-black tracking-widest hidden lg:inline`}>Contacto</span>
                        </button>
                    )}
                    {onToggleNotes && (
                        <button
                            onClick={onToggleNotes}
                            className={`p-2.5 rounded-full transition-all border active:scale-95 flex items-center gap-1.5 px-3.5 ${
                                isNotesOpen
                                    ? 'bg-[linear-gradient(135deg,#f3df9b_0%,#efcb74_100%)] text-[#6f5310] border-[rgba(226,181,78,0.42)] shadow-[0_8px_16px_rgba(214,177,88,0.18)]'
                                    : 'bg-[rgba(255,249,234,0.9)] text-[var(--brand-primary)] border-[rgba(226,181,78,0.18)] hover:bg-[rgba(255,244,217,0.95)]'
                            }`}
                            title="Notas internas"
                        >
                            <StickyNote className="w-4 h-4" />
                            <span className={`${S.meta} uppercase font-black tracking-widest hidden lg:inline`}>Notas</span>
                        </button>
                    )}
                </div>
            </div>

            <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto px-6 py-6 space-y-2 z-10 custom-scrollbar relative"
            >
                <div className="absolute inset-0 opacity-[0.04] pointer-events-none select-none bg-wa-pattern bg-repeat" />

                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full opacity-30 grayscale relative z-10">
                        <div className="w-20 h-20 rounded-full border border-[var(--text-muted)]/30 flex items-center justify-center mb-4">
                            <svg className="w-10 h-10" style={{ color: 'var(--tx-helperText-color)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                        </div>
                        <span className={`${T.helperText} ${S.meta} uppercase`}>Inicio de la conversacion</span>
                    </div>
                ) : (
                    <div className="relative z-10 flex flex-col justify-end min-h-full">
                        {messages.map((message) => (
                            <WhatsAppMessageBubble
                                key={message.id}
                                message={message}
                                onMediaLoad={() => {
                                    if (isNearBottomRef.current) {
                                        scrollToBottom('auto');
                                    }
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>

            <div className="bg-[rgba(255,251,244,0.94)] backdrop-blur-xl px-4 py-4 md:px-6 flex items-end gap-3 border-t border-[rgba(197,176,136,0.18)] z-20">
                <div className="relative flex-shrink-0" ref={emojiPickerRef}>
                    {showEmojiPicker && (
                        <div className="absolute bottom-16 left-0 shadow-2xl rounded-2xl overflow-hidden animate-scale-in z-50">
                            <EmojiPicker theme={Theme.DARK} onEmojiClick={handleEmojiClick} width={320} height={450} />
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className={`p-3 rounded-full border transition-all active:scale-95 ${
                            showEmojiPicker
                                ? 'bg-[linear-gradient(135deg,#f3df9b_0%,#efcb74_100%)] border-[rgba(226,181,78,0.42)]'
                                : 'bg-[rgba(255,255,255,0.88)] border-[rgba(197,176,136,0.22)] hover:border-[rgba(226,181,78,0.42)]'
                        }`}
                        style={{ color: showEmojiPicker ? '#6f5310' : 'var(--tx-buttonText-color)' }}
                    >
                        <Smile className="w-5 h-5" />
                    </button>
                </div>

                <button
                    type="button"
                    onClick={handlePaperclipClick}
                    title="Adjuntar archivo (próximamente)"
                    className="flex-shrink-0 p-3 bg-[rgba(255,255,255,0.88)] rounded-full border border-[rgba(197,176,136,0.22)] hover:bg-[rgba(255,248,234,0.95)] transition-all active:scale-95"
                    style={{ color: 'var(--tx-buttonText-color)' }}
                >
                    <Paperclip className="w-5 h-5" />
                </button>

                <form onSubmit={handleSubmit} className="flex-1 flex gap-3 items-end">
                    <div className="flex-1 relative group">
                        <textarea
                            ref={textareaRef}
                            rows={1}
                            value={inputText}
                            onChange={(event) => setInputText(event.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={canReply ? 'Escribe un mensaje...' : 'Toma el chat para poder responder'}
                            disabled={sending || !canReply}
                            className={`${T.inputText} ${S.body} w-full px-5 py-4 bg-[rgba(255,255,255,0.92)] border border-[rgba(197,176,136,0.22)] rounded-[28px] focus:ring-2 focus:ring-[rgba(226,181,78,0.18)] focus:border-[rgba(226,181,78,0.42)] outline-none transition-all placeholder:text-[var(--text-muted)] resize-none overflow-y-auto custom-scrollbar leading-relaxed ${
                                !canReply ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                            style={{ maxHeight: '120px' }}
                        />
                        {sending && (
                            <div className="absolute right-4 top-4">
                                <div className="animate-spin h-4 w-4 border-2 border-t-[var(--brand-primary)] border-transparent rounded-full" />
                            </div>
                        )}
                    </div>
                    <button
                        type="submit"
                        disabled={!inputText.trim() || sending || !canReply}
                        className={`flex-shrink-0 p-4 rounded-full transition-all shadow-xl active:scale-95 flex items-center justify-center ${
                            !inputText.trim() || sending || !canReply
                                ? 'bg-[rgba(255,255,255,0.88)] border border-[rgba(197,176,136,0.22)]'
                                : 'bg-[linear-gradient(135deg,#f3df9b_0%,#efcb74_100%)] shadow-[0_10px_20px_rgba(214,177,88,0.2)] hover:brightness-105'
                        }`}
                        style={{
                            color: !inputText.trim() || sending || !canReply ? 'var(--tx-buttonText-color)' : '#6f5310',
                            opacity: !inputText.trim() || sending || !canReply ? 0.3 : 1,
                        }}
                    >
                        <Send className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>
                </form>
            </div>
        </div>
    );
}
