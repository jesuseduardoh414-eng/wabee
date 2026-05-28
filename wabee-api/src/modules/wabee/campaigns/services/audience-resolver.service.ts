import { prisma } from '@/config/core/core.prisma';
import * as crypto from 'crypto';
import { uploadCampaignSnapshot } from '@/lib/supabase-storage';

export interface AudienceMember {
    id: string;
    phone: string;
    variant: 'A' | 'B';
}

export interface AudienceResolutionResult {
    members: AudienceMember[];
    hash: string;
    filePath: string | null;
    count: number;
}

export class AudienceResolverService {
    /**
     * Resuelve una audiencia basada en filtros y genera un snapshot persistente.
     * Implementa A/B testing determinístico y hash auditable.
     */
    static async resolve(tenantId: string, campaignId: string, audienceType: string, audienceFilter: any): Promise<AudienceResolutionResult> {
        let contacts: any[] = [];

        // 1. Obtener contactos base según el tipo de audiencia
        switch (audienceType) {
            case 'ALL_ACTIVE':
                contacts = await prisma.contact.findMany({
                    where: { tenantId, status: 'ACTIVE' },
                    select: { id: true, phone: true }
                });
                break;

            case 'GROUP':
                const groupId = audienceFilter?.groupId;
                if (!groupId) throw new Error('groupId is required for GROUP audience');
                contacts = await prisma.contact.findMany({
                    where: { tenantId, status: 'ACTIVE', contactGroups: { some: { groupId } } },
                    select: { id: true, phone: true }
                });
                break;

            case 'TAGS':
                const targetTags = (audienceFilter?.tags || []).map((t: string) => t.toLowerCase().trim());
                if (targetTags.length === 0) throw new Error('At least one tag is required for TAGS audience');

                const allWithTags = await prisma.contact.findMany({
                    where: { tenantId, status: 'ACTIVE' },
                    select: { id: true, phone: true, tags: true }
                });

                contacts = allWithTags.filter((c: any) => {
                    const cTags = Array.isArray(c.tags) ? (c.tags as any[]).map((t: any) => String(t).toLowerCase().trim()) : [];
                    return targetTags.some((t: string) => cTags.includes(t));
                });
                break;

            case 'SEGMENT':
                const segmentId = audienceFilter?.segmentId;
                if (!segmentId) throw new Error('segmentId is required for SEGMENT audience');

                const segment = await prisma.savedSegment.findFirst({ where: { id: segmentId, tenantId } });
                if (!segment) throw new Error('Segment not found');

                const filter = segment.filter as any;
                const segmentContacts = await prisma.contact.findMany({
                    where: {
                        tenantId,
                        status: 'ACTIVE',
                        ...(filter.lifecycleStatus && {
                            lifecycleStatus: Array.isArray(filter.lifecycleStatus) ? { in: filter.lifecycleStatus } : filter.lifecycleStatus
                        }),
                        ...(filter.groupId && { contactGroups: { some: { groupId: filter.groupId } } }),
                    },
                    select: { id: true, phone: true, tags: true }
                });

                // Filtrado de tags en memoria para precisión (mismo patrón que ContactsService)
                contacts = segmentContacts;
                if (filter.tagsAny || filter.tagsAll) {
                    contacts = segmentContacts.filter((c: any) => {
                        const cTags = Array.isArray(c.tags) ? (c.tags as any[]).map((t: any) => String(t).toLowerCase().trim()) : [];
                        if (filter.tagsAny && !filter.tagsAny.some((t: string) => cTags.includes(t.toLowerCase().trim()))) return false;
                        if (filter.tagsAll && !filter.tagsAll.every((t: string) => cTags.includes(t.toLowerCase().trim()))) return false;
                        return true;
                    });
                }
                break;

            default:
                throw new Error(`Unsupported audience type: ${audienceType}`);
        }

        // 2. Deduplicar por teléfono (evitar doble impacto)
        const uniqueContactsMap = new Map<string, { id: string, phone: string }>();
        contacts.forEach(c => {
            if (!uniqueContactsMap.has(c.phone)) {
                uniqueContactsMap.set(c.phone, c);
            }
        });

        // 3. Asignación determinística A/B (SHA256 de phone + campaignId)
        const members: AudienceMember[] = Array.from(uniqueContactsMap.values()).map(c => {
            const hash = crypto.createHash('sha256').update(c.phone + campaignId).digest('hex');
            // Usar los primeros 8 caracteres del hash para determinar variante
            const variant = parseInt(hash.substring(0, 8), 16) % 2 === 0 ? 'A' : 'B';
            return { id: c.id, phone: c.phone, variant };
        });

        // 4. Generar Hash de Auditoría del snapshot
        const snapshotContent = JSON.stringify(members);
        const snapshotHash = crypto.createHash('sha256').update(snapshotContent).digest('hex');

        // 5. Persistir Snapshot en Supabase Storage
        const fileName = `snapshot_${campaignId}_${Date.now()}.json`;
        let storagePath: string | null = null;

        try {
            storagePath = await uploadCampaignSnapshot(fileName, snapshotContent);
        } catch (err: any) {
            // No crítico: los mensajes ya se guardan en la tabla campaign_messages
            console.warn(`[AudienceResolver] Snapshot upload falló (no crítico): ${err.message}`);
        }

        return {
            members,
            hash: snapshotHash,
            filePath: storagePath,
            count: members.length
        };
    }
}
