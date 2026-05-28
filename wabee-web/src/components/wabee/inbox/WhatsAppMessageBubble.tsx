import { MessageDeliveryStatus } from './MessageDeliveryStatus';
import React, { useState } from 'react';
import { T, S } from '@/lib/text-tokens';

// --- Markdown Parser genérico estilo WhatsApp ---
export function renderWhatsAppMarkdown(text: string) {
    if (!text) return null;

    // Divide the text into segments to parse formatting symbols
    const parts = text.split(/(\*.*?\*|_.*?_|~.*?~|```.*?```)/g);

    return parts.map((part, index) => {
        if (part.startsWith('```') && part.endsWith('```')) {
            return <code key={index} className="px-1.5 py-0.5 mx-0.5 bg-black/20 rounded font-mono text-[13px]">{part.slice(3, -3)}</code>;
        }
        if (part.startsWith('*') && part.endsWith('*')) {
            return <strong key={index} className="font-bold">{part.slice(1, -1)}</strong>;
        }
        if (part.startsWith('_') && part.endsWith('_')) {
            return <em key={index} className="italic">{part.slice(1, -1)}</em>;
        }
        if (part.startsWith('~') && part.endsWith('~')) {
            return <del key={index} className="line-through">{part.slice(1, -1)}</del>;
        }

        // Handle normal text and new-lines
        const lines = part.split('\n');
        return (
            <React.Fragment key={index}>
                {lines.map((line, lineIndex) => (
                    <React.Fragment key={lineIndex}>
                        {line}
                        {lineIndex < lines.length - 1 && <br />}
                    </React.Fragment>
                ))}
            </React.Fragment>
        );
    });
}

// --- formatting time ---
const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '';
    
    return date.toLocaleTimeString('es-MX', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    }).toLowerCase(); // e.g., 4:26 pm
};

interface WhatsAppMessageBubbleProps {
    message: any;
    onMediaLoad?: () => void;
}

export function WhatsAppMessageBubble({ message, onMediaLoad }: WhatsAppMessageBubbleProps) {
    const isOutbound = message.direction === 'OUTBOUND';
    const isCampaign = message.metadata?.source === 'campaign';
    const templatePreview = message.metadata?.templatePreview;

    // Colores basados en Theme variables
    // Inbound: bg-surface, Outbound: brand-primary suave
    const bgClass = isOutbound ? 'bg-[var(--brand-primary)]/5 border-[var(--brand-primary)]/20 rounded-tr-none' : 'bg-[var(--bg-surface)] border-[var(--border-default)] rounded-tl-none';
    const textColorToken = T.messageText;
    const timestampColorToken = T.helperText;

    return (
        <div className={`flex w-full mb-3 ${isOutbound ? 'justify-end' : 'justify-start'}`}>
            <div className={`relative flex flex-col max-w-[85%] md:max-w-[65%] lg:max-w-[50%] min-w-[200px] border shadow-md rounded-2xl ${bgClass}`}>

                {/* PROMO Badge para campañas */}
                {isCampaign && (
                    <div className="flex items-center gap-1 mx-2 mt-2 mb-0">
                        <span className="text-[9px] font-black bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] px-2 py-0.5 rounded uppercase tracking-tighter shadow-sm">
                            PROMO: {message.metadata?.campaignName || 'Meta'}
                        </span>
                    </div>
                )}

                {/* Sender Type Badge para Outbound (IA / Sistema) */}
                {isOutbound && message.senderType === 'ai' && (
                    <div className="flex items-center gap-1 mx-2 mt-2 mb-0">
                        <span className="flex items-center gap-1 text-[9px] font-black bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] border border-[var(--brand-primary)]/20 px-2 py-0.5 rounded uppercase tracking-tighter shadow-sm">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            Inteligencia Artificial
                        </span>
                    </div>
                )}
                {isOutbound && message.senderType === 'system' && (
                    <div className="flex items-center gap-1 mx-2 mt-2 mb-0">
                        <span className="text-[9px] font-black bg-[var(--bg-input)] text-[var(--text-muted)] border border-[var(--border-default)] px-2 py-0.5 rounded uppercase tracking-tighter shadow-sm">
                            Sistema
                        </span>
                    </div>
                )}

                <div className="px-3 pt-2 pb-8 relative flex flex-col">

                    {/* --- HEADER --- */}
                    {templatePreview?.headerMedia && <HeaderMediaRenderer headerMedia={templatePreview.headerMedia} onMediaLoad={onMediaLoad} />}

                    {templatePreview?.headerText && (
                        <h4 className={`${T.cardTitle} mb-1`}>
                            {templatePreview.headerText}
                        </h4>
                    )}

                    {/* --- BODY --- */}
                    <div className={`${textColorToken} ${S.body} whitespace-pre-wrap`}>
                        {renderWhatsAppMarkdown(templatePreview?.bodyText || message.text)}
                    </div>

                    {/* --- FOOTER --- */}
                    {templatePreview?.footerText && (
                        <div className={`${T.helperText} mt-1 mb-1 leading-tight`}>
                            {templatePreview.footerText}
                        </div>
                    )}

                    {/* --- CORNER TIME & TICKS --- */}
                    <div className="absolute bottom-1 right-2.5 flex items-center justify-end gap-1 select-none pointer-events-none">
                        <span className={`${timestampColorToken} ${S.ui}`}>
                            {formatTime(message.timestamp || message.createdAt)}
                        </span>
                        <MessageDeliveryStatus
                            deliveryStatus={message.deliveryStatus}
                            direction={message.direction}
                            size={14}
                        />
                    </div>
                </div>

            {/* --- BUTTONS --- */}
                {templatePreview?.buttons && templatePreview.buttons.length > 0 && (
                    <div className="flex flex-col border-t border-[var(--border-default)] divide-y divide-[var(--border-default)]">
                        {templatePreview.buttons.map((btn: any, idx: number) => {
                            if (btn.type === 'URL') {
                                return (
                                    <a
                                        key={idx}
                                        href={btn.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className={`${T.buttonPrimaryText} ${S.body} w-full text-center py-2.5 hover:bg-[var(--brand-primary)]/5 flex items-center justify-center gap-2 group transition-colors`}
                                        style={{ color: 'var(--brand-primary)' }}
                                    >
                                        <svg className="w-4 h-4" style={{ color: 'var(--brand-primary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                        {btn.text}
                                    </a>
                                );
                            }
                            if (btn.type === 'PHONE') {
                                return (
                                    <a
                                        key={idx}
                                        href={`tel:${btn.phone}`}
                                        className={`${T.buttonPrimaryText} ${S.body} w-full text-center py-2.5 hover:bg-[var(--brand-primary)]/5 flex items-center justify-center gap-2 group transition-colors`}
                                        style={{ color: 'var(--brand-primary)' }}
                                    >
                                        <svg className="w-4 h-4" style={{ color: 'var(--brand-primary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                        {btn.text}
                                    </a>
                                );
                            }
                            // QUICK_REPLY
                            return (
                                <button
                                    key={idx}
                                    className={`${T.buttonPrimaryText} ${S.body} w-full text-center py-2.5 hover:bg-[var(--brand-primary)]/5 transition-colors`}
                                    style={{ color: 'var(--tx-buttonText-color)' }}
                                >
                                    {btn.text}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

// Extracted from original ChatPanel for Media
function HeaderMediaRenderer({ headerMedia, onMediaLoad }: { headerMedia: { kind: string, url: string, mediaFileId?: string }, onMediaLoad?: () => void }) {
    const [imgUrl, setImgUrl] = useState(headerMedia.url);

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/v1';

    const refreshUrl = async () => {
        if (!headerMedia.mediaFileId) return;
        const token = localStorage.getItem('wabee_token') ?? '';
        const tenantId = localStorage.getItem('wabee_orgId') || localStorage.getItem('tenant_key') || '';
        try {
            const res = await fetch(`${API_URL}/core/media/${headerMedia.mediaFileId}/signed-url`, {
                headers: { Authorization: `Bearer ${token}`, 'x-tenant-id': tenantId }
            });
            if (res.ok) {
                const data = await res.json();
                if (data.signedUrl) setImgUrl(data.signedUrl);
            }
        } catch (e) {
            console.error("Failed to refresh header media signed url");
        }
    };

    if (headerMedia.kind === 'IMAGE') return (
        <div className="mb-2 -mx-1 -mt-1 rounded-t-xl sm:rounded-xl overflow-hidden cursor-pointer">
            <img
                src={imgUrl}
                alt="Header media"
                className="w-full max-h-[300px] object-cover"
                onError={refreshUrl}
                onLoad={onMediaLoad}
            />
        </div>
    );
    if (headerMedia.kind === 'VIDEO') return (
        <div className="mb-2 -mx-1 -mt-1 rounded-t-xl sm:rounded-xl overflow-hidden bg-black">
            <video src={imgUrl} controls className="w-full max-h-[300px]" onError={refreshUrl} onLoadedData={onMediaLoad} />
        </div>
    );
    if (headerMedia.kind === 'DOCUMENT') return (
        <a href={imgUrl} target="_blank" rel="noreferrer"
            className="flex items-center gap-3 mb-2 p-3 bg-white/5 hover:bg-white/10 border border-[#4a4a4a] rounded-xl text-white outline-none transition-all">
            <svg className="w-8 h-8 opacity-60 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
            <div className="flex flex-col overflow-hidden">
                <span className="text-[14px] font-semibold truncate leading-tight">Documento Adjunto</span>
                <span className="text-[12px] opacity-50 truncate">PDF / Documento</span>
            </div>
        </a>
    );
    return null;
}
