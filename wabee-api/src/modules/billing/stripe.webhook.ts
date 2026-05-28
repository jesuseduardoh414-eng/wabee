import { Router } from 'express';
import { coreEnv } from '../../config/core/core.env';
import { prisma, corePrisma } from '../../config/core/core.prisma';
import Stripe from 'stripe';
import { BillingService, normalizePeriod } from './billing.service';
import { GlobalAuditLogService } from '../audit/global-audit-log.service';

const router = Router();

// ─── Stripe raw body required for webhook signature verification ─────────────
// This route needs `express.raw` body, not JSON. Must be registered BEFORE express.json()

let _stripe: Stripe | null = null;
const getStripe = (): Stripe => {
    if (!_stripe) {
        if (!coreEnv.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY no configurada.');
        _stripe = new Stripe(coreEnv.STRIPE_SECRET_KEY, { apiVersion: '2025-02-24.acacia' });
    }
    return _stripe;
};

/**
 * Helper para manejar fechas de Stripe de forma segura (Unix Timestamp -> JS Date).
 * Si el timestamp es inválido, retorna la fecha actual como fallback.
 */
const parseStripeDate = (timestamp: number | null | undefined): Date => {
    if (typeof timestamp !== 'number' || isNaN(timestamp)) return new Date();
    return new Date(timestamp * 1000);
};

// ─── syncSubscription ───────────────────────────────────────────────────────
// Sincroniza una Stripe Subscription con la DB.
// Para creación/actualización activas: usa BillingService para snapshot inmutable.
// Para cancelaciones: actualiza estado directamente.
const syncSubscription = async (stripeSub: Stripe.Subscription) => {
    const orgId = stripeSub.metadata?.orgId;
    const planVersionId = stripeSub.metadata?.planVersionId;
    // period guardado en metadata desde billing.routes.ts
    const period = stripeSub.metadata?.period;

    if (!orgId) {
        console.warn('[stripe/webhook] Missing orgId in subscription metadata:', stripeSub.id);
        return;
    }

    const statusMap: Record<string, string> = {
        'active':             'ACTIVE',
        'trialing':           'TRIAL_ACTIVE',
        'past_due':           'PAST_DUE',
        'canceled':           'CANCELED',
        'incomplete':         'INCOMPLETE',
        'incomplete_expired': 'INCOMPLETE_EXPIRED',
        'unpaid':             'UNPAID',
        'paused':             'PAUSED',
    };

    const status = (statusMap[stripeSub.status] || 'ACTIVE') as any;
    const periodStart = parseStripeDate(stripeSub.current_period_start);
    const periodEnd   = parseStripeDate(stripeSub.current_period_end);

    // Activación formal vía BillingService (snapshot inmutable + cierre de subs anteriores)
    if (planVersionId && (status === 'ACTIVE' || status === 'TRIAL_ACTIVE')) {
        const normalizedInt = normalizePeriod(period);
        const alreadyActivated = await corePrisma.subscription.findFirst({
            where: {
                planVersionId: planVersionId,
                billingIntervalSnapshot: normalizedInt,
                status: { in: ['ACTIVE', 'TRIAL_ACTIVE'] }
            }
        });

        if (alreadyActivated) {
            console.log(`[stripe/webhook] Sub ${stripeSub.id} (Version: ${planVersionId}, Interval: ${normalizedInt}) ya existe activa, omitiendo.`);
        } else {
            try {
                await BillingService.activatePlan(orgId, planVersionId, {
                    externalId: stripeSub.id,
                    status,
                    periodStart,
                    periodEnd,
                    period: period as import('./billing.service').BillingPeriod,
                });

                await GlobalAuditLogService.logEvent({
                    category: 'billing',
                    eventType: 'billing.plan.activated',
                    severity: 'success',
                    outcome: 'success',
                    message: `Plan activado vía Stripe Webhook. Suscripción: ${stripeSub.id} (Status: ${status})`,
                    tenantId: orgId,
                    metadata: { stripeSubscriptionId: stripeSub.id, status, planVersionId, period }
                });

                console.log(`[stripe/webhook] Sub ${stripeSub.id} activada vía BillingService (period: ${period || 'default'}).`);
                return;
            } catch (err: any) {
                console.error('[stripe/webhook] Error activando vía BillingService:', err.message);

                await GlobalAuditLogService.logEvent({
                    category: 'billing',
                    eventType: 'billing.plan.activation_failed',
                    severity: 'critical',
                    outcome: 'failure',
                    message: `ERROR al activar plan vía webhook. Sub: ${stripeSub.id}. Error: ${err.message}`,
                    tenantId: orgId,
                    metadata: { stripeSubscriptionId: stripeSub.id, planVersionId, period, error: err.message }
                });
                // Continúa al fallback
            }
        }
    }

    // Fallback: actualizar estado de suscripción existente (cancellations, past_due, etc.)
    const existing = await corePrisma.subscription.findFirst({
        where: { externalIds: { path: ['stripe'], equals: stripeSub.id } } as any,
    });

    if (existing) {
        await corePrisma.subscription.update({
            where: { id: existing.id },
            data: {
                status,
                currentPeriodStart: periodStart,
                currentPeriodEnd:   periodEnd,
                cancelAtPeriodEnd:  stripeSub.cancel_at_period_end,
                ...(stripeSub.canceled_at && { canceledAt: parseStripeDate(stripeSub.canceled_at) }),
                endedAt: status === 'CANCELED' ? new Date() : null,
            },
        });

        await GlobalAuditLogService.logEvent({
            category: 'billing',
            eventType: status === 'CANCELED' ? 'billing.subscription.canceled' : 'billing.subscription.status_changed',
            severity: status === 'CANCELED' ? 'warning' : (status === 'PAST_DUE' || status === 'UNPAID' ? 'critical' : 'info'),
            outcome: 'success',
            message: `Estado de suscripción actualizado a ${status}. Sub Stripe: ${stripeSub.id}`,
            tenantId: orgId,
            metadata: { stripeSubscriptionId: stripeSub.id, status, cancelAtPeriodEnd: stripeSub.cancel_at_period_end }
        });

        console.log(`[stripe/webhook] Sub ${stripeSub.id} actualizada (status: ${status}).`);
    }
};

// ─── syncInvoice ────────────────────────────────────────────────────────────
// Sincroniza una Stripe Invoice con la DB.
// REGLA: la factura se vincula a la suscripción cuyo externalId = stripeInv.subscription
// (no a la más reciente del tenant, para no mezclar historial entre cambios de plan).
const syncInvoice = async (stripeInv: Stripe.Invoice) => {
    // Obtener orgId: primero desde la factura, luego desde la suscripción de Stripe
    let orgId: string | undefined = (stripeInv.metadata || {})?.orgId;

    if (!orgId && stripeInv.subscription) {
        try {
            const stripe = getStripe();
            const stripeSub = await stripe.subscriptions.retrieve(stripeInv.subscription as string);
            orgId = stripeSub.metadata?.orgId;
        } catch (err: any) {
            console.warn('[stripe/webhook] Error recuperando suscripción para orgId:', err.message);
        }
    }

    // Fallback final: por Customer ID (muy robusto) — externalCustomerIds es JSONB
    if (!orgId && stripeInv.customer) {
        try {
            const rows: any[] = await (corePrisma as any).$queryRaw`
                SELECT id FROM core.organizations
                WHERE external_customer_ids->>'stripe' = ${stripeInv.customer as string}
                LIMIT 1
            `;
            orgId = rows[0]?.id;
            if (orgId) console.log(`[stripe/webhook] OrgId encontrado por customerId fallback: ${orgId}`);
        } catch (fbErr: any) {
            console.warn('[stripe/webhook] Error en fallback de customerId:', fbErr.message);
        }
    }

    if (!orgId) {
        console.warn('[stripe/webhook] ❌ Invoice sin orgId ni tenant asociado, omitida:', stripeInv.id);
        return;
    }

    const statusMap: Record<string, string> = {
        'paid':          'PAID',
        'open':          'OPEN',
        'void':          'VOID',
        'draft':         'DRAFT',
        'uncollectible': 'UNCOLLECTIBLE',
    };

    // Buscar la suscripción local por externalId de Stripe (más preciso que findFirst)
    let sub = null;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts && !sub) {
        if (stripeInv.subscription) {
            sub = await corePrisma.subscription.findFirst({
                where: { externalIds: { path: ['stripe'], equals: stripeInv.subscription as string } } as any,
                orderBy: { createdAt: 'desc' },
                select: { id: true },
            });
        }
        
        if (!sub) {
            attempts++;
            if (attempts < maxAttempts) {
                console.log(`[stripe/webhook] ⏳ Invoice ${stripeInv.id} esperando suscripción ${stripeInv.subscription}... (Intento ${attempts}/${maxAttempts})`);
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
        }
    }

    if (!sub) {
        // Fallback final: sub más reciente del tenant (activa o cerrada)
        sub = await corePrisma.subscription.findFirst({
            where: { tenantId: orgId },
            orderBy: { createdAt: 'desc' },
            select: { id: true },
        });
        if (sub) {
            console.log(`[stripe/webhook] ⚠️ Invoice ${stripeInv.id} vinculada por FALLBACK a la sub más reciente: ${sub.id}`);
        }
    }

    if (!sub) {
        console.warn('[stripe/webhook] ❌ Definitivamente no se encontró subscription para invoice:', stripeInv.id);
        return;
    }

    const paymentIntentId = ((stripeInv as any).payment_intent as string) || `inv_${stripeInv.id}`;

    // Buscar si ya existe por externalIds (Referencia única y Acumulativa)
    const existingInvoice = await corePrisma.invoice.findFirst({
        where: { externalIds: { path: ['stripe'], equals: stripeInv.id } } as any,
    });

    const statusToSave = statusMap[stripeInv.status || 'open'] as any;
    const amountToSave = (stripeInv.amount_paid || stripeInv.amount_due) / 100;

    if (existingInvoice) {
        await corePrisma.invoice.update({
            where: { id: existingInvoice.id },
            data: {
                status:     statusToSave,
                invoiceUrl: stripeInv.hosted_invoice_url || null,
                amount:     amountToSave,
            }
        });
        console.log(`[stripe/webhook] Invoice ${stripeInv.id} ACTUALIZADA (sub: ${sub.id}).`);
    } else {
        await corePrisma.invoice.create({
            data: {
                tenantId:       orgId,
                externalIds:    { stripe: stripeInv.id, paymentIntent: paymentIntentId } as any,
                subscriptionId: sub.id,
                amount:         amountToSave,
                currency:       stripeInv.currency || 'usd',
                status:         statusToSave,
                invoiceUrl:     stripeInv.hosted_invoice_url || null,
                periodStart:    parseStripeDate(stripeInv.period_start),
                periodEnd:      parseStripeDate(stripeInv.period_end),
            }
        });
        console.log(`[stripe/webhook] Invoice ${stripeInv.id} CREADA (Nueva Entrada Acumulativa) (sub: ${sub.id}).`);
    }
};

// ─── POST /v1/stripe/webhook ────────────────────────────────────────────────
router.post('/', async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = coreEnv.STRIPE_WEBHOOK_SECRET;

    if (!sig || !webhookSecret) {
        return res.status(400).json({ error: 'Missing signature or webhook secret.' });
    }

    let event: Stripe.Event;
    try {
        const stripe = getStripe();
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
        console.error('[stripe/webhook] Signature verification failed:', err.message);
        await GlobalAuditLogService.logEvent({
            category: 'billing',
            eventType: 'billing.webhook.signature_failed',
            severity: 'critical',
            outcome: 'failure',
            message: `Verificación de firma de Stripe fallida: ${err.message}`,
            metadata: { error: err.message }
        });
        return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }

    console.log(`\n======================================================`);
    console.log(`[stripe/webhook] 📥 EVENTO RAW RECIBIDO: ${event.type}`);
    console.log(`[stripe/webhook] 🔑 ID: ${event.id}`);
    console.log(`======================================================\n`);

    try {
        switch (event.type) {

            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                const orgId         = session.metadata?.orgId || session.client_reference_id;
                const planVersionId = session.metadata?.planVersionId;
                const period        = session.metadata?.period; // ← guardado desde /subscribe
                const customerId    = session.customer as string;

                console.log(`[stripe/webhook] 📦 CHECKOUT SESSION METADATA:`, session.metadata);
                console.log(`[stripe/webhook] 👤 CUSTOMER ID: ${customerId}`);
                console.log(`[stripe/webhook] 🔖 SUBSCRIPTION ID: ${session.subscription}`);

                // 1. Guardar customerId en la org (externalCustomerIds es JSONB { stripe: 'cus_...' })
                if (orgId && customerId) {
                    try {
                        // Merge: preservar otras keys JSONB existentes y añadir/actualizar stripe
                        await (corePrisma as any).$executeRaw`
                            UPDATE core.organizations
                            SET external_customer_ids = COALESCE(external_customer_ids, '{}'::jsonb) || ${JSON.stringify({ stripe: customerId })}::jsonb
                            WHERE id = ${orgId}::uuid
                        `;
                        console.log(`[stripe/webhook] 💾 Actualizado externalCustomerIds.stripe en organización: ${orgId}`);
                    } catch (custErr: any) {
                        console.warn(`[stripe/webhook] ⚠️ No se pudo guardar customerId (no crítico):`, custErr.message);
                    }
                }

                // 2. Activar el plan INMEDIATAMENTE (sin esperar customer.subscription.created)
                // Esto garantiza que cuando el usuario regresa con ?checkout=success el plan ya esté activo
                if (orgId && planVersionId && session.subscription) {
                    try {
                        const stripe = getStripe();
                        const stripeSub = await stripe.subscriptions.retrieve(session.subscription as string);
                        const periodStart = parseStripeDate(stripeSub.current_period_start);
                        const periodEnd   = parseStripeDate(stripeSub.current_period_end);

                        console.log(`[stripe/webhook] 🚀 LLAMANDO A BillingService.activatePlan() con parámetros:`, {
                            orgId, planVersionId, externalId: stripeSub.id, status: 'ACTIVE', periodStart, periodEnd,
                            period: period || 'NO_PERIOD_IN_METADATA'
                        });

                        await BillingService.activatePlan(orgId, planVersionId, {
                            externalId: stripeSub.id,
                            status:     'ACTIVE',
                            periodStart,
                            periodEnd,
                            period: period as import('./billing.service').BillingPeriod,
                        });
                        console.log(`[stripe/webhook] ✅ ÉXITO. Plan ${planVersionId} activado para org ${orgId} (period: ${period || 'default'})`);

                        await GlobalAuditLogService.logEvent({
                            category: 'billing',
                            eventType: 'billing.checkout.completed',
                            severity: 'success',
                            outcome: 'success',
                            message: `Checkout completado y plan activado. Sesión: ${session.id}`,
                            tenantId: orgId,
                            metadata: { sessionId: session.id, planVersionId, period, stripeSubId: stripeSub.id }
                        });

                        // 3. Sincronizar Factura Inmediatamente
                        if (session.invoice) {
                            console.log(`[stripe/webhook] 🧾 Sincronizando factura inicial de sesión: ${session.invoice}`);
                            const inv = await stripe.invoices.retrieve(session.invoice as string);
                            await syncInvoice(inv);
                        }
                    } catch (err: any) {
                        console.error('\n[stripe/webhook] ❌ ERROR CATASTRÓFICO AL ACTIVAR PLAN O SINCRONIZAR INVOICE:', err.message);
                        console.error(err.stack);
                        await GlobalAuditLogService.logEvent({
                            category: 'billing',
                            eventType: 'billing.checkout.activation_failed',
                            severity: 'critical',
                            outcome: 'failure',
                            message: `ERROR CATASTRÓFICO al activar plan tras checkout. Sesión: ${session.id}. Error: ${err.message}`,
                            tenantId: orgId,
                            metadata: { sessionId: session.id, planVersionId, period, error: err.message }
                        });
                    }
                } else {
                    console.warn(`[stripe/webhook] ⚠️ checkout.session.completed OMITIDO (faltan datos)`);
                }
                break;
            }

            case 'customer.subscription.created':
            case 'customer.subscription.updated': {
                // Idempotente: BillingService maneja duplicados cerrando subs anteriores
                const sub = event.data.object as Stripe.Subscription;
                await syncSubscription(sub);
                break;
            }

            case 'customer.subscription.deleted': {
                const sub = event.data.object as Stripe.Subscription;
                await syncSubscription(sub);
                break;
            }

            case 'invoice.created':
            case 'invoice.updated':
            case 'invoice.paid': {
                const inv = event.data.object as Stripe.Invoice;
                await syncInvoice(inv);
                if (event.type === 'invoice.paid') {
                    const paidOrgId = (inv.metadata as any)?.orgId;
                    if (paidOrgId) {
                        await GlobalAuditLogService.logEvent({
                            category: 'billing',
                            eventType: 'billing.invoice.paid',
                            severity: 'success',
                            outcome: 'success',
                            message: `Factura pagada: ${inv.id} por $${((inv.amount_paid || 0) / 100).toFixed(2)} ${(inv.currency || 'usd').toUpperCase()}`,
                            tenantId: paidOrgId,
                            metadata: { invoiceId: inv.id, amount: inv.amount_paid, currency: inv.currency }
                        });
                    }
                }
                break;
            }

            case 'invoice.payment_failed': {
                const inv = event.data.object as Stripe.Invoice;
                await syncInvoice(inv);
                const failedOrgId = (inv.metadata as any)?.orgId;
                if (failedOrgId) {
                    await GlobalAuditLogService.logEvent({
                        category: 'billing',
                        eventType: 'billing.invoice.payment_failed',
                        severity: 'critical',
                        outcome: 'failure',
                        message: `PAGO FALLIDO para factura ${inv.id}. Monto: $${((inv.amount_due || 0) / 100).toFixed(2)} ${(inv.currency || 'usd').toUpperCase()}`,
                        tenantId: failedOrgId,
                        metadata: { invoiceId: inv.id, amount: inv.amount_due, currency: inv.currency, nextPaymentAttempt: (inv as any).next_payment_attempt }
                    });
                }
                break;
            }

            default:
                console.log(`[stripe/webhook] Evento no manejado: ${event.type}`);
        }

        res.json({ received: true });
    } catch (error: any) {
        console.error('[stripe/webhook] Error procesando evento:', error.message);
        res.status(500).json({ error: 'Error interno procesando el webhook.' });
    }
});

export const stripeWebhookRoutes = router;
