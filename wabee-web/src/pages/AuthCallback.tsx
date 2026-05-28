import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import client from '../api/client';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { T, S } from '@/lib/text-tokens';

/**
 * Página de callback universal para Supabase.
 *
 * Maneja dos tipos de flujos:
 * 1. type=signup / type=magiclink → verifica correo → login
 * 2. type=recovery → restablecimiento de contraseña → /auth/reset-password
 */
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
                // Detectar el tipo de flujo desde la URL
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

                // 1. Obtener/intercambiar la sesión desde la URL
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
                    throw new Error('No se pudo establecer la sesión de verificación.');
                }

                // ─── Flujo de RECUPERACIÓN DE CONTRASEÑA ─────────────────────
                if (type === 'recovery') {
                    // Redirigir a la página de nueva contraseña
                    // La sesión ya está activa en Supabase, así que updateUser() funcionará
                    navigate('/auth/reset-password', { replace: true });
                    return;
                }

                // ─── Flujo de VERIFICACIÓN DE CORREO ─────────────────────────
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
            <div className="wabee-auth min-h-screen flex items-center justify-center p-4 md:p-8">
                <div className="w-full max-w-xl rounded-[2rem] border border-[var(--border-default)] bg-[var(--bg-card)] px-8 py-10 text-center shadow-[0_30px_80px_-30px_rgba(0,0,0,0.22)]">
                    <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-[2rem] border border-red-500/20 bg-red-500/10 text-red-500">
                        <AlertTriangle size={40} />
                    </div>
                    <h1 className={`${T.pageTitle} ${S.displaySm} mb-3`}>Enlace inválido o expirado</h1>
                    <p className={`${T.pageSubtitle} ${S.body} mx-auto mb-8 max-w-md`}>
                        {errorMsg}
                    </p>
                    <a
                        href="/login"
                        className="inline-flex items-center justify-center rounded-2xl bg-[var(--brand-primary)] px-8 py-3 text-sm font-black uppercase tracking-[0.12em] text-[var(--brand-primary-foreground)] transition-all hover:scale-[1.02] active:scale-95"
                    >
                        Ir al Login
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="wabee-auth min-h-screen flex items-center justify-center p-4 md:p-8">
            <div className="w-full max-w-xl rounded-[2rem] border border-[var(--border-default)] bg-[var(--bg-card)] px-8 py-10 text-center shadow-[0_30px_80px_-30px_rgba(0,0,0,0.22)]">
                <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-[2rem] bg-[var(--brand-primary)]/12 text-[var(--brand-primary)]">
                    <Loader2 size={40} className="animate-spin" />
                </div>
                <h1 className={`${T.pageTitle} ${S.displaySm} mb-3`}>Procesando verificación</h1>
                <p className={`${T.pageSubtitle} ${S.body} mx-auto max-w-md`}>
                    Por favor espera, estamos confirmando tu enlace y te redirigiremos en un momento.
                </p>
            </div>
        </div>
    );
};
