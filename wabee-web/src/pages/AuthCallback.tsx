import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import client from '../api/client';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { T, S } from '@/lib/text-tokens';

export const AuthCallback = () => {
    const [status, setStatus] = useState<'loading' | 'error'>('loading');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const navigate = useNavigate();
    const hasHandledRef = useRef(false);

    useEffect(() => {
        const handleCallback = async () => {
            if (hasHandledRef.current) return;
            hasHandledRef.current = true;

            try {
                const urlParams = new URLSearchParams(window.location.search);
                const hashParams = new URLSearchParams(window.location.hash.replace('#', ''));
                const type = urlParams.get('type') || hashParams.get('type') || '';
                const authCode = urlParams.get('code');
                const accessTokenFromHash = hashParams.get('access_token');
                const refreshTokenFromHash = hashParams.get('refresh_token');

                if (accessTokenFromHash && type !== 'recovery') {
                    await client.post('/auth/confirm-verification', {
                        access_token: accessTokenFromHash,
                    });

                    navigate('/login', {
                        replace: true,
                        state: {
                            verified: true,
                            message: 'Correo verificado con exito. Ahora ya puedes iniciar sesion.'
                        }
                    });
                    return;
                }

                let session = null;

                const { data: sessionData } = await supabase.auth.getSession();
                session = sessionData?.session;

                if (!session) {
                    if (accessTokenFromHash && refreshTokenFromHash) {
                        const { data: restored, error: setSessionError } = await supabase.auth.setSession({
                            access_token: accessTokenFromHash,
                            refresh_token: refreshTokenFromHash,
                        });

                        if (setSessionError) throw setSessionError;
                        session = restored?.session;
                    } else if (authCode) {
                        const { data: exchanged, error: exchangeError } =
                            await supabase.auth.exchangeCodeForSession(window.location.href);

                        if (exchangeError) throw exchangeError;
                        session = exchanged?.session;
                    }
                }

                if (!session?.access_token) {
                    throw new Error('No se pudo establecer la sesion de verificacion.');
                }

                if (type === 'recovery') {
                    navigate('/auth/reset-password', { replace: true });
                    return;
                }

                await client.post('/auth/confirm-verification', {
                    access_token: session.access_token,
                });

                navigate('/login', {
                    replace: true,
                    state: {
                        verified: true,
                        message: 'Correo verificado con exito. Ahora ya puedes iniciar sesion.'
                    }
                });
            } catch (err: any) {
                console.error('[AuthCallback] Error:', err);
                const message = err?.response?.data?.error?.message || err?.message || 'Error al procesar el enlace. Puede haber expirado.';
                setErrorMsg(message);
                setStatus('error');
            }
        };

        handleCallback();
    }, [navigate]);

    if (status === 'error') {
        return (
            <div className="wabee-auth min-h-screen">
                <div className="wabee-redesign__bg" />
                <div className="wabee-public-page__shell">
                    <div className="wabee-public-card">
                        <div className="wabee-public-card__glow wabee-public-card__glow--orange" />
                        <div className="wabee-public-card__glow wabee-public-card__glow--purple" />
                        <div className="text-center">
                            <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-[2rem] border border-red-500/20 bg-red-500/10 text-red-500">
                                <AlertTriangle size={40} />
                            </div>
                            <h1 className={`${T.pageTitle} ${S.displaySm} mb-3`}>Enlace invalido o expirado</h1>
                            <p className={`${T.pageSubtitle} ${S.body} wabee-public-card__copy mx-auto mb-8 max-w-md`}>
                                {errorMsg}
                            </p>
                            <a
                                href="/login"
                                className="inline-flex items-center justify-center wabee-public-submit px-8 text-sm font-bold uppercase tracking-[0.12em]"
                            >
                                Ir al login
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="wabee-auth min-h-screen">
            <div className="wabee-redesign__bg" />
            <div className="wabee-public-page__shell">
                <div className="wabee-public-card">
                    <div className="wabee-public-card__glow wabee-public-card__glow--orange" />
                    <div className="wabee-public-card__glow wabee-public-card__glow--purple" />
                    <div className="text-center">
                        <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-[2rem] bg-[var(--brand-primary)]/12 text-[var(--brand-primary)]">
                            <Loader2 size={40} className="animate-spin" />
                        </div>
                        <h1 className={`${T.pageTitle} ${S.displaySm} mb-3`}>Procesando verificacion</h1>
                        <p className={`${T.pageSubtitle} ${S.body} wabee-public-card__copy mx-auto max-w-md`}>
                            Por favor espera, estamos confirmando tu enlace y te redirigiremos en un momento.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
