import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../../middleware/auth.middleware';

const router = Router();

// GET /v1/dashboard/summary
router.get('/summary', authMiddleware, async (req: AuthRequest, res) => {
    try {
        // Simulación de KPIs - En una app real, esto consultaría a la DB del tenant
        const summary = {
            totalConversations: 1542,
            activeLeads: 89,
            responseTimeAvg: '1.2m',
            pendingTasks: 12
        };

        res.json(summary);
    } catch (error: any) {
        res.status(500).json({
            error: {
                code: 'DASHBOARD_ERROR',
                message: 'No se pudo cargar el resumen del dashboard.'
            }
        });
    }
});

export const dashboardRoutes = router;
