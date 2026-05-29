import { MessageDeliveryStatus } from './MessageDeliveryStatus';
import React, { useState } from 'react';
import { T, S } from '@/lib/text-tokens';

export function renderWhatsAppMarkdown(text: string) {
    if (!text) return null;

    const parts = text.split(/(\*.*?\*|_.*?_|~.*?~|```.*?```)/g);

    return parts.map((part, index) => {
        if (part.startsWith('```') && part.endsWith('```')) {
            return (
                <code key={index} className="px-1.5 py-0.5 mx-0.5 bg-black/20 rounded font-mono text-[13px]">
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

    const bubbleClass = isOutbound
        ? 'bg-[linear-gradient(135deg,#f7e8be_0%,#f0d996_100%)] border-[rgba(226,181,78,0.26)] text-[#4e3e1c] rounded-[28px] rounded-br-[10px] shadow-[0_10px_22px_rgba(214,177,88,0.16)]'
        : 'bg-[rgba(255,255,255,0.94)] border-[rgba(197,176,136,0.18)] text-[var(--text-strong)] rounded-[28px] rounded-bl-[10px] shadow-[0_8px_18px_rgba(122,102,62,0.08)]';

    return (
        <div className={`flex w-full mb-4 ${isOutbound ? 'justify-end' : 'justify-start'}`}>
            <div className={`relative flex flex-col max-w-[86%] md:max-w-[68%] lg:max-w-[56%] min-w-[180px] border ${bubbleClass}`}>
                {isCampaign && (
                    <div className="flex items-center gap-1 mx-3 mt-3 mb-0">
                        <span className="text-[10px] font-black bg-black/10 text-current px-2.5 py-1 rounded-full uppercase tracking-[0.16em]">
                            Promo: {message.metadata?.campaignName || 'Meta'}
                        </span>
                    </div>
                )}

                {isOutbound && message.senderType === 'ai' && (
                    <div className="flex items-center gap-1 mx-3 mt-3 mb-0">
                        <span className="flex items-center gap-1 text-[10px] font-black bg-black/10 text-current border border-white/10 px-2.5 py-1 rounded-full uppercase tracking-[0.16em]">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            Inteligencia artificial
                        </span>
                    </div>
                )}

                {isOutbound && message.senderType === 'system' && (
                    <div className="flex items-center gap-1 mx-3 mt-3 mb-0">
                        <span className="text-[10px] font-black bg-black/10 text-current border border-white/10 px-2.5 py-1 rounded-full uppercase tracking-[0.16em]">
                            Sistema
                        </span>
                    </div>
                )}

                <div className="px-4 pt-3 pb-9 relative flex flex-col">
                    {templatePreview?.headerMedia && (
                        <HeaderMediaRenderer headerMedia={templatePreview.headerMedia} onMediaLoad={onMediaLoad} />
                    )}

                    {templatePreview?.headerText && (
                        <h4 className={`${T.cardTitle} mb-1 ${isOutbound ? 'text-[#4e3e1c]' : ''}`}>
                            {templatePreview.headerText}
                        </h4>
                    )}

                    <div
                        className={`${T.messageText} ${S.body} whitespace-pre-wrap leading-7 ${
                            isOutbound ? 'text-[#4e3e1c]' : 'text-[var(--text-strong)]'
                        }`}
                    >
                        {renderWhatsAppMarkdown(templatePreview?.bodyText || message.text)}
                    </div>

                    {templatePreview?.footerText && (
                        <div
                            className={`${T.helperText} mt-2 mb-1 leading-tight ${
                                isOutbound ? 'text-[rgba(78,62,28,0.62)]' : ''
                            }`}
                        >
                            {templatePreview.footerText}
                        </div>
                    )}

                    <div className="absolute bottom-2 right-3 flex items-center justify-end gap-1 select-none pointer-events-none">
                        <span
                            className={`${T.helperText} ${S.ui} ${
                                isOutbound ? 'text-[rgba(78,62,28,0.56)]' : ''
                            }`}
                        >
                            {formatTime(message.timestamp || message.createdAt)}
                        </span>
                        <MessageDeliveryStatus deliveryStatus={message.deliveryStatus} direction={message.direction} size={14} />
                    </div>
                </div>

                {templatePreview?.buttons && templatePreview.buttons.length > 0 && (
                    <div className="flex flex-col border-t border-white/10 divide-y divide-white/10">
                        {templatePreview.buttons.map((btn: any, idx: number) => {
                            if (btn.type === 'URL') {
                                return (
                                    <a
                                        key={idx}
                                        href={btn.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className={`${T.buttonPrimaryText} ${S.body} w-full text-center py-3 hover:bg-black/10 flex items-center justify-center gap-2 group transition-colors`}
                                        style={{ color: isOutbound ? '#6f5310' : 'var(--brand-primary)' }}
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                        </svg>
                                        {btn.text}
                                    </a>
                                );
                            }

                            if (btn.type === 'PHONE') {
                                return (
                                    <a
                                        key={idx}
                                        href={`tel:${btn.phone}`}
                                        className={`${T.buttonPrimaryText} ${S.body} w-full text-center py-3 hover:bg-black/10 flex items-center justify-center gap-2 group transition-colors`}
                                        style={{ color: isOutbound ? '#6f5310' : 'var(--brand-primary)' }}
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                        </svg>
                                        {btn.text}
                                    </a>
                                );
                            }

                            return (
                                <button
                                    key={idx}
                                    className={`${T.buttonPrimaryText} ${S.body} w-full text-center py-3 hover:bg-black/10 transition-colors`}
                                    style={{ color: isOutbound ? '#6f5310' : 'var(--tx-buttonText-color)' }}
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
        const token = localStorage.getItem('wabee_token') ?? '';
        const tenantId = localStorage.getItem('wabee_orgId') || localStorage.getItem('tenant_key') || '';
        try {
            const res = await fetch(`${API_URL}/core/media/${headerMedia.mediaFileId}/signed-url`, {
                headers: { Authorization: `Bearer ${token}`, 'x-tenant-id': tenantId },
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
            <div className="mb-3 -mx-2 -mt-1 rounded-[22px] overflow-hidden cursor-pointer">
                <img
                    src={imgUrl}
                    alt="Header media"
                    className="w-full max-h-[300px] object-cover"
                    onError={refreshUrl}
                    onLoad={onMediaLoad}
                />
            </div>
        );
    }

    if (headerMedia.kind === 'VIDEO') {
        return (
            <div className="mb-3 -mx-2 -mt-1 rounded-[22px] overflow-hidden bg-black">
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
                className="flex items-center gap-3 mb-2 p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl outline-none transition-all"
            >
                <svg className="w-8 h-8 opacity-60 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <div className="flex flex-col overflow-hidden">
                    <span className="text-[14px] font-semibold truncate leading-tight">Documento adjunto</span>
                    <span className="text-[12px] opacity-50 truncate">PDF / Documento</span>
                </div>
            </a>
        );
    }

    return null;
}
