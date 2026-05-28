import React from 'react';
import { LegalLayout } from '../../layouts/LegalLayout';
import { T, S } from '@/lib/text-tokens';

export const PrivacyPage: React.FC = () => {
    return (
        <LegalLayout
            title="Política de Privacidad"
            lastUpdate="27 de marzo de 2026"
            summary="WABEE garantiza la privacidad de sus datos. No vendemos información y mantenemos un aislamiento estricto por organización para asegurar que su comunicación sea segura y privada."
        >
            <section className="space-y-6">
                <h2 className={`${T.sectionTitle} ${S.headingMd}`}>1. Responsable del Tratamiento</h2>
                <p className={`${T.sectionSubtitle} ${S.body}`}>
                    WABEE es una plataforma operada por su equipo encargado. Somos responsables de procesar sus datos de cuenta y los datos que su Organización gestiona a través de nuestra infraestructura multi-tenant.
                </p>

                <h2 className={`${T.sectionTitle} ${S.headingMd}`}>2. Datos que Recolectamos</h2>
                <p className={`${T.sectionSubtitle} ${S.body}`}>
                    Para operar el servicio, recolectamos los siguientes tipos de datos:
                </p>
                <ul className="list-disc pl-6 space-y-4">
                    <li className={`${T.sectionSubtitle} ${S.body}`}><strong className="text-[var(--brand-primary)]">Datos de Cuenta:</strong> Nombre, correo electrónico, empresa y rol (Admin, Supervisor, Agente), necesarios para la gestión de usuarios y suscripción.</li>
                    <li className={`${T.sectionSubtitle} ${S.body}`}><strong className="text-[var(--brand-primary)]">Contactos:</strong> Información de clientes que su Organización carga o importa a través de archivos CSV o API.</li>
                    <li className={`${T.sectionSubtitle} ${S.body}`}><strong className="text-[var(--brand-primary)]">Conversaciones:</strong> Historial de mensajes enviados y recibidos a través de WhatsApp Cloud API, necesarios para el funcionamiento del Inbox multi-agente.</li>
                    <li className={`${T.sectionSubtitle} ${S.body}`}><strong className="text-[var(--brand-primary)]">Actividad del Sistema:</strong> Registros de auditoría de acciones realizadas dentro de la plataforma (logs), para fines de seguridad y control interno.</li>
                    <li className={`${T.sectionSubtitle} ${S.body}`}><strong className="text-[var(--brand-primary)]">Métricas:</strong> Datos sobre el rendimiento de campañas masivas (entrega, lectura, fallos).</li>
                </ul>

                <h2 className={`${T.sectionTitle} ${S.headingMd}`}>3. Finalidad del Tratamiento</h2>
                <p className={`${T.sectionSubtitle} ${S.body}`}>
                    Usamos sus datos únicamente para los siguientes propósitos:
                </p>
                <ul className="list-disc pl-6 space-y-4">
                    <li className={`${T.sectionSubtitle} ${S.body}`}>Prestar y mantener el servicio de mensajería y marketing conversacional.</li>
                    <li className={`${T.sectionSubtitle} ${S.body}`}>Automatizar respuestas a través de perfiles de IA configurables.</li>
                    <li className={`${T.sectionSubtitle} ${S.body}`}>Generar analíticas de uso y reportes de campañas masivas.</li>
                    <li className={`${T.sectionSubtitle} ${S.body}`}>Garantizar la seguridad mediante el monitoreo de auditoría de acciones.</li>
                    <li className={`${T.sectionSubtitle} ${S.body}`}>Facturación y gestión de planes de suscripción.</li>
                </ul>

                <h2 className={`${T.sectionTitle} ${S.headingMd}`}>4. Lo que WABEE NO hace</h2>
                <div className="p-6 bg-[var(--brand-primary)]/5 border border-[var(--brand-primary)]/20 rounded-2xl">
                    <p className={`${T.sectionSubtitle} ${S.body} text-[var(--text-strong)]`}>
                        <strong className="text-[var(--brand-primary)]">Compromiso de Privacidad:</strong> WABEE <strong className="text-[var(--brand-primary)]">NO</strong> vende sus datos a terceros ni comercializa su base de contactos. Tampoco utiliza el contenido de sus conversaciones para fines publicitarios fuera del contexto de su propia organización.
                    </p>
                </div>

                <h2 className={`${T.sectionTitle} ${S.headingMd}`}>5. Terceros y Transferencias</h2>
                <p className={`${T.sectionSubtitle} ${S.body}`}>
                    Sus datos se procesan a través de proveedores de infraestructura necesarios para el servicio:
                </p>
                <ul className="list-disc pl-6 space-y-4">
                    <li className={`${T.sectionSubtitle} ${S.body}`}><strong className="text-[var(--brand-primary)]">Meta (WhatsApp Cloud API):</strong> Para el envío y recepción de mensajes de WhatsApp.</li>
                    <li className={`${T.sectionSubtitle} ${S.body}`}><strong className="text-[var(--brand-primary)]">Servicios de Almacenamiento:</strong> Infraestructura en la nube donde se alojan las bases de datos de forma segura.</li>
                    <li className={`${T.sectionSubtitle} ${S.body}`}><strong className="text-[var(--brand-primary)]">Proveedores de Correo:</strong> Para notificaciones del sistema y gestión de contraseñas.</li>
                </ul>

                <h2 className={`${T.sectionTitle} ${S.headingMd}`}>6. Seguridad y Aislamiento</h2>
                <p className={`${T.sectionSubtitle} ${S.body}`}>
                    WABEE utiliza una arquitectura multi-tenant donde cada Organización tiene sus propios datos aislados lógicamente. Aplicamos controles de acceso basados en roles y mantenemos un sistema de auditoría exhaustivo que permite rastrear cualquier acción dentro de la plataforma. La comunicación entre su navegador y nuestra plataforma está cifrada mediante protocolos estándar (SSL/TLS).
                </p>

                <h2 className={`${T.sectionTitle} ${S.headingMd}`}>7. Derechos del Usuario</h2>
                <p className={`${T.sectionSubtitle} ${S.body}`}>
                    Usted tiene derecho a acceder, rectificar o eliminar sus datos personales. El Administrador de cada Organización puede gestionar el acceso y la eliminación de los datos de su instancia. Si desea ejercer sus derechos, puede contactar a nuestro equipo de soporte.
                </p>

                <h2 className={`${T.sectionTitle} ${S.headingMd}`}>8. Cambios en esta Política</h2>
                <p className={`${T.sectionSubtitle} ${S.body}`}>
                    Podemos actualizar esta política para reflejar cambios en nuestras prácticas o requerimientos legales. Le notificaremos cualquier actualización importante a través de la plataforma o por correo electrónico.
                </p>
            </section>
        </LegalLayout>
    );
};
