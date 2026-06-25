import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Bot, Inbox, Sparkles, Users, X } from 'lucide-react';
import { T, S } from '@/lib/text-tokens';

import bienvenidaImg from '../../../imagenes/bienvenida.png';
import inboxImg from '../../../imagenes/inbox colaborativo.png';
import teamImg from '../../../imagenes/tu equipo colabora.png';
import aiImg from '../../../imagenes/ia que trabaja contigo.png';

const SEEN_KEY = 'wabee_ob_v3';

const SLIDES = [
    {
        title: 'Bienvenido a Wabee',
        body: 'Centraliza conversaciones, canales y operaciones de tu equipo en una sola plataforma.',
        image: bienvenidaImg,
        imageAlt: 'Pantalla de bienvenida de Wabee',
        tone: 'gold',
        art: 'welcome',
        badge: 'Vista central',
        stat: 'Todo en un lugar',
        statCaption: 'Canales, conversaciones y seguimiento sin brincar entre herramientas.',
        icon: Sparkles,
    },
    {
        title: 'Inbox colaborativo',
        body: 'Gestiona conversaciones con responsables, estados y seguimiento visible para todo tu equipo.',
        image: inboxImg,
        imageAlt: 'Pantalla de inbox colaborativo',
        tone: 'charcoal',
        art: 'inbox',
        badge: 'Inbox compartido',
        stat: 'Seguimiento visible',
        statCaption: 'Cada conversacion tiene responsable, contexto y siguiente paso claro.',
        icon: Inbox,
    },
    {
        title: 'Tu equipo colabora mejor',
        body: 'Comparte contexto, historial y siguientes pasos sin salir de la operacion diaria.',
        image: teamImg,
        imageAlt: 'Pantalla de colaboracion de equipo',
        tone: 'amber',
        art: 'team',
        badge: 'Trabajo coordinado',
        stat: 'Menos rebote interno',
        statCaption: 'Ventas, soporte y operacion colaboran con el mismo historial.',
        icon: Users,
    },
    {
        title: 'IA que trabaja contigo',
        body: 'Activa copiloto y automatizaciones para responder mas rapido sin perder control.',
        image: aiImg,
        imageAlt: 'Pantalla de inteligencia artificial',
        tone: 'gold',
        art: 'ai',
        badge: 'Automatizacion guiada',
        stat: 'IA con control humano',
        statCaption: 'Acelera respuestas y deja la intervencion humana donde aporta mas valor.',
        icon: Bot,
    },
] as const;

const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 40 : -40, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -40 : 40, opacity: 0 }),
};

export const OnboardingModal: React.FC = () => {
    const [visible, setVisible] = useState(() => {
        try {
            return !window.localStorage.getItem(SEEN_KEY);
        } catch {
            return false;
        }
    });
    const [current, setCurrent] = useState(0);
    const [dir, setDir] = useState(1);
    const navigate = useNavigate();

    const dismiss = () => {
        localStorage.setItem(SEEN_KEY, '1');
        setVisible(false);
    };

    const goTo = (index: number) => {
        if (index < 0 || index >= SLIDES.length || index === current) return;
        setDir(index > current ? 1 : -1);
        setCurrent(index);
    };

    const handleNext = () => {
        if (current < SLIDES.length - 1) {
            goTo(current + 1);
            return;
        }

        dismiss();
        navigate('/register');
    };

    if (!visible) return null;

    const slide = SLIDES[current];
    const isLast = current === SLIDES.length - 1;
    const SlideIcon = slide.icon;

    return createPortal(
        <AnimatePresence>
            <motion.div
                className="wabee-ob2-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={(e) => { if (e.target === e.currentTarget) dismiss(); }}
                aria-modal="true"
                role="dialog"
                aria-label="Bienvenido a Wabee"
            >
                <motion.div
                    className="wabee-ob2-card wabee-ob2-card--phone"
                    initial={{ y: 28, opacity: 0, scale: 0.96 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    exit={{ y: 20, opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                >
                    <AnimatePresence mode="wait" custom={dir}>
                        <motion.div
                            key={current}
                            custom={dir}
                            variants={slideVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ duration: 0.24, ease: 'easeInOut' }}
                            className="wabee-ob2-phone-slide"
                        >
                            <div className={`wabee-ob-hero wabee-ob-hero--${slide.tone}`}>
                                <button
                                    type="button"
                                    onClick={dismiss}
                                    className={`${T.helperText} ${S.meta} wabee-ob2-skip`}
                                    aria-label="Cerrar onboarding"
                                >
                                    <X size={14} />
                                </button>

                                <div className="wabee-ob-hero__glow wabee-ob-hero__glow--one" />
                                <div className="wabee-ob-hero__glow wabee-ob-hero__glow--two" />
                                <div className={`wabee-ob-hero__badge wabee-ob-hero__badge--top wabee-ob-hero__badge--${slide.tone}`}>
                                    <SlideIcon size={14} />
                                    <span>{slide.badge}</span>
                                </div>
                                <div className="wabee-ob-hero__badge wabee-ob-hero__badge--bottom">
                                    <Sparkles size={14} />
                                    <span>{slide.stat}</span>
                                </div>

                                <div className="wabee-ob-hero__art wabee-ob-hero__art--modal">
                                    <img
                                        src={slide.image}
                                        alt={slide.imageAlt}
                                        className={`wabee-ob-hero__image wabee-ob-hero__image--modal wabee-ob-hero__image--${slide.art}`}
                                    />
                                </div>
                            </div>

                            <div className="wabee-ob2-body wabee-ob-panel wabee-ob-panel--modal">
                                <div className="wabee-ob-panel__meta">
                                    <div className="wabee-ob-panel__meta-copy">
                                        <span className={`${T.kpiLabel} ${S.meta} wabee-ob2-kicker`}>
                                            Paso {current + 1} de {SLIDES.length}
                                        </span>
                                        <span className="wabee-ob-panel__count">Recorrido inicial</span>
                                    </div>
                                    <div className={`wabee-ob-tone-pill wabee-ob-tone-pill--${slide.tone}`}>
                                        <SlideIcon size={14} />
                                        <span>{slide.badge}</span>
                                    </div>
                                </div>

                                <h2 className="wabee-ob2-title">{slide.title}</h2>
                                <p className={`${T.pageSubtitle} ${S.body} wabee-ob2-desc`}>{slide.body}</p>

                                <div className={`wabee-ob-highlight wabee-ob-highlight--${slide.tone}`}>
                                    <strong>{slide.stat}</strong>
                                    <p>{slide.statCaption}</p>
                                </div>

                                <div className="wabee-ob2-dots" role="tablist" aria-label="Paso actual">
                                    {SLIDES.map((_, i) => (
                                        <button
                                            key={i}
                                            type="button"
                                            role="tab"
                                            aria-selected={i === current}
                                            aria-label={`Slide ${i + 1}`}
                                            onClick={() => goTo(i)}
                                            className={`wabee-ob2-dot${i === current ? ' wabee-ob2-dot--active' : ''}`}
                                        />
                                    ))}
                                </div>

                                <button
                                    type="button"
                                    onClick={handleNext}
                                    className={`${T.buttonPrimaryText} wabee-ob2-next`}
                                >
                                    {isLast ? 'Crear cuenta gratis' : 'Continuar'}
                                    <ArrowRight size={16} />
                                </button>
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </motion.div>
            </motion.div>
        </AnimatePresence>,
        document.body
    );
};
