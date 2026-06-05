import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Lock, Loader2, CheckCircle, ArrowLeft } from 'lucide-react';
import { T, S } from '@/lib/text-tokens';
import { toast } from 'sonner';

export const ResetPasswordPage = () => {
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        if (error) {
            toast.error(error);
        }
    }, [error]);

    useEffect(() => {
        if (success) {
            toast.success('Contrasena actualizada correctamente.');
        }
    }, [success]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (password.length < 6) {
            setError('La contrasena debe tener al menos 6 caracteres.');
            return;
        }
        if (password !== confirm) {
            setError('Las contrasenas no coinciden.');
            return;
        }

        setLoading(true);
        try {
            const { error: updateError } = await supabase.auth.updateUser({ password });

            if (updateError) throw updateError;

            setSuccess(true);

            setTimeout(() => {
                navigate('/login', {
                    replace: true,
                    state: { message: 'Contrasena actualizada. Ya puedes iniciar sesion.' }
                });
            }, 2000);
        } catch (err: any) {
            setError(err?.message || 'Error al actualizar la contrasena.');
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
                <h2 className={`${T.sectionTitle} ${S.headingLg} mb-2`}>Contrasena actualizada</h2>
                <p className={`${T.helperText} ${S.body} wabee-public-card__copy mb-6`}>Redirigiendo al login...</p>
                <Loader2 className="animate-spin mx-auto text-[var(--brand-primary)]" size={24} />
            </div>
        );
    }

    return renderShell(
        <>
            <div className="wabee-public-card__header">
                <div className="wabee-public-card__icon">
                    <Lock size={24} />
                </div>
                <h1 className={`${T.pageTitle} ${S.displayMd} mb-2`}>Nueva contrasena</h1>
                <p className={`${T.pageSubtitle} ${S.meta} wabee-public-card__copy uppercase tracking-widest`}>
                    Establece tu nueva contrasena de acceso
                </p>
            </div>

            <form onSubmit={handleSubmit} className="wabee-public-form">
                <div className="wabee-public-field">
                    <label className={`${T.labelText} ${S.meta} wabee-public-label`}>Nueva contrasena</label>
                    <div className="wabee-public-input-wrap">
                        <Lock className="wabee-public-input-icon" size={18} />
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className={`${T.inputText} ${S.body} wabee-public-input`}
                            placeholder="Minimo 6 caracteres"
                            required
                            minLength={6}
                        />
                    </div>
                </div>

                <div className="wabee-public-field">
                    <label className={`${T.labelText} ${S.meta} wabee-public-label`}>Confirmar contrasena</label>
                    <div className="wabee-public-input-wrap">
                        <Lock className="wabee-public-input-icon" size={18} />
                        <input
                            type="password"
                            value={confirm}
                            onChange={(e) => setConfirm(e.target.value)}
                            className={`${T.inputText} ${S.body} wabee-public-input`}
                            placeholder="Repite la contrasena"
                            required
                        />
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className={`${T.buttonPrimaryText} ${S.body} wabee-public-submit`}
                >
                    {loading ? <Loader2 className="animate-spin" size={20} /> : 'Guardar nueva contrasena'}
                </button>
            </form>

            <div className="wabee-public-divider">
                <Link
                    to="/login"
                    className={`${T.helperText} ${S.meta} inline-flex items-center gap-2 wabee-public-link uppercase tracking-widest`}
                >
                    <ArrowLeft size={16} /> Volver al login
                </Link>
            </div>
        </>
    );
};
