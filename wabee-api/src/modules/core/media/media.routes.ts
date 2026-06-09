import { Router } from 'express';
import { MediaController } from './media.controller';
import { tenantMiddleware } from '@/middleware/tenant';
import { authMiddleware } from '@/middleware/auth.middleware';
import multer from 'multer';

const router = Router();

// Configure multer for memory storage (temporary before upload)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 } // 25MB
});

// We need auth and tenant selection for core media
router.use(authMiddleware);
router.use(tenantMiddleware);

/**
 * @route POST /v1/core/media/upload
 * @desc Subir archivo a la galería genérica del tenant
 * @access Private
 */
router.post(
    '/upload',
    upload.single('file'),
    MediaController.upload
);

/**
 * @route GET /v1/core/media/:id/signed-url
 * @desc Obtener URL temporal firmada para acceder a un medio privado
 * @access Private
 */
router.get(
    '/:id/signed-url',
    MediaController.getSignedUrl
);

export const mediaRoutes = router;
