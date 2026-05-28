/**
 * WABEE – Grupos Semánticos de Texto
 * ─────────────────────────────────────────────────────────────────────────────
 * Mapeo entre los tipos de texto del frontend y los grupos semánticos oficiales.
 * Sirve como referencia para migrar clases hardcodeadas de forma progresiva.
 *
 * CATEGORÍAS SEMÁNTICAS → GRUPOS VISUALES:
 *
 *  page_title         → display
 *  page_subtitle      → body
 *  section_title      → heading
 *  section_subtitle   → subheading
 *  label_text         → meta
 *  input_text         → body
 *  button_text        → ui
 *  nav_text           → ui
 *  table_text         → body / meta
 *  status_text        → meta
 *  message_text       → body
 *  helper_text        → meta
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Todos los grupos semánticos disponibles */
export type SemanticGroup =
    | 'page_title'
    | 'page_subtitle'
    | 'section_title'
    | 'section_subtitle'
    | 'label_text'
    | 'input_text'
    | 'button_text'
    | 'nav_text'
    | 'table_text'
    | 'status_text'
    | 'message_text'
    | 'helper_text';

/** Grupos visuales (escala tipográfica) */
export type VisualGroup = 'display' | 'heading' | 'subheading' | 'body' | 'ui' | 'meta';

/** Mapeo entre grupo semántico y grupo visual */
export const semanticToVisual: Record<SemanticGroup, VisualGroup> = {
    page_title:       'display',
    page_subtitle:    'body',
    section_title:    'heading',
    section_subtitle: 'subheading',
    label_text:       'meta',
    input_text:       'body',
    button_text:      'ui',
    nav_text:         'ui',
    table_text:       'body',
    status_text:      'meta',
    message_text:     'body',
    helper_text:      'meta',
};

/**
 * Mapeo del inventario auditado (categorías del audit) hacia grupos semánticos.
 * Referencia completa para la migración progresiva.
 */
export const auditCategoryToSemantic: Record<string, SemanticGroup> = {
    TITULO:            'page_title',
    SUBTITULO:         'page_subtitle',
    SECCION:           'section_title',
    SECCION_SUBTITULO: 'section_subtitle',
    LABEL:             'label_text',
    PLACEHOLDER:       'input_text',
    BOTON:             'button_text',
    LINK:              'button_text',
    MENU_ITEM:         'nav_text',
    TEXTO_SIDEBAR:     'nav_text',
    TEXTO_NAVBAR:      'nav_text',
    TAB:               'nav_text',
    HEADER_COLUMNA:    'table_text',
    TEXTO_TABLA:       'table_text',
    BADGE:             'status_text',
    BADGE_STATUS:      'status_text',
    LOADER:            'message_text',
    EMPTY_STATE:       'message_text',
    TOAST:             'message_text',
    DIALOG:            'message_text',
    DIALOG_BOTON:      'button_text',
    ALERTA:            'message_text',
    CHECKBOX:          'helper_text',
    TOOLTIP:           'helper_text',
    PAGINACION:        'helper_text',
    BOTON_PAG:         'button_text',
    KPI_CARD:          'section_title',
    KPI:               'section_subtitle',
    LOGO:              'page_title',
    FOOTER:            'helper_text',
};

/**
 * Textos que se recomienda unificar semánticamente antes de estilizar.
 * Clave: texto actual → sugerencia de estandarización.
 */
export const terminologyUnification: Record<string, { suggestion: string; reason: string }> = {
    'Inbox':              { suggestion: 'Bandeja',           reason: 'Inglés, resto del sidebar en español' },
    'Team':               { suggestion: 'Equipo',            reason: 'Inglés, resto del sidebar en español' },
    'Campaigns Hub':      { suggestion: 'Campañas Hub',      reason: 'Título de página totalmente en inglés' },
    'Campaigns':          { suggestion: 'Campañas',          reason: 'Item de sidebar en inglés' },
    'Branding':           { suggestion: 'Apariencia',        reason: 'Inglés, considerar "Personalización"' },
    'Audit Trail':        { suggestion: 'Registro de Auditoría', reason: 'Título de página en inglés' },
    'Dashboard':          { suggestion: 'Panel',             reason: 'Inglés ampliamente adoptado — MANTENER' },
    'Revenue Atribuido':  { suggestion: 'Ingresos Atribuidos', reason: 'Mezcla inglés–español' },
    'Leads Generados':    { suggestion: 'Prospectos Generados', reason: 'Mezcla inglés–español' },
    'Takeovers':          { suggestion: 'Retomas Humanas',   reason: 'Inglés en dashboard de IA' },
    'N/A':                { suggestion: 'Sin datos',         reason: 'Inglés en tabla de auditoría' },
    'Identidad':          { suggestion: 'Nombre',            reason: 'Terminología no estándar en tabla CRM' },
    'Telefonía':          { suggestion: 'Teléfono',          reason: 'Terminología no estándar en tabla CRM' },
    'Protocolo':          { suggestion: 'Estado',            reason: 'Confuso para el usuario final' },
    'Comandos':           { suggestion: 'Acciones',          reason: 'Inusual para columna de acciones' },
    'Garantizar Conexión':{ suggestion: 'Abrir Chat',        reason: 'Texto de botón poco intuitivo' },
    'Abortar':            { suggestion: 'Cancelar',          reason: 'Tono inadecuado para el contexto' },
    'Zona Desértica':     { suggestion: 'Sin segmentos',     reason: 'Metáfora confusa en empty state' },
    'Ejecutar Visión':    { suggestion: 'Ver Contactos',     reason: 'Botón poco claro en segmentos' },
    'Web Widgets':        { suggestion: 'Widgets Web',       reason: 'Consistencia con orden español' },
    'Canales HC':         { suggestion: 'Channels (High-Content)', reason: 'Acrónimo no explicado' },
    'Aut mación':         { suggestion: 'Automatización',    reason: '⚠️ ERROR TIPOGRÁFICO en DashboardPage.tsx' },
    'Backlog en Cola Humana Alto': { suggestion: 'Alta carga en cola humana', reason: '"Backlog" en inglés' },
    'Query:':             { suggestion: 'Etiqueta:',         reason: '"Query" en inglés en chip de segmento' },
    'Match:':             { suggestion: 'Búsqueda:',         reason: '"Match" en inglés en chip de segmento' },
};
