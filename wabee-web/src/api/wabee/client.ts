import client from '../client';

/**
 * Legacy API Client Wrapper
 * Emulates the behavior of the legacy fetch-based apiClient using the new Axios client.
 * All WABEE module routes are prefixed with /wabee automatically.
 */
export async function apiClient<T>(
    endpoint: string,
    options: any = {}
): Promise<T> {
    // Añade el prefijo /wabee si el endpoint no lo tiene ya
    const normalizedEndpoint = endpoint.startsWith('/wabee') ? endpoint : `/wabee${endpoint}`;

    try {
        const response = await client({
            url: normalizedEndpoint,
            method: options.method || 'GET',
            data: options.body ? (typeof options.body === 'string' ? JSON.parse(options.body) : options.body) : undefined,
            headers: options.headers,
        });

        const result = response.data;
        // Legacy behavior: return the 'data' property if it exists, otherwise the whole result
        return result && typeof result === 'object' && 'data' in result ? result.data : result;
    } catch (error: any) {
        // Map axios errors to look like fetch/legacy errors if possible
        if (error.response) {
            const err = new Error(
                error.response.data?.message ||
                error.response.data?.error ||
                `HTTP ${error.response.status}`
            );
            (err as any).status = error.response.status;
            (err as any).code = error.response.data?.code;
            (err as any).detail = error.response.data?.detail;
            throw err;
        }
        throw error;
    }
}
