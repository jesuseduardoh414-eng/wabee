import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { brandingApi } from '@/api/wabee/branding.api';

/**
 * FaviconManager - Componente que gestiona dinámicamente el favicon de la pestaña
 * del navegador basándose en la configuración de branding global.
 */
export const FaviconManager = () => {
    const { data: branding } = useQuery({
        queryKey: ['global-branding'],
        queryFn: () => brandingApi.getGlobalBranding(),
        staleTime: 1000 * 60 * 5, // 5 minutos
    });

    useEffect(() => {
        const defaultFaviconUrl = '/vite.svg';

        if (!branding?.faviconUrl) {
            const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
            if (link) {
                link.href = defaultFaviconUrl;
                link.type = 'image/svg+xml';
            }
            return;
        }

        const updateFavicon = (url: string) => {
            let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
            
            if (!link) {
                link = document.createElement('link');
                link.rel = 'icon';
                document.getElementsByTagName('head')[0].appendChild(link);
            }

            if (link.href !== url) {
                link.href = url;
                if (url.toLowerCase().endsWith('.svg')) {
                    link.type = 'image/svg+xml';
                } else if (url.toLowerCase().endsWith('.ico')) {
                    link.type = 'image/x-icon';
                } else {
                    link.type = 'image/png';
                }
            }
        };

        const versionedFaviconUrl = `${branding.faviconUrl}${branding.faviconUrl.includes('?') ? '&' : '?'}v=${encodeURIComponent(branding.updatedAt || 'current')}`;
        updateFavicon(versionedFaviconUrl);
    }, [branding?.faviconUrl, branding?.updatedAt]);

    return null; // Componente headless
};
