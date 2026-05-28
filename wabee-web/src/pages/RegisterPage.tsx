import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import client from '../api/client';
import { Mail, Lock, Building, Loader2, ArrowRight, User } from 'lucide-react';
import { T, S } from '@/lib/text-tokens';
import { toast } from 'sonner';
import { BrandLogo } from '../components/BrandLogo';

export const RegisterPage = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [organizationName, setOrganizationName] = useState('');
    const [acceptTerms, setAcceptTerms] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        if (error) {
            toast.error(error);
        }
    }, [error]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            await client.post('/auth/register', {
                name,
                email,
                password,
                organizationName,
                acceptTerms,
            });
            navigate('/login', { state: { message: 'Cuenta y organizacion creadas con exito. Revisa tu correo y verifica tu cuenta antes de iniciar sesion.' } });
        } catch (err: any) {
            setError(err.response?.data?.error?.message || 'Error al crear la cuenta');
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

    return (
        <div className="wabee-auth min-h-screen">
            <div className="wabee-redesign__bg" />
            {renderBee('wabee-bee--one')}
            {renderBee('wabee-bee--two')}
            {renderBee('wabee-bee--six')}

            <div className="wabee-auth__shell">
                <div className="wabee-auth__panel wabee-auth__panel--info">
                    <Link to="/" className="wabee-brand wabee-auth__brand" aria-label="Ir al inicio de Wabee">
                        <BrandLogo variant="full" size={56} />
                    </Link>

                    <span className="wabee-kicker">Nuevo espacio para tu empresa</span>
                    <h1 className="wabee-auth__title">
                        Crea tu acceso
                        <span>y activa tu operacion desde el primer dia</span>
                    </h1>
                    <p className="wabee-auth__copy">
                        Registra tu cuenta, crea tu organizacion y prepara a tu equipo para gestionar
                        conversaciones, campanas y automatizacion desde una experiencia mas clara y consistente.
                    </p>
                </div>

                <div className="wabee-auth__panel wabee-auth__panel--form">
                    <div className="wabee-auth-card">
                        <div className="wabee-auth-card__glow wabee-auth-card__glow--orange" />
                        <div className="wabee-auth-card__glow wabee-auth-card__glow--purple" />

                        <div className="wabee-auth-card__header">
                            <h2 className={`${T.pageTitle} ${S.displayMd}`}>Comienza tu viaje</h2>
                            <p className={`${T.pageSubtitle} ${S.meta}`}>Crea tu cuenta y organizacion ahora</p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4 relative">
                            <div className="space-y-2">
                                <label className={`${T.labelText} ${S.meta} wabee-auth-label`}>Nombre completo</label>
                                <div className="relative">
                                    <User className="wabee-auth-field__icon" size={18} />
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className={`${T.inputText} ${S.body} wabee-auth-input`}
                                        placeholder="Tu nombre o alias"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className={`${T.labelText} ${S.meta} wabee-auth-label`}>Nombre de la organizacion</label>
                                <div className="relative">
                                    <Building className="wabee-auth-field__icon" size={18} />
                                    <input
                                        type="text"
                                        value={organizationName}
                                        onChange={(e) => setOrganizationName(e.target.value)}
                                        className={`${T.inputText} ${S.body} wabee-auth-input`}
                                        placeholder="Mi empresa S.A."
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className={`${T.labelText} ${S.meta} wabee-auth-label`}>Email corporativo</label>
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
                                <label className={`${T.labelText} ${S.meta} wabee-auth-label`}>Contraseña de acceso</label>
                                <div className="relative">
                                    <Lock className="wabee-auth-field__icon" size={18} />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className={`${T.inputText} ${S.body} wabee-auth-input`}
                                        placeholder="Minimo 6 caracteres"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="wabee-auth-check">
                                <input
                                    type="checkbox"
                                    id="terms"
                                    checked={acceptTerms}
                                    onChange={(e) => setAcceptTerms(e.target.checked)}
                                    className="wabee-auth-checkbox"
                                    required
                                />
                                <label htmlFor="terms" className={`${T.helperText} ${S.meta}`}>
                                    Acepto los
                                    <Link to="/legal/terms" className="wabee-auth-inline-link">
                                        terminos y condiciones
                                    </Link>
                                    y la
                                    <Link to="/legal/privacy" className="wabee-auth-inline-link">
                                        politica de privacidad
                                    </Link>
                                    de la plataforma.
                                </label>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className={`${T.buttonPrimaryText} ${S.body} wabee-auth-submit`}
                            >
                                {loading ? <Loader2 className="animate-spin" size={20} /> : <>Crear cuenta <ArrowRight size={18} /></>}
                            </button>
                        </form>

                        <p className={`${T.helperText} ${S.body} wabee-auth-footer`}>
                            ¿Ya tienes cuenta?
                            <Link to="/login" className="wabee-auth-register-link">
                                Inicia sesion
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
