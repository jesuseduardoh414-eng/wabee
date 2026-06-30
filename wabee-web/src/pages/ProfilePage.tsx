import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    User, Lock, Bell, Palette, Globe, Shield,
    Camera, Save, Loader2, CheckCircle, XCircle,
    Eye, EyeOff, QrCode, ToggleLeft, ToggleRight, ChevronRight, Sun, Moon,
    Building2, Database, Users as UsersIcon
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from '../api/client';
import { useTheme } from '../context/ThemeContext';
import { useDialog } from '../context/DialogContext';
import { T, S } from '@/lib/text-tokens';
import { themesApi, BrandingTheme } from '@/api/wabee/themes.api';

type Section = 'profile' | 'security' | 'preferences' | 'notifications' | 'twofa';

const SECTIONS = [
    { id: 'profile' as Section, icon: User, label: 'Información Personal' },
    { id: 'preferences' as Section, icon: Palette, label: 'Preferencias de Tema e Idioma' },
    { id: 'notifications' as Section, icon: Bell, label: 'Notificaciones' },
    { id: 'security' as Section, icon: Lock, label: 'Cambio de Contraseña' },
    { id: 'twofa' as Section, icon: Shield, label: 'Verificación en 2 Pasos (2FA)' },
];

export const ProfilePage = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [activeSection, setActiveSection] = useState<Section>('profile');
    const { confirm } = useDialog();
    const { theme: currentTheme, setTheme } = useTheme();

    const [profile, setProfile] = useState<any>(null);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
    const [saveMsg, setSaveMsg] = useState('');

    const [name, setName] = useState('');
    const [avatarPreview, setAvatarPreview] = useState('');

    // Temas publicados para el selector de perfil
    const [publishedThemes, setPublishedThemes] = useState<BrandingTheme[]>([]);
    const [loadingThemes, setLoadingThemes] = useState(false);

    const { data: profileQuery, isLoading: loading } = useQuery({
        queryKey: ['me'],
        queryFn: async () => {
            const res = await client.get('/auth/profile');
            return res.data;
        }
    });

    useEffect(() => {
        if (profileQuery?.profile) {
            const p = profileQuery.profile;
            setProfile(p);
            setName(p.name || '');
            setAvatarPreview(p.avatar || '');
            
            const savedThemeId = p.preferences?.selectedThemeId || '';
            setPrefs({
                theme: (p.preferences?.theme || currentTheme) as 'dark' | 'light',
                language: p.preferences?.language || 'es',
                selectedThemeId: savedThemeId
            });

            // Sincronizar tema seleccionado del servidor al localStorage
            // para que ThemeStyleInjector lo aplique con datos frescos del servidor
            if (savedThemeId) {
                const currentStoredId = localStorage.getItem('wabee_user_theme_id');
                if (currentStoredId !== savedThemeId) {
                    localStorage.setItem('wabee_user_theme_id', savedThemeId);
                    window.dispatchEvent(new CustomEvent('refresh-branding-colors'));
                }
            }

            setNotifs({
                email: p.preferences?.notif_email !== undefined ? p.preferences.notif_email : true,
                push: p.preferences?.notif_push !== undefined ? p.preferences.notif_push : false,
                weekly_report: p.preferences?.notif_weekly !== undefined ? p.preferences.notif_weekly : true,
                team_activity: p.preferences?.notif_team !== undefined ? p.preferences.notif_team : true,
            });
        }
    }, [profileQuery]);

    // Cargar temas publicados para el selector del perfil
    useEffect(() => {
        const fetchPublished = async () => {
            setLoadingThemes(true);
            try {
                const data = await themesApi.getPublishedThemes();
                setPublishedThemes(data);
            } catch (e) {
                console.error('Error cargando temas publicados:', e);
            } finally {
                setLoadingThemes(false);
            }
        };
        fetchPublished();
    }, []);

    const showFeedback = (status: 'success' | 'error', msg: string) => {
        setSaveStatus(status);
        setSaveMsg(msg);
        setTimeout(() => { setSaveStatus('idle'); setSaveMsg(''); }, 3500);
    };

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            showFeedback('error', 'La imagen debe pesar menos de 2MB.');
            return;
        }

        setSaveStatus('saving');
        const reader = new FileReader();
        reader.onloadend = async () => {
            const dataUrl = reader.result as string;
            setAvatarPreview(dataUrl);
            try {
                const { data } = await client.put('/auth/profile', { avatar: dataUrl });
                const newAvatarUrl = data.profile.avatar;
                setAvatarPreview(newAvatarUrl);

                const savedUser = localStorage.getItem('wabee_user');
                const user = savedUser ? JSON.parse(savedUser) : {};
                localStorage.setItem('wabee_user', JSON.stringify({ ...user, avatar: newAvatarUrl }));

                window.dispatchEvent(new Event('profileUpdated'));
                queryClient.invalidateQueries({ queryKey: ['me'] });
                showFeedback('success', '✅ Foto de perfil actualizada.');
            } catch (err: any) {
                showFeedback('error', err.response?.data?.error?.message || 'Error al guardar la imagen.');
            }
        };
        reader.readAsDataURL(file);
    };

    const saveProfile = async () => {
        setSaveStatus('saving');
        try {
            const { data } = await client.put('/auth/profile', { name });
            const savedUser = localStorage.getItem('wabee_user');
            const user = savedUser ? JSON.parse(savedUser) : {};
            localStorage.setItem('wabee_user', JSON.stringify({ ...user, name }));
            window.dispatchEvent(new Event('profileUpdated'));
            queryClient.invalidateQueries({ queryKey: ['me'] });
            showFeedback('success', 'Perfil actualizado correctamente.');
        } catch (e: any) {
            showFeedback('error', e.response?.data?.error?.message || 'Error al guardar.');
        }
    };

    const [prefs, setPrefs] = useState({ theme: currentTheme, language: 'es', selectedThemeId: '' });
    const [notifs, setNotifs] = useState({ email: true, push: false, weekly_report: true, team_activity: true });

    // Aplicar un tema publicado seleccionado por el usuario
    const applyPublishedTheme = (theme: BrandingTheme) => {
        // Solo guardar el ID — el inyector siempre obtiene datos frescos del servidor
        localStorage.setItem('wabee_user_theme_id', theme.id);
        // Limpiar colores/tipografía estáticos en caso de que existieran de versiones anteriores
        localStorage.removeItem('wabee_user_theme_colors');
        localStorage.removeItem('wabee_user_theme_typography');
        
        // El inyector re-fetcha los datos del servidor al recibir este evento
        window.dispatchEvent(new CustomEvent('refresh-branding-colors'));
    };

    const handleSelectTheme = (theme: BrandingTheme) => {
        setPrefs(prev => ({ ...prev, selectedThemeId: theme.id }));
        applyPublishedTheme(theme);
    };

    const savePreferences = async () => {
        setSaveStatus('saving');
        try {
            const preferences = {
                ...(profile?.preferences || {}),
                theme: prefs.theme,
                language: prefs.language,
                selectedThemeId: prefs.selectedThemeId,
                notif_email: notifs.email,
                notif_push: notifs.push,
                notif_weekly: notifs.weekly_report,
                notif_team: notifs.team_activity,
            };
            setTheme(prefs.theme as 'dark' | 'light');
            await client.put('/auth/profile', { preferences });
            showFeedback('success', `Ajustes aplicados correctamente.`);
        } catch (e: any) {
            showFeedback('error', e.response?.data?.error?.message || 'Error al guardar.');
        }
    };

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPass, setShowPass] = useState(false);

    const changePassword = async () => {
        if (newPassword !== confirmPassword) {
            showFeedback('error', 'Las contraseñas no coinciden.');
            return;
        }
        if (newPassword.length < 8) {
            showFeedback('error', 'Mínimo 8 caracteres.');
            return;
        }
        setSaveStatus('saving');
        try {
            await client.post('/auth/change-password', { newPassword });
            setNewPassword('');
            setConfirmPassword('');
            showFeedback('success', 'Contraseña cambiada correctamente.');
        } catch (e: any) {
            showFeedback('error', e.response?.data?.error?.message || 'Error al cambiar contraseña.');
        }
    };

    const [twoFAData, setTwoFAData] = useState<{ qrCode: string; challengeId: string } | null>(null);
    const [twoFACode, setTwoFACode] = useState('');
    const [twoFAStep, setTwoFAStep] = useState<'idle' | 'setup'>('idle');

    const initSetup2FA = async () => {
        setSaveStatus('saving');
        try {
            const { data } = await client.post('/auth/2fa/init-setup');
            setTwoFAData({ qrCode: data.qrCode, challengeId: data.challengeId });
            setTwoFAStep('setup');
            setSaveStatus('idle');
        } catch (e: any) {
            showFeedback('error', e.response?.data?.error?.message || 'Error al generar QR.');
        }
    };

    const confirm2FA = async () => {
        if (!twoFAData) return;
        if (twoFACode.length !== 6) {
            showFeedback('error', 'Ingresa los 6 dígitos.');
            return;
        }
        setSaveStatus('saving');
        try {
            await client.post('/auth/2fa/verify-and-enable', {
                challengeId: twoFAData.challengeId,
                code: twoFACode
            });
            setProfile((prev: any) => ({ ...prev, has2fa: true }));
            setTwoFAStep('idle');
            setTwoFAData(null);
            setTwoFACode('');
            showFeedback('success', '✅ 2FA activado correctamente.');
        } catch (e: any) {
            showFeedback('error', 'Código incorrecto. Intenta de nuevo.');
            setSaveStatus('idle');
        }
    };

    const disable2FA = async () => {
        const isConfirmed = await confirm({
            title: 'Desactivar 2FA',
            description: '¿Seguro que deseas desactivar el 2FA?',
            isDestructive: true,
            confirmText: 'Desactivar'
        });
        if (!isConfirmed) return;

        setSaveStatus('saving');
        try {
            await client.post('/auth/2fa/disable');
            setProfile({ ...profile, has2fa: false });
            showFeedback('success', '2FA desactivado.');
        } catch (e: any) {
            showFeedback('error', 'Error al desactivar.');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="animate-spin text-[var(--brand-primary)]" size={40} />
            </div>
        );
    }

    return (
        <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-12">
                <div>
                    <h1 className={`${T.pageTitle} ${S.displayMd} text-[var(--text-strong)]`}>Configuración de <span className="text-[var(--brand-primary)]">Cuenta</span></h1>
                    <p className={`${T.pageSubtitle} ${S.body} text-[var(--text-muted)]`}>Personaliza tu identidad y seguridad en WABEE.</p>
                </div>
            </div>

            {/* Toast Feedback */}
            {saveStatus !== 'idle' && saveMsg && (
                <div className={`fixed bottom-8 right-8 z-50 flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border animate-in slide-in-from-right duration-300 ${
                    saveStatus === 'success' ? 'bg-[var(--bg-card)] border-[var(--state-success)]/30 text-[var(--state-success)]' : 'bg-[var(--bg-card)] border-[var(--state-danger)]/30 text-[var(--state-danger)]'
                }`}>
                    {saveStatus === 'success' ? <CheckCircle size={20} /> : <XCircle size={20} />}
                    <span className={`${S.meta} font-bold uppercase tracking-widest`}>{saveMsg}</span>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                {/* Navigation Sidebar */}
                <div className="lg:col-span-3 space-y-6">
                    <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-[2.5rem] p-8 text-center relative overflow-hidden group">
                        <div className="absolute -top-24 -right-24 w-48 h-48 bg-[var(--brand-primary)]/5 blur-[60px] rounded-full group-hover:bg-[var(--brand-primary)]/10 transition-all"></div>

                        <div className="relative inline-block mb-6">
                            <div className="w-28 h-28 rounded-[2rem] bg-[var(--bg-surface)] border-4 border-[var(--border-default)] flex items-center justify-center overflow-hidden shadow-2xl">
                                {avatarPreview ? (
                                    <img src={avatarPreview} alt={name} className="w-full h-full object-cover" />
                                ) : (
                                    <User size={48} className="text-[var(--text-muted)]" />
                                )}
                            </div>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="absolute -bottom-2 -right-2 w-10 h-10 bg-[var(--brand-primary)]  rounded-xl flex items-center justify-center shadow-lg hover:scale-110 transition-all border-4 border-[var(--bg-card)]"
                            >
                                <Camera size={18} />
                            </button>
                            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                        </div>

                        <h2 className={`${T.cardTitle} ${S.headingSm} text-[var(--text-strong)] truncate px-2`}>{name || 'Usuario'}</h2>
                        <p className={`${T.helperText} ${S.meta} uppercase tracking-widest mt-1 text-[var(--text-muted)] opacity-60`}>{(localStorage.getItem('wabee_role') || 'USER').replace('_', ' ')}</p>
                    </div>

                    <nav className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-[2rem] p-4 flex flex-col gap-2">
                        {SECTIONS.map(s => (
                            <button
                                key={s.id}
                                onClick={() => setActiveSection(s.id)}
                                className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl transition-all group ${activeSection === s.id
                                        ? 'bg-[var(--brand-primary)]  shadow-[0_10px_20px_var(--brand-primary)]/20'
                                        : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-strong)]'
                                    }`}
                            >
                                <s.icon size={18} className={activeSection === s.id ? 'opacity-100' : 'opacity-40 group-hover:opacity-100'} />
                                <span className={`${S.meta} font-bold uppercase tracking-widest text-left flex-1`}>{s.label.split(' ')[0]}</span>
                                <ChevronRight size={14} className={activeSection === s.id ? 'opacity-100' : 'opacity-20'} />
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Content Area */}
                <div className="lg:col-span-9">
                    <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-[2.5rem] p-10 sm:p-12 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--brand-primary)]/[0.02] blur-[100px] rounded-full"></div>

                        {/* SECTION: PROFILE */}
                        {activeSection === 'profile' && (
                            <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-500">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-[var(--brand-primary)]/10 flex items-center justify-center text-[var(--brand-primary)]">
                                        <User size={24} />
                                    </div>
                                    <h3 className={`${T.sectionTitle} ${S.headingLg} text-[var(--text-strong)]`}>Información <span className="text-[var(--brand-primary)]">Personal</span></h3>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <label className={`${T.labelText} ${S.meta} text-[var(--text-muted)] font-bold uppercase tracking-widest ml-1`}>Nombre Mostrado</label>
                                        <input
                                            type="text" value={name} onChange={e => setName(e.target.value)}
                                            className={`${T.inputText} ${S.body} w-full bg-[var(--bg-input)] border border-[var(--border-default)] rounded-2xl py-4 px-6 text-[var(--text-strong)] focus:outline-none focus:border-[var(--brand-primary)]/50 transition-all`}
                                            placeholder="Tu nombre completo"
                                        />
                                    </div>
                                    <div className="space-y-4">
                                        <label className={`${T.labelText} ${S.meta} text-[var(--text-muted)] font-bold uppercase tracking-widest ml-1`}>Email principal</label>
                                        <input
                                            type="email" value={profile?.email || ''} disabled
                                            className={`${T.inputText} ${S.body} w-full bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl py-4 px-6 text-[var(--text-muted)] cursor-not-allowed`}
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end pt-6">
                                    <button 
                                        onClick={saveProfile} disabled={saveStatus === 'saving'}
                                        className={`flex items-center gap-3 px-10 py-4 bg-[var(--brand-primary)] rounded-2xl ${T.buttonPrimaryText} ${S.body} hover:scale-[1.02] transition-all shadow-lg shadow-[var(--brand-primary)]/20 disabled:opacity-50`}
                                    >
                                        {saveStatus === 'saving' ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                        Actualizar Perfil
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* SECTION: PREFERENCES */}
                        {activeSection === 'preferences' && (
                            <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-500">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-[var(--brand-primary)]/10 flex items-center justify-center text-[var(--brand-primary)]">
                                        <Palette size={24} />
                                    </div>
                                    <h3 className={`${T.sectionTitle} ${S.headingLg} text-[var(--text-strong)]`}>Apariencia e <span className="text-[var(--brand-primary)]">Idioma</span></h3>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
                                <div className="space-y-6">
                                        <label className={`${T.labelText} ${S.meta} text-[var(--text-muted)] font-bold uppercase tracking-widest ml-1`}>Tema Visual</label>
                                        
                                        {loadingThemes ? (
                                            <div className="flex items-center justify-center py-8">
                                                <Loader2 className="animate-spin text-[var(--brand-primary)]" size={28} />
                                            </div>
                                        ) : publishedThemes.length === 0 ? (
                                            <div className="p-6 rounded-2xl border border-dashed border-[var(--border-default)] text-center">
                                                <Globe size={32} className="mx-auto mb-3 text-[var(--text-muted)] opacity-40" />
                                                <p className={`${T.helperText} ${S.meta} text-[var(--text-muted)]`}>No hay temas publicados disponibles.</p>
                                                <p className={`${T.helperText} text-[10px] mt-1 text-[var(--text-muted)] opacity-60`}>El Super Admin debe publicar al menos un tema.</p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 gap-4 max-h-[420px] overflow-y-auto pr-1">
                                                {publishedThemes.map(t => {
                                                    const isSelected = prefs.selectedThemeId
                                                        ? prefs.selectedThemeId === t.id
                                                        : t.isActive;
                                                    return (
                                                        <button
                                                            key={t.id}
                                                            onClick={() => handleSelectTheme(t)}
                                                            className={`w-full text-left p-4 rounded-2xl border transition-all ${
                                                                isSelected
                                                                    ? 'bg-[var(--brand-primary)]/10 border-[var(--brand-primary)] shadow-[0_0_20px_var(--brand-primary)]/10'
                                                                    : 'bg-[var(--bg-input)] border-[var(--border-default)] hover:border-[var(--brand-primary)]/40'
                                                            }`}
                                                        >
                                                            <div className="flex items-center justify-between mb-3">
                                                                <span className={`${S.body} font-bold uppercase tracking-[0.15em] ${
                                                                    isSelected ? 'text-[var(--brand-primary)]' : 'text-[var(--text-strong)]'
                                                                }`}>
                                                                    {t.name}
                                                                </span>
                                                                {isSelected && <CheckCircle size={18} className="text-[var(--brand-primary)] shrink-0" />}
                                                                {t.isActive && !isSelected && (
                                                                    <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)] border border-[var(--border-default)] px-2 py-0.5 rounded-full">Default</span>
                                                                )}
                                                            </div>
                                                            {/* Mini preview de colores */}
                                                            <div className="flex gap-1.5 h-7">
                                                                {['brand-primary', 'bg-page', 'bg-card', 'state-success', 'chart-3'].map(key => (
                                                                    <div
                                                                        key={key}
                                                                        className="flex-1 rounded-md border border-black/20"
                                                                        style={{ backgroundColor: t.colors[key] }}
                                                                    />
                                                                ))}
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-6">
                                        <label className={`${T.labelText} ${S.meta} text-[var(--text-muted)] font-bold uppercase tracking-widest ml-1`}>Idioma de Interfaz</label>
                                        <div className="grid grid-cols-1 gap-4">
                                            {[{k:'es', l:'Español 🇲🇽'}, {k:'en', l:'English 🇺🇸'}].map(l => (
                                                <button
                                                    key={l.k}
                                                    onClick={() => setPrefs({ ...prefs, language: l.k })}
                                                    className={`flex items-center justify-between p-6 rounded-2xl border transition-all ${
                                                        prefs.language === l.k 
                                                            ? 'bg-[var(--brand-primary)]/10 border-[var(--brand-primary)] text-[var(--brand-primary)]' 
                                                            : 'bg-[var(--bg-input)] border-[var(--border-default)] text-[var(--text-muted)] hover:border-[var(--brand-primary)]/30'
                                                    }`}
                                                >
                                                    <span className={`${S.body} font-bold uppercase tracking-[0.2em]`}>{l.l}</span>
                                                    {prefs.language === l.k && <CheckCircle size={20} />}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end pt-6">
                                    <button 
                                        onClick={savePreferences} disabled={saveStatus === 'saving'}
                                        className={`flex items-center gap-3 px-10 py-4 bg-[var(--brand-primary)] rounded-2xl ${T.buttonPrimaryText} ${S.body} hover:scale-[1.02] transition-all shadow-lg shadow-[var(--brand-primary)]/20 disabled:opacity-50`}
                                    >
                                        {saveStatus === 'saving' ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                        Aplicar Ajustes
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* SECTION: NOTIFICATIONS */}
                        {activeSection === 'notifications' && (
                            <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-500">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-[var(--brand-primary)]/10 flex items-center justify-center text-[var(--brand-primary)]">
                                        <Bell size={24} />
                                    </div>
                                    <h3 className={`${T.sectionTitle} ${S.headingLg} text-[var(--text-strong)]`}>Centro de <span className="text-[var(--brand-primary)]">Alertas</span></h3>
                                </div>

                                <div className="space-y-4">
                                    {[
                                        { key: 'email', label: 'Notificaciones por Email', desc: 'Resúmenes de actividad y alertas críticas.' },
                                        { key: 'push', label: 'Notificaciones Push', desc: 'Alertas en tiempo real en tu navegador.' },
                                        { key: 'weekly_report', label: 'Reporte Semanal', desc: 'Métricas clave enviadas cada lunes.' },
                                        { key: 'team_activity', label: 'Actividad de Equipo', desc: 'Nuevos miembros o cambios en roles.' },
                                    ].map(n => (
                                        <div key={n.key} className="flex items-center justify-between p-6 bg-[var(--bg-card)] rounded-[2rem] border border-[var(--border-default)] hover:border-[var(--brand-primary)]/20 transition-all">
                                            <div>
                                                <p className={`${T.cardTitle} ${S.body} text-[var(--text-strong)]`}>{n.label}</p>
                                                <p className={`${T.helperText} ${S.meta} mt-1 text-[var(--text-muted)] opacity-70`}>{n.desc}</p>
                                            </div>
                                            <button 
                                                onClick={() => setNotifs({ ...notifs, [n.key]: !notifs[n.key as keyof typeof notifs] })}
                                                className="transition-transform active:scale-90"
                                            >
                                                {notifs[n.key as keyof typeof notifs] 
                                                    ? <ToggleRight size={48} className="text-[var(--brand-primary)]" /> 
                                                    : <ToggleLeft size={48} className="text-[var(--border-strong)]" />
                                                }
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex justify-end pt-6">
                                    <button 
                                        onClick={savePreferences} disabled={saveStatus === 'saving'}
                                        className={`flex items-center gap-3 px-10 py-4 bg-[var(--brand-primary)] rounded-2xl ${T.buttonPrimaryText} ${S.body} hover:scale-[1.02] transition-all shadow-lg shadow-[var(--brand-primary)]/20`}
                                    >
                                        <Save size={18} /> Guardar Preferencias
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* SECTION: SECURITY */}
                        {activeSection === 'security' && (
                            <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-500">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-[var(--brand-primary)]/10 flex items-center justify-center text-[var(--brand-primary)]">
                                        <Lock size={24} />
                                    </div>
                                    <h3 className={`${T.sectionTitle} ${S.headingLg} text-[var(--text-strong)]`}>Blindaje de <span className="text-[var(--brand-primary)]">Acceso</span></h3>
                                </div>

                                <div className="space-y-8 max-w-xl">
                                    <div className="space-y-4">
                                        <label className={`${T.labelText} ${S.meta} text-[var(--text-muted)] font-bold uppercase tracking-widest ml-1`}>Nueva Contraseña</label>
                                        <div className="relative">
                                            <Lock className="absolute left-6 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={20} />
                                            <input
                                                type={showPass ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)}
                                                className={`${T.inputText} ${S.body} w-full bg-[var(--bg-input)] border border-[var(--border-default)] rounded-2xl py-5 pl-16 pr-16 text-[var(--text-strong)] focus:outline-none focus:border-[var(--brand-primary)]/50 transition-all`}
                                                placeholder="Mínimo 8 caracteres"
                                            />
                                            <button 
                                                onClick={() => setShowPass(!showPass)}
                                                className="absolute right-6 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--brand-primary)] transition-colors"
                                            >
                                                {showPass ? <EyeOff size={20} /> : <Eye size={20} />}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <label className={`${T.labelText} ${S.meta} text-[var(--text-muted)] font-bold uppercase tracking-widest ml-1`}>Confirmar Nueva Contraseña</label>
                                        <div className="relative">
                                            <Lock className="absolute left-6 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={20} />
                                            <input
                                                type={showPass ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                                                className={`${T.inputText} ${S.body} w-full bg-[var(--bg-input)] border border-[var(--border-default)] rounded-2xl py-5 pl-16 pr-6 text-[var(--text-strong)] focus:outline-none focus:border-[var(--brand-primary)]/50 transition-all`}
                                                placeholder="Repite la contraseña"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex justify-end pt-6">
                                        <button 
                                            onClick={changePassword} disabled={saveStatus === 'saving'}
                                            className={`flex items-center gap-3 px-10 py-4 bg-[var(--brand-primary)] rounded-2xl ${T.buttonPrimaryText} ${S.body} hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-[var(--brand-primary)]/20 disabled:opacity-50`}
                                        >
                                            {saveStatus === 'saving' ? <Loader2 size={18} className="animate-spin" /> : <Shield size={18} />}
                                            Actualizar Llave de Acceso
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* SECTION: 2FA */}
                        {activeSection === 'twofa' && (
                            <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-500">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-[var(--brand-primary)]/10 flex items-center justify-center text-[var(--brand-primary)]">
                                        <Shield size={24} />
                                    </div>
                                    <h3 className={`${T.sectionTitle} ${S.headingLg} text-[var(--text-strong)]`}>Doble Factor <span className="text-[var(--brand-primary)]">(2FA)</span></h3>
                                </div>

                                <div className={`p-8 rounded-[2.5rem] border flex items-center gap-6 ${
                                    profile?.has2fa ? 'bg-[var(--state-success)]/10 border-[var(--state-success)]/20' : 'bg-[var(--state-danger)]/10 border-[var(--state-danger)]/20'
                                }`}>
                                    <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center border-2 ${
                                        profile?.has2fa ? 'bg-[var(--state-success)]/10 border-[var(--state-success)]/20 text-[var(--state-success)]' : 'bg-[var(--state-danger)]/10 border-[var(--state-danger)]/20 text-[var(--state-danger)]'
                                    }`}>
                                        <Shield size={32} />
                                    </div>
                                    <div className="flex-1">
                                        <p className={`${T.cardTitle} ${S.body} text-[var(--text-strong)]`}>
                                            {profile?.has2fa ? 'Tu cuenta está blindada' : 'Tu cuenta es vulnerable'}
                                        </p>
                                        <p className={`${T.helperText} ${S.meta} mt-1 text-[var(--text-muted)] opacity-70 uppercase tracking-widest font-bold`}>
                                            {profile?.has2fa ? 'Doble factor de autenticación activo' : 'Activa 2FA para prevenir accesos no autorizados'}
                                        </p>
                                    </div>
                                    {profile?.has2fa && (
                                        <button onClick={disable2FA} className="text-[var(--state-danger)] hover:text-[var(--state-danger)]/80 font-bold text-[10px] uppercase tracking-widest px-4 py-2 border border-[var(--state-danger)]/20 rounded-xl hover:bg-[var(--state-danger)]/10 transition-all">
                                            Desactivar
                                        </button>
                                    )}
                                </div>

                                {!profile?.has2fa && twoFAStep === 'idle' && (
                                    <div className="flex justify-center py-10">
                                        <button 
                                            onClick={initSetup2FA} disabled={saveStatus === 'saving'}
                                            className="flex flex-col items-center gap-6 group"
                                        >
                                            <div className="w-24 h-24 rounded-[2rem] bg-[var(--brand-primary)]  flex items-center justify-center shadow-lg shadow-[var(--brand-primary)]/30 group-hover:scale-110 transition-all">
                                                <QrCode size={48} />
                                            </div>
                                            <span className={`${S.meta} font-bold uppercase tracking-[0.3em] text-[var(--brand-primary)] group-hover:brightness-125`}>Vincular Dispositivo</span>
                                        </button>
                                    </div>
                                )}

                                {twoFAStep === 'setup' && twoFAData && (
                                    <div className="max-w-md mx-auto space-y-10 animate-in zoom-in-95 duration-500 text-center">
                                        <div className="p-8 bg-white rounded-[3rem] shadow-xl inline-block">
                                            <img src={twoFAData.qrCode} alt="QR 2FA" className="w-56 h-56" />
                                        </div>
                                        
                                        <div className="space-y-6">
                                            <p className={`${T.helperText} ${S.meta} text-[var(--text-muted)] leading-relaxed px-10`}>
                                                Escanea el código con Google Authenticator o Authy e ingresa el código generado.
                                            </p>
                                            
                                            <input
                                                type="text" maxLength={6} value={twoFACode}
                                                onChange={e => setTwoFACode(e.target.value.replace(/\D/g, ''))}
                                                className="w-full bg-[var(--bg-input)] border border-[var(--brand-primary)]/50 rounded-[2rem] py-6 text-center text-4xl font-bold tracking-[0.5em] text-[var(--brand-primary)] focus:outline-none focus:shadow-lg focus:shadow-[var(--brand-primary)]/10 transition-all"
                                                placeholder="000000"
                                            />

                                            <div className="flex gap-4">
                                                <button 
                                                    onClick={confirm2FA} 
                                                    disabled={twoFACode.length !== 6 || saveStatus === 'saving'}
                                                    className="flex-1 py-4 bg-[var(--brand-primary)]  rounded-2xl font-bold uppercase tracking-widest text-xs shadow-lg shadow-[var(--brand-primary)]/20 disabled:opacity-50"
                                                >
                                                    Activar Ahora
                                                </button>
                                                <button 
                                                    onClick={() => setTwoFAStep('idle')}
                                                    className="px-8 py-4 border border-[var(--border-default)] text-[var(--text-muted)] rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-[var(--bg-hover)] transition-all"
                                                >
                                                    Cancelar
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
