import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, Lock, User, CheckCircle, XCircle, ArrowRight } from 'lucide-react';
import client from '../api/client';
import { T, S } from '@/lib/text-tokens';
import { BrandLogo } from '../components/BrandLogo';

export const AcceptInvitePage = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [needsPassword, setNeedsPassword] = useState(false);
    const [formData, setFormData] = useState({ name: '', password: '' });

    useEffect(() => {
        if (!token) {
            setError('Token de invitacion no encontrado.');
        }
    }, [token]);

    const handleAccept = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { data } = await client.post('/auth/invitations/accept', {
                token,
                name: formData.name,
                password: formData.password
            });

            setSuccess(true);

            if (data.token) {
                localStorage.setItem('wabee_token', data.token);
                setTimeout(() => navigate('/dashboard'), 2000);
            } else {
                setTimeout(() => navigate('/login'), 2000);
            }
        } catch (err: any) {
            const msg = err.response?.data?.error?.message || 'Error al aceptar la invitacion';
            if (msg.includes('contrasena')) {
                setNeedsPassword(true);
            }
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const renderShell = (content: React.ReactNode) => (
        <div className="wabee-auth min-h-screen">
            <div className="wabee-redesign__bg" />
            <div className="wabee-public-page__shell">
                <div className="wabee-public-card wabee-public-card--narrow">
                    <div className="wabee-public-card__glow wabee-public-card__glow--orange" />
                    <div className="wabee-public-card__glow wabee-public-card__glow--purple" />
                    {content}
                </div>
            </div>
        </div>
    );

    if (success) {
        return renderShell(
            <div className="text-center py-4">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-600">
                    <CheckCircle size={26} />
                </div>
                <h1 className={`${T.sectionTitle} ${S.headingLg} mb-4`}>Invitacion aceptada</h1>
                <p className={`${T.helperText} ${S.body} wabee-public-card__copy mb-6`}>
                    Ya eres parte del equipo. Redirigiendo al dashboard...
                </p>
                <Loader2 className="animate-spin mx-auto text-[var(--brand-primary)]" size={24} />
            </div>
        );
    }

    return renderShell(
        <>
            <div className="wabee-public-card__header">
                <div className="wabee-public-card__brand">
                    <BrandLogo variant="icon" size={48} />
                </div>
                <h1 className={`${T.pageTitle} ${S.displayMd} mb-2`}>Unirse al equipo</h1>
                <p className={`${T.pageSubtitle} ${S.meta} wabee-public-card__copy uppercase tracking-widest`}>
                    Estas a un paso de comenzar
                </p>
            </div>

            {error && (
                <div className="wabee-public-alert wabee-public-alert--error mb-6">
                    <XCircle size={16} /> {error}
                </div>
            )}

            {!needsPassword ? (
                <div className="space-y-6">
                    <p className={`${T.helperText} ${S.body} wabee-public-card__copy`}>
                        Al aceptar, te uniras a la organizacion con el rol asignado por tu administrador.
                    </p>
                    <button
                        onClick={() => handleAccept()}
                        disabled={loading || !token}
                        className={`${T.buttonText} ${S.body} wabee-public-submit`}
                    >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : <>Aceptar invitacion <ArrowRight size={18} /></>}
                    </button>
                </div>
            ) : (
                <form onSubmit={handleAccept} className="wabee-public-form">
                    <div className="wabee-public-field">
                        <label className={`${T.labelText} ${S.meta} wabee-public-label`}>Tu nombre</label>
                        <div className="wabee-public-input-wrap">
                            <User className="wabee-public-input-icon" size={18} />
                            <input
                                type="text"
                                required
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className={`${T.inputText} ${S.body} wabee-public-input`}
                                placeholder="Juan Perez"
                            />
                        </div>
                    </div>

                    <div className="wabee-public-field">
                        <label className={`${T.labelText} ${S.meta} wabee-public-label`}>Crea tu contrasena</label>
                        <div className="wabee-public-input-wrap">
                            <Lock className="wabee-public-input-icon" size={18} />
                            <input
                                type="password"
                                required
                                minLength={8}
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                className={`${T.inputText} ${S.body} wabee-public-input`}
                                placeholder="Minimo 8 caracteres"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className={`${T.buttonText} ${S.body} wabee-public-submit`}
                    >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : 'Completar perfil y aceptar'}
                    </button>
                </form>
            )}
        </>
    );
};
