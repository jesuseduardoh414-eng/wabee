import React, { HTMLAttributes } from 'react';

export interface LegacyBadgeProps extends HTMLAttributes<HTMLSpanElement> {
    variant?: 'default' | 'success' | 'warning' | 'error' | 'primary';
}

export const LegacyBadge: React.FC<LegacyBadgeProps> = ({
    children,
    variant = 'default',
    className = '',
    ...props
}) => {
    const variants = {
        default: 'bg-gray-100 text-gray-700',
        primary: 'bg-primary-100 text-primary-800',
        success: 'bg-green-100 text-green-800',
        warning: 'bg-yellow-100 text-yellow-800',
        error: 'bg-red-100 text-red-800',
    };

    return (
        <span
            className={`px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap ${variants[variant]} ${className}`}
            {...props}
        >
            {children}
        </span>
    );
};
