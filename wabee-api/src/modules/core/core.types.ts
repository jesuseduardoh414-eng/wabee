/**
 * core.types.ts
 * Definiciones de tipos manuales (DTOs) para el dominio del Core.
 * Evita la filtración de tipos Prisma del Core hacia el resto de WABEE.
 */

export interface CoreProfileDTO {
    id: string;
    email: string;
    name: string | null;
    avatar: string | null;
    status?: string;
    has2fa: boolean;
    platformRole?: string | null;
    preferences?: any;
    twoFactorSecret?: string | null;
    emailVerifiedAt?: Date | string | null;
    globalRoleId?: string | null;
    globalRole?: {
        id: string;
        name: string;
        slug: string;
        productId?: string | null;
    } | null;
}

export interface CoreAuthorInfoDTO {
    id: string;
    name: string;
    role: string;
}

export interface CoreOrganizationDTO {
    id: string;
    name: string;
    slug: string;
    email: string | null;
    logoUrl?: string | null;
    status: string;
    createdAt: Date;
    settings?: any;
    planTemplate?: {
        name: string;
        interval: string;
        price: number;
        currency: string;
        limits: any;
    };
}

export interface CoreTenantStorageStatsDTO {
    id: string;
    tenantId: string;
    totalBytes: bigint;
    fileCount: number;
    updatedAt: Date;
}

export interface CoreMembershipDTO {
    id: string;
    tenantId: string;
    userId: string;
    role: {
        id: string;
        name: string;
        slug: string;
    } | null;
    status: string; // active, suspended, etc.
    createdAt: Date;
    user?: CoreProfileDTO;
    organization?: {
        id: string;
        name: string;
        slug: string;
    };
}

export interface CoreSubscriptionDTO {
    id: string;
    tenantId: string;
    planTemplateId: string;
    planVersionId: string | null;
    status: string;
    priceSnapshot: number | null;
    monthlyPriceSnapshot: number | null;
    annualPriceSnapshot: number | null;
    currencySnapshot: string | null;
    billingIntervalSnapshot: string | null;
    limitsSnapshot: any;
    featuresSnapshot: any;
    capabilitiesSnapshot: any;
    modulesSnapshot: any;
    snapshotJson: any;
    snapshotCreatedAt: Date | null;
    planCodeSnapshot: string | null;
    planNameSnapshot: string | null;
    versionNumberSnapshot: number | null;
    createdAt: Date;
    
    // Relación aplanada (opcional para resolver en DTO)
    planTemplate?: {
        id: string;
        name: string;
        price: number;
        currency: string;
        interval: string;
        limits: any;
        features: any;
        modules: any;
        metadata: any;
    };
}

export interface CorePlanVersionDTO {
    id: string;
    planTemplateId: string;
    versionNumber: number;
    displayCode: string | null;
    price: number;
    monthlyPrice: number;
    annualPrice: number;
    currency: string;
    billingInterval: string;
    limitsJson: any;
    featuresJson: any;
    capabilitiesJson: any;
    modulesJson: any;
    stripePriceMonthlyId: string | null;
    stripePriceAnnualId: string | null;
    isCurrent: boolean;
    planTemplate?: {
        name: string;
        metadata: any;
    };
}

export interface CorePlanTemplateDTO {
    id: string;
    name: string;
    description: string | null;
    interval: string;
    price: number;
    currency: string;
    metadata: any;
    status: string;
    createdAt: Date;
}

export interface CoreSystemSettingDTO {
    id: string;
    key: string;
    value: any;
    description?: string | null;
    updatedAt?: Date | string;
}

export interface CoreImpersonationSessionDTO {
    id: string;
    tenantId: string;
    adminUserId: string;
    targetUserId: string;
    reason: string | null;
    startedAt: Date;
    endedAt: Date | null;
    endedBy: string | null;
}

export interface CoreOrganizationStatsDTO {
    totalOrganizations: number;
    activeUsers: number;
    topPlanName: string;
    topPlanCount: number;
    growthPercentage: number;
}

export interface CoreOrganizationListItemDTO {
    id: string;
    name: string;
    slug: string;
    status: string;
    plan: {
        name: string;
        isPro: boolean;
    };
    usersCount: number;
    createdAt: Date | string;
    updatedAt: Date | string;
}

export interface CorePaginatedResponseDTO<T> {
    items: T[];
    pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
    };
}

export interface CoreOrganizationMemberListItemDTO {
    id: string;
    userId: string;
    email: string | null;
    name: string | null;
    avatar: string | null;
    role: string;
    status: string;
    joinedAt: Date | string;
    has2fa: boolean;
}

export interface CoreGlobalAuditEventDTO {
    id: string;
    createdAt: Date | string;
    tenantId: string | null;
    affectedTenantId: string | null;
    actorType: string;
    actorUserId: string | null;
    actorEmail: string | null;
    actorRole: string | null;
    eventType: string;
    category: string;
    severity: string;
    outcome: string;
    targetType: string | null;
    targetId: string | null;
    targetLabel: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    requestId: string | null;
    correlationId: string | null;
    message: string;
    oldValues: any;
    newValues: any;
    metadata: any;
    isSensitive: boolean;
    isImpersonation: boolean;
}

export interface CoreDataDeletionRequestDTO {
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
    description: string | null;
    status: string;
    hasMatch: boolean;
    internalNote: string | null;
    requestedAt: Date | string;
    reviewedAt: Date | string | null;
    reviewedBy: string | null;
    completedAt: Date | string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
}
