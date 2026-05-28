import React from 'react';
import { LegalLayout } from '../../layouts/LegalLayout';
import { T, S } from '@/lib/text-tokens';

export const AupPage: React.FC = () => {
    return (
        <LegalLayout
            title="Política de Uso Aceptable (AUP)"
            lastUpdate="27 de marzo de 2026"
            summary="WABEE prohíbe el uso de la plataforma para fines malintencionados, spam o cualquier actividad que viole las políticas de Meta. Tu cuenta depende del cumplimiento de estas reglas."
        >
            <section className="space-y-6">
                <h2 className={`${T.sectionTitle} ${S.headingMd}`}>1. Objetivo</h2>
                <p className={`${T.sectionSubtitle} ${S.body}`}>
                    Esta Política de Uso Aceptable (AUP) establece las normas de conducta para todos los usuarios de WABEE. Nuestro objetivo es proteger la reputación de nuestra plataforma y de los números de teléfono de nuestros clientes ante Meta/WhatsApp.
                </p>

                <h2 className={`${T.sectionTitle} ${S.headingMd}`}>2. Prohibiciones Estrictas</h2>
                <p className={`${T.sectionSubtitle} ${S.body}`}>
                    Queda terminantemente prohibido utilizar WABEE para:
                </p>
                <ul className="list-disc pl-6 space-y-4">
                    <li className={`${T.sectionSubtitle} ${S.body}`}><strong className="text-[var(--brand-primary)]">Spam Masivo:</strong> Enviar mensajes no solicitados a personas que no han otorgado su consentimiento explícito (Opt-in).</li>
                    <li className={`${T.sectionSubtitle} ${S.body}`}><strong className="text-[var(--brand-primary)]">Contenido Fraudulento:</strong> Suplantación de identidad (Phishing), estafas, o promoción de actividades ilegales.</li>
                    <li className={`${T.sectionSubtitle} ${S.body}`}><strong className="text-[var(--brand-primary)]">Acoso o Abuso:</strong> Utilizar el sistema para intimidar, difamar o amenazar a individuos.</li>
                    <li className={`${T.sectionSubtitle} ${S.body}`}><strong className="text-[var(--brand-primary)]">Material Sensible:</strong> Distribución de contenido sexual explícito, violento u odioso.</li>
                    <li className={`${T.sectionSubtitle} ${S.body}`}><strong className="text-[var(--brand-primary)]">Violación de API:</strong> Intentar evadir las protecciones técnicas de WhatsApp o abusar de la infraestructura de WABEE.</li>
                </ul>

                <h2 className={`${T.sectionTitle} ${S.headingMd}`}>3. Cumplimiento con Meta</h2>
                <p className={`${T.sectionSubtitle} ${S.body}`}>
                    Al usar WABEE, usted acepta cumplir con todas las políticas de Meta, incluyendo las Políticas de WhatsApp Business. Cualquier acción que resulte en el bloqueo de su número por parte de Meta será considerada una violación de esta AUP.
                </p>

                <h2 className={`${T.sectionTitle} ${S.headingMd}`}>4. Monitoreo y Auditoría</h2>
                <p className={`${T.sectionSubtitle} ${S.body}`}>
                    WABEE mantiene registros de auditoría de todas las acciones realizadas en la plataforma. Nos reservamos el derecho de investigar cualquier actividad sospechosa que pueda poner en riesgo la estabilidad del sistema o la reputación de nuestros canales oficiales.
                </p>

                <h2 className={`${T.sectionTitle} ${S.headingMd}`}>5. Consecuencias del Incumplimiento</h2>
                <div className="p-5 bg-red-500/10 border border-red-500/20 rounded-2xl">
                    <p className={`${T.cardTitle} ${S.headingSm} text-red-400 mb-3`}><strong>Acciones Correctivas</strong></p>
                    <p className={`${T.helperText} ${S.body} text-[var(--text-muted)]`}>
                        Si WABEE detecta una violación a esta política, podrá tomar las siguientes medidas sin previo aviso:
                    </p>
                    <ul className="list-disc pl-6 mt-4 space-y-2 text-red-300">
                        <li className={`${T.sectionSubtitle} ${S.body}`}>Advertencia formal y solicitud de corrección.</li>
                        <li className={`${T.sectionSubtitle} ${S.body}`}>Limitación temporal o permanente de funciones (ej. bloqueo de campañas).</li>
                        <li className={`${T.sectionSubtitle} ${S.body}`}>Suspensión inmediata de la cuenta de la Organización.</li>
                        <li className={`${T.sectionSubtitle} ${S.body}`}>Terminación definitiva del servicio sin derecho a reembolso.</li>
                    </ul>
                </div>

                <h2 className={`${T.sectionTitle} ${S.headingMd}`}>6. Denuncias</h2>
                <p className={`${T.sectionSubtitle} ${S.body}`}>
                    Si usted es testigo de un uso inapropiado de nuestra plataforma por parte de cualquier organización, le solicitamos que lo reporte a nuestro equipo de integridad y seguridad.
                </p>
            </section>
        </LegalLayout>
    );
};
