import React, { HTMLAttributes } from 'react';

export interface LegacyTableProps extends HTMLAttributes<HTMLTableElement> {
    headers: string[];
}

export const LegacyTable: React.FC<LegacyTableProps> = ({
    headers,
    children,
    className = '',
    ...props
}) => {
    return (
        <div className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden ${className}`}>
            <table className="w-full text-left" {...props}>
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-bold tracking-wider border-b border-gray-200">
                    <tr>
                        {headers.map((h, i) => (
                            <th key={i} className="px-6 py-4">{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                    {children}
                </tbody>
            </table>
        </div>
    );
};
