import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { T, S } from '@/lib/text-tokens';
import { BrandLogo } from '../components/BrandLogo';

interface LegalLayoutProps {
    children: React.ReactNode;
    title: string;
    lastUpdate: string;
    summary: string;
}

export const LegalLayout: React.FC<LegalLayoutProps> = ({ children, title, lastUpdate, summary }) => {
    const navigate = useNavigate();
    const location = useLocation();

    const legalLinks = [
        { to: '/legal/privacy', label: 'Privacidad' },
        { to: '/legal/terms', label: 'Terminos' },
        { to: '/legal/cookies', label: 'Cookies' },
        { to: '/legal/aup', label: 'AUP' },
        { to: '/data-deletion', label: 'Eliminar datos' },
    ];

    const renderBee = (className: string) => (
        <div className={`wabee-bee ${className}`} aria-hidden="true">
            <span className="wabee-bee__wing wabee-bee__wing--left" />
            <span className="wabee-bee__wing wabee-bee__wing--right" />
            <span className="wabee-bee__body" />
        </div>
    );

    return (
        <div className="wabee-legal min-h-screen selection:bg-[var(--wabee-selection-bg)] selection:text-[var(--wabee-selection-text)]">
            <div className="wabee-redesign__bg" />
            {renderBee('wabee-bee--one')}
            {renderBee('wabee-bee--four')}

            <nav className="wabee-legal__nav">
                <div className="wabee-legal__nav-shell">
                    <div className="flex items-center gap-5">
                        <BrandLogo variant="full" size={34} />
                        <div className="hidden md:block w-px h-7 bg-[var(--wabee-legal-border)]" />
                        <span className={`${T.labelText} ${S.meta} hidden md:block wabee-legal__eyebrow`}>
                            Centro legal
                        </span>
                    </div>

                    <button
                        onClick={() => navigate('/')}
                        className={`${T.buttonText} ${S.meta} wabee-legal__back`}
                    >
                        <ArrowLeft size={16} />
                        Volver al inicio
                    </button>
                </div>
            </nav>

            <main className="wabee-legal__main">
                <div className="wabee-legal__shell">
                    <header className="wabee-legal__header">
                        <span className="wabee-kicker">Documento legal</span>
                        <h1 className={`${T.pageTitle} ${S.displayMd} wabee-legal__title`}>{title}</h1>
                        <div className="wabee-legal__meta">
                            <span className={`${T.badgeText} ${S.meta} wabee-legal__badge`}>
                                Ultima actualizacion: {lastUpdate}
                            </span>
                        </div>

                        <div className="wabee-legal__summary">
                            <p className={`${T.sectionSubtitle} ${S.body}`}>
                                <strong>En pocas palabras:</strong> {summary}
                            </p>
                        </div>
                    </header>

                    <div className="wabee-legal__tabs" aria-label="Navegacion legal">
                        {legalLinks.map((item) => (
                            <Link
                                key={item.to}
                                to={item.to}
                                className={`wabee-legal__tab${location.pathname === item.to ? ' is-active' : ''}`}
                            >
                                {item.label}
                            </Link>
                        ))}
                    </div>

                    <div className="wabee-legal__content">
                        {children}
                    </div>

                    <footer className="wabee-legal__footer">
                        <p className={`${T.helperText} ${S.meta}`}>
                            © 2026 WABEE · Todos los derechos reservados.
                        </p>
                        <div className="wabee-legal__footer-links">
                            {legalLinks.map((item) => (
                                <Link key={item.to} to={item.to}>
                                    {item.label}
                                </Link>
                            ))}
                        </div>
                    </footer>
                </div>
            </main>
        </div>
    );
};
