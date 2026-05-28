import React from 'react';
import { LegalLayout } from '../../layouts/LegalLayout';
import { T, S } from '@/lib/text-tokens';

export const TermsPage: React.FC = () => {
    return (
        <LegalLayout
            title="Términos y Condiciones"
            lastUpdate="27 de marzo de 2026"
            summary="Este documento rige el uso que haces de WABEE. Al registrarte, aceptas nuestras reglas de uso, especialmente en lo que respecta al envío de mensajes por WhatsApp y la gestión de datos de terceros."
        >
            <section className="space-y-6">
                <h2 className={`${T.sectionTitle} ${S.headingMd}`}>1. Introducción</h2>
                <p className={`${T.sectionSubtitle} ${S.body}`}>
                    Bienvenido a WABEE. Nuestra plataforma es un Marketplace/SaaS de marketing conversacional que permite a las organizaciones gestionar su comunicación a través de la API oficial de WhatsApp (WhatsApp Cloud API). Al utilizar nuestros servicios, usted acepta estos términos en su totalidad.
                </p>

                <h2 className={`${T.sectionTitle} ${S.headingMd}`}>2. Definiciones</h2>
                <ul className="list-disc pl-6 space-y-4">
                    <li className={`${T.sectionSubtitle} ${S.body}`}><strong className="text-[var(--brand-primary)]">WABEE:</strong> La plataforma SaaS, incluyendo su software, sitio web, APIs e infraestructura.</li>
                    <li className={`${T.sectionSubtitle} ${S.body}`}><strong className="text-[var(--brand-primary)]">Usuario:</strong> Cualquier individuo con acceso a la plataforma (Admin, Supervisor o Agente).</li>
                    <li className={`${T.sectionSubtitle} ${S.body}`}><strong className="text-[var(--brand-primary)]">Organización:</strong> La entidad legal o persona que contrata el servicio y posee los datos de su instancia (multi-tenant).</li>
                    <li className={`${T.sectionSubtitle} ${S.body}`}><strong className="text-[var(--brand-primary)]">Plataforma:</strong> El sistema de gestión que incluye inbox, contactos, campañas e IA.</li>
                </ul>

                <h2 className={`${T.sectionTitle} ${S.headingMd}`}>3. Uso del Servicio</h2>
                <p className={`${T.sectionSubtitle} ${S.body}`}>
                    WABEE proporciona herramientas para:
                </p>
                <ul className="list-disc pl-6 space-y-4">
                    <li className={`${T.sectionSubtitle} ${S.body}`}>Enviar y recibir mensajes principalmente a través de WhatsApp.</li>
                    <li className={`${T.sectionSubtitle} ${S.body}`}>Gestionar contactos y segmentar audiencias.</li>
                    <li className={`${T.sectionSubtitle} ${S.body}`}>Automatizar respuestas mediante perfiles de IA configurables.</li>
                    <li className={`${T.sectionSubtitle} ${S.body}`}>Ejecutar campañas masivas utilizando plantillas aprobadas por Meta.</li>
                </ul>

                <h2 className={`${T.sectionTitle} ${S.headingMd}`}>4. Registro y Cuentas</h2>
                <p className={`${T.sectionSubtitle} ${S.body}`}>
                    El registro requiere información veraz. La seguridad de la cuenta es responsabilidad del usuario. En el sistema multi-tenant de WABEE, el Administrador de la Organización es responsable de la gestión de roles (Supervisores y Agentes) y de las acciones realizadas por estos dentro de su instancia.
                </p>

                <h2 className={`${T.sectionTitle} ${S.headingMd}`}>5. Uso de WhatsApp y Terceros (Meta)</h2>
                <p className={`${T.sectionSubtitle} ${S.body}`}>
                    WABEE utiliza la infraestructura de WhatsApp Cloud API (Meta). El usuario debe poseer una cuenta de Meta Business válida y cumplir obligatoriamente con las <strong className="text-[var(--text-strong)]">Políticas Comerciales de WhatsApp</strong> y las <strong className="text-[var(--text-strong)]">Políticas de Solicitud de WhatsApp</strong>.
                </p>
                <div className="p-4 bg-[var(--state-warning)]/10 border border-[var(--state-warning)]/20 rounded-xl">
                    <p className={`${T.helperText} ${S.body} text-[var(--state-warning)]`}>
                        <strong>Aviso Crítico:</strong> El incumplimiento de las políticas de WhatsApp puede resultar en la suspensión inmediata tanto de su número de teléfono en WhatsApp como de su cuenta en WABEE sin derecho a reembolso.
                    </p>
                </div>

                <h2 className={`${T.sectionTitle} ${S.headingMd}`}>6. Responsabilidad del Usuario</h2>
                <p className={`${T.sectionSubtitle} ${S.body}`}>
                    Usted es el único responsable del contenido de sus mensajes y de la legitimidad de sus contactos. Queda estrictamente prohibido el envío de spam, contenido ilegal, fraudulento o acosador. WABEE no se hace responsable de las sanciones impuestas por Meta por el mal uso de su API.
                </p>

                <h2 className={`${T.sectionTitle} ${S.headingMd}`}>7. Planes, Facturación y Límites</h2>
                <p className={`${T.sectionSubtitle} ${S.body}`}>
                    El acceso a funciones específicas (como número de agentes, límites de contactos o acceso a la IA) depende del plan de suscripción activo. La falta de pago resultará en la suspensión del servicio. No se garantizan devoluciones por periodos ya facturados.
                </p>

                <h2 className={`${T.sectionTitle} ${S.headingMd}`}>8. Propiedad Intelectual</h2>
                <p className={`${T.sectionSubtitle} ${S.body}`}>
                    WABEE y sus logos son propiedad exclusiva de la plataforma. Los datos cargados por el usuario (contactos, historial de chats) pertenecen a la Organización, otorgando a WABEE una licencia limitada solo para procesarlos con el fin de prestar el servicio.
                </p>

                <h2 className={`${T.sectionTitle} ${S.headingMd}`}>9. Limitación de Responsabilidad</h2>
                <p className={`${T.sectionSubtitle} ${S.body}`}>
                    WABEE se proporciona "tal cual". No garantizamos disponibilidad absoluta (100% uptime) ni que la plataforma esté libre de errores. No somos responsables por daños indirectos, pérdida de datos o interrupciones causadas por fallos en los servicios de Meta o proveedores de infraestructura externos.
                </p>

                <h2 className={`${T.sectionTitle} ${S.headingMd}`}>10. Modificaciones y Terminación</h2>
                <p className={`${T.sectionSubtitle} ${S.body}`}>
                    Nos reservamos el derecho de modificar estos términos en cualquier momento. El uso continuado de la plataforma implica la aceptación de los nuevos términos. WABEE puede suspender o cancelar cuentas que violen estos términos o las políticas de uso aceptable.
                </p>
            </section>
        </LegalLayout>
    );
};
