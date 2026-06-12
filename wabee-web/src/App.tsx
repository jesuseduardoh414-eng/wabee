import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ThemeStyleInjector } from './components/branding/ThemeStyleInjector';
import { FaviconManager } from './components/branding/FaviconManager';
import { AuthGuard } from './components/AuthGuard';
import { ModuleGuard } from './components/ModuleGuard';
import { PageLoader } from './components/PageLoader';
import { ToastProvider } from './context/ToastContext';
import { DialogProvider } from './context/DialogContext';
import { Toaster } from 'sonner';

// Eagerly loaded
import { DashboardLayout } from './layouts/DashboardLayout';

// Lazy loaded pages
const LoginPage = React.lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const RegisterPage = React.lazy(() => import('./pages/RegisterPage').then(m => ({ default: m.RegisterPage })));
const OnboardingPage = React.lazy(() => import('./pages/OnboardingPage').then(m => ({ default: m.OnboardingPage })));
const RecoverPage = React.lazy(() => import('./pages/RecoverPage').then(m => ({ default: m.RecoverPage })));
const DashboardPage = React.lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const DashboardIndex = React.lazy(() => import('./pages/DashboardIndex').then(m => ({ default: m.DashboardIndex })));
const PublicDashboardPage = React.lazy(() => import('./pages/PublicDashboardPage').then(m => ({ default: m.PublicDashboardPage })));
const LandingPage = React.lazy(() => import('./pages/LandingPage').then(m => ({ default: m.LandingPage })));
const WabeeRedesignConceptPage = React.lazy(() => import('./pages/design-lab/WabeeRedesignConceptPage').then(m => ({ default: m.WabeeRedesignConceptPage })));
const AuthCallback = React.lazy(() => import('./pages/AuthCallback').then(m => ({ default: m.AuthCallback })));
const ResetPasswordPage = React.lazy(() => import('./pages/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })));
const TeamPage = React.lazy(() => import('./pages/TeamPage').then(m => ({ default: m.TeamPage })));
const AcceptInvitePage = React.lazy(() => import('./pages/AcceptInvitePage').then(m => ({ default: m.AcceptInvitePage })));
const ProfilePage = React.lazy(() => import('./pages/ProfilePage').then(m => ({ default: m.ProfilePage })));
const OrganizationPage = React.lazy(() => import('./pages/OrganizationPage').then(m => ({ default: m.OrganizationPage })));
const SettingsOrganizationPage = React.lazy(() => import('./pages/settings/SettingsOrganizationPage').then(m => ({ default: m.SettingsOrganizationPage })));
const SettingsTeamPage = React.lazy(() => import('./pages/settings/SettingsTeamPage').then(m => ({ default: m.SettingsTeamPage })));
const SettingsPlanPage = React.lazy(() => import('./pages/settings/SettingsPlanPage').then(m => ({ default: m.SettingsPlanPage })));

// Super Admin Pages
const DashboardGlobalPage = React.lazy(() => import('./pages/super-admin/DashboardGlobalPage').then(m => ({ default: m.DashboardGlobalPage })));
const OrganizationsPage = React.lazy(() => import('./pages/super-admin/OrganizationsPage').then(m => ({ default: m.OrganizationsPage })));
const PlansPage = React.lazy(() => import('./pages/super-admin/PlansPage').then(m => ({ default: m.PlansPage })));
const BrandingPage = React.lazy(() => import('./pages/super-admin/BrandingPage').then(m => ({ default: m.BrandingPage })));
const AuditGlobalPage = React.lazy(() => import('./pages/super-admin/AuditGlobalPage').then(m => ({ default: m.AuditGlobalPage })));
const BrandingTypographyPage = React.lazy(() => import('./pages/super-admin/BrandingTypographyPage').then(m => ({ default: m.BrandingTypographyPage })));
const BrandingColorsPage = React.lazy(() => import('./pages/super-admin/BrandingColorsPage').then(m => ({ default: m.BrandingColorsPage })));
const BrandingThemesPage = React.lazy(() => import('./pages/super-admin/BrandingThemesPage').then(m => ({ default: m.BrandingThemesPage })));
const EmailCustomizationPage = React.lazy(() => import('./pages/super-admin/EmailCustomizationPage').then(m => ({ default: m.EmailCustomizationPage })));
const DataDeletionAdminPage = React.lazy(() => import('./pages/super-admin/DataDeletionAdminPage').then(m => ({ default: m.DataDeletionAdminPage })));
const DataDeletionPage = React.lazy(() => import('./pages/DataDeletionPage').then(m => ({ default: m.DataDeletionPage })));
const DataDeletionConfirmPage = React.lazy(() => import('./pages/DataDeletionConfirmPage').then(m => ({ default: m.DataDeletionConfirmPage })));

// WABEE Pages
const InboxPage = React.lazy(() => import('./pages/wabee/InboxPage'));
const ContactsPage = React.lazy(() => import('./pages/wabee/ContactsPage'));
const WhatsAppChannelsPage = React.lazy(() => import('./pages/wabee/WhatsAppChannelsPage'));
const GroupsPage = React.lazy(() => import('./pages/wabee/GroupsPage'));
const WhatsAppTemplatesPage = React.lazy(() => import('./pages/wabee/WhatsAppTemplatesPage'));
const AiProfilesPage = React.lazy(() => import('./pages/wabee/AiProfilesPage'));
const WebWidgetBuilderPage = React.lazy(() => import('./pages/wabee/WebWidgetBuilderPage'));
const TemplatesHubPage = React.lazy(() => import('./pages/wabee/TemplatesHubPage'));
const TemplatesSelectChannelPage = React.lazy(() => import('./pages/wabee/TemplatesSelectChannelPage').then(m => ({ default: m.TemplatesSelectChannelPage })));
const SegmentsPage = React.lazy(() => import('./pages/wabee/SegmentsPage'));
const CampaignsPage = React.lazy(() => import('./pages/wabee/CampaignsPage'));
const CampaignAnalyticsPage = React.lazy(() => import('./pages/wabee/CampaignAnalyticsPage'));
const NotificationsPage = React.lazy(() => import('./pages/wabee/NotificationsPage'));
const AuditLogsPage = React.lazy(() => import('./pages/wabee/AuditLogsPage'));
const AiIntegrationsPage = React.lazy(() => import('./pages/wabee/AiIntegrationsPage'));
const AutomationsPage = React.lazy(() => import('./pages/wabee/AutomationsPage'));
const CrmIntegrationsPage = React.lazy(() => import('./pages/wabee/CrmIntegrationsPage'));
const AutomationBuilderPage = React.lazy(() => import('./pages/wabee/AutomationBuilderPage'));

// Legal Pages
const TermsPage = React.lazy(() => import('./pages/legal/TermsPage').then(m => ({ default: m.TermsPage })));
const PrivacyPage = React.lazy(() => import('./pages/legal/PrivacyPage').then(m => ({ default: m.PrivacyPage })));
const CookiePolicyPage = React.lazy(() => import('./pages/legal/CookiePolicyPage').then(m => ({ default: m.CookiePolicyPage })));
const AupPage = React.lazy(() => import('./pages/legal/AupPage').then(m => ({ default: m.AupPage })));

const App = () => {
    return (
        <ErrorBoundary>
            <ThemeProvider>
                <ThemeStyleInjector />
                <FaviconManager />
                <Toaster
                    position="top-right"
                    richColors
                    closeButton
                    toastOptions={{
                        duration: 5000,
                    }}
                />
                <ToastProvider>
                    <DialogProvider>
                        <BrowserRouter>
                            <Suspense fallback={<PageLoader />}>
                                <Routes>
                                    {/* Landing Page de Presentación */}
                                    <Route path="/" element={<LandingPage />} />
                                    <Route path="/design-lab/wabee-redesign" element={<WabeeRedesignConceptPage />} />

                                    {/* Dashboard Público (Demo) */}
                                    <Route path="/public-demo" element={<DashboardLayout />}>
                                        <Route index element={<PublicDashboardPage />} />
                                    </Route>

                                    {/* Página Pública de Eliminación de Datos (Requisito Meta) */}
                                    <Route path="/data-deletion" element={<DataDeletionPage />} />
                                    <Route path="/data-deletion/confirm/:id" element={<DataDeletionConfirmPage />} />

                                    {/* Rutas de Autenticación */}
                                    <Route path="/onboarding" element={<OnboardingPage />} />
                                    <Route path="/login" element={<LoginPage />} />
                                    <Route path="/register" element={<RegisterPage />} />
                                    <Route path="/recover" element={<RecoverPage />} />
                                    <Route path="/auth/callback" element={<AuthCallback />} />
                                    <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
                                    <Route path="/invitations/accept" element={<AcceptInvitePage />} />

                                    {/* Rutas Legales */}
                                    <Route path="/legal">
                                        <Route path="terms" element={<TermsPage />} />
                                        <Route path="privacy" element={<PrivacyPage />} />
                                        <Route path="cookies" element={<CookiePolicyPage />} />
                                        <Route path="aup" element={<AupPage />} />
                                    </Route>

                                    {/* Rutas Protegidas */}
                                    <Route path="/dashboard" element={
                                        <AuthGuard>
                                            <DashboardLayout />
                                        </AuthGuard>
                                    }>
                                        <Route index element={<DashboardIndex />} />
                                        <Route path="home" element={<DashboardPage />} />
                                        <Route path="team" element={<TeamPage />} />
                                        <Route path="profile" element={<ProfilePage />} />
                                        <Route path="organization" element={<OrganizationPage />} />

                                        {/* WABEE Modules */}
                                        <Route path="wabee">
                                            <Route path="inbox" element={<ModuleGuard moduleKey="inbox"><InboxPage /></ModuleGuard>} />
                                            <Route path="contacts" element={<ModuleGuard moduleKey="contacts"><ContactsPage /></ModuleGuard>} />
                                            <Route path="segments" element={<ModuleGuard moduleKey="segments"><SegmentsPage /></ModuleGuard>} />
                                            <Route path="channels" element={<ModuleGuard moduleKey="channels"><WhatsAppChannelsPage /></ModuleGuard>} />
                                            <Route path="groups" element={<ModuleGuard moduleKey="groups"><GroupsPage /></ModuleGuard>} />
                                            <Route path="templates/:channelId" element={<ModuleGuard moduleKey="templatesHub"><WhatsAppTemplatesPage /></ModuleGuard>} />
                                            <Route path="templates-hub" element={<ModuleGuard moduleKey="templatesHub"><TemplatesHubPage /></ModuleGuard>} />
                                            <Route path="templates-select" element={<ModuleGuard moduleKey="templatesHub"><TemplatesSelectChannelPage /></ModuleGuard>} />
                                            <Route path="ai-profiles" element={<ModuleGuard moduleKey="aiProfiles"><AiProfilesPage /></ModuleGuard>} />
                                            <Route path="campaigns" element={<ModuleGuard moduleKey="campaigns"><CampaignsPage /></ModuleGuard>} />
                                            <Route path="campaigns/:id/analytics" element={<ModuleGuard moduleKey="campaigns"><CampaignAnalyticsPage /></ModuleGuard>} />
                                            <Route path="notifications" element={<NotificationsPage />} />
                                            <Route path="audit" element={<ModuleGuard moduleKey="audit"><AuditLogsPage /></ModuleGuard>} />
                                            <Route path="widgets" element={<ModuleGuard moduleKey="webWidgets"><WebWidgetBuilderPage /></ModuleGuard>} />
                                            <Route path="ai-integrations" element={<ModuleGuard moduleKey="integrationsTools"><AiIntegrationsPage /></ModuleGuard>} />
                                            <Route path="automations" element={<AutomationsPage />} />
                                            <Route path="automations/:id/builder" element={<AutomationBuilderPage />} />
                                            <Route path="crm-integrations" element={<CrmIntegrationsPage />} />
                                        </Route>

                                        {/* Nuevas rutas de Configuración */}
                                        <Route path="settings">
                                            <Route path="organization" element={<SettingsOrganizationPage />} />
                                            <Route path="team" element={<SettingsTeamPage />} />
                                            <Route path="plan" element={<SettingsPlanPage />} />
                                        </Route>

                                        {/* Super Admin Routes */}
                                        <Route path="super-admin">
                                            <Route index element={<OrganizationsPage />} />
                                            <Route path="organizations" element={<OrganizationsPage />} />
                                            <Route path="plans" element={<PlansPage />} />
                                            <Route path="themes" element={<BrandingThemesPage />} />
                                            <Route path="themes/global/typography" element={<BrandingTypographyPage />} />
                                            <Route path="themes/global/colors" element={<BrandingColorsPage />} />
                                            <Route path="themes/:id/colors" element={<BrandingColorsPage />} />
                                            <Route path="themes/:id/typography" element={<BrandingTypographyPage />} />
                                            <Route path="audit" element={<AuditGlobalPage />} />
                                            <Route path="email-customization" element={<EmailCustomizationPage />} />
                                            <Route path="data-deletion" element={<DataDeletionAdminPage />} />
                                        </Route>
                                    </Route>

                                    {/* Redirección por defecto al inicio */}
                                    <Route path="*" element={<Navigate to="/" replace />} />
                                </Routes>
                            </Suspense>
                        </BrowserRouter>
                    </DialogProvider>
                </ToastProvider>
            </ThemeProvider>
        </ErrorBoundary>
    );
};

export default App;
