import { prisma } from '@/lib/prisma';
import { env } from '@/config/env';
import _axios from 'axios'; const axios = _axios; // workaround for import issues if any
import { decrypt } from '@/modules/wabee/channels/whatsapp/token.crypto';

/**
 * Service to monitor WhatsApp Channel Health
 * Logic:
 * - Ping Meta Graph API
 * - Green if success
 * - Yellow/Red based on frequent failures
 */
export class WhatsappChannelHealthService {

    // Thresholds
    private static MAX_FAILURES_BEFORE_RED = 3;
    private static META_SAMPLE_PHONE_ID = '123456123';
    private static TEST_PHONE_NUMBER_ID = env.WHATSAPP_TEST_PHONE_NUMBER_ID || '879122178627116';

    /**
     * Perform Health Check for a single channel
     * Can be called by Cron Job or On-Demand (e.g. before sending)
     */
    static async checkChannelHealth(channelId: string) {
        // 1. Fetch channel & token info
        const channel = await prisma.whatsappChannel.findUnique({
            where: { id: channelId },
            include: { oauthSession: true }
        });

        if (!channel) return;

        // SKIP SAMPLE (Anti-noise)
        if (channel.phoneNumberId === this.META_SAMPLE_PHONE_ID) {
            return;
        }

        // 2. Resolve Token
        let accessToken = '';
        if (channel.phoneNumberId === this.TEST_PHONE_NUMBER_ID && env.WHATSAPP_TEST_ACCESS_TOKEN) {
            accessToken = env.WHATSAPP_TEST_ACCESS_TOKEN;
        } else if (channel.oauthSession) {
            accessToken = decrypt({
                ciphertext: channel.oauthSession.accessTokenCiphertext,
                iv: channel.oauthSession.accessTokenIv,
                tag: channel.oauthSession.accessTokenTag
            });
        } else {
            // NO TOKEN -> RED
            await this.updateStatus(channel.id, 'RED', 'No token found', 401);
            return;
        }

        // 3. Ping Meta
        const graphVersion = env.META_GRAPH_VERSION || 'v19.0';
        const url = `https://graph.facebook.com/${graphVersion}/${channel.phoneNumberId}?fields=verified_name,code_verification_status`;

        try {
            await axios.get(url, {
                headers: { 'Authorization': `Bearer ${accessToken}` },
                timeout: 5000
            });

            // SUCCESS -> GREEN
            await this.updateStatus(channel.id, 'GREEN');
        } catch (error: any) {
            const status = error.response?.status || 500;
            const message = error.response?.data?.error?.message || error.message;

            // Critical Auth Errors -> RED Immediately
            if (status === 401 || status === 403) {
                await this.updateStatus(channel.id, 'RED', message, status);
            } else {
                // Transient -> YELLOW then RED via logic
                await this.handleTransientFailure(channel, message, status);
            }
        }
    }

    /**
     * Update status in DB with Anti-Flapping logic
     */
    private static async updateStatus(channelId: string, status: 'GREEN' | 'RED', errorMessage?: string, errorCode?: number) {
        if (status === 'GREEN') {
            await prisma.whatsappChannel.update({
                where: { id: channelId },
                data: {
                    healthStatus: 'GREEN',
                    healthFailureCount: 0,
                    lastHealthyAt: new Date(),
                    lastHealthCheckAt: new Date(),
                    lastErrorMessage: null,
                    lastErrorCode: null
                }
            });
        } else {
            // RED DIRECT
            await prisma.whatsappChannel.update({
                where: { id: channelId },
                data: {
                    healthStatus: 'RED',
                    lastHealthCheckAt: new Date(),
                    lastErrorAt: new Date(),
                    lastErrorMessage: errorMessage,
                    lastErrorCode: String(errorCode || 'UNKNOWN'),
                    healthFailureCount: { increment: 1 } // Increment for tracking
                }
            });
        }
    }

    private static async handleTransientFailure(channel: any, message: string, code: number) {
        const newCount = channel.healthFailureCount + 1;
        const newStatus = newCount >= this.MAX_FAILURES_BEFORE_RED ? 'RED' : 'YELLOW';

        await prisma.whatsappChannel.update({
            where: { id: channel.id },
            data: {
                healthStatus: newStatus,
                healthFailureCount: newCount,
                lastHealthCheckAt: new Date(),
                lastErrorAt: new Date(),
                lastErrorMessage: message,
                lastErrorCode: String(code)
            }
        });
    }

    /**
     * Run checks for all CONNECTED channels
     * Optional filter by specific ID or Tenant
     */
    static async checkAllChannels(filters?: { channelId?: string, tenantId?: string }) {
        const whereClause: any = { status: { not: 'ARCHIVED' } };

        if (filters?.channelId) whereClause.id = filters.channelId;
        if (filters?.tenantId) whereClause.tenantId = filters.tenantId;

        const channels = await prisma.whatsappChannel.findMany({
            where: whereClause,
            select: { id: true }
        });

        console.log(`🏥 [HealthCheck] Checking ${channels.length} channels...`);

        for (const c of channels) {
            await this.checkChannelHealth(c.id);
        }
    }
}
