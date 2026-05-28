import React from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowRight,
    BarChart3,
    Bot,
    Check,
    Compass,
    LayoutTemplate,
    MessageCircle,
    MessagesSquare,
    PanelLeft,
    PlayCircle,
    ShieldCheck,
    Sparkles,
    UsersRound,
    Wand2,
} from 'lucide-react';

const navItems = [
    { label: 'Producto', href: '#producto' },
    { label: 'Experiencia', href: '#experiencia' },
    { label: 'Sistema', href: '#sistema' },
    { label: 'Vista previa', href: '#preview' },
];

const pillars = [
    {
        icon: MessageCircle,
        title: 'Conversaciones claras',
        text: 'La bandeja se entiende en segundos: jerarquia fuerte, estados visibles y menos ruido por pantalla.',
    },
    {
        icon: Wand2,
        title: 'Marca con personalidad',
        text: 'Wabee deja de verse como un dashboard generico y gana una identidad mas calida, viva y memorable.',
    },
    {
        icon: Compass,
        title: 'Navegacion orientada a tareas',
        text: 'Cada bloque empuja la accion principal: responder, segmentar, lanzar campanas y medir resultados.',
    },
];

const modules = [
    {
        icon: MessagesSquare,
        title: 'Inbox colaborativo',
        text: 'Prioridad visual para conversaciones activas, responsable asignado, IA encendida y proximas acciones.',
    },
    {
        icon: UsersRound,
        title: 'Contactos y segmentos',
        text: 'Tarjetas limpias, filtros permanentes y una lectura mas ejecutiva del pipeline de contactos.',
    },
    {
        icon: Bot,
        title: 'IA y automatizacion',
        text: 'Bloques explicativos mas didacticos para perfiles IA, handoff humano y automatizaciones clave.',
    },
    {
        icon: BarChart3,
        title: 'Metricas visibles',
        text: 'Datos de campanas y atencion con snapshots muy entendibles para equipo operativo y direccion.',
    },
];

const previewCards = [
    {
        eyebrow: 'Sidebar',
        title: 'Navegacion editorial',
        text: 'Menos panel tecnico, mas sensacion de producto premium con iconografia clara y agrupacion por objetivos.',
    },
    {
        eyebrow: 'Workspace',
        title: 'Panel con foco',
        text: 'Titulos grandes, bloques respirados, chips con contraste y componentes con mejor ritmo visual.',
    },
    {
        eyebrow: 'Insights',
        title: 'Resumen accionable',
        text: 'KPIs y alertas con lectura instantanea para que el dashboard sea util en los primeros 10 segundos.',
    },
];

const flow = [
    'Descubrir rapido que esta pasando hoy.',
    'Entrar al modulo correcto sin perderse.',
    'Entender que hacer a continuacion.',
    'Sentir consistencia entre marketing, CRM, inbox e IA.',
];

const tokens = [
    { name: 'Naranja aventura', hex: '#FF8C00' },
    { name: 'Amarillo colmena', hex: '#FFD700' },
    { name: 'Negro carbon', hex: '#1A1A1A' },
    { name: 'Amarillo suave', hex: '#F4F4DC' },
    { name: 'Morado acento', hex: '#9524E3' },
];

export const WabeeRedesignConceptPage = () => {
    return (
        <div className="wabee-redesign min-h-screen text-[#1A1A1A]">
            <div className="wabee-redesign__bg" />

            <header className="wabee-shell relative z-10 pt-6">
                <nav className="wabee-nav">
                    <Link to="/" className="wabee-brand" aria-label="Ir al inicio de Wabee">
                        <span className="wabee-brand__mark">
                            <span>W</span>
                        </span>
                        <span className="wabee-brand__text">WABEE</span>
                    </Link>

                    <div className="wabee-nav__links">
                        {navItems.map((item) => (
                            <a key={item.href} href={item.href}>
                                {item.label}
                            </a>
                        ))}
                    </div>

                    <div className="wabee-nav__actions">
                        <Link to="/" className="wabee-link-button">
                            Ver actual
                        </Link>
                        <a href="#preview" className="wabee-primary-button">
                            Explorar propuesta
                        </a>
                    </div>
                </nav>
            </header>

            <main className="relative z-10">
                <section className="wabee-shell wabee-hero">
                    <div className="wabee-hero__copy">
                        <span className="wabee-kicker">
                            <Sparkles size={16} />
                            Concepto visual para Wabee
                        </span>

                        <h1>
                            Un rediseño con mas
                            <span>claridad, calor de marca y presencia SaaS</span>
                        </h1>

                        <p>
                            Esta propuesta toma la energia comercial de referencias como Manychat y AiSensy,
                            pero la aterriza a una identidad propia de Wabee: mas calida, mas confiable y
                            mucho mas memorable para producto y marketing.
                        </p>

                        <div className="wabee-hero__actions">
                            <a href="#preview" className="wabee-primary-button">
                                Ver pantalla propuesta <ArrowRight size={18} />
                            </a>
                            <a href="#sistema" className="wabee-secondary-button">
                                Revisar sistema visual
                            </a>
                        </div>

                        <ul className="wabee-hero__checks">
                            <li><Check size={16} /> Base clara para landing y dashboard.</li>
                            <li><Check size={16} /> Solo diseno y navegacion, sin tocar logica actual.</li>
                            <li><Check size={16} /> Uso directo de la paleta de Wabee que compartiste.</li>
                        </ul>
                    </div>

                    <div className="wabee-hero__visual" id="preview">
                        <div className="wabee-showcase">
                            <div className="wabee-showcase__topbar">
                                <div className="wabee-showcase__dots">
                                    <span />
                                    <span />
                                    <span />
                                </div>
                                <div className="wabee-showcase__tag">Dashboard concept</div>
                            </div>

                            <div className="wabee-showcase__body">
                                <aside className="wabee-showcase__sidebar">
                                    <div className="wabee-mini-brand">
                                        <span className="wabee-mini-brand__icon">W</span>
                                        <div>
                                            <strong>Wabee</strong>
                                            <span>Conversation OS</span>
                                        </div>
                                    </div>

                                    <div className="wabee-sidebar-group">
                                        <button className="is-active"><PanelLeft size={16} /> Overview</button>
                                        <button><MessagesSquare size={16} /> Inbox</button>
                                        <button><UsersRound size={16} /> Contactos</button>
                                        <button><Bot size={16} /> IA</button>
                                    </div>

                                    <div className="wabee-sidebar-card">
                                        <span>Canal activo</span>
                                        <strong>WhatsApp ventas MX</strong>
                                        <small>24 conversaciones esperando seguimiento.</small>
                                    </div>
                                </aside>

                                <div className="wabee-showcase__workspace">
                                    <div className="wabee-showcase__headline">
                                        <div>
                                            <p>Martes operativo</p>
                                            <h2>Todo el equipo sabe que atender primero</h2>
                                        </div>
                                        <a href="#producto">
                                            <PlayCircle size={16} />
                                            Flujo principal
                                        </a>
                                    </div>

                                    <div className="wabee-metrics">
                                        <article>
                                            <span>Leads nuevos</span>
                                            <strong>148</strong>
                                            <small>+18% vs ayer</small>
                                        </article>
                                        <article>
                                            <span>IA resolviendo</span>
                                            <strong>63%</strong>
                                            <small>12 chats listos para handoff</small>
                                        </article>
                                        <article>
                                            <span>Campana activa</span>
                                            <strong>8.4k</strong>
                                            <small>entregados esta manana</small>
                                        </article>
                                    </div>

                                    <div className="wabee-panels">
                                        <article className="wabee-panel wabee-panel--thread">
                                            <div className="wabee-panel__header">
                                                <div>
                                                    <span>Conversacion prioritaria</span>
                                                    <h3>Ana Torres quiere una demo hoy</h3>
                                                </div>
                                                <span className="wabee-chip">IA pausada</span>
                                            </div>

                                            <div className="wabee-chat">
                                                <div className="wabee-bubble wabee-bubble--client">
                                                    Hola, quiero ver como funcionaria Wabee con mi equipo comercial.
                                                </div>
                                                <div className="wabee-bubble wabee-bubble--agent">
                                                    Te comparto una propuesta y agendamos una demostracion.
                                                </div>
                                            </div>
                                        </article>

                                        <article className="wabee-panel wabee-panel--insight">
                                            <div className="wabee-panel__header">
                                                <div>
                                                    <span>Resumen ejecutivo</span>
                                                    <h3>Lo urgente, sin ruido</h3>
                                                </div>
                                            </div>

                                            <ul className="wabee-alert-list">
                                                <li><ShieldCheck size={16} /> 4 conversaciones superaron SLA.</li>
                                                <li><LayoutTemplate size={16} /> 2 segmentos listos para campana.</li>
                                                <li><Sparkles size={16} /> 1 mejora sugerida en prompts de IA.</li>
                                            </ul>
                                        </article>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="wabee-shell wabee-grid-section" id="producto">
                    <div className="wabee-section-heading">
                        <span>Direccion de producto</span>
                        <h2>La experiencia cambia de "panel tecnico" a "sistema guiado por tareas"</h2>
                    </div>

                    <div className="wabee-pillars">
                        {pillars.map((pillar) => {
                            const Icon = pillar.icon;
                            return (
                                <article key={pillar.title} className="wabee-glass-card">
                                    <div className="wabee-icon-badge">
                                        <Icon size={20} />
                                    </div>
                                    <h3>{pillar.title}</h3>
                                    <p>{pillar.text}</p>
                                </article>
                            );
                        })}
                    </div>
                </section>

                <section className="wabee-shell wabee-modules-section" id="experiencia">
                    <div className="wabee-section-heading">
                        <span>Enfoque visual</span>
                        <h2>Un lenguaje consistente para marketing, operacion e inteligencia</h2>
                    </div>

                    <div className="wabee-modules">
                        {modules.map((module) => {
                            const Icon = module.icon;
                            return (
                                <article key={module.title} className="wabee-module-card">
                                    <div className="wabee-module-card__icon">
                                        <Icon size={20} />
                                    </div>
                                    <h3>{module.title}</h3>
                                    <p>{module.text}</p>
                                </article>
                            );
                        })}
                    </div>
                </section>

                <section className="wabee-shell wabee-preview-section">
                    <div className="wabee-preview-copy">
                        <span>Vista previa narrativa</span>
                        <h2>La propuesta no solo se ve mejor; tambien comunica mejor para que sirve Wabee.</h2>
                        <p>
                            En las referencias que compartiste funciona muy bien la mezcla de marketing fuerte,
                            jerarquia clara y demostracion visual del producto. Aqui estamos tomando eso,
                            pero con una firma propia: mas elegante, menos ruidosa y mas alineada a tu marca.
                        </p>
                    </div>

                    <div className="wabee-preview-stack">
                        {previewCards.map((card) => (
                            <article key={card.title} className="wabee-preview-card">
                                <span>{card.eyebrow}</span>
                                <h3>{card.title}</h3>
                                <p>{card.text}</p>
                            </article>
                        ))}
                    </div>
                </section>

                <section className="wabee-shell wabee-system-section" id="sistema">
                    <div className="wabee-system-card">
                        <div className="wabee-system-card__copy">
                            <span>Sistema visual</span>
                            <h2>Paleta aplicada con roles claros</h2>
                            <p>
                                La propuesta usa el crema como fondo principal, carbon como base estructural,
                                naranja para acciones, amarillo para brillo de marca y morado solo como acento
                                premium. Asi Wabee conserva identidad sin caer en la saturacion visual.
                            </p>
                        </div>

                        <div className="wabee-token-grid">
                            {tokens.map((token) => (
                                <div key={token.hex} className="wabee-token">
                                    <span style={{ backgroundColor: token.hex }} />
                                    <strong>{token.name}</strong>
                                    <small>{token.hex}</small>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="wabee-shell wabee-flow-section">
                    <div className="wabee-section-heading">
                        <span>Principio UX</span>
                        <h2>La navegacion debe responder este flujo en cada pantalla</h2>
                    </div>

                    <div className="wabee-flow">
                        {flow.map((step, index) => (
                            <article key={step}>
                                <span>0{index + 1}</span>
                                <p>{step}</p>
                            </article>
                        ))}
                    </div>
                </section>

                <section className="wabee-shell wabee-cta">
                    <div>
                        <span>Listo para la siguiente etapa</span>
                        <h2>Si te gusta esta direccion, el siguiente paso es bajarla a la landing y al dashboard real.</h2>
                    </div>

                    <div className="wabee-cta__actions">
                        <a href="#preview" className="wabee-primary-button">
                            Volver a la vista previa
                        </a>
                        <Link to="/" className="wabee-secondary-button">
                            Regresar al sitio actual
                        </Link>
                    </div>
                </section>
            </main>
        </div>
    );
};
