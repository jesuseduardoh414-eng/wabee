import React, { HTMLAttributes } from 'react';

export const PageContainer: React.FC<HTMLAttributes<HTMLDivElement>> = ({ children, className = '', ...props }) => {
    return (
        <div className={`p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6 ${className}`} {...props}>
            {children}
        </div>
    );
};
