/**
 * WABEE – Design Tokens de Texto v2
 * ─────────────────────────────────────────────────────────────────────────────
 * Principios de este sistema:
 *
 *  1. Los tokens definen ESTILO VISUAL (peso, familia, transformación, color base)
 *     pero NO imponen tamaño de texto — el tamaño va por composición.
 *
 *  2. Los tokens de TAMAÑO son una capa separada (`textSize`) para componer
 *     libremente con tokens de estilo.
 *
 *  3. Los tokens de COLOR usan variables CSS `--ty-*` definidas en index.css,
 *     lo que permite soportar dark/light theme sin tocar este archivo.
 *
 * PATRÓN DE USO:
 *
 *   import { textTokens as T, textSize as S } from '@/lib/text-tokens';
 *
 *   // Título grande:
 *   <h1 className={`${T.pageTitle} ${S.displayLg}`}>Dashboard</h1>
 *
 *   // Título mediano:
 *   <h2 className={`${T.pageTitle} ${S.displayMd}`}>Campañas</h2>
 *
 *   // KPI card:
 *   <p className={`${T.kpiLabel} ${S.meta}`}>Revenue</p>
 *   <p className={`${T.kpiValue} ${S.kpiLg}`}>$1,240</p>
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  CAPA DE TAMAÑOS — textSize                                             ║
// ║  Sin color, sin peso propio. Solo tamaño de fuente + line-height.       ║
// ╚══════════════════════════════════════════════════════════════════════════╝

export const textSize = {
    /** 3rem → clamp – para hero titles */
    displayLg: 'text-[clamp(2rem,4vw,3rem)] leading-none',
    /** ≈2xl → para subtítulos de sección o h1 secundarios */
    displayMd: 'text-3xl leading-tight',
    /** ≈2xl → para encabezados menores o precios destacados */
    displaySm: 'text-2xl leading-tight',
    /** ≈xl → para encabezados de sección/card */
    headingLg: 'text-xl leading-snug',
    /** ≈base → para encabezados pequeños o énfasis */
    headingSm: 'text-base leading-snug',
    /** xs → encabezados compactos en cards/tablas */
    headingMd: 'text-xs leading-snug',
    /** lg → cuerpo de texto resaltado o intro */
    bodyLg:     'text-lg leading-relaxed',
    /** sm → cuerpo principal, párrafos, celdas */
    body:       'text-sm leading-relaxed',
    /** 0.625rem → botones, tabs, nav items */
    ui:         'text-[0.625rem] leading-none',
    /** 0.5625rem → labels, helpers, counters */
    meta:       'text-[0.5625rem] leading-tight',
    /** 1.5rem → valores de KPI grandes */
    kpiLg:     'text-2xl leading-none',
    /** 1.25rem → valores de KPI secundarios / status cards */
    kpiMd:     'text-xl leading-none',
} as const;

export type TextSizeKey = keyof typeof textSize;

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  CAPA DE ESTILO — textTokens                                            ║
// ║  Solo peso, familia, transformación y color base via --ty-* variables.  ║
// ║  SIN tamaño de texto incluido.                                          ║
// ╚══════════════════════════════════════════════════════════════════════════╝

export const textTokens = {
    // ── Títulos ───────────────────────────────────────────────────────────────
    /**
     * Estilo de título principal. Componer con textSize.displayLg / displayMd.
     * @example <h1 className={`${T.pageTitle} ${S.displayLg}`}>…</h1>
     */
    pageTitle:
        '[color:var(--tx-pageTitle-color)] [font-family:var(--tx-pageTitle-font)] font-black italic uppercase tracking-tighter',

    /**
     * Párrafo descriptivo bajo el título de página.
     * @example <p className={`${T.pageSubtitle} ${S.body}`}>…</p>
     */
    pageSubtitle:
        '[color:var(--tx-pageSubtitle-color)] [font-family:var(--tx-pageSubtitle-font)] font-medium',

    /**
     * Encabezado de sección o card (h2, h3).
     * @example <h2 className={`${T.cardTitle} ${S.headingMd} flex items-center gap-2`}>…</h2>
     */
    cardTitle:
        '[color:var(--tx-cardTitle-color)] [font-family:var(--tx-cardTitle-font)] font-black uppercase tracking-[0.2em]',

    /**
     * Título de sección dentro de una página (nombre canónico oficial).
     * @example <h3 className={`${T.sectionTitle} ${S.headingLg}`}>…</h3>
     */
    sectionTitle:
        '[color:var(--tx-sectionTitle-color)] [font-family:var(--tx-sectionTitle-font)] font-black uppercase tracking-widest italic',

    /**
     * Subtítulo o descripción bajo el encabezado de sección.
     * @example <p className={`${T.sectionSubtitle} ${S.body}`}>…</p>
     */
    sectionSubtitle:
        '[color:var(--tx-sectionSubtitle-color)] [font-family:var(--tx-sectionSubtitle-font)] font-medium',

    /**
     * Descripción compacta bajo el encabezado de card.
     * @example <p className={`${T.cardSubtitle} ${S.meta}`}>…</p>
     */
    cardSubtitle:
        '[color:var(--tx-cardSubtitle-color)] [font-family:var(--tx-cardSubtitle-font)] font-bold',

    // ── KPI Cards ─────────────────────────────────────────────────────────────
    /**
     * Label sobre el valor numérico de un KPI.
     * @example <p className={`${T.kpiLabel} ${S.meta}`}>Revenue</p>
     */
    kpiLabel:
        '[color:var(--tx-kpiLabel-color)] [font-family:var(--tx-kpiLabel-font)] font-black uppercase tracking-[0.15em] opacity-60',

    /**
     * Valor numérico de un KPI. Componer con textSize.kpiLg o kpiMd.
     * @example <p className={`${T.kpiValue} ${S.kpiLg}`}>$1,240</p>
     */
    kpiValue:
        '[color:var(--tx-kpiValue-color)] [font-family:var(--tx-kpiValue-font)] font-black tracking-tighter italic',

    // ── Formularios ───────────────────────────────────────────────────────────
    /** Etiquetas de campos de formulario. */
    labelText:
        '[color:var(--tx-labelText-color)] [font-family:var(--tx-labelText-font)] font-black uppercase tracking-widest',

    /** Texto de input del usuario (placeholder heredado del CSS). */
    inputText:
        '[color:var(--tx-inputText-color)] [font-family:var(--tx-inputText-font)] font-medium',

    // ── Botones ───────────────────────────────────────────────────────────────
    /** Texto visible dentro de botones secundarios/terciarios. Componer con textSize.ui o body. */
    buttonText:
        '[color:var(--tx-buttonText-color)] [font-family:var(--tx-buttonText-font)] font-black uppercase tracking-widest',

    /** Texto visible dentro de botones principales (fondo primario). Componer con textSize.ui o body. */
    buttonPrimaryText:
        '[color:var(--tx-buttonPrimaryText-color)] [font-family:var(--tx-buttonPrimaryText-font)] font-black uppercase tracking-widest',

    // ── Navegación ────────────────────────────────────────────────────────────
    /**
     * Items de SIDEBAR donde el truncado es necesario.
     * @example <span className={`${T.navText} ${S.ui} truncate`}>…</span>
     */
    navText:
        '[color:var(--tx-navText-color)] [font-family:var(--tx-navText-font)] font-bold truncate',

    /**
     * Items de DROPDOWN / menú de perfil donde NO se debe truncar.
     * @example <span className={`${T.menuText} ${S.body}`}>Mi Perfil</span>
     */
    menuText:
        '[color:var(--tx-menuText-color)] [font-family:var(--tx-menuText-font)] font-medium',

    // ── Tablas ────────────────────────────────────────────────────────────────
    /** Encabezado de columna de tabla. */
    tableHeader:
        '[color:var(--tx-tableHeader-color)] [font-family:var(--tx-tableHeader-font)] font-black uppercase tracking-widest',

    /** Celda de tabla — dato principal. */
    tableCell:
        '[color:var(--tx-tableCell-color)] [font-family:var(--tx-tableCell-font)] font-medium',

    // ── Badges / Estados ──────────────────────────────────────────────────────
    /**
     * Texto de badge, chip, etiqueta de estado.
     * El color se aplica con clases externas según el estado.
     */
    badgeText:
        'tx-badgeText font-black uppercase tracking-widest leading-none',

    /** Texto de un badge de estado con color neutro de apoyo. */
    statusText:
        '[color:var(--tx-statusText-color)] [font-family:var(--tx-statusText-font)] font-black uppercase tracking-wider',

    // ── Empty States ──────────────────────────────────────────────────────────
    /** Título de pantalla vacía. Componer con textSize.displayMd. */
    emptyStateTitle:
        '[color:var(--tx-emptyStateTitle-color)] [font-family:var(--tx-emptyStateTitle-font)] font-black uppercase tracking-tighter italic',

    /** Cuerpo explicativo de pantalla vacía. */
    emptyStateBody:
        '[color:var(--tx-emptyStateBody-color)] [font-family:var(--tx-emptyStateBody-font)] font-medium',

    // ── Mensajes / Toasts / Alerts ────────────────────────────────────────────
    /** Texto de toasts, dialogs, alertas inline. */
    messageText:
        '[color:var(--tx-messageText-color)] [font-family:var(--tx-messageText-font)] font-medium',

    // ── Texto auxiliar ────────────────────────────────────────────────────────
    /** Metadatos, contadores, notas secundarias — gris, itálica opcional. */
    helperText:
        '[color:var(--tx-helperText-color)] [font-family:var(--tx-helperText-font)] font-bold',
} as const;

export type TextTokenKey = keyof typeof textTokens;

// ── Re-export de conveniencia ────────────────────────────────────────────────
export { textTokens as T, textSize as S };


