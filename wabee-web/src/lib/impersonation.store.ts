/**
 * ImpersonationStore
 * Gestión centralizada del estado de suplantación.
 * Los tokens NO se guardan en localStorage; el token de impersonación
 * se usa solo como Authorization header override en client.ts.
 * La sesión original del admin se mantiene en la cookie HttpOnly.
 */

const STORE_KEY = 'wabee_impersonation';

export interface ImpersonationState {
    isImpersonating: boolean;
    realUser: string | null;
    realRole: string | null;
    impersonationToken: string;
    targetUserId: string;
    targetUserName: string;
    targetRole: string;
    targetUser: any;
    orgId: string;
    orgName?: string;
    realOrgId?: string | null;
    realOrgName?: string | null;
    startedAt: string;
}

export const ImpersonationStore = {
    start(state: Omit<ImpersonationState, 'isImpersonating' | 'startedAt' | 'realOrgId' | 'realOrgName'>): void {
        const full: ImpersonationState = {
            ...state,
            isImpersonating: true,
            realOrgId: localStorage.getItem('wabee_orgId'),
            realOrgName: localStorage.getItem('wabee_orgName'),
            startedAt: new Date().toISOString(),
        };
        localStorage.setItem(STORE_KEY, JSON.stringify(full));

        // Actualizar contexto de UI con el del usuario suplantado
        localStorage.setItem('wabee_user', JSON.stringify(state.targetUser));
        localStorage.setItem('wabee_role', state.targetRole);
        localStorage.setItem('wabee_orgId', state.orgId);
        if (state.orgName) localStorage.setItem('wabee_orgName', state.orgName);

        window.location.href = '/dashboard';
    },

    stop(): void {
        const state = ImpersonationStore.get();
        if (state) {
            // Restaurar contexto de UI del admin real
            if (state.realUser) localStorage.setItem('wabee_user', state.realUser);
            if (state.realRole) localStorage.setItem('wabee_role', state.realRole);
            if (state.realOrgId) localStorage.setItem('wabee_orgId', state.realOrgId);
            if (state.realOrgName) localStorage.setItem('wabee_orgName', state.realOrgName);
        }
        localStorage.removeItem(STORE_KEY);
        window.location.href = '/dashboard';
    },

    get(): ImpersonationState | null {
        const raw = localStorage.getItem(STORE_KEY);
        if (!raw) return null;
        try {
            const parsed = JSON.parse(raw) as ImpersonationState;
            if (
                parsed.isImpersonating &&
                parsed.impersonationToken &&
                parsed.targetUserId &&
                parsed.targetRole &&
                parsed.orgId
            ) {
                return parsed;
            }
            localStorage.removeItem(STORE_KEY);
            return null;
        } catch {
            localStorage.removeItem(STORE_KEY);
            return null;
        }
    },

    isActive(): boolean {
        return ImpersonationStore.get() !== null;
    },

    forceClean(): void {
        localStorage.removeItem(STORE_KEY);
    },
};
