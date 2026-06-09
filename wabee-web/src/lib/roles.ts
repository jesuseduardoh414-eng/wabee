/**
 * Rol GLOBAL que identifica a un Super Admin de plataforma (controla toda la web).
 * Es distinto del rol `admin`, que es el Administrador a nivel de organización.
 */
export const SUPER_ADMIN_ROLE = 'superadmin';

/** Lee el rol global persistido tras el login. */
export const getGlobalRole = (): string | null => localStorage.getItem('wabee_globalRole');

/** Único punto de verdad en el frontend para saber si el usuario es Super Admin. */
export const isSuperAdmin = (): boolean => getGlobalRole() === SUPER_ADMIN_ROLE;
