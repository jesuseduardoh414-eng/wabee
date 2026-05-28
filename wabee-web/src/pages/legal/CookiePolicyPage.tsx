import React from 'react';
import { LegalLayout } from '../../layouts/LegalLayout';
import { T, S } from '@/lib/text-tokens';

export const CookiePolicyPage: React.FC = () => {
    return (
        <LegalLayout
            title="Política de Cookies"
            lastUpdate="27 de marzo de 2026"
            summary="WABEE utiliza cookies exclusivamente para que la plataforma funcione correctamente, mantener su sesión activa y recordar sus preferencias. No usamos cookies para publicidad invasiva de terceros."
        >
            <section className="space-y-6">
                <h2 className={`${T.sectionTitle} ${S.headingMd}`}>1. ¿Qué son las Cookies?</h2>
                <p className={`${T.sectionSubtitle} ${S.body}`}>
                    Las cookies son pequeños archivos de texto que se almacenan en su navegador cuando visita un sitio web. Ayudan a que la página funcione mejor y nos permiten recordar información sobre su visita.
                </p>

                <h2 className={`${T.sectionTitle} ${S.headingMd}`}>2. Tipos de Cookies en WABEE</h2>
                <div className="space-y-4">
                    <div className="p-4 bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl">
                        <p className={`${T.cardTitle} ${S.headingSm} mb-2`}><strong className="text-[var(--brand-primary)]">Cookies Esenciales (Obligatorias)</strong></p>
                        <p className={`${T.sectionSubtitle} ${S.body}`}>
                            Son necesarias para el funcionamiento básico de la plataforma. Sin ellas, no podría iniciar sesión, navegar de forma segura o utilizar funciones esenciales. Se utilizan para autenticación, gestión de sesiones y seguridad.
                        </p>
                    </div>

                    <div className="p-4 bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl">
                        <p className={`${T.cardTitle} ${S.headingSm} mb-2`}><strong className="text-[var(--brand-primary)]">Cookies Funcionales</strong></p>
                        <p className={`${T.sectionSubtitle} ${S.body}`}>
                            Permiten que la página recuerde información que cambia la forma en que se comporta o se ve el sitio, como su idioma preferido, su zona horaria o el tema visual (Claro/Oscuro) seleccionado.
                        </p>
                    </div>

                    <div className="p-4 bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl">
                        <p className={`${T.cardTitle} ${S.headingSm} mb-2`}><strong className="text-[var(--brand-primary)]">Cookies Analíticas (Opcionales)</strong></p>
                        <p className={`${T.sectionSubtitle} ${S.body}`}>
                            Nos ayudan a entender cómo los usuarios interactúan con la plataforma, qué secciones son más utilizadas y dónde podemos mejorar la experiencia. Esta información es anónima y agregada.
                        </p>
                    </div>
                </div>

                <h2 className={`${T.sectionTitle} ${S.headingMd}`}>3. No uso Publicitario</h2>
                <p className={`${T.sectionSubtitle} ${S.body}`}>
                    WABEE <strong>NO</strong> utiliza cookies de seguimiento publicitario ni entrega su perfil de navegación a redes de anuncios externas. Nuestra prioridad es la utilidad de la herramienta SaaS, no la comercialización de su comportamiento digital.
                </p>

                <h2 className={`${T.sectionTitle} ${S.headingMd}`}>4. Control de Cookies</h2>
                <p className={`${T.sectionSubtitle} ${S.body}`}>
                    Usted puede restringir o bloquear las cookies en cualquier momento a través de la configuración de su navegador. Tenga en cuenta que si desactiva las cookies esenciales, no podrá utilizar la plataforma WABEE de forma correcta.
                </p>

                <h2 className={`${T.sectionTitle} ${S.headingMd}`}>5. Proveedores de Terceros</h2>
                <p className={`${T.sectionSubtitle} ${S.body}`}>
                    Algunas cookies pueden ser establecidas por proveedores de infraestructura crítica (como el sistema de autenticación) solo para asegurar la integridad de la sesión.
                </p>
            </section>
        </LegalLayout>
    );
};
