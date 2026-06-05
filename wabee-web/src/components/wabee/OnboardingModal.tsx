import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Smartphone, Bot, Users, ArrowRight, X, CheckCircle2 } from 'lucide-react';
import { T, S } from '@/lib/text-tokens';

const STORAGE_KEY = 'wabee_onboarding_done';

const steps = [
    {
        icon: Smartphone,
        color: 'text-[var(--brand-primary)]',
        bg: 'bg-[color:color-mix(in_srgb,var(--brand-primary),transparent_88%)]',
        title: 'Conecta tu número de WhatsApp',
        description: 'Vincula el número de WhatsApp Business con el que vas a operar. Sin esto, no puedes recibir ni enviar mensajes.',
        cta: 'Conectar número',
        path: '/dashboard/wabee/channels',
    },
    {
        icon: Bot,
        color: 'text-[var(--state-info)]',
        bg: 'bg-[color:color-mix(in_srgb,var(--state-info),transparent_88%)]',
        title: 'Configura tu primer agente IA',
        description: 'Crea un perfil de IA que responda automáticamente a tus clientes. Define su nombre, personalidad y base de conocimiento.',
        cta: 'Crear perfil IA',
        path: '/dashboard/wabee/ai-profiles',
    },
    {
        icon: Users,
        color: 'text-[var(--state-success)]',
        bg: 'bg-[color:color-mix(in_srgb,var(--state-success),transparent_88%)]',
        title: 'Agrega tus primeros contactos',
        description: 'Importa o crea tus contactos para empezar a enviar campañas y gestionar conversaciones desde el inbox.',
        cta: 'Ir a contactos',
        path: '/dashboard/wabee/contacts',
    },
];

export function OnboardingModal() {
    const [step, setStep] = useState(0);
    const [visible, setVisible] = useState(true);
    const navigate = useNavigate();

    if (!visible) return null;

    const current = steps[step];
    const Icon = current.icon;
    const isLast = step === steps.length - 1;

    const dismiss = () => {
        localStorage.setItem(STORAGE_KEY, '1');
        setVisible(false);
    };

    const handleCta = () => {
        dismiss();
        navigate(current.path);
    };

    const handleNext = () => {
        if (isLast) {
            dismiss();
        } else {
            setStep(s => s + 1);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="relative w-full max-w-md bg-[var(--bg-card)] border border-[var(--border-default)] rounded-3xl shadow-2xl overflow-hidden">

                {/* Close */}
                <button
                    onClick={dismiss}
                    className="absolute top-4 right-4 p-1.5 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-body)] hover:bg-[var(--bg-surface)] transition-all"
                >
                    <X size={16} />
                </button>

                {/* Step indicators */}
                <div className="flex gap-2 px-8 pt-8 pb-0">
                    {steps.map((_, i) => (
                        <div
                            key={i}
                            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                                i <= step ? 'bg-[var(--brand-primary)]' : 'bg-[var(--border-default)]'
                            }`}
                        />
                    ))}
                </div>

                {/* Content */}
                <div className="px-8 pt-6 pb-8 space-y-6">
                    <div className="space-y-4">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${current.bg}`}>
                            <Icon size={26} className={current.color} />
                        </div>

                        <div className="space-y-1.5">
                            <p className={`${T.kpiLabel} ${S.meta} text-[var(--text-muted)]`}>
                                Paso {step + 1} de {steps.length}
                            </p>
                            <h2 className={`${T.pageTitle} ${S.displaySm} text-[var(--text-strong)]`}>
                                {current.title}
                            </h2>
                            <p className={`${T.pageSubtitle} ${S.body} text-[var(--text-muted)] leading-relaxed`}>
                                {current.description}
                            </p>
                        </div>
                    </div>

                    {/* Checklist de pasos completados */}
                    <div className="space-y-2">
                        {steps.map((s, i) => (
                            <div key={i} className={`flex items-center gap-2.5 text-sm transition-opacity ${i > step ? 'opacity-40' : ''}`}>
                                <CheckCircle2
                                    size={15}
                                    className={i < step ? 'text-[var(--state-success)]' : i === step ? 'text-[var(--brand-primary)]' : 'text-[var(--border-default)]'}
                                />
                                <span className={`${S.meta} ${i === step ? 'text-[var(--text-strong)] font-medium' : 'text-[var(--text-muted)]'}`}>
                                    {s.title}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 pt-1">
                        <button
                            onClick={handleCta}
                            className={`${T.buttonPrimaryText} ${S.body} flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--brand-primary)] text-[var(--brand-primary-foreground)] hover:opacity-90 transition-all`}
                        >
                            {current.cta}
                            <ArrowRight size={15} />
                        </button>

                        <button
                            onClick={handleNext}
                            className={`${S.body} px-4 py-2.5 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-body)] hover:bg-[var(--bg-surface)] transition-all text-sm`}
                        >
                            {isLast ? 'Completar más tarde' : 'Siguiente'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function shouldShowOnboarding(): boolean {
    if (localStorage.getItem(STORAGE_KEY)) return false;
    if (localStorage.getItem('wabee_impersonation')) return false;
    const globalRole = localStorage.getItem('wabee_globalRole');
    if (globalRole === 'admin') return false;
    const role = (localStorage.getItem('wabee_role') || '').toUpperCase();
    return role === 'ADMIN' || role === 'SUPERVISOR';
}
