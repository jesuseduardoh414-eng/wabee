import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Zap } from 'lucide-react';
import { brandingApi } from '../api/wabee/branding.api';
import { T } from '@/lib/text-tokens';

interface BrandLogoProps {
    variant?: 'icon' | 'full';
    className?: string;
    size?: number;
    showProHub?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ 
    variant = 'full', 
    className = '', 
    size,
    showProHub = false
}) => {
    const [imgError, setImgError] = useState(false);
    
    const { data: branding } = useQuery({
        queryKey: ['global-branding'],
        queryFn: () => brandingApi.getGlobalBranding(),
        staleTime: 1000 * 60 * 5, // 5 minutes
    });

    const logoUrl = branding?.logoUrl;
    const versionedLogoUrl = logoUrl
        ? `${logoUrl}${logoUrl.includes('?') ? '&' : '?'}v=${encodeURIComponent(branding?.updatedAt || 'current')}`
        : null;
    const resolvedSize = size || (variant === 'icon' ? 33 : 37);

    // Fallback logic: Si no hay URL o si la imagen falla al cargar
    if (versionedLogoUrl && !imgError) {
        return (
            <div className={`flex items-center gap-2 ${className}`}>
                <img 
                    src={versionedLogoUrl} 
                    alt="Platform Logo" 
                    style={{ 
                        height: resolvedSize, 
                        width: 'auto',
                        filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.3))'
                    }}
                    className="object-contain"
                    onError={() => setImgError(true)}
                />
            </div>
        );
    }

    // Default Wabee Fallback
    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <div className={`shrink-0 bg-[var(--brand-primary)] rounded flex items-center justify-center shadow-lg shadow-[var(--brand-primary)]/10 rotate-2`}
                 style={{ width: resolvedSize, height: resolvedSize }}>
                <Zap className="text-[var(--brand-primary-foreground)] fill-current" size={resolvedSize * 0.5} />
            </div>
            {variant === 'full' && (
                <div className="flex flex-col">
                    <h1 className="text-base font-black tracking-tighter italic leading-none [color:var(--tx-cardTitle-color)]">Wabee</h1>
                    {showProHub && <p className={`${T.helperText} text-[7px] leading-none mt-0.5 opacity-80`}>Pro Hub</p>}
                </div>
            )}
        </div>
    );
};
