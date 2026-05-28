import express from 'express';
import { AiProfilesController } from './ai.profiles.controller';
import { AiProfileToolController } from './ai.profile-tool.controller';
import { AiIntegrationController } from './ai.integration.controller';
import { AiToolsController } from './ai.tools.controller';
import { AiWhatsappTestController } from './ai.whatsapp.test.controller';
import { AiFlowsController } from './ai.flows.controller';
import { prisma } from '@/lib/prisma';
import { ToolExecutorService } from './tools/tool.executor.service';
import { tenantMiddleware } from '@/middleware/tenant';
import multer from 'multer';
import os from 'os';
import { auditAction } from '../audit/audit.middleware';
import { requireModule } from '@/middleware/modules.guard';

const router = express.Router();

const upload = multer({
    dest: os.tmpdir(),
    limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
    // No fileFilter — la validación de tipo se hace en kb.service.ts
    // que ya verifica por mimeType Y extensión de archivo
});

// Apply tenant middleware to all AI routes
router.use(tenantMiddleware as any);
router.use(requireModule('aiProfiles'));

// Sub-modules enforcement
router.use('/integrations', requireModule('integrationsTools'));
router.use('/tools', requireModule('integrationsTools'));
router.use('/ai-tools', requireModule('integrationsTools'));

// AI Profiles CRUD
router.get('/ai-profiles', AiProfilesController.getProfiles);
router.get('/ai-profiles/:id', AiProfilesController.getProfile);
router.post('/ai-profiles',
    auditAction({
        action: 'CREATE_AI_PROFILE',
        modelType: 'AiProfile',
        getNewValues: (req: any) => req._parsedResponse
    }),
    AiProfilesController.createProfile
);
router.put('/ai-profiles/:id',
    auditAction({
        action: 'UPDATE_AI_PROFILE',
        modelType: 'AiProfile',
        getModelId: (req) => req.params.id,
        getNewValues: (req: any) => req._parsedResponse
    }),
    AiProfilesController.updateProfile
);
router.delete('/ai-profiles/:id',
    auditAction({
        action: 'DELETE_AI_PROFILE',
        modelType: 'AiProfile',
        getModelId: (req) => req.params.id,
        getNewValues: () => ({ status: 'deleted' })
    }),
    AiProfilesController.deleteProfile
);

// Knowledge Base (KB)
router.get('/ai-profiles/:id/kb/files', AiProfilesController.getKbFiles);
router.post('/ai-profiles/:id/kb/files',
    (req: any, res: any, next: any) => {
        upload.single('file')(req, res, (err: any) => {
            if (err) {
                console.error('[KbUpload] Multer error:', err.message);
                return res.status(400).json({ error: err.message });
            }
            next();
        });
    },
    AiProfilesController.uploadKbFile
);
router.delete('/ai-profiles/:id/kb/files/:fileId', AiProfilesController.deleteKbFile);
router.get('/ai-profiles/:id/kb/files/:fileId/view', AiProfilesController.viewKbFile);
router.post('/ai-profiles/:id/kb/files/:fileId/reindex', AiProfilesController.reindexKbFile);

// Thread AI Controls
router.post('/ai/webwidgets/:widgetId/threads/:threadId/pause', AiProfilesController.pauseThreadAI);
router.post('/ai/webwidgets/:widgetId/threads/:threadId/resume', AiProfilesController.resumeThreadAI);

// AI Audit Logs
router.get('/ai-audit', AiProfilesController.getAuditLogs);

// === AI INTEGRATIONS ===
router.get('/integrations', AiIntegrationController.getIntegrations);
router.get('/integrations/:id', AiIntegrationController.getIntegration);
router.post('/integrations', AiIntegrationController.createIntegration);
router.patch('/integrations/:id', AiIntegrationController.updateIntegration);
router.delete('/integrations/:id', AiIntegrationController.deleteIntegration);

// === AI TOOLS ===
router.get('/tools', AiToolsController.getTools);
router.get('/tools/:id', AiToolsController.getTool);
router.post('/tools', AiToolsController.createTool);
router.patch('/tools/:id', AiToolsController.updateTool);
router.delete('/tools/:id', AiToolsController.deleteTool);
router.post('/tools/:id/test', AiToolsController.testTool);

// === AI TOOLS & PROFILE MANAGEMENT LEGACY (PROFILE-TOOL Links) ===
router.get('/ai-tools', AiProfileToolController.getTenantTools); // Kept for backwards compatibility if needed
router.patch('/ai-tools/:id/status', AiProfileToolController.toggleGlobalTool);

router.get('/ai-profiles/:id/tools', AiProfileToolController.getProfileTools);
router.post('/ai-profiles/:id/tools/:toolId', AiProfileToolController.linkTool);
router.delete('/ai-profiles/:id/tools/:toolId', AiProfileToolController.unlinkTool);
router.patch('/ai-profiles/:id/tools/:toolId', AiProfileToolController.toggleProfileTool);

// === AI WHATSAPP TEST (Isolated) ===
router.post('/ai-profiles/:id/whatsapp-test', AiWhatsappTestController.testMessage);
router.delete('/ai-profiles/:id/whatsapp-test/:sessionId', AiWhatsappTestController.clearSession);

// AI Conversation Flows (Read-Only Registry)
router.get('/flows', AiFlowsController.listFlows);

// Health check for AI routes
router.get('/health/ai-routes', (req, res) => {
    res.json({ aiProfiles: true, status: 'healthy' });
});

export default router;
