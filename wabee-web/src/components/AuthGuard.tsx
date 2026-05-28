import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

export const AuthGuard = ({ children }: { children: React.ReactNode }) => {
    const token = localStorage.getItem('wabee_token');
    const location = useLocation();

    if (!token) {
        // Redirigir a login pero guardar la ubicación a la que intentaba ir
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return <>{children}</>;
};
