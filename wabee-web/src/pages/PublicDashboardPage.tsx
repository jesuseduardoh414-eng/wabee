import React from 'react';
import { DashboardPage } from './DashboardPage';
import { LayoutDashboard } from 'lucide-react';

export const PublicDashboardPage = () => {
    return (
        <div className="relative">
            <div className="absolute -top-4 left-2 z-10 hidden items-center gap-1 rounded-br-lg bg-[#ead018] px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-[#121208] sm:flex">
                <LayoutDashboard size={10} />
                Public View
            </div>
            <DashboardPage />
        </div>
    );
};
