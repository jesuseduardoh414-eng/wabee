import { CoreInternalService } from '@/modules/core/core.internal.service';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
    const url = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_KEY!;
    if (!url || !key) throw new Error('Supabase credentials not configured');
    return createClient(url, key);
}

export class CampaignMediaLinkService {
    /**
     * Resuelve un mediaValue (URL HTTPS o UUID de media_files) a una URL válida HTTPS
     * que la API de Meta WhatsApp pueda acceder.
     */
    static async resolveMediaLink(tenantId: string, mediaValue: string): Promise<string> {
        if (!mediaValue || typeof mediaValue !== 'string') {
            const err = new Error('Media link vacío o inválido.');
            (err as any).code = 'INVALID_MEDIA_LINK';
            throw err;
        }

        // 1. Si ya es URL HTTPS, validar y retornar directamente
        if (mediaValue.startsWith('https://')) {
            try {
                const parsed = new URL(mediaValue);
                if (parsed.protocol !== 'https:') throw new Error('Protocol must be https');
                return parsed.toString();
            } catch (e: any) {
                const err = new Error(`URL inválida: ${e.message}`);
                (err as any).code = 'INVALID_MEDIA_LINK';
                throw err;
            }
        }

        // 2. Asumir UUID → buscar en core.media_files y generar Signed URL
        try {
            const mediaFile = await CoreInternalService.getMediaFileById(mediaValue);

            if (!mediaFile || mediaFile.tenantId !== tenantId) {
                const err = new Error(`Archivo de media no encontrado para el tenant: ${mediaValue}`);
                (err as any).code = 'INVALID_MEDIA_LINK';
                throw err;
            }

            const supabase = getSupabaseAdmin();
            const { data, error } = await supabase.storage
                .from(mediaFile.bucket || 'media')
                .createSignedUrl(mediaFile.filePath, 3600);

            if (error || !data?.signedUrl) {
                const err = new Error(`No se pudo generar signed URL: ${error?.message || 'unknown'}`);
                (err as any).code = 'INVALID_MEDIA_LINK';
                throw err;
            }

            const resolved = new URL(data.signedUrl);
            if (resolved.protocol !== 'https:') {
                const err = new Error('La URL firmada no es HTTPS');
                (err as any).code = 'INVALID_MEDIA_LINK';
                throw err;
            }

            return resolved.toString();

        } catch (e: any) {
            if (e.code === 'INVALID_MEDIA_LINK') throw e;
            const err = new Error(`Error resolviendo media: ${e.message}`);
            (err as any).code = 'INVALID_MEDIA_LINK';
            throw err;
        }
    }
}
