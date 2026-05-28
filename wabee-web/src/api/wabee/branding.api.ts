import client from '../client';

export interface TypographyGroupConfig {
    color: string;
    fontFamily: string;
}

export type TypographyConfig = Record<string, TypographyGroupConfig>;

export interface GlobalBranding {
    logoUrl: string | null;
    faviconUrl: string | null;
    updatedAt: string;
}

/**
 * Lista canónica y oficial de los 20 grupos tipográficos configurables.
 * badgeText se excluye porque su color es siempre contextual (estado semántico).
 */
export const VALID_TEXT_GROUPS: readonly string[] = [
    'pageTitle', 'pageSubtitle', 'sectionTitle', 'sectionSubtitle',
    'cardTitle', 'cardSubtitle', 'kpiLabel', 'kpiValue',
    'labelText', 'inputText', 'buttonText', 'buttonPrimaryText', 'navText',
    'menuText', 'tableHeader', 'tableCell', 'statusText',
    'messageText', 'helperText', 'emptyStateTitle', 'emptyStateBody',
] as const;

/**
 * Valores por defecto centralizados — fuente de verdad del frontend.
 * Debe mantenerse en sincronía con DEFAULT_TYPOGRAPHY del backend.
 */
export const DEFAULT_TYPOGRAPHY: TypographyConfig = {
    pageTitle:        { color: 'var(--text-strong)', fontFamily: 'Inter' },
    pageSubtitle:     { color: 'var(--text-muted)', fontFamily: 'Inter' },
    sectionTitle:     { color: 'var(--text-strong)', fontFamily: 'Inter' },
    sectionSubtitle:  { color: 'var(--text-muted)', fontFamily: 'Inter' },
    cardTitle:        { color: 'var(--text-strong)', fontFamily: 'Inter' },
    cardSubtitle:     { color: 'var(--text-body)', fontFamily: 'Inter' },
    kpiLabel:         { color: 'var(--text-muted)', fontFamily: 'Inter' },
    kpiValue:         { color: 'var(--text-strong)', fontFamily: 'Inter' },
    labelText:        { color: 'var(--text-strong)', fontFamily: 'Inter' },
    inputText:        { color: 'var(--text-strong)', fontFamily: 'Inter' },
    buttonText:       { color: 'var(--text-inverse)', fontFamily: 'Inter' },
    buttonPrimaryText:{ color: 'var(--text-inverse)', fontFamily: 'Inter' },
    navText:          { color: 'var(--text-muted)', fontFamily: 'Inter' },
    menuText:         { color: 'var(--text-muted)', fontFamily: 'Inter' },
    tableHeader:      { color: 'var(--text-muted)', fontFamily: 'Inter' },
    tableCell:        { color: 'var(--text-strong)', fontFamily: 'Inter' },
    statusText:       { color: 'var(--text-muted)', fontFamily: 'Inter' },
    messageText:      { color: 'var(--text-strong)', fontFamily: 'Inter' },
    helperText:       { color: 'var(--text-muted)', fontFamily: 'Inter' },
    emptyStateTitle:  { color: 'var(--text-strong)', fontFamily: 'Inter' },
    emptyStateBody:   { color: 'var(--text-muted)', fontFamily: 'Inter' },
};

export const brandingApi = {
    /**
     * Obtiene la configuración tipográfica global (merged con defaults).
     */
    getTypography: async (): Promise<TypographyConfig> => {
        const response = await client.get('/super-admin/text-style-groups');
        return response.data?.data || response.data;
    },

    /**
     * Actualiza los overrides tipográficos de uno o varios grupos.
     */
    updateTypography: async (typography: Partial<TypographyConfig>): Promise<TypographyConfig> => {
        const response = await client.put('/super-admin/text-style-groups', { typography });
        return response.data?.data || response.data;
    },

    /**
     * Restaura todos los grupos a sus valores por defecto.
     */
    resetTypography: async (): Promise<TypographyConfig> => {
        const response = await client.post('/super-admin/text-style-groups/reset');
        return response.data?.data || response.data;
    },

    /**
     * Obtiene la configuración de marca global (logo, etc).
     */
    getGlobalBranding: async (): Promise<GlobalBranding> => {
        const response = await client.get('/super-admin/branding/global');
        return response.data?.data || response.data;
    },

    /**
     * Sube el logo global de la plataforma.
     */
    uploadLogo: async (file: File): Promise<GlobalBranding> => {
        const formData = new FormData();
        formData.append('file', file);
        const response = await client.post('/super-admin/branding/global/logo', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data?.data || response.data;
    },

    /**
     * Elimina el logo personalizado.
     */
    deleteGlobalLogo: async (): Promise<void> => {
        await client.delete('/super-admin/branding/global/logo');
    },

    /**
     * Sube el favicon global de la plataforma.
     */
    uploadFavicon: async (file: File): Promise<GlobalBranding> => {
        const formData = new FormData();
        formData.append('file', file);
        const response = await client.post('/super-admin/branding/global/favicon', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data?.data || response.data;
    },

    /**
     * Elimina el favicon personalizado.
     */
    deleteFavicon: async (): Promise<void> => {
        await client.delete('/super-admin/branding/global/favicon');
    }
};
