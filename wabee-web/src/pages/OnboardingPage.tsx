import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Sparkles } from 'lucide-react';
import { T, S } from '@/lib/text-tokens';
import { BrandLogo } from '../components/BrandLogo';

import bienvenidaImg from '../../../imagenes/bienvenida.png';
import inboxImg from '../../../imagenes/inbox colaborativo.png';
import teamImg from '../../../imagenes/tu equipo colabora.png';
import aiImg from '../../../imagenes/ia que trabaja contigo.png';

const SLIDES = [
    {
        kicker: 'Bienvenida',
        title: 'Bienvenido a Wabee',
        body: 'Centraliza conversaciones, canales y operaciones de tu equipo en una sola plataforma mucho más clara.',
        image: bienvenidaImg,
        imageAlt: 'Pantalla de bienvenida de Wabee',
        tone: 'gold',
        art: 'welcome',
        bullets: ['Vista unificada para tu operación', 'Todo el equipo sobre el mismo contexto', 'Más orden desde el primer día'],
    },
    {
        kicker: 'Inbox colaborativo',
        title: 'Inbox colaborativo',
        body: 'Gestiona conversaciones con responsables, estados y seguimiento visible para que nada se quede suelto.',
        image: inboxImg,
        imageAlt: 'Pantalla de inbox colaborativo',
        tone: 'charcoal',
        art: 'inbox',
        bullets: ['Asignación por agente', 'Prioridades y estados visibles', 'Handoff claro entre áreas'],
    },
    {
        kicker: 'Equipo coordinado',
        title: 'Tu equipo colabora mejor',
        body: 'Notas, historial compartido y siguiente paso en un solo lugar para ventas, soporte y seguimiento.',
        image: teamImg,
        imageAlt: 'Pantalla de colaboración de equipo',
        tone: 'amber',
        art: 'team',
        bullets: ['Menos rebotes internos', 'Más contexto en cada chat', 'Operación más rápida y ordenada'],
    },
    {
        kicker: 'IA aplicada',
        title: 'IA que trabaja contigo',
        body: 'Usa copiloto, respuestas sugeridas y automatizaciones para acelerar la atención sin perder control.',
        image: aiImg,
        imageAlt: 'Pantalla de inteligencia artificial en Wabee',
        tone: 'gold',
        art: 'ai',
        bullets: ['Respuestas más rápidas', 'Automatizaciones inteligentes', 'Escalado humano cuando importa'],
    },
] as const;

const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 52 : -52, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -52 : 52, opacity: 0 }),
};

export const OnboardingPage = () => {
    const [current, setCurrent] = useState(0);
    const [direction, setDirection] = useState(1);
    const navigate = useNavigate();

    const isFirst = current === 0;
    const isLast = current === SLIDES.length - 1;
    const slide = SLIDES[current];

    const goTo = (index: number) => {
        if (index < 0 || index >= SLIDES.length || index === current) return;
        setDirection(index > current ? 1 : -1);
        setCurrent(index);
    };

    const handleNext = () => {
        if (isLast) navigate('/register');
        else goTo(current + 1);
    };

    const handleBack = () => {
        if (isFirst) navigate('/');
        else goTo(current - 1);
    };

    return (
        <div className="wabee-auth min-h-screen wabee-ob-page">
            <div className="wabee-ob-page__bg" />

            <div className="wabee-ob-shell wabee-ob-shell--single">
                <div className="wabee-ob-header">
                    <Link to="/" aria-label="Ir al inicio de Wabee">
                        <BrandLogo variant="full" size={44} />
                    </Link>

                    <button
                        type="button"
                        onClick={() => navigate('/register')}
                        className={`${T.helperText} ${S.meta} wabee-ob-header-skip`}
                    >
                        Omitir
                    </button>
                </div>

                <div className="wabee-ob-card wabee-ob-card--phone">
                    <AnimatePresence mode="wait" custom={direction}>
                        <motion.div
                            key={current}
                            custom={direction}
                            variants={slideVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                            className="wabee-ob-phone-slide"
                        >
                            <div className={`wabee-ob-hero wabee-ob-hero--${slide.tone}`}>
                                <button
                                    type="button"
                                    onClick={() => navigate('/register')}
                                    className="wabee-ob-hero__skip"
                                >
                                    Omitir
                                </button>

                                <div className="wabee-ob-hero__glow wabee-ob-hero__glow--one" />
                                <div className="wabee-ob-hero__glow wabee-ob-hero__glow--two" />

                                <div
                                    className={`wabee-ob-hero__art wabee-ob-hero__art--${slide.art}`}
                                >
                                    <img
                                        src={slide.image}
                                        alt={slide.imageAlt}
                                        className={`wabee-ob-hero__image wabee-ob-hero__image--${slide.art}`}
                                    />
                                </div>
                            </div>

                            <div className="wabee-ob-panel">
                                <div className="wabee-ob-panel__meta">
                                    <span className={`${T.kpiLabel} ${S.meta} wabee-ob-kicker`}>
                                        {slide.kicker}
                                    </span>
                                    <span className="wabee-ob-panel__count">Paso {current + 1} de {SLIDES.length}</span>
                                </div>

                                <h1 className={`${T.pageTitle} ${S.displaySm} wabee-ob-title wabee-ob-title--panel`}>
                                    {slide.title}
                                </h1>

                                <p className={`${T.pageSubtitle} ${S.body} wabee-ob-body wabee-ob-body--panel`}>
                                    {slide.body}
                                </p>

                                <div className="wabee-ob-bullets wabee-ob-bullets--stack" aria-label="Beneficios principales">
                                    {slide.bullets.map((item) => (
                                        <div key={item} className="wabee-ob-bullet wabee-ob-bullet--compact">
                                            <span className="wabee-ob-bullet__icon">
                                                <Check size={12} />
                                            </span>
                                            <span>{item}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="wabee-ob-dots wabee-ob-dots--center" role="tablist" aria-label="Progreso del onboarding">
                                    {SLIDES.map((_, i) => (
                                        <button
                                            key={i}
                                            type="button"
                                            role="tab"
                                            aria-selected={i === current}
                                            aria-label={`Paso ${i + 1} de ${SLIDES.length}`}
                                            onClick={() => goTo(i)}
                                            className={`wabee-ob-dot${i === current ? ' wabee-ob-dot--active' : ''}`}
                                        />
                                    ))}
                                </div>

                                <div className="wabee-ob-actions wabee-ob-actions--stack">
                                    <button
                                        type="button"
                                        onClick={handleNext}
                                        className={`${T.buttonPrimaryText} ${S.body} wabee-ob-cta`}
                                    >
                                        {isLast ? 'Crear cuenta gratis' : 'Continuar'}
                                        <ArrowRight size={18} />
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleBack}
                                        className={`${T.buttonText} ${S.body} wabee-ob-ghost wabee-ob-ghost--soft`}
                                    >
                                        <ArrowLeft size={16} />
                                        {isFirst ? 'Volver' : 'Anterior'}
                                    </button>
                                </div>

                                <div className="wabee-ob-panel__footer">
                                    <Sparkles size={14} />
                                    <span>Diseñado para operar WhatsApp con más claridad</span>
                                </div>
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};
