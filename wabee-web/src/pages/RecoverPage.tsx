import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import { Mail, Loader2, ArrowLeft, Send, Zap } from 'lucide-react';
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
            toast.success('Te enviamos las instrucciones para restablecer tu contraseña.');
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
            setError(err?.response?.data?.error?.message || err?.message || 'Error al enviar el correo de recuperación');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#121208] text-white flex flex-col justify-center items-center p-4">
            <div className="max-w-md w-full bg-[#1c1c10] border border-[#2a2a1a] p-10 rounded-2xl shadow-2xl relative overflow-hidden">
                {/* Decorative glow */}
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#ead018]/5 blur-[60px] rounded-full"></div>

                {!success ? (
                    <>
                        <div className="text-center mb-10 relative">
                            <div className="flex justify-center mb-6">
                                <BrandLogo variant="icon" size={48} />
                            </div>
                            <h1 className={`${T.pageTitle} ${S.displayMd} mb-2`}>Recuperar <span className="text-[var(--ty-accent)]">cuenta</span></h1>
                            <p className={`${T.pageSubtitle} ${S.meta} uppercase tracking-widest`}>Te enviaremos las instrucciones a tu correo</p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6 relative">
                            <div className="space-y-2">
                                <label className={`${T.labelText} ${S.meta} ml-1`}>Email Corporativo</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[#4a4a3a]" size={18} />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className={`${T.inputText} ${S.body} w-full bg-[#2a2a1a]/50 border border-[#2a2a1a] rounded-xl py-3.5 pl-12 pr-4 focus:outline-none focus:border-[#ead018]/50 transition-all placeholder-[#4a4a3a]`}
                                        placeholder="tu@empresa.com"
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className={`${T.buttonPrimaryText} ${S.body} w-full bg-[var(--brand-primary)] hover:brightness-110 active:scale-[0.98] py-4 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 mt-4 shadow-lg`}
                            >
                                {loading ? <Loader2 className="animate-spin" size={20} /> : <>Enviar instrucciones <Send size={18} /></>}
                            </button>
                        </form>
                    </>
                ) : (
                     <div className="text-center py-6 relative">
                        <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-8 animate-pulse">
                            <Send className="text-emerald-500" size={32} />
                        </div>
                        <h2 className={`${T.sectionTitle} ${S.headingLg} text-white mb-2`}>¡Correo <span className="text-[var(--ty-accent)]">enviado!</span></h2>
                        <p className={`${T.helperText} ${S.body} mb-4`}>Revisa tu bandeja de entrada para restablecer tu contraseña.</p>
                        <p className={`${T.helperText} ${S.meta} mb-10 leading-relaxed italic opacity-60`}>Puede tardar unos minutos. Revisa también tu carpeta de spam.</p>
                        <Link to="/login" className={`${T.buttonText} ${S.body} text-[var(--brand-primary)] hover:brightness-125 transition-all px-6 py-3 bg-[var(--bg-elevated)] rounded-xl inline-block border border-[var(--border-default)]`}>Volver al inicio de sesión</Link>
                    </div>
                )}

                <div className="mt-10 text-center relative border-t border-[var(--border-default)] pt-8">
                    <Link to="/login" className={`${T.helperText} ${S.meta} inline-flex items-center gap-2 text-[var(--brand-primary)] hover:brightness-125 transition-all uppercase tracking-widest`}>
                        <ArrowLeft size={16} /> Volver al login
                    </Link>
                </div>
            </div>
        </div>
    );
};
