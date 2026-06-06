import React, { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { usePlanEnforcement } from '../hooks/usePlanEnforcement';
import client from '../api/client';
import {
    LayoutDashboard,
    Send,
    Users,
    Zap,
    ChevronDown,
    User,
    LogOut,
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
    Mail,
    UserX,
    Workflow,
    Link2,
    Menu,
    X
} from 'lucide-react';
import { NotificationDropdown } from '../components/wabee/NotificationDropdown';
import { SuperAdminImpersonationBanner } from '../components/SuperAdminImpersonationBanner';
import { ImpersonationStore } from '../lib/impersonation.store';
import { T } from '@/lib/text-tokens';
import { BrandLogo } from '../components/BrandLogo';

export const DashboardLayout = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
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

    useEffect(() => {
        setIsMobileNavOpen(false);
        setIsProfileOpen(false);
    }, [location.pathname]);

    const isInbox = location.pathname.includes('/wabee/inbox');
    const hideNav = isInbox && searchParams.get('view') !== 'standard';

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

    if (globalRole === 'admin' && !isImpersonatingValue) {
        role = 'ADMIN';
    }

    const orgName = localStorage.getItem('wabee_orgName') || 'Mi Organización';
    const isSuperAdminMode = globalRole === 'admin' && !isImpersonatingValue;
    const showOrgContext = !isSuperAdminMode;

    const isAdmin = role === 'ADMIN';
    const orgId = localStorage.getItem('wabee_orgId') || '';

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

    const currentMenu = isSuperAdminMode
        ? superAdminMenuItems
        : menuItems.filter(item => {
            const hasRole = item.roles.includes(role);
            if (!hasRole) return false;

            const hasAssignedPlan = !!summary?.plan?.id;
            if (item.module && summary && !isPlanLoading && hasAssignedPlan && !isModuleEnabled(item.module)) {
                return false;
            }

            return true;
        });

    const isActive = (path: string) => location.pathname === path;

    const renderMenuItems = () => (
        <>
            {currentMenu.map((item) => (
                <div
                    key={item.label}
                    onClick={() => {
                        navigate(item.path);
                        setIsMobileNavOpen(false);
                    }}
                    className={`sidebar-item cursor-pointer mb-0.5 ${isActive(item.path) ? 'sidebar-item-active' : ''}`}
                >
                    <item.icon size={14} className={isActive(item.path) ? 'text-[var(--brand-primary-foreground)]' : 'text-[var(--text-muted)] group-hover:text-[var(--brand-primary)]'} />
                    <span className={`${T.navText} text-[11px]`}>{item.label}</span>
                </div>
            ))}
        </>
    );

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
        <div className="wabee-admin flex min-h-screen flex-col bg-[var(--bg-page)] text-[var(--text-body)] lg:h-screen lg:flex-row lg:overflow-hidden">
            {!hideNav && isMobileNavOpen && (
                <button
                    type="button"
                    aria-label="Cerrar navegación"
                    className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px] lg:hidden"
                    onClick={() => setIsMobileNavOpen(false)}
                />
            )}

            {!hideNav && isMobileNavOpen && (
                <aside className="wabee-admin__sidebar fixed inset-y-0 left-0 z-50 flex w-[280px] max-w-[85vw] flex-col gap-5 overflow-y-auto p-4 lg:hidden">
                    <div className="flex items-start justify-between gap-3 px-1 lg:block">
                        <div className="flex flex-col gap-2">
                            <BrandLogo variant="full" showProHub={true} size={28} />
                            {isSuperAdminMode && (
                                <div className="mt-1 flex items-center gap-1">
                                    <span className={`${T.badgeText} text-[9px] px-2 py-1 rounded-full border border-[color:color-mix(in_srgb,var(--brand-primary),transparent_84%)] bg-[color:color-mix(in_srgb,var(--brand-primary),transparent_90%)] text-[var(--brand-primary)] font-bold leading-none shrink-0`}>
                                        Super Admin
                                    </span>
                                </div>
                            )}
                        </div>

                        <button
                            type="button"
                            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] text-[var(--text-muted)] transition-all hover:text-[var(--brand-primary)] lg:hidden"
                            onClick={() => setIsMobileNavOpen(false)}
                            aria-label="Cerrar menú"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    <nav className="flex flex-1 flex-col gap-2">
                        {renderMenuItems()}
                    </nav>

                    <div className="mt-auto flex flex-col gap-6" />
                </aside>
            )}

            {!hideNav && (
                <aside className="wabee-admin__sidebar hidden w-60 shrink-0 flex-col gap-5 overflow-y-auto p-4 lg:flex">
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

                    <nav className="flex flex-1 flex-col gap-2">
                        {renderMenuItems()}
                    </nav>

                    <div className="mt-auto flex flex-col gap-6" />
                </aside>
            )}

            <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[var(--bg-page)]">
                {!hideNav && <SuperAdminImpersonationBanner />}

                {!hideNav && (
                    <header className="wabee-admin__topbar sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-3 px-3 sm:px-5">
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                            <button
                                type="button"
                                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] text-[var(--text-muted)] transition-all hover:text-[var(--brand-primary)] lg:hidden"
                                onClick={() => setIsMobileNavOpen(true)}
                                aria-label="Abrir menú"
                            >
                                <Menu size={18} />
                            </button>

                            <div className="min-w-0 lg:hidden">
                                <p className={`${T.menuText} truncate text-xs font-bold`}>
                                    {isSuperAdminMode ? 'Super Admin' : orgName}
                                </p>
                                {!isSuperAdminMode && orgId ? (
                                    <p className="truncate text-[10px] text-[var(--text-muted)]">{orgId}</p>
                                ) : null}
                            </div>
                        </div>

                        <div className="flex items-center gap-2 sm:gap-3">
                            <div className="flex items-center gap-2 text-[var(--text-muted)]">
                                <NotificationDropdown />
                            </div>

                            <div className="hidden h-8 w-px bg-[var(--border-default)] sm:block"></div>

                            <div className="relative" ref={profileMenuRef}>
                                <div
                                    className="flex cursor-pointer items-center gap-2 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-1 shadow-[0_18px_34px_rgba(26,26,26,0.06)] transition-all hover:border-[var(--brand-primary)]/30 group"
                                    onClick={() => setIsProfileOpen(!isProfileOpen)}
                                >
                                    <div className="ml-1.5 hidden text-right sm:block">
                                        <p className={`${T.menuText} max-w-[96px] truncate text-[10px] italic transition-all group-hover:text-[var(--brand-primary)]`}>{user.name}</p>
                                    </div>
                                    <div className="h-8 w-8 overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] transition-all group-hover:border-[var(--brand-primary)]/50">
                                        <img
                                            src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'U')}&background=ead018&color=121208`}
                                            alt="User"
                                            className="h-full w-full object-cover"
                                        />
                                    </div>
                                    <ChevronDown size={12} className={`mr-0.5 text-[var(--text-muted)] transition-transform duration-300 ${isProfileOpen ? 'rotate-180' : ''}`} />
                                </div>

                                {isProfileOpen && (
                                    <div className="absolute right-0 z-20 mt-4 w-56 rounded-[1.5rem] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-2 shadow-[0_30px_80px_rgba(26,26,26,0.12)] animate-in fade-in zoom-in-95 duration-200">
                                        {showOrgContext && (
                                            <div className="mb-2 border-b border-[var(--border-default)] px-3 py-2">
                                                <p className={`${T.labelText} mb-1 text-[9px]`}>Organización</p>
                                                <p className={`${T.cardTitle} text-xs font-bold`}>{orgName}</p>
                                            </div>
                                        )}

                                        <div className="space-y-1">
                                            <button
                                                onClick={() => { setIsProfileOpen(false); navigate('/dashboard/profile'); }}
                                                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all hover:bg-[var(--bg-input)] hover:brightness-110"
                                                style={{ color: 'var(--tx-menuText-color)' }}
                                            >
                                                <User size={18} />
                                                <span className={`${T.menuText} text-sm`}>Mi Perfil</span>
                                            </button>
                                            {isAdmin && showOrgContext && (
                                                <>
                                                    <button
                                                        onClick={() => { setIsProfileOpen(false); navigate('/dashboard/settings/organization'); }}
                                                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all hover:bg-[var(--bg-input)] hover:brightness-110"
                                                        style={{ color: 'var(--tx-menuText-color)' }}
                                                    >
                                                        <Building2 size={18} />
                                                        <span className={`${T.menuText} text-sm`}>Organización</span>
                                                    </button>
                                                    <button
                                                        onClick={() => { setIsProfileOpen(false); navigate('/dashboard/settings/plan'); }}
                                                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all hover:bg-[var(--bg-input)] hover:brightness-110"
                                                        style={{ color: 'var(--tx-menuText-color)' }}
                                                    >
                                                        <CreditCard size={18} />
                                                        <span className={`${T.menuText} text-sm`}>Plan y Facturación</span>
                                                    </button>
                                                </>
                                            )}
                                        </div>

                                        <div className="mt-2 border-t border-[var(--border-default)] pt-2">
                                            <button
                                                onClick={handleLogout}
                                                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-all hover:bg-red-400/10"
                                                style={{ color: 'var(--tx-menuText-color)' }}
                                            >
                                                <LogOut size={18} className="transition-colors hover:text-red-500" />
                                                <span className={`${T.menuText} text-sm`}>Cerrar Sesión</span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </header>
                )}

                <main className={`flex-1 overflow-y-auto ${hideNav ? 'p-0' : 'p-3 sm:p-5'} bg-[var(--bg-page)] selection:bg-[var(--brand-primary)]/20`}>
                    <Outlet />
                </main>
            </div>
        </div>
    );
};
