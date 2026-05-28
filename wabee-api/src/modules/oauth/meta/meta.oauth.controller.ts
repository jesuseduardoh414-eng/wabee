import { Request, Response, NextFunction } from 'express';
import { MetaOAuthCallbackSchema } from './meta.oauth.schemas';
import * as metaOauthService from './meta.oauth.service';
import { env } from '../../../config/env';
import { prisma } from '../../../config/core/core.prisma';

export async function oauthStart(req: Request, res: Response, next: NextFunction) {
    const tenantKey = req.query.tenant_key as string;

    if (!tenantKey) {
        return res.status(403).json({
            error: {
                code: 'INVALID_TENANT_KEY',
                message: 'Query parameter tenant_key is required to start OAuth flow',
            },
        });
    }

    try {
        const tenantKey = req.query.tenant_key as string;

        // Búsqueda flexible: intentar con el key tal cual, con guiones medios (slugified) y con guiones bajos
        const possibleSlugs = [
            tenantKey,
            tenantKey.replace(/_/g, '-'),
            tenantKey.replace(/-/g, '_')
        ];

        let tenant = await (prisma as any).organization.findFirst({
            where: {
                slug: { in: possibleSlugs }
            },
            select: { id: true, slug: true },
        });

        // Mapeo de emergencia: Si es el slug de desarrollo antiguo, forzar el ID de CENTRALITA si existe
        if (!tenant && (tenantKey === 'wabee_dev_admin_2026' || tenantKey === 'wabee-dev-admin-2026')) {
            console.log(`[OAuth] Emergency mapping for slug: ${tenantKey} -> CENTRALITA`);
            tenant = await (prisma as any).organization.findFirst({
                where: { name: 'CENTRALITA' },
                select: { id: true, slug: true }
            });
        }

        if (!tenant) {
            const allOrgs = await (prisma as any).organization.findMany({ select: { slug: true, id: true, name: true } });
            console.error(`[OAuth] Organization not found for key: ${tenantKey}. Attempted slugs: ${possibleSlugs.join(', ')}. Available in DB:`, JSON.stringify(allOrgs, null, 2));

            // Si hay solo una organización, podríamos ser proactivos y usarla en desarrollo, 
            // pero para seguridad solo logueamos y fallamos con detalle.
            return res.status(403).json({
                error: {
                    code: 'INVALID_TENANT_KEY',
                    message: `No se encontró la organización con slug: ${tenantKey}`,
                    debug: { attempted: possibleSlugs, available: allOrgs.map((o: any) => o.slug) }
                },
            });
        }

        console.log(`[OAuth] Redirecting to Meta for tenant: ${tenant.slug} (${tenant.id})`);
        const url = metaOauthService.generateMetaAuthUrl(tenant.id);
        res.redirect(url);
    } catch (error) {
        next(error);
    }
}

export async function oauthCallback(req: Request, res: Response, next: NextFunction) {
    try {
        const { code, state } = MetaOAuthCallbackSchema.parse(req.query);
        const { tenantId } = metaOauthService.parseOAuthState(state as string);

        await metaOauthService.exchangeCodeForToken(code, tenantId);

        // Redirect back to frontend channels page
        res.redirect(`${env.FRONTEND_URL}/dashboard/wabee/channels?oauth=ok`);
    } catch (error) {
        next(error);
    }
}
