import axios from 'axios';
import { ImpersonationStore } from '../lib/impersonation.store';

const client = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/v1',
});

// Interceptor para inyectar Token JWT y Tenant ID
// El token activo ya es manejado por ImpersonationStore.start() que reemplaza wabee_token
client.interceptors.request.use((config) => {
    const token = localStorage.getItem('wabee_token');
    const tenantId = localStorage.getItem('wabee_orgId') || localStorage.getItem('tenant_key');

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    if (tenantId) {
        config.headers['x-tenant-id'] = tenantId;
    }

    return config;
});

// Interceptor para manejar errores globales
client.interceptors.response.use(
    (response) => response,
    (error) => {
        const code = error.response?.data?.error?.code;
        const status = error.response?.status;

        // Sesión de impersonación terminada por el backend
        if (code === 'IMPERSONATION_ENDED') {
            ImpersonationStore.stop(); // restaura token real
            window.location.reload();
            return Promise.reject(error);
        }

        // Usuario suspendido mientras navegaba
        if (code === 'MEMBER_SUSPENDED') {
            ImpersonationStore.forceClean(); // no restaurar, simplemente limpiar
            localStorage.removeItem('wabee_token');
            localStorage.removeItem('wabee_user');
            localStorage.removeItem('wabee_orgId');
            localStorage.removeItem('wabee_orgName');
            localStorage.removeItem('wabee_role');
            window.location.href = '/login?reason=suspended';
            return Promise.reject(error);
        }

        // 401 genérico: limpiar todo y redirigir al login
        if (status === 401) {
            ImpersonationStore.forceClean();
            localStorage.removeItem('wabee_token');
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }

        return Promise.reject(error);
    }
);

export default client;
