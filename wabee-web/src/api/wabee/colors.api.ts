import client from '../client';

export type ColorsConfig = Record<string, string>;

export const DEFAULT_COLORS: ColorsConfig = {
    'brand-primary': '#FFD700',
    'brand-primary-foreground': '#1A1A1A',
    'bg-page': '#1A1A1A',
    'bg-surface': '#232323',
    'bg-card': '#242424',
    'bg-elevated': '#2D2D2D',
    'bg-input': '#202020',
    'bg-hover': '#303030',
    'bg-selected': 'rgba(255, 215, 0, 0.12)',
    'text-strong': '#F4F4DC',
    'text-body': '#E7E2BF',
    'text-muted': '#B9B28E',
    'text-inverse': '#1A1A1A',
    'border-default': '#3A382F',
    'border-strong': '#5B5749',
    'border-focus': '#FFD700',
    'state-success': '#22c55e',
    'state-warning': '#f59e0b',
    'state-danger': '#ef4444',
    'state-info': '#3b82f6',
    'chart-1': '#FFD700',
    'chart-2': '#22c55e',
    'chart-3': '#3b82f6',
    'chart-4': '#CA9CFC',
    'chart-5': '#FF8C00',
    'chart-grid': '#3A382F',
    'chart-axis': '#B9B28E',
    'chart-tooltip-bg': '#242424',
    'chart-tooltip-text': '#F4F4DC',
    'mkt-surface': 'rgba(255, 255, 255, 0.72)',
    'mkt-surface-2': 'rgba(255, 255, 255, 0.64)',
    'mkt-border': 'rgba(26, 26, 26, 0.08)',
    'mkt-ink': '#1f1f1f',
};

export const colorsApi = {
    /**
     * Obtiene la configuración de colores global.
     */
    getColors: async (): Promise<ColorsConfig> => {
        const response = await client.get('/super-admin/branding/colors');
        return response.data?.data || response.data;
    },

    /**
     * Actualiza la paleta de colores global.
     */
    updateColors: async (colors: ColorsConfig): Promise<ColorsConfig> => {
        const response = await client.put('/super-admin/branding/colors', { colors });
        return response.data?.data || response.data;
    },

    /**
     * Restaura los colores a sus valores por defecto.
     */
    resetColors: async (): Promise<ColorsConfig> => {
        const response = await client.post('/super-admin/branding/colors/reset');
        return response.data?.data || response.data;
    },
};
