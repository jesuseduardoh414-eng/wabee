import React from 'react';
import { T, S } from '@/lib/text-tokens';

interface TemplateComponent {
    type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
    format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
    text?: string;
    buttons?: any[];
}

interface Template {
    id: string;
    name: string;
    language: string;
    category: string;
    status: string;
    components: TemplateComponent[];
}

interface Props {
    templates: Template[];
}

export const TemplatesWhatsAppCards: React.FC<Props> = ({ templates }) => {
    const renderComponent = (comp: TemplateComponent) => {
        const formatText = (text?: string) => {
            if (!text) return '';
            return text.replace(/\{\{(\d+)\}\}/g, '____');
        };

        switch (comp.type) {
            case 'HEADER':
                if (comp.format === 'TEXT') {
                    return <div className={`${T.messageText} mb-2 text-base font-extrabold tracking-tight`} style={{ fontWeight: 900 }}>{formatText(comp.text)}</div>;
                }
                return (
                    <div className={`${T.emptyStateBody} mb-4 flex aspect-video flex-col items-center justify-center rounded-2xl border border-[var(--border-default)] bg-[var(--bg-muted)] text-[10px] uppercase tracking-[0.2em] shadow-inner`}>
                        <svg className="mb-2 h-8 w-8 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        {comp.format} PREVIEW
                    </div>
                );
            case 'BODY':
                return <div className={`${T.messageText} whitespace-pre-wrap text-[13px] leading-relaxed`}>{formatText(comp.text)}</div>;
            case 'FOOTER':
                return <div className={`${T.helperText} ${S.meta} mt-4 border-t border-[var(--border-default)]/10 pt-2 uppercase tracking-wider opacity-70 italic`}>{formatText(comp.text)}</div>;
            case 'BUTTONS':
                return (
                    <div className="mt-6 space-y-2 border-t border-[var(--border-default)] pt-4">
                        {comp.buttons?.map((btn, i) => (
                            <div key={i} className={`${T.buttonText} flex w-full cursor-default items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-2.5 text-[11px] uppercase tracking-widest shadow-lg transition-all hover:bg-[var(--bg-muted)]`}>
                                {btn.text}
                            </div>
                        ))}
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="relative overflow-hidden rounded-[32px] border border-[var(--border-default)] bg-[var(--bg-page)] p-5 shadow-inner sm:rounded-[40px] sm:p-8 lg:p-10">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[var(--brand-primary)]/[0.02] to-transparent"></div>
            <div className="relative z-10 grid grid-cols-1 gap-6 sm:gap-8 md:grid-cols-2 xl:grid-cols-3 lg:gap-10">
                {templates.map((template) => {
                    const header = template.components.find(c => c.type === 'HEADER');
                    const body = template.components.find(c => c.type === 'BODY');
                    const footer = template.components.find(c => c.type === 'FOOTER');
                    const buttons = template.components.find(c => c.type === 'BUTTONS');

                    return (
                        <div key={template.id} className="flex flex-col group/card">
                            <div className="mb-3 flex items-center justify-between gap-3 px-1 sm:px-2">
                                <span className={`${T.cardTitle} ${S.meta} max-w-[180px] truncate text-[10px] uppercase tracking-[0.2em] transition-colors group-hover/card:text-[var(--brand-primary)]`} title={template.name}>
                                    {template.name}
                                </span>
                                <span className={`rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-widest ${template.status === 'APPROVED' ? 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] border-[var(--brand-primary)]/20' :
                                    template.status === 'PENDING' ? 'bg-[color:var(--state-warning)]/10 text-[color:var(--state-warning)] border-[color:var(--state-warning)]/20' :
                                        'bg-[color:var(--state-danger)]/10 text-[color:var(--state-danger)] border-[color:var(--state-danger)]/20'
                                    }`}>
                                    {template.status}
                                </span>
                            </div>

                            <div className="relative w-full max-w-full self-start rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-card)] p-4 shadow-2xl transition-all duration-500 group-hover/card:-translate-y-1 group-hover/card:border-[var(--brand-primary)]/30 sm:rounded-[28px] sm:p-5">
                                <div className="pointer-events-none absolute right-0 top-0 h-24 w-24 bg-[var(--brand-primary)]/[0.03] blur-3xl"></div>
                                {header && renderComponent(header)}
                                {body && renderComponent(body)}
                                {footer && renderComponent(footer)}
                                {buttons && renderComponent(buttons)}

                                <div className="mt-4 flex justify-end">
                                    <span className={`${T.helperText} ${S.meta} uppercase tracking-tighter opacity-40`}>Verified Meta Protocol</span>
                                </div>
                            </div>

                            <div className="mt-4 flex items-center gap-3 px-2 opacity-60 transition-opacity group-hover/card:opacity-100 sm:px-3">
                                <span className={`${T.badgeText} text-[9px] uppercase tracking-widest`}>{template.language}</span>
                                <div className="h-1.5 w-1.5 rounded-full bg-[var(--border-default)]"></div>
                                <span className={`${T.helperText} ${S.meta} text-[9px] uppercase tracking-widest`}>{template.category}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
