import { driver, type DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';

export type ModuleKey =
    | 'inbox'
    | 'contacts'
    | 'campaigns'
    | 'templates'
    | 'ai-profiles'
    | 'channels'
    | 'segments'
    | 'widgets'
    | 'audit'
    | 'automations';

interface ModuleTour {
    title: string;
    steps: DriveStep[];
}

const TOURS: Record<ModuleKey, ModuleTour> = {
    inbox: {
        title: 'Tour del Inbox',
        steps: [
            {
                element: '[data-tour="inbox-channels"]',
                popover: {
                    title: '1. Canal activo',
                    description: 'Cada botón es un número de WhatsApp conectado. Selecciona el canal que quieres gestionar para ver sus conversaciones.',
                    side: 'right',
                    align: 'center',
                },
            },
            {
                element: '[data-tour="inbox-search"]',
                popover: {
                    title: '2. Buscar conversaciones',
                    description: 'Escribe un nombre, teléfono o texto de un mensaje para encontrar cualquier conversación de forma inmediata.',
                    side: 'bottom',
                    align: 'start',
                },
            },
            {
                element: '[data-tour="inbox-filters"]',
                popover: {
                    title: '3. Filtros rápidos',
                    description: '<b>Todos</b> muestra todo. <b>IA activa</b> son chats donde un perfil de IA está respondiendo. <b>Para mí</b> filtra las asignadas a tu usuario.',
                    side: 'bottom',
                    align: 'start',
                },
            },
            {
                element: '[data-tour="inbox-threads"]',
                popover: {
                    title: '4. Lista de conversaciones',
                    description: 'Haz clic en cualquier chat para abrirlo. El número amarillo indica mensajes sin leer. El badge <b>IA</b> indica que el agente de IA está activo en ese chat.',
                    side: 'right',
                    align: 'center',
                },
            },
            {
                element: '[data-tour="inbox-actions"]',
                popover: {
                    title: '5. Acciones del chat',
                    description: '<b>Tomar chat</b> te asigna la conversación. <b>Reasignar</b> la transfiere a otro agente del equipo. <b>Liberar</b> la deja disponible para quien la tome.',
                    side: 'bottom',
                    align: 'start',
                },
            },
        ],
    },

    contacts: {
        title: 'Tour de Contactos',
        steps: [
            {
                element: '[data-tour="contacts-create"]',
                popover: {
                    title: '1. Crear contacto',
                    description: 'Agrega un nuevo contacto manualmente. Puedes guardar nombre, teléfono, empresa, etapa del ciclo de vida y notas internas.',
                    side: 'bottom',
                    align: 'end',
                },
            },
            {
                element: '[data-tour="contacts-import"]',
                popover: {
                    title: '2. Importar desde CSV',
                    description: 'Sube una hoja de cálculo para cargar contactos en lote. Descarga la plantilla de ejemplo para ver el formato correcto antes de importar.',
                    side: 'bottom',
                    align: 'end',
                },
            },
            {
                element: '[data-tour="contacts-search"]',
                popover: {
                    title: '3. Buscar y filtrar',
                    description: 'Busca por nombre o teléfono. El selector de estado filtra por etapa del ciclo de vida: prospecto, cliente activo, inactivo, etc.',
                    side: 'bottom',
                    align: 'start',
                },
            },
            {
                element: '[data-tour="contacts-table"]',
                popover: {
                    title: '4. Lista de contactos',
                    description: 'El ícono de <b>WhatsApp</b> abre directamente el chat con ese contacto. El ícono de <b>ojo</b> abre el perfil completo con historial, notas y datos de contacto.',
                    side: 'top',
                    align: 'center',
                },
            },
        ],
    },

    campaigns: {
        title: 'Tour de Campañas',
        steps: [
            {
                element: '[data-tour="campaigns-create"]',
                popover: {
                    title: '1. Nueva campaña',
                    description: 'Crea una campaña masiva de WhatsApp. Selecciona una plantilla aprobada por Meta, elige el segmento de contactos y programa la fecha y hora de envío.',
                    side: 'bottom',
                    align: 'end',
                },
            },
            {
                element: '[data-tour="campaigns-search"]',
                popover: {
                    title: '2. Buscar campaña',
                    description: 'Filtra por nombre para encontrar rápidamente cualquier campaña existente, sin importar su estado.',
                    side: 'bottom',
                    align: 'start',
                },
            },
            {
                element: '[data-tour="campaigns-list"]',
                popover: {
                    title: '3. Estado y acciones',
                    description: '<b>BORRADOR</b>: en edición. <b>PROGRAMADA</b>: enviará a la hora indicada. <b>EN PROGRESO</b>: enviando ahora. Usa los botones de cada tarjeta para iniciar, pausar o ver analíticas.',
                    side: 'top',
                    align: 'center',
                },
            },
        ],
    },

    templates: {
        title: 'Tour de Plantillas',
        steps: [
            {
                element: '[data-tour="templates-import"]',
                popover: {
                    title: '1. Importar desde Meta',
                    description: 'Sincroniza las plantillas ya aprobadas en tu cuenta de Meta Business. <b>Solo plantillas APROBADAS</b> pueden usarse en campañas masivas.',
                    side: 'bottom',
                    align: 'end',
                },
            },
            {
                element: '[data-tour="templates-filters"]',
                popover: {
                    title: '2. Filtros de plantillas',
                    description: 'Filtra por estado (<b>APROBADA / PENDIENTE / RECHAZADA</b>), categoría (<b>MARKETING / UTILIDAD / AUTENTICACIÓN</b>) o busca por nombre de la plantilla.',
                    side: 'bottom',
                    align: 'start',
                },
            },
            {
                element: '[data-tour="templates-table"]',
                popover: {
                    title: '3. Lista de plantillas',
                    description: 'Cada fila muestra el estado de aprobación de Meta. Las plantillas <b>RECHAZADAS</b> necesitan corregirse directamente en Meta Business Manager.',
                    side: 'top',
                    align: 'center',
                },
            },
        ],
    },

    'ai-profiles': {
        title: 'Tour de Perfiles IA',
        steps: [
            {
                element: '[data-tour="ai-profiles-create"]',
                popover: {
                    title: '1. Crear perfil de IA',
                    description: 'Un perfil IA es un agente virtual que responde automáticamente a conversaciones. Define su nombre, personalidad e instrucciones de comportamiento.',
                    side: 'bottom',
                    align: 'end',
                },
            },
            {
                element: '[data-tour="ai-profiles-list"]',
                popover: {
                    title: '2. Perfiles activos',
                    description: 'Cada perfil puede asignarse a uno o más canales. Activa o desactiva el perfil con el toggle. Edita sus instrucciones cuando necesites ajustar el comportamiento.',
                    side: 'top',
                    align: 'center',
                },
            },
        ],
    },

    channels: {
        title: 'Tour de Canales',
        steps: [
            {
                element: '[data-tour="channels-create"]',
                popover: {
                    title: '1. Conectar canal',
                    description: 'Vincula un número de WhatsApp Business a través de la API de Meta. Necesitas un número activo en Meta Business Manager con la API habilitada.',
                    side: 'bottom',
                    align: 'end',
                },
            },
            {
                element: '[data-tour="channels-list"]',
                popover: {
                    title: '2. Estado del canal',
                    description: '<b>Conectado</b>: los mensajes fluyen con normalidad. <b>Desconectado</b>: requiere re-autenticación en Meta. El indicador verde en tiempo real muestra el estado actual.',
                    side: 'top',
                    align: 'center',
                },
            },
        ],
    },

    segments: {
        title: 'Tour de Segmentos',
        steps: [
            {
                element: '[data-tour="segments-create"]',
                popover: {
                    title: '1. Crear segmento',
                    description: 'Un segmento es un grupo de contactos filtrado por condiciones específicas (etiquetas, etapa, ubicación, etc.). Úsalos para enviar campañas solo a contactos relevantes.',
                    side: 'bottom',
                    align: 'end',
                },
            },
            {
                element: '[data-tour="segments-list"]',
                popover: {
                    title: '2. Lista de segmentos',
                    description: 'Cada segmento muestra cuántos contactos lo componen. Haz clic en uno para editarlo o usarlo directamente al crear una nueva campaña.',
                    side: 'top',
                    align: 'center',
                },
            },
        ],
    },

    widgets: {
        title: 'Tour de Web Widgets',
        steps: [
            {
                element: '[data-tour="widgets-tabs"]',
                popover: {
                    title: '1. Pestañas del configurador',
                    description: '<b>Contenido</b>: nombre, bienvenida y mensajes. <b>Diseño</b>: colores y posición del botón. <b>IA</b>: conecta un perfil de agente virtual. <b>Instalación</b>: obtén el código para tu sitio web.',
                    side: 'bottom',
                    align: 'start',
                },
            },
            {
                element: '[data-tour="widgets-preview"]',
                popover: {
                    title: '2. Vista previa en tiempo real',
                    description: 'Cada cambio que hagas en las pestañas se refleja aquí de forma instantánea. Así puedes ver exactamente cómo lucirá el widget en tu sitio antes de publicarlo.',
                    side: 'left',
                    align: 'center',
                },
            },
        ],
    },

    audit: {
        title: 'Tour de Auditoría',
        steps: [
            {
                element: '[data-tour="audit-filters"]',
                popover: {
                    title: '1. Filtrar registros',
                    description: 'Filtra por usuario, módulo o rango de fechas para encontrar cualquier acción registrada en la plataforma.',
                    side: 'bottom',
                    align: 'start',
                },
            },
            {
                element: '[data-tour="audit-table"]',
                popover: {
                    title: '2. Registro de acciones',
                    description: 'Cada fila muestra quién hizo qué y cuándo. Útil para supervisar cambios, detectar errores o hacer seguimiento de las actividades del equipo.',
                    side: 'top',
                    align: 'center',
                },
            },
        ],
    },

    automations: {
        title: 'Tour de Automatizaciones',
        steps: [
            {
                element: '[data-tour="automations-create"]',
                popover: {
                    title: '1. Nueva automatización',
                    description: 'Crea un flujo automático que se activa ante un evento (nuevo mensaje, contacto creado, etc.) y ejecuta acciones como responder, asignar o etiquetar.',
                    side: 'bottom',
                    align: 'end',
                },
            },
            {
                element: '[data-tour="automations-list"]',
                popover: {
                    title: '2. Flujos activos',
                    description: 'Activa o desactiva cada automatización con el toggle. Haz clic en <b>Editar</b> para modificar sus condiciones o acciones en el constructor visual.',
                    side: 'top',
                    align: 'center',
                },
            },
        ],
    },
};

export function startModuleTour(moduleKey: ModuleKey): void {
    const tour = TOURS[moduleKey];
    if (!tour) return;

    const validSteps = tour.steps.filter((step) => {
        if (!step.element) return true;
        return !!document.querySelector(step.element as string);
    });

    if (validSteps.length === 0) return;

    const d = driver({
        animate: true,
        smoothScroll: true,
        allowClose: true,
        overlayClickBehavior: 'close',
        stagePadding: 10,
        stageRadius: 14,
        showProgress: true,
        popoverClass: 'wabee-tour-popover',
        progressText: 'Paso {{current}} de {{total}}',
        nextBtnText: 'Siguiente →',
        prevBtnText: '← Anterior',
        doneBtnText: '✓ Entendido',
        steps: validSteps,
    });

    d.drive();
}
