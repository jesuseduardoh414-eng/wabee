export function isUuid(v: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(v);
}

export function isHttpsUrl(v: string): boolean {
    try {
        const u = new URL(v);
        return u.protocol === 'https:';
    } catch {
        return false;
    }
}

interface ResolveMediaUrlArgs {
    value: string | null;
    apiUrl: string;
    tenantId: string;
}

export async function resolveMediaPreviewUrl({ value, apiUrl, tenantId }: ResolveMediaUrlArgs): Promise<string | null> {
    if (!value || value.trim() === '') return null;

    if (isHttpsUrl(value)) {
        return value;
    }

    if (isUuid(value)) {
        try {
            const res = await fetch(`${apiUrl}/core/media/${value}/signed-url`, {
                credentials: 'include',
                headers: { 'x-tenant-id': tenantId }
            });

            if (!res.ok) {
                return null;
            }

            const data = await res.json();
            if (data?.signedUrl) {
                return data.signedUrl;
            } else if (data?.url) {
                return data.url;
            }

            return null;
        } catch (error) {
            console.error('Error resolving media preview URL:', error);
            return null;
        }
    }

    return null;
}
