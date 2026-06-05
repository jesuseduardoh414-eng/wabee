import React, { useEffect, useState } from 'react';
import { themesApi, BrandingTheme } from '@/api/wabee/themes.api';
import { DEFAULT_COLORS } from '@/api/wabee/colors.api';
import { DEFAULT_TYPOGRAPHY, VALID_TEXT_GROUPS } from '@/api/wabee/branding.api';

type ActiveThemeState = Partial<BrandingTheme> & {
    colors: Record<string, string>;
    typography: Record<string, { color: string; fontFamily: string }>;
    variant?: 'light' | 'dark';
};

const LIGHT_DEFAULT_COLORS: Record<string, string> = {
    ...DEFAULT_COLORS,
    'brand-primary': '#FFD700',
    'brand-primary-foreground': '#1A1A1A',
    'bg-page': '#FAF6EF',
    'bg-surface': '#F4EEE5',
    'bg-card': '#FFFAF3',
    'bg-elevated': '#FFFFFF',
    'bg-input': '#FFFBF6',
    'bg-hover': '#EEE6DA',
    'bg-selected': 'rgba(255, 194, 26, 0.14)',
    'text-strong': '#1F1A1F',
    'text-body': '#5C5752',
    'text-muted': '#766F69',
    'text-inverse': '#FFFAF3',
    'border-default': '#E7DDD0',
    'border-strong': '#D8CCBC',
    'border-focus': '#FFB000',
    'state-success': '#16a34a',
    'state-warning': '#d97706',
    'state-danger': '#cc2222',
    'state-info': '#2563eb',
    'chart-1': '#FFC21A',
    'chart-2': '#16a34a',
    'chart-3': '#2563eb',
    'chart-4': '#CA9CFC',
    'chart-5': '#FF8C00',
    'chart-grid': '#E8DED0',
    'chart-axis': '#837A72',
    'chart-tooltip-bg': '#FFFAF3',
    'chart-tooltip-text': '#1F1A1F',
};

/**
 * Inyecta dinámicamente las variables CSS del tema activo (Colores + Tipografía).
 * Prioridad de tema:
 *   1. Tema seleccionado por el usuario (wabee_user_theme_id en localStorage)
 *   2. Tema activo global del servidor
 */
export const ThemeStyleInjector: React.FC = () => {
    const [activeTheme, setActiveTheme] = useState<ActiveThemeState>({
        colors: LIGHT_DEFAULT_COLORS,
        typography: DEFAULT_TYPOGRAPHY,
        variant: 'light'
    });

    const generateCSS = (theme: ActiveThemeState): string => {
        let css = ':root {\n';
        const colors = { ...LIGHT_DEFAULT_COLORS, ...(theme.colors || {}) };
        const typography = { ...DEFAULT_TYPOGRAPHY, ...(theme.typography || {}) };

        Object.entries(colors).forEach(([key, value]) => {
            css += `  --${key}: ${value};\n`;
        });

        css += '\n  /* Alias semanticos globales */\n';
        css += `  --background: ${colors['bg-page']};\n`;
        css += `  --bg-subtle: ${colors['bg-surface']};\n`;
        css += `  --foreground: ${colors['text-strong']};\n`;
        css += `  --foreground-muted: ${colors['text-muted']};\n`;
        css += `  --primary: ${colors['brand-primary']};\n`;
        css += `  --primary-foreground: ${colors['brand-primary-foreground']};\n`;
        css += `  --secondary: ${colors['bg-elevated']};\n`;
        css += `  --muted: ${colors['text-muted']};\n`;
        css += `  --card: ${colors['bg-card']};\n`;
        css += `  --border: ${colors['border-default']};\n`;
        css += `  --border-subtle: ${colors['border-strong']};\n`;
        css += `  --sidebar-active-bg: ${colors['brand-primary']};\n`;
        css += `  --sidebar-active-text: ${colors['brand-primary-foreground']};\n`;
        css += `  --ty-strong: ${colors['text-strong']};\n`;
        css += `  --ty-muted: ${colors['text-muted']};\n`;
        css += `  --ty-dimmed: ${colors['text-body']};\n`;
        css += `  --ty-accent: ${colors['brand-primary']};\n`;
        css += `  --ty-danger: ${colors['state-danger']};\n`;
        css += `  --ty-success: ${colors['state-success']};\n`;

        css += '\n  /* Tipografia */\n';
        VALID_TEXT_GROUPS.forEach((group) => {
            const values = typography[group];
            if (values?.color && values?.fontFamily) {
                css += `  --tx-${group}-color: ${values.color};\n`;
                css += `  --tx-${group}-font: '${values.fontFamily}', sans-serif;\n`;
            }
        });

        css += '}\n';
        return css;
    };

    const loadActiveTheme = async () => {
        try {
            const userThemeId = localStorage.getItem('wabee_user_theme_id');
            if (userThemeId) {
                try {
                    const freshTheme = await themesApi.getPublishedThemeById(userThemeId);
                    if (freshTheme) {
                        setActiveTheme(freshTheme);
                        return;
                    }
                } catch (_error) {
                    console.warn('No se pudo cargar el tema preferido del usuario. Usando fallback global.');
                }
            }

            const data = await themesApi.getActiveTheme();
            setActiveTheme(data);
        } catch (error) {
            console.error('Error loading active theme styles:', error);
            setActiveTheme({
                colors: LIGHT_DEFAULT_COLORS,
                typography: DEFAULT_TYPOGRAPHY,
                variant: 'light'
            });
        }
    };

    useEffect(() => {
        loadActiveTheme();

        const handleRefresh = () => loadActiveTheme();
        window.addEventListener('refresh-branding-colors', handleRefresh);
        window.addEventListener('refresh-branding-typography', handleRefresh);

        return () => {
            window.removeEventListener('refresh-branding-colors', handleRefresh);
            window.removeEventListener('refresh-branding-typography', handleRefresh);
        };
    }, []);

    useEffect(() => {
        const variant = activeTheme?.variant === 'dark' ? 'dark' : 'light';
        const root = document.documentElement;
        root.dataset.wabeeThemeVariant = variant;
        root.classList.toggle('light-theme', variant === 'light');
    }, [activeTheme]);

    return (
        <style id="branding-theme-styles" type="text/css">
            {generateCSS(activeTheme)}
        </style>
    );
};
