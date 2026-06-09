import { AuditSeverity } from '../types/globalAudit.types';

const SPECIAL_EVENT_LABELS: Record<string, string> = {
    'auth.login_success': 'Inicio de sesión exitoso',
    'auth.login_failed': 'Intento de inicio de sesión fallido',
    'auth.logout': 'Cierre de sesión',
    'auth.impersonate_tenant': 'Inicio de suplantación de organización',
    'auth.stop_impersonation': 'Fin de suplantación',
    'auth.password_reset_requested': 'Solicitud de restablecimiento de contraseña',
    'auth.password_reset_completed': 'Restablecimiento de contraseña completado',
    'inbox.take': 'Conversación tomada',
    'inbox.resume_ai': 'IA reanudada en conversación',
    'inbox.pause_ai': 'IA pausada en conversación',
    'inbox.reply_sent': 'Respuesta enviada',
    'inbox.thread_closed': 'Conversación cerrada',
    'org.member_invited': 'Miembro invitado',
    'org.member_removed': 'Miembro removido',
    'org.member_role_updated': 'Rol de miembro actualizado',
    'billing.plan_created': 'Plan comercial creado',
    'billing.plan_updated': 'Plan comercial actualizado',
    'billing.plan_deleted': 'Plan comercial eliminado',
    'billing.plan_restored': 'Plan comercial restaurado',
    'billing.subscription_updated': 'Suscripción actualizada',
};

const EVENT_PART_TRANSLATIONS: Record<string, string> = {
    auth: 'Seguridad',
    inbox: 'Bandeja',
    org: 'Organización',
    billing: 'Facturación',
    super: 'Super',
    admin: 'administración',
    login: 'inicio de sesión',
    logout: 'cierre de sesión',
    failed: 'fallido',
    success: 'exitoso',
    impersonate: 'suplantación',
    impersonation: 'suplantación',
    tenant: 'organización',
    stop: 'fin',
    take: 'toma',
    reply: 'respuesta',
    sent: 'enviada',
    resume: 'reanudar',
    pause: 'pausar',
    ai: 'IA',
    thread: 'conversación',
    closed: 'cerrada',
    member: 'miembro',
    invited: 'invitado',
    removed: 'removido',
    role: 'rol',
    updated: 'actualizado',
    created: 'creado',
    deleted: 'eliminado',
    restored: 'restaurado',
    requested: 'solicitud',
    completed: 'completado',
    password: 'contraseña',
    reset: 'restablecimiento',
    subscription: 'suscripción',
    plan: 'plan',
};

const ROLE_LABELS: Record<string, string> = {
    super_admin: 'Superadministrador',
    admin: 'Administrador',
    agent: 'Agente',
    user: 'Usuario',
    system: 'Sistema',
    unknown: 'Desconocido',
};

const TARGET_TYPE_LABELS: Record<string, string> = {
    tenant: 'Organización',
    organization: 'Organización',
    user: 'Usuario',
    plan: 'Plan',
    subscription: 'Suscripción',
    thread: 'Conversación',
    contact: 'Contacto',
    channel: 'Canal',
    widget: 'Widget',
    template: 'Plantilla',
    campaign: 'Campaña',
    system: 'Sistema',
    unknown: 'Desconocido',
};

const toSentenceCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export const getAuditSeverityLabel = (severity: AuditSeverity) => {
    switch (severity) {
        case 'critical':
            return 'Crítico';
        case 'warning':
            return 'Advertencia';
        case 'success':
            return 'Éxito';
        default:
            return 'Información';
    }
};

export const getAuditRoleLabel = (role?: string | null) => {
    if (!role) return 'No disponible';
    return ROLE_LABELS[role.toLowerCase()] || toSentenceCase(role.replace(/[_-]/g, ' '));
};

export const getAuditTargetTypeLabel = (targetType?: string | null) => {
    if (!targetType) return 'No disponible';
    return TARGET_TYPE_LABELS[targetType.toLowerCase()] || toSentenceCase(targetType.replace(/[_-]/g, ' '));
};

export const getAuditEventLabel = (eventType: string) => {
    if (SPECIAL_EVENT_LABELS[eventType]) {
        return SPECIAL_EVENT_LABELS[eventType];
    }

    const translated = eventType
        .split(/[._]/g)
        .map((part) => EVENT_PART_TRANSLATIONS[part.toLowerCase()] || part.replace(/-/g, ' '))
        .join(' · ');

    return toSentenceCase(translated);
};
