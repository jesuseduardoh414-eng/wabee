import { Request } from 'express';

/**
 * Adapter para extraer la identidad del usuario bajo el contexto del Core SaaS.
 * En el Core, supabase (o el mw auth) inyecta `req.user.id`.
 */
export const authContextAdapter = {
    getUserId: (req: Request): string => {
        const userId = (req as any).user?.id || (req as any).userId;

        if (!userId) {
            throw new Error('AUTH_REQUIRED: No se encontró un usuario autenticado en el contexto.');
        }

        return userId;
    },

    getUserEmail: (req: Request): string | undefined => {
        return (req as any).user?.email;
    }
};
