import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Lock, Loader2, CheckCircle, ArrowLeft } from 'lucide-react';
import { T, S } from '@/lib/text-tokens';
import { toast } from 'sonner';

/**
 * Página para establecer una nueva contraseña.
 *
 * Llega aquí desde el link del email de recuperación con una sesión
 * activa de Supabase ya establecida por el callback.
 *
 * Usa supabase.auth.updateUser() para cambiar la contraseña directamente,
 * sin necesidad de llamar al backend (Supabase maneja esto de forma segura).
 */
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
            toast.success('Contraseña actualizada correctamente.');
        }
    }, [success]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres.');
            return;
        }
        if (password !== confirm) {
            setError('Las contraseñas no coinciden.');
            return;
        }

        setLoading(true);
        try {
            // Actualizar la contraseña usando la sesión activa de Supabase
            const { error: updateError } = await supabase.auth.updateUser({ password });

            if (updateError) throw updateError;

            setSuccess(true);

            // Redirigir al login después de 2 segundos
            setTimeout(() => {
                navigate('/login', {
                    replace: true,
                    state: { message: '✅ Contraseña actualizada. Ya puedes iniciar sesión.' }
                });
            }, 2000);

        } catch (err: any) {
            setError(err?.message || 'Error al actualizar la contraseña.');
        } finally {
            setLoading(false);
        }
    };

     if (success) {
        return (
            <div className="min-h-screen bg-[#121208] text-white flex flex-col justify-center items-center p-4">
                <div className="max-w-md w-full bg-[#1c1c10] border border-[#2a2a1a] p-10 rounded-2xl shadow-2xl text-center">
                    <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle className="text-emerald-400" size={32} />
                    </div>
                    <h2 className={`${T.sectionTitle} ${S.headingLg} mb-2`}>¡Contraseña <span className="text-[var(--ty-accent)]">actualizada!</span></h2>
                    <p className={`${T.helperText} ${S.body} mb-8`}>Redirigiendo al login...</p>
                    <Loader2 className="animate-spin mx-auto text-[#ead018]" size={24} />
                </div>
            </div>
        );
    }

    return (
         <div className="min-h-screen bg-[#121208] text-white flex flex-col justify-center items-center p-4">
            <div className="max-w-md w-full bg-[var(--bg-card)] border border-[var(--border-default)] p-10 rounded-2xl shadow-2xl relative overflow-hidden">
                <div className="text-center mb-10 relative">
                    <div className="w-14 h-14 bg-[var(--brand-primary)]/10 border border-[var(--brand-primary)]/30 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Lock className="text-[var(--brand-primary)]" size={24} />
                    </div>
                    <h1 className={`${T.pageTitle} ${S.displayMd} mb-2`}>Nueva <span className="text-[var(--ty-accent)]">contraseña</span></h1>
                    <p className={`${T.pageSubtitle} ${S.meta} uppercase tracking-widest`}>Establece tu nueva contraseña de acceso</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                     <div>
                        <label className={`${T.labelText} ${S.meta} ml-1 mb-2 block`}>
                            Nueva contraseña
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#4a4a3a]" size={18} />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className={`${T.inputText} ${S.body} w-full bg-[#2a2a1a]/50 border border-[#2a2a1a] rounded-xl py-3.5 pl-12 pr-4 focus:border-[#ead018] outline-none transition-all placeholder-[#4a4a3a]`}
                                placeholder="Mínimo 6 caracteres"
                                required
                                minLength={6}
                            />
                        </div>
                    </div>

                     <div>
                        <label className={`${T.labelText} ${S.meta} ml-1 mb-2 block`}>
                            Confirmar contraseña
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#4a4a3a]" size={18} />
                            <input
                                type="password"
                                value={confirm}
                                onChange={(e) => setConfirm(e.target.value)}
                                className={`${T.inputText} ${S.body} w-full bg-[#2a2a1a]/50 border border-[#2a2a1a] rounded-xl py-3.5 pl-12 pr-4 focus:border-[#ead018] outline-none transition-all placeholder-[#4a4a3a]`}
                                placeholder="Repite la contraseña"
                                required
                            />
                        </div>
                    </div>

                     <button
                        type="submit"
                        disabled={loading}
                        className={`${T.buttonPrimaryText} ${S.body} w-full bg-[var(--brand-primary)] hover:brightness-110 active:scale-[0.98] py-4 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 mt-4 shadow-lg`}
                    >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : 'Guardar nueva contraseña'}
                    </button>
                </form>

                  <div className="mt-10 text-center relative border-t border-[var(--border-default)] pt-8">
                    <Link
                        to="/login"
                        className={`${T.helperText} ${S.meta} inline-flex items-center gap-2 text-[var(--brand-primary)] hover:brightness-125 transition-all uppercase tracking-widest`}
                    >
                        <ArrowLeft size={16} /> Volver al login
                    </Link>
                </div>
            </div>
        </div>
    );
};
