import React, { InputHTMLAttributes } from 'react';

export interface LegacyInputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}

export const LegacyInput: React.FC<LegacyInputProps> = ({
    label,
    error,
    className = '',
    ...props
}) => {
    return (
        <div className="w-full">
            {label && (
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    {label}
                </label>
            )}
            <input
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors ${error ? 'border-error ring-1 ring-error/50' : 'border-gray-300'
                    } ${className}`}
                {...props}
            />
            {error && (
                <p className="mt-1 text-sm text-error">{error}</p>
            )}
        </div>
    );
};
