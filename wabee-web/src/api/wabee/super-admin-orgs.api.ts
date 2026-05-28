import api from '../client';

export interface SuperAdminStats {
    totalOrganizations: number;
    activeUsers: number;
    topPlanName: string;
    topPlanCount: number;
    growthPercentage: number;
}

export interface SuperAdminOrganization {
    id: string;
    name: string;
    slug: string;
    status: 'active' | 'suspended';
    plan: {
        name: string;
        isPro: boolean;
    };
    usersCount: number;
    createdAt: string;
    updatedAt: string;
}

export interface SuperAdminImpersonationResponse {
    success: boolean;
    token: string;
    tenant: {
        id: string;
        name: string;
        slug: string;
    };
    targetUser: {
        id: string;
        role: string;
    };
}

export interface SuperAdminOrganizationsResponse {
    items: SuperAdminOrganization[];
    pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
    };
}

export interface GetOrganizationsParams {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: string;
    plan?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export interface OrganizationMember {
    id: string;
    userId: string;
    email: string;
    name: string;
    avatar?: string;
    role: string;
    status: 'active' | 'invited' | 'suspended' | 'removed';
    joinedAt: string;
    has2fa: boolean;
}

export interface CurrentImpersonation {
    success: boolean;
    isImpersonating: boolean;
    reason?: string;
    data?: {
        impersonatedUserId: string;
        impersonatedOrgId: string;
        impersonatedOrgName: string;
        targetUserEmail: string;
        targetUserName: string;
        effectiveRole: string;
    };
}

export const superAdminOrgsApi = {
    getStats: async (): Promise<SuperAdminStats> => {
        const response = await api.get('/super-admin/organizations/stats');
        return response.data.data;
    },

    getOrganizations: async (params: GetOrganizationsParams = {}): Promise<SuperAdminOrganizationsResponse> => {
        const response = await api.get('/super-admin/organizations', { params });
        return response.data.data;
    },

    getMembers: async (orgId: string): Promise<OrganizationMember[]> => {
        const response = await api.get(`/super-admin/organizations/${orgId}/members`);
        return response.data.data;
    },

    impersonate: async (orgId: string, userId?: string): Promise<SuperAdminImpersonationResponse> => {
        const url = userId 
            ? `/super-admin/organizations/${orgId}/impersonate/${userId}`
            : `/super-admin/organizations/${orgId}/impersonate`;
        const response = await api.post(url);
        return response.data;
    },

    getImpersonationCurrent: async (): Promise<CurrentImpersonation> => {
        const response = await api.get('/super-admin/impersonation/current');
        return response.data;
    },

    stopImpersonation: async (): Promise<{ success: boolean }> => {
        const response = await api.post('/super-admin/stop-impersonation');
        return response.data;
    }
};
