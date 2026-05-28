import React, { useEffect, useRef } from 'react';
import { colorsApi, ColorsConfig, DEFAULT_COLORS } from '@/api/wabee/colors.api';

/**
 * Inyecta dinámicamente las variables CSS de la paleta global de WABEE.
 * Permite que el SUPER_ADMIN cambie el tema visual y se refleje en tiempo real.
 */
export const ColorStyleInjector: React.FC = () => {
    const styleRef = useRef<HTMLStyleElement | null>(null);

    const generateCSS = (conf: ColorsConfig): string => {
        let css = ':root {\n';
        Object.entries(conf).forEach(([key, value]) => {
            css += `  --${key}: ${value};\n`;
        });
        css += '}\n\n';
        return css;
    };

    const applyCSS = (conf: ColorsConfig) => {
        if (!styleRef.current) {
            const el = document.createElement('style');
            el.id = 'branding-color-styles';
            document.head.appendChild(el);
            styleRef.current = el;
        }
        styleRef.current.textContent = generateCSS(conf);
    };

    const loadConfig = async () => {
        try {
            const data = await colorsApi.getColors();
            if (data && typeof data === 'object') {
                const merged = { ...DEFAULT_COLORS, ...data };
                applyCSS(merged);
            } else {
                applyCSS(DEFAULT_COLORS);
            }
        } catch {
            applyCSS(DEFAULT_COLORS);
        }
    };

    useEffect(() => {
        // Aplicar defaults inmediatamente
        applyCSS(DEFAULT_COLORS);

        // Intentar cargar la configuración real del servidor
        loadConfig();

        const handleRefresh = () => loadConfig();
        window.addEventListener('refresh-branding-colors', handleRefresh);

        const handleLogin = () => loadConfig();
        window.addEventListener('wabee-login', handleLogin);

        return () => {
            window.removeEventListener('refresh-branding-colors', handleRefresh);
            window.removeEventListener('wabee-login', handleLogin);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return null;
};
