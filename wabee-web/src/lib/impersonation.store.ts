/**
 * ImpersonationStore
 * Gestión centralizada y atómica del estado de suplantación en localStorage.
 * Utiliza una sola key JSON para evitar keys sueltas inconsistentes.
 */

const STORE_KEY = 'wabee_impersonation';

export interface ImpersonationState {
    isImpersonating: boolean;
    realToken: string;
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
    /**
     * Inicia una sesión de suplantación y guarda el estado atómicamente.
     */
    start(state: Omit<ImpersonationState, 'isImpersonating' | 'startedAt' | 'realOrgId' | 'realOrgName'>): void {
        const full: ImpersonationState = {
            ...state,
            isImpersonating: true,
            realOrgId: localStorage.getItem('wabee_orgId'),
            realOrgName: localStorage.getItem('wabee_orgName'),
            startedAt: new Date().toISOString(),
        };
        localStorage.setItem(STORE_KEY, JSON.stringify(full));

        // Reemplazar el contexto activo con el de impersonación
        localStorage.setItem('wabee_token', state.impersonationToken);
        localStorage.setItem('wabee_user', JSON.stringify(state.targetUser));
        localStorage.setItem('wabee_role', state.targetRole);
        localStorage.setItem('wabee_orgId', state.orgId);
        if (state.orgName) localStorage.setItem('wabee_orgName', state.orgName);

        // HARD RESET: Forzar recarga total para limpiar TanStack Query y estado de React
        window.location.href = '/dashboard';
    },

    /**
     * Termina la sesión de suplantación y restaura el token original del admin.
     */
    stop(): void {
        const state = ImpersonationStore.get();
        if (state) {
            // Restaurar contexto real del admin
            localStorage.setItem('wabee_token', state.realToken);
            if (state.realUser) localStorage.setItem('wabee_user', state.realUser);
            if (state.realRole) localStorage.setItem('wabee_role', state.realRole);
            if (state.realOrgId) localStorage.setItem('wabee_orgId', state.realOrgId);
            if (state.realOrgName) localStorage.setItem('wabee_orgName', state.realOrgName);
        }
        localStorage.removeItem(STORE_KEY);
        // HARD RESET: Forzar recarga total para restaurar entorno limpio de Super Admin
        window.location.href = '/dashboard';
    },

    /**
     * Lee el estado actual. Devuelve null si no hay suplantación activa.
     */
    get(): ImpersonationState | null {
        const raw = localStorage.getItem(STORE_KEY);
        if (!raw) return null;
        try {
            const parsed = JSON.parse(raw) as ImpersonationState;
            // Validar que todos los campos críticos existen
            if (
                parsed.isImpersonating &&
                parsed.realToken &&
                parsed.impersonationToken &&
                parsed.targetUserId &&
                parsed.targetRole &&
                parsed.orgId
            ) {
                return parsed;
            }
            // Estado inconsistente → limpiar
            localStorage.removeItem(STORE_KEY);
            return null;
        } catch {
            localStorage.removeItem(STORE_KEY);
            return null;
        }
    },

    /**
     * Verifica si actualmente se está suplantando.
     */
    isActive(): boolean {
        return ImpersonationStore.get() !== null;
    },

    /**
     * Limpia el estado sin restaurar el token (para casos de error como IMPERSONATION_ENDED o MEMBER_SUSPENDED).
     * En ese caso simplemente se expulsa al login.
     */
    forceClean(): void {
        localStorage.removeItem(STORE_KEY);
    },
};
