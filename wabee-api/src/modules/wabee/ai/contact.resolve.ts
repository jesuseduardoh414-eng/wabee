import { WebWidget } from '@prisma/client';

export type ContactInfo = {
    whatsapp?: string;
    phone?: string;
    email?: string;
    website?: string;
};

/**
 * Extracts and normalizes contact information from a WebWidget.
 * Looks into widget.ai for keys like contact, contacts, escalation, etc.
 */
export function resolveWidgetContact(widget: WebWidget): ContactInfo {
    const ai = (widget.ai as any) || {};

    // Potential source objects
    const sources = [
        ai.contact,
        ai.contacts,
        ai.escalation,
        ai.channels,
        ai // Also check root level of ai
    ];

    const result: ContactInfo = {};

    for (const source of sources) {
        if (!source || typeof source !== 'object') continue;

        // Normalization Map
        const normalized = {
            whatsapp: ['whatsapp', 'wa', 'whatsApp', 'whatsapp_number'],
            phone: ['phone', 'tel', 'telefono', 'teléfono', 'phone_number'],
            email: ['email', 'mail', 'correo', 'support_email'],
            website: ['website', 'web', 'url', 'site', 'link']
        };

        // Try to find values for each type
        if (!result.whatsapp) result.whatsapp = findValue(source, normalized.whatsapp);
        if (!result.phone) result.phone = findValue(source, normalized.phone);
        if (!result.email) result.email = findValue(source, normalized.email);
        if (!result.website) result.website = findValue(source, normalized.website);
    }

    return result;
}

function findValue(obj: any, keys: string[]): string | undefined {
    for (const key of keys) {
        if (obj[key] && typeof obj[key] === 'string') {
            const val = obj[key].trim();
            if (val) return val;
        }
    }
    return undefined;
}
