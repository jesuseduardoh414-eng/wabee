import { Router } from 'express';
import { 
    createPublicRequest, 
    confirmPublicRequest,
    listRequests, 
    getRequestDetail, 
    updateRequestStatus, 
    completeAndAnonymize,
    deleteRequest
} from './data-deletion.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireSuperAdmin } from '../../middleware/auth-role.middleware';

const router = Router();

/**
 * RUTAS PÚBLICAS
 * Estas rutas no requieren autenticación.
 */
export const dataDeletionPublicRoutes = Router();
dataDeletionPublicRoutes.post('/', createPublicRequest);
dataDeletionPublicRoutes.patch('/:id/confirm', confirmPublicRequest);

/**
 * RUTAS DE ADMINISTRACIÓN
 * Estas rutas requieren autenticación y rol de Super Admin.
 */
router.use(authMiddleware);
router.use(requireSuperAdmin);

router.get('/', listRequests);
router.get('/:id', getRequestDetail);
router.patch('/:id/status', updateRequestStatus);
router.post('/:id/complete', completeAndAnonymize);
router.delete('/:id', deleteRequest);

export const dataDeletionAdminRoutes = router;
