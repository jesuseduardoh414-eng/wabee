import { useQuery } from '@tanstack/react-query';
import { globalAuditService } from '../services/globalAudit.service';
import { GlobalAuditFilters } from '../types/globalAudit.types';

/**
 * Hook para obtener la lista paginada de eventos de auditoría con filtros.
 */
export const useGlobalAuditEvents = (page: number, limit: number, filters?: GlobalAuditFilters) => {
    return useQuery({
        queryKey: ['global-audit-events', page, limit, filters],
        queryFn: () => globalAuditService.getEvents(page, limit, filters),
        placeholderData: (previousData) => previousData,
        staleTime: 30000, // 30 segundos
    });
};

/**
 * Hook para obtener el detalle de un evento específico.
 */
export const useGlobalAuditDetail = (eventId: string | null) => {
    return useQuery({
        queryKey: ['global-audit-event', eventId],
        queryFn: () => eventId ? globalAuditService.getEventDetail(eventId) : null,
        enabled: !!eventId,
        staleTime: 60000,
    });
};
