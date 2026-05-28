import { ContactInfo } from './contact.resolve';

export type renderedContact = {
    channel: 'WHATSAPP' | 'PHONE' | 'EMAIL' | 'WEBSITE' | 'NONE';
    text: string;
};

/**
 * Renders a contact line based on prioritized availability.
 * Priority: WhatsApp > Phone > Email > Website.
 */
export function renderContactLine(c: ContactInfo): renderedContact {
    if (c.whatsapp) {
        return { channel: 'WHATSAPP', text: `WhatsApp: ${c.whatsapp}` };
    }
    if (c.phone) {
        return { channel: 'PHONE', text: `Teléfono: ${c.phone}` };
    }
    if (c.email) {
        return { channel: 'EMAIL', text: `Correo: ${c.email}` };
    }
    if (c.website) {
        return { channel: 'WEBSITE', text: `Sitio web: ${c.website}` };
    }

    return { channel: 'NONE', text: 'atención al cliente' };
}
