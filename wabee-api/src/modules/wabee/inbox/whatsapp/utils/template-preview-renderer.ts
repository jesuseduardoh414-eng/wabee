/**
 * Renderiza el texto de una plantilla de WhatsApp para previsualización en el Inbox.
 * Reemplaza variables {{N}} con los valores del mapping, resolviendo:
 * - 'fixed': valor fijo directo
 * - 'fixed_media': valor fijo o fallback textual
 * - 'contact_field': accede al campo del contacto (name, phone, email)
 */
export function renderTemplatePreviewText(
    template: { components: any[] },
    mapping?: Record<string, any> | null,
    contact?: { name?: string; phone?: string; email?: string } | null,
    resolvedMediaUrl?: string | null
): {
    headerText?: string | null;
    headerMedia?: { kind: 'IMAGE' | 'VIDEO' | 'DOCUMENT'; url: string; mediaFileId?: string } | null;
    bodyText: string;
    footerText?: string | null;
    buttons?: Array<{ type: 'QUICK_REPLY' | 'URL' | 'PHONE'; text: string; url?: string; phone?: string }>;
} {
    let bodyText = '';
    let headerText: string | null = null;
    let footerText: string | null = null;
    let headerMedia: { kind: 'IMAGE' | 'VIDEO' | 'DOCUMENT'; url: string; mediaFileId?: string } | null = null;
    const buttons: Array<{ type: 'QUICK_REPLY' | 'URL' | 'PHONE'; text: string; url?: string; phone?: string }> = [];

    const components = Array.isArray(template.components) ? template.components : [];

    for (const comp of components) {
        if (comp.type === 'BODY' && comp.text) {
            bodyText = replacePlaceholders(comp.text, mapping, 'body_var_', contact);
        } else if (comp.type === 'HEADER') {
            if (comp.format === 'TEXT' && comp.text) {
                headerText = replacePlaceholders(comp.text, mapping, 'header_var_', contact);
            } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(comp.format)) {
                // Resolve headerMedia URL from resolvedMediaUrl or from mapping
                const mappingKey = 'header_media_1';
                const mappingEntry = mapping?.[mappingKey];
                const mediaFileId = (mappingEntry?.mode === 'fixed_media' && typeof mappingEntry?.value === 'string')
                    ? mappingEntry.value
                    : undefined;

                if (resolvedMediaUrl) {
                    headerMedia = {
                        kind: comp.format as 'IMAGE' | 'VIDEO' | 'DOCUMENT',
                        url: resolvedMediaUrl,
                        ...(mediaFileId ? { mediaFileId } : {})
                    };
                }
            }
        } else if (comp.type === 'FOOTER' && comp.text) {
            footerText = comp.text;
        } else if (comp.type === 'BUTTONS' && Array.isArray(comp.buttons)) {
            comp.buttons.forEach((btn: any, btnIndex: number) => {
                if (btn.type === 'QUICK_REPLY') {
                    buttons.push({ type: 'QUICK_REPLY', text: btn.text });
                } else if (btn.type === 'URL') {
                    let urlText = btn.url || '';
                    if (urlText.includes('{{')) {
                        urlText = replacePlaceholders(urlText, mapping, `button_url_${btnIndex}_var_`, contact);
                    }
                    buttons.push({ type: 'URL', text: btn.text, url: urlText });
                } else if (btn.type === 'PHONE_NUMBER') {
                    buttons.push({ type: 'PHONE', text: btn.text, phone: btn.phone_number });
                }
            });
        }
    }

    return { headerText, headerMedia, bodyText, footerText, ...(buttons.length > 0 ? { buttons } : {}) };
}

/**
 * Reemplaza {{N}} con el valor correspondiente en el mapping.
 * Soporta modos: fixed, fixed_media, contact_field.
 */
function replacePlaceholders(
    text: string,
    mapping: Record<string, any> | null | undefined,
    mappingKeyPrefix: string,
    contact?: { name?: string; phone?: string; email?: string } | null
): string {
    if (!text) return '';

    return text.replace(/\{\{(\d+)\}\}/g, (match, p1) => {
        const key = `${mappingKeyPrefix}${p1}`;
        const entry = mapping?.[key];

        if (!entry) return match; // Sin mapping → mantener placeholder original

        if (entry.mode === 'fixed') {
            return entry.value || entry.fallback || match;
        }

        if (entry.mode === 'fixed_media') {
            return entry.value || entry.fallback || '[MEDIA]';
        }

        if (entry.mode === 'contact_field') {
            let resolved: string | undefined | null;
            if (contact) {
                switch (entry.value) {
                    case 'contact.name': resolved = contact.name; break;
                    case 'contact.phone': resolved = contact.phone; break;
                    case 'contact.email': resolved = contact.email; break;
                    default: resolved = undefined;
                }
            }
            return resolved || entry.fallback || `⟪{{${p1}}}⟫`;
        }

        return entry.fallback || `⟪{{${p1}}}⟫`;
    });
}
