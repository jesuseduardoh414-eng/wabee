import React from 'react';
import { Sparkles } from 'lucide-react';
import { startModuleTour, type ModuleKey } from '../lib/tours';

function isAdmin(): boolean {
    const role = (localStorage.getItem('wabee_role') || '').toUpperCase();
    const globalRole = localStorage.getItem('wabee_globalRole') || '';
    return role === 'ADMIN' || role === 'OWNER' || !!globalRole;
}

interface TourButtonProps {
    moduleKey: ModuleKey;
    className?: string;
}

export const TourButton: React.FC<TourButtonProps> = ({ moduleKey, className = '' }) => {
    if (!isAdmin()) return null;

    return (
        <button
            type="button"
            onClick={() => startModuleTour(moduleKey)}
            className={`wabee-tour-btn ${className}`}
            aria-label="Ver tutorial del módulo"
            title="Ver tutorial paso a paso"
        >
            <Sparkles size={13} />
            Tutorial
        </button>
    );
};
