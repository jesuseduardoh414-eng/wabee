export const DEFAULT_EMAIL_GLOBAL = {
    identidad: {
        brandName: 'WABEE',
        senderName: 'Notificaciones WABEE',
        supportEmail: 'soporte@wabee.app',
        brandLogo: '',
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

const ALL_DEFAULT_EMAIL_TEMPLATES = [
    {
        id: '1',
        code: 'VERIFY_EMAIL',
        name: 'Verificación de Correo',
        category: 'Autenticación',
        status: 'published',
        subject: 'Verifica tu dirección de correo electrónico - {{org_name}}',
        title: '¡Bienvenido/a a bordo, {{user_name}}!',
        body: 'Gracias por unirte a {{org_name}}. Antes de comenzar, necesitamos que confirmes tu dirección de correo electrónico haciendo clic en el botón de abajo.',
        cta: 'Verificar cuenta',
        footer: 'Si no creaste esta cuenta, puedes ignorar este mensaje.'
    },
    {
        id: '2',
        code: 'PASSWORD_RESET',
        name: 'Restablecer Contraseña',
        category: 'Seguridad',
        status: 'published',
        subject: 'Restablecer contraseña - {{org_name}}',
        title: '¿Olvidaste tu contraseña?',
        body: 'No te preocupes, recibimos una solicitud para restablecer tu contraseña. Haz clic abajo para elegir una nueva.',
        cta: 'Restablecer ahora',
        footer: 'Este enlace caducará en 24 horas por motivos de seguridad.'
    },
    {
        id: '3',
        code: 'PASSWORD_CHANGED',
        name: 'Contraseña Actualizada',
        category: 'Seguridad',
        status: 'published',
        subject: 'Tu contraseña fue actualizada - {{org_name}}',
        title: 'Contraseña cambiada con éxito',
        body: 'La contraseña de tu cuenta en {{org_name}} ha sido actualizada. Si no realizaste este cambio, por favor contacta a soporte de inmediato.',
        cta: 'Ir a mi cuenta',
        footer: 'Si fuiste tú, no es necesario realizar ninguna acción.'
    },
    {
        id: '4',
        code: 'NEW_DEVICE_LOGIN',
        name: 'Nuevo Inicio de Sesión',
        category: 'Seguridad',
        status: 'published',
        subject: 'Alerta de Seguridad: Nuevo inicio de sesión',
        title: 'Detectamos un nuevo acceso',
        body: 'Se detectó un inicio de sesión desde un nuevo dispositivo o navegador: {{location}} (IP: {{ip_address}}). Queremos asegurarnos de que fuiste tú.',
        cta: 'Ver detalles',
        footer: 'Si reconoces este acceso, puedes ignorar este mensaje.'
    },
    {
        id: '5',
        code: 'ACCOUNT_LOCKED',
        name: 'Cuenta Bloqueada',
        category: 'Seguridad',
        status: 'published',
        subject: 'Cuenta bloqueada temporalmente - {{org_name}}',
        title: 'Acceso restringido temporalmente',
        body: 'Tu cuenta ha sido bloqueada por seguridad tras múltiples intentos fallidos de inicio de sesión. Por favor, desbloquéala usando el siguiente enlace.',
        cta: 'Desbloquear cuenta',
        footer: 'Te recomendamos activar la autenticación de dos factores (2FA).'
    },
    {
        id: '6',
        code: 'WELCOME_EMAIL',
        name: 'Bienvenida',
        category: 'Engagement',
        status: 'published',
        subject: '¡Te damos la bienvenida a {{org_name}}!',
        title: '¡Es un gusto tenerte aquí!',
        body: 'Gracias por registrarte en nuestra plataforma. Comienza a gestionar tus canales y optimizar tus flujos de trabajo hoy mismo.',
        cta: 'Empezar ahora',
        footer: 'Estamos aquí para ayudarte a crecer.'
    },
    {
        id: '7',
        code: 'SUBSCRIPTION_ACTIVE',
        name: 'Pago Exitoso',
        category: 'Facturación',
        status: 'published',
        subject: 'Recibo de suscripción - {{org_name}}',
        title: '¡Gracias por tu pago!',
        body: 'Hemos procesado con éxito tu pago mensual. Tu suscripción a {{plan_name}} se encuentra activa y vigente.',
        cta: 'Ver mi factura',
        footer: 'Tu suscripción se renovará automáticamente el {{renewal_date}}.'
    },
    {
        id: '8',
        code: 'PAYMENT_FAILED',
        name: 'Error en el Pago',
        category: 'Facturación',
        status: 'published',
        subject: 'No pudimos procesar tu pago - {{org_name}}',
        title: 'Acción requerida: Error en el cobro',
        body: 'No pudimos procesar el cobro de tu suscripción mensual. Por favor, revisa y actualiza tu método de pago para evitar interrupciones en el servicio.',
        cta: 'Actualizar método de pago',
        footer: 'Tienes un periodo de gracia para regularizar tu saldo.'
    },
    {
        id: '9',
        code: 'PLAN_CHANGED',
        name: 'Plan Actualizado',
        category: 'Facturación',
        status: 'published',
        subject: 'Tu plan fue actualizado - {{org_name}}',
        title: 'Confirmación de cambio de plan',
        body: 'Tu plan estratégico en {{org_name}} ha sido actualizado a {{plan_name}}. Los nuevos límites y beneficios ya están disponibles.',
        cta: 'Ver beneficios actualizados',
        footer: 'Los ajustes se verán reflejados en tu próximo ciclo de facturación.'
    },
    {
        id: '10',
        code: 'RENEWAL_REMINDER',
        name: 'Aviso de Renovación',
        category: 'Facturación',
        status: 'published',
        subject: 'Tu plan se renovará pronto - {{org_name}}',
        title: 'Recordatorio de renovación',
        body: 'Te recordamos que tu suscripción se renovará automáticamente el próximo {{renewal_date}}. Asegúrate de tener saldo disponible.',
        cta: 'Gestionar mi suscripción',
        footer: 'Puedes gestionar o cancelar tu plan desde el panel de facturación en cualquier momento.'
    },
    {
        id: '11',
        code: 'PRODUCT_UPDATES',
        name: 'Novedades de Producto',
        category: 'Engagement',
        status: 'published',
        subject: 'Novedades en {{org_name}}: {{release_title}}',
        title: '¡Mira lo que lanzamos para ti!',
        body: 'Acabamos de publicar una nueva versión con funcionalidades increíbles recopiladas de tus comentarios. Descubre todo lo nuevo aquí.',
        cta: 'Ver novedades',
        footer: 'Encuentra las notas completas en nuestro blog oficial.'
    },
    {
        id: '12',
        code: 'WINBACK',
        name: 'Reactivación',
        category: 'Engagement',
        status: 'published',
        subject: 'Te extrañamos en {{org_name}}',
        title: '¿Hola? Hace tiempo no te vemos',
        body: 'Notamos que no has ingresado a la plataforma últimamente. Tenemos nuevas funciones que te encantarán, ¡vuelve hoy mismo!',
        cta: 'Regresar ahora',
        footer: 'Consulta nuestros nuevos tutoriales para sacar el máximo provecho.'
    },
    {
        id: '13',
        code: 'ORG_INVITATION',
        name: 'Invitación a Equipo',
        category: 'Sistema',
        status: 'published',
        subject: 'Invitación para colaborar en {{org_name}}',
        title: '¡Te han invitado a trabajar!',
        body: '{{inviter_name}} te ha enviado una invitación para unirte a su equipo de trabajo en la organización {{org_name}}. ¡Acepta para empezar a colaborar!',
        cta: 'Aceptar invitación',
        footer: 'Este enlace de invitación expirará pronto.'
    },
    {
        id: '14',
        code: 'STORAGE_THRESHOLD',
        name: 'Alerta de Almacenamiento',
        category: 'Sistema',
        status: 'published',
        subject: '⚠️ Alerta: Almacenamiento al {{percentage}}%',
        title: 'Capacidad de almacenamiento baja',
        body: 'Tu espacio de almacenamiento está por alcanzar su límite ({{percentage}}%). Te recomendamos gestionar tus archivos para evitar pérdida de datos.',
        cta: 'Gestionar espacio',
        footer: 'Tu capacidad total es de {{total_gb}} GB.'
    }
    ,
    {
        id: 'data-deletion-confirmation-tpl',
        code: 'DATA_DELETION_CONFIRMATION',
        name: 'ConfirmaciÃ³n de EliminaciÃ³n de Datos',
        category: 'Seguridad',
        status: 'published',
        subject: 'ConfirmaciÃ³n de solicitud de eliminaciÃ³n de informaciÃ³n - WABEE',
        title: 'ConfirmaciÃ³n de Solicitud',
        body: '<p>Hola {{fullName}},</p><p>Hemos recibido una solicitud para eliminar la informaciÃ³n de su organizaciÃ³n asociada a este contacto.</p><p>Por seguridad, le informamos que el administrador ya tiene esta solicitud <b>En RevisiÃ³n</b>. Una vez completada, todos los datos personales del contacto serÃ¡n anonimizados permanentemente.</p><p>Si usted no realizÃ³ esta solicitud, por favor contÃ¡ctenos de inmediato.</p>',
        cta: 'Ir al Formulario',
        footer: 'Equipo de Soporte WABEE'
    }
];

export const SUPPORTED_EMAIL_TEMPLATE_CODES = [
    'VERIFY_EMAIL',
    'PASSWORD_RESET',
    'ORG_INVITATION',
    'DATA_DELETION_CONFIRMATION'
] as const;

export const DEFAULT_EMAIL_TEMPLATES = ALL_DEFAULT_EMAIL_TEMPLATES.filter((template) =>
    SUPPORTED_EMAIL_TEMPLATE_CODES.includes(template.code as (typeof SUPPORTED_EMAIL_TEMPLATE_CODES)[number])
);
