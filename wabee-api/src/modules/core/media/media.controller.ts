import { Response } from 'express';
import { AuthRequest } from '@/middleware/auth.middleware';
import { tenancyAdapter } from '@/modules/wabee/_adapters/tenancy.adapter';
import { CoreInternalService } from '@/modules/core/core.internal.service';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

// ─── Supabase Admin Client (server-side, service key) ───────────────────────
function getSupabaseAdmin() {
    const url = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_KEY!;
    if (!url || !key) throw new Error('Supabase credentials not configured');
    return createClient(url, key);
}

// ─── Allowed MIME types ───────────────────────────────────────────────────────
const ALLOWED_MIMES: Record<string, string> = {
    'image/png': 'IMAGE',
    'image/jpeg': 'IMAGE',
    'image/webp': 'IMAGE',
    'video/mp4': 'VIDEO',
    'application/pdf': 'DOCUMENT',
};

// ─── Magic bytes validators ───────────────────────────────────────────────────
// Validates actual file content regardless of declared MIME type.
const MAGIC_BYTES: Record<string, (buf: Buffer) => boolean> = {
    'image/png':       buf => buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47,
    'image/jpeg':      buf => buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF,
    'image/webp':      buf => buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP',
    'video/mp4':       buf => buf.length > 11 && buf.slice(4, 8).toString('ascii') === 'ftyp',
    'application/pdf': buf => buf.slice(0, 4).toString('ascii') === '%PDF',
};

const BUCKET_NAME = process.env.SUPABASE_MEDIA_BUCKET || 'media';

export class MediaController {
    static async upload(req: AuthRequest, res: Response) {
        try {
            const tenantId = tenancyAdapter.getTenantId(req);
            const file = req.file;

            if (!file) {
                return res.status(400).json({ code: 'NO_FILE', message: 'No se proporcionó archivo' });
            }

            // Validate MIME
            if (!ALLOWED_MIMES[file.mimetype]) {
                return res.status(400).json({
                    code: 'INVALID_MIME',
                    message: `Tipo de archivo no permitido: ${file.mimetype}. Permitidos: ${Object.keys(ALLOWED_MIMES).join(', ')}`
                });
            }

            // Validate magic bytes — ensures file content matches declared MIME
            const magicCheck = MAGIC_BYTES[file.mimetype];
            if (magicCheck && !magicCheck(file.buffer)) {
                return res.status(400).json({
                    code: 'INVALID_FILE_CONTENT',
                    message: 'El contenido del archivo no coincide con su tipo declarado'
                });
            }

            const mediaId = uuidv4();
            const safeFileName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
            const filePath = `${tenantId}/campaigns/${mediaId}-${safeFileName}`;
            const collectionName = req.body.collectionName || 'campaigns';
            const isPublic = req.body.isPublic === 'true' || req.body.isPublic === true;

            // ─── Upload to Supabase Storage ───────────────────────────────────
            const supabase = getSupabaseAdmin();
            const { error: uploadError } = await supabase.storage
                .from(BUCKET_NAME)
                .upload(filePath, file.buffer, {
                    contentType: file.mimetype,
                    upsert: false,
                });

            if (uploadError) {
                console.error('[MediaController] Supabase upload error:', uploadError);
                return res.status(500).json({
                    code: 'STORAGE_ERROR',
                    message: `Error de almacenamiento: ${uploadError.message}`
                });
            }

            // ─── Insert into core.media_files (modelo del schema core) ───────
            const mediaFile = await CoreInternalService.createMediaFile({
                id: mediaId,
                tenantId,
                fileName: file.originalname,
                bucket: BUCKET_NAME,
                filePath,
                mimeType: file.mimetype,
                sizeBytes: BigInt(file.size),
                collection: collectionName,
                isPublic,
                metadata: {},
                ...(req.user?.id ? { uploadedBy: req.user.id } : {}),
            });

            console.log(`[MediaController] Archivo subido: ${mediaFile.id} (${file.originalname})`);

            return res.status(200).json({
                success: true,
                id: mediaFile.id,
                mimeType: file.mimetype,
                sizeBytes: file.size,
                bucket: BUCKET_NAME,
                path: filePath,
            });

        } catch (error: any) {
            console.error('[MediaController] Upload catch error', error);
            return res.status(error.status || 500).json({
                code: error.code || 'MEDIA_UPLOAD_ERROR',
                message: error.message || 'Error al subir el archivo'
            });
        }
    }

    static async getSignedUrl(req: AuthRequest, res: Response) {
        try {
            const tenantId = tenancyAdapter.getTenantId(req);
            const mediaId = req.params.id;
            const ttl = parseInt(req.query.ttl as string) || 3600;

            // Validate tenant ownership
            const mediaFile = await CoreInternalService.getMediaFileById(mediaId);

            if (!mediaFile || mediaFile.tenantId !== tenantId) {
                return res.status(404).json({ code: 'NOT_FOUND', message: 'Archivo no encontrado o sin acceso' });
            }

            // Generate signed URL
            const supabase = getSupabaseAdmin();
            const { data, error } = await supabase.storage
                .from(mediaFile.bucket || BUCKET_NAME)
                .createSignedUrl(mediaFile.filePath, ttl);

            if (error || !data?.signedUrl) {
                console.error('[MediaController] Error generando signed URL:', error);
                return res.status(500).json({ code: 'SIGNED_URL_ERROR', message: error?.message || 'No se pudo generar la URL' });
            }

            return res.status(200).json({
                success: true,
                signedUrl: data.signedUrl,
            });

        } catch (error: any) {
            console.error('[MediaController] getSignedUrl error', error);
            return res.status(error.status || 500).json({
                code: error.code || 'MEDIA_SIGNED_URL_ERROR',
                message: error.message || 'Error al obtener la URL'
            });
        }
    }
}
