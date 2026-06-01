import { prisma } from '@/lib/prisma';
import { CreateAiProfileSchema, UpdateAiProfileSchema } from './ai.schemas';
import { kbService } from './kb.service';
import * as fs from 'fs';
import * as path from 'path';

export class AiProfilesService {

    /**
     * Get all AI Profiles for a tenant
     */
    async getProfiles(tenantId: string) {
        return await prisma.aiProfile.findMany({
            where: { tenantId },
            include: { _count: { select: { kbFiles: true } } },
            orderBy: { createdAt: 'desc' },
        });
    }

    /**
     * Get single AI Profile by ID
     */
    async getProfileById(tenantId: string, id: string) {
        const profile = await prisma.aiProfile.findFirst({
            where: { id, tenantId },
            include: { kbFiles: true },
        });

        if (!profile) {
            throw { status: 404, message: 'AI Profile not found' };
        }

        return profile;
    }

    /**
     * Create new AI Profile
     */
    async createProfile(tenantId: string, data: any) {
        const validated = CreateAiProfileSchema.parse(data) as any;

        try {
            return await prisma.aiProfile.create({
                data: {
                    ...validated,
                    tenantId,
                } as any,
            });
        } catch (error: any) {
            console.error('[AiProfilesService] CREATE_ERR:', JSON.stringify({
                tenantId,
                payload: validated,
                error: error.message,
                stack: error.stack
            }, null, 2));
            throw error;
        }
    }

    /**
     * Update AI Profile
     */
    async updateProfile(tenantId: string, id: string, data: any) {
        const existing = await this.getProfileById(tenantId, id);
        const validated = UpdateAiProfileSchema.parse(data) as any;

        try {
            return await prisma.aiProfile.update({
                where: { id: existing.id },
                data: validated,
            });
        } catch (error: any) {
            console.error('[AiProfilesService] UPDATE_ERR:', JSON.stringify({
                tenantId,
                id,
                payload: validated,
                error: error.message
            }, null, 2));
            throw error;
        }
    }

    /**
     * Delete AI Profile
     */
    async deleteProfile(tenantId: string, id: string) {
        const existing = await this.getProfileById(tenantId, id);

        await prisma.aiProfile.delete({
            where: { id: existing.id },
        });

        return { message: 'AI Profile deleted successfully' };
    }

    /**
     * KB: Get files
     */
    async getKbFiles(tenantId: string, profileId: string) {
        return await prisma.kbFile.findMany({
            where: { tenantId, profileId },
            orderBy: { createdAt: 'desc' }
        });
    }

    /**
     * KB: Upload and Index File (PDF, CSV, Excel)
     */
    async uploadKbFile(params: {
        tenantId: string;
        profileId: string;
        file: Express.Multer.File;
    }) {
        const { tenantId, profileId, file } = params;

        // Verify profile
        await this.getProfileById(tenantId, profileId);

        // 1. Create KB record
        const kbFile = await prisma.kbFile.create({
            data: {
                tenantId,
                profileId,
                filename: file.originalname,
                mimeType: file.mimetype,
                size: file.size,
                storagePath: file.path, // Using local path from multer for now
                status: 'PROCESSING'
            }
        });

        // 2. Trigger background indexing
        setImmediate(async () => {
            try {
                const buffer = fs.readFileSync(file.path);
                await kbService.indexFile({
                    tenantId,
                    profileId,
                    fileId: kbFile.id,
                    filename: file.originalname,
                    mimeType: file.mimetype,
                    buffer,
                });
            } catch (err: any) {
                console.error(`[AiProfilesService] Background indexing failed for ${kbFile.id}:`, err.message);
            }
        });

        return kbFile;
    }

    /**
     * KB: Delete File
     */
    async deleteKbFile(tenantId: string, profileId: string, fileId: string) {
        const kbFile = await prisma.kbFile.findFirst({
            where: { id: fileId, tenantId, profileId }
        });

        if (!kbFile) throw { status: 404, message: 'KB File not found' };

        // Delete from DB (onDelete: Cascade takes care of chunks)
        await prisma.kbFile.delete({ where: { id: fileId } });

        // Try to delete physical file if exists
        try {
            if (fs.existsSync(kbFile.storagePath)) {
                fs.unlinkSync(kbFile.storagePath);
            }
        } catch (err) {
            console.warn(`[AiProfilesService] Failed to delete physical file: ${kbFile.storagePath}`);
        }

        return { message: 'File deleted successfully' };
    }

    /**
     * KB: Reindex File (PDF, CSV, Excel)
     */
    async reindexKbFile(tenantId: string, profileId: string, fileId: string) {
        const kbFile = await prisma.kbFile.findFirst({
            where: { id: fileId, tenantId, profileId }
        });

        if (!kbFile) throw { status: 404, message: 'KB File not found' };

        await prisma.kbFile.update({
            where: { id: fileId },
            data: { status: 'PROCESSING', error: null }
        });

        setImmediate(async () => {
            try {
                const buffer = fs.readFileSync(kbFile.storagePath);
                await kbService.indexFile({
                    tenantId,
                    profileId,
                    fileId: kbFile.id,
                    filename: kbFile.filename,
                    mimeType: kbFile.mimeType,
                    buffer,
                });
            } catch (err: any) {
                console.error(`[AiProfilesService] Background re-indexing failed for ${kbFile.id}:`, err.message);
            }
        });

        return { message: 'Reindexing started' };
    }

    /**
     * KB: Get file content
     */
    async getKbFileContent(tenantId: string, profileId: string, fileId: string) {
        const kbFile = await prisma.kbFile.findFirst({
            where: { id: fileId, tenantId, profileId }
        });

        if (!kbFile) throw { status: 404, message: 'KB File not found' };

        if (!fs.existsSync(kbFile.storagePath)) {
            throw { status: 404, message: 'Physical file not found' };
        }

        return {
            path: kbFile.storagePath,
            mimeType: kbFile.mimeType,
            filename: kbFile.filename
        };
    }

    // ─── KB SOURCES (URL / web scraping) ────────────────────────────────────

    async getKbSources(tenantId: string, profileId: string) {
        return await prisma.kbSource.findMany({
            where: { tenantId, profileId },
            orderBy: { createdAt: 'desc' },
        });
    }

    async createKbSource(params: { tenantId: string; profileId: string; name: string; url: string }) {
        const { tenantId, profileId, name, url } = params;

        await this.getProfileById(tenantId, profileId);

        const source = await prisma.kbSource.create({
            data: {
                tenantId,
                profileId,
                name,
                sourceType: 'URL',
                status: 'PENDING',
                config: { url },
            },
        });

        // Index asynchronously so the API returns immediately
        setImmediate(async () => {
            try {
                await kbService.indexSource({ tenantId, profileId, sourceId: source.id, url });
            } catch (err: any) {
                console.error(`[AiProfilesService] Background source indexing failed for ${source.id}:`, err.message);
            }
        });

        return source;
    }

    async deleteKbSource(tenantId: string, profileId: string, sourceId: string) {
        const source = await prisma.kbSource.findFirst({
            where: { id: sourceId, tenantId, profileId },
        });

        if (!source) throw { status: 404, message: 'KB Source not found' };

        await prisma.kbSource.delete({ where: { id: sourceId } });

        return { message: 'Source deleted successfully' };
    }

    // ─── KB Sources — DATABASE ────────────────────────────────────────────────

    async testDbConnection(params: { tenantId: string; profileId: string; config: any }) {
        await this.getProfileById(params.tenantId, params.profileId);
        return kbService.testDbSource(params.config);
    }

    async createDbSource(params: {
        tenantId: string;
        profileId: string;
        name: string;
        config: any;     // DbConnectionConfig
        mappings: any[]; // ColumnMapping[]
    }) {
        const { tenantId, profileId, name, config, mappings } = params;
        await this.getProfileById(tenantId, profileId);

        const source = await prisma.kbSource.create({
            data: {
                tenantId,
                profileId,
                name,
                sourceType: 'DATABASE',
                status: 'PENDING',
                config: { connection: config, mappings },
            },
        });

        setImmediate(async () => {
            try {
                await kbService.indexDbSource({ tenantId, profileId, sourceId: source.id, config, mappings });
            } catch (err: any) {
                console.error(`[AiProfilesService] DB source indexing failed for ${source.id}:`, err.message);
            }
        });

        return source;
    }

    async reindexDbSource(tenantId: string, profileId: string, sourceId: string) {
        const source = await prisma.kbSource.findFirst({ where: { id: sourceId, tenantId, profileId } });
        if (!source) throw { status: 404, message: 'KB Source not found' };

        const cfg = source.config as any;
        if (!cfg?.connection || !cfg?.mappings) {
            throw { status: 400, message: 'Source has no DB configuration' };
        }

        await prisma.kbSource.update({ where: { id: sourceId }, data: { status: 'PENDING', error: null } });

        setImmediate(async () => {
            try {
                await kbService.indexDbSource({
                    tenantId, profileId, sourceId,
                    config: cfg.connection,
                    mappings: cfg.mappings,
                });
            } catch (err: any) {
                console.error(`[AiProfilesService] DB source re-index failed ${sourceId}:`, err.message);
            }
        });

        return { message: 'Reindexing started' };
    }

    async reindexKbSource(tenantId: string, profileId: string, sourceId: string) {
        const source = await prisma.kbSource.findFirst({
            where: { id: sourceId, tenantId, profileId },
        });

        if (!source) throw { status: 404, message: 'KB Source not found' };

        const url = (source.config as any)?.url;
        if (!url) throw { status: 400, message: 'Source has no URL configured' };

        await prisma.kbSource.update({
            where: { id: sourceId },
            data: { status: 'PENDING', error: null },
        });

        setImmediate(async () => {
            try {
                await kbService.indexSource({ tenantId, profileId, sourceId, url });
            } catch (err: any) {
                console.error(`[AiProfilesService] Background source re-indexing failed for ${sourceId}:`, err.message);
            }
        });

        return { message: 'Reindexing started' };
    }

    /**
     * Pause AI for a specific thread
     */
    async pauseThreadAI(tenantId: string, widgetId: string, threadId: string, userId: string) {
        // Verify thread exists and belongs to tenant
        const thread = await prisma.webThread.findFirst({
            where: { id: threadId, widgetId, tenantId },
        });

        if (!thread) {
            throw { status: 404, message: 'Thread not found' };
        }

        // Verify widget has takeover enabled
        const widget = await prisma.webWidget.findFirst({
            where: { id: widgetId, tenantId },
        });

        const aiConfig = widget?.ai as any;
        if (!aiConfig?.takeoverEnabled) {
            throw { status: 403, message: 'AI takeover not enabled for this widget' };
        }

        return await prisma.webThread.update({
            where: { id: threadId },
            data: {
                aiPaused: true,
                aiPausedAt: new Date(),
                aiPausedByUserId: userId,
            },
        });
    }

    /**
     * Resume AI for a specific thread
     */
    async resumeThreadAI(tenantId: string, widgetId: string, threadId: string) {
        const thread = await prisma.webThread.findFirst({
            where: { id: threadId, widgetId, tenantId },
        });

        if (!thread) {
            throw { status: 404, message: 'Thread not found' };
        }

        return await prisma.webThread.update({
            where: { id: threadId },
            data: {
                aiPaused: false,
                aiPausedAt: null,
                aiPausedByUserId: null,
            },
        });
    }
}

export const aiProfilesService = new AiProfilesService();
