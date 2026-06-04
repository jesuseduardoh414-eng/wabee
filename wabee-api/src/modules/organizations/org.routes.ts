import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, AuthRequest } from '../../middleware/auth.middleware';
import { coreAdapter } from '../core/core.adapter';
import { GlobalAuditLogService } from '@/modules/audit/global-audit-log.service';
import { getAuditContext } from '@/shared/http/request-audit-context';
import { CoreInternalService } from '../core/core.internal.service';
import { requireJwtSecret } from '../../config/env';

const router = Router();

const invitationSchema = z.object({
    email: z.string().email('Email inválido'),
    role: z.enum(['SUPERVISOR', 'AGENT']),
});

const orgUpdateSchema = z.object({
    name: z.string().min(2, 'Nombre demasiado corto').optional(),
    email: z.string().email('Email inválido').optional(),
    settings: z.object({
        palette: z.object({
            primary: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Color primario inválido'),
            secondary: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Color secundario inválido'),
            accent: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Color acento inválido'),
            background: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Color de fondo inválido'),
        }).optional()
    }).optional(),
});

// Middleware para verificar que el usuario es ADMIN de la organización
const requireAdmin = async (req: AuthRequest, res: any, next: any) => {
    try {
        const { orgId } = req.params;
        const userId = req.user.id;

        const isAdmin = await coreAdapter.organizations.verifyAdminPrivileges(orgId, userId);

        if (!isAdmin) {
            return res.status(403).json({
                error: { code: 'FORBIDDEN', message: 'Solo los administradores pueden realizar esta acción.' }
            });
        }

        next();
    } catch (error) {
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Error validando permisos.' } });
    }
};

// POST /v1/orgs/:orgId/invitations
router.post('/:orgId/invitations', authMiddleware, requireAdmin, async (req: AuthRequest, res) => {
    const auditCtx = getAuditContext(req);
    try {
        const { orgId } = req.params;
        const data = invitationSchema.parse(req.body);
        const actorId = req.user.id;

        // 1. Seguridad OrgId
        if (req.orgPlan && req.orgPlan.tenantId !== orgId) {
             return res.status(403).json({ 
                error: { code: 'FORBIDDEN_ORG', message: 'No tienes permiso para invitar a esta organización.' } 
            });
        }

        // 2. Validación de Límites
        const { LimitsService } = require('../billing/limits.service');
        const limit = req.orgPlan?.limits?.users;
        const currentCount = await LimitsService.countTeamMembers(orgId);

        if (!LimitsService.check(limit, currentCount)) {
            await GlobalAuditLogService.logEvent({
                category: 'org',
                eventType: 'team.invite.limit_reached',
                severity: 'warning',
                outcome: 'failure',
                message: `Límite de usuarios de equipo alcanzado (${limit}) al intentar invitar a ${data.email}`,
                metadata: { orgId, limit, currentCount, email: data.email }
            }, auditCtx);
            return res.status(403).json({
                error: {
                    code: 'TEAM_LIMIT_REACHED',
                    message: `Has alcanzado el límite de usuarios de tu plan (${limit}).`
                }
            });
        }

        // Verificar si ya es miembro
        const invitedProfile = await CoreInternalService.getProfileByEmail(data.email);

        if (invitedProfile) {
            const existingMember = await coreAdapter.organizations.getMembership(orgId, invitedProfile.id);

            if (existingMember) {
                return res.status(409).json({
                    error: { code: 'ALREADY_MEMBER', message: 'El usuario ya es miembro de esta organización.' }
                });
            }
        }

        const result = await coreAdapter.organizations.inviteMember(orgId, data.email, data.role, actorId);

        await GlobalAuditLogService.logEvent({
            category: 'org',
            eventType: 'team.invite',
            severity: 'info',
            outcome: 'success',
            message: `Invitación enviada a ${data.email} con rol ${data.role}`,
            targetType: 'invitation',
            targetId: result?.id,
            metadata: { email: data.email, role: data.role }
        }, auditCtx);

        res.json({ success: true, message: 'Invitación enviada correctamente.', invitation: result });
    } catch (error: any) {
        await GlobalAuditLogService.logEvent({
            category: 'org',
            eventType: 'team.invite.failed',
            severity: 'critical',
            outcome: 'failure',
            message: `Error al enviar invitación: ${error.message}`,
            metadata: { email: req.body?.email, error: error.message }
        }, auditCtx);
        res.status(400).json({ error: { code: 'INVITATION_ERROR', message: error.message } });
    }
});

// GET /v1/orgs/:orgId/invitations
router.get('/:orgId/invitations', authMiddleware, requireAdmin, async (req: AuthRequest, res) => {
    try {
        const { orgId } = req.params;
        const invitations = await coreAdapter.organizations.getInvitations(orgId);
        res.json(invitations);
    } catch (error: any) {
        res.status(500).json({
            error: { code: 'FETCH_ERROR', message: 'Error al obtener invitaciones.' }
        });
    }
});

// DELETE /v1/orgs/:orgId/invitations/:invitationId
router.delete('/:orgId/invitations/:invitationId', authMiddleware, requireAdmin, async (req: AuthRequest, res) => {
    const auditCtx = getAuditContext(req);
    try {
        const { invitationId, orgId } = req.params;
        await coreAdapter.organizations.revokeInvitation(invitationId, req.user.id);

        await GlobalAuditLogService.logEvent({
            category: 'org',
            eventType: 'team.invite.revoke',
            severity: 'warning',
            outcome: 'success',
            message: `Invitación revocada: ${invitationId}`,
            targetType: 'invitation',
            targetId: invitationId
        }, auditCtx);

        res.json({ success: true, message: 'Invitación revocada.' });
    } catch (error: any) {
        await GlobalAuditLogService.logEvent({
            category: 'org',
            eventType: 'team.invite.revoke.failed',
            severity: 'critical',
            outcome: 'failure',
            message: `Error al revocar invitación: ${error.message}`,
            targetType: 'invitation',
            targetId: req.params.invitationId
        }, auditCtx);
        res.status(400).json({ error: { code: 'REVOKE_ERROR', message: 'Error al revocar la invitación.' } });
    }
});

// PATCH /v1/orgs/:orgId
router.patch('/:orgId', authMiddleware, requireAdmin, async (req: AuthRequest, res) => {
    const auditCtx = getAuditContext(req);
    try {
        const { orgId } = req.params;
        const data = orgUpdateSchema.parse(req.body);

        const currentOrg = await coreAdapter.organizations.getById(orgId);

        const newSettings = {
            ...(currentOrg?.settings as object || {}),
            ...(data.settings || {})
        };

        const updatedOrg = await coreAdapter.organizations.update(orgId, {
            ...(data.name && { name: data.name }),
            ...(data.email && { email: data.email }),
            ...(data.settings && { settings: newSettings }),
        });

        await GlobalAuditLogService.logEvent({
            category: 'org',
            eventType: 'org.update',
            severity: 'info',
            outcome: 'success',
            message: `Configuración de la organización actualizada`,
            targetType: 'organization',
            targetId: orgId,
            newValues: { name: data.name, email: data.email }
        }, auditCtx);

        res.json({ success: true, message: 'Organización actualizada correctamente.', organization: updatedOrg });
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: error.errors[0].message } });
        }
        await GlobalAuditLogService.logEvent({
            category: 'org',
            eventType: 'org.update.failed',
            severity: 'critical',
            outcome: 'failure',
            message: `Error al actualizar la organización: ${error.message}`,
            targetType: 'organization',
            targetId: req.params.orgId
        }, auditCtx);
        res.status(500).json({ error: { code: 'UPDATE_ERROR', message: 'Error al actualizar la organización.' } });
    }
});

// GET /v1/orgs/:orgId/summary
router.get('/:orgId/summary', authMiddleware, requireAdmin, async (req: AuthRequest, res) => {
    try {
        const { orgId } = req.params;

        const { org, membersCount, pendingInvites, storageStats } = await coreAdapter.organizations.getSummary(orgId);

        if (!org) {
            return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Organización no encontrada.' } });
        }

        // 4. Mapeo de respuesta solicitado
        res.json({
            organization: {
                id: org.id,
                name: org.name,
                slug: org.slug,
                logoUrl: (org as any).logoUrl,
                email: org.email,
                status: org.status,
                createdAt: org.createdAt
            },
            plan: {
                name: org.planTemplate?.name || 'Starter',
                billingPeriod: org.planTemplate?.interval || 'monthly',
                price: org.planTemplate?.price || 0,
                currency: org.planTemplate?.currency || 'USD',
                limits: org.planTemplate?.limits || {
                    channels: 3,
                    contacts: 5000,
                    storageMb: 50
                }
            },
            usage: {
                storageMbUsed: Math.round(Number(storageStats?.totalBytes || 0) / (1024 * 1024)),
            },
            stats: {
                membersCount,
                pendingInvites
            }
        });
    } catch (error: any) {
        res.status(500).json({
            error: { code: 'SUMMARY_ERROR', message: 'Error al generar resumen de organización.' }
        });
    }
});

// GET /v1/orgs/:orgId/members
router.get('/:orgId/members', authMiddleware, requireAdmin, async (req: AuthRequest, res) => {
    try {
        const { orgId } = req.params;
        const { limit = '25', cursor } = req.query;

        const members = await coreAdapter.organizations.listMembers(orgId, Number(limit), cursor as string);

        const lastItem = members[members.length - 1];
        const nextCursor = members.length === Number(limit) ? lastItem.id : null;

        res.json({
            items: members.map((m: any) => ({
                userId: m.userId,
                name: m.user?.name,
                email: m.user?.email,
                avatar: m.user?.avatar,
                role: (m.role?.slug || 'AGENT').toUpperCase(),
                twoFactorEnabled: m.user?.has2fa,
                status: m.status.toUpperCase(),
                joinedAt: m.createdAt
            })),
            nextCursor
        });
    } catch (error: any) {
        res.status(500).json({
            error: { code: 'MEMBERS_ERROR', message: 'Error al obtener miembros.' }
        });
    }
});

// POST /v1/orgs/:orgId/members/:userId/suspend
router.post('/:orgId/members/:userId/suspend', authMiddleware, requireAdmin, async (req: AuthRequest, res) => {
    const auditCtx = getAuditContext(req);
    try {
        const { orgId, userId } = req.params;
        const actorId = req.user.id;
        const reason = req.body.reason || null;

        if (actorId === userId) {
            return res.status(400).json({ error: { code: 'SELF_SUSPENSION_BLOCKED', message: 'No puedes suspender tu propia cuenta activa.' } });
        }

        const targetMember = await coreAdapter.organizations.getMembership(orgId, userId);

        if (!targetMember) {
            return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Miembro no encontrado.' } });
        }

        if (targetMember.role?.slug === 'ADMIN' || targetMember.role?.slug === 'SUPER_ADMIN') {
            const activeAdminsCount = await coreAdapter.organizations.countActiveAdmins(orgId, userId);
            if (activeAdminsCount === 0) {
                return res.status(400).json({ error: { code: 'LAST_ADMIN', message: 'No puedes suspender al último administrador activo de la organización.' } });
            }
        }

        await coreAdapter.organizations.updateMemberStatus(targetMember.id, 'suspended', actorId, reason);

        await GlobalAuditLogService.logEvent({
            category: 'org',
            eventType: 'team.member.suspend',
            severity: 'warning',
            outcome: 'success',
            message: `Miembro suspendido. Motivo: ${reason || 'N/A'}`,
            targetType: 'organization_member',
            targetId: targetMember.id,
            metadata: { userId, orgId, reason }
        }, auditCtx);

        res.json({ success: true, message: 'Miembro suspendido correctamente.' });
    } catch (error: any) {
        await GlobalAuditLogService.logEvent({
            category: 'org',
            eventType: 'team.member.suspend.failed',
            severity: 'critical',
            outcome: 'failure',
            message: `Error al suspender miembro: ${error.message}`,
            metadata: { userId: req.params.userId, orgId: req.params.orgId, error: error.message }
        }, auditCtx);
        res.status(500).json({ error: { code: 'SUSPEND_ERROR', message: 'Error al suspender al miembro de la organización.' } });
    }
});

// POST /v1/orgs/:orgId/members/:userId/reactivate
router.post('/:orgId/members/:userId/reactivate', authMiddleware, requireAdmin, async (req: AuthRequest, res) => {
    const auditCtx = getAuditContext(req);
    try {
        const { orgId, userId } = req.params;

        const targetMember = await coreAdapter.organizations.getMembership(orgId, userId);

        if (!targetMember || targetMember.status !== 'suspended') {
            return res.status(400).json({ error: { code: 'INVALID_STATE', message: 'El usuario no está suspendido o no existe.' } });
        }

        await coreAdapter.organizations.updateMemberStatus(targetMember.id, 'active', ''); // El actorId no es obligatorio para reactivar según lógica previa (aunque se limpiaban campos)

        await GlobalAuditLogService.logEvent({
            category: 'org',
            eventType: 'team.member.reactivate',
            severity: 'info',
            outcome: 'success',
            message: `Miembro reactivado`,
            targetType: 'organization_member',
            targetId: targetMember.id,
            metadata: { userId, orgId }
        }, auditCtx);

        res.json({ success: true, message: 'Miembro reactivado correctamente.' });
    } catch (error: any) {
        await GlobalAuditLogService.logEvent({
            category: 'org',
            eventType: 'team.member.reactivate.failed',
            severity: 'critical',
            outcome: 'failure',
            message: `Error al reactivar miembro: ${error.message}`,
            metadata: { userId: req.params.userId, error: error.message }
        }, auditCtx);
        res.status(500).json({ error: { code: 'REACTIVATE_ERROR', message: 'Error al reactivar al miembro.' } });
    }
});

// POST /v1/orgs/:orgId/members/:userId/impersonate
import { preventImpersonation } from '../../middleware/prevent-impersonation.middleware';
import jwt from 'jsonwebtoken';

router.post('/:orgId/members/:userId/impersonate', authMiddleware, requireAdmin, preventImpersonation, async (req: AuthRequest, res) => {
    const auditCtx = getAuditContext(req);
    try {
        const { orgId, userId: targetUserId } = req.params;
        const adminId = req.user.id;
        const reason = req.body.reason || null;

        if (adminId === targetUserId) {
            return res.status(400).json({ error: { code: 'SELF_IMPERSONATION', message: 'No puedes suplantarte a ti mismo.' } });
        }

        const targetMember = await coreAdapter.organizations.getMembership(orgId, targetUserId);

        if (!targetMember) {
            return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Miembro destino no pertenece a esta organización.' } });
        }

        if (targetMember.status === 'suspended') {
            return res.status(400).json({ error: { code: 'TARGET_SUSPENDED', message: 'No se puede suplantar a un usuario actualmente suspendido.' } });
        }

        const session = await coreAdapter.organizations.impersonation.start(orgId, adminId, targetUserId, reason);
        if (!session) throw new Error('No se pudo crear la sesión de suplantación.');

        const secret = requireJwtSecret();
        const proxyToken = jwt.sign(
            {
                ...req.user,
                id: targetUserId,
                sub: targetUserId,
                isImpersonating: true,
                realUserId: adminId,
                impersonationSessionId: session.id,
                exp: Math.floor(Date.now() / 1000) + (60 * 60)
            },
            secret
        );

        await GlobalAuditLogService.logEvent({
            category: 'org',
            eventType: 'team.impersonation.start',
            severity: 'warning',
            outcome: 'success',
            message: `Suplantación de usuario iniciada. Target: ${targetUserId}. Razón: ${reason || 'N/A'}`,
            targetType: 'impersonation_session',
            targetId: session.id,
            metadata: { adminId, targetUserId, orgId, reason }
        }, auditCtx);

        res.json({ success: true, impersonateToken: proxyToken, message: 'Suplantación iniciada con éxito. Redirigiendo entorno...' });
    } catch (error: any) {
        console.error('[Impersonate] Error:', error);
        await GlobalAuditLogService.logEvent({
            category: 'org',
            eventType: 'team.impersonation.start.failed',
            severity: 'critical',
            outcome: 'failure',
            message: `Error al iniciar suplantación: ${error.message}`,
            metadata: { adminId: req.user?.id, targetUserId: req.params.userId, error: error.message }
        }, auditCtx);
        res.status(500).json({ error: { code: 'IMPERSONATE_ERROR', message: 'Fallo al inicializar sesión proxy.' } });
    }
});

// POST /v1/orgs/:orgId/impersonation/stop
router.post('/:orgId/impersonation/stop', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const { orgId } = req.params;
        const sessionId = req.impersonationSessionId;
        const adminId = req.realUserId || req.user.id; // Puede detenerla con proxy token o token real (admin)

        if (!sessionId) {
            // Si el admin usa su token original, intentar buscar si tiene una activa y matarla
            const activeSession = await CoreInternalService.findActiveImpersonationSession(adminId, orgId);

            if (!activeSession) {
                return res.json({ success: true, message: 'Ninguna sesión activa detectada.' });
            }

            await coreAdapter.organizations.impersonation.stop(orgId, adminId, (activeSession as any).id);
            return res.json({ success: true, message: 'Sesión terminada exitosamente.' });
        }

        // Si tiene el token proxy provee el sessionId directo
        await coreAdapter.organizations.impersonation.stop(orgId, adminId, sessionId);
        res.json({ success: true, message: 'Sesión terminada exitosamente.' });

    } catch (error: any) {
        res.status(500).json({ error: { code: 'STOP_ERROR', message: 'Fallo al detener sesión.' } });
    }
});

async function killSession(sessionId: string, adminId: string, req: any, orgId: string) {
    // Esta función parece redundante ahora que el adapter maneja la parada, 
    // pero mantenemos el log de auditoría aquí para que quede en el contexto de la ruta.
    const closedSession = await coreAdapter.organizations.impersonation.stop(orgId, adminId, sessionId);

    if (!closedSession) return;

    const startedAt = (closedSession as any).startedAt || new Date();
    const durationSeconds = Math.floor((new Date().getTime() - new Date(startedAt).getTime()) / 1000);
    const auditCtx = getAuditContext(req);

    await GlobalAuditLogService.logEvent({
        category: 'org',
        eventType: 'team.impersonation.end',
        severity: 'info',
        outcome: 'success',
        message: `Suplantación finalizada. Duración: ${durationSeconds} segundos.`,
        targetType: 'impersonation_session',
        targetId: sessionId,
        metadata: { adminId, orgId, durationSeconds }
    }, auditCtx);
}

export const orgRoutes = router;
