import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import { Mail, Loader2, ArrowLeft, Send } from 'lucide-react';
import { T, S } from '@/lib/text-tokens';
import { BrandLogo } from '../components/BrandLogo';
import { toast } from 'sonner';

export const RecoverPage = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (error) {
            toast.error(error);
        }
    }, [error]);

    useEffect(() => {
        if (success) {
            toast.success('Te enviamos las instrucciones para restablecer tu contrasena.');
        }
    }, [success]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            await client.post('/auth/recover', { email });
            setSuccess(true);
        } catch (err: any) {
            setError(err?.response?.data?.error?.message || err?.message || 'Error al enviar el correo de recuperacion');
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
            <div className="text-center py-6">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-600">
                    <Send size={26} />
                </div>
                <h2 className={`${T.sectionTitle} ${S.headingLg} mb-2`}>Correo enviado</h2>
                <p className={`${T.helperText} ${S.body} wabee-public-card__copy mb-3`}>
                    Revisa tu bandeja de entrada para restablecer tu contrasena.
                </p>
                <p className={`${T.helperText} ${S.meta} wabee-public-card__copy opacity-70`}>
                    Puede tardar unos minutos. Revisa tambien tu carpeta de spam.
                </p>

                <Link to="/login" className={`${T.buttonText} ${S.body} wabee-public-submit mt-6`}>
                    Volver al inicio de sesion
                </Link>
            </div>
        );
    }

    return renderShell(
        <>
            <div className="wabee-public-card__header">
                <div className="wabee-public-card__brand">
                    <BrandLogo variant="icon" size={48} />
                </div>
                <h1 className={`${T.pageTitle} ${S.displayMd} mb-2`}>Recuperar cuenta</h1>
                <p className={`${T.pageSubtitle} ${S.meta} wabee-public-card__copy uppercase tracking-widest`}>
                    Te enviaremos las instrucciones a tu correo
                </p>
            </div>

            <form onSubmit={handleSubmit} className="wabee-public-form">
                <div className="wabee-public-field">
                    <label className={`${T.labelText} ${S.meta} wabee-public-label`}>Email corporativo</label>
                    <div className="wabee-public-input-wrap">
                        <Mail className="wabee-public-input-icon" size={18} />
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className={`${T.inputText} ${S.body} wabee-public-input`}
                            placeholder="tu@empresa.com"
                            required
                        />
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className={`${T.buttonPrimaryText} ${S.body} wabee-public-submit`}
                >
                    {loading ? <Loader2 className="animate-spin" size={20} /> : <>Enviar instrucciones <Send size={18} /></>}
                </button>
            </form>

            <div className="wabee-public-divider">
                <Link to="/login" className={`${T.helperText} ${S.meta} inline-flex items-center gap-2 wabee-public-link uppercase tracking-widest`}>
                    <ArrowLeft size={16} /> Volver al login
                </Link>
            </div>
        </>
    );
};
