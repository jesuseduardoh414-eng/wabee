import axios from 'axios';
import { ImpersonationStore } from '../lib/impersonation.store';

const client = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/v1',
    withCredentials: true,
});

// Interceptor: solo inyecta Authorization cuando hay impersonación activa (override de cookie)
client.interceptors.request.use((config) => {
    if (ImpersonationStore.isActive()) {
        const impState = ImpersonationStore.get();
        if (impState?.impersonationToken) {
            config.headers.Authorization = `Bearer ${impState.impersonationToken}`;
        }
    }

    const tenantId = localStorage.getItem('wabee_orgId') || localStorage.getItem('tenant_key');
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
            ImpersonationStore.stop();
            window.location.reload();
            return Promise.reject(error);
        }

        // Usuario suspendido mientras navegaba
        if (code === 'MEMBER_SUSPENDED') {
            ImpersonationStore.forceClean();
            localStorage.removeItem('wabee_session');
            localStorage.removeItem('wabee_user');
            localStorage.removeItem('wabee_orgId');
            localStorage.removeItem('wabee_orgName');
            localStorage.removeItem('wabee_role');
            window.location.href = '/login?reason=suspended';
            return Promise.reject(error);
        }

        // 401 genérico: limpiar sesión y redirigir al login
        if (status === 401) {
            ImpersonationStore.forceClean();
            localStorage.removeItem('wabee_session');
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }

        return Promise.reject(error);
    }
);

export default client;
