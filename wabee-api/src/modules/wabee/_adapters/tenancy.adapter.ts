import { Request } from 'express';

/**
 * Adapter para extraer el TenantId/OrganizationId bajo el contexto del Core SaaS.
 * Busca el ID de organización en múltiples campos posibles del JWT decodificado.
 */
export const tenancyAdapter = {
    getTenantId: (req: Request): string => {
        const user = (req as any).user;

        // PRIORIDAD ABSOLUTA: Si el usuario está suplantando, el tenant mandatorio es el impersonado.
        // Se buscan ambos campos por compatibilidad de claims (Tenant vs Org).
        if (user?.isImpersonating) {
            const impersonatedId = user.impersonatedTenantId || user.impersonatedOrgId;
            if (impersonatedId) return impersonatedId;
        }

        // Busca en múltiples campos que el JWT del core puede usar
        const tenantId = user?.organizationId
            || user?.organization_id
            || user?.org_id
            || user?.tenantId
            || user?.tenant_id
            || req.headers['x-tenant-id']
            || req.headers['x-organization-id']
            || req.query.tenantId;

        if (!tenantId) {
            console.error('[TenancyAdapter] req.user payload:', JSON.stringify(user));
            console.error('[TenancyAdapter] req.headers:', JSON.stringify(req.headers));
            throw new Error('TENANCY_REQUIRED: No se pudo identificar la organización en el contexto (Adapter).');
        }

        return tenantId;
    },

    requireTenantByChannelField: async (_fieldValue: string, _fieldName: 'wabaId' | 'phoneNumberId' = 'wabaId'): Promise<string> => {
        return '';
    }
};
