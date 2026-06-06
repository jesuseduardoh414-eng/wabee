import { MessageDeliveryStatus } from './MessageDeliveryStatus';
import React, { useState } from 'react';
import { T, S } from '@/lib/text-tokens';

export function renderWhatsAppMarkdown(text: string) {
    if (!text) return null;

    const parts = text.split(/(\*.*?\*|_.*?_|~.*?~|```.*?```)/g);

    return parts.map((part, index) => {
        if (part.startsWith('```') && part.endsWith('```')) {
            return (
                <code key={index} className="mx-0.5 rounded bg-black/20 px-1.5 py-0.5 font-mono text-[13px]">
                    {part.slice(3, -3)}
                </code>
            );
        }
        if (part.startsWith('*') && part.endsWith('*')) {
            return (
                <strong key={index} className="font-bold">
                    {part.slice(1, -1)}
                </strong>
            );
        }
        if (part.startsWith('_') && part.endsWith('_')) {
            return (
                <em key={index} className="italic">
                    {part.slice(1, -1)}
                </em>
            );
        }
        if (part.startsWith('~') && part.endsWith('~')) {
            return (
                <del key={index} className="line-through">
                    {part.slice(1, -1)}
                </del>
            );
        }

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

const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '';

    return date.toLocaleTimeString('es-MX', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    }).toLowerCase();
};

interface WhatsAppMessageBubbleProps {
    message: any;
    onMediaLoad?: () => void;
}

export function WhatsAppMessageBubble({ message, onMediaLoad }: WhatsAppMessageBubbleProps) {
    const isOutbound = message.direction === 'OUTBOUND';
    const isCampaign = message.metadata?.source === 'campaign';
    const templatePreview = message.metadata?.templatePreview;
    const isSystemTransfer =
        message.senderType === 'system' &&
        typeof (templatePreview?.bodyText || message.text) === 'string' &&
        (templatePreview?.bodyText || message.text).trim().length > 0;

    if (isSystemTransfer) {
        return (
            <div className="my-4 flex w-full justify-center">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(255,140,0,0.2)] bg-[rgba(255,140,0,0.06)] px-4 py-1.5 text-[12.5px] font-semibold text-[var(--brand-primary)]">
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    {templatePreview?.bodyText || message.text}
                </span>
            </div>
        );
    }

    const bubbleClass = isOutbound
        ? 'bg-[rgba(255,140,0,0.055)] border-[rgba(255,140,0,0.14)] text-[#1A1A1A] rounded-[14px] rounded-br-[6px] shadow-[0_1px_2px_rgba(26,26,26,0.04)]'
        : 'bg-white border-[rgba(26,26,26,0.08)] text-[#1A1A1A] rounded-[14px] rounded-bl-[6px] shadow-[0_1px_2px_rgba(26,26,26,0.04)]';

    return (
        <div className={`flex w-full mb-2.5 ${isOutbound ? 'justify-end' : 'justify-start'}`}>
            <div className={`relative flex flex-col max-w-[min(620px,74%)] min-w-[96px] border ${bubbleClass}`}>
                {isCampaign && (
                    <div className="flex items-center gap-1 mx-3 mt-3 mb-0">
                        <span className="text-[9.5px] font-bold uppercase tracking-[0.14em] bg-[rgba(255,140,0,0.1)] text-[var(--brand-primary)] border border-[rgba(255,140,0,0.18)] px-2 py-0.5 rounded-[6px]">
                            Promo: {message.metadata?.campaignName || 'Meta'}
                        </span>
                    </div>
                )}

                {isOutbound && message.senderType === 'ai' && (
                    <div className="flex items-center gap-1 mx-3 mt-3 mb-0">
                        <span className="inline-flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-[0.14em] bg-[rgba(255,215,0,0.18)] border border-[rgba(26,26,26,0.08)] text-[rgba(26,26,26,0.6)] px-2 py-0.5 rounded-[6px]">
                            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            Asistente IA
                        </span>
                    </div>
                )}

                <div className="px-3 pt-2.5 pb-7 relative flex flex-col">
                    {templatePreview?.headerMedia && (
                        <HeaderMediaRenderer headerMedia={templatePreview.headerMedia} onMediaLoad={onMediaLoad} />
                    )}

                    {templatePreview?.headerText && (
                        <h4 className={`${T.cardTitle} mb-1`}>{templatePreview.headerText}</h4>
                    )}

                    <div className={`${T.messageText} ${S.body} whitespace-pre-wrap text-[15px] leading-[1.55] text-[#1A1A1A]`}>
                        {renderWhatsAppMarkdown(templatePreview?.bodyText || message.text)}
                    </div>

                    {templatePreview?.footerText && (
                        <div className={`${T.helperText} mt-2 text-[rgba(26,26,26,0.5)]`}>
                            {templatePreview.footerText}
                        </div>
                    )}

                    <div className="absolute bottom-1.5 right-3 flex items-center justify-end gap-1 select-none pointer-events-none">
                        <span className="text-[10.5px] text-[rgba(26,26,26,0.4)]" style={{ fontFamily: 'ui-monospace,monospace' }}>
                            {formatTime(message.timestamp || message.createdAt)}
                        </span>
                        <MessageDeliveryStatus deliveryStatus={message.deliveryStatus} direction={message.direction} size={13} />
                    </div>
                </div>

                {templatePreview?.buttons && templatePreview.buttons.length > 0 && (
                    <div className="flex flex-col border-t border-[rgba(26,26,26,0.08)] divide-y divide-[rgba(26,26,26,0.06)]">
                        {templatePreview.buttons.map((btn: any, idx: number) => {
                            if (btn.type === 'URL') {
                                return (
                                    <a
                                        key={idx}
                                        href={btn.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="w-full text-center py-2.5 hover:bg-[rgba(26,26,26,0.04)] flex items-center justify-center gap-2 transition-colors text-[13px] font-medium text-[var(--brand-primary)]"
                                    >
                                        {btn.text}
                                    </a>
                                );
                            }
                            if (btn.type === 'PHONE') {
                                return (
                                    <a
                                        key={idx}
                                        href={`tel:${btn.phone}`}
                                        className="w-full text-center py-2.5 hover:bg-[rgba(26,26,26,0.04)] flex items-center justify-center gap-2 transition-colors text-[13px] font-medium text-[var(--brand-primary)]"
                                    >
                                        {btn.text}
                                    </a>
                                );
                            }
                            return (
                                <button
                                    key={idx}
                                    className="w-full text-center py-2.5 hover:bg-[rgba(26,26,26,0.04)] transition-colors text-[13px] font-medium text-[rgba(26,26,26,0.65)]"
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

function HeaderMediaRenderer({
    headerMedia,
    onMediaLoad,
}: {
    headerMedia: { kind: string; url: string; mediaFileId?: string };
    onMediaLoad?: () => void;
}) {
    const [imgUrl, setImgUrl] = useState(headerMedia.url);

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/v1';

    const refreshUrl = async () => {
        if (!headerMedia.mediaFileId) return;
        const tenantId = localStorage.getItem('wabee_orgId') || localStorage.getItem('tenant_key') || '';
        try {
            const res = await fetch(`${API_URL}/core/media/${headerMedia.mediaFileId}/signed-url`, {
                credentials: 'include',
                headers: { 'x-tenant-id': tenantId },
            });
            if (res.ok) {
                const data = await res.json();
                if (data.signedUrl) setImgUrl(data.signedUrl);
            }
        } catch (error) {
            console.error('Failed to refresh header media signed url', error);
        }
    };

    if (headerMedia.kind === 'IMAGE') {
        return (
            <div className="-mx-1.5 -mt-1 mb-2.5 rounded-[10px] overflow-hidden">
                <img src={imgUrl} alt="Header media" className="w-full max-h-[300px] object-cover" onError={refreshUrl} onLoad={onMediaLoad} />
            </div>
        );
    }

    if (headerMedia.kind === 'VIDEO') {
        return (
            <div className="-mx-1.5 -mt-1 mb-2.5 rounded-[10px] overflow-hidden bg-black">
                <video src={imgUrl} controls className="w-full max-h-[300px]" onError={refreshUrl} onLoadedData={onMediaLoad} />
            </div>
        );
    }

    if (headerMedia.kind === 'DOCUMENT') {
        return (
            <a
                href={imgUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 mb-2 p-3 bg-[rgba(26,26,26,0.04)] hover:bg-[rgba(26,26,26,0.07)] border border-[rgba(26,26,26,0.08)] rounded-[10px] outline-none transition-all"
            >
                <svg className="w-7 h-7 opacity-50 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <div className="flex flex-col overflow-hidden">
                    <span className="text-[13px] font-semibold truncate leading-tight">Documento adjunto</span>
                    <span className="text-[12px] opacity-45 truncate">PDF / Documento</span>
                </div>
            </a>
        );
    }

    return null;
}
