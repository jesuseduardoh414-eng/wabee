import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { usePlanEnforcement } from '../hooks/usePlanEnforcement';

interface ModuleGuardProps {
    children: React.ReactNode;
    moduleKey: string;
}

/**
 * Guarda de componentes y rutas basado en módulos del plan.
 * Bloquea el acceso y redirige a billing si el módulo no está activo.
 */
export const ModuleGuard: React.FC<ModuleGuardProps> = ({ children, moduleKey }) => {
    const { summary, isLoading, isModuleEnabled, isSuperAdmin } = usePlanEnforcement();
    const location = useLocation();

    // 1. Mientras carga, no renderizamos nada (o un spinner) para evitar flashes
    if (isLoading && !isSuperAdmin) {
        return (
            <div className="flex h-full w-full items-center justify-center bg-[var(--bg-page)]">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-[var(--brand-primary)] border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm font-medium opacity-70">Validando suscripción...</span>
                </div>
            </div>
        );
    }

    // 2. Si no es Super Admin y no hay resumen o el módulo está apagado
    // Redirigir a Billing con un mensaje o estado
    if (!isSuperAdmin) {
        // Caso: No tiene plan activo en absoluto
        if (!summary || summary.plan.code === 'NONE') {
            return <Navigate to="/dashboard/settings/plan" state={{ from: location, reason: 'PLAN_REQUIRED' }} replace />;
        }

        // Caso: Módulo específico bloqueado
        if (!isModuleEnabled(moduleKey)) {
            return <Navigate to="/dashboard/settings/plan" state={{ from: location, reason: 'MODULE_BLOCKED', module: moduleKey }} replace />;
        }
    }

    // 3. Permitido
    return <>{children}</>;
};
