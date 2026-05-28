import React, { useEffect, useRef } from 'react';
import { brandingApi, TypographyConfig, DEFAULT_TYPOGRAPHY, VALID_TEXT_GROUPS } from '@/api/wabee/branding.api';

/**
 * Inyecta dinámicamente las variables CSS --tx-* y las clases .tx-* para tipografía global.
 * Se monta en App.tsx (nivel raíz) para afectar toda la plataforma.
 *
 * Solo hace fetch al backend si hay un token de sesión activo.
 * Escucha el evento 'refresh-branding-typography' para recargar tras guardar en el módulo SUPER_ADMIN.
 */
export const BrandingStyleInjector: React.FC = () => {
    const styleRef = useRef<HTMLStyleElement | null>(null);

    const generateCSS = (conf: TypographyConfig): string => {
        let css = ':root {\n';
        VALID_TEXT_GROUPS.forEach(group => {
            const values = conf[group] || DEFAULT_TYPOGRAPHY[group];
            if (values) {
                css += `  --tx-${group}-color: ${values.color};\n`;
                css += `  --tx-${group}-font: '${values.fontFamily}', sans-serif;\n`;
            }
        });
        css += '}\n\n';

        return css;
    };

    const applyCSS = (conf: TypographyConfig) => {
        if (!styleRef.current) {
            const el = document.createElement('style');
            el.id = 'branding-typography-styles';
            document.head.appendChild(el);
            styleRef.current = el;
        }
        styleRef.current.textContent = generateCSS(conf);
    };

    const loadConfig = async () => {
        // La ruta GET ahora es PÚBLICA, por lo que podemos hacer fetch de estilos 
        // globalmente para todos los visitantes del sistema (incluida la Landing Page).

        try {
            const data = await brandingApi.getTypography();
            if (data && typeof data === 'object') {
                // Merge seguro con defaults — todos los grupos tienen valor garantizado
                const merged = { ...DEFAULT_TYPOGRAPHY };
                Object.keys(data).forEach(key => {
                    if (merged[key]) merged[key] = { ...merged[key], ...data[key] };
                });
                applyCSS(merged);
            } else {
                applyCSS(DEFAULT_TYPOGRAPHY);
            }
        } catch {
            // Error silencioso — aplicar defaults para no romper la UI
            applyCSS(DEFAULT_TYPOGRAPHY);
        }
    };

    useEffect(() => {
        // Aplicar defaults inmediatamente (sin flash de texto sin estilo)
        applyCSS(DEFAULT_TYPOGRAPHY);

        // Luego intentar cargar la configuración real del servidor
        loadConfig();

        // Escuchar evento de guardado en el módulo SUPER_ADMIN para refrescar inmediatamente
        const handleRefresh = () => loadConfig();
        window.addEventListener('refresh-branding-typography', handleRefresh);

        // Escuchar login exitoso para cargar config del servidor tras autenticarse
        const handleLogin = () => loadConfig();
        window.addEventListener('wabee-login', handleLogin);

        return () => {
            window.removeEventListener('refresh-branding-typography', handleRefresh);
            window.removeEventListener('wabee-login', handleLogin);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // No renderiza nada visible — solo el <style> anexado al <head>
    return null;
};
