import React, { useState, useRef, useEffect } from 'react';
import { Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { usePlanEnforcement } from '../hooks/usePlanEnforcement';
import client from '../api/client';
import {
    LayoutDashboard,
    Send,
    Users,
    Zap,
    BarChart3,
    Settings,
    Search,
    Bell,
    HelpCircle,
    ChevronDown,
    User,
    LogOut,
    ExternalLink,
    Building2,
    CreditCard,
    MessageSquare,
    Layers,
    Bot,
    Code,
    Layout,
    Filter,
    ShieldAlert,
    PaintBucket,
    ToggleRight,
    Blocks,
    Mail,
    UserX,
    Workflow,
    Link2
} from 'lucide-react';
import { NotificationDropdown } from '../components/wabee/NotificationDropdown';
import { SuperAdminImpersonationBanner } from '../components/SuperAdminImpersonationBanner';
import { SuperAdminTenantSelector } from '../components/SuperAdminTenantSelector';
import { ImpersonationStore } from '../lib/impersonation.store';
import { T, S } from '@/lib/text-tokens';
import { BrandLogo } from '../components/BrandLogo';
import { OnboardingModal, shouldShowOnboarding } from '../components/wabee/OnboardingModal';

export const DashboardLayout = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const profileMenuRef = useRef<HTMLDivElement>(null);
    const [searchParams] = useSearchParams();

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
                setIsProfileOpen(false);
            }
        };

        if (isProfileOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            document.removeEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isProfileOpen]);

    // Detectar si estamos en el Inbox y si debemos mostrar la navegación
    const isInbox = location.pathname.includes('/wabee/inbox');
    const hideNav = isInbox && searchParams.get('view') !== 'standard';

    // Recuperar datos de usuario y rol de localStorage
    const [user, setUser] = React.useState(() => {
        const savedUser = localStorage.getItem('wabee_user');
        try {
            return (savedUser && savedUser !== 'undefined') ? JSON.parse(savedUser) : { name: 'Usuario', email: '' };
        } catch (e) {
            return { name: 'Usuario', email: '' };
        }
    });

    React.useEffect(() => {
        const handleProfileUpdate = () => {
            const savedUser = localStorage.getItem('wabee_user');
            if (savedUser && savedUser !== 'undefined') {
                try {
                    setUser(JSON.parse(savedUser));
                } catch (e) {
                    console.error('Error parsing user data:', e);
                }
            }
        };
        window.addEventListener('profileUpdated', handleProfileUpdate);
        return () => window.removeEventListener('profileUpdated', handleProfileUpdate);
    }, []);
    
    const globalRole = localStorage.getItem('wabee_globalRole');
    let role = (localStorage.getItem('wabee_role') || 'AGENT').toUpperCase();

    const isImpersonatingValue = ImpersonationStore.isActive();

    // El rol global domina SI NO estamos suplantando
    if (globalRole === 'admin' && !isImpersonatingValue) {
        role = 'ADMIN';
    }

    const orgName = localStorage.getItem('wabee_orgName') || 'Mi Organización';
    const isSuperAdminMode = globalRole === 'admin' && !isImpersonatingValue;
    const showOrgContext = !isSuperAdminMode;

    const isAdmin = role === 'ADMIN';
    const isSupervisor = role === 'SUPERVISOR';
    const isAgent = role === 'AGENT';

    const orgId = localStorage.getItem('wabee_orgId') || '';

    // Centralizado bajo el nuevo hook de enforcement
    const { summary, isLoading: isPlanLoading, isModuleEnabled } = usePlanEnforcement();

    const menuItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard/home', roles: ['ADMIN', 'SUPER_ADMIN', 'SUPERVISOR'], module: 'dashboard' },
        { icon: MessageSquare, label: 'Inbox', path: '/dashboard/wabee/inbox', roles: ['ADMIN', 'SUPER_ADMIN', 'SUPERVISOR', 'AGENT'], module: 'inbox' },
        { icon: Users, label: 'Contactos', path: '/dashboard/wabee/contacts', roles: ['ADMIN', 'SUPER_ADMIN', 'SUPERVISOR', 'AGENT'], module: 'contacts' },
        { icon: Filter, label: 'Segmentos', path: '/dashboard/wabee/segments', roles: ['ADMIN', 'SUPER_ADMIN', 'SUPERVISOR'], module: 'segments' },
        { icon: Layers, label: 'Grupos', path: '/dashboard/wabee/groups', roles: ['ADMIN', 'SUPER_ADMIN', 'SUPERVISOR'], module: 'groups' },
        { icon: Layout, label: 'Mis Plantillas', path: '/dashboard/wabee/templates-hub', roles: ['ADMIN', 'SUPER_ADMIN', 'SUPERVISOR'], module: 'templatesHub' },
        { icon: Bot, label: 'Perfiles IA', path: '/dashboard/wabee/ai-profiles', roles: ['ADMIN', 'SUPER_ADMIN'], module: 'aiProfiles' },
        { icon: Workflow, label: 'Automatizaciones', path: '/dashboard/wabee/automations', roles: ['ADMIN', 'SUPER_ADMIN'], module: null },
        { icon: Code, label: 'Web Widgets', path: '/dashboard/wabee/widgets', roles: ['ADMIN', 'SUPER_ADMIN'], module: 'webWidgets' },
        { icon: Link2, label: 'Integraciones CRM', path: '/dashboard/wabee/crm-integrations', roles: ['ADMIN', 'SUPER_ADMIN'], module: null },
        { icon: Building2, label: 'Integraciones y Herramientas', path: '/dashboard/wabee/ai-integrations', roles: ['ADMIN', 'SUPER_ADMIN'], module: 'integrationsTools' },
        { icon: Zap, label: 'Canales HC', path: '/dashboard/wabee/channels', roles: ['ADMIN', 'SUPER_ADMIN'], module: 'channels' },
        { icon: Send, label: 'Campaigns', path: '/dashboard/wabee/campaigns', roles: ['ADMIN', 'SUPER_ADMIN', 'SUPERVISOR'], module: 'campaigns' },
        { icon: ShieldAlert, label: 'Auditoría', path: '/dashboard/wabee/audit', roles: ['ADMIN', 'SUPER_ADMIN'], module: 'audit' },
        { icon: Users, label: 'Team', path: '/dashboard/settings/team', roles: ['ADMIN', 'SUPER_ADMIN', 'SUPERVISOR'], module: 'team' },
    ];

    const superAdminMenuItems = [
        { icon: Building2, label: 'Ecosistema', path: '/dashboard/super-admin', roles: ['SUPER_ADMIN'] },
        { icon: CreditCard, label: 'Planes', path: '/dashboard/super-admin/plans', roles: ['SUPER_ADMIN'] },
        { icon: PaintBucket, label: 'Temas', path: '/dashboard/super-admin/themes', roles: ['SUPER_ADMIN'] },
        { icon: ShieldAlert, label: 'Auditoría Global', path: '/dashboard/super-admin/audit', roles: ['SUPER_ADMIN'] },
        { icon: Mail, label: 'Personalización de correos', path: '/dashboard/super-admin/email-customization', roles: ['SUPER_ADMIN'] },
        { icon: UserX, label: 'Privacidad', path: '/dashboard/super-admin/data-deletion', roles: ['SUPER_ADMIN'] },
    ];

    // Filtrar items según rol y módulos activos del plan
    const currentMenu = isSuperAdminMode 
        ? superAdminMenuItems 
        : menuItems.filter(item => {
            const hasRole = item.roles.includes(role);
            if (!hasRole) return false;
            
            // Si todavía no cargó el resumen del plan, no ocultamos el menú.
            // Esto evita que Admin/Supervisor vean una barra vacía por un fetch tardío.
            const hasAssignedPlan = !!summary?.plan?.id;
            if (item.module && summary && !isPlanLoading && hasAssignedPlan && !isModuleEnabled(item.module)) {
                return false;
            }
            
            return true;
        });

    const isActive = (path: string) => location.pathname === path;

    const handleLogout = () => {
        client.post('/auth/logout').catch(() => {});
        localStorage.removeItem('wabee_session');
        localStorage.removeItem('wabee_user');
        localStorage.removeItem('wabee_orgId');
        localStorage.removeItem('wabee_orgName');
        localStorage.removeItem('wabee_role');
        localStorage.removeItem('wabee_globalRole');
        localStorage.removeItem('wabee_user_theme_id');
        localStorage.removeItem('wabee_user_theme_colors');
        localStorage.removeItem('wabee_user_theme_typography');
        navigate('/login');
    };

    return (
        <div className="wabee-admin flex h-screen bg-[var(--bg-page)] text-[var(--text-body)] overflow-hidden">
            {shouldShowOnboarding() && <OnboardingModal />}
            {/* Sidebar Ultra-Slim */}
            {!hideNav && (
                <aside className="wabee-admin__sidebar w-60 flex flex-col p-4 gap-5 shrink-0">
                <div className="flex flex-col gap-2 px-1">
                    <BrandLogo variant="full" showProHub={true} size={28} />
                    {isSuperAdminMode && (
                        <div className="mt-1 flex items-center gap-1">
                            <span className={`${T.badgeText} text-[9px] px-2 py-1 rounded-full border border-[color:color-mix(in_srgb,var(--brand-primary),transparent_84%)] bg-[color:color-mix(in_srgb,var(--brand-primary),transparent_90%)] text-[var(--brand-primary)] font-bold leading-none shrink-0`}>
                                Super Admin
                            </span>
                        </div>
                    )}
                </div>

                <nav className="flex-1 flex flex-col gap-2">
                    {currentMenu.map((item) => (
                        <div
                            key={item.label}
                            onClick={() => navigate(item.path)}
                            className={`sidebar-item cursor-pointer mb-0.5 ${isActive(item.path) ? 'sidebar-item-active' : ''}`}
                        >
                            <item.icon size={14} className={isActive(item.path) ? 'text-[var(--brand-primary-foreground)]' : 'text-[var(--text-muted)] group-hover:text-[var(--brand-primary)]'} />
                            {/* navText ya incluye truncate — correcto para sidebar */}
                            <span className={`${T.navText} text-[11px]`}>{item.label}</span>
                        </div>
                    ))}
                </nav>

                <div className="mt-auto flex flex-col gap-6">

                </div>
            </aside>
            )}

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden bg-[var(--bg-page)]">
                {/* Banner de Impersonation — visible en cualquier vista protegida */}
                {!hideNav && <SuperAdminImpersonationBanner />}
                {/* Header Ultra-Slim */}
                {!hideNav && (
                    <header className="wabee-admin__topbar h-14 flex items-center justify-between px-5 shrink-0 sticky top-0 z-30">
                        <div className="flex-1 flex items-center">
                            {/* Selector de organización eliminado a petición del usuario */}
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 text-[var(--text-muted)]">
                                <NotificationDropdown />
                            </div>

                            <div className="h-8 w-px bg-[var(--border-default)]"></div>

                            <div className="relative" ref={profileMenuRef}>
                                <div
                                    className="flex items-center gap-2 cursor-pointer group p-1 bg-[var(--bg-card)] border border-[var(--border-default)] rounded-2xl hover:border-[var(--brand-primary)]/30 transition-all shadow-[0_18px_34px_rgba(26,26,26,0.06)]"
                                    onClick={() => setIsProfileOpen(!isProfileOpen)}
                                >
                                    <div className="text-right hidden sm:block ml-1.5">
                                        <p className={`${T.menuText} text-[10px] group-hover:text-[var(--brand-primary)] transition-all truncate max-w-[96px] italic`}>{user.name}</p>
                                    </div>
                                    <div className="w-8 h-8 rounded-xl bg-[var(--bg-input)] overflow-hidden border border-[var(--border-default)] group-hover:border-[var(--brand-primary)]/50 transition-all">
                                        <img
                                            src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'U')}&background=ead018&color=121208`}
                                            alt="User"
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <ChevronDown size={12} className={`text-[var(--text-muted)] mr-0.5 transition-transform duration-300 ${isProfileOpen ? 'rotate-180' : ''}`} />
                                </div>

                                {/* Dropdown Menu */}
                                {isProfileOpen && (
                                    <>
                                        <div className="absolute right-0 mt-4 w-56 bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-[1.5rem] shadow-[0_30px_80px_rgba(26,26,26,0.12)] p-2 z-20 animate-in fade-in zoom-in-95 duration-200">
                                                {showOrgContext && (
                                                    <div className="px-3 py-2 border-b border-[var(--border-default)] mb-2">
                                                        {/* labelText sin size — usamos meta */}
                                                        <p className={`${T.labelText} text-[9px] mb-1`}>Organización</p>
                                                        <p className={`${T.cardTitle} text-xs font-bold`}>{orgName}</p>
                                                    </div>
                                                )}

                                            <div className="space-y-1">
                                                <button
                                                    onClick={() => { setIsProfileOpen(false); navigate('/dashboard/profile'); }}
                                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-[var(--bg-input)] hover:brightness-110 transition-all"
                                                    style={{ color: 'var(--tx-menuText-color)' }}
                                                >
                                                    <User size={18} />
                                                    <span className={`${T.menuText} text-sm`}>Mi Perfil</span>
                                                </button>
                                                {isAdmin && showOrgContext && (
                                                    <>
                                                        <button
                                                            onClick={() => { setIsProfileOpen(false); navigate('/dashboard/settings/organization'); }}
                                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-[var(--bg-input)] hover:brightness-110 transition-all"
                                                            style={{ color: 'var(--tx-menuText-color)' }}
                                                        >
                                                            <Building2 size={18} />
                                                            <span className={`${T.menuText} text-sm`}>Organización</span>
                                                        </button>
                                                        <button
                                                            onClick={() => { setIsProfileOpen(false); navigate('/dashboard/settings/plan'); }}
                                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-[var(--bg-input)] hover:brightness-110 transition-all"
                                                            style={{ color: 'var(--tx-menuText-color)' }}
                                                        >
                                                            <CreditCard size={18} />
                                                            <span className={`${T.menuText} text-sm`}>Plan y Facturación</span>
                                                        </button>
                                                    </>
                                                )}
                                            </div>

                                            <div className="mt-2 pt-2 border-t border-[var(--border-default)]">
                                                <button
                                                    onClick={handleLogout}
                                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-red-400/10 transition-all font-bold"
                                                    style={{ color: 'var(--tx-menuText-color)' }}
                                                >
                                                    <LogOut size={18} className="hover:text-red-500 transition-colors" />
                                                    <span className={`${T.menuText} text-sm`}>Cerrar Sesión</span>
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </header>
                )}

                {/* Page Content */}
                <main className={`flex-1 overflow-y-auto ${hideNav ? 'p-0' : 'p-5'} bg-[var(--bg-page)] selection:bg-[var(--brand-primary)]/20`}>
                    <Outlet />
                </main>
            </div>
        </div>
    );
};
