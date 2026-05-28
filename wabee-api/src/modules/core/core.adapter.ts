import { core } from '../../config/core/core.infra';
import { corePrisma } from '../../config/core/core.prisma';
import { generateUniqueSlug } from '../../shared/helpers/slug.helper';
import { createClient } from '@supabase/supabase-js';
import { generateSecret, generateURI, verify } from 'otplib';
import jwt from 'jsonwebtoken';
import { coreEnv } from '../../config/core/core.env';
import { CoreInternalService } from './core.internal.service';
import QRCode from 'qrcode';

/**
 * Adapter para el R4D Core.
 * Orquestador principal para Auth, Tenancy y RBAC.
 */
const supabaseAuth = createClient(coreEnv.SUPABASE_URL, coreEnv.SUPABASE_SERVICE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

export const coreAdapter = {
    auth: {
        uploadAvatar: async (userId: string, base64: string) => {
            const memberships = await CoreInternalService.getUserMemberships(userId);
            const tenantId = memberships[0]?.organization?.id;

            if (!tenantId) throw new Error('El usuario no pertenece a ninguna organización para subir archivos.');

            // 2. Extraer buffer de Base64
            // Formato esperado: data:image/png;base64,iVBOR...
            const matches = base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (!matches || matches.length !== 3) {
                throw new Error('Formato de imagen Base64 inválido.');
            }

            const mimeType = matches[1];
            const buffer = Buffer.from(matches[2], 'base64');
            const extension = mimeType.split('/')[1] || 'png';
            const fileName = `avatar_${userId}_${Date.now()}.${extension}`;

            // 3. Limpieza: Buscar y eliminar avatares anteriores del mismo usuario
            try {
                const oldMedia = await CoreInternalService.getMediaFilesByUser(tenantId, userId, 'Profile', 'avatars');

                if (oldMedia.length > 0) {
                    console.log(`[coreAdapter] Deleting ${oldMedia.length} old avatar files for user ${userId}...`);
                    for (const m of oldMedia) {
                        await core.media.delete.execute({
                            mediaId: m.id,
                            tenantId,
                            actorId: userId
                        });
                    }
                }
            } catch (cleanupErr: any) {
                console.warn('[coreAdapter] Non-critical error during avatar cleanup:', cleanupErr.message);
            }

            // 4. Llamar al Core para subir el archivo
            const result = await core.media.upload.execute({
                tenantId,
                file: buffer,
                fileName,
                mimeType,
                isPublic: true,
                uploadedBy: userId,
                mediableType: 'Profile',
                mediableId: userId,
                collection: 'avatars'
            });

            if (!result.success) {
                console.error('[coreAdapter] Upload failed:', result);
                throw new Error(result.error || 'Error al subir la imagen al bucket.');
            }

            // 4. Obtener URL pública
            const urlResult = await core.media.getUrl.execute({
                mediaId: result.value.id,
                tenantId
            });

            if (!urlResult.success) {
                throw new Error(urlResult.error || 'Error al obtener URL del archivo.');
            }

            return {
                id: result.value.id,
                url: urlResult.value.url
            };
        },
        register: async (params: {
            name: string;
            email: string;
            password: any;
            organizationName: string;
            organizationSlug?: string;
            ip?: string;
        }) => {
            const existingProfile = await CoreInternalService.getProfileByEmail(params.email);
            if (existingProfile) {
                const { data: authUserData, error: authUserError } = await supabaseAuth.auth.admin.getUserById(existingProfile.id);
                if (authUserError || !authUserData?.user) {
                    await corePrisma.organizationMember.deleteMany({
                        where: { userId: existingProfile.id }
                    }).catch(() => {});
                    await corePrisma.profile.delete({
                        where: { id: existingProfile.id }
                    }).catch(() => {});
                    await corePrisma.invitation.deleteMany({
                        where: { email: params.email }
                    }).catch(() => {});
                }
            }

            // 1. Registro Core (User + Profile)
            const regResult = await core.auth.register.execute({
                name: params.name || 'User',
                email: params.email,
                password: params.password,
                productSlug: 'wabee'
            } as any, params.ip);

            if (!(regResult as any).success) return regResult;

            const userId = (regResult as any).user.id;

            // 2. Guardar "intención" de organización
            await CoreInternalService.updateProfile(userId, {
                preferences: {
                    onboarding: {
                        organizationName: params.organizationName,
                        organizationSlug: params.organizationSlug
                    }
                }
            });

            return regResult;
        },
        completeOnboarding: async (userId: string, email: string) => {
            try {
                const profile = await CoreInternalService.getProfileById(userId);

                if (!profile) throw new Error('Perfil no encontrado');

                const onboardingData = (profile.preferences as any)?.onboarding;
                if (!onboardingData) return;

                const { organizationName, organizationSlug } = onboardingData;
                const baseSlugSource = organizationSlug || organizationName;
                const wabeeProduct = await CoreInternalService.getProductBySlug('wabee');
                let slug = await generateUniqueSlug(baseSlugSource);
                let orgResult = await core.organization.create.execute(
                    { id: userId },
                    {
                        name: organizationName,
                        slug,
                        email: email,
                        productId: wabeeProduct?.id || undefined
                    }
                );

                if (!orgResult.success && (orgResult as any).errorCode === 'ORG_EXISTS') {
                    slug = await generateUniqueSlug(baseSlugSource);
                    orgResult = await core.organization.create.execute(
                        { id: userId },
                        {
                            name: organizationName,
                            slug,
                            email: email,
                            productId: wabeeProduct?.id || undefined
                        }
                    );
                }

                if (!orgResult.success) {
                    throw new Error(orgResult.error);
                }
                const org = orgResult.value;

                const adminRole = await CoreInternalService.getRoleBySlug('admin');
                if (adminRole) {
                    await CoreInternalService.updateOrganizationMemberRole(org.id, userId, adminRole.id);
                }

                // ── Asignar Plan Trial automáticamente ──────────────────────────────
                try {
                    const { BillingService } = require('../billing/billing.service');
                    
                    const allPlans = await CoreInternalService.getActivePlanTemplates(wabeeProduct?.id);
                    const freePlan = allPlans.find((p: any) => (p.metadata as any)?.code === 'FREE');
                    const onboardingPlan = freePlan;

                    if (onboardingPlan) {
                        const onboardingVersion = await CoreInternalService.getPlanVersion(onboardingPlan.id);

                        if (onboardingVersion) {
                            const now = new Date();
                            const periodEnd = new Date(now);
                            periodEnd.setMonth(periodEnd.getMonth() + 1);

                            await BillingService.activatePlan(org.id, onboardingVersion.id, {
                                status: 'ACTIVE',
                                periodStart: now,
                                periodEnd,
                                period: 'monthly',
                            });
                            let activeSubscription = await corePrisma.subscription.findFirst({
                                where: {
                                    tenantId: org.id,
                                    status: { in: ['ACTIVE', 'TRIAL_ACTIVE', 'PAST_DUE'] }
                                },
                                orderBy: { createdAt: 'desc' },
                                select: { id: true }
                            });

                            if (!activeSubscription) {
                                const snapshot = {
                                    planId: onboardingPlan.id,
                                    planVersionId: onboardingVersion.id,
                                    planCode: (onboardingPlan.metadata as any)?.code || onboardingPlan.name,
                                    planName: onboardingPlan.name,
                                    displayCode: onboardingVersion.displayCode || null,
                                    versionNumber: onboardingVersion.versionNumber || 1,
                                    price: Number(onboardingVersion.monthlyPrice ?? onboardingVersion.price ?? 0),
                                    monthlyPrice: Number(onboardingVersion.monthlyPrice ?? 0),
                                    annualPrice: Number(onboardingVersion.annualPrice ?? 0),
                                    currency: onboardingVersion.currency || 'mxn',
                                    billingInterval: 'month',
                                    limits: onboardingVersion.limitsJson || {},
                                    features: onboardingVersion.featuresJson || {},
                                    capabilities: onboardingVersion.capabilitiesJson || {},
                                    modules: onboardingVersion.modulesJson || {},
                                    snapshotCreatedAt: now.toISOString(),
                                };

                                await corePrisma.subscription.updateMany({
                                    where: {
                                        tenantId: org.id,
                                        status: { in: ['ACTIVE', 'TRIAL_ACTIVE', 'PAST_DUE'] }
                                    },
                                    data: { status: 'CANCELED', endedAt: now }
                                });

                                activeSubscription = await corePrisma.subscription.create({
                                    data: {
                                        tenantId: org.id,
                                        planTemplateId: onboardingPlan.id,
                                        planVersionId: onboardingVersion.id,
                                        externalId: `onboarding_${Date.now()}`,
                                        status: 'ACTIVE',
                                        currentPeriodStart: now,
                                        currentPeriodEnd: periodEnd,
                                        snapshotJson: snapshot,
                                        priceSnapshot: snapshot.price,
                                        currencySnapshot: snapshot.currency,
                                        billingIntervalSnapshot: snapshot.billingInterval,
                                        planCodeSnapshot: snapshot.planCode,
                                        planNameSnapshot: snapshot.planName,
                                        featuresSnapshot: snapshot.features,
                                        limitsSnapshot: snapshot.limits,
                                        modulesSnapshot: snapshot.modules,
                                        capabilitiesSnapshot: snapshot.capabilities,
                                        versionNumberSnapshot: snapshot.versionNumber,
                                        snapshotCreatedAt: now,
                                    },
                                    select: { id: true }
                                });
                            }

                            await corePrisma.organization.update({
                                where: { id: org.id },
                                data: { planTemplateId: onboardingPlan.id }
                            });

                            console.log(`[completeOnboarding] ✅ Plan ${(onboardingPlan.metadata as any)?.code || onboardingPlan.name} activado vía BillingService para org ${org.id}`);
                        }
                    } else {
                        console.warn(`[completeOnboarding] ⚠️ No se encontró plan FREE activo para onboarding en Wabee.`);
                    }
                } catch (trialErr: any) {
                    console.warn(`[completeOnboarding] Error al asignar plan inicial (no crítico): ${trialErr.message}`);
                }
                // ────────────────────────────────────────────────────────────────────

                const currentPrefs = typeof profile.preferences === 'object' ? profile.preferences : {};
                const { onboarding, ...otherPrefs } = currentPrefs as any;

                await CoreInternalService.updateProfile(userId, { preferences: otherPrefs });

                return { success: true, organization: org };
            } catch (error: any) {
                console.error('Error completing onboarding:', error);
                throw error;
            }
        },
        recover: async (params: { email: string }) => {
            return core.auth.forgotPassword.execute(params);
        },
        resetPassword: async (params: { token: string; newPassword: any }) => {
            return core.auth.resetPassword.execute({
                token: params.token,
                password: params.newPassword
            });
        },
    },
    billing: {
    },
    profiles: {
        getById: async (userId: string) => {
            return CoreInternalService.getProfileById(userId);
        },
        getAuthorInfo: async (userId: string, tenantId: string) => {
            return CoreInternalService.getAuthorInfo(userId, tenantId);
        },
        listAuthorsInfo: async (userIds: string[], tenantId: string) => {
            return CoreInternalService.listAuthorsInfo(userIds, tenantId);
        }
    },
    organizations: {
        getById: async (orgId: string) => {
            return CoreInternalService.getOrganizationById(orgId);
        },
        update: async (orgId: string, data: any) => {
            return CoreInternalService.updateOrganization(orgId, data);
        },
        getSummary: async (orgId: string) => {
            const [org, membersCount, pendingInvites, storageStats] = await Promise.all([
                CoreInternalService.getOrganizationById(orgId),
                CoreInternalService.countMembers(orgId),
                CoreInternalService.countPendingInvitations(orgId),
                CoreInternalService.getStorageStats(orgId)
            ]);

            return { org, membersCount, pendingInvites, storageStats };
        },
        listMembers: async (orgId: string, limit: number, cursor?: string) => {
            return CoreInternalService.listMembers(orgId, limit, cursor);
        },
        getMembership: async (orgId: string, userId: string) => {
            return CoreInternalService.getMembership(orgId, userId);
        },
        updateMemberStatus: async (memberId: string, status: string, actorId: string, reason?: string) => {
            return CoreInternalService.updateMemberStatus(memberId, {
                status,
                suspendedAt: status === 'suspended' ? new Date() : null,
                suspendedBy: status === 'suspended' ? actorId : null,
                suspensionReason: status === 'suspended' ? (reason || null) : null
            });
        },
        getStats: () => CoreInternalService.getOrganizationStats(),
        list: (params: {
            page: number;
            pageSize: number;
            search?: string;
            status?: string;
            plan?: string;
            sortBy?: string;
            sortOrder?: 'asc' | 'desc';
        }) => CoreInternalService.listOrganizations(params),
        listMembersByOrgId: (orgId: string) => CoreInternalService.listOrganizationMembers(orgId),
        findByEmail: (email: string) => CoreInternalService.getOrganizationByEmail(email),
        getBySlug: (slug: string) => CoreInternalService.getOrganizationBySlug(slug),
        countActiveAdmins: async (orgId: string, excludeUserId?: string) => {
            // TODO: Mover lógica compleja de conteo de roles a CoreInternalService
            const members = await CoreInternalService.listMembersByRoles(orgId, ['ADMIN', 'SUPER_ADMIN']);
            return members.filter(m => 
                m.status === 'active' && 
                m.userId !== excludeUserId
            ).length;
        },
        listAssignableMembers: async (tenantId: string) => {
            return CoreInternalService.listMembersByRoles(tenantId, ['ADMIN', 'SUPERVISOR', 'AGENT']);
        },
        listMembersByRoles: async (tenantId: string, roleSlugs: string[]) => {
            return CoreInternalService.listMembersByRoles(tenantId, roleSlugs);
        },
        verifyAdminPrivileges: async (orgId: string, userId: string): Promise<boolean> => {
            const membership = await CoreInternalService.getMembership(orgId, userId);
            const roleSlug = (membership?.role?.slug || '').toUpperCase();
            return roleSlug === 'ADMIN' || roleSlug === 'SUPER_ADMIN';
        },
        impersonation: {
            start: async (orgId: string, adminId: string, targetUserId: string, reason?: string) => {
                return CoreInternalService.createImpersonationSession({
                    tenantId: orgId,
                    adminUserId: adminId,
                    targetUserId: targetUserId,
                    reason
                });
            },
            stop: async (orgId: string, adminId: string, sessionId?: string) => {
                const sessionToStop = sessionId 
                    ? { id: sessionId } 
                    : await CoreInternalService.findActiveImpersonationSession(adminId, orgId);

                if (!sessionToStop || (sessionToStop as any).id === undefined) return null;

                return CoreInternalService.updateImpersonationSession((sessionToStop as any).id, {
                    isActive: false,
                    endedAt: new Date(),
                    endedBy: adminId
                });
            }
        },
        inviteMember: async (orgId: string, email: string, roleSlug: string, invitedById: string) => {
            const [member, resolvedRole] = await Promise.all([
                CoreInternalService.getMembership(orgId, invitedById),
                CoreInternalService.getRoleBySlug(roleSlug)
            ]);

            if (!resolvedRole) throw new Error(`Rol no encontrado: ${roleSlug}`);

            const roleSlugActor = (member?.role?.slug || '').toUpperCase();
            const isSuper = roleSlugActor === 'SUPER_ADMIN' || roleSlugActor === 'ADMIN';

            return core.organization.inviteMember.execute(
                { id: invitedById },
                { email, roleId: resolvedRole.id, organizationId: orgId },
                { isSuperAdmin: isSuper }
            );
        },
        getInvitations: async (orgId: string) => {
            return CoreInternalService.getInvitationsByTenant(orgId);
        },
        revokeInvitation: async (invitationId: string, _actorId: string) => {
            return CoreInternalService.deleteInvitation(invitationId);
        },
        acceptInvitation: async (params: { token: string, name?: string, password?: string }) => {
            const invitation = await CoreInternalService.findInvitationByToken(params.token);

            if (!invitation) throw new Error('Invitación no encontrada o inválida');
            if (invitation.acceptedAt) throw new Error('Esta invitación ya fue aceptada');
            if (new Date() > new Date(invitation.expiresAt)) throw new Error('La invitación ha expirado');

            // --- Real Enforcement de Capacidad ---
            const { BillingService } = require('../billing/billing.service');
            const { LimitsService } = require('../billing/limits.service');
            
            // Obtener plan del tenant de la invitación
            const orgPlan = await BillingService.getOrganizationPlan(invitation.tenantId);
            const limit = orgPlan?.limitsSnapshot?.users;
            const currentCount = await LimitsService.countTeamMembers(invitation.tenantId);
            
            if (!LimitsService.check(limit, currentCount - 1)) {
                throw new Error(`No se puede aceptar la invitación: La organización ha alcanzado el límite de usuarios de su plan (${limit}).`);
            }
            // -------------------------------------

            // 2. Verificar si el usuario existe
            let userId: string;
            const existingUser = await CoreInternalService.getProfileByEmail(invitation.email);

            if (existingUser) {
                userId = existingUser.id;
            } else {
                // Crear usuario si no existe (Registro simplificado)
                if (!params.password) throw new Error('Se requiere contraseña para crear tu cuenta');

                const regResult = await core.auth.register.execute({
                    name: params.name || 'User',
                    email: invitation.email,
                    password: params.password,
                    productSlug: 'wabee'
                } as any);

                if (!regResult.success || !regResult.user) throw new Error(regResult.message || 'Error al crear cuenta');
                userId = regResult.user.id;
            }

            // 3. Aceptar invitación en el core
            const result = await core.organization.acceptInvitation.execute(
                { id: userId },
                { token: params.token }
            );

            return {
                success: true,
                user: { id: userId, email: invitation.email },
                organizationId: invitation.tenantId,
                role: result.role
            };
        }
    },
    notifications: {
        create: (data: { userId: string, title: string, message: string, type: string }) => 
            CoreInternalService.createNotification(data),
        list: (userId: string, limit?: number) => 
            CoreInternalService.getNotifications(userId, limit),
        markAsRead: (id: string, userId: string) => 
            CoreInternalService.markNotificationAsRead(id, userId),
        markAllAsRead: (userId: string) => 
            CoreInternalService.markAllNotificationsAsRead(userId),
    },

    /**
     * Gestión de configuración global del sistema
     */
    system: {
        getSetting: (key: string) => CoreInternalService.getSystemSetting(key),
        upsertSetting: (data: { 
            key: string, 
            value: any, 
            userId?: string, 
            actionName?: string, 
            ip?: string, 
            userAgent?: string 
        }) => CoreInternalService.upsertSystemSetting(data),
        deleteSetting: (key: string, userId?: string, ip?: string, userAgent?: string) => 
            CoreInternalService.deleteSystemSetting(key, userId, ip, userAgent),
        deleteManySettings: (keys: string[], userId?: string, ip?: string, userAgent?: string) => 
            CoreInternalService.deleteManySystemSettings(keys, userId, ip, userAgent),
        
        /** Auditoría Global */
        audit: {
            list: (params: {
                page: number;
                pageSize: number;
                search?: string;
                category?: string;
                severity?: string;
                outcome?: string;
            }) => CoreInternalService.listGlobalAuditEvents(params),
            getById: (id: string) => CoreInternalService.getGlobalAuditEventById(id)
        },

        /** Privacidad y Gestión de Datos */
        privacy: {
            createRequest: (data: any) => CoreInternalService.createDataDeletionRequest(data),
            listRequests: () => CoreInternalService.listDataDeletionRequests(),
            getRequestById: (id: string) => CoreInternalService.getDataDeletionRequestById(id),
            updateStatus: (id: string, status: string, reviewerId?: string) => 
                CoreInternalService.updateDataDeletionRequestStatus(id, { status, reviewerId }),
            deleteRequest: (id: string) => CoreInternalService.deleteDataDeletionRequest(id)
        },

        /** Log de Auditoría (AuditTrail) */
        createAuditLog: (data: any) => CoreInternalService.createAuditTrail(data),
        findFirstAuditLog: (where: any) => CoreInternalService.findFirstAuditTrail(where),

        /** Webhook Events */
        createWebhookEvent: (data: { tenantId: string, provider: string, eventId: string, eventType: string }) => 
            CoreInternalService.createWebhookEvent(data),
    }
} as any;

/** Extensiones dinámicas para compatibilidad y completitud */

// Autenticación y Suplantación
// Autenticación y Suplantación
(coreAdapter as any).auth.impersonation = {
    start: async (data: any) => CoreInternalService.createImpersonationSession(data),
    stop: async (sessionId: string, data: any) => CoreInternalService.updateImpersonationSession(sessionId, data),
    findActive: async (adminUserId: string, tenantId: string) => 
        CoreInternalService.findActiveImpersonationSession(adminUserId, tenantId),
    getSession: async (sessionId: string) => CoreInternalService.getImpersonationSessionById(sessionId),
    getMembershipDetailed: async (tenantId: string, userId: string) => 
        CoreInternalService.getMembershipDetailed(tenantId, userId),
};

// Wrapper de compatibilidad para código que espera la llamada directa
(coreAdapter as any).auth.impersonate = async (data: any) => {
    return (coreAdapter as any).auth.impersonation.start(data);
};

// Asegurar que getMembership esté disponible en organizations (ya está, pero reafirmamos para claridad si fuera necesario)
// Nota: ya existe en la línea 429.

(coreAdapter as any).auth.login = async (params: { email: string; password: any; ip?: string; userAgent?: string }) => {
    const { data, error } = await supabaseAuth.auth.signInWithPassword({
        email: params.email,
        password: params.password || '',
    });

    if (error || !data.user || !data.session) {
        throw new Error('Credenciales invalidas');
    }

    const userId = data.user.id;
    const profile = await CoreInternalService.getProfileById(userId);
    if (!profile) throw new Error(`Failed to find user ${userId}`);
    if (!profile.emailVerifiedAt) throw new Error('Tu correo aun no ha sido verificado.');
    if (profile.status === 'suspended') throw new Error('Tu cuenta esta suspendida.');

    let productSlug: string | null = null;
    if (profile.globalRole?.productId) {
        const product = await CoreInternalService.getProductById(profile.globalRole.productId);
        productSlug = product?.slug || null;
    }

    const baseUser = {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        role: profile.globalRole?.slug || 'user',
        productSlug,
        has_2fa: profile.has2fa,
        preferences: profile.preferences
    };

    if (profile.has2fa) {
        const challengeId = jwt.sign(
            { id: userId, email: profile.email, type: '2FA_VERIFY' } as any,
            coreEnv.JWT_SECRET as string,
            { expiresIn: '10m' }
        );

        return {
            success: true,
            requires2FA: true,
            challengeId,
            tempToken: challengeId,
            user: baseUser
        };
    }

    const isAdminRole = profile.globalRole?.slug?.toLowerCase().includes('admin');
    if (isAdminRole) {
        const secret = profile.twoFactorSecret || generateSecret();
        if (!profile.twoFactorSecret) {
            await CoreInternalService.updateProfile(userId, { twoFactorSecret: secret });
        }

        const otpauth = generateURI({ secret, label: profile.email, issuer: 'Core SaaS 1.0' });
        const qrCode = await QRCode.toDataURL(otpauth);
        const challengeId = jwt.sign(
            { id: userId, email: profile.email, type: '2FA_SETUP' } as any,
            coreEnv.JWT_SECRET as string,
            { expiresIn: '10m' }
        );

        return {
            success: true,
            requires2FASetup: true,
            challengeId,
            tempToken: challengeId,
            qrCode,
            user: baseUser
        };
    }

    const memberships = await CoreInternalService.getUserMemberships(userId);
    const customToken = jwt.sign(
        { id: userId, email: profile.email, globalRole: profile.globalRole?.slug },
        coreEnv.JWT_SECRET as string,
        { expiresIn: '24h' }
    );

    return {
        success: true,
        token: customToken,
        user: {
            ...baseUser,
            avatar: profile.avatar,
            globalRole: profile.globalRole?.slug,
            preferences: profile.preferences
        },
        organizations: memberships.map((m: any) => ({
            id: m.organization.id,
            name: m.organization.name,
            slug: m.organization.slug,
            role: m.role?.slug || 'member'
        }))
    };
};

(coreAdapter as any).auth.verify2FA = async (params: { challengeId: string, code: string }) => {
    const decoded = jwt.verify(params.challengeId, coreEnv.JWT_SECRET) as any;
    const userId = decoded.id;
    const profile = await CoreInternalService.getProfileById(userId);
    if (!profile) throw new Error('Reto de 2FA invalido o expirado');
    if (!profile.twoFactorSecret) throw new Error('Reto de 2FA invalido o expirado');

    const verified = verify({ secret: profile.twoFactorSecret, token: params.code });
    if (!verified) throw new Error('Codigo de verificacion incorrecto');

    if (!profile.has2fa) {
        await CoreInternalService.updateProfile(userId, { has2fa: true });
    }

    const token = jwt.sign(
        { id: profile.id, email: profile.email, globalRole: profile.globalRole?.slug },
        coreEnv.JWT_SECRET as string,
        { expiresIn: '24h' }
    );

    const memberships = await CoreInternalService.getUserMemberships(profile.id);

    return {
        success: true,
        token,
        user: {
            id: profile.id,
            email: profile.email,
            name: profile.name,
            avatar: profile.avatar,
            globalRole: profile.globalRole?.slug,
            preferences: profile.preferences
        },
        organizations: memberships.map((m: any) => ({
            id: m.organization.id,
            name: m.organization.name,
            slug: m.organization.slug,
            role: m.role?.slug || 'member'
        }))
    };
};

(coreAdapter as any).auth.setup2FA = async (userId: string) => {
    const profile = await CoreInternalService.getProfileById(userId);
    if (!profile) return { success: false, message: 'Perfil no encontrado' };

    const secret = generateSecret();
    await CoreInternalService.updateProfile(userId, { twoFactorSecret: secret });
    const otpauth = generateURI({ secret, label: profile.email, issuer: 'Core SaaS 1.0' });
    const qrCode = await QRCode.toDataURL(otpauth);

    return { success: true, secret, qrCode };
};

(coreAdapter as any).auth.activate2FA = async (userId: string, code: string) => {
    const profile = await CoreInternalService.getProfileById(userId);
    if (!profile?.twoFactorSecret) return { success: false, message: '2FA no inicializado' };
    const verified = verify({ secret: profile.twoFactorSecret, token: code });
    if (!verified) return { success: false, message: 'Codigo de verificacion incorrecto' };
    await CoreInternalService.updateProfile(userId, { has2fa: true });
    return { success: true, message: '2FA activado correctamente.' };
};

(coreAdapter as any).auth.deactivate2FA = async (userId: string) => {
    await CoreInternalService.updateProfile(userId, {
        has2fa: false,
        twoFactorSecret: null
    });
    return { success: true, message: '2FA deshabilitado correctamente.' };
};

