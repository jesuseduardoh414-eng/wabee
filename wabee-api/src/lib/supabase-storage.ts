/**
 * Supabase Storage Service
 * Centraliza todas las operaciones de almacenamiento de archivos.
 * Reemplaza el uso de disco local (fs) para garantizar persistencia en Render.
 *
 * Buckets:
 *   - wabee-branding  → PUBLIC  (logos, favicons — accesibles por URL directa)
 *   - wabee-campaigns → PRIVATE (snapshots de audiencia — solo acceso servidor)
 *   - media           → PRIVATE (adjuntos del inbox / galería — acceso por signed URL)
 */

import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
});

// Debe coincidir con el bucket usado por MediaController (SUPABASE_MEDIA_BUCKET || 'media').
const MEDIA_BUCKET = process.env.SUPABASE_MEDIA_BUCKET || 'media';

const BUCKETS = {
    BRANDING: 'wabee-branding',
    CAMPAIGNS: 'wabee-campaigns',
    MEDIA: MEDIA_BUCKET,
} as const;

/* ── Bucket initialization (idempotent) ────────────────────────────────────── */

async function ensureBucket(name: string, isPublic: boolean): Promise<void> {
    const { data: existing } = await supabase.storage.getBucket(name);
    if (existing) return;

    const { error } = await supabase.storage.createBucket(name, { public: isPublic });
    if (error && !error.message.includes('already exists')) {
        throw new Error(`[Storage] No se pudo crear bucket "${name}": ${error.message}`);
    }
    console.log(`[Storage] ✅ Bucket "${name}" creado (public=${isPublic})`);
}

let _initialized = false;
export async function initStorage(): Promise<void> {
    if (_initialized) return;
    try {
        await ensureBucket(BUCKETS.BRANDING, true);
        await ensureBucket(BUCKETS.CAMPAIGNS, false);
        await ensureBucket(BUCKETS.MEDIA, false);
        _initialized = true;
        console.log('[Storage] ✅ Supabase Storage inicializado');
    } catch (err: any) {
        console.error('[Storage] ❌ Error inicializando buckets:', err.message);
    }
}

/* ── Branding (logos, favicons) ─────────────────────────────────────────────── */

/**
 * Sube un archivo de branding (logo o favicon) al bucket público.
 * @returns URL pública directa del archivo
 */
export async function uploadBranding(
    fileName: string,
    data: Buffer,
    mimeType: string,
): Promise<string> {
    const { error } = await supabase.storage
        .from(BUCKETS.BRANDING)
        .upload(fileName, data, { contentType: mimeType, upsert: true });

    if (error) throw new Error(`[Storage] Upload branding fallido: ${error.message}`);

    const { data: urlData } = supabase.storage
        .from(BUCKETS.BRANDING)
        .getPublicUrl(fileName);

    return urlData.publicUrl;
}

/**
 * Elimina un archivo de branding del bucket.
 */
export async function deleteBranding(fileName: string): Promise<void> {
    await supabase.storage.from(BUCKETS.BRANDING).remove([fileName]);
}

/* ── Campaign Snapshots ─────────────────────────────────────────────────────── */

/**
 * Sube un snapshot JSON de audiencia de campaña al bucket privado.
 * @returns storage key (ruta relativa dentro del bucket)
 */
export async function uploadCampaignSnapshot(
    fileName: string,
    jsonContent: string,
): Promise<string> {
    const data = Buffer.from(jsonContent, 'utf8');

    const { error } = await supabase.storage
        .from(BUCKETS.CAMPAIGNS)
        .upload(fileName, data, { contentType: 'application/json', upsert: true });

    if (error) throw new Error(`[Storage] Upload snapshot fallido: ${error.message}`);

    return `${BUCKETS.CAMPAIGNS}/${fileName}`;
}

/**
 * Descarga el contenido de un snapshot de campaña.
 * Usado para recuperación de datos si es necesario.
 */
export async function downloadCampaignSnapshot(storageKey: string): Promise<string> {
    // storageKey format: "wabee-campaigns/filename.json"
    const fileName = storageKey.replace(`${BUCKETS.CAMPAIGNS}/`, '');

    const { data, error } = await supabase.storage
        .from(BUCKETS.CAMPAIGNS)
        .download(fileName);

    if (error) throw new Error(`[Storage] Download snapshot fallido: ${error.message}`);

    return await data.text();
}
