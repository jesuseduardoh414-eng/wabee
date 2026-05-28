import client from '@/api/client';
import { GlobalAuditResponse, GlobalAuditDetailResponse, GlobalAuditFilters } from '../types/globalAudit.types';

/**
 * Servicio para interactuar con la API de Auditoría Global (Super Admin).
 */
export const globalAuditService = {
    /**
     * Obtiene una lista paginada de eventos de auditoría con filtros opcionales.
     */
    getEvents: async (page: number = 1, limit: number = 20, filters?: GlobalAuditFilters): Promise<GlobalAuditResponse> => {
        const response = await client.get<GlobalAuditResponse>(`/super-admin/audit/events`, {
            params: { page, limit, ...filters }
        });
        return response.data;
    },

    /**
     * Obtiene el detalle completo de un evento por ID.
     */
    getEventDetail: async (id: string): Promise<GlobalAuditDetailResponse> => {
        const response = await client.get<GlobalAuditDetailResponse>(`/super-admin/audit/events/${id}`);
        return response.data;
    }
};
