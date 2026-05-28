import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LegalLayout } from '../layouts/LegalLayout';
import { T, S } from '@/lib/text-tokens';
import client from '@/api/client';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export const DataDeletionConfirmPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        const confirmRequest = async () => {
            try {
                // Hacemos el llamado a la API para confirmar
                await client.patch(`/public/data-deletion/${id}/confirm`);
                setSuccess(true);
            } catch (err: any) {
                console.error('Error confirming request:', err);
                setError(err.response?.data?.message || 'El enlace de confirmación es inválido o la solicitud ya fue procesada.');
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            confirmRequest();
        } else {
            setError('No se proporcionó un ID de solicitud válido.');
            setLoading(false);
        }
    }, [id]);

    return (
        <LegalLayout
            title="Confirmación de Eliminación"
            lastUpdate={new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
            summary="Estamos procesando la confirmación de la eliminación de tus datos."
        >
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-6">
                {loading ? (
                    <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
                        <Loader2 className="animate-spin text-[var(--brand-primary)]" size={48} />
                        <h2 className={`${T.sectionTitle} ${S.headingMd}`}>Verificando confirmación...</h2>
                        <p className={`${T.sectionSubtitle} ${S.body}`}>Por favor, espera un momento.</p>
                    </div>
                ) : error ? (
                    <div className="w-full max-w-md bg-[var(--bg-card)] border border-[var(--border-default)] rounded-2xl p-6 shadow-sm space-y-6 text-center">
                        <div className="mx-auto w-16 h-16 bg-[var(--state-danger)]/10 rounded-full flex items-center justify-center text-[var(--state-danger)]">
                            <AlertCircle size={32} />
                        </div>
                        <div className="space-y-2">
                            <h2 className={`${T.sectionTitle} ${S.headingMd} text-[var(--state-danger)]`}>Error de Confirmación</h2>
                            <p className={`${T.sectionSubtitle} ${S.body}`}>{error}</p>
                        </div>
                        <button 
                            onClick={() => window.location.href = '/'}
                            className="px-6 py-2 bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-lg font-medium transition-opacity hover:opacity-90"
                        >
                            Volver al inicio
                        </button>
                    </div>
                ) : success ? (
                    <div className="w-full max-w-md bg-[var(--bg-card)] border border-[var(--border-default)] rounded-2xl p-8 shadow-sm space-y-6 text-center">
                        <div className="mx-auto w-20 h-20 bg-[var(--state-success)]/10 rounded-full flex items-center justify-center text-[var(--state-success)]">
                            <CheckCircle2 size={40} />
                        </div>
                        <div className="space-y-3">
                            <h2 className={`${T.sectionTitle} ${S.headingMd}`}>¡Cuenta Confirmada!</h2>
                            <p className={`${T.sectionSubtitle} ${S.body}`}>
                                Tu solicitud ha sido confirmada con éxito. Nuestro equipo de gestión procederá ahora con la eliminación/anonimización definitiva de tus datos.
                            </p>
                        </div>
                        <button 
                            onClick={() => window.location.href = '/'}
                            className="w-full py-3 bg-[var(--brand-primary)] text-[var(--brand-primary-foreground)] rounded-xl font-bold transition-opacity hover:opacity-90 mt-4"
                        >
                            Volver al inicio
                        </button>
                    </div>
                ) : null}
            </div>
        </LegalLayout>
    );
};
