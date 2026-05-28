import { CoreInternalService } from './src/modules/core/core.internal.service';
import { PlanSnapshot } from './src/modules/billing/plan-resolver';

async function resolveOrganizationPlanSnapshotMock(organizationId: string): Promise<PlanSnapshot | null> {
    const sub = await CoreInternalService.getSubscriptionByTenant(organizationId);

    if (!sub) {
        // Fix here!
        const org = await CoreInternalService.getOrganizationById(organizationId);
        if (org && org.planTemplate) {
            const template: any = org.planTemplate;
            return {
                planId: template.id || 'none',
                tenantId: organizationId,
                planVersionId: null,
                planCode: template.metadata?.code || template.name?.toUpperCase() || 'FREE',
                planName: template.name || 'Plan Gratuito',
                displayCode: null,
                versionNumber: 1,
                price: Number(template.price ?? 0),
                monthlyPrice: Number(template.price ?? 0),
                annualPrice: Number((template.price ?? 0) * 12),
                currency: template.currency || 'mxn',
                billingInterval: template.interval || 'month',
                limits: (template.limits || {}) as Record<string, any>,
                features: (template.features || {}) as Record<string, any>,
                capabilities: {},
                modules: (template.modules || {}) as Record<string, any>,
                stripePriceMonthlyId: template.metadata?.stripePriceMonthlyId || null,
                stripePriceAnnualId: template.metadata?.stripePriceAnnualId || null,
                snapshotCreatedAt: null,
                _isLegacyFallback: true,
            };
        }
        return null;
    }

    const snap = sub.snapshotJson as any;

    // Caso 1...
    return { planCode: snap.planCode, isSub: true } as any; // Mocked
}

async function main() {
    const orgId = "85336ab0-aa8c-40fc-ae8c-6a8c63e5b665"; // Org without sub
    const result = await resolveOrganizationPlanSnapshotMock(orgId);
    console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error).finally(()=>process.exit(0));
