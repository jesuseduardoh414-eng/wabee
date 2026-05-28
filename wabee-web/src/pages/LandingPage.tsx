import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowRight,
    Bot,
    Check,
    CheckCircle2,
    FileText,
    Globe,
    Inbox,
    LayoutTemplate,
    Layers,
    Lock,
    Menu,
    MessageCircle,
    MessagesSquare,
    PanelLeft,
    Phone,
    PlayCircle,
    Send,
    ShieldCheck,
    Sparkles,
    Tag,
    Users,
    UsersRound,
    X,
} from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';

const NAV_LINKS = [
    { label: 'Funcionalidades', href: '#features' },
    { label: 'Modulos', href: '#modules' },
    { label: 'Como funciona', href: '#how' },
];

const MODULES = [
    {
        icon: Inbox,
        title: 'Inbox Multi-Agente',
        desc: 'Gestiona todas las conversaciones de WhatsApp en un solo lugar. Asigna chats a agentes, filtra por estado y lleva notas internas por conversacion.',
    },
    {
        icon: Users,
        title: 'CRM de Contactos',
        desc: 'Centraliza tu base de contactos con ciclo de vida, etiquetas, segmentos dinamicos e importacion por CSV.',
    },
    {
        icon: Send,
        title: 'Campanas Masivas',
        desc: 'Envia campanas a traves de WhatsApp Cloud API. Programa envios y monitorea entrega, lectura y fallos en tiempo real.',
    },
    {
        icon: Bot,
        title: 'Perfiles IA y Copiloto',
        desc: 'Configura perfiles de IA que atienden chats automaticamente o actuan como copiloto. Pausa la IA y toma el control cuando lo necesites.',
    },
    {
        icon: Globe,
        title: 'Web Widgets',
        desc: 'Crea y personaliza widgets de conversacion para tu sitio web con el constructor integrado.',
    },
    {
        icon: FileText,
        title: 'Plantillas',
        desc: 'Administra plantillas de mensajes aprobadas por WhatsApp y reutilizalas en campanas o conversaciones.',
    },
    {
        icon: Layers,
        title: 'Grupos y Segmentos',
        desc: 'Organiza contactos en grupos manuales o crea segmentos dinamicos para filtrar audiencias de campanas.',
    },
    {
        icon: ShieldCheck,
        title: 'Auditoria y Equipo',
        desc: 'Revisa logs de auditoria, gestiona a tu equipo, define roles y controla el acceso por plan.',
    },
];

const BENEFITS = [
    {
        icon: MessageCircle,
        title: 'Todo en un Inbox',
        desc: 'Sin apps externas. Todos tus agentes gestionan chats desde la misma plataforma.',
    },
    {
        icon: Bot,
        title: 'IA con control humano',
        desc: 'La IA atiende de forma autonoma, pero cualquier agente puede pausarla y tomar el chat.',
    },
    {
        icon: Send,
        title: 'Metricas en tiempo real',
        desc: 'Las campanas se actualizan via SSE. Ves entregados, leidos y fallos mientras ocurren.',
    },
    {
        icon: Tag,
        title: 'Segmentacion real',
        desc: 'Crea segmentos dinamicos por ciclo de vida, etiquetas o grupos para cualquier campana.',
    },
    {
        icon: Phone,
        title: 'Multi-canal',
        desc: 'Conecta varios numeros de WhatsApp y cambia entre ellos desde el Inbox.',
    },
    {
        icon: Lock,
        title: 'Roles y auditoria',
        desc: 'Define permisos por rol y consulta logs de todas las acciones.',
    },
];

const HOW_STEPS = [
    {
        number: '01',
        title: 'Conecta tu numero de WhatsApp',
        desc: 'Vincula uno o varios numeros de WhatsApp Cloud API desde la configuracion de canales.',
    },
    {
        number: '02',
        title: 'Importa o crea tus contactos',
        desc: 'Sube un CSV o añade contactos manualmente. Asigna etiquetas y organizalos en grupos.',
    },
    {
        number: '03',
        title: 'Gestiona conversaciones y envia campanas',
        desc: 'Atiende desde el Inbox multi-agente, configura tu IA o lanza campanas masivas con plantillas aprobadas.',
    },
    {
        number: '04',
        title: 'Analiza resultados',
        desc: 'Consulta metricas de envio, entrega y lectura en tiempo real. Revisa el historial en auditoria.',
    },
];

const ENTERPRISE_POINTS = [
    'Inbox colaborativo para ventas, soporte y operaciones.',
    'Control por agente, estado, prioridad y carga operativa.',
    'Automatizacion, campanas y seguimiento dentro del mismo flujo.',
];

const HERO_METRICS = [
    { value: 'Multi-equipo', label: 'Operacion unificada para empresas' },
    { value: 'WhatsApp API', label: 'Base solida para ventas y soporte' },
    { value: 'Tiempo real', label: 'Visibilidad comercial y operativa' },
];

export const LandingPage = () => {
    const [menuOpen, setMenuOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 24);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const closeMenu = () => setMenuOpen(false);

    return (
        <div className="wabee-redesign min-h-screen text-[var(--text-strong)]">
            <div className="wabee-redesign__bg" />
            <div className="wabee-bee wabee-bee--one" aria-hidden="true">
                <span className="wabee-bee__wing wabee-bee__wing--left" />
                <span className="wabee-bee__wing wabee-bee__wing--right" />
                <span className="wabee-bee__body" />
            </div>
            <div className="wabee-bee wabee-bee--two" aria-hidden="true">
                <span className="wabee-bee__wing wabee-bee__wing--left" />
                <span className="wabee-bee__wing wabee-bee__wing--right" />
                <span className="wabee-bee__body" />
            </div>
            <div className="wabee-bee wabee-bee--three" aria-hidden="true">
                <span className="wabee-bee__wing wabee-bee__wing--left" />
                <span className="wabee-bee__wing wabee-bee__wing--right" />
                <span className="wabee-bee__body" />
            </div>
            <div className="wabee-bee wabee-bee--four" aria-hidden="true">
                <span className="wabee-bee__wing wabee-bee__wing--left" />
                <span className="wabee-bee__wing wabee-bee__wing--right" />
                <span className="wabee-bee__body" />
            </div>

            <div className={`wabee-nav-outer${scrolled ? ' wabee-nav-outer--scrolled' : ''}`}>
                <header className="wabee-shell">
                    <nav className={`wabee-nav${menuOpen ? ' wabee-nav--open' : ''}`}>
                        <Link to="/" className="wabee-brand" aria-label="Ir al inicio de Wabee" onClick={closeMenu}>
                            <BrandLogo variant="full" size={56} />
                        </Link>

                        <div className="wabee-nav__links">
                            {NAV_LINKS.map((item) => (
                                <a key={item.href} href={item.href} onClick={closeMenu}>
                                    {item.label}
                                </a>
                            ))}
                        </div>

                        <div className="wabee-nav__actions">
                            <Link to="/login" className="wabee-link-button" onClick={closeMenu}>
                                Iniciar sesion
                            </Link>
                            <Link to="/register" className="wabee-primary-button" onClick={closeMenu}>
                                Crear cuenta
                            </Link>
                        </div>

                        <button
                            className="wabee-nav__hamburger"
                            onClick={() => setMenuOpen((v) => !v)}
                            aria-label={menuOpen ? 'Cerrar menu' : 'Abrir menu'}
                            aria-expanded={menuOpen}
                        >
                            {menuOpen ? <X size={22} /> : <Menu size={22} />}
                        </button>
                    </nav>
                </header>
            </div>

            <main className="relative z-10">
                <section className="wabee-shell wabee-hero">
                    <div className="wabee-hero__copy">
                        <span className="wabee-kicker">
                            <Sparkles size={16} />
                            WhatsApp Cloud API - Multi-agente
                        </span>

                        <h1>
                            La plataforma para gestionar
                            <span>WhatsApp con tu equipo</span>
                        </h1>

                        <p>
                            Wabee centraliza conversaciones, contactos, automatizacion y campanas en una sola
                            plataforma. Pensado para empresas que necesitan una operacion comercial mas
                            ordenada, atencion colaborativa y una experiencia de software con presencia real
                            de marca.
                        </p>

                        <div className="wabee-hero__actions">
                            <Link to="/register" className="wabee-primary-button">
                                Crear cuenta gratis <ArrowRight size={18} />
                            </Link>
                            <Link to="/login" className="wabee-secondary-button">
                                Iniciar sesion
                            </Link>
                        </div>

                        <ul className="wabee-hero__checks">
                            {ENTERPRISE_POINTS.map((point) => (
                                <li key={point}><Check size={16} /> {point}</li>
                            ))}
                        </ul>

                        <div className="wabee-hero__microstats" aria-label="Resumen de valor de Wabee">
                            {HERO_METRICS.map((item) => (
                                <article key={item.value} className="wabee-hero__microstat">
                                    <strong>{item.value}</strong>
                                    <span>{item.label}</span>
                                </article>
                            ))}
                        </div>
                    </div>

                    <div className="wabee-hero__visual" id="preview">
                        <div className="wabee-showcase">
                            <div className="wabee-showcase__topbar">
                                <div className="wabee-showcase__dots">
                                    <span />
                                    <span />
                                    <span />
                                </div>
                                <div className="wabee-showcase__tag">Inbox preview</div>
                            </div>

                            <div className="wabee-showcase__body">
                                <div className="wabee-landing-mockup">
                                    <div className="wabee-landing-mockup__header">
                                        <span>Inbox</span>
                                        <div className="wabee-landing-mockup__filters">
                                            <span className="is-active">Todos</span>
                                            <span>IA</span>
                                            <span>Mios</span>
                                        </div>
                                    </div>

                                    <div className="wabee-landing-thread">
                                        <div className="wabee-landing-thread__avatar">M</div>
                                        <div className="wabee-landing-thread__copy">
                                            <strong>Maria Lopez</strong>
                                            <small>¿Cuando llega mi pedido?</small>
                                        </div>
                                        <div className="wabee-landing-thread__meta">
                                            <span className="wabee-landing-thread__badge wabee-landing-thread__badge--ia">IA</span>
                                            <span className="wabee-landing-thread__count">2</span>
                                        </div>
                                    </div>

                                    <div className="wabee-landing-thread wabee-landing-thread--highlight">
                                        <div className="wabee-landing-thread__avatar">C</div>
                                        <div className="wabee-landing-thread__copy">
                                            <strong>Carlos Ruiz</strong>
                                            <small>Perfecto, muchas gracias.</small>
                                        </div>
                                        <div className="wabee-landing-thread__meta">
                                            <span className="wabee-landing-thread__badge">Asignado</span>
                                        </div>
                                    </div>

                                    <div className="wabee-landing-thread wabee-landing-thread--soft">
                                        <div className="wabee-landing-thread__avatar">A</div>
                                        <div className="wabee-landing-thread__copy">
                                            <strong>Ana Torres</strong>
                                            <small>Necesito hablar con alguien</small>
                                        </div>
                                        <div className="wabee-landing-thread__meta">
                                            <span className="wabee-landing-thread__badge wabee-landing-thread__badge--pending">Pendiente</span>
                                            <span className="wabee-landing-thread__count">1</span>
                                        </div>
                                    </div>

                                    <div className="wabee-landing-mockup__footer">
                                        <div className="wabee-landing-mockup__status">
                                            <span className="wabee-landing-mockup__dot" />
                                            <small>3 agentes activos</small>
                                        </div>
                                        <strong>En vivo · SSE</strong>
                                    </div>
                                </div>

                                <div className="wabee-showcase-pulse wabee-showcase-pulse--amber" aria-hidden="true" />
                                <div className="wabee-showcase-pulse wabee-showcase-pulse--violet" aria-hidden="true" />
                            </div>
                        </div>
                    </div>
                </section>

                <section className="wabee-shell wabee-grid-section" id="features">
                    <div className="wabee-bee wabee-bee--five" aria-hidden="true">
                        <span className="wabee-bee__wing wabee-bee__wing--left" />
                        <span className="wabee-bee__wing wabee-bee__wing--right" />
                        <span className="wabee-bee__body" />
                    </div>
                    <div className="wabee-section-heading">
                        <span>Por que elegir Wabee</span>
                        <h2>Un software de operacion conversacional pensado para empresas y equipos reales</h2>
                    </div>

                    <div className="wabee-pillars wabee-pillars--wide">
                        {BENEFITS.map((item) => {
                            const Icon = item.icon;
                            return (
                                <article key={item.title} className="wabee-glass-card">
                                    <div className="wabee-icon-badge">
                                        <Icon size={20} />
                                    </div>
                                    <h3>{item.title}</h3>
                                    <p>{item.desc}</p>
                                </article>
                            );
                        })}
                    </div>
                </section>

                <section className="wabee-shell wabee-modules-section" id="modules">
                    <div className="wabee-bee wabee-bee--six" aria-hidden="true">
                        <span className="wabee-bee__wing wabee-bee__wing--left" />
                        <span className="wabee-bee__wing wabee-bee__wing--right" />
                        <span className="wabee-bee__body" />
                    </div>
                    <div className="wabee-section-heading">
                        <span>Lo que incluye la plataforma</span>
                        <h2>Modulos que ya estan disponibles dentro de Wabee</h2>
                    </div>

                    <div className="wabee-modules">
                        {MODULES.map((module) => {
                            const Icon = module.icon;
                            return (
                                <article key={module.title} className="wabee-module-card">
                                    <div className="wabee-module-card__icon">
                                        <Icon size={20} />
                                    </div>
                                    <h3>{module.title}</h3>
                                    <p>{module.desc}</p>
                                </article>
                            );
                        })}
                    </div>
                </section>

                <section className="wabee-shell wabee-preview-section wabee-preview-section--enterprise">
                    <div className="wabee-preview-copy">
                        <span>Enfoque SaaS</span>
                        <h2>Una interfaz que comunica control, claridad operativa y solidez de software.</h2>
                        <p>
                            Wabee no solo tiene que verse atractivo. Tiene que proyectar confianza para equipos
                            comerciales, operaciones, soporte y direccion. Por eso la nueva direccion visual usa
                            la paleta oficial, mas aire, mejor contraste y detalles de marca que refuerzan una
                            sensacion de plataforma premium.
                        </p>
                    </div>

                    <div className="wabee-preview-stack">
                        <article className="wabee-preview-card">
                            <span>Operaciones</span>
                            <h3>Prioridades visibles</h3>
                            <p>Las conversaciones, asignaciones y estados se leen mas rapido en equipos con alto volumen.</p>
                        </article>
                        <article className="wabee-preview-card">
                            <span>Ventas</span>
                            <h3>Producto con presencia</h3>
                            <p>La experiencia transmite una plataforma SaaS premium, no solo una herramienta tecnica.</p>
                        </article>
                        <article className="wabee-preview-card">
                            <span>Direccion</span>
                            <h3>Lectura ejecutiva</h3>
                            <p>El sitio y el producto dejan claro el valor de negocio desde el primer pantallazo.</p>
                        </article>
                    </div>
                </section>

                <section className="wabee-shell wabee-flow-section" id="how">
                    <div className="wabee-section-heading">
                        <span>Flujo real del producto</span>
                        <h2>Como se usa Wabee en una operacion real</h2>
                    </div>

                    <div className="wabee-flow">
                        {HOW_STEPS.map((step) => (
                            <article key={step.number}>
                                <span>{step.number}</span>
                                <p>{step.title}</p>
                                <small className="mt-3 block leading-7 text-[color:color-mix(in_srgb,var(--text-strong),transparent_32%)]">{step.desc}</small>
                            </article>
                        ))}
                    </div>
                </section>

                <section className="wabee-shell wabee-cta">
                    <div>
                        <span>Listo para comenzar</span>
                        <h2>Todo en un inbox. Conversaciones, contactos, campanas e IA en un solo lugar para tu empresa.</h2>
                    </div>

                    <div className="wabee-cta__actions">
                        <Link to="/register" className="wabee-primary-button">
                            Crear cuenta
                        </Link>
                        <Link to="/login" className="wabee-secondary-button">
                            Iniciar sesion
                        </Link>
                    </div>
                </section>

                <footer className="wabee-shell pb-12">
                    <div className="flex flex-col gap-4 border-t border-[var(--border-default)] pt-8 text-sm text-[color:color-mix(in_srgb,var(--text-strong),transparent_42%)] md:flex-row md:items-center md:justify-between">
                        <p>© 2026 WABEE. Todos los derechos reservados.</p>
                        <div className="flex flex-wrap gap-5">
                            <Link to="/legal/privacy">Privacidad</Link>
                            <Link to="/legal/terms">Terminos</Link>
                            <Link to="/legal/cookies">Cookies</Link>
                            <Link to="/data-deletion">Eliminar datos</Link>
                        </div>
                    </div>
                </footer>
            </main>
        </div>
    );
};
