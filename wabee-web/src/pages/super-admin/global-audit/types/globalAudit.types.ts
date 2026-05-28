export type AuditCategory = 'auth' | 'user' | 'org' | 'system' | 'billing' | 'super_admin';
export type AuditSeverity = 'info' | 'warning' | 'critical' | 'success';
export type AuditOutcome = 'success' | 'failure';

export interface GlobalAuditFilters {
    search?: string;
    category?: AuditCategory;
    severity?: AuditSeverity;
    outcome?: AuditOutcome;
    fromDate?: string;
    toDate?: string;
}

export interface GlobalAuditEventListItem {
    id: string;
    createdAt: string;
    category: AuditCategory;
    eventType: string;
    severity: AuditSeverity;
    outcome: AuditOutcome;
    actorEmail?: string;
    targetLabel?: string;
    message: string;
    isImpersonation: boolean;
}

export interface GlobalAuditEventDetail extends GlobalAuditEventListItem {
    tenantId?: string;
    affectedTenantId?: string;
    actorUserId?: string;
    actorRole?: string;
    actorType: string;
    targetType?: string;
    targetId?: string;
    ipAddress?: string;
    userAgent?: string;
    requestId?: string;
    isSensitive: boolean;
    oldValues?: any;
    newValues?: any;
    metadata?: any;
}

export interface GlobalAuditPagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export interface GlobalAuditResponse {
    items: GlobalAuditEventListItem[];
    pagination: GlobalAuditPagination;
}

export interface GlobalAuditDetailResponse {
    data: GlobalAuditEventDetail;
}
