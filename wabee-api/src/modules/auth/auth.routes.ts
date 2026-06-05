import { Router } from 'express';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { coreAdapter } from '../core/core.adapter';
import { CoreInternalService } from '../core/core.internal.service';
import { authMiddleware, AuthRequest } from '../../middleware/auth.middleware';
import { core } from '../../config/core/core.infra';
import jwt from 'jsonwebtoken';
import { coreEnv } from '../../config/core/core.env';
import { GlobalAuditLogService } from '../audit/global-audit-log.service';
import { getAuditContext } from '../../shared/http/request-audit-context';

// Cliente de Supabase Admin (con service key) solo para validación server-side
const supabaseAdmin = createClient(
    coreEnv.SUPABASE_URL,
    coreEnv.SUPABASE_SERVICE_KEY
);

const router = Router();

function setAuthCookie(res: any, token: string) {
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('wabee_token', token, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
    });
}

function clearAuthCookie(res: any) {
    const isProd = process.env.NODE_ENV === 'production';
    res.clearCookie('wabee_token', {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
        path: '/',
    });
}

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
});

const registerSchema = z.object({
    name: z.string().min(2, 'El nombre es obligatorio').optional().or(z.literal('')),
    email: z.string().email('Email inválido'),
    password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
    organizationName: z.string().min(2, 'El nombre de la organización es obligatorio'),
    organizationSlug: z.string().optional(),
    acceptTerms: z.boolean().refine(val => val === true, 'Debes aceptar los términos y condiciones'),
});

const recoverSchema = z.object({
    email: z.string().email(),
});

const twoFactorSchema = z.object({
    challengeId: z.string(),
    code: z.string().length(6),
});

const acceptInvitationSchema = z.object({
    token: z.string(),
    name: z.string().optional(),
    password: z.string().optional(),
});

// POST /v1/auth/login
router.post('/login', async (req, res) => {
    try {
        const data = loginSchema.parse(req.body);
        const result = await coreAdapter.auth.login(data);

        if (result.success && !(result as any).requires2FA && !(result as any).requires2FASetup) {
            await GlobalAuditLogService.logEvent({
                category: 'auth',
                eventType: 'auth.login_success',
                severity: 'info',
                outcome: 'success',
                message: `Inicio de sesión exitoso: ${data.email}`,
                actorEmail: data.email,
                targetType: 'User',
                targetId: result.user?.id
            }, getAuditContext(req));

            if ((result as any).token) {
                setAuthCookie(res, (result as any).token);
            }
        }

        res.json(result);
    } catch (error: any) {
        console.error('❌ Error en login:', error);

        await GlobalAuditLogService.logEvent({
            category: 'auth',
            eventType: 'auth.login_failed',
            severity: 'warning',
            outcome: 'failure',
            message: `Intento de sesión fallido: ${req.body.email}`,
            actorEmail: req.body.email,
            metadata: { error: error.message }
        }, getAuditContext(req));

        res.status(400).json({
            error: {
                code: 'LOGIN_ERROR',
                message: error.message || 'Error al iniciar sesión'
            }
        });
    }
});

// POST /v1/auth/2fa/confirm-setup
router.post('/2fa/confirm-setup', async (req, res) => {
    try {
        console.log('[API] /2fa/confirm-setup body:', req.body);
        const data = twoFactorSchema.parse(req.body);
        const result = await coreAdapter.auth.verify2FA(data as any);
        if (!result.success) {
            return res.status(400).json(result);
        }
        if ((result as any).token) {
            setAuthCookie(res, (result as any).token);
        }
        res.json(result);
    } catch (error: any) {
        res.status(400).json({
            success: false,
            message: error.message || 'Error al confirmar 2FA',
            debug: { body: req.body }
        });
    }
});

// POST /v1/auth/2fa/verify
router.post('/2fa/verify', async (req, res) => {
    try {
        console.log('[API] /2fa/verify body:', req.body);
        const data = twoFactorSchema.parse(req.body);
        const result = await coreAdapter.auth.verify2FA(data as any);
        if (!result.success) {
            return res.status(400).json(result);
        }
        if ((result as any).token) {
            setAuthCookie(res, (result as any).token);
        }
        res.json(result);
    } catch (error: any) {
        res.status(400).json({
            success: false,
            message: error.message || 'Error al verificar 2FA',
            debug: { body: req.body }
        });
    }
});

// POST /v1/auth/logout
router.post('/logout', (req, res) => {
    clearAuthCookie(res);
    res.json({ success: true });
});

// POST /v1/auth/invitations/accept
router.post('/invitations/accept', async (req, res) => {
    try {
        const data = acceptInvitationSchema.parse(req.body);
        const result = await coreAdapter.organizations.acceptInvitation(data);
        res.json(result);
    } catch (error: any) {
        res.status(400).json({
            error: { code: 'ACCEPT_ERROR', message: error.message }
        });
    }
});

// POST /v1/auth/register
router.post('/register', async (req, res) => {
    try {
        const data = registerSchema.parse(req.body);
        const result = await coreAdapter.auth.register(data as any);

        if ((result as any).success) {
            try {
                const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
                const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
                    type: 'magiclink',
                    email: data.email,
                    options: { redirectTo: `${frontendUrl}/auth/callback` }
                });
                const verificationLink = (linkData as any)?.properties?.action_link;
                if (verificationLink) {
                    const userName = data.name || data.email.split('@')[0];
                    await core.notifications.send({
                        to: data.email,
                        channel: 'email',
                        templateName: 'VERIFY_EMAIL',
                        data: {
                            user_name: userName,
                            org_name: data.organizationName,
                            link: verificationLink,
                            verification_link: verificationLink
                        }
                    });
                    console.log(`[authRoutes] ✅ Verification email sent to ${data.email}`);
                }
            } catch (emailError: any) {
                console.error('[authRoutes] Non-blocking: Failed to send verification email:', emailError.message);
            }
        }

        res.json(result);
    } catch (error: any) {
        console.error('❌ Error en registro:', error);
        res.status(400).json({
            error: {
                code: 'REGISTER_ERROR',
                message: error.message || 'Error al registrar usuario'
            }
        });
    }
});

// POST /v1/auth/confirm-verification
// Recibe el access_token de Supabase, verifica que el email esté confirmado
// y actualiza el perfil local de pending_verification → active
router.post('/confirm-verification', async (req, res) => {
    try {
        const { access_token } = req.body;

        if (!access_token) {
            return res.status(400).json({
                error: { code: 'MISSING_TOKEN', message: 'Se requiere el access_token de Supabase.' }
            });
        }

        const verificationResult = await (core.auth as any).verifyEmail.execute({
            token: access_token
        }, req.ip);

        // Verificar el token con Supabase Admin para obtener el usuario real
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(access_token);

        if (error || !user) {
            return res.status(401).json({
                error: { code: 'INVALID_SUPABASE_TOKEN', message: 'Token de Supabase inválido o expirado.' }
            });
        }

        if (!user.email_confirmed_at) {
            return res.status(400).json({
                error: { code: 'EMAIL_NOT_CONFIRMED', message: 'El email aún no está confirmado en Supabase.' }
            });
        }

        console.log(`[authRoutes] Intento de confirmación para user ID: ${user.id} (${user.email})`);

        // Actualizar el perfil local: status 'active' y emailVerifiedAt
        try {
            await CoreInternalService.updateProfile(user.id, {
                status: 'active',
                emailVerifiedAt: user.email_confirmed_at ? new Date(user.email_confirmed_at) : new Date(),
                updatedAt: new Date()
            });
            console.log(`[authRoutes] ✅ Perfil local activado para ${user.email}.`);
        } catch (updateErr: any) {
            console.warn(`[authRoutes] ⚠️ No se pudo actualizar perfil tras verificación: ${updateErr.message}`);
        }

        // Completar Onboarding (Crear Tenant + Admin)
        // Se ejecuta después de la verificación exitosa del email
        const onboardingResult = await (coreAdapter.auth as any).completeOnboarding(user.id, user.email);

        console.log(`✅ Verificación confirmada para ${user.email}. Onboarding procesado.`, onboardingResult);

        res.json({
            success: true,
            message: 'Correo verificado correctamente. Organización configurada.',
            onboarding: onboardingResult,
            verification: verificationResult
        });
    } catch (error: any) {
        console.error('❌ Error en confirm-verification:', error);
        res.status(500).json({
            error: { code: 'CONFIRM_ERROR', message: error.message || 'Error al confirmar la verificación.' }
        });
    }
});

// POST /v1/auth/recover
router.post('/recover', async (req, res) => {
    try {
        const data = recoverSchema.parse(req.body);
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

        const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
            type: 'recovery',
            email: data.email,
            options: { redirectTo: `${frontendUrl}/auth/callback` }
        });

        if (!linkError && (linkData as any)?.properties?.action_link) {
            const recoveryLink = (linkData as any).properties.action_link;
            const profile = await CoreInternalService.getProfileByEmail(data.email);
            try {
                const userName = profile?.name || data.email.split('@')[0];
                await core.notifications.send({
                    to: data.email,
                    channel: 'email',
                    templateName: 'PASSWORD_RESET',
                    data: {
                        user_name: userName,
                        link: recoveryLink,
                        expires_in: '24 horas',
                    }
                });
                console.log(`[authRoutes] ✅ Recovery email sent to ${data.email}`);
            } catch (emailError: any) {
                console.error('[authRoutes] Non-blocking: Failed to send recovery email:', emailError.message);
            }
        }

        // Always return success to avoid revealing if email exists
        res.json({ success: true, message: 'Si el correo existe, recibirás un enlace de recuperación.' });
    } catch (error: any) {
        res.status(400).json({
            error: {
                code: 'RECOVERY_ERROR',
                message: error.message || 'Error al procesar recuperación'
            }
        });
    }
});

// GET /v1/auth/me
router.get('/me', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const userId = req.user.id;
        const profile = await CoreInternalService.getProfileById(userId);

        if (!profile) {
            return res.status(404).json({
                error: {
                    code: 'PROFILE_NOT_FOUND',
                    message: 'Perfil de usuario no encontrado.'
                }
            });
        }

        res.json({
            success: true,
            user: {
                id: profile.id,
                email: profile.email,
                name: profile.name,
                avatar: profile.avatar,
                role: profile.globalRole?.slug || 'user'
            }
        });
    } catch (error: any) {
        res.status(401).json({
            error: {
                code: 'AUTH_ME_ERROR',
                message: 'No se pudo obtener el perfil del usuario.'
            }
        });
    }
});

// GET /v1/auth/profile — Perfil completo del usuario logueado
router.get('/profile', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const userId = req.user.id;
        const profile = await CoreInternalService.getProfileById(userId);
        if (!profile) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Perfil no encontrado' } });
        res.json({ success: true, profile: {
            id: profile.id,
            email: profile.email,
            name: profile.name,
            avatar: profile.avatar,
            has2fa: profile.has2fa,
            preferences: profile.preferences
        }});
    } catch (err: any) {
        res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
    }
});

// PUT /v1/auth/profile — Actualizar nombre, avatar y preferencias
router.put('/profile', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const userId = req.user.id;
        let { name, avatar, preferences } = req.body;

        // Si el avatar es una cadena Base64 (procedente del frontend), subirlo al Core SaaS Buckets
        if (avatar && avatar.startsWith('data:image/')) {
            console.log(`[authRoutes] Detectado avatar en Base64 para usuario ${userId}. Subiendo a SaaS Buckets...`);
            try {
                const uploadResult = await coreAdapter.auth.uploadAvatar(userId, avatar);
                avatar = uploadResult.url; // Reemplazamos el Base64 por la URL persistente final
                console.log(`[authRoutes] Avatar subido con éxito al bucket. URL: ${avatar}`);
            } catch (uploadError: any) {
                console.error('[authRoutes] Falló la subida al bucket, procediendo con base64 temporal:', uploadError.message);
                // Opcional: Podríamos fallar aquí o dejar que guarde base64 si el bucket falla
            }
        }

        const updated = await CoreInternalService.updateProfile(userId, {
            ...(name !== undefined && { name }),
            ...(avatar !== undefined && { avatar }),
            ...(preferences !== undefined && { preferences }),
            updatedAt: new Date()
        });
        res.json({ success: true, profile: {
            id: updated.id,
            email: updated.email,
            name: updated.name,
            avatar: updated.avatar,
            preferences: updated.preferences
        }});
    } catch (err: any) {
        res.status(500).json({ error: { code: 'UPDATE_ERROR', message: err.message } });
    }
});

// POST /v1/auth/change-password — Cambiar contraseña usando Supabase
router.post('/change-password', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const { newPassword } = req.body;
        if (!newPassword || newPassword.length < 8) {
            return res.status(400).json({ error: { code: 'INVALID_PASSWORD', message: 'La contraseña debe tener al menos 8 caracteres.' } });
        }
        const userId = req.user.id;
        const profile = await CoreInternalService.getProfileById(userId);
        if (!profile) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Perfil no encontrado' } });

        // Actualizar contraseña vía Supabase Admin
        const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword });
        if (error) throw new Error(error.message);

        res.json({ success: true, message: 'Contraseña actualizada correctamente.' });
    } catch (err: any) {
        res.status(500).json({ error: { code: 'PASSWORD_ERROR', message: err.message } });
    }
});

// POST /v1/auth/2fa/init-setup — Genera o regenera el QR de 2FA para configuración desde perfil
router.post('/2fa/init-setup', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const userId = req.user.id;

        const setupResult = await coreAdapter.auth.setup2FA(userId);
        if (!setupResult.success) {
            return res.status(400).json({ error: { code: 'SETUP_ERROR', message: setupResult.message || 'Error al inicializar 2FA' } });
        }

        const challengeId = jwt.sign(
            { id: userId, type: '2FA_SETUP' } as any,
            coreEnv.JWT_SECRET,
            { expiresIn: '15m' }
        );

        res.json({ success: true, qrCode: setupResult.qrCode, challengeId, secret: setupResult.secret });
    } catch (err: any) {
        res.status(500).json({ error: { code: 'SETUP_ERROR', message: err.message } });
    }
});

// POST /v1/auth/2fa/verify-and-enable — Verifica código y activa 2FA (desde perfil, no login)
router.post('/2fa/verify-and-enable', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const { code } = req.body;
        if (!code) {
            return res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'El código OTP es requerido.' } });
        }

        const userId = req.user.id;
        const result = await coreAdapter.auth.activate2FA(userId, code);

        if (!result.success) {
            return res.status(400).json({ success: false, message: result.message || 'Código incorrecto. Intenta de nuevo.' });
        }

        res.json({ success: true, message: result.message || '2FA activado correctamente.' });
    } catch (err: any) {
        res.status(500).json({ error: { code: 'VERIFY_ERROR', message: err.message } });
    }
});

// POST /v1/auth/2fa/disable — Deshabilitar 2FA
router.post('/2fa/disable', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const userId = req.user.id;
        const result = await coreAdapter.auth.deactivate2FA(userId);

        if (!result.success) {
            return res.status(400).json({ error: { code: 'DISABLE_ERROR', message: result.message || 'Error al deshabilitar 2FA' } });
        }

        res.json({ success: true, message: result.message || '2FA deshabilitado correctamente.' });
    } catch (err: any) {
        res.status(500).json({ error: { code: 'DISABLE_ERROR', message: err.message } });
    }
});

export const authRoutes = router;
