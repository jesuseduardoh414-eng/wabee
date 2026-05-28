import React from 'react';
import { DashboardPage } from './DashboardPage';
import { LayoutDashboard } from 'lucide-react';

export const PublicDashboardPage = () => {
    return (
        <div className="relative">
            <div className="absolute -top-4 -left-4 bg-[#ead018] text-[#121208] text-[10px] font-black px-2 py-1 rounded-br-lg z-10 tracking-widest uppercase flex items-center gap-1">
                <LayoutDashboard size={10} />
                Public View
            </div>
            <DashboardPage />
        </div>
    );
};
