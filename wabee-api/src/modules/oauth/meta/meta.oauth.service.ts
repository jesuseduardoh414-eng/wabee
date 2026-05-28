import axios from 'axios';
import { env } from '../../../config/env';
import { prisma } from '../../../config/core/core.prisma';
import { encrypt } from '../../wabee/channels/whatsapp/token.crypto';
import { graphGet } from '../../wabee/channels/whatsapp/meta.graph.client';

export async function exchangeCodeForToken(code: string, tenantId: string) {
    const url = `https://graph.facebook.com/${env.META_GRAPH_VERSION}/oauth/access_token`;

    const response = await axios.get(url, {
        params: {
            client_id: env.META_APP_ID,
            client_secret: env.META_APP_SECRET,
            redirect_uri: env.META_REDIRECT_URI,
            code,
        },
    });

    const { access_token, expires_in } = response.data;
    const encrypted = encrypt(access_token);

    const expiresAt = expires_in ? new Date(Date.now() + expires_in * 1000) : null;

    // Save or update session
    const session = await (prisma as any).metaOauthSession.create({
        data: {
            tenantId: tenantId,
            accessTokenCiphertext: encrypted.ciphertext,
            accessTokenIv: encrypted.iv,
            accessTokenTag: encrypted.tag,
            tokenExpiresAt: expiresAt,
            scopes: ['whatsapp_business_management', 'whatsapp_business_messaging', 'business_management', 'whatsapp_business_messaging'],
            provider: 'META'
        },
    });

    // Auto-sync channels from Meta immediately
    console.log(`[OAuth] Token exchange successful for tenant ${tenantId}. Triggering sync...`);
    await syncChannelsFromMeta(tenantId, session.id, access_token);

    return session;
}

export function generateMetaAuthUrl(tenantId: string) {
    const state = Buffer.from(JSON.stringify({ tenantId, nonce: Math.random().toString(36).substring(7) })).toString('base64');

    const url = new URL(`https://www.facebook.com/${env.META_GRAPH_VERSION}/dialog/oauth`);

    // Authorization Code Flow params
    url.searchParams.append('client_id', env.META_APP_ID);
    url.searchParams.append('redirect_uri', env.META_REDIRECT_URI);
    url.searchParams.append('state', state);
    url.searchParams.append('response_type', 'code'); // CRITICAL: Server-side code exchange
    url.searchParams.append('scope', 'whatsapp_business_management,whatsapp_business_messaging,business_management');

    // Explicitly NO embedded signup or extras
    return url.toString();
}

export function parseOAuthState(state: string): { tenantId: string } {
    try {
        const decoded = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
        return { tenantId: decoded.tenantId };
    } catch (error) {
        throw new Error('Invalid OAuth state');
    }
}

export async function syncChannelsFromMeta(tenantId: string, oauthSessionId: string, accessToken: string) {
    const maskedToken = `...${accessToken.slice(-6)}`;
    console.log(`[OAuthSync] Starting hierarchical sync for tenant ${tenantId}. Token: ${maskedToken}`);

    try {
        // STEP A: Get Businesses
        console.log(`[OAuthSync] Fetching businesses...`);
        const bizResponse = await graphGet('/me/businesses', accessToken);
        const businesses = bizResponse.data || [];
        console.log(`[OAuthSync] Found ${businesses.length} businesses.`);

        const allWabas: { id: string, name: string }[] = [];

        for (const biz of businesses) {
            try {
                console.log(`[OAuthSync] Fetching WABAs for business: ${biz.name} (${biz.id})`);
                const wabaResponse = await graphGet(`/${biz.id}/owned_whatsapp_business_accounts`, accessToken);
                const wabas = wabaResponse.data || [];
                allWabas.push(...wabas.map((w: any) => ({ id: w.id, name: w.name })));
            } catch (err: any) {
                console.error(`[OAuthSync] Error fetching WABAs for business ${biz.id}:`, err.message);
            }
        }

        // Fallback: If no businesses or no WABAs found via businesses, try direct
        if (allWabas.length === 0) {
            console.log(`[OAuthSync] No WABAs found via businesses, trying direct access...`);
            try {
                const directWabaResponse = await graphGet('/me/whatsapp_business_accounts', accessToken);
                const directWabas = directWabaResponse.data || [];
                allWabas.push(...directWabas.map((w: any) => ({ id: w.id, name: w.name })));
            } catch (err: any) {
                console.error(`[OAuthSync] Direct WABA access also failed:`, err.message);
            }
        }

        console.log(`[OAuthSync] Total WABAs to sync: ${allWabas.length}`);

        for (const waba of allWabas) {
            try {
                const phoneResponse = await graphGet(`/${waba.id}/phone_numbers`, accessToken, {
                    fields: 'id,display_phone_number,verified_name,status'
                });
                const phones = phoneResponse.data || [];

                for (const phone of phones) {
                    await (prisma as any).whatsappChannel.upsert({
                        where: {
                            tenantId_phoneNumberId: {
                                tenantId,
                                phoneNumberId: phone.id
                            }
                        },
                        update: {
                            name: phone.verified_name || phone.display_phone_number || 'WhatsApp Channel',
                            displayPhone: phone.display_phone_number,
                            verifiedName: phone.verified_name,
                            wabaId: waba.id,
                            status: 'CONNECTED',
                            oauthSessionId: oauthSessionId
                        },
                        create: {
                            tenantId,
                            phoneNumberId: phone.id,
                            wabaId: waba.id,
                            name: phone.verified_name || phone.display_phone_number || 'WhatsApp Channel',
                            displayPhone: phone.display_phone_number,
                            verifiedName: phone.verified_name,
                            status: 'CONNECTED',
                            oauthSessionId: oauthSessionId
                        }
                    });
                    console.log(`[OAuthSync] Sync success: ${phone.display_phone_number} (${phone.id})`);
                }
            } catch (err: any) {
                console.error(`[OAuthSync] Error syncing phone numbers for WABA ${waba.id}:`, err.message);
            }
        }
    } catch (error: any) {
        console.error('[OAuthSync] Fatal Sync Error:', error.response?.data || error.message);
        // We don't throw to avoid blocking the main OAuth flow
    }
}
