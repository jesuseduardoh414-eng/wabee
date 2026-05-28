import { Router } from 'express';
import { CampaignsController, requireCampaignRole, checkCampaignsFeatureFlag } from './campaigns.controller';
import { tenantMiddleware } from '@/middleware/tenant';
import { auditAction } from '../audit/audit.middleware';
import { requireModule } from '@/middleware/modules.guard';

const router = Router();

// Todas las rutas del módulo requieren inquilino identificado y feature flag habilitada
router.use(tenantMiddleware);
router.use(requireModule('campaigns'));
router.use(checkCampaignsFeatureFlag);

/**
 * RUTAS DE CONSULTA
 * Disponibles para Admin, Supervisor y Agente
 */
router.get('/',
    requireCampaignRole(['ADMIN', 'SUPERVISOR', 'AGENT']),
    CampaignsController.list
);

router.get('/:id',
    requireCampaignRole(['ADMIN', 'SUPERVISOR', 'AGENT']),
    CampaignsController.getDetail
);

router.get('/:id/metrics',
    requireCampaignRole(['ADMIN', 'SUPERVISOR', 'AGENT']),
    CampaignsController.getMetrics
);

/**
 * ANALÍTICAS AVANZADAS
 * Solo Admin y Supervisor
 */
router.get('/:id/analytics/summary',
    requireCampaignRole(['ADMIN', 'SUPERVISOR']),
    CampaignsController.getAnalyticsSummary
);
router.get('/:id/analytics/timeseries',
    requireCampaignRole(['ADMIN', 'SUPERVISOR']),
    CampaignsController.getAnalyticsTimeSeries
);
router.get('/:id/analytics/funnel',
    requireCampaignRole(['ADMIN', 'SUPERVISOR']),
    CampaignsController.getAnalyticsFunnel
);
router.get('/:id/analytics/errors',
    requireCampaignRole(['ADMIN', 'SUPERVISOR']),
    CampaignsController.getAnalyticsErrors
);
router.get('/:id/analytics/recipients',
    requireCampaignRole(['ADMIN', 'SUPERVISOR']),
    CampaignsController.getAnalyticsRecipients
);

/**
 * RUTAS DE OPERACIÓN MODULAR
 * Permite Start, Pause, Resume y Cancel. 
 * Disponible para Admin y Supervisor.
 */
router.post('/:id/operate',
    requireCampaignRole(['ADMIN', 'SUPERVISOR']),
    auditAction({
        action: 'CAMPAIGN_OPERATE',
        modelType: 'WhatsappCampaign',
        getModelId: (req) => req.params.id,
        getNewValues: (req: any) => ({ action: req.body.action, response: req._parsedResponse })
    }),
    CampaignsController.operate
);

/**
 * TRAZABILIDAD DE ERRORES (DLQ)
 * Disponible para Admin y Supervisor.
 */
router.get('/:id/errors',
    requireCampaignRole(['ADMIN', 'SUPERVISOR']),
    CampaignsController.listErrors
);

/**
 * GESTIÓN ESTRUCTURAL
 * Creación y edición de borradores. 
 * Reservado para el rol Admin.
 */
router.post('/',
    requireCampaignRole(['ADMIN']),
    auditAction({
        action: 'CREATE_CAMPAIGN',
        modelType: 'WhatsappCampaign',
        getNewValues: (req: any) => req._parsedResponse
    }),
    CampaignsController.create
);

router.patch('/:id',
    requireCampaignRole(['ADMIN']),
    auditAction({
        action: 'UPDATE_CAMPAIGN',
        modelType: 'WhatsappCampaign',
        getModelId: (req) => req.params.id,
        getNewValues: (req: any) => req._parsedResponse
    }),
    CampaignsController.update
);

router.delete('/:id',
    requireCampaignRole(['ADMIN']),
    auditAction({
        action: 'DELETE_CAMPAIGN',
        modelType: 'WhatsappCampaign',
        getModelId: (req) => req.params.id,
        getNewValues: () => ({ deleted: true })
    }),
    CampaignsController.delete
);

export default router;
