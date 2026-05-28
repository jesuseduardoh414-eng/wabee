import React from 'react';

export const PageLoader = () => {
    return (
        <div className="flex items-center justify-center min-h-screen bg-transparent">
            <div className="flex flex-col items-center justify-center space-y-4">
                <div className="w-12 h-12 border-4 border-[#3a3a2a] border-t-[#ead018] rounded-full animate-spin"></div>
            </div>
        </div>
    );
};
