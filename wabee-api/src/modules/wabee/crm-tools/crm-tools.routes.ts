import { Router } from 'express';
import { buscarContacto, crearLead, actualizarOportunidad } from './crm-tools.controller';

const router = Router({ mergeParams: true });

// All routes include :tenantId in the path so the AI tool URL can be baked per-tenant
router.post('/:tenantId/buscar-contacto',        buscarContacto);
router.post('/:tenantId/crear-lead',              crearLead);
router.post('/:tenantId/actualizar-oportunidad',  actualizarOportunidad);

export default router;
