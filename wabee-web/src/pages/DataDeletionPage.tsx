import React, { useState } from 'react';
import { LegalLayout } from '../layouts/LegalLayout';
import { T, S } from '@/lib/text-tokens';
import client from '@/api/client';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export const DataDeletionPage: React.FC = () => {
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        phone: '',
        description: ''
    });
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            await client.post('/public/data-deletion', formData);
            setSubmitted(true);
        } catch (err: any) {
            console.error('Error submitting data deletion request:', err);
            setError(err.response?.data?.message || 'Hubo un error al procesar tu solicitud. Por favor, intenta de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    if (submitted) {
        return (
            <LegalLayout
                title="Solicitud Recibida"
                lastUpdate={new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                summary="Tu solicitud de eliminación de datos ha sido registrada exitosamente."
            >
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-6">
                    <div className="w-16 h-16 bg-[var(--state-success)]/10 rounded-full flex items-center justify-center text-[var(--state-success)]">
                        <CheckCircle2 size={40} />
                    </div>
                    <div className="max-w-md space-y-2">
                        <h2 className={`${T.sectionTitle} ${S.headingMd}`}>¡Gracias!</h2>
                        <p className={`${T.sectionSubtitle} ${S.body}`}>
                            Nuestro equipo administrativo revisará tu solicitud y procederá con la anonimización de tus datos personales en nuestro sistema. Recibirás una notificación una vez que el proceso se haya completado.
                        </p>
                    </div>
                    <button 
                        onClick={() => window.location.href = '/'}
                        className="px-6 py-2 bg-[var(--brand-primary)] text-[var(--brand-primary-foreground)] rounded-lg font-medium transition-opacity hover:opacity-90"
                    >
                        Volver al inicio
                    </button>
                </div>
            </LegalLayout>
        );
    }

    return (
        <LegalLayout
            title="Eliminación de Datos"
            lastUpdate="27 de marzo de 2026"
            summary="En cumplimiento con las normativas de privacidad de Meta y leyes de protección de datos, proporcionamos este formulario para que solicites la eliminación o anonimización de tu información personal en nuestra plataforma."
        >
            <section className="space-y-8">
                <div className="space-y-4">
                    <h2 className={`${T.sectionTitle} ${S.headingMd}`}>¿Cómo funciona el proceso?</h2>
                    <p className={`${T.sectionSubtitle} ${S.body}`}>
                        Al enviar esta solicitud, nuestro equipo de Super Administradores buscará cualquier registro asociado a tu correo electrónico o número de teléfono dentro de nuestra base de datos de contactos.
                    </p>
                    <p className={`${T.sectionSubtitle} ${S.body}`}>
                        Una vez verificada, procederemos a la <strong className="text-[var(--text-strong)]">anonimización irreversible</strong> de tu nombre, email y teléfono. Se conservará el historial de mensajes por motivos de integridad del sistema, pero ya no estarán vinculados a tu identidad.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-2xl p-6 lg:p-8 space-y-6 shadow-sm">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label htmlFor="fullName" className={`${T.labelText} ${S.meta} ui-label opacity-70`}>Nombre Completo *</label>
                            <input 
                                type="text" 
                                id="fullName"
                                name="fullName"
                                required
                                value={formData.fullName}
                                onChange={handleChange}
                                placeholder="Ej. Juan Pérez"
                                className="ui-input"
                            />
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="email" className={`${T.labelText} ${S.meta} ui-label opacity-70`}>Correo Electrónico *</label>
                            <input 
                                type="email" 
                                id="email"
                                name="email"
                                required
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="tu@email.com"
                                className="ui-input"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="phone" className={`${T.labelText} ${S.meta} ui-label opacity-70`}>Teléfono *</label>
                        <input 
                            type="tel" 
                            id="phone"
                            name="phone"
                            required
                            value={formData.phone}
                            onChange={handleChange}
                            placeholder="+52 1 234 567 8901"
                            className="ui-input"
                        />
                        <p className={`${T.helperText} ${S.meta} opacity-60 px-1 mt-1`}>Incluye el código de país para una búsqueda más precisa.</p>
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="description" className={`${T.labelText} ${S.meta} ui-label opacity-70`}>Motivo o descripción adicional (opcional)</label>
                        <textarea 
                            id="description"
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            rows={3}
                            placeholder="Cuéntanos brevemente por qué solicitas la eliminación..."
                            className="ui-textarea"
                        />
                    </div>

                    {error && (
                        <div className="p-4 bg-[var(--state-danger)]/10 border border-[var(--state-danger)]/20 rounded-xl flex items-start gap-3 text-[var(--state-danger)]">
                            <AlertCircle className="shrink-0 mt-0.5" size={18} />
                            <p className={`${T.messageText} ${S.body} font-medium`}>{error}</p>
                        </div>
                    )}

                    <div className="pt-4">
                        <button 
                            type="submit"
                            disabled={loading}
                            className="w-full md:w-auto px-12 py-3 bg-[var(--brand-primary)] text-[var(--brand-primary-foreground)] rounded-xl font-bold uppercase tracking-widest transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="animate-spin" size={20} />
                                    Enviando...
                                </>
                            ) : (
                                'Enviar Solicitud'
                            )}
                        </button>
                    </div>

                    <p className={`${T.helperText} ${S.meta} text-center md:text-left opacity-40`}>
                        * Al hacer clic en enviar, confirmas que eres el titular de estos datos o tienes autorización para solicitar su eliminación.
                    </p>
                </form>
            </section>
        </LegalLayout>
    );
};
