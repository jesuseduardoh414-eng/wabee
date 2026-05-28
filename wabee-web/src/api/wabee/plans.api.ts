import api from '../client';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface PlanVersion {
    id: string;
    versionNumber: number;
    displayCode: string | null;
    price: number;
    currency: string;
    billingInterval: 'month' | 'year';
    monthlyPrice: number;
    annualPrice: number;
    stripeSyncStatus: 'NOT_REQUIRED' | 'PENDING' | 'READY' | 'PARTIAL' | 'FAILED';
    stripeSyncError: string | null;
    stripeSyncedAt: string | null;
    limitsJson: Record<string, any>;
    featuresJson: Record<string, any>;
    capabilitiesJson: Record<string, any>;
    modulesJson: Record<string, boolean>;
    metadataJson: Record<string, any>;
    stripePriceMonthlyId: string | null;
    stripePriceAnnualId: string | null;
    isPublished: boolean;
    isCurrent: boolean;
    effectiveFrom: string;
    effectiveTo: string | null;
    createdAt: string;
}

export interface Plan {
    id: string;
    name: string;
    code: string;
    description: string | null;
    status: 'draft' | 'active' | 'archived';
    isActive: boolean;
    activeOrgsCount: number;
    isPopular: boolean;
    currentVersion: PlanVersion | null;
    versionsCount: number;
    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;
}

export interface CreatePlanPayload {
    name: string;
    code: string;
    description?: string;
    monthlyPrice: number;
    annualPrice: number;
    currency: string;
    limitsJson: Record<string, any>;
    featuresJson?: Record<string, any>;
    capabilitiesJson?: Record<string, any>;
    modulesJson?: Record<string, boolean>;
    metadataJson?: Record<string, any>;
    isPublished?: boolean;
    productId?: string;
}

export interface PatchPlanPayload {
    name?: string;
    description?: string;
    status?: 'draft' | 'active' | 'archived';
    monthlyPrice?: number;
    annualPrice?: number;
    currency?: string;
    limitsJson?: Record<string, any>;
    featuresJson?: Record<string, any>;
    capabilitiesJson?: Record<string, any>;
    modulesJson?: Record<string, boolean>;
    metadataJson?: Record<string, any>;
}

export interface AssignPlanPayload {
    planId: string;
    startedAt?: string;
    endsAt?: string | null;
    notes?: string;
}

// ─── API Client ───────────────────────────────────────────────────────────────

export const superAdminPlansApi = {
    /** Lista todos los planes con versión vigente y popularidad real */
    listPlans: async (includeDeleted: boolean = false): Promise<Plan[]> => {
        const res = await api.get('/super-admin/plans', { params: { includeDeleted } });
        return res.data.plans;
    },

    /** Detalle de un plan con todas sus versiones */
    getPlan: async (id: string): Promise<{ plan: Plan; versions: PlanVersion[] }> => {
        const res = await api.get(`/super-admin/plans/${id}`);
        return res.data;
    },

    /** Historial de versiones de un plan */
    getVersions: async (planId: string): Promise<PlanVersion[]> => {
        const res = await api.get(`/super-admin/plans/${planId}/versions`);
        return res.data.versions;
    },

    /** Crear plan (genera v1 automáticamente) */
    createPlan: async (payload: CreatePlanPayload): Promise<{ plan: Plan; version: PlanVersion }> => {
        const res = await api.post('/super-admin/plans', payload);
        return res.data;
    },

    /**
     * Editar plan.
     * Si cambian campos materiales (precio, límites, features, stripePriceId) → se crea nueva versión.
     * Si solo cambian metadatos → solo se actualiza el plan base.
     */
    patchPlan: async (
        id: string,
        payload: PatchPlanPayload
    ): Promise<{ versionCreated: boolean; message: string; newVersion: PlanVersion | null }> => {
        const res = await api.patch(`/super-admin/plans/${id}`, payload);
        return res.data;
    },

    /** Publicar o despublicar un plan */
    publishPlan: async (id: string, publish: boolean): Promise<void> => {
        await api.post(`/super-admin/plans/${id}/publish`, { publish });
    },

    /** Archivar un plan */
    archivePlan: async (id: string): Promise<void> => {
        await api.post(`/super-admin/plans/${id}/archive`);
    },

    /** Asignar plan a una organización con snapshot inmutable */
    assignPlan: async (orgId: string, payload: AssignPlanPayload) => {
        const res = await api.post(`/super-admin/plans/organizations/${orgId}/assign-plan`, payload);
        return res.data;
    },

    /** Soft Delete de un plan */
    deletePlan: async (id: string): Promise<void> => {
        await api.delete(`/super-admin/plans/${id}`);
    },

    /** Restaurar (Undelete) de un plan eliminado lógicamente */
    restorePlan: async (id: string): Promise<void> => {
        await api.post(`/super-admin/plans/${id}/restore`);
    },
};
