import React from 'react';
import { Navigate } from 'react-router-dom';
import { isSuperAdmin } from '../lib/roles';

/**
 * Redireccionador inteligente para la raíz del Dashboard.
 * Envía a cada usuario al "primer módulo" de su lista según su rol.
 */
export const DashboardIndex = () => {
    const role = (localStorage.getItem('wabee_role') || 'AGENT').toUpperCase();

    // 1. Admin de Plataforma (sin empresa seleccionada) -> Ecosistema
    if (isSuperAdmin()) {
        const isImpersonating = !!localStorage.getItem('wabee_impersonation_org_id');
        if (!isImpersonating) {
            return <Navigate to="/dashboard/super-admin" replace />;
        }
    }

    // 2. Admin o Supervisor -> Dashboard (su primer módulo en el menú)
    if (role === 'ADMIN' || role === 'SUPERVISOR') {
        return <Navigate to="/dashboard/home" replace />;
    }

    // 3. Agentes u otros -> Inbox (su primer módulo en el menú)
    return <Navigate to="/dashboard/wabee/inbox" replace />;
};
