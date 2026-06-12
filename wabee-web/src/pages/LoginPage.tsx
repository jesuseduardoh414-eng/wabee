import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import client from '../api/client';
import { Mail, Lock, Loader2, ArrowLeft, ArrowRight, MailCheck, X } from 'lucide-react';
import { T, S } from '@/lib/text-tokens';
import { toast } from 'sonner';
import { BrandLogo } from '../components/BrandLogo';

export const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [otpCode, setOtpCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [step, setStep] = useState<'login' | '2fa'>('login');
    const [twoFactorData, setTwoFactorData] = useState<{
        type: 'setup' | 'verify',
        challengeId: string,
        qrCode?: string
    } | null>(null);

    const navigate = useNavigate();
    const location = useLocation();
    const verifiedMessage = (location.state as any)?.message || null;
    const shownStateMessageRef = useRef<string | null>(null);
    const [showVerifyBanner, setShowVerifyBanner] = useState(!!verifiedMessage);

    useEffect(() => {
        if (verifiedMessage && shownStateMessageRef.current !== verifiedMessage) {
            toast.success(verifiedMessage);
            shownStateMessageRef.current = verifiedMessage;
        }
    }, [verifiedMessage]);

    useEffect(() => {
        if (error) {
            toast.error(error);
        }
    }, [error]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { data } = await client.post('/auth/login', { email, password });

            if (data.requires2FA || data.requires2FASetup) {
                setTwoFactorData({
                    type: data.requires2FASetup ? 'setup' : 'verify',
                    challengeId: data.challengeId || data.tempToken,
                    qrCode: data.qrCode,
                });
                setStep('2fa');
            } else {
                localStorage.setItem('wabee_session', '1');
                localStorage.setItem('wabee_user', JSON.stringify(data.user));

                const savedThemeId = data.user?.preferences?.selectedThemeId;
                if (savedThemeId) {
                    localStorage.setItem('wabee_user_theme_id', savedThemeId);
                } else {
                    localStorage.removeItem('wabee_user_theme_id');
                }
                window.dispatchEvent(new CustomEvent('refresh-branding-colors'));

                if (data.user?.globalRole) {
                    localStorage.setItem('wabee_globalRole', data.user.globalRole);
                } else {
                    localStorage.removeItem('wabee_globalRole');
                }
                if (data.organizations && data.organizations.length > 0) {
                    const org = data.organizations[0];
                    localStorage.setItem('wabee_orgId', org.id);
                    localStorage.setItem('wabee_orgName', org.name);
                    localStorage.setItem('wabee_role', org.role);
                }

                navigate('/dashboard');
            }
        } catch (err: any) {
            setError(err.response?.data?.error?.message || err.response?.data?.message || 'Credenciales invalidas');
        } finally {
            setLoading(false);
        }
    };

    const handle2FA = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!twoFactorData) return;

        setLoading(true);
        setError(null);

        const endpoint = twoFactorData.type === 'setup' ? '/auth/2fa/confirm-setup' : '/auth/2fa/verify';

        try {
            const { data } = await client.post(endpoint, {
                challengeId: twoFactorData.challengeId,
                code: otpCode,
            });

            localStorage.setItem('wabee_session', '1');
            localStorage.setItem('wabee_user', JSON.stringify(data.user));

            const savedThemeId = data.user?.preferences?.selectedThemeId;
            if (savedThemeId) {
                localStorage.setItem('wabee_user_theme_id', savedThemeId);
            } else {
                localStorage.removeItem('wabee_user_theme_id');
            }
            window.dispatchEvent(new CustomEvent('refresh-branding-colors'));

            if (data.user?.globalRole) {
                localStorage.setItem('wabee_globalRole', data.user.globalRole);
            } else {
                localStorage.removeItem('wabee_globalRole');
            }
            if (data.organizations && data.organizations.length > 0) {
                const org = data.organizations[0];
                localStorage.setItem('wabee_orgId', org.id);
                localStorage.setItem('wabee_orgName', org.name);
                localStorage.setItem('wabee_role', org.role);
            }

            navigate('/dashboard');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Codigo invalido');
        } finally {
            setLoading(false);
        }
    };

    const renderBee = (className: string) => (
        <div className={`wabee-bee ${className}`} aria-hidden="true">
            <span className="wabee-bee__wing wabee-bee__wing--left" />
            <span className="wabee-bee__wing wabee-bee__wing--right" />
            <span className="wabee-bee__body" />
        </div>
    );

    if (step === '2fa' && twoFactorData) {
        return (
            <div className="wabee-auth min-h-screen">
                <div className="wabee-redesign__bg" />
                {renderBee('wabee-bee--one')}
                {renderBee('wabee-bee--three')}

                <div className="wabee-auth__shell">
                    <div className="wabee-auth__panel wabee-auth__panel--info">
                        <Link to="/" className="wabee-brand wabee-auth__brand" aria-label="Ir al inicio de Wabee">
                            <BrandLogo variant="full" size={56} />
                        </Link>

                        <span className="wabee-kicker">Seguridad empresarial</span>
                        <h1 className="wabee-auth__title">
                            Verifica tu acceso
                            <span>sin romper el flujo de trabajo</span>
                        </h1>
                        <p className="wabee-auth__copy">
                            {twoFactorData.type === 'setup'
                                ? 'Configura una capa adicional de seguridad para proteger equipos, conversaciones y operaciones.'
                                : 'Confirma tu identidad con tu app de autenticacion para mantener una operacion segura dentro de Wabee.'}
                        </p>
                    </div>

                    <div className="wabee-auth__panel wabee-auth__panel--form">
                        <div className="wabee-auth-card">
                            <div className="wabee-auth-card__glow wabee-auth-card__glow--orange" />
                            <div className="wabee-auth-card__glow wabee-auth-card__glow--purple" />

                            <Link to="/" className={`${T.helperText} ${S.meta} wabee-auth-top-link`}>
                                <ArrowLeft size={16} />
                                Volver al inicio
                            </Link>

                            <div className="wabee-auth-card__header">
                                <h2 className={`${T.pageTitle} ${S.displayMd}`}>
                                    {twoFactorData.type === 'setup' ? 'Configurar 2FA' : 'Verificacion 2FA'}
                                </h2>
                                <p className={`${T.pageSubtitle} ${S.meta}`}>
                                    {twoFactorData.type === 'setup'
                                        ? 'Escanea el QR con tu app de autenticacion'
                                        : 'Ingresa el codigo de 6 digitos de tu app'}
                                </p>
                            </div>

                            {twoFactorData.qrCode && (
                                <div className="wabee-auth-qr">
                                    <img src={twoFactorData.qrCode} alt="2FA QR Code" className="w-48 h-48" />
                                </div>
                            )}

                            <form onSubmit={handle2FA} className="space-y-6">
                                <div className="space-y-2">
                                    <label className={`${T.labelText} ${S.meta} wabee-auth-label`}>Codigo de seguridad</label>
                                    <input
                                        type="text"
                                        maxLength={6}
                                        value={otpCode}
                                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                                        className={`${T.inputText} ${S.body} wabee-auth-code-input`}
                                        placeholder="000000"
                                        required
                                        autoFocus
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className={`${T.buttonPrimaryText} ${S.body} wabee-auth-submit`}
                                >
                                    {loading ? <Loader2 className="animate-spin" size={20} /> : 'Verificar y entrar'}
                                </button>

                                <div className="text-center pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setStep('login')}
                                        className={`${T.helperText} ${S.meta} wabee-auth-helper-link`}
                                    >
                                        Volver al login
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="wabee-auth min-h-screen">
            <div className="wabee-redesign__bg" />
            {renderBee('wabee-bee--one')}
            {renderBee('wabee-bee--two')}
            {renderBee('wabee-bee--four')}

            <div className="wabee-auth__shell">
                <div className="wabee-auth__panel wabee-auth__panel--info">
                    <Link to="/" className="wabee-brand wabee-auth__brand" aria-label="Ir al inicio de Wabee">
                        <BrandLogo variant="full" size={56} />
                    </Link>

                    <span className="wabee-kicker">Acceso seguro para equipos</span>
                    <h1 className="wabee-auth__title">
                        Opera tus conversaciones
                        <span>desde una entrada mas clara y premium</span>
                    </h1>
                    <p className="wabee-auth__copy">
                        Inicia sesion para entrar a tu inbox, campanas, contactos y herramientas de automatizacion
                        desde una experiencia visual alineada con la nueva direccion de Wabee.
                    </p>
                </div>

                <div className="wabee-auth__panel wabee-auth__panel--form">
                    <div className="wabee-auth-card">
                        <div className="wabee-auth-card__glow wabee-auth-card__glow--orange" />
                        <div className="wabee-auth-card__glow wabee-auth-card__glow--purple" />

                        <Link to="/" className={`${T.helperText} ${S.meta} wabee-auth-top-link`}>
                            <ArrowLeft size={16} />
                            Volver al inicio
                        </Link>

                        <div className="wabee-auth-card__header">
                            <h2 className={`${T.pageTitle} ${S.displayMd}`}>Bienvenido de nuevo</h2>
                            <p className={`${T.pageSubtitle} ${S.meta}`}>Ingresa tus credenciales para continuar</p>
                        </div>

                        {showVerifyBanner && (
                            <div className="wabee-auth-verify-callout">
                                <MailCheck size={18} className="wabee-auth-verify-callout__icon" />
                                <div className="wabee-auth-verify-callout__body">
                                    <strong>Verifica tu correo antes de entrar</strong>
                                    <p>Te enviamos un enlace de activación. Búscalo en tu bandeja de entrada y haz clic para activar tu cuenta.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowVerifyBanner(false)}
                                    className="wabee-auth-verify-callout__dismiss"
                                    aria-label="Cerrar aviso"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        )}

                        <form onSubmit={handleLogin} className="space-y-6 relative">
                            <div className="space-y-2">
                                <label className={`${T.labelText} ${S.meta} wabee-auth-label`}>Email</label>
                                <div className="relative">
                                    <Mail className="wabee-auth-field__icon" size={18} />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className={`${T.inputText} ${S.body} wabee-auth-input`}
                                        placeholder="tu@empresa.com"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className={`${T.labelText} ${S.meta} wabee-auth-label`}>Contraseña</label>
                                    <Link to="/recover" className={`${T.helperText} ${S.meta} wabee-auth-helper-link`}>
                                        ¿Olvidaste tu contraseña?
                                    </Link>
                                </div>
                                <div className="relative">
                                    <Lock className="wabee-auth-field__icon" size={18} />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className={`${T.inputText} ${S.body} wabee-auth-input`}
                                        placeholder="••••••••"
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className={`${T.buttonPrimaryText} ${S.body} wabee-auth-submit`}
                            >
                                {loading ? <Loader2 className="animate-spin" size={20} /> : <>Entrar <ArrowRight size={18} /></>}
                            </button>
                        </form>

                        <p className={`${T.helperText} ${S.body} wabee-auth-footer`}>
                            ¿No tienes cuenta?
                            <Link to="/register" className="wabee-auth-register-link">
                                Regístrate gratis
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
