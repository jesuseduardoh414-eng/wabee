import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, Mail, Lock, User, CheckCircle, XCircle, Zap, ArrowRight } from 'lucide-react';
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
            setError('Token de invitación no encontrado.');
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

            // Si el backend devuelve un token de sesión, lo guardamos
            if (data.token) {
                localStorage.setItem('wabee_token', data.token);
                // Redirigir al semáforo del dashboard para determinar el primer módulo
                setTimeout(() => navigate('/dashboard'), 2000);
            } else {
                // Si no, mandamos al login
                setTimeout(() => navigate('/login'), 2000);
            }
        } catch (err: any) {
            const msg = err.response?.data?.error?.message || 'Error al aceptar la invitación';
            if (msg.includes('contraseña')) {
                setNeedsPassword(true);
            }
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen bg-[#121208] text-white flex flex-col justify-center items-center p-4">
                <div className="max-w-md w-full bg-[#1c1c10] border border-[#2a2a1a] p-10 rounded-2xl shadow-2xl text-center">
                    <div className="w-16 h-16 bg-[#60c060]/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle className="text-[#60c060]" size={32} />
                    </div>
                    <h1 className={`${T.sectionTitle} ${S.headingLg} mb-4`}>¡Invitación <span className="text-[var(--ty-accent)]">Aceptada!</span></h1>
                    <p className={`${T.helperText} ${S.body} mb-8`}>Ya eres parte del equipo. Redirigiendo al dashboard...</p>
                    <Loader2 className="animate-spin mx-auto text-[#ead018]" size={24} />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#121208] text-white flex flex-col justify-center items-center p-4">
            <div className="max-w-md w-full bg-[#1c1c10] border border-[#2a2a1a] p-10 rounded-2xl shadow-2xl relative overflow-hidden">
                 <div className="text-center mb-10">
                    <div className="flex justify-center mb-6">
                        <BrandLogo variant="icon" size={48} />
                    </div>
                    <h1 className={`${T.pageTitle} ${S.displayMd} mb-2`}>Unirse al <span className="text-[var(--ty-accent)]">Equipo</span></h1>
                    <p className={`${T.pageSubtitle} ${S.meta} uppercase tracking-widest`}>Estás a un paso de comenzar</p>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm font-medium flex items-center gap-2">
                        <XCircle size={16} /> {error}
                    </div>
                )}

                 {!needsPassword ? (
                    <div className="space-y-6">
                        <p className={`${T.helperText} ${S.body} text-center`}>Al aceptar, te unirás a la organización con el rol asignado por tu administrador.</p>
                        <button
                            onClick={() => handleAccept()}
                            disabled={loading || !token}
                            className={`${T.buttonText} ${S.body} w-full bg-[#ead018] hover:brightness-110 active:scale-[0.98] py-4 rounded-xl font-bold text-[#121208] flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-[0_10px_20px_rgba(234,208,24,0.15)]`}
                        >
                            {loading ? <Loader2 className="animate-spin" size={20} /> : <>Aceptar Invitación <ArrowRight size={18} /></>}
                        </button>
                    </div>
                ) : (
                     <form onSubmit={handleAccept} className="space-y-6">
                        <div className="space-y-2">
                            <label className={`${T.labelText} ${S.meta} text-[#4a4a3a] font-black uppercase tracking-widest ml-1`}>Tu Nombre</label>
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-[#4a4a3a]" size={18} />
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className={`${T.inputText} ${S.body} w-full bg-[#2a2a1a]/50 border border-[#2a2a1a] rounded-xl py-3.5 pl-12 pr-4 text-white focus:border-[#ead018] outline-none transition-all`}
                                    placeholder="Juan Pérez"
                                />
                            </div>
                        </div>

                         <div className="space-y-2">
                            <label className={`${T.labelText} ${S.meta} text-[#4a4a3a] font-black uppercase tracking-widest ml-1`}>Crea tu Contraseña</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#4a4a3a]" size={18} />
                                <input
                                    type="password"
                                    required
                                    minLength={8}
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    className={`${T.inputText} ${S.body} w-full bg-[#2a2a1a]/50 border border-[#2a2a1a] rounded-xl py-3.5 pl-12 pr-4 text-white focus:border-[#ead018] outline-none transition-all`}
                                    placeholder="Mínimo 8 caracteres"
                                />
                            </div>
                        </div>

                         <button
                            type="submit"
                            disabled={loading}
                            className={`${T.buttonText} ${S.body} w-full bg-[#ead018] hover:brightness-110 active:scale-[0.98] py-4 rounded-xl font-bold text-[#121208] flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-[0_10px_20px_rgba(234,208,24,0.15)]`}
                        >
                            {loading ? <Loader2 className="animate-spin" size={20} /> : <>Completar Perfil y Aceptar</>}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};
