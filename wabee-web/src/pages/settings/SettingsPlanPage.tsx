import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    CreditCard, Zap, Database, MessageSquare, ExternalLink, Phone,
    Bot, Users, CheckCircle2, Loader2, ArrowUpRight, XCircle,
    AlertTriangle, RefreshCcw, Clock, Star, Sparkles, TrendingUp, Settings
} from 'lucide-react';
import client from '../../api/client';
import { T, S } from '@/lib/text-tokens';

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface PlanData {
    id: string | null;
    name: string; displayName: string; code: string;
    period: string; status: string; price: number; 
    monthlyPrice: number; annualPrice: number;
    currency: string;
    renewsAt: string | null; cancelAtPeriodEnd: boolean;
    isTrial: boolean; trialDaysRemaining: number | null;
    version?: number;
    createdAt?: string | null;
}

interface PlanLimits {
    channels: number | null;
    contacts: number | null;
    aiAgents: number | null;
    campaignsPerMonth: number | null;
    aiTokensPerMonth: number | null;
    storageMb: number | null;
    users: number | null;
}

interface BillingSummary {
    plan: PlanData;
    limits: PlanLimits;
    modules: Record<string, boolean>;
    usage: Record<string, number>;
    actions: { canUpgrade: boolean; canCancel: boolean; hasStripeCustomer: boolean; };
}

const UNLIMITED_PLAN_CODES = new Set(['TRIAL']);

const normalizeLimits = (planCode?: string, limits?: Partial<PlanLimits> | null): PlanLimits => {
    const isUnlimitedPlan = planCode ? UNLIMITED_PLAN_CODES.has(planCode) : false;

    return {
        channels: limits?.channels ?? (isUnlimitedPlan ? -1 : null),
        contacts: limits?.contacts ?? (isUnlimitedPlan ? -1 : null),
        aiAgents: limits?.aiAgents ?? (isUnlimitedPlan ? -1 : null),
        campaignsPerMonth: limits?.campaignsPerMonth ?? (isUnlimitedPlan ? -1 : null),
        aiTokensPerMonth: limits?.aiTokensPerMonth ?? (isUnlimitedPlan ? -1 : null),
        storageMb: limits?.storageMb ?? (isUnlimitedPlan ? -1 : null),
        users: limits?.users ?? (isUnlimitedPlan ? -1 : null),
    };
};

interface PublicPlan {
    id: string; code: string; name: string;
    monthlyPrice: number; annualPrice: number;
    currency: string;
    period: string; 
    activationMode: 'direct' | 'stripe';
    canActivateDirectly: boolean;
    canCheckoutMonthly: boolean; 
    canCheckoutAnnual: boolean; 
    checkoutStatus: string;
    checkoutMessage: string;
    isEnterprise: boolean;
    limits: { channels: number; contacts: number; aiTokensPerMonth: number; storageMb: number; };
    flags: Record<string, boolean>;
}

const getOrgId = () => localStorage.getItem('wabee_orgId') || '';
const getOrgHeaders = () => ({ 'X-Org-Id': getOrgId() });

// ─── ResourceBar ─────────────────────────────────────────────────────────────
const ResourceBar = ({ label, used, total, icon: Icon, accentClass = 'bg-[var(--brand-primary)]' }: any) => {
    const isUnlimited = total === -1;
    const percent = isUnlimited ? 0 : (total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0);
    const isDanger  = !isUnlimited && percent >= 90;
    const isWarning = !isUnlimited && percent >= 70 && !isDanger;

    return (
        <div className="bg-[var(--bg-page)] border border-[var(--border-default)] rounded-[2rem] p-6 hover:border-[var(--brand-primary)]/30 transition-all group relative overflow-hidden">
            {/* Glow decorativo */}
            <div className="absolute top-0 right-0 w-20 h-20 bg-[var(--brand-primary)]/[0.03] blur-[30px] rounded-full pointer-events-none" />

            {/* Encabezado */}
            <div className="flex items-center justify-between mb-5 relative">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[var(--brand-primary)]/8 flex items-center justify-center text-[var(--brand-primary)] group-hover:scale-110 transition-transform duration-300">
                        <Icon size={20} />
                    </div>
                    <div>
                        <p className={`${T.labelText} ${S.meta} tracking-[3px]`}>{label}</p>
                        <p className={`${T.sectionTitle} ${S.body} mt-0.5`}>
                            {used.toLocaleString()}
                            <span className={`${T.helperText} ${S.meta} ml-1`}>
                                / {isUnlimited ? 'Ilimitado' : total.toLocaleString()}
                            </span>
                        </p>
                    </div>
                </div>
                <p className={`${T.kpiValue} ${S.displaySm} ${
                    isUnlimited ? 'text-[var(--brand-primary)]'
                    : isDanger ? 'text-[var(--state-danger)]'
                    : isWarning ? 'text-[var(--state-warning)]'
                    : 'text-[var(--brand-primary)]'
                }`}>
                    {isUnlimited ? '∞' : `${percent}%`}
                </p>
            </div>

            {/* Barra de progreso */}
            {!isUnlimited && (
                <div className="h-2 bg-[var(--bg-card)] rounded-full overflow-hidden border border-[var(--border-default)]">
                    <div
                        className={`h-full rounded-full transition-all duration-1000 ease-out ${
                            isDanger  ? 'bg-[var(--state-danger)]'
                            : isWarning ? 'bg-[var(--state-warning)]'
                            : accentClass
                        }`}
                        style={{ width: `${percent}%` }}
                    />
                </div>
            )}
            {isUnlimited && (
                <div className="h-2 bg-[var(--bg-card)] rounded-full overflow-hidden border border-[var(--border-default)] relative">
                    <div className={`h-full w-full opacity-20 ${accentClass}`} />
                </div>
            )}
        </div>
    );
};

// ─── Modal de Planes (Upgrade) ────────────────────────────────────────────────
const UpgradeModal = ({ plans, onClose, onSelect, isLoading, activePlan, currentLimits }: {
    plans: PublicPlan[]; onClose: () => void;
    onSelect: (planId: string, period: 'monthly' | 'annual') => void;
    isLoading: boolean;
    activePlan: PlanData | null;
    currentLimits?: PlanLimits;
}) => {
    const [selectedPeriod, setSelectedPeriod] = useState<'monthly' | 'annual'>('monthly');

    // El plan gratuito/trial SIEMPRE se muestra como primera tarjeta (nivel base de referencia).
    // Si el usuario está en trial/gratuito → badge "PLAN ACTUAL"; si tiene plan de pago → solo comparación.
    const isOnFreePlan = !!(activePlan?.isTrial ||
        activePlan?.code === 'FREE' ||
        activePlan?.code === 'TRIAL');

    const freePlanCard: PublicPlan = {
        id:   isOnFreePlan ? (activePlan?.id   || 'free') : 'free',
        code: isOnFreePlan ? (activePlan?.code || 'FREE') : 'FREE',
        name: 'Prueba Gratuita',
        monthlyPrice: 0,
        annualPrice:  0,
        currency: 'MXN',
        period:   'monthly',
        activationMode:     'direct' as const,
        canActivateDirectly: false,   // Nunca activo desde el modal para evitar downgrade accidental
        canCheckoutMonthly:  false,
        canCheckoutAnnual:   false,
        checkoutStatus:  isOnFreePlan ? 'current' : 'free',
        checkoutMessage: isOnFreePlan ? 'Plan activo actualmente' : 'Plan base de referencia',
        isEnterprise: false,
        limits: {
            channels:         isOnFreePlan ? (currentLimits?.channels         ?? 1)   : 1,
            contacts:         isOnFreePlan ? (currentLimits?.contacts         ?? 500)  : 500,
            aiTokensPerMonth: isOnFreePlan ? (currentLimits?.aiTokensPerMonth ?? 0)   : 0,
            storageMb:        isOnFreePlan ? (currentLimits?.storageMb        ?? 512)  : 512,
        },
        flags: {},
    };

    // Filtrar FREE/TRIAL del API por si acaso el backend los devolviera
    const paidPlans = plans.filter(p => {
        const c = (p.code || '').toUpperCase();
        return c !== 'FREE' && c !== 'TRIAL';
    });

    // Orden fijo: [Gratuito, ...planesDePago]
    const allPlans = [freePlanCard, ...paidPlans];
    const modalContent = (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-start justify-center p-4 overflow-y-auto animate-in fade-in duration-300">
            <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[3rem] max-w-5xl w-full shadow-2xl my-8 relative overflow-hidden">
                <div className="absolute -top-40 -left-40 w-96 h-96 bg-[var(--brand-primary)]/[0.04] blur-[150px] rounded-full pointer-events-none" />

                {/* Header del modal */}
                <div className="flex items-center justify-between p-4 sm:p-6 border-b border-[var(--border-default)] relative">
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-[var(--brand-primary)]/10 flex items-center justify-center shadow-inner">
                            <Sparkles className="text-[var(--brand-primary)]" size={28} />
                        </div>
                        <div>
                            <h2 className={`${T.sectionTitle} ${S.headingLg}`}>
                                Eleva tu <span className="text-[var(--ty-accent)]">Estrategia</span>
                            </h2>
                            <p className={`${T.helperText} ${S.body}`}>
                                Escala tus límites y desbloquea el poder total de WABEE.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-12 h-12 rounded-full border border-[var(--border-default)] flex items-center justify-center text-[var(--ty-dimmed)] hover:text-[var(--ty-strong)] hover:border-[var(--brand-primary)]/30 transition-all"
                    >
                        <XCircle size={24} />
                    </button>
                </div>

                {/* Panel de Límites Removido por solicitud del usuario */}

                {/* Toggle Mensual / Anual */}
                <div className="flex justify-center pt-8 pb-2">
                    <div className="flex bg-[var(--bg-page)] border border-[var(--border-default)] rounded-2xl p-1.5">
                        <button
                            onClick={() => setSelectedPeriod('monthly')}
                            className={`px-8 py-3 rounded-xl ${S.meta} font-bold uppercase tracking-widest transition-all ${
                                selectedPeriod === 'monthly'
                                    ? 'bg-[var(--brand-primary)]  shadow-lg'
                                    : 'text-[var(--ty-dimmed)] hover:text-[var(--ty-strong)]'
                            }`}
                        >
                            Mensual
                        </button>
                        <button
                            onClick={() => setSelectedPeriod('annual')}
                            className={`px-8 py-3 rounded-xl ${S.meta} font-bold uppercase tracking-widest transition-all flex items-center gap-3 ${
                                selectedPeriod === 'annual'
                                    ? 'bg-[var(--brand-primary)]  shadow-lg'
                                    : 'text-[var(--ty-dimmed)] hover:text-[var(--ty-strong)]'
                            }`}
                        >
                            Anual
                        </button>
                    </div>
                </div>

                {/* Cards de planes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 p-4 sm:p-6 pt-4">
                    {allPlans.length === 0 && !isLoading ? (
                        <div className="col-span-3 text-center py-20 border-2 border-dashed border-[var(--border-default)] rounded-[2rem]">
                            <Sparkles className="mx-auto text-[var(--ty-dimmed)] mb-4" size={40} />
                            <p className={`${T.helperText} ${S.body} uppercase tracking-widest`}>Sin planes disponibles</p>
                        </div>
                    ) : allPlans.filter(p => !p.isEnterprise).map((plan) => {
                        const isCurrentPlan = plan.code === activePlan?.code;
                        const displayPrice  = selectedPeriod === 'annual' ? plan.annualPrice : plan.monthlyPrice;

                        const isAvailable = (selectedPeriod === 'monthly' ? plan.canCheckoutMonthly : plan.canCheckoutAnnual);

                        // Si el plan permite activación directa (gratis), ignorar flags de checkout
                        const canProceed = plan.activationMode === 'direct' ? plan.canActivateDirectly : isAvailable;

                        const isFeatured = plan.code === 'PRO_V2';

                        return (
                            <div
                                key={plan.id}
                                className={`relative border rounded-[2.5rem] p-6 flex flex-col transition-all duration-500 group ${
                                    isCurrentPlan
                                        ? 'border-[var(--state-success)] bg-[var(--state-success)]/5 shadow-[0_20px_60px_color-mix(in_srgb,var(--state-success),transparent_85%)]'
                                        : isFeatured
                                            ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5 shadow-[0_20px_60px_color-mix(in_srgb,var(--brand-primary),transparent_85%)]'
                                            : 'border-[var(--border-default)] bg-[var(--bg-page)] hover:border-[var(--brand-primary)]/30 hover:scale-[1.02]'
                                }`}
                            >
                                {/* Badge "Plan Actual" */}
                                {isCurrentPlan && (
                                    <div className={`absolute -top-4 left-1/2 -translate-x-1/2 px-5 py-1.5 bg-[var(--state-success)] text-white ${S.meta} font-bold uppercase tracking-[0.2em] rounded-full flex items-center gap-2 shadow-xl z-10`}>
                                        <CheckCircle2 size={12} /> Plan Actual
                                    </div>
                                )}
                                {/* Badge "Recomendado" solo si NO es el plan actual */}
                                {!isCurrentPlan && isFeatured && (
                                    <div className={`absolute -top-4 left-1/2 -translate-x-1/2 px-5 py-1.5 bg-[var(--brand-primary)]  ${S.meta} font-bold uppercase tracking-[0.2em] rounded-full flex items-center gap-2 shadow-xl z-10`}>
                                        <Star size={12} /> Recomendado
                                    </div>
                                )}

                                {/* Nombre y precio */}
                                <div className="mb-4">
                                    <p className={`${T.labelText} ${S.meta} tracking-[4px] mb-3 transition-colors ${isCurrentPlan ? 'text-[var(--state-success)]' : 'group-hover:text-[var(--brand-primary)]'}`}>
                                        {plan.name}
                                    </p>
                                    {plan.isEnterprise ? (
                                        <div>
                                            <p className={`${T.pageTitle} ${S.displaySm}`}>Custom</p>
                                            <p className={`${T.helperText} ${S.body} opacity-50`}>Solución a medida</p>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex items-end gap-2 text-[var(--ty-strong)]">
                                                <p className={`${T.pageTitle} ${S.displayMd}`}>
                                                    <span className="text-2xl mr-1">$</span>
                                                    {displayPrice}
                                                </p>
                                                <div className="flex flex-col mb-2">
                                                    <p className={`${T.helperText} ${S.meta} uppercase leading-tight font-bold`}>{plan.currency}</p>
                                                    <p className={`${T.helperText} ${S.meta} uppercase leading-tight opacity-50`}>/ {selectedPeriod === 'annual' ? 'año' : 'mes'}</p>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Lista de características */}
                                <div className="space-y-1.5 mb-6 flex-1 pt-4 border-t border-[var(--border-default)]">
                                    {[
                                        plan.limits.channels > 0 && `${plan.limits.channels} Canal${plan.limits.channels !== 1 ? 'es' : ''}`,
                                        plan.limits.contacts > 0 && `${plan.limits.contacts.toLocaleString()} Contactos`,
                                        plan.limits.aiTokensPerMonth > 0 && `${(plan.limits.aiTokensPerMonth / 1000).toLocaleString()}K Créditos IA`,
                                        plan.limits.storageMb > 0 && `${plan.limits.storageMb >= 1000 ? `${plan.limits.storageMb / 1000} GB` : `${plan.limits.storageMb} MB`} Disco`,
                                        plan.flags?.crm_integrations && 'CRM Integraciones',
                                        plan.flags?.marketplace_access && 'Acceso Marketplace',
                                    ].filter(Boolean).map((item, i) => (
                                        <div key={i} className="flex items-center gap-3">
                                            <CheckCircle2 size={15} className={`${isCurrentPlan ? 'text-[var(--state-success)]' : 'text-[var(--brand-primary)]'} shrink-0`} />
                                            <p className={`${T.helperText} ${S.meta} font-bold uppercase tracking-widest`}>{item}</p>
                                        </div>
                                    ))}
                                    {/* Fallback cuando el plan actual sintético no tiene límites (ej: trial sin datos de límites) */}
                                    {isCurrentPlan && plan.limits.channels === 0 && plan.limits.contacts === 0 && plan.limits.aiTokensPerMonth === 0 && (
                                        <p className={`${T.helperText} ${S.meta} opacity-60 italic`}>Acceso de prueba activo</p>
                                    )}
                                </div>

                                {/* CTA */}
                                {plan.isEnterprise ? (
                                    <a
                                        href="mailto:ventas@wabee.app"
                                        className={`w-full py-4 border-2 border-[var(--brand-primary)]/30 text-[var(--brand-primary)] rounded-[1.5rem] ${T.buttonPrimaryText} ${S.body} group-hover:bg-[var(--brand-primary)] group-hover: transition-all flex items-center justify-center gap-3`}
                                    >
                                        <Phone size={18} /> Contactar
                                    </a>
                                ) : (
                                    <div className="space-y-3">
                                        <button
                                            onClick={() => { if (!isCurrentPlan) onSelect(plan.code, selectedPeriod); }}
                                            disabled={isLoading || isCurrentPlan || (!isCurrentPlan && !canProceed)}
                                            className={`w-full py-4 rounded-[1.5rem] ${T.buttonPrimaryText} ${S.body} transition-all flex items-center justify-center gap-3 shadow-xl border ${
                                                isCurrentPlan
                                                    ? 'bg-[var(--state-success)]/10 border-[var(--state-success)]/20 text-[var(--state-success)] cursor-default opacity-100'
                                                    : 'bg-[var(--brand-primary)] hover:scale-[1.02] active:scale-[0.98] border-[var(--brand-primary)] disabled:opacity-40 disabled:grayscale'
                                            }`}
                                        >
                                            {isLoading && !isCurrentPlan
                                                ? <Loader2 size={20} className="animate-spin" />
                                                : isCurrentPlan
                                                    ? <><CheckCircle2 size={20} /> Plan Actual</>
                                                    : plan.activationMode === 'direct'
                                                        ? (canProceed
                                                            ? <><Zap size={20} /> Activar Gratis</>
                                                            : <><Zap size={20} /> Plan Base</>)
                                                        : <><ArrowUpRight size={20} /> Suscribirse</>
                                            }
                                        </button>
                                        {!isCurrentPlan && !canProceed && !isLoading && plan.activationMode !== 'direct' && (
                                            <p className="text-[10px] text-[var(--state-danger)] text-center font-bold uppercase tracking-tighter opacity-80">
                                                {plan.checkoutMessage || 'No disponible por el momento'}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};

// ─── Modal de Cancelación ─────────────────────────────────────────────────────
const CancelModal = ({ onConfirm, onClose, isLoading }: any) => {
    const modalContent = (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-[var(--bg-page)] border border-[var(--state-danger)]/20 rounded-[3rem] p-10 sm:p-14 max-w-xl w-full shadow-2xl text-center relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-[var(--state-danger)]/[0.04] blur-[80px] rounded-full pointer-events-none" />

            <div className="w-20 h-20 rounded-[2rem] bg-[var(--state-danger)]/10 flex items-center justify-center mb-8 mx-auto shadow-inner">
                <AlertTriangle className="text-[var(--state-danger)]" size={40} />
            </div>

            <h3 className={`${T.sectionTitle} ${S.headingLg} mb-4`}>
                ¿Finalizar <span className="text-[var(--state-danger)]">Suscripción</span>?
            </h3>
            <p className={`${T.helperText} ${S.body} mb-12 opacity-60`}>
                Tu plan seguirá activo hasta el final del periodo de facturación actual. Al terminar, perderás el acceso a las funciones premium y límites extendidos.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
                <button
                    onClick={onClose}
                    className={`flex-1 py-4 border border-[var(--border-default)] rounded-[1.5rem] ${T.buttonText} ${S.body} text-[var(--ty-dimmed)] hover:text-[var(--ty-strong)] hover:border-[var(--brand-primary)]/30 transition-all`}
                >
                    Mantener Plan
                </button>
                <button
                    onClick={onConfirm}
                    disabled={isLoading}
                    className={`flex-1 py-4 bg-[var(--state-danger)]/10 border border-[var(--state-danger)]/20 text-[var(--state-danger)] rounded-[1.5rem] ${T.buttonText} ${S.body} hover:bg-[var(--state-danger)] hover:text-white transition-all disabled:opacity-50 flex items-center justify-center gap-3`}
                >
                    {isLoading ? <Loader2 size={20} className="animate-spin" /> : <XCircle size={20} />}
                    {isLoading ? 'Cancelando...' : 'Confirmar'}
                </button>
            </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export const SettingsPlanPage = () => {
    const orgId = getOrgId();
    const queryClient = useQueryClient();
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [showCancelModal, setShowCancelModal]   = useState(false);

    React.useEffect(() => {
        if (showUpgradeModal) refetchPlans();
    }, [showUpgradeModal]);

    type CheckoutState = 'idle' | 'checkout_canceled' | 'activation_pending' | 'activation_success' | 'activation_timeout' | 'activation_error';
    const [checkoutState, setCheckoutState] = useState<CheckoutState>('idle');
    const [pollCount, setPollCount] = useState(0);

    // ─── Queries ────────────────────────────────────────────────────────────
    const { data: summary, isLoading, refetch } = useQuery<BillingSummary>({
        queryKey: ['billing', 'summary', orgId],
        queryFn: async () => { 
            const { data } = await client.get('/billing/summary', { headers: getOrgHeaders() }); 
            // AUDITORÍA DE CONSISTENCIA (V4)
            console.log("SUMMARY LIMITS", data?.limits);
            return data; 
        },
        enabled: !!orgId, staleTime: 0,
    });

    const { data: plansData, isLoading: loadingPlans, refetch: refetchPlans } = useQuery({
        queryKey: ['billing', 'plans'],
        queryFn: async () => { const { data } = await client.get('/billing/plans', { headers: getOrgHeaders() }); return data; },
        enabled: showUpgradeModal, staleTime: 5_000,
    });

    const { data: invoicesData, isLoading: loadingInvoices, refetch: refetchInvoices } = useQuery({
        queryKey: ['billing', 'invoices', orgId],
        queryFn: async () => { const { data } = await client.get('/billing/invoices?limit=10', { headers: getOrgHeaders() }); return data; },
        enabled: !!orgId, staleTime: 0,
    });

    const handleManualRetry = () => {
        setCheckoutState('activation_pending');
        setPollCount(0);
        queryClient.invalidateQueries({ queryKey: ['billing', 'summary', orgId] });
        queryClient.invalidateQueries({ queryKey: ['billing', 'invoices', orgId] });
        refetch();
        refetchInvoices();
    };

    React.useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const stCheckout = params.get('checkout');
        
        if (stCheckout === 'cancel') {
            setCheckoutState('checkout_canceled');
            window.history.replaceState({}, document.title, window.location.pathname);
            return;
        }

        if (stCheckout === 'success') {
            const expPlan = params.get('expPlan');
            const expPeriod = params.get('expPeriod');
            const oldSubId = params.get('oldSubId');
            const oldRenewsAt = params.get('oldRenewsAt');

            if (checkoutState === 'idle') {
                setCheckoutState('activation_pending');
                setPollCount(0);
            }

            // Polling Logica
            if (checkoutState === 'activation_pending') {
                const preStr = sessionStorage.getItem(`wb_billing_pre_${orgId}`);
                const pre = preStr ? JSON.parse(preStr) : null;
                
                // Fallbacks de URL si sessionStorage falla (Blindaje extra)
                const fallbackId = params.get('oldSubId');
                const fallbackRenewsAt = params.get('oldRenewsAt');

                const norm = (p: string | undefined) => (p === 'year' || p === 'annual') ? 'annual' : 'monthly';
                
                const currentPlan = summary?.plan?.code;
                const currentPeriod = norm(summary?.plan?.period);
                const targetPlan = expPlan;
                const targetPeriod = norm(expPeriod || undefined);

                const isPlanMatch = currentPlan === targetPlan && currentPeriod === targetPeriod;
                
                // Identidad antigua (lo que queremos que CAMBIE)
                const oldId = pre?.id || fallbackId;
                const oldRenewsAt = pre?.renewsAt || fallbackRenewsAt;

                const isNewIdentity = oldId && summary?.plan?.id && summary.plan.id !== oldId;
                const isNewDate = oldRenewsAt && summary?.plan?.renewsAt && summary.plan.renewsAt !== oldRenewsAt;
                
                // Si no tenemos NINGUNA referencia vieja (ej. primera compra), confiamos sólo en el match y no fallback
                const identityChanged = (oldId || oldRenewsAt) ? (isNewIdentity || isNewDate) : true;
                const isNotFallback = summary?.plan?.id && summary?.plan?.name !== 'Plan activo';

                console.log('[Billing Auth Debug]', {
                    pollCount,
                    match: { isPlanMatch, isNewIdentity, isNewDate, identityChanged, isNotFallback },
                    current: { code: currentPlan, period: currentPeriod, id: summary?.plan?.id },
                    target: { code: targetPlan, period: targetPeriod },
                    oldRef: { id: oldId, renewsAt: oldRenewsAt }
                });

                if (isPlanMatch && identityChanged && isNotFallback) {
                    console.log('[Billing] ✅ Éxito confirmado. Cerrando banner.');
                    setCheckoutState('activation_success');
                    sessionStorage.removeItem(`wb_billing_pre_${orgId}`);
                    // Limpieza total del URL
                    window.history.replaceState({}, document.title, window.location.pathname);
                    queryClient.invalidateQueries({ queryKey: ['billing', 'summary', orgId] });
                    queryClient.invalidateQueries({ queryKey: ['billing', 'invoices', orgId] });
                    return;
                }

                if (pollCount >= 15) { 
                    setCheckoutState('activation_timeout');
                    return;
                }

                const timer = setTimeout(() => {
                    setPollCount(prev => prev + 1);
                    refetch();
                    refetchInvoices();
                }, 2000);

                return () => clearTimeout(timer);
            }
        }
    }, [checkoutState, pollCount, summary, refetch, refetchInvoices, queryClient, orgId]);

    // ─── Mutations ──────────────────────────────────────────────────────────
    const subscribeMutation = useMutation({
        mutationFn: async ({ planCode, period }: { planCode: string; period: 'monthly' | 'annual' }) => {
            // CAPTURAR SNAPSHOT PRE-CHECKOUT (Blindaje V3)
            const snapshot = {
                id: summary?.plan?.id,
                renewsAt: summary?.plan?.renewsAt,
                planCode: summary?.plan?.code,
                period: summary?.plan?.period,
                timestamp: Date.now()
            };
            sessionStorage.setItem(`wb_billing_pre_${orgId}`, JSON.stringify(snapshot));

            const successUrl = `${window.location.origin}${window.location.pathname}?checkout=success&expPlan=${planCode}&expPeriod=${period}&oldSubId=${snapshot.id || ''}&oldRenewsAt=${snapshot.renewsAt || ''}`;
            const cancelUrl  = `${window.location.origin}${window.location.pathname}?checkout=cancel`;
            
            const { data } = await client.post('/billing/subscribe', { 
                planTemplateCode: planCode, 
                period, 
                successUrl, 
                cancelUrl,
            }, { headers: getOrgHeaders() });
            return data;
        },
        onSuccess: (res) => {
            if (res.mode === 'direct') {
                // Plan gratuito: activación inmediata
                setShowUpgradeModal(false);
                setCheckoutState('activation_success');
                queryClient.invalidateQueries({ queryKey: ['billing', 'summary', orgId] });
                setTimeout(() => refetch(), 300); // forzar refetch inmediato
            } else if (res.url) {
                // Plan pagado: redirigir a Stripe Checkout
                setShowUpgradeModal(false);
                setTimeout(() => { window.location.href = res.url; }, 600);
            }
        },
        onError: (err: any) => {
            setShowUpgradeModal(false);
            setCheckoutState('activation_error');
        }
    });

    const manageSubscriptionMutation = useMutation({
        mutationFn: async () => {
            const { data } = await client.post('/billing/portal-session', {}, { headers: getOrgHeaders() });
            return data;
        },
        onSuccess: (res) => {
            if (res.url) {
                window.location.href = res.url;
            }
        },
        onError: (err: any) => {
            console.error('Error opening portal:', err.message);
            alert('No se pudo abrir el portal de gestión. Asegúrate de tener una suscripción activa.');
        }
    });

    const cancelMutation = useMutation({
        mutationFn: async () => {
            const { data } = await client.post('/billing/cancel', { mode: 'end_of_period' }, { headers: getOrgHeaders() });
            return data;
        },
        onSuccess: () => {
            setShowCancelModal(false);
            setCheckoutState('activation_success'); // Reusa el estado de éxito visualmente
            queryClient.invalidateQueries({ queryKey: ['billing', 'summary', orgId] });
        },
        onError: (err: any) => {
            setShowCancelModal(false);
            setCheckoutState('activation_error');
        }
    });

    // ─── Loading ─────────────────────────────────────────────────────────────
    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[50vh]">
                <Loader2 className="animate-spin text-[var(--brand-primary)]" size={40} />
            </div>
        );
    }

    const { plan: activePlan, limits: rawLimits, usage, actions } = summary || {} as any;
    const limits = normalizeLimits(activePlan?.code, rawLimits);
    const invoices     = invoicesData?.items || [];
    const publicPlans: PublicPlan[] = plansData?.plans || [];

    const renewsAtDate = activePlan?.renewsAt
        ? new Date(activePlan.renewsAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
        : '—';

    const statusConfig: Record<string, { label: string; classes: string }> = {
        ACTIVE:       { label: 'Activa',          classes: 'text-[var(--state-success)] bg-[var(--state-success)]/10 border-[var(--state-success)]/20' },
        TRIAL_ACTIVE: { label: 'Trial',            classes: 'text-[var(--state-info)] bg-[var(--state-info)]/10 border-[var(--state-info)]/20' },
        PAST_DUE:     { label: 'Pago Pendiente',   classes: 'text-[var(--state-warning)] bg-[var(--state-warning)]/10 border-[var(--state-warning)]/20' },
        CANCELED:     { label: 'Cancelada',        classes: 'text-[var(--state-danger)] bg-[var(--state-danger)]/10 border-[var(--state-danger)]/20' },
    };
    const currentStatus = statusConfig[activePlan?.status] || { label: activePlan?.status, classes: 'text-[var(--ty-muted)] bg-[var(--bg-card)] border-[var(--border-default)]' };

    const CheckoutStatusBanner = () => {
        if (checkoutState === 'idle') return null;
        
        const banners = {
            checkout_canceled: {
                icon: AlertTriangle,
                bg: 'bg-[var(--state-warning)]/10',
                border: 'border-[var(--state-warning)]/20',
                text: 'text-[var(--state-warning)]',
                msg: 'Has cancelado el proceso de pago. No se han realizado cargos.'
            },
            activation_pending: {
                icon: Loader2,
                spin: true,
                bg: 'bg-[var(--brand-primary)]/10',
                border: 'border-[var(--brand-primary)]/20',
                text: 'text-[var(--brand-primary)]',
                msg: 'Pago recibido. Confirmando suscripción en la base de datos...'
            },
            activation_success: {
                icon: CheckCircle2,
                bg: 'bg-[var(--state-success)]/10',
                border: 'border-[var(--state-success)]/20',
                text: 'text-[var(--state-success)]',
                msg: '¡Tu suscripción ha sido actualizada exitosamente!'
            },
            activation_timeout: {
                icon: AlertTriangle,
                bg: 'bg-[var(--state-warning)]/10',
                border: 'border-[var(--state-warning)]/20',
                text: 'text-[var(--state-warning)]',
                msg: 'El pago se completó, pero la activación está tardando más de lo esperado en reflejarse.'
            },
            activation_error: {
                icon: XCircle,
                bg: 'bg-[var(--state-danger)]/10',
                border: 'border-[var(--state-danger)]/20',
                text: 'text-[var(--state-danger)]',
                msg: 'Ocurrió un error al procesar la actualización. Por favor contacta soporte.'
            }
        };

        const config = banners[checkoutState];
        const Icon = config.icon;

        return (
            <div className={`p-4 rounded-[1.5rem] border ${config.bg} ${config.border} flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all animate-in fade-in slide-in-from-top-4 mb-8`}>
                <div className="flex items-center gap-3">
                    <Icon size={24} className={`${config.text} ${(config as any).spin ? 'animate-spin' : ''}`} />
                    <span className={`${config.text} ${S.body}`}>{config.msg}</span>
                </div>
                
                {checkoutState === 'activation_timeout' && (
                    <button 
                        onClick={handleManualRetry}
                        className={`px-4 py-2 bg-white/5 border border-white/10 text-[var(--ty-strong)] rounded-[1rem] ${T.buttonText} hover:bg-white/10 transition-colors flex items-center gap-2`}
                    >
                        <RefreshCcw size={16} />
                        Reintentar
                    </button>
                )}
                
                {(checkoutState === 'checkout_canceled' || checkoutState === 'activation_error' || checkoutState === 'activation_success') && (
                    <button onClick={() => setCheckoutState('idle')} className="text-white/40 hover:text-white">
                        <XCircle size={20} />
                    </button>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-24 md:pb-20">

            {/* ── Modals ── */}
            {showUpgradeModal && (
                <UpgradeModal
                    plans={loadingPlans ? [] : publicPlans}
                    onClose={() => setShowUpgradeModal(false)}
                    onSelect={(planCode, period) => subscribeMutation.mutate({ planCode, period })}
                    isLoading={subscribeMutation.isPending}
                    activePlan={activePlan}
                    currentLimits={limits}
                />
            )}
            {showCancelModal && (
                <CancelModal
                    onConfirm={() => cancelMutation.mutate()}
                    onClose={() => setShowCancelModal(false)}
                    isLoading={cancelMutation.isPending}
                />
            )}

            {/* ── Banner de Trial ── */}
            {activePlan?.isTrial && (
                <div className="relative overflow-hidden bg-[var(--state-info)]/10 border border-[var(--state-info)]/20 rounded-[2rem] md:rounded-[2.5rem] p-5 md:p-8 shadow-xl animate-in slide-in-from-top-4 duration-700">
                    <div className="absolute -top-20 -right-20 w-60 h-60 bg-[var(--state-info)]/[0.05] blur-[80px] rounded-full pointer-events-none" />
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 md:gap-8 relative">
                        <div className="flex items-start sm:items-center gap-4 md:gap-5">
                            <div className="w-12 h-12 md:w-14 md:h-14 rounded-[1.25rem] md:rounded-[1.5rem] bg-[var(--state-info)]/15 border border-[var(--state-info)]/20 flex items-center justify-center text-[var(--state-info)]">
                                <Clock className="animate-pulse" size={28} />
                            </div>
                            <div>
                                <p className={`${T.sectionTitle} ${S.headingMd} text-[var(--state-info)] mb-1`}>
                                    {activePlan.trialDaysRemaining !== null
                                        ? activePlan.trialDaysRemaining > 0
                                            ? `Prueba Premium — ${activePlan.trialDaysRemaining} días restantes`
                                            : 'Tu prueba ha finalizado'
                                        : 'Modo de Prueba Activo'}
                                </p>
                                <p className={`${T.helperText} ${S.body} opacity-70`}>
                                    No pierdas el acceso a tus herramientas de IA y canales avanzados.
                                </p>
                            </div>
                        </div>
                        {actions?.canUpgrade && (
                            <button
                                onClick={() => setShowUpgradeModal(true)}
                                className={`w-full sm:w-auto justify-center px-6 md:px-8 py-3.5 md:py-4 bg-[var(--state-info)] text-white rounded-[1.25rem] md:rounded-[1.5rem] ${T.buttonText} ${S.body} hover:scale-[1.02] transition-all flex items-center gap-3 shrink-0 shadow-xl`}
                            >
                                <TrendingUp size={18} /> Convertir a Pro
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* ── Header de Página ── */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 md:gap-6">
                <div>
                    <h1 className={`${T.pageTitle} ${S.displayMd}`}>
                        Plan & <span className="text-[var(--ty-accent)]">Facturación</span>
                    </h1>
                    <p className={`${T.pageSubtitle} ${S.body}`}>
                        Administra tu nivel de servicio y consulta el consumo de recursos.
                    </p>
                </div>
                <div className="flex w-full sm:w-auto items-center justify-end gap-3">
                    {/* Refrescar */}
                    <button
                        onClick={() => refetch()}
                        title="Actualizar datos"
                        className="w-11 h-11 flex items-center justify-center border border-[var(--border-default)] rounded-xl text-[var(--ty-dimmed)] hover:text-[var(--brand-primary)] hover:border-[var(--brand-primary)]/30 transition-all group"
                    >
                        <RefreshCcw size={18} className="group-hover:rotate-180 transition-transform duration-700" />
                    </button>
                    {/* Cancelar suscripción */}
                    {actions?.canCancel && (
                        <button
                            onClick={() => setShowCancelModal(true)}
                            className={`px-6 py-3 border border-[var(--state-danger)]/20 text-[var(--state-danger)] rounded-[1.25rem] ${T.buttonText} ${S.body} hover:bg-[var(--state-danger)]/10 transition-all`}
                        >
                            Finalizar
                        </button>
                    )}
                    {/* Upgrade */}
                    {actions?.canUpgrade && (
                        <button
                            onClick={() => setShowUpgradeModal(true)}
                            className={`px-8 py-3 bg-[var(--brand-primary)] rounded-[1.25rem] ${T.buttonPrimaryText} ${S.body} hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 shadow-lg`}
                        >
                            <ArrowUpRight size={18} /> Mejorar
                        </button>
                    )}
                </div>
            </div>

            {/* ── Banner de Estado Post-Checkout ── */}
            <CheckoutStatusBanner />

            {/* ── Grid Principal ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">

                {/* ── Columna Izquierda: Plan Card ── */}
                <div className="lg:col-span-4 space-y-4 md:space-y-5">

                    {/* Tarjeta del plan actual */}
                    <div className={`rounded-[2rem] md:rounded-[2.5rem] p-5 md:p-8 relative overflow-hidden shadow-2xl ${
                        activePlan?.isTrial
                            ? 'bg-gradient-to-br from-[var(--state-info)]/30 to-[var(--state-info)]/10 border border-[var(--state-info)]/30'
                            : 'bg-gradient-to-br from-[var(--brand-primary)] to-[color-mix(in_srgb,var(--brand-primary),white_15%)]'
                    }`}>
                        {/* Ícono decorativo */}
                        <Zap className="absolute -top-3 -right-3 md:-top-4 md:-right-4 w-24 h-24 md:w-32 md:h-32 opacity-10 rotate-12" />

                        {/* Encabezado */}
                        <div className="flex items-start justify-between gap-3 mb-4 md:mb-5">
                            {/* Etiqueta «Suscripción» — color inverso al fondo de marca */}
                            <p
                                style={{ color: activePlan?.isTrial ? 'var(--ty-muted)' : 'var(--brand-primary-foreground)' }}
                                className={`${S.meta} font-bold uppercase tracking-[3px] md:tracking-[4px] opacity-60`}
                            >
                                Suscripción
                            </p>
                            {/* Badge de estado — contraste especial sobre fondo de marca */}
                            <span
                                className={`${S.meta} shrink-0 font-bold uppercase tracking-widest px-2.5 md:px-3 py-1 rounded-lg border ${
                                    activePlan?.isTrial
                                        ? currentStatus.classes
                                        : 'bg-[var(--brand-primary-foreground)]/15 border-[var(--brand-primary-foreground)]/25 text-[var(--brand-primary-foreground)]'
                                }`}
                            >
                                {currentStatus.label}
                            </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-1">
                            <h2
                                style={{ color: activePlan?.isTrial ? 'var(--ty-strong)' : 'var(--brand-primary-foreground)' }}
                                className={`${S.displayMd} text-[1.7rem] leading-none sm:text-[2.2rem] font-bold italic uppercase tracking-tighter`}
                            >
                                {activePlan?.displayName}
                            </h2>
                            {activePlan?.version && (
                                <span 
                                    className={`${S.meta} px-2 py-0.5 rounded-md border font-bold text-[10px]`}
                                    style={{ 
                                        borderColor: activePlan?.isTrial ? 'var(--state-info)/20' : 'rgba(255,255,255,0.25)',
                                        color: activePlan?.isTrial ? 'var(--state-info)' : 'var(--brand-primary-foreground)'
                                    }}
                                >
                                    V{activePlan.version}
                                </span>
                            )}
                        </div>

                        {/* Subtítulo de facturación */}
                        <p
                            style={{ color: activePlan?.isTrial ? 'var(--ty-muted)' : 'var(--brand-primary-foreground)' }}
                            className={`${S.body} font-bold mb-6 md:mb-8 lowercase opacity-70`}
                        >
                            {activePlan?.isTrial && activePlan?.trialDaysRemaining !== null
                                ? `${activePlan.trialDaysRemaining} días restantes`
                                : `facturación ${activePlan?.period === 'annual' ? 'anual' : 'mensual'}`}
                        </p>

                        {/* Lista de características incluidas */}
                        <div
                            className="space-y-3 pt-4 md:pt-6 mt-2"
                            style={{
                                borderTop: `1px solid ${activePlan?.isTrial ? 'color-mix(in srgb, var(--state-info), transparent 80%)' : 'color-mix(in srgb, var(--brand-primary-foreground), transparent 85%)'}`
                            }}
                        >
                            {[
                                { label: 'Canal Maestro', value: limits?.channels, pluralSuffix: 'es' },
                                { label: 'Contactos Únicos', value: limits?.contacts, isNumeric: true },
                                { label: 'Créditos IA', value: limits?.aiTokensPerMonth, isK: true },
                            ].map((item, i) => {
                                const value = item.value;
                                const hasValue = value !== null && value !== undefined;
                                const isUnlimited = value === -1;
                                let displayValue = '';
                                
                                if (hasValue) {
                                    if (isUnlimited) displayValue = 'Ilimitado';
                                    else if (item.isK) displayValue = `${(value / 1000).toLocaleString()}K`;
                                    else if (item.isNumeric) displayValue = value.toLocaleString();
                                    else displayValue = `${value} ${item.label}${value !== 1 && item.pluralSuffix ? item.pluralSuffix : ''}`;
                                }

                                return (
                                    <div key={i} className="flex items-center gap-3">
                                        <CheckCircle2
                                            size={16}
                                            style={{
                                                color: activePlan?.isTrial ? 'var(--state-info)' : 'var(--brand-primary-foreground)',
                                                opacity: (activePlan?.isTrial || !hasValue) ? 1 : 0.55
                                            }}
                                            className={!hasValue ? 'opacity-20' : ''}
                                        />
                                        <span
                                            style={{ color: activePlan?.isTrial ? 'var(--ty-strong)' : 'var(--brand-primary-foreground)' }}
                                            className={`${S.meta} font-bold uppercase tracking-[0.15em]`}
                                        >
                                            {hasValue 
                                                ? (isUnlimited ? `${item.label}: ${displayValue}` : (item.isNumeric || item.isK ? `${displayValue} ${item.label}` : displayValue))
                                                : `${item.label}: No disponible`}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* CTA dentro de la card — botones de acción */}
                        {actions?.canUpgrade ? (
                            <div className="flex flex-col gap-3 mt-8">
                                <button
                                    onClick={() => setShowUpgradeModal(true)}
                                    style={{
                                        backgroundColor: activePlan?.isTrial ? 'var(--state-info)' : 'var(--brand-primary-foreground)',
                                        color:           activePlan?.isTrial ? '#ffffff'            : 'var(--brand-primary)'
                                    }}
                                    className={`w-full py-3.5 md:py-4 font-bold uppercase tracking-widest ${S.body} rounded-[1.25rem] md:rounded-[1.5rem] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-xl`}
                                >
                                    <ArrowUpRight size={18} />
                                    {activePlan?.isTrial ? 'Mejorar ahora' : 'Cambiar Plan'}
                                </button>
                                
                                {!activePlan?.isTrial && (
                                    <button
                                        onClick={() => manageSubscriptionMutation.mutate()}
                                        disabled={manageSubscriptionMutation.isPending}
                                        className={`w-full py-3.5 md:py-4 border border-[var(--brand-primary-foreground)]/30 text-[var(--brand-primary-foreground)] font-bold uppercase tracking-widest ${S.body} rounded-[1.25rem] md:rounded-[1.5rem] hover:bg-white/10 transition-all flex items-center justify-center gap-3`}
                                    >
                                        {manageSubscriptionMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <Settings size={18} />}
                                        Gestionar Facturación
                                    </button>
                                )}
                            </div>
                        ) : (
                            <p
                                style={{ color: activePlan?.isTrial ? 'var(--ty-muted)' : 'var(--brand-primary-foreground)' }}
                                className={`${S.meta} text-center mt-8 font-bold uppercase tracking-widest opacity-40`}
                            >
                                Solo administradores
                            </p>
                        )}
                    </div>

                    {/* Tarjeta: Próxima Factura / Vencimiento */}
                    <div className="bg-[var(--bg-page)] border border-[var(--border-default)] rounded-[2rem] md:rounded-[2.5rem] p-5 md:p-8 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-[var(--brand-primary)]/[0.03] blur-[30px] rounded-full pointer-events-none" />
                        <h4 className={`${T.labelText} ${S.meta} tracking-[3px] md:tracking-[4px] mb-4 md:mb-6`}>
                            {activePlan?.cancelAtPeriodEnd ? 'Cancela el' : activePlan?.isTrial ? 'Expira el' : 'Próxima Factura'}
                        </h4>
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <p className={`${T.kpiValue} ${S.displaySm}`}>
                                    {activePlan?.isTrial ? '$0.00' : `$${activePlan?.price || 0}`}
                                </p>
                                {!activePlan?.isTrial && (
                                    <p className={`${T.badgeText} ${S.meta} text-[var(--brand-primary)] mt-1`}>
                                        {activePlan?.currency || 'USD'}
                                    </p>
                                )}
                            </div>
                            <div className="text-left sm:text-right">
                                <p className={`${T.labelText} ${S.meta} opacity-40 mb-1`}>FECHA</p>
                                <p className={`${T.menuText} ${S.body} uppercase tracking-wider`}>{renewsAtDate}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Columna Derecha: Uso de Recursos + Facturas ── */}
                <div className="lg:col-span-8 space-y-6 md:space-y-8">

                    {/* Grid de recursos */}
                    <div>
                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-8 h-8 rounded-lg bg-[var(--brand-primary)]/10 flex items-center justify-center text-[var(--brand-primary)]">
                                <TrendingUp size={16} />
                            </div>
                            <h3 className={`${T.sectionTitle} ${S.headingSm}`}>Uso de Recursos</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            {(() => {
                                const METRIC_CONFIG = [
                                    { key: 'users', label: 'Usuarios', icon: Users, module: 'team' },
                                    { key: 'channels', label: 'Canales', icon: MessageSquare, module: 'channels' },
                                    { key: 'contacts', label: 'Contactos', icon: Users, module: 'contacts', accent: 'bg-[var(--state-info)]' },
                                    { key: 'storageMb', label: 'Disco (MB)', icon: Database, accent: 'bg-[var(--state-danger)]' },
                                    { key: 'aiTokensPerMonth', label: 'Tokens IA', icon: Bot, module: 'aiProfiles', accent: 'bg-purple-500' },
                                    { key: 'aiAgents', label: 'Agentes IA', icon: Bot, module: 'aiProfiles', accent: 'bg-indigo-500' },
                                    { key: 'campaignsPerMonth', label: 'Campañas', icon: Zap, module: 'campaigns', accent: 'bg-orange-500' },
                                ];

                                return METRIC_CONFIG.filter(m => {
                                    // 1. Si tiene módulo asociado, debe estar activo
                                    if (m.module && !summary?.modules?.[m.module]) return false;
                                    // 2. El límite no debe ser null
                                    if (limits?.[m.key as keyof PlanLimits] === null) return false;
                                    return true;
                                }).map(m => (
                                    <ResourceBar
                                        key={m.key}
                                        label={m.label}
                                        used={usage?.[m.key] || 0}
                                        total={limits?.[m.key as keyof PlanLimits] || 0}
                                        icon={m.icon}
                                        accentClass={m.accent}
                                    />
                                ));
                            })()}
                        </div>
                    </div>

                    {/* Historial de Facturas */}
                    <div className="bg-[var(--bg-page)] border border-[var(--border-default)] rounded-[2rem] md:rounded-[3rem] p-5 sm:p-8 md:p-10 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--brand-primary)]/[0.01] blur-[80px] rounded-full pointer-events-none" />

                        {/* Encabezado de sección */}
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 rounded-2xl bg-[var(--brand-primary)]/10 flex items-center justify-center text-[var(--brand-primary)] shadow-inner">
                                <CreditCard size={24} />
                            </div>
                            <div>
                                <h3 className={`${T.sectionTitle} ${S.headingLg}`}>
                                    Historial de <span className="text-[var(--ty-accent)]">Facturación</span>
                                </h3>
                                <p className={`${T.helperText} ${S.body}`}>Accede a tus comprobantes fiscales y recibos.</p>
                            </div>
                        </div>

                        {/* Contenido */}
                        {loadingInvoices ? (
                            <div className="flex justify-center py-10">
                                <Loader2 className="animate-spin text-[var(--brand-primary)]" size={32} />
                            </div>
                        ) : invoices.length === 0 ? (
                            <div className="text-center py-14 border-2 border-dashed border-[var(--border-default)] rounded-[2rem] bg-[var(--bg-card)]/30">
                                <CreditCard className="mx-auto text-[var(--ty-dimmed)] mb-4" size={44} />
                                <p className={`${T.helperText} ${S.body} uppercase tracking-widest`}>Sin registro de pagos</p>
                                <p className={`${T.helperText} ${S.meta} mt-2 opacity-60`}>
                                    Tu historial comenzará después del primer ciclo de facturación.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {/* Cabecera de tabla */}
                                <div className="hidden sm:grid grid-cols-12 gap-4 px-5 pb-2 border-b border-[var(--border-default)]">
                                    <p className={`${T.tableHeader} ${S.meta} col-span-2`}>Doc.</p>
                                    <p className={`${T.tableHeader} ${S.meta} col-span-4`}>Período</p>
                                    <p className={`${T.tableHeader} ${S.meta} col-span-3`}>Estado</p>
                                    <p className={`${T.tableHeader} ${S.meta} col-span-2 text-right`}>Monto</p>
                                    <p className={`${T.tableHeader} ${S.meta} col-span-1`}></p>
                                </div>

                                {/* Filas de facturas */}
                                {invoices.map((inv: any) => (
                                    <div
                                        key={inv.id}
                                        className="grid grid-cols-12 gap-4 items-center p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-default)] group hover:border-[var(--brand-primary)]/30 transition-all duration-300"
                                    >
                                        {/* Ícono PDF */}
                                        <div className="col-span-2">
                                            {inv.invoiceUrl ? (
                                                <a 
                                                    href={inv.invoiceUrl} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="w-10 h-10 rounded-xl bg-[var(--bg-elevated)] flex items-center justify-center text-[var(--ty-dimmed)] group-hover:bg-[var(--brand-primary)] group-hover:text-[var(--brand-primary-foreground)] cursor-pointer transition-all duration-300 font-bold text-[9px] uppercase tracking-tighter"
                                                >
                                                    PDF
                                                </a>
                                            ) : (
                                                <div className="w-10 h-10 rounded-xl bg-[var(--bg-surface)] flex items-center justify-center text-[var(--ty-dimmed)] opacity-30 font-bold text-[9px] uppercase tracking-tighter">
                                                    PDF
                                                </div>
                                            )}
                                        </div>
                                        {/* Período */}
                                        <div className="col-span-4">
                                            <p className={`${T.tableCell} ${S.body} capitalize`}>{inv.month}</p>
                                        </div>
                                        {/* Estado */}
                                        <div className="col-span-3 flex items-center gap-2">
                                            <div className={`w-1.5 h-1.5 rounded-full ${inv.status === 'PAID' ? 'bg-[var(--state-success)]' : 'bg-[var(--state-warning)]'}`} />
                                            <p className={`${T.statusText} ${S.meta} ${inv.status === 'PAID' ? 'text-[var(--state-success)]' : 'text-[var(--state-warning)]'}`}>
                                                {inv.status === 'PAID' ? 'Pagado' : 'Pendiente'}
                                            </p>
                                        </div>
                                        {/* Monto */}
                                        <div className="col-span-2 text-right">
                                            <p className={`${T.kpiValue} ${S.headingSm}`}>${inv.amount.toFixed(2)}</p>
                                            <p className={`${T.labelText} ${S.meta}`}>{inv.currency}</p>
                                        </div>
                                        {/* Enlace */}
                                        <div className="col-span-1 flex justify-end">
                                            {inv.invoiceUrl ? (
                                                <a
                                                    href={inv.invoiceUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="w-10 h-10 rounded-xl bg-[var(--bg-elevated)] flex items-center justify-center text-[var(--ty-dimmed)] hover:bg-[var(--brand-primary)] hover: transition-all duration-300"
                                                >
                                                    <ExternalLink size={16} />
                                                </a>
                                            ) : (
                                                <div className="w-10 h-10 rounded-xl bg-[var(--bg-surface)] flex items-center justify-center text-[var(--ty-dimmed)] opacity-30">
                                                    <ExternalLink size={16} />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
