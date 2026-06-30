import React, { useState, useEffect } from 'react';
import client from '../api/client';
import { useToast } from '../context/ToastContext';
import { Building2, ChevronDown, Check, Loader2 } from 'lucide-react';

export const SuperAdminTenantSelector: React.FC = () => {
    const [tenants, setTenants] = useState<any[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const { error: toastError } = useToast();
    const currentOrgId = localStorage.getItem('wabee_orgId');

    useEffect(() => {
        // Only fetch if Super Admin
        const role = localStorage.getItem('wabee_globalRole');
        if (role === 'admin') {
            fetchTenants();
        }
    }, []);

    const fetchTenants = async () => {
        try {
            const { data } = await client.get('/super-admin/tenants');
            if (data.success) {
                setTenants(data.data.items || []);
            }
        } catch (err: any) {
            console.error('Failed to load tenants for super admin', err);
        }
    };

    const handleImpersonate = async (tenantId: string, tenantName: string) => {
        if (tenantId === currentOrgId) {
            setIsOpen(false);
            return;
        }
        
        setLoading(true);
        try {
            const { data } = await client.post('/super-admin/impersonate', { tenantId });
            localStorage.setItem('wabee_token', data.token);
            localStorage.setItem('wabee_orgId', data.tenant.id);
            localStorage.setItem('wabee_orgName', data.tenant.name);
            localStorage.setItem('wabee_sa_impersonating', 'true');
            window.location.href = '/dashboard';
        } catch (err: any) {
            toastError(err.response?.data?.error?.message || 'Error al impersonar tenant');
        } finally {
            setLoading(false);
            setIsOpen(false);
        }
    };

    const role = localStorage.getItem('wabee_globalRole');
    if (role !== 'admin') return null;

    const currentTenant = tenants.find(t => t.id === currentOrgId);

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] border border-[var(--border-default)] rounded-lg transition-all shadow-sm"
            >
                <div className="w-5 h-5 bg-red-500/20 text-red-500 rounded flex items-center justify-center font-bold text-[10px]">
                    SA
                </div>
                <div className="text-left flex flex-col justify-center max-w-[120px]">
                    <span className="text-[10px] text-red-600 font-bold uppercase tracking-wider leading-none">Super Admin</span>
                    <span className={`text-xs font-bold truncate leading-tight mt-0.5 [color:var(--tx-menuText-color)]`}>
                        {currentTenant ? currentTenant.name : 'Select Tenant'}
                    </span>
                </div>
                <ChevronDown size={14} className="text-[var(--text-muted)]" />
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
                    <div className="absolute top-full left-0 mt-2 w-64 max-h-96 overflow-y-auto bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-xl shadow-2xl z-50 py-2">
                        <div className="px-3 pb-2 border-b border-[var(--border-default)] mb-2">
                            <h3 className={`text-xs font-bold uppercase tracking-wider [color:var(--tx-helperText-color)]`}>Organizations</h3>
                        </div>
                        {loading ? (
                            <div className="flex justify-center p-4"><Loader2 className="animate-spin text-[var(--brand-primary)]" size={20} /></div>
                        ) : (
                            tenants.map(tenant => (
                                <button
                                    key={tenant.id}
                                    onClick={() => handleImpersonate(tenant.id, tenant.name)}
                                    className={`w-full text-left px-3 py-2.5 flex items-center justify-between hover:bg-[var(--bg-hover)] transition-all group ${tenant.id === currentOrgId ? 'bg-[var(--bg-input)]' : ''}`}
                                >
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <Building2 size={16} className={tenant.id === currentOrgId ? 'text-[var(--brand-primary)]' : 'opacity-40 group-hover:text-[var(--brand-primary)] group-hover:opacity-100 transition-all'} />
                                        <div className="truncate">
                                            <p className={`text-sm truncate font-bold [color:${tenant.id === currentOrgId ? 'var(--brand-primary)' : 'var(--tx-menuText-color)'}]`}>{tenant.name}</p>
                                            <p className="text-[10px] capitalize [color:var(--tx-helperText-color)]">{tenant.status} • {tenant.plan}</p>
                                        </div>
                                    </div>
                                    {tenant.id === currentOrgId && <Check size={14} className="text-green-500 shrink-0" />}
                                </button>
                            ))
                        )}
                    </div>
                </>
            )}
        </div>
    );
};
