import { useQuery } from '@tanstack/react-query';
import client from '../api/client';
import { isSuperAdmin as checkSuperAdmin } from '../lib/roles';

export interface PlanSummary {
    plan: {
        id: string | null;
        name: string;
        code: string;
        status: string;
        isTrial: boolean;
    };
    limits: Record<string, number | null>;
    modules: Record<string, boolean>;
    usage: Record<string, number>;
}

/**
 * Hook central para consultar y validar el plan de la organización.
 */
export const usePlanEnforcement = () => {
    const orgId = localStorage.getItem('wabee_orgId') || '';
    const isSuperAdmin = checkSuperAdmin();

    const { data: summary, isLoading, error } = useQuery<PlanSummary>({
        queryKey: ['billing', 'summary', orgId],
        queryFn: async () => {
            const { data } = await client.get('/billing/summary', { 
                headers: { 'X-Org-Id': orgId } 
            });
            return data;
        },
        enabled: !!orgId && !isSuperAdmin,
        staleTime: 5 * 60 * 1000, // 5 minutos de cache
    });

    /**
     * Verifica si un módulo está habilitado.
     * Si es Super Admin, siempre devuelve true.
     */
    const isModuleEnabled = (moduleKey: string): boolean => {
        if (isSuperAdmin) return true;
        if (!summary) return false; // Safe default
        return summary.modules?.[moduleKey] === true;
    };

    /**
     * Verifica si se ha alcanzado un límite.
     */
    const hasReachedLimit = (limitKey: string): boolean => {
        if (isSuperAdmin) return false;
        if (!summary) return true; // Bloqueado si no hay datos

        const limit = summary.limits?.[limitKey];
        if (limit === null || limit === undefined) return true; // Bloqueado
        if (limit === -1) return false; // Ilimitado

        const current = summary.usage?.[limitKey] || 0;
        return current >= limit;
    };

    /**
     * Obtiene el valor de un límite.
     */
    const getLimitValue = (limitKey: string): number | null => {
        if (isSuperAdmin) return -1;
        return summary?.limits?.[limitKey] ?? null;
    };

    return {
        summary,
        isLoading,
        isModuleEnabled,
        hasReachedLimit,
        getLimitValue,
        orgId,
        isSuperAdmin
    };
};
