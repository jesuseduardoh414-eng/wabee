type HandlingMode = 'ai' | 'human_queue' | 'human' | 'copilot' | 'paused' | null;

interface Props {
    mode: HandlingMode;
    aiPaused?: boolean;
    className?: string;
}

export default function ThreadHandlingModeBadge({ mode, aiPaused, className = '' }: Props) {
    if (!mode) {
        return (
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter bg-[#2a2a1a] text-[#a0a080] border border-[#3a3a2a] ${className}`}>
                Sin Asignar
            </span>
        );
    }

    if (aiPaused) {
        return (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter bg-amber-500/10 text-amber-500 border border-amber-500/20 ${className}`}>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                IA Pausada
            </span>
        );
    }

    switch (mode) {
        case 'ai':
            return (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] border border-[var(--brand-primary)]/30 ${className}`}>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    A.I.
                </span>
            );
        case 'copilot':
            return (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter bg-purple-500/10 text-purple-400 border border-purple-500/30 ${className}`}>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                    Copiloto
                </span>
            );
        case 'human_queue':
            return (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter bg-orange-500/10 text-orange-500 border border-orange-500/20 ${className}`}>
                    Esperando Agente
                </span>
            );
        case 'human':
            return (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter bg-blue-500/10 text-blue-400 border border-blue-500/30 ${className}`}>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    Humano
                </span>
            );
        case 'paused':
            return (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter bg-[#2a2a1a] text-[#a0a080] border border-[#3a3a2a] ${className}`}>
                    Pausado
                </span>
            );
        default:
            return null;
    }
}
