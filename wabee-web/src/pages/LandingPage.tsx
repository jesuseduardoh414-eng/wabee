import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, type Variants } from 'framer-motion';
import client from '../api/client';
import {
    ArrowRight,
    Bot,
    Check,
    CheckCircle2,
    Crown,
    FileText,
    Globe,
    Inbox,
    Layers,
    Lock,
    Menu,
    MessageCircle,
    Phone,
    Send,
    ShieldCheck,
    Sparkles,
    Tag,
    Users,
    X,
} from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';

const NAV_LINKS = [
    { label: 'Funcionalidades', href: '#features' },
    { label: 'Modulos', href: '#modules' },
    { label: 'Planes', href: '#plans' },
    { label: 'Como funciona', href: '#how' },
];

type PublicPlan = {
    id: string;
    code: string;
    name: string;
    description: string;
    monthlyPrice: number;
    annualPrice: number;
    currency: string;
    limits: {
        channels: number;
        contacts: number;
        aiTokensPerMonth: number;
        storageMb: number;
        users: number;
    };
    flags: Record<string, boolean>;
};

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
        desc: 'Sube un CSV o anade contactos manualmente. Asigna etiquetas y organizalos en grupos.',
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

const PLAN_FLAG_LABELS: Record<string, string> = {
    inbox: 'Inbox',
    contacts: 'Contactos',
    templatesHub: 'Plantillas',
    channels: 'Canales',
    campaigns: 'Campanas',
    aiProfiles: 'IA',
    team: 'Equipo',
    integrationsTools: 'Integraciones',
    groups: 'Grupos',
    segments: 'Segmentos',
    audit: 'Auditoria',
    webWidgets: 'Widgets',
};

const SECTION_VIEWPORT = { once: true, amount: 0.2 } as const;
const MOTION_EASE = [0.16, 1, 0.3, 1] as const;

const sectionVariants: Variants = {
    hidden: { opacity: 0, y: 40 },
    show: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.6,
            ease: MOTION_EASE,
            when: 'beforeChildren',
            staggerChildren: 0.12,
        },
    },
};

const titleVariants: Variants = {
    hidden: { opacity: 0, y: 40 },
    show: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.6, ease: MOTION_EASE },
    },
};

const revealVariants: Variants = {
    hidden: { opacity: 0, y: 40 },
    show: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.6, ease: MOTION_EASE },
    },
};

const cardVariants: Variants = {
    hidden: (index: number = 0) => ({
        opacity: 0,
        x: index % 2 === 0 ? -40 : 40,
    }),
    show: {
        opacity: 1,
        x: 0,
        transition: { duration: 0.6, ease: MOTION_EASE },
    },
};

export const LandingPage = () => {
    const [menuOpen, setMenuOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [plans, setPlans] = useState<PublicPlan[]>([]);
    const [plansLoading, setPlansLoading] = useState(true);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 24);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    useEffect(() => {
        let active = true;

        const loadPlans = async () => {
            try {
                const { data } = await client.get('/billing/public-plans');
                if (active) setPlans(data.plans || []);
            } catch (error) {
                console.error('[landing] No se pudieron cargar los planes publicos', error);
            } finally {
                if (active) setPlansLoading(false);
            }
        };

        loadPlans();

        return () => {
            active = false;
        };
    }, []);

    const closeMenu = () => setMenuOpen(false);
    const formatPrice = (value: number, currency: string) => new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
    }).format(value);
    const highlightedPlanId = plans.length > 1
        ? [...plans].sort((a, b) => b.monthlyPrice - a.monthlyPrice)[0]?.id
        : plans[0]?.id;

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
                <motion.section
                    className="wabee-shell wabee-hero"
                    variants={sectionVariants}
                    initial="hidden"
                    whileInView="show"
                    viewport={SECTION_VIEWPORT}
                >
                    <motion.div className="wabee-hero__copy" variants={revealVariants}>
                        <motion.span className="wabee-kicker" variants={titleVariants}>
                            <Sparkles size={16} />
                            WhatsApp Cloud API - Multi-agente
                        </motion.span>

                        <motion.h1 variants={titleVariants}>
                            La plataforma para gestionar
                            <span>WhatsApp con tu equipo</span>
                        </motion.h1>

                        <motion.p variants={titleVariants}>
                            Wabee centraliza conversaciones, contactos, automatizacion y campanas en una sola
                            plataforma. Pensado para empresas que necesitan una operacion comercial mas
                            ordenada, atencion colaborativa y una experiencia de software con presencia real
                            de marca.
                        </motion.p>

                        <motion.div className="wabee-hero__actions" variants={titleVariants}>
                            <Link to="/register" className="wabee-primary-button">
                                Crear cuenta gratis <ArrowRight size={18} />
                            </Link>
                            <Link to="/login" className="wabee-secondary-button">
                                Iniciar sesion
                            </Link>
                        </motion.div>

                        <motion.ul className="wabee-hero__checks" variants={sectionVariants}>
                            {ENTERPRISE_POINTS.map((point, index) => (
                                <motion.li key={point} custom={index} variants={cardVariants}>
                                    <Check size={16} /> {point}
                                </motion.li>
                            ))}
                        </motion.ul>

                        <motion.div className="wabee-hero__microstats" aria-label="Resumen de valor de Wabee" variants={sectionVariants}>
                            {HERO_METRICS.map((item, index) => (
                                <motion.article key={item.value} className="wabee-hero__microstat" custom={index} variants={cardVariants}>
                                    <strong>{item.value}</strong>
                                    <span>{item.label}</span>
                                </motion.article>
                            ))}
                        </motion.div>
                    </motion.div>

                    <motion.div className="wabee-hero__visual" id="preview" variants={revealVariants}>
                        <motion.div className="wabee-showcase" variants={revealVariants}>
                            <div className="wabee-showcase__topbar">
                                <div className="wabee-showcase__dots">
                                    <span />
                                    <span />
                                    <span />
                                </div>
                                <div className="wabee-showcase__tag">Inbox preview</div>
                            </div>

                            <div className="wabee-showcase__body">
                                <div className="wabee-inbox-mock">
                                    {/* Sidebar */}
                                    <div className="wabee-inbox-mock__sidebar">
                                        <div className="wabee-inbox-mock__search">
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                                            <span>Buscar conversaciones...</span>
                                        </div>
                                        <div className="wabee-inbox-mock__tabs">
                                            <span className="is-active">Todos <em>4</em></span>
                                            <span>IA activa <em>3</em></span>
                                            <span>Para mi</span>
                                        </div>
                                        <div className="wabee-inbox-mock__thread is-selected">
                                            <div className="wabee-inbox-mock__avatar">S</div>
                                            <div className="wabee-inbox-mock__thread-copy">
                                                <strong>Sofia Mendez</strong>
                                                <small>Claro, tu plan incluye hasta 5 agentes...</small>
                                            </div>
                                            <div className="wabee-inbox-mock__thread-right">
                                                <span className="wabee-inbox-mock__time">Ahora</span>
                                                <span className="wabee-inbox-mock__unread">2</span>
                                                <span className="wabee-inbox-mock__ia-badge">IA</span>
                                            </div>
                                        </div>
                                        <div className="wabee-inbox-mock__thread">
                                            <div className="wabee-inbox-mock__avatar wabee-inbox-mock__avatar--muted">R</div>
                                            <div className="wabee-inbox-mock__thread-copy">
                                                <strong>Ricardo Vega</strong>
                                                <small>Cuantos contactos puedo importar?</small>
                                            </div>
                                            <div className="wabee-inbox-mock__thread-right">
                                                <span className="wabee-inbox-mock__time">10:42</span>
                                                <span className="wabee-inbox-mock__unread">1</span>
                                                <span className="wabee-inbox-mock__ia-badge">IA</span>
                                            </div>
                                        </div>
                                        <div className="wabee-inbox-mock__thread">
                                            <div className="wabee-inbox-mock__avatar wabee-inbox-mock__avatar--muted">L</div>
                                            <div className="wabee-inbox-mock__thread-copy">
                                                <strong>Laura Paredes</strong>
                                                <small>Perfecto, ya conecte mi numero 🙌</small>
                                            </div>
                                            <div className="wabee-inbox-mock__thread-right">
                                                <span className="wabee-inbox-mock__time">09:15</span>
                                                <span className="wabee-inbox-mock__ia-badge">IA</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Chat panel */}
                                    <div className="wabee-inbox-mock__chat">
                                        <div className="wabee-inbox-mock__chat-header">
                                            <div className="wabee-inbox-mock__avatar">S</div>
                                            <div className="wabee-inbox-mock__chat-info">
                                                <strong>Sofia Mendez</strong>
                                                <span><span className="wabee-inbox-mock__online-dot" />En línea</span>
                                            </div>
                                            <div className="wabee-inbox-mock__chat-actions">
                                                <span>Contacto</span>
                                                <span>Notas</span>
                                            </div>
                                        </div>
                                        <div className="wabee-inbox-mock__messages">
                                            <div className="wabee-inbox-mock__bubble wabee-inbox-mock__bubble--in">
                                                Hola, cuantos agentes puedo agregar a mi equipo?
                                            </div>
                                            <div className="wabee-inbox-mock__bubble wabee-inbox-mock__bubble--out">
                                                Hola Sofia! 👋 Tu plan incluye hasta 5 agentes.<br />
                                                <br />
                                                Puedes asignar chats, filtrar por agente y ver quien esta activo en tiempo real desde el Inbox.
                                            </div>
                                        </div>
                                        <div className="wabee-inbox-mock__input">
                                            <span>Toma el chat para poder responder</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="wabee-showcase-pulse wabee-showcase-pulse--amber" aria-hidden="true" />
                                <div className="wabee-showcase-pulse wabee-showcase-pulse--violet" aria-hidden="true" />
                            </div>
                        </motion.div>
                    </motion.div>
                </motion.section>

                <motion.section
                    className="wabee-shell wabee-grid-section"
                    id="features"
                    variants={sectionVariants}
                    initial="hidden"
                    whileInView="show"
                    viewport={SECTION_VIEWPORT}
                >
                    <div className="wabee-bee wabee-bee--five" aria-hidden="true">
                        <span className="wabee-bee__wing wabee-bee__wing--left" />
                        <span className="wabee-bee__wing wabee-bee__wing--right" />
                        <span className="wabee-bee__body" />
                    </div>
                    <motion.div className="wabee-section-heading" variants={titleVariants}>
                        <motion.span variants={titleVariants}>Por que elegir Wabee</motion.span>
                        <motion.h2 variants={titleVariants}>Un software de operacion conversacional pensado para empresas y equipos reales</motion.h2>
                    </motion.div>

                    <motion.div className="wabee-pillars wabee-pillars--wide" variants={sectionVariants}>
                        {BENEFITS.map((item, index) => {
                            const Icon = item.icon;
                            return (
                                <motion.article key={item.title} className="wabee-glass-card" custom={index} variants={cardVariants}>
                                    <div className="wabee-icon-badge">
                                        <Icon size={20} />
                                    </div>
                                    <h3>{item.title}</h3>
                                    <p>{item.desc}</p>
                                </motion.article>
                            );
                        })}
                    </motion.div>
                </motion.section>

                <motion.section
                    className="wabee-shell wabee-modules-section"
                    id="modules"
                    variants={sectionVariants}
                    initial="hidden"
                    whileInView="show"
                    viewport={SECTION_VIEWPORT}
                >
                    <div className="wabee-bee wabee-bee--six" aria-hidden="true">
                        <span className="wabee-bee__wing wabee-bee__wing--left" />
                        <span className="wabee-bee__wing wabee-bee__wing--right" />
                        <span className="wabee-bee__body" />
                    </div>
                    <motion.div className="wabee-section-heading" variants={titleVariants}>
                        <motion.span variants={titleVariants}>Lo que incluye la plataforma</motion.span>
                        <motion.h2 variants={titleVariants}>Modulos que ya estan disponibles dentro de Wabee</motion.h2>
                    </motion.div>

                    <motion.div className="wabee-modules" variants={sectionVariants}>
                        {MODULES.map((module, index) => {
                            const Icon = module.icon;
                            return (
                                <motion.article key={module.title} className="wabee-module-card" custom={index} variants={cardVariants}>
                                    <div className="wabee-module-card__icon">
                                        <Icon size={20} />
                                    </div>
                                    <h3>{module.title}</h3>
                                    <p>{module.desc}</p>
                                </motion.article>
                            );
                        })}
                    </motion.div>
                </motion.section>

                <motion.section
                    className="wabee-shell wabee-preview-section wabee-preview-section--enterprise"
                    variants={sectionVariants}
                    initial="hidden"
                    whileInView="show"
                    viewport={SECTION_VIEWPORT}
                >
                    <motion.div className="wabee-preview-copy" variants={revealVariants}>
                        <motion.span variants={titleVariants}>Enfoque SaaS</motion.span>
                        <motion.h2 variants={titleVariants}>Una interfaz que comunica control, claridad operativa y solidez de software.</motion.h2>
                        <motion.p variants={titleVariants}>
                            Wabee no solo tiene que verse atractivo. Tiene que proyectar confianza para equipos
                            comerciales, operaciones, soporte y direccion. Por eso la nueva direccion visual usa
                            la paleta oficial, mas aire, mejor contraste y detalles de marca que refuerzan una
                            sensacion de plataforma premium.
                        </motion.p>
                    </motion.div>

                    <motion.div className="wabee-preview-stack" variants={sectionVariants}>
                        <motion.article className="wabee-preview-card" custom={0} variants={cardVariants}>
                            <span>Operaciones</span>
                            <h3>Prioridades visibles</h3>
                            <p>Las conversaciones, asignaciones y estados se leen mas rapido en equipos con alto volumen.</p>
                        </motion.article>
                        <motion.article className="wabee-preview-card" custom={1} variants={cardVariants}>
                            <span>Ventas</span>
                            <h3>Producto con presencia</h3>
                            <p>La experiencia transmite una plataforma SaaS premium, no solo una herramienta tecnica.</p>
                        </motion.article>
                        <motion.article className="wabee-preview-card" custom={2} variants={cardVariants}>
                            <span>Direccion</span>
                            <h3>Lectura ejecutiva</h3>
                            <p>El sitio y el producto dejan claro el valor de negocio desde el primer pantallazo.</p>
                        </motion.article>
                    </motion.div>
                </motion.section>

                <motion.section
                    className="wabee-shell wabee-modules-section"
                    id="plans"
                    variants={sectionVariants}
                    initial="hidden"
                    whileInView="show"
                    viewport={SECTION_VIEWPORT}
                >
                    <motion.div className="wabee-section-heading" variants={titleVariants}>
                        <motion.span variants={titleVariants}>Planes de Wabee</motion.span>
                        <motion.h2 variants={titleVariants}>Capas de crecimiento para equipos que venden, responden y operan por WhatsApp</motion.h2>
                        <motion.p className="wabee-pricing-intro" variants={titleVariants}>
                            Disenamos los planes como una evolucion natural del panal: empiezas con una base clara,
                            sumas capacidad real y mantienes el control de conversaciones, automatizacion e IA
                            dentro de la misma plataforma.
                        </motion.p>
                    </motion.div>

                    <motion.div className="wabee-pricing-hero" variants={sectionVariants}>
                        <motion.div className="wabee-pricing-hero__copy" variants={revealVariants}>
                            <motion.div className="wabee-kicker" variants={titleVariants}>
                                <Sparkles size={16} />
                                Estructura comercial Wabee
                            </motion.div>
                            <motion.h3 variants={titleVariants}>De un equipo compacto a una operacion con mas volumen, sin salir del ecosistema Wabee.</motion.h3>
                            <motion.p variants={titleVariants}>
                                Cada plan combina usuarios, canales, contactos y capacidad de IA con una experiencia
                                visual alineada a la marca: clara, conversacional y lista para escalar.
                            </motion.p>
                        </motion.div>

                        <motion.div className="wabee-pricing-hive" aria-hidden="true" variants={sectionVariants}>
                            <motion.div className="wabee-pricing-hive__cell wabee-pricing-hive__cell--primary" custom={0} variants={cardVariants}>
                                <strong>Inbox</strong>
                                <span>Coordinacion central</span>
                            </motion.div>
                            <motion.div className="wabee-pricing-hive__cell" custom={1} variants={cardVariants}>
                                <strong>IA</strong>
                                <span>Asistencia operativa</span>
                            </motion.div>
                            <motion.div className="wabee-pricing-hive__cell" custom={2} variants={cardVariants}>
                                <strong>CRM</strong>
                                <span>Contactos y segmentos</span>
                            </motion.div>
                            <motion.div className="wabee-pricing-hive__cell" custom={3} variants={cardVariants}>
                                <strong>API</strong>
                                <span>WhatsApp Cloud</span>
                            </motion.div>
                        </motion.div>
                    </motion.div>

                    <motion.div className="wabee-pricing-grid" variants={sectionVariants}>
                        {plansLoading ? (
                            <motion.article className="wabee-pricing-card" variants={revealVariants}>
                                <h3>Cargando planes...</h3>
                                <p>Estamos obteniendo la informacion comercial disponible.</p>
                            </motion.article>
                        ) : plans.length === 0 ? (
                            <motion.article className="wabee-pricing-card" variants={revealVariants}>
                                <h3>Planes no disponibles</h3>
                                <p>Por ahora no hay planes publicos configurados. Puedes solicitar una demo o contactarnos para una propuesta.</p>
                            </motion.article>
                        ) : plans.map((plan, index) => (
                            <motion.article
                                key={plan.id}
                                custom={index}
                                variants={cardVariants}
                                className={`wabee-pricing-card${plan.id === highlightedPlanId ? ' wabee-pricing-card--featured' : ''}`}
                            >
                                <div className="wabee-pricing-card__glow" aria-hidden="true" />

                                <div className="wabee-pricing-card__header">
                                    <div>
                                        <div className="wabee-pricing-card__eyebrow">
                                            <span>{plan.code.replaceAll('_', ' ')}</span>
                                            {plan.id === highlightedPlanId ? (
                                                <span className="wabee-pricing-card__badge">
                                                    <Crown size={14} />
                                                    Recomendado
                                                </span>
                                            ) : null}
                                        </div>
                                        <h3>{plan.name}</h3>
                                        <p>{plan.description}</p>
                                    </div>
                                </div>

                                <div className="wabee-pricing-card__price">
                                    <strong className="block text-3xl font-semibold text-[var(--text-strong)]">
                                        {formatPrice(plan.monthlyPrice, plan.currency)}
                                    </strong>
                                    <span className="text-sm text-[color:color-mix(in_srgb,var(--text-strong),transparent_42%)]">
                                        mensual o {formatPrice(plan.annualPrice, plan.currency)} anual
                                    </span>
                                </div>

                                <div className="wabee-pricing-card__stats">
                                    <div>
                                        <span>Usuarios</span>
                                        <strong>{plan.limits.users}</strong>
                                    </div>
                                    <div>
                                        <span>Canales</span>
                                        <strong>{plan.limits.channels}</strong>
                                    </div>
                                    <div>
                                        <span>Contactos</span>
                                        <strong>{plan.limits.contacts.toLocaleString('es-MX')}</strong>
                                    </div>
                                </div>

                                <ul className="wabee-pricing-card__list">
                                    <li className="flex items-center gap-2"><CheckCircle2 size={16} /> {plan.limits.users} usuarios operativos</li>
                                    <li className="flex items-center gap-2"><CheckCircle2 size={16} /> {plan.limits.contacts.toLocaleString('es-MX')} contactos centralizados</li>
                                    <li className="flex items-center gap-2"><CheckCircle2 size={16} /> {plan.limits.channels} canales de WhatsApp</li>
                                    <li className="flex items-center gap-2"><CheckCircle2 size={16} /> {plan.limits.aiTokensPerMonth.toLocaleString('es-MX')} tokens IA por mes</li>
                                    <li className="flex items-center gap-2"><CheckCircle2 size={16} /> {plan.limits.storageMb.toLocaleString('es-MX')} MB de almacenamiento</li>
                                </ul>

                                <div className="wabee-pricing-card__chips">
                                    {Object.entries(plan.flags || {})
                                        .filter(([, enabled]) => Boolean(enabled))
                                        .slice(0, 5)
                                        .map(([key]) => (
                                            <span key={key}>
                                                {PLAN_FLAG_LABELS[key] || key}
                                            </span>
                                        ))}
                                </div>

                                <div className="wabee-pricing-card__footer">
                                    <Link to="/register" className={plan.id === highlightedPlanId ? 'wabee-primary-button' : 'wabee-secondary-button'}>
                                        Crear cuenta <ArrowRight size={16} />
                                    </Link>
                                </div>
                            </motion.article>
                        ))}
                    </motion.div>
                </motion.section>

                <motion.section
                    className="wabee-shell wabee-flow-section"
                    id="how"
                    variants={sectionVariants}
                    initial="hidden"
                    whileInView="show"
                    viewport={SECTION_VIEWPORT}
                >
                    <motion.div className="wabee-section-heading" variants={titleVariants}>
                        <motion.span variants={titleVariants}>Flujo real del producto</motion.span>
                        <motion.h2 variants={titleVariants}>Como se usa Wabee en una operacion real</motion.h2>
                    </motion.div>

                    <motion.div className="wabee-flow" variants={sectionVariants}>
                        {HOW_STEPS.map((step, index) => (
                            <motion.article key={step.number} custom={index} variants={cardVariants}>
                                <span>{step.number}</span>
                                <p>{step.title}</p>
                                <small className="mt-3 block leading-7 text-[color:color-mix(in_srgb,var(--text-strong),transparent_32%)]">{step.desc}</small>
                            </motion.article>
                        ))}
                    </motion.div>
                </motion.section>

                <motion.section
                    className="wabee-shell wabee-cta"
                    variants={sectionVariants}
                    initial="hidden"
                    whileInView="show"
                    viewport={SECTION_VIEWPORT}
                >
                    <motion.div variants={revealVariants}>
                        <motion.span variants={titleVariants}>Listo para comenzar</motion.span>
                        <motion.h2 variants={titleVariants}>Todo en un inbox. Conversaciones, contactos, campanas e IA en un solo lugar para tu empresa.</motion.h2>
                    </motion.div>

                    <motion.div className="wabee-cta__actions" variants={titleVariants}>
                        <Link to="/register" className="wabee-primary-button">
                            Crear cuenta
                        </Link>
                        <Link to="/login" className="wabee-secondary-button">
                            Iniciar sesion
                        </Link>
                    </motion.div>
                </motion.section>

                <motion.footer
                    className="wabee-shell pb-12"
                    variants={sectionVariants}
                    initial="hidden"
                    whileInView="show"
                    viewport={SECTION_VIEWPORT}
                >
                    <motion.div
                        className="flex flex-col gap-4 border-t border-[var(--border-default)] pt-8 text-sm text-[color:color-mix(in_srgb,var(--text-strong),transparent_42%)] md:flex-row md:items-center md:justify-between"
                        variants={titleVariants}
                    >
                        <p>© 2026 WABEE. Todos los derechos reservados.</p>
                        <div className="flex flex-wrap gap-5">
                            <Link to="/legal/privacy">Privacidad</Link>
                            <Link to="/legal/terms">Terminos</Link>
                            <Link to="/legal/cookies">Cookies</Link>
                            <Link to="/data-deletion">Eliminar datos</Link>
                        </div>
                    </motion.div>
                </motion.footer>
            </main>
        </div>
    );
};
