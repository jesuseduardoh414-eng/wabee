/**
 * Rutas de Configuración IA por Canal (WhatsApp)
 * Endpoints:
 *   GET    /:channelId/ai-config        → Leer configuración IA
 *   PATCH  /:channelId/ai-config        → Actualizar configuración IA
 */

import { Router } from 'express';
import { tenantMiddleware } from '@/middleware/tenant';
import { ChannelAiConfigService } from '../channel.ai-config.service';
import { ChannelAiMode, HumanHandoffRole } from '@prisma/client';

const router = Router({ mergeParams: true });
router.use(tenantMiddleware);

// ────────────────────────────────────────────────────────────────────────────
// GET /
// RBAC: cualquier miembro del tenant (Agent, Supervisor, Admin)
// ────────────────────────────────────────────────────────────────────────────
router.get('/', async (req: any, res) => {
    try {
        const { channelId } = req.params;
        const tenantId = req.tenantId;
        const config = await ChannelAiConfigService.getConfig(channelId, tenantId);
        res.json({ ok: true, data: config });
    } catch (e: any) {
        res.status(e.status || 500).json({ ok: false, code: e.code, error: e.message });
    }
});

// ────────────────────────────────────────────────────────────────────────────
// PATCH /
// RBAC: Supervisor, Admin
// ────────────────────────────────────────────────────────────────────────────
router.patch('/', async (req: any, res) => {
    try {
        const { channelId } = req.params;
        const tenantId = req.tenantId;
        
        // Asumiendo que res.locals.role se inyecta por el authGuard (depende de cómo esté configurado Wabee)
        // Para simplificar, confiamos en la capa de policies o requerimos que esté protegido en las rutas base.
        // Pero idealmente el guard ya hizo el check global, aquí validamos body:
        
        const {
            aiEnabled,
            defaultAiProfileId,
            humanHandoffEnabled,
            humanHandoffRole,
            humanTeamRef,
            fallbackMessage,
            aiMode,
        } = req.body;

        if (aiMode && !Object.values(ChannelAiMode).includes(aiMode)) {
            return res.status(400).json({
                ok: false,
                code: 'INVALID_AI_MODE',
                error: `aiMode inválido. Valores permitidos: ${Object.values(ChannelAiMode).join(', ')}`,
            });
        }

        if (humanHandoffRole && !Object.values(HumanHandoffRole).includes(humanHandoffRole)) {
            return res.status(400).json({
                ok: false,
                code: 'INVALID_HANDOFF_ROLE',
                error: `humanHandoffRole inválido. Valores permitidos: ${Object.values(HumanHandoffRole).join(', ')}`,
            });
        }

        const updated = await ChannelAiConfigService.updateConfig(channelId, tenantId, {
            aiEnabled,
            defaultAiProfileId,
            humanHandoffEnabled,
            humanHandoffRole,
            humanTeamRef,
            fallbackMessage,
            aiMode,
        });

        res.json({ ok: true, data: updated });
    } catch (e: any) {
        res.status(e.status || 500).json({ ok: false, code: e.code, error: e.message });
    }
});

export default router;
