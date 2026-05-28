import { getPrisma } from '@r4d-26/core';
import { prisma } from '../../config/core/core.prisma';
import {
    CoreSubscriptionDTO,
    CorePlanVersionDTO,
    CoreMembershipDTO,
    CoreProfileDTO,
    CoreOrganizationDTO,
    CoreSystemSettingDTO,
    CorePlanTemplateDTO,
    CoreTenantStorageStatsDTO,
    CoreImpersonationSessionDTO,
    CoreAuthorInfoDTO,
    CoreOrganizationStatsDTO,
    CoreOrganizationListItemDTO,
    CorePaginatedResponseDTO,
    CoreOrganizationMemberListItemDTO,
    CoreGlobalAuditEventDTO,
    CoreDataDeletionRequestDTO
} from './core.types';

// Lazy accessor for the package's CorePrismaClient (initialized by AuthFactory.initialize())
const getCorePrisma = () => getPrisma() as any;

/**
 * CoreInternalService
 * Único punto de acceso directo a Prisma para modelos del esquema "core".
 * Devuelve únicamente DTOs para evitar filtración de tipos Prisma.
 */
export class CoreInternalService {
    private static async getProfileRowBy(field: 'id' | 'email', value: string): Promise<any | null> {
        const db = getCorePrisma() as any;
        const rows: any[] = await db.$queryRawUnsafe(
            `
            select
                p.id,
                p.email,
                p.name,
                p.avatar,
                p.status::text as status,
                p.has_2fa as "has2fa",
                p.preferences,
                p.two_factor_secret as "twoFactorSecret",
                p.email_verified_at as "emailVerifiedAt",
                p.global_role_id as "globalRoleId",
                r.id as "roleId",
                r.name as "roleName",
                r.slug as "roleSlug",
                r.product_id as "roleProductId"
            from core.profiles p
            left join core.roles r on r.id = p.global_role_id
            where p.${field} = $1
            limit 1
            `,
            value
        );

        return rows[0] || null;
    }

    private static mapProfileRow(row: any): CoreProfileDTO {
        return {
            id: row.id,
            email: row.email,
            name: row.name,
            avatar: row.avatar,
            status: row.status,
            has2fa: Boolean(row.has2fa),
            preferences: row.preferences || {},
            twoFactorSecret: row.twoFactorSecret,
            emailVerifiedAt: row.emailVerifiedAt,
            globalRoleId: row.globalRoleId,
            globalRole: row.roleId ? {
                id: row.roleId,
                name: row.roleName,
                slug: row.roleSlug,
                productId: row.roleProductId
            } : null
        };
    }

    /**
     * Obtiene la suscripción activa de una organización.
     */
    static async getSubscriptionByTenant(tenantId: string): Promise<CoreSubscriptionDTO | null> {
        const sub = await getCorePrisma().subscription.findFirst({
            where: {
                tenantId,
                status: { in: ['ACTIVE', 'TRIAL_ACTIVE', 'PAST_DUE'] },
            },
            orderBy: [
                { createdAt: 'desc' },
                { id: 'desc' }
            ],
            include: { planTemplate: true }
        });

        if (!sub) return null;

        return sub as unknown as CoreSubscriptionDTO;
    }

    /**
     * Obtiene una versión de plan específica (raw SQL — core.plan_versions es propiedad del paquete).
     */
    static async getPlanVersion(planTemplateId: string): Promise<CorePlanVersionDTO | null> {
        const rows: any[] = await getCorePrisma().$queryRaw`
            SELECT
                id,
                plan_template_id   AS "planTemplateId",
                version_number     AS "versionNumber",
                display_code       AS "displayCode",
                price::float       AS price,
                monthly_price::float AS "monthlyPrice",
                annual_price::float  AS "annualPrice",
                currency,
                billing_interval   AS "billingInterval",
                limits_json        AS "limitsJson",
                features_json      AS "featuresJson",
                capabilities_json  AS "capabilitiesJson",
                modules_json       AS "modulesJson",
                stripe_price_monthly_id AS "stripePriceMonthlyId",
                stripe_price_annual_id  AS "stripePriceAnnualId",
                is_current         AS "isCurrent"
            FROM core.plan_versions
            WHERE plan_template_id = ${planTemplateId}::UUID
              AND is_current = true
              AND is_published = true
              AND deleted_at IS NULL
            LIMIT 1
        `;

        if (!rows.length) return null;
        return rows[0] as CorePlanVersionDTO;
    }

    /**
     * Busca los planes activos para onboarding/billing.
     */
    static async getActivePlanTemplates(productId?: string): Promise<CorePlanTemplateDTO[]> {
        return getCorePrisma().planTemplate.findMany({
            where: {
                isActive: true,
                deletedAt: null,
                ...(productId ? { productId } : {}),
            },
            select: { id: true, name: true, metadata: true }
        }) as unknown as CorePlanTemplateDTO[];
    }

    /**
     * Obtiene la membresía de un usuario en una organización.
     */
    static async getMembership(tenantId: string, userId: string): Promise<CoreMembershipDTO | null> {
        const membership = await getCorePrisma().organizationMember.findUnique({
            where: {
                tenantId_userId: {
                    tenantId,
                    userId
                }
            },
            select: {
                id: true,
                tenantId: true,
                userId: true,
                status: true,
                createdAt: true,
                role: { select: { id: true, name: true, slug: true } },
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        avatar: true,
                        has2fa: true,
                        preferences: true,
                        twoFactorSecret: true
                    }
                }
            }
        });

        if (!membership) return null;

        return membership as unknown as CoreMembershipDTO;
    }

    /**
     * Obtiene un rol por su slug (insensible a mayúsculas).
     */
    static async getRoleBySlug(slug: string): Promise<{ id: string; name: string; slug: string } | null> {
        return getCorePrisma().role.findFirst({
            where: { slug: { equals: slug, mode: 'insensitive' } },
            select: { id: true, name: true, slug: true }
        }) as unknown as { id: string; name: string; slug: string } | null;
    }

    /**
     * Busca membresías por usuario (para login).
     */
    static async getUserMemberships(userId: string): Promise<CoreMembershipDTO[]> {
        return getCorePrisma().organizationMember.findMany({
            where: { userId },
            select: {
                organization: { select: { id: true, name: true, slug: true } },
                role: { select: { name: true, slug: true } }
            }
        }) as unknown as CoreMembershipDTO[];
    }

    /**
     * Cuenta el número de miembros activos en una organización.
     */
    static async countMembers(tenantId: string, status: string = 'active'): Promise<number> {
        return getCorePrisma().organizationMember.count({
            where: { tenantId, status: status as any }
        });
    }

    /**
     * Cuenta el número de invitaciones pendientes en una organización.
     */
    static async countPendingInvitations(tenantId: string): Promise<number> {
        return getCorePrisma().invitation.count({
            where: { tenantId, acceptedAt: null }
        });
    }

    /**
     * Obtiene las estadísticas de almacenamiento de una organización.
     */
    static async getStorageStats(tenantId: string): Promise<CoreTenantStorageStatsDTO | null> {
        return getCorePrisma().tenantStorageStats.findUnique({
            where: { tenantId }
        }) as unknown as CoreTenantStorageStatsDTO;
    }

    /**
     * Obtiene un perfil por ID.
     */
    static async getProfileById(userId: string): Promise<CoreProfileDTO | null> {
        const row = await this.getProfileRowBy('id', userId);
        return row ? this.mapProfileRow(row) : null;
    }

    /**
     * Obtiene un perfil por Email.
     */
    static async getProfileByEmail(email: string): Promise<CoreProfileDTO | null> {
        const row = await this.getProfileRowBy('email', email);
        return row ? this.mapProfileRow(row) : null;
    }

    /**
     * Obtiene una organización por slug.
     */
    static async getOrganizationBySlug(slug: string): Promise<CoreOrganizationDTO | null> {
        const org = await getCorePrisma().organization.findUnique({
            where: { slug }
        });

        if (!org) return null;

        return org as CoreOrganizationDTO;
    }

    /**
     * Actualiza un perfil.
     */
    static async updateProfile(userId: string, data: any): Promise<CoreProfileDTO> {
        const updated = await getCorePrisma().profile.update({
            where: { id: userId },
            data,
            select: {
                id: true,
                email: true,
                name: true,
                avatar: true,
                status: true,
                has2fa: true,
                preferences: true,
                twoFactorSecret: true,
                emailVerifiedAt: true,
                globalRoleId: true
            }
        });

        const role = updated.globalRoleId
            ? await getCorePrisma().role.findUnique({
                where: { id: updated.globalRoleId },
                select: { id: true, name: true, slug: true, productId: true }
            })
            : null;

        return {
            ...updated,
            globalRole: role
        } as CoreProfileDTO;
    }

    /**
     * Asegura que la infraestructura de configuración exista.
     */
    private static async ensureSettingsInfrastructure() {
        try {
            await getCorePrisma().$executeRawUnsafe(`
                CREATE SCHEMA IF NOT EXISTS core;
                CREATE TABLE IF NOT EXISTS core.system_settings (
                    key TEXT PRIMARY KEY,
                    value JSONB NOT NULL DEFAULT '{}',
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                );
            `);
        } catch (dbErr) {
            console.warn("[CoreInternalService] No se pudo auto-crear tabla de settings (puede que ya exista o permisos insuficientes):", dbErr);
        }
    }

    /**
     * Obtiene una configuración del sistema.
     */
    static async getSystemSetting(key: string): Promise<CoreSystemSettingDTO | null> {
        try {
            const setting = await getCorePrisma().systemSetting.findUnique({
                where: { key }
            });
            return setting as unknown as CoreSystemSettingDTO;
        } catch (err) {
            return null;
        }
    }

    /**
     * Actualiza o crea una configuración del sistema.
     */
    static async upsertSystemSetting(data: { key: string, value: any, userId?: string, actionName?: string, ip?: string, userAgent?: string }): Promise<CoreSystemSettingDTO> {
        await this.ensureSettingsInfrastructure();

        const { key, value, userId, actionName, ip, userAgent } = data;

        const oldSetting = await this.getSystemSetting(key);

        const setting = await getCorePrisma().systemSetting.upsert({
            where: { key },
            update: { value, updatedAt: new Date() },
            create: { key, value }
        });

        // Auditoría automática
        if (userId) {
            await getCorePrisma().auditTrail.create({
                data: {
                    userId: userId === 'SYSTEM' ? null : userId,
                    userType: userId === 'SYSTEM' ? 'SYSTEM' : 'USER',
                    action: actionName || 'update_system_setting',
                    modelType: 'SystemSetting',
                    modelId: key,
                    oldValues: oldSetting?.value || {},
                    newValues: value,
                    ipAddress: ip,
                    userAgent: userAgent,
                    description: `Actualización de configuración: ${key}`
                }
            });
        }

        return setting as CoreSystemSettingDTO;
    }

    /**
     * Elimina una configuración del sistema.
     */
    static async deleteSystemSetting(key: string, userId?: string, ip?: string, userAgent?: string): Promise<void> {
        const oldSetting = await this.getSystemSetting(key);

        await getCorePrisma().systemSetting.delete({
            where: { key }
        }).catch(() => {});

        if (userId && oldSetting) {
            await getCorePrisma().auditTrail.create({
                data: {
                    userId: userId === 'SYSTEM' ? null : userId,
                    userType: userId === 'SYSTEM' ? 'SYSTEM' : 'USER',
                    action: 'delete_system_setting',
                    modelType: 'SystemSetting',
                    modelId: key,
                    oldValues: oldSetting.value as any,
                    newValues: {},
                    ipAddress: ip,
                    userAgent: userAgent,
                    description: `Eliminación de configuración: ${key}`
                }
            });
        }
    }

    /**
     * Elimina múltiples configuraciones del sistema.
     */
    static async deleteManySystemSettings(keys: string[], userId?: string, ip?: string, userAgent?: string): Promise<void> {
        const oldSettings = await getCorePrisma().systemSetting.findMany({
            where: { key: { in: keys } }
        });

        await getCorePrisma().systemSetting.deleteMany({
            where: { key: { in: keys } }
        });

        if (userId && oldSettings.length > 0) {
            await getCorePrisma().auditTrail.create({
                data: {
                    userId: userId === 'SYSTEM' ? null : userId,
                    userType: userId === 'SYSTEM' ? 'SYSTEM' : 'USER',
                    action: 'reset_system_settings',
                    modelType: 'SystemSetting',
                    modelId: null,
                    oldValues: oldSettings as any,
                    newValues: {},
                    ipAddress: ip,
                    userAgent: userAgent,
                    description: `Reinicio de configuraciones: ${keys.join(', ')}`
                }
            });
        }
    }

    /**
     * Obtiene una organización por ID.
     */
    static async getOrganizationById(orgId: string): Promise<CoreOrganizationDTO | null> {
        const org = await getCorePrisma().organization.findUnique({
            where: { id: orgId },
            include: { planTemplate: true }
        });

        if (!org) return null;

        return org as unknown as CoreOrganizationDTO;
    }

    /**
     * Actualiza una organización.
     */
    static async updateOrganization(orgId: string, data: any): Promise<CoreOrganizationDTO> {
        return getCorePrisma().organization.update({
            where: { id: orgId },
            data
        }) as unknown as CoreOrganizationDTO;
    }

    /**
     * Lista los miembros de una organización con paginación.
     */
    static async listMembers(orgId: string, limit: number, cursor?: string): Promise<CoreMembershipDTO[]> {
        const members = await getCorePrisma().organizationMember.findMany({
            where: { tenantId: orgId },
            take: limit,
            ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
            select: {
                id: true,
                tenantId: true,
                userId: true,
                status: true,
                createdAt: true,
                role: { select: { id: true, name: true, slug: true } },
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        avatar: true,
                        has2fa: true,
                        preferences: true,
                        twoFactorSecret: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return members as CoreMembershipDTO[];
    }

    /**
     * Actualiza el estado de un miembro de la organización.
     */
    static async updateMemberStatus(memberId: string, data: any): Promise<CoreMembershipDTO> {
        return getCorePrisma().organizationMember.update({
            where: { id: memberId },
            data
        }) as unknown as CoreMembershipDTO;
    }

    /**
     * Crea una sesión de suplantación (wabee.impersonation_sessions).
     */
    static async createImpersonationSession(data: any): Promise<CoreImpersonationSessionDTO> {
        return prisma.impersonationSession.create({
            data
        }) as unknown as CoreImpersonationSessionDTO;
    }

    /**
     * Busca una sesión de suplantación activa.
     */
    static async findActiveImpersonationSession(adminUserId: string, tenantId: string): Promise<CoreImpersonationSessionDTO | null> {
        return prisma.impersonationSession.findFirst({
            where: { adminUserId, tenantId, isActive: true }
        }) as unknown as CoreImpersonationSessionDTO;
    }

    /**
     * Actualiza (finaliza) una sesión de suplantación.
     */
    static async updateImpersonationSession(sessionId: string, data: any): Promise<CoreImpersonationSessionDTO> {
        return prisma.impersonationSession.update({
            where: { id: sessionId },
            data
        }) as unknown as CoreImpersonationSessionDTO;
    }

    /**
     * Obtiene una sesión de suplantación por ID.
     */
    static async getImpersonationSessionById(sessionId: string): Promise<CoreImpersonationSessionDTO | null> {
        return prisma.impersonationSession.findUnique({
            where: { id: sessionId }
        }) as unknown as CoreImpersonationSessionDTO;
    }

    /**
     * Obtiene un miembro con detalles de usuario y organización (para suplantación).
     */
    static async getMembershipDetailed(tenantId: string, userId: string): Promise<any | null> {
        return getCorePrisma().organizationMember.findUnique({
            where: { tenantId_userId: { tenantId, userId } },
            include: {
                user: { select: { id: true, email: true, name: true, avatar: true, has2fa: true } },
                organization: { select: { id: true, name: true, slug: true } }
            }
        });
    }

    /**
     * Lista los miembros de una organización filtrados por roles.
     */
    static async listMembersByRoles(tenantId: string, roleSlugs: string[]): Promise<CoreMembershipDTO[]> {
        const members = await getCorePrisma().organizationMember.findMany({
            where: {
                tenantId,
                status: 'active',
                role: { slug: { in: roleSlugs } }
            },
            select: {
                id: true,
                tenantId: true,
                userId: true,
                status: true,
                createdAt: true,
                role: { select: { id: true, name: true, slug: true } },
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        avatar: true,
                        has2fa: true,
                        preferences: true,
                        twoFactorSecret: true
                    }
                }
            }
        });

        return members as CoreMembershipDTO[];
    }

    /**
     * Obtiene la información básica de un autor (Nombre + Rol) para el Inbox.
     */
    static async getAuthorInfo(userId: string, tenantId: string): Promise<CoreAuthorInfoDTO | null> {
        const profile = await getCorePrisma().profile.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                memberships: {
                    where: { tenantId },
                    select: { role: { select: { name: true } } }
                }
            }
        });

        if (!profile) return null;

        return {
            id: profile.id,
            name: profile.name,
            role: profile.memberships?.[0]?.role?.name || 'Staff'
        };
    }

    /**
     * Obtiene la información de múltiples autores para el Inbox.
     */
    static async listAuthorsInfo(userIds: string[], tenantId: string): Promise<CoreAuthorInfoDTO[]> {
        const profiles = await getCorePrisma().profile.findMany({
            where: { id: { in: userIds } },
            select: {
                id: true,
                name: true,
                memberships: {
                    where: { tenantId },
                    select: { role: { select: { name: true } } }
                }
            }
        });

        return profiles.map((p: any) => ({
            id: p.id,
            name: p.name,
            role: p.memberships?.[0]?.role?.name || 'Staff'
        }));
    }


    /**
     * Crea una invitación.
     */
    static async createInvitation(data: any) {
        return getCorePrisma().invitation.create({
            data
        });
    }

    /**
     * Obtiene estadísticas globales de organizaciones y miembros para Super Admin.
     *
     * @description Este método centraliza KPIs clave:
     * - Total de organizaciones (Prisma count)
     * - Usuarios activos totales (Prisma count en OrganizationMember)
     * - Plan más popular (SQL Raw): Se usa SQL raw porque requiere un COUNT(DISTINCT)
     *   y agrupamiento complejo sobre el snapshot de suscripciones que Prisma
     *   no maneja eficientemente en una sola consulta de agregado.
     * - Crecimiento (30 días): Comparativa de base instalada.
     */
    static async getOrganizationStats(): Promise<CoreOrganizationStatsDTO> {
        const wabeeProduct = await getCorePrisma().product.findFirst({
            where: { slug: { equals: 'wabee', mode: 'insensitive' } },
            select: { id: true }
        });

        const wabeeWhere = wabeeProduct ? { productId: wabeeProduct.id } : { productId: null };

        const totalOrganizations = await getCorePrisma().organization.count({
            where: wabeeWhere
        });

        const activeUsers = await getCorePrisma().organizationMember.count({
            where: {
                status: 'active',
                organization: wabeeWhere
            }
        });

        // SQL Raw para el plan más popular
        // Tablas tocadas: core.subscriptions
        // Propósito: Identificar qué plan (por nombre en snapshot) tiene más organizaciones únicas activas.
        const popularPlanResult: any[] = await getCorePrisma().$queryRaw`
            SELECT s.plan_name_snapshot as name, COUNT(DISTINCT s.organization_id) as active_orgs
            FROM core.subscriptions s
            INNER JOIN core.organizations o ON o.id = s.organization_id
            WHERE s.status IN ('ACTIVE', 'TRIAL_ACTIVE')
              AND (s.current_period_end IS NULL OR s.current_period_end > NOW())
              AND s.price_snapshot > 0
              AND o.product_id = ${wabeeProduct?.id || null}
            GROUP BY s.plan_name_snapshot
            ORDER BY active_orgs DESC
            LIMIT 1
        `;

        let topPlanName = 'Configurando...';
        let topPlanCount = 0;

        if (popularPlanResult.length > 0) {
            topPlanName = popularPlanResult[0].name || 'Plan de Pago';
            topPlanCount = Number(popularPlanResult[0].active_orgs) || 0;
        }

        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

        const last30DaysOrgs = await getCorePrisma().organization.count({
            where: {
                ...wabeeWhere,
                createdAt: { gte: thirtyDaysAgo, lte: now }
            }
        });

        const totalPrevious = totalOrganizations - last30DaysOrgs;
        let growthPercentage = 0;
        if (totalPrevious > 0) {
            growthPercentage = ((totalOrganizations - totalPrevious) / totalPrevious) * 100;
        } else if (totalOrganizations > 0) {
            growthPercentage = 100;
        }

        return {
            totalOrganizations,
            activeUsers,
            topPlanName,
            topPlanCount,
            growthPercentage: parseFloat(growthPercentage.toFixed(1))
        };
    }

    /**
     * Lista organizaciones con soporte para paginación, búsqueda y filtros.
     * Encapsula la lógica compleja de resolución de planes y conteos.
     */
    static async listOrganizations(params: {
        page: number;
        pageSize: number;
        search?: string;
        status?: string;
        plan?: string;
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
    }): Promise<CorePaginatedResponseDTO<CoreOrganizationListItemDTO>> {
        const { page, pageSize, search, status, plan, sortBy = 'createdAt', sortOrder = 'desc' } = params;
        const skip = (page - 1) * pageSize;

        const wabeeProduct = await getCorePrisma().product.findFirst({
            where: { slug: { equals: 'wabee', mode: 'insensitive' } },
            select: { id: true }
        });

        // Incluir orgs sin productId asignado (migración) y las del producto wabee
        const productFilter: any = wabeeProduct
            ? [{ productId: wabeeProduct.id }, { productId: null }]
            : [];
        const where: any = productFilter.length ? { OR: productFilter } : {};

        if (search) {
            const searchConditions: any[] = [
                { name: { contains: search, mode: 'insensitive' } },
                { slug: { contains: search, mode: 'insensitive' } }
            ];
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (uuidRegex.test(search)) {
                searchConditions.push({ id: search });
            }
            where.AND = [
                ...(productFilter.length ? [{ OR: productFilter }] : []),
                { OR: searchConditions }
            ];
            delete where.OR;
        }

        if (status) {
            where.status = status;
        }

        if (plan) {
            where.planTemplate = { name: { contains: plan, mode: 'insensitive' } };
        }

        const [organizations, total] = await Promise.all([
            getCorePrisma().organization.findMany({
                where,
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    status: true,
                    createdAt: true,
                    updatedAt: true,
                    planTemplate: {
                        select: { name: true, price: true }
                    },
                    _count: {
                        select: { members: { where: { status: 'active' } } }
                    },
                    subscriptions: {
                        select: {
                            planNameSnapshot: true,
                            priceSnapshot: true,
                            snapshotJson: true,
                            planTemplate: { select: { name: true, price: true } }
                        }
                    }
                },
                skip,
                take: pageSize,
                orderBy: { [sortBy as any]: sortOrder }
            }),
            getCorePrisma().organization.count({ where })
        ]);

        const items: CoreOrganizationListItemDTO[] = organizations.map((org: any) => {
            const activeSub = org.subscriptions?.[0] || null;
            const fallbackPlan = org.planTemplate;

            let planName = 'FREE';
            let isPro = false;

            if (activeSub) {
                planName = activeSub.planNameSnapshot || (activeSub.snapshotJson as any)?.planName || activeSub.planTemplate?.name || 'FREE';
                const priceStr = activeSub.priceSnapshot ?? (activeSub.snapshotJson as any)?.price ?? activeSub.planTemplate?.price;
                const price = Number(priceStr);
                isPro = !isNaN(price) && price > 0;
            } else if (fallbackPlan) {
                planName = fallbackPlan.name;
                isPro = Number(fallbackPlan.price) > 0;
            }

            return {
                id: org.id,
                name: org.name,
                slug: org.slug,
                status: org.status,
                plan: {
                    name: planName,
                    isPro
                },
                usersCount: org._count.members,
                createdAt: org.createdAt,
                updatedAt: org.updatedAt
            };
        });

        return {
            items,
            pagination: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize)
            }
        };
    }

    /**
     * Lista los miembros de una organización específica con datos de usuario y rol.
     */
    static async listOrganizationMembers(orgId: string): Promise<CoreOrganizationMemberListItemDTO[]> {
        const members = await getCorePrisma().organizationMember.findMany({
            where: { tenantId: orgId },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        avatar: true,
                        has2fa: true
                    }
                },
                role: true
            },
            orderBy: { createdAt: 'desc' }
        });

        return members.map((m: any) => ({
            id: m.id,
            userId: m.userId,
            email: m.user?.email,
            name: m.user?.name,
            avatar: m.user?.avatar,
            role: m.role?.slug || 'member',
            status: m.status,
            joinedAt: m.createdAt,
            has2fa: m.user?.has2fa || false
        }));
    }

    /**
     * Obtiene una organización por email (para validación de privacidad).
     */
    static async getOrganizationByEmail(email: string): Promise<CoreOrganizationDTO | null> {
        return getCorePrisma().organization.findFirst({
            where: { email }
        }) as unknown as CoreOrganizationDTO;
    }

    /**
     * Registra un evento de auditoría global (wabee.global_audit_events).
     */
    static async createGlobalAuditEvent(data: any): Promise<void> {
        const { actorType, ...rest } = data;
        const actorTypeValue: string = actorType || 'system';

        await prisma.global_audit_events.create({
            data: {
                tenant_id: rest.tenantId ?? null,
                affected_tenant_id: rest.affectedTenantId ?? null,
                actor_type: actorTypeValue,
                actor_user_id: rest.actorUserId ?? null,
                actor_email: rest.actorEmail ?? null,
                actor_role: rest.actorRole ?? null,
                event_type: rest.eventType ?? 'unknown',
                category: rest.category ?? 'system',
                severity: rest.severity ?? 'info',
                outcome: rest.outcome ?? 'success',
                target_type: rest.targetType ?? null,
                target_id: rest.targetId ?? null,
                target_label: rest.targetLabel ?? null,
                ip_address: rest.ipAddress ?? null,
                user_agent: rest.userAgent ?? null,
                request_id: rest.requestId ?? null,
                correlation_id: rest.correlationId ?? null,
                message: rest.message ?? '',
                old_values: rest.oldValues ?? undefined,
                new_values: rest.newValues ?? undefined,
                metadata: rest.metadata ?? undefined,
                is_sensitive: rest.isSensitive ?? false,
                is_impersonation: rest.isImpersonation ?? false,
            }
        });
    }

    /**
     * Lista eventos de auditoría global con paginación y filtros.
     */
    static async listGlobalAuditEvents(params: {
        page: number;
        pageSize: number;
        search?: string;
        category?: string;
        severity?: string;
        outcome?: string;
    }): Promise<CorePaginatedResponseDTO<CoreGlobalAuditEventDTO>> {
        const { page, pageSize, search, category, severity, outcome } = params;
        const skip = (page - 1) * pageSize;

        const where: any = {};
        if (category) where.category = category;
        if (severity) where.severity = severity;
        if (outcome) where.outcome = outcome;

        if (search) {
            where.OR = [
                { message: { contains: search, mode: 'insensitive' } },
                { actor_email: { contains: search, mode: 'insensitive' } },
                { target_label: { contains: search, mode: 'insensitive' } },
                { event_type: { contains: search, mode: 'insensitive' } },
            ];
        }

        const [rawItems, total] = await Promise.all([
            prisma.global_audit_events.findMany({
                where,
                orderBy: { created_at: 'desc' },
                skip,
                take: pageSize,
            }),
            prisma.global_audit_events.count({ where }),
        ]);

        const items: CoreGlobalAuditEventDTO[] = rawItems.map((r: any) => ({
            id: r.id,
            createdAt: r.created_at,
            tenantId: r.tenant_id,
            affectedTenantId: r.affected_tenant_id,
            actorType: r.actor_type,
            actorUserId: r.actor_user_id,
            actorEmail: r.actor_email,
            actorRole: r.actor_role,
            eventType: r.event_type,
            category: r.category,
            severity: r.severity,
            outcome: r.outcome,
            targetType: r.target_type,
            targetId: r.target_id,
            targetLabel: r.target_label,
            ipAddress: r.ip_address,
            userAgent: r.user_agent,
            requestId: r.request_id,
            correlationId: r.correlation_id,
            message: r.message,
            oldValues: r.old_values,
            newValues: r.new_values,
            metadata: r.metadata,
            isSensitive: r.is_sensitive,
            isImpersonation: r.is_impersonation,
        }));

        return {
            items,
            pagination: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize),
            },
        };
    }

    /**
     * Obtiene un evento de auditoría por ID.
     */
    static async getGlobalAuditEventById(id: string): Promise<CoreGlobalAuditEventDTO | null> {
        const r = await prisma.global_audit_events.findUnique({ where: { id } });
        if (!r) return null;
        return {
            id: r.id,
            createdAt: r.created_at,
            tenantId: r.tenant_id,
            affectedTenantId: r.affected_tenant_id,
            actorType: r.actor_type,
            actorUserId: r.actor_user_id,
            actorEmail: r.actor_email,
            actorRole: r.actor_role,
            eventType: r.event_type,
            category: r.category,
            severity: r.severity,
            outcome: r.outcome,
            targetType: r.target_type,
            targetId: r.target_id,
            targetLabel: r.target_label,
            ipAddress: r.ip_address,
            userAgent: r.user_agent,
            requestId: r.request_id,
            correlationId: r.correlation_id,
            message: r.message,
            oldValues: r.old_values,
            newValues: r.new_values,
            metadata: r.metadata,
            isSensitive: r.is_sensitive,
            isImpersonation: r.is_impersonation,
        } as CoreGlobalAuditEventDTO;
    }

    /**
     * Crea una solicitud de eliminación de datos (SQL Raw para campos no mapeados).
     */
    static async createDataDeletionRequest(data: {
        id: string;
        fullName: string;
        email: string;
        phone?: string;
        description?: string;
        status: string;
        hasMatch: boolean;
        internalNote?: string
    }): Promise<void> {
        await getCorePrisma().$executeRawUnsafe(`
            INSERT INTO core.data_deletion_requests (id, full_name, email, phone, description, status, has_match, internal_note)
            VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8)
        `, data.id, data.fullName, data.email, data.phone, data.description, data.status, data.hasMatch, data.internalNote);
    }

    /**
     * Lista todas las solicitudes de eliminación de datos (SQL Raw).
     */
    static async listDataDeletionRequests(): Promise<CoreDataDeletionRequestDTO[]> {
        const results = await getCorePrisma().$queryRawUnsafe(`
            SELECT
                id,
                full_name as "fullName",
                email,
                phone,
                description,
                status,
                has_match as "hasMatch",
                internal_note as "internalNote",
                requested_at as "requestedAt",
                reviewed_at as "reviewedAt",
                reviewed_by as "reviewedBy",
                completed_at as "completedAt",
                created_at as "createdAt",
                updated_at as "updatedAt"
            FROM core.data_deletion_requests
            ORDER BY requested_at DESC
        `);
        return results as CoreDataDeletionRequestDTO[];
    }

    /**
     * Obtiene una solicitud de eliminación por ID (SQL Raw).
     */
    static async getDataDeletionRequestById(id: string): Promise<CoreDataDeletionRequestDTO | null> {
        const results = await getCorePrisma().$queryRawUnsafe(`
            SELECT
                id,
                full_name as "fullName",
                email,
                phone,
                description,
                status,
                has_match as "hasMatch",
                internal_note as "internalNote",
                requested_at as "requestedAt",
                reviewed_at as "reviewedAt",
                reviewed_by as "reviewedBy",
                completed_at as "completedAt",
                created_at as "createdAt",
                updated_at as "updatedAt"
            FROM core.data_deletion_requests
            WHERE id = $1::uuid
        `, id);

        const list = results as any[];
        return (list && list.length > 0) ? list[0] : null;
    }

    /**
     * Actualiza el estado de una solicitud de eliminación (SQL Raw).
     */
    static async updateDataDeletionRequestStatus(id: string, data: { status: string; reviewerId?: string }): Promise<void> {
        const { status, reviewerId } = data;
        if (reviewerId) {
            await getCorePrisma().$executeRawUnsafe(`
                UPDATE core.data_deletion_requests
                SET status = $1,
                    reviewed_by = $2::uuid,
                    reviewed_at = NOW(),
                    completed_at = CASE WHEN $1 = 'COMPLETED' THEN NOW() ELSE completed_at END
                WHERE id = $3::uuid
            `, status, reviewerId, id);
        } else {
            await getCorePrisma().$executeRawUnsafe(`
                UPDATE core.data_deletion_requests
                SET status = $1,
                    completed_at = CASE WHEN $1 = 'COMPLETED' THEN NOW() ELSE completed_at END
                WHERE id = $2::uuid
            `, status, id);
        }
    }

    /**
     * Elimina una solicitud de eliminación (SQL Raw).
     */
    static async deleteDataDeletionRequest(id: string): Promise<void> {
        await getCorePrisma().$executeRawUnsafe(`
            DELETE FROM core.data_deletion_requests
            WHERE id = $1::uuid
        `, id);
    }

    /**
     * Registra un evento en el log de auditoría (core.audit_trail).
     */
    static async createAuditTrail(data: any): Promise<void> {
        const safeData = { ...data };
        if (safeData.userId === 'SYSTEM') {
            safeData.userId = null;
            safeData.userType = 'SYSTEM';
        }
        await getCorePrisma().auditTrail.create({ data: safeData });
    }

    /**
     * Crea una notificación para un usuario.
     */
    static async createNotification(data: { userId: string, title: string, message: string, type: string }): Promise<any> {
        return getCorePrisma().notification.create({
            data: {
                userId: data.userId,
                title: data.title,
                message: data.message,
                type: data.type
            }
        });
    }

    /**
     * Obtiene notificaciones de un usuario.
     */
    static async getNotifications(userId: string, limit: number = 50): Promise<any[]> {
        return getCorePrisma().notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: limit
        });
    }

    /**
     * Marca una notificación como leída.
     */
    static async markNotificationAsRead(id: string, userId: string): Promise<any> {
        return getCorePrisma().notification.update({
            where: { id, userId },
            data: { isRead: true }
        });
    }

    /**
     * Marca todas las notificaciones de un usuario como leídas.
     */
    static async markAllNotificationsAsRead(userId: string): Promise<any> {
        return getCorePrisma().notification.updateMany({
            where: { userId, isRead: false },
            data: { isRead: true }
        });
    }

    /**
     * Registra un evento de webhook (wabee.webhook_events — para idempotencia).
     */
    static async createWebhookEvent(data: { tenantId: string, provider: string, eventId: string, eventType: string }): Promise<any> {
        return prisma.webhookEvent.create({ data });
    }

    /**
     * Busca el primer registro de auditoría que coincida (para checks de idempotencia).
     */
    static async findFirstAuditTrail(where: any): Promise<any> {
        return getCorePrisma().auditTrail.findFirst({ where });
    }

    /**
     * Obtiene el estado de membresía de un usuario en un tenant.
     */
    static async getMembershipStatus(tenantId: string, userId: string): Promise<any> {
        return getCorePrisma().organizationMember.findUnique({
            where: { tenantId_userId: { tenantId, userId } },
            select: { status: true }
        });
    }

    /**
     * Busca una invitación por token.
     */
    static async findInvitationByToken(token: string): Promise<any | null> {
        return getCorePrisma().invitation.findUnique({
            where: { token }
        });
    }

    /**
     * Lista las invitaciones de una organización.
     */
    static async getInvitationsByTenant(tenantId: string): Promise<any[]> {
        return getCorePrisma().invitation.findMany({
            where: { tenantId },
            select: {
                id: true,
                email: true,
                acceptedAt: true,
                expiresAt: true,
                role: { select: { id: true, name: true, slug: true } },
                invitedBy: { select: { id: true, name: true, email: true } }
            },
            orderBy: { expiresAt: 'desc' }
        });
    }

    /**
     * Elimina una invitación por ID.
     */
    static async deleteInvitation(invitationId: string): Promise<void> {
        await getCorePrisma().invitation.delete({
            where: { id: invitationId }
        });
    }

    /**
     * Actualiza el rol de un miembro de la organización.
     */
    static async updateOrganizationMemberRole(tenantId: string, userId: string, roleId: string): Promise<void> {
        await getCorePrisma().organizationMember.update({
            where: { tenantId_userId: { tenantId, userId } },
            data: { roleId }
        });
    }

    /**
     * Obtiene los archivos de media de un usuario en una colección específica.
     */
    static async getMediaFilesByUser(tenantId: string, userId: string, mediableType: string, collection: string): Promise<any[]> {
        return getCorePrisma().mediaFile.findMany({
            where: { tenantId, mediableId: userId, mediableType, collection }
        });
    }

    /**
     * Obtiene un producto por ID.
     */
    static async getProductById(productId: string): Promise<{ slug: string } | null> {
        return getCorePrisma().product.findUnique({
            where: { id: productId },
            select: { slug: true }
        });
    }

    /**
     * Obtiene un producto por slug.
     */
    static async getProductBySlug(slug: string): Promise<{ id: string; slug: string } | null> {
        return getCorePrisma().product.findFirst({
            where: { slug: { equals: slug, mode: 'insensitive' } },
            select: { id: true, slug: true }
        });
    }
}
