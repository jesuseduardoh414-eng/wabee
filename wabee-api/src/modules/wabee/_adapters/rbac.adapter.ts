import { Request, Response, NextFunction } from 'express';

// Estos tipos deben casar con lo que exista en el Core (member.role.name) o similar
export type OrgRoleType = 'Admin' | 'Supervisor' | 'Agent' | string;

/**
 * Adapter para verificar Roles.
 * El legacy tenía roles estáticos en User o claims.
 * El Nuevo Core maneja The roles de forma global o vía `OrganizationMember` -> `Role`.
 */
export const rbacAdapter = {
    /**
     * Middleware sugerido para que el Controller lo use directamente 
     * protegiendo rutas sensibles (EJ: Configurar Canales de WS).
     */
    requireOrgRole: (allowedRoles: OrgRoleType[]) => {
        return async (req: Request, res: Response, next: NextFunction) => {
            try {
                // El core de Supabase u otro MW ya inyectó `req.user`.
                // Asumimos que `req.user.role` o similar tiene el scope, o necesitamos consultar Prisma.
                // Para simplificar la migración temprana sin romper la compilación, comprobamos un array de permisos inyectados o logueamos.

                const userObj = (req as any).user;
                if (!userObj) {
                    res.status(401).json({ error: 'Unauthorized: Missing User' });
                    return;
                }

                // Logica de Core (placeholder hasta ver el mw real de Core)
                // Usualmente app.use('/admin', requireOrgRole('Admin')) requerirá leer Prisma OrganizationMember.

                // FIXME: Si el core yatiene un middleware `requireOrgRole`, lo ideal es importar ESE mismo aquí
                // y re-exportarlo. 

                next();
            } catch (error) {
                res.status(403).json({ error: 'Forbidden' });
            }
        };
    }
};
