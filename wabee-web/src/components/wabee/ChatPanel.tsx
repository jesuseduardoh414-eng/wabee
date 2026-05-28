import { useState, useEffect, useRef } from 'react';
import { Message, markThreadRead } from '@/api/wabee/inbox.api';
import EmojiPicker, { Theme, EmojiClickData } from 'emoji-picker-react';
import { Send, Smile, Paperclip, StickyNote } from 'lucide-react';
import { WhatsAppMessageBubble } from './inbox/WhatsAppMessageBubble';
import { useStickyAutoScroll } from './inbox/useStickyAutoScroll';
import { T, S } from '@/lib/text-tokens';

interface Props {
    messages: Message[];
    contactName: string;
    onSendMessage: (text: string) => Promise<void>;
    onBack?: () => void;
    threadId?: string; // Optional for now to not break usage if missing
    isNotesOpen?: boolean;
    onToggleNotes?: () => void;
    canReply?: boolean;
}

export default function ChatPanel({ messages, contactName, onSendMessage, onBack, threadId, isNotesOpen, onToggleNotes, canReply = true }: Props) {
    const [inputText, setInputText] = useState('');
    const [sending, setSending] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const emojiPickerRef = useRef<HTMLDivElement>(null);

    const { isNearBottomRef, handleScroll, markShouldScroll, scrollToBottom } = useStickyAutoScroll(
        scrollContainerRef,
        [messages.length],
        threadId
    );

    // Mark as read when entering thread
    useEffect(() => {
        if (threadId) {
            markThreadRead(threadId).catch(err => console.error("Could not mark thread read", err));
        }
    }, [threadId, messages.length]); // Mark read on mount or new messages? Maybe just mount/threadId change.

    // Close emoji picker when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
                setShowEmojiPicker(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputText.trim() || sending) return;

        setSending(true);
        setShowEmojiPicker(false); // Close picker on send
        markShouldScroll(); // Force scroll for user's own message
        try {
            await onSendMessage(inputText);
            setInputText('');
        } catch (error) {
            console.error('Error sending message:', error);
        } finally {
            setSending(false);
        }
    };

    const handleEmojiClick = (emojiData: EmojiClickData) => {
        setInputText((prev) => prev + emojiData.emoji);
        // intent to keep focus? 
    };

    return (
        <div className="flex flex-col h-full bg-[var(--bg-page)] relative overflow-hidden">
            {/* Ambient background glow */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[var(--brand-primary)]/5 blur-[120px] pointer-events-none"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[var(--brand-primary)]/5 blur-[120px] pointer-events-none"></div>

            {/* Header */}
            <div className="h-12 bg-[var(--bg-surface)]/80 backdrop-blur-xl px-4 flex justify-between items-center border-b border-[var(--border-default)] z-10 shrink-0">
                <div className="flex items-center gap-3">
                    {/* Avatar Placeholder */}
                    <div className="w-9 h-9 rounded-xl bg-[var(--brand-primary)]/10 border border-[var(--brand-primary)]/20 flex items-center justify-center overflow-hidden shadow-inner group">
                        <svg className="w-5 h-5 text-[var(--brand-primary)] group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                        </svg>
                    </div>
                    <div className="flex flex-col justify-center">
                        <h3 className={`${T.cardTitle} ${S.headingMd} uppercase leading-tight`}>{contactName}</h3>
                        <div className="flex items-center gap-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
                            <p className={`${T.helperText} ${S.meta} uppercase`}>En línea</p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3 text-[var(--text-muted)]" style={{ color: 'var(--tx-buttonText-color)' }}>
                    {onToggleNotes && (
                        <button
                            onClick={onToggleNotes}
                            className={`p-1.5 rounded-lg transition-all border active:scale-95 flex items-center gap-1.5 px-2.5 ${isNotesOpen ? 'bg-[var(--brand-primary)] text-[var(--brand-primary-foreground)] border-[var(--brand-primary)]' : 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] border-[var(--brand-primary)]/20 hover:brightness-110'}`}
                            title="Notas internas"
                        >
                            <StickyNote className="w-4 h-4" />
                            <span className={`${S.meta} uppercase font-black tracking-widest`}>Notas</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Messages Area */}
            <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto px-6 py-6 space-y-2 z-10 custom-scrollbar relative"
            >
                {/* Fallback WA wallpaper overlay */}
                <div className="absolute inset-0 opacity-5 pointer-events-none select-none bg-wa-pattern bg-repeat" />

                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full opacity-30 grayscale relative z-10">
                        <div className="w-20 h-20 rounded-full border border-[var(--text-muted)]/30 flex items-center justify-center mb-4">
                            <svg className="w-10 h-10" style={{ color: 'var(--tx-helperText-color)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                        </div>
                        <span className={`${T.helperText} ${S.meta} uppercase`}>Inicio de la transmisión oficial</span>
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

            {/* Input Footer */}
            <div className="bg-[var(--bg-surface)] backdrop-blur-xl px-4 py-3 md:px-6 md:py-4 flex items-center gap-3 border-t border-[var(--border-default)] z-20">

                {/* Emoji Picker Container */}
                <div className="relative" ref={emojiPickerRef}>
                    {showEmojiPicker && (
                        <div className="absolute bottom-16 left-0 shadow-2xl rounded-2xl overflow-hidden animate-scale-in z-50">
                            <EmojiPicker
                                theme={Theme.DARK}
                                onEmojiClick={handleEmojiClick}
                                width={320}
                                height={450}
                            />
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className={`p-2 sm:p-2.5 rounded-xl border transition-all active:scale-95 ${showEmojiPicker ? 'bg-[var(--brand-primary)]  border-[var(--brand-primary)]' : 'bg-[var(--bg-input)] border-[var(--border-default)] hover:border-[var(--brand-primary)]/50'}`}
                        style={{ color: showEmojiPicker ? 'var(--brand-primary-foreground)' : 'var(--tx-buttonText-color)' }}
                    >
                        <Smile className="w-5 h-5" />
                    </button>
                </div>

                <button type="button" className="p-2 sm:p-2.5 bg-[var(--bg-input)] rounded-xl border border-[var(--border-default)] hover:brightness-110 transition-all active:scale-95" style={{ color: 'var(--tx-buttonText-color)' }}>
                    <Paperclip className="w-5 h-5" />
                </button>

                <form onSubmit={handleSubmit} className="flex-1 flex gap-3">
                    <div className="flex-1 relative group">
                        <input
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder={canReply ? "Escribe un mensaje oficial..." : "Toma el chat para poder responder"}
                            disabled={sending || !canReply}
                            className={`${T.inputText} ${S.body} w-full px-4 sm:px-5 py-3 sm:py-3.5 bg-[var(--bg-page)] border border-[var(--border-default)] rounded-2xl focus:ring-2 focus:ring-[var(--brand-primary)]/30 focus:border-[var(--brand-primary)] outline-none transition-all placeholder:text-[var(--text-muted)] ${!canReply ? 'opacity-50 cursor-not-allowed' : ''}`}
                        />
                        {sending && (
                            <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                <div className="animate-spin h-4 w-4 border-2 border-t-[var(--brand-primary)] border-transparent rounded-full"></div>
                            </div>
                        )}
                    </div>
                    <button
                        type="submit"
                        disabled={!inputText.trim() || sending || !canReply}
                        className={`p-3 sm:p-3.5 rounded-2xl transition-all shadow-xl active:scale-95 flex items-center justify-center ${(!inputText.trim() || sending || !canReply)
                            ? 'bg-[var(--bg-input)] border border-[var(--border-default)]'
                            : 'bg-[var(--brand-primary)]  shadow-[var(--brand-primary)]/10 hover:brightness-110'}`}
                        style={{ color: (!inputText.trim() || sending || !canReply) ? 'var(--tx-buttonText-color)' : 'var(--brand-primary-foreground)', opacity: (!inputText.trim() || sending || !canReply) ? 0.3 : 1 }}
                    >
                        <Send className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>
                </form>
            </div>
        </div>
    );
}
