import api from '../client';

export interface BrandingTheme {
    id: string;
    name: string;
    isActive: boolean;
    isPublished: boolean;
    variant?: 'light' | 'dark';
    colors: Record<string, string>;
    typography: Record<string, { color: string; fontFamily: string }>;
    updatedAt: string;
}

export const themesApi = {
    getThemes: async (): Promise<BrandingTheme[]> => {
        const response = await api.get('/super-admin/branding/themes');
        return response.data.data;
    },

    getActiveTheme: async (): Promise<BrandingTheme> => {
        const response = await api.get('/super-admin/branding/themes/active');
        return response.data.data;
    },

    createTheme: async (name: string, baseTheme?: Partial<BrandingTheme>): Promise<BrandingTheme> => {
        const response = await api.post('/super-admin/branding/themes', { 
            name, 
            variant: baseTheme?.variant,
            colors: baseTheme?.colors, 
            typography: baseTheme?.typography 
        });
        return response.data.data;
    },

    updateTheme: async (id: string, updates: Partial<BrandingTheme>): Promise<BrandingTheme> => {
        const response = await api.put(`/super-admin/branding/themes/${id}`, updates);
        return response.data.data;
    },

    deleteTheme: async (id: string): Promise<void> => {
        await api.delete(`/super-admin/branding/themes/${id}`);
    },

    activateTheme: async (id: string): Promise<BrandingTheme> => {
        const response = await api.post(`/super-admin/branding/themes/${id}/activate`);
        return response.data.data;
    },

    publishTheme: async (id: string, publish: boolean): Promise<BrandingTheme> => {
        const response = await api.post(`/super-admin/branding/themes/${id}/publish`, { publish });
        return response.data.data;
    },

    getPublishedThemes: async (): Promise<BrandingTheme[]> => {
        const response = await api.get('/super-admin/branding/themes/published');
        return response.data.data;
    },

    getPublishedThemeById: async (id: string): Promise<BrandingTheme | null> => {
        const response = await api.get('/super-admin/branding/themes/published');
        const themes: BrandingTheme[] = response.data.data;
        return themes.find(t => t.id === id) ?? null;
    }
};
