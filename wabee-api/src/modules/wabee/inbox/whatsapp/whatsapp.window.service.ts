import { prisma } from '@/lib/prisma';

export class WhatsAppWindowService {
    /**
     * Determina si la ventana de 24h está abierta para un contacto.
     * REGLA: Debe existir al menos un mensaje INBOUND en las últimas 24 horas.
     */
    static async is24hWindowOpen(params: {
        tenantId: string;
        channelId: string;
        contactPhoneNormalized: string;
    }): Promise<boolean> {
        const { tenantId, channelId, contactPhoneNormalized } = params;

        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const lastInbound = await prisma.whatsappMessage.findFirst({
            where: {
                tenantId,
                channelId,
                remotePhone: contactPhoneNormalized,
                direction: 'INBOUND',
                createdAt: {
                    gte: twentyFourHoursAgo
                }
            },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true }
        });

        return Boolean(lastInbound);
    }
}
