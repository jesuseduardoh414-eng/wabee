import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

export const AuthGuard = ({ children }: { children: React.ReactNode }) => {
    const hasSession = !!localStorage.getItem('wabee_session');
    const location = useLocation();

    if (!hasSession) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return <>{children}</>;
};
