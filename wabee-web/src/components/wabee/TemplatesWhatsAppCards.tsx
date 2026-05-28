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
                    return <div className={`${T.messageText} font-extrabold mb-2 text-base tracking-tight`} style={{ fontWeight: 900 }}>{formatText(comp.text)}</div>;
                }
                return (
                    <div className={`${T.emptyStateBody} bg-[var(--bg-muted)] aspect-video rounded-2xl flex flex-col items-center justify-center mb-4 text-[10px] uppercase tracking-[0.2em] border border-[var(--border-default)] shadow-inner`}>
                        <svg className="w-8 h-8 mb-2 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        {comp.format} PREVIEW
                    </div>
                );
            case 'BODY':
                return <div className={`${T.messageText} text-[13px] leading-relaxed whitespace-pre-wrap`}>{formatText(comp.text)}</div>;
            case 'FOOTER':
                return <div className={`${T.helperText} ${S.meta} mt-4 opacity-70 uppercase tracking-wider italic border-t border-[var(--border-default)]/10 pt-2`}>{formatText(comp.text)}</div>;
            case 'BUTTONS':
                return (
                    <div className="mt-6 space-y-2 border-t border-[var(--border-default)] pt-4">
                        {comp.buttons?.map((btn, i) => (
                            <div key={i} className={`${T.buttonText} bg-[var(--bg-card)] border border-[var(--border-default)] shadow-lg px-4 py-2.5 rounded-xl text-[11px] flex items-center justify-center w-full uppercase tracking-widest hover:bg-[var(--bg-muted)] transition-all cursor-default`}>
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
        <div className="bg-[var(--bg-page)] p-10 rounded-[40px] border border-[var(--border-default)] shadow-inner relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--brand-primary)]/[0.02] to-transparent pointer-events-none"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 relative z-10">
                {templates.map((template) => {
                    const header = template.components.find(c => c.type === 'HEADER');
                    const body = template.components.find(c => c.type === 'BODY');
                    const footer = template.components.find(c => c.type === 'FOOTER');
                    const buttons = template.components.find(c => c.type === 'BUTTONS');

                    return (
                        <div key={template.id} className="flex flex-col group/card">
                            {/* Metadata */}
                            <div className="flex justify-between items-center mb-3 px-2">
                                <span className={`${T.cardTitle} ${S.meta} text-[10px] uppercase tracking-[0.2em] truncate max-w-[180px] group-hover/card:text-[var(--brand-primary)] transition-colors`} title={template.name}>
                                    {template.name}
                                </span>
                                <span className={`text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest border ${template.status === 'APPROVED' ? 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] border-[var(--brand-primary)]/20' :
                                    template.status === 'PENDING' ? 'bg-[color:var(--state-warning)]/10 text-[color:var(--state-warning)] border-[color:var(--state-warning)]/20' :
                                        'bg-[color:var(--state-danger)]/10 text-[color:var(--state-danger)] border-[color:var(--state-danger)]/20'
                                    }`}>
                                    {template.status}
                                </span>
                            </div>

                            {/* WhatsApp Bubble Dark Premium */}
                            <div className="bg-[var(--bg-card)] p-5 shadow-2xl rounded-[28px] border border-[var(--border-default)] relative self-start max-w-full w-full group-hover/card:border-[var(--brand-primary)]/30 transition-all duration-500 group-hover/card:-translate-y-1">
                                <div className={`absolute top-0 right-0 w-24 h-24 bg-[var(--brand-primary)]/[0.03] blur-3xl pointer-events-none`}></div>
                                {header && renderComponent(header)}
                                {body && renderComponent(body)}
                                {footer && renderComponent(footer)}
                                {buttons && renderComponent(buttons)}

                                {/* Time Stamp Styled */}
                                <div className="flex justify-end mt-4">
                                    <span className={`${T.helperText} ${S.meta} uppercase tracking-tighter opacity-40`}>Verified Meta Protocol</span>
                                </div>
                            </div>

                            <div className="mt-4 px-3 flex items-center gap-3 opacity-60 group-hover/card:opacity-100 transition-opacity">
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
