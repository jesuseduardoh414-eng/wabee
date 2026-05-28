/**
 * templateInputParser.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Parser puro (sin dependencias externas) para detectar inputs parametrizables
 * en plantillas de WhatsApp Cloud API.
 *
 * HARDENING:
 *  - InputMapping usa mode (fixed | contact_field) — "computed" deshabilitado en v1.
 *  - contact_field solo acepta valores de ALLOWED_CONTACT_FIELDS.
 *  - No ejecuta fórmulas arbitrarias.
 */

// ─── Tipos de Template (subconjunto de lo que devuelve Meta) ─────────────────

export type TemplateComponentType = 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
export type HeaderFormat = 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'LOCATION' | 'NONE';

export interface TemplateComponent {
    type: TemplateComponentType;
    format?: HeaderFormat;     // solo para HEADER
    text?: string;             // para HEADER TEXT y BODY
    buttons?: TemplateButton[];
    example?: Record<string, any>;
}

export interface TemplateButton {
    type: string;              // "QUICK_REPLY" | "URL" | "PHONE_NUMBER" | "COPY_CODE"
    text?: string;
    url?: string;
    phone_number?: string;
}

export interface Template {
    id: string;
    name: string;
    language: string;
    category: string;
    status: string;
    components: TemplateComponent[];
}

// ─── InputDescriptor ─────────────────────────────────────────────────────────

export type InputComponentType = 'BODY' | 'HEADER' | 'BUTTON';
export type InputKind = 'TEXT_VAR' | 'URL_VAR' | 'MEDIA' | 'OTHER';

export interface InputDescriptor {
    /** ID estable, ej: "body_var_1", "header_media", "button_url_0_var_1" */
    id: string;
    componentType: InputComponentType;
    kind: InputKind;
    /** Índice del placeholder {{N}} o null para media */
    placeholderIndex: number | null;
    label: string;
    required: boolean;
    maxLength?: number; // Configurable max length, default 1024
    meta: Record<string, any>;
}

// ─── InputMapping (hardened) ──────────────────────────────────────────────────

export type InputMappingMode = 'fixed' | 'contact_field' | 'fixed_media';
// NOTE: "computed" está deshabilitado en v1 por seguridad.

export interface InputMappingEntry {
    mode: InputMappingMode;
    value: string;        // valor fijo, campo de contacto o handle/url del asset
    fallback?: string;    // valor de respaldo si el campo de contacto está vacío
}

export type TemplateInputMapping = Record<string, InputMappingEntry>;

// ─── Listas blancas de seguridad ──────────────────────────────────────────────

/**
 * Campos de contacto que se pueden referenciar en el mapping.
 * Corresponden al modelo Contact de Prisma.
 */
export const ALLOWED_CONTACT_FIELDS: readonly string[] = [
    'contact.name',
    'contact.phone',
    'contact.email',
] as const;

// ─── Regex ────────────────────────────────────────────────────────────────────

const PLACEHOLDER_REGEX = /\{\{(\d+)\}\}/g;

// ─── Helpers internos ─────────────────────────────────────────────────────────

function extractPlaceholders(text: string): number[] {
    const indices: number[] = [];
    let match: RegExpExecArray | null;
    const regex = new RegExp(PLACEHOLDER_REGEX.source, 'g');
    while ((match = regex.exec(text)) !== null) {
        const idx = parseInt(match[1], 10);
        if (!indices.includes(idx)) indices.push(idx);
    }
    return indices.sort((a, b) => a - b);
}

// ─── Tokenizador (Para Inline Preview) ──────────────────────────────────────

export interface TokenSegment {
    type: 'text' | 'var';
    text?: string;
    index?: number;
}

/**
 * Tokeniza un texto con placeholders {{N}} en un arreglo de segmentos
 * Ejemplo: "Hola {{1}}, pedido {{2}}" -> [{text: "Hola "}, {index: 1}, {text: ", pedido "}, {index: 2}]
 */
export function tokenizeTemplateText(text: string): TokenSegment[] {
    const segments: TokenSegment[] = [];
    const regex = /\{\{(\d+)\}\}/g;
    let match: RegExpExecArray | null;
    let lastIndex = 0;

    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            segments.push({ type: 'text', text: text.substring(lastIndex, match.index) });
        }
        segments.push({ type: 'var', index: parseInt(match[1], 10) });
        lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
        segments.push({ type: 'text', text: text.substring(lastIndex) });
    }

    return segments;
}

// ─── API Pública ─────────────────────────────────────────────────────────────

/**
 * Detecta si un template tiene algún input parametrizable.
 */
export function hasTemplateInputs(template: Template): boolean {
    return getTemplateInputs(template).length > 0;
}

/**
 * Extrae todos los InputDescriptors de un template.
 * Orden: BODY vars → HEADER → BUTTONS
 */
export function getTemplateInputs(template: Template): InputDescriptor[] {
    const descriptors: InputDescriptor[] = [];

    if (!template?.components || !Array.isArray(template.components)) {
        return descriptors;
    }

    for (const component of template.components) {
        switch (component.type) {
            case 'BODY':
                descriptors.push(...parseBodyInputs(component));
                break;
            case 'HEADER':
                descriptors.push(...parseHeaderInputs(component));
                break;
            case 'BUTTONS':
                descriptors.push(...parseButtonInputs(component));
                break;
            default:
                break;
        }
    }

    return descriptors;
}

function parseBodyInputs(component: TemplateComponent): InputDescriptor[] {
    if (!component.text) return [];
    const indices = extractPlaceholders(component.text);
    return indices.map((idx) => ({
        id: `body_var_${idx}`,
        componentType: 'BODY',
        kind: 'TEXT_VAR',
        placeholderIndex: idx,
        label: `Variable del cuerpo {{${idx}}}`,
        required: true,
        meta: { originalText: component.text },
    }));
}

function parseHeaderInputs(component: TemplateComponent): InputDescriptor[] {
    const format = component.format ?? 'NONE';

    // Header media: IMAGE, VIDEO, DOCUMENT → 1 descriptor de tipo MEDIA
    if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(format)) {
        return [{
            id: 'header_media',
            componentType: 'HEADER',
            kind: 'MEDIA',
            placeholderIndex: null,
            label: `Adjunto de encabezado (${format.toLowerCase()})`,
            required: true,
            meta: { format },
        }];
    }

    // Header texto con placeholders
    if (format === 'TEXT' && component.text) {
        const indices = extractPlaceholders(component.text);
        return indices.map((idx) => ({
            id: `header_var_${idx}`,
            componentType: 'HEADER',
            kind: 'TEXT_VAR',
            placeholderIndex: idx,
            label: `Variable del encabezado {{${idx}}}`,
            required: true,
            meta: { originalText: component.text },
        }));
    }

    return [];
}

function parseButtonInputs(component: TemplateComponent): InputDescriptor[] {
    if (!component.buttons) return [];
    const descriptors: InputDescriptor[] = [];

    component.buttons.forEach((btn, btnIndex) => {
        if (btn.type === 'URL' && btn.url) {
            const indices = extractPlaceholders(btn.url);
            indices.forEach((idx) => {
                descriptors.push({
                    id: `button_url_${btnIndex}_var_${idx}`,
                    componentType: 'BUTTON',
                    kind: 'URL_VAR',
                    placeholderIndex: idx,
                    label: `URL dinámica del botón "${btn.text || btnIndex}" {{${idx}}}`,
                    required: true,
                    meta: { buttonIndex: btnIndex, buttonText: btn.text, originalUrl: btn.url },
                });
            });
        }
    });

    return descriptors;
}

// ─── Validación de un mapping completo ───────────────────────────────────────

export interface MappingValidationResult {
    valid: boolean;
    missingRequired: string[];   // ids de descriptors required sin mapping
    unknownKeys: string[];       // keys del mapping que no corresponden a descriptor
    invalidContactFields: string[]; // contact_field con valores no permitidos
    exceedsMaxLength: string[];  // ids que exceden el max length por var (def 1024)
}

/**
 * Valida que un mapping sea completo y seguro para los inputs de un template.
 * Usado tanto en frontend (prevalidar) como en backend (server-side).
 */
export function validateMapping(
    template: Template,
    mapping: TemplateInputMapping | null | undefined
): MappingValidationResult {
    const descriptors = getTemplateInputs(template);
    const descriptorIds = new Set(descriptors.map((d) => d.id));
    const mappingKeys = Object.keys(mapping ?? {});

    const missingRequired = descriptors
        .filter((d) => d.required && !(mapping && mapping[d.id]?.value?.trim()))
        .map((d) => d.id);

    const unknownKeys = mappingKeys.filter((k) => !descriptorIds.has(k));

    const invalidContactFields = mappingKeys.filter((k) => {
        const entry = mapping?.[k];
        return (
            entry?.mode === 'contact_field' &&
            !ALLOWED_CONTACT_FIELDS.includes(entry.value)
        );
    });

    const exceedsMaxLength = descriptors.filter((d) => {
        const entry = mapping?.[d.id];
        if (entry?.mode === 'fixed' && entry.value) {
            const max = d.maxLength ?? 1024;
            return entry.value.length > max;
        }
        return false;
    }).map(d => d.id);

    return {
        valid: missingRequired.length === 0 && unknownKeys.length === 0 && invalidContactFields.length === 0 && exceedsMaxLength.length === 0,
        missingRequired,
        unknownKeys,
        invalidContactFields,
        exceedsMaxLength,
    };
}
