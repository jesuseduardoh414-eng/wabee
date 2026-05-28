
import { prisma } from '../../../../config/core/core.prisma';

export async function getChannels(tenantId: string) {
    return await prisma.whatsappChannel.findMany({
        where: { tenantId },
        select: {
            id: true,
            name: true,
            phoneNumberId: true,
            displayPhone: true,
            status: true,
            healthStatus: true,
            lastHealthCheckAt: true,
            lastErrorMessage: true,
            webhookStatus: true
        }
    });
}
