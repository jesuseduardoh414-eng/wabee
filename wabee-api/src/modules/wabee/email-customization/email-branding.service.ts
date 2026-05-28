import { corePrisma } from '../../../config/core/core.prisma';

const EMAIL_GLOBAL_KEY = 'email_customization_global';

export interface EmailGlobalConfig {
    identidad: {
        brandName: string;
        senderName: string;
        supportEmail: string;
        brandLogo?: string | null;
        globalFooter: string;
    };
    layout: {
        bg: string;
        card: string;
        border: string;
        buttonBg: string;
        buttonText?: string;
        subjectLabel: string;
    };
    texts: {
        title: { color: string; font: string };
        subtitle?: { color: string; font: string };
        paragraph: { color: string; font: string };
        button: { color: string; font: string };
        footer: { color: string; font: string };
    };
}

const DEFAULT_EMAIL_GLOBAL: EmailGlobalConfig = {
    identidad: {
        brandName: 'WABEE',
        senderName: 'Notificaciones WABEE',
        supportEmail: 'soporte@wabee.app',
        globalFooter: '© {{current_year}} WABEE. Todos los derechos reservados.'
    },
    layout: {
        bg: '#F8FAFC',
        card: '#FFFFFF',
        border: '#E2E8F0',
        buttonBg: '#2563EB',
        buttonText: '#FFFFFF',
        subjectLabel: '#64748B'
    },
    texts: {
        title: { color: '#0F172A', font: 'Inter' },
        paragraph: { color: '#334155', font: 'Inter' },
        button: { color: '#FFFFFF', font: 'Inter' },
        footer: { color: '#64748B', font: 'Inter' }
    }
};

export class EmailBrandingService {
    /**
     * Obtiene la configuración de branding global de correos.
     * Consulta directamente a la base de datos en cada petición para asegurar
     * que los cambios se reflejen en tiempo real (Requisito 11).
     */
    static async getGlobalConfiguration(): Promise<EmailGlobalConfig> {
        const setting = await corePrisma.systemSetting.findUnique({
            where: { key: EMAIL_GLOBAL_KEY }
        }).catch(() => null);

        if (!setting || !setting.value) {
            return DEFAULT_EMAIL_GLOBAL;
        }

        const customConfig = setting.value as unknown as EmailGlobalConfig;
        
        // Merge profundo para asegurar que existan todas las propiedades esenciales
        // Si falta algo en la base de datos, usamos los defaults
        return {
            identidad: { ...DEFAULT_EMAIL_GLOBAL.identidad, ...(customConfig.identidad || {}) },
            layout: { ...DEFAULT_EMAIL_GLOBAL.layout, ...(customConfig.layout || {}) },
            texts: { 
                ...DEFAULT_EMAIL_GLOBAL.texts, 
                ...(customConfig.texts || {})
            },
        };
    }
}
