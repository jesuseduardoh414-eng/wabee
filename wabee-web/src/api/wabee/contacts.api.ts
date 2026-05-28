import { apiClient } from './client';

export const contactsApi = {
    // Contacts
    list: (params: any = {}) => {
        const query = new URLSearchParams();
        if (params.search) query.append('search', params.search);
        if (params.status) query.append('status', params.status);
        if (params.lifecycleStatus) {
            if (Array.isArray(params.lifecycleStatus)) {
                params.lifecycleStatus.forEach((s: string) => query.append('lifecycleStatus', s));
            } else {
                query.append('lifecycleStatus', params.lifecycleStatus);
            }
        }
        if (params.page) query.append('page', params.page.toString());
        if (params.pageSize) query.append('pageSize', params.pageSize.toString());
        if (params.groupId) query.append('groupId', params.groupId);
        if (params.segmentId) query.append('segmentId', params.segmentId);

        return apiClient<any>(`/contacts?${query.toString()}`);
    },
    get: (id: string) => apiClient<any>(`/contacts/${id}`),
    create: (data: any) => apiClient<any>('/contacts', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => apiClient<any>(`/contacts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => apiClient<any>(`/contacts/${id}`, { method: 'DELETE' }),

    addTags: (id: string, tags: string[]) =>
        apiClient<any>(`/contacts/${id}/tags:add`, { method: 'POST', body: JSON.stringify({ tags }) }),

    removeTags: (id: string, tags: string[]) =>
        apiClient<any>(`/contacts/${id}/tags:remove`, { method: 'POST', body: JSON.stringify({ tags }) }),

    updateLifecycle: (id: string, toStatus: string) =>
        apiClient<any>(`/contacts/${id}/lifecycle`, { method: 'PATCH', body: JSON.stringify({ toStatus }) }),

    // Groups (Real API @ /v1/wabee/contacts/groups)
    listGroups: () => apiClient<any[]>('/contacts/groups'),
    getGroup: (id: string) => apiClient<any>(`/contacts/groups/${id}`),
    createGroup: (data: any) => apiClient<any>('/contacts/groups', { method: 'POST', body: JSON.stringify(data) }),
    updateGroup: (id: string, data: any) => apiClient<any>(`/contacts/groups/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteGroup: (id: string) => apiClient<any>(`/contacts/groups/${id}`, { method: 'DELETE' }),

    // Membership
    getGroupContacts: (groupId: string) => apiClient<any[]>(`/contacts/groups/${groupId}/contacts`),
    addContactsToGroup: (groupId: string, contactIds: string[]) =>
        apiClient<any>(`/contacts/groups/${groupId}/contacts`, { method: 'POST', body: JSON.stringify({ contactIds }) }),
    removeContactsFromGroup: (groupId: string, contactIds: string[]) =>
        apiClient<any>(`/contacts/groups/${groupId}/contacts`, { method: 'DELETE', body: JSON.stringify({ contactIds }) }),

    // Segments
    listSegments: () => apiClient<any[]>('/contacts/segments'),
    createSegment: (data: any) => apiClient<any>('/contacts/segments', { method: 'POST', body: JSON.stringify(data) }),
    updateSegment: (id: string, data: any) => apiClient<any>(`/contacts/segments/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    executeSegment: (id: string) => apiClient<any>(`/contacts/segments/${id}/execute`, { method: 'POST' }),
    deleteSegment: (id: string) => apiClient<any>(`/contacts/segments/${id}`, { method: 'DELETE' }),

    // Demo Seed
    seedDemo: () => apiClient<any>('/contacts/demo-seed', { method: 'POST' }),

    // Import
    importCSV: (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        // Important: Do not set Content-Type header manually for FormData, 
        // let the browser set it with the boundary.
        return apiClient<any>('/contacts/import', {
            method: 'POST',
            body: formData
        });
    }
};
