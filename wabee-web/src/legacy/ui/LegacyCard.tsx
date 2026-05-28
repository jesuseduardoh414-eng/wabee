import React, { HTMLAttributes } from 'react';

export interface LegacyCardProps extends HTMLAttributes<HTMLDivElement> {
    padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const LegacyCard: React.FC<LegacyCardProps> = ({
    children,
    padding = 'md',
    className = '',
    ...props
}) => {
    const paddings = {
        none: '',
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8',
    };

    return (
        <div
            className={`bg-white rounded-xl border border-gray-200 shadow-sm ${paddings[padding]} ${className}`}
            {...props}
        >
            {children}
        </div>
    );
};
