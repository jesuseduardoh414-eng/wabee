import { prisma } from '@/lib/prisma';

export class AiToolsService {
    /**
     * Lista todas las herramientas disponibles para un tenant.
     */
    async getTenantTools(tenantId: string) {
        return prisma.aiTool.findMany({
            where: { tenantId },
            include: { credential: { select: { id: true, name: true, authType: true } } },
            orderBy: { name: 'asc' }
        });
    }

    /**
     * Obtiene una herramienta específica.
     */
    async getToolById(tenantId: string, id: string) {
        const tool = await prisma.aiTool.findFirst({
            where: { id, tenantId },
            include: { credential: { select: { id: true, name: true, authType: true } } }
        });
        if (!tool) throw new Error('Tool not found');
        return tool;
    }

    /**
     * Crea una nueva herramienta AI con soporte de campos semánticos.
     * Aplica fallbacks razonables para herramientas que no especifiquen todos los nuevos campos.
     */
    async createTool(tenantId: string, data: any) {
        // Fallback: si no se envían exampleUtterances, copiar triggerHints si existen
        const exampleUtterances = data.exampleUtterances
            ?? (Array.isArray(data.triggerHints) && data.triggerHints.length > 0
                ? data.triggerHints
                : null);

        // safetyFlags con contrato mínimo garantizado
        const safetyFlags = {
            canMutateData: false,
            requiresConfirmation: false,
            safeToAutoRun: true,
            idempotent: true,
            sensitiveOperation: false,
            ...(data.safetyFlags || {})
        };

        return prisma.aiTool.create({
            data: {
                tenantId,
                name: data.name,
                displayName: data.displayName,
                description: data.description,
                category: data.category,
                // Campos semánticos nuevos
                capability: data.capability || 'general_api_fetch',
                customCapability: data.customCapability || null,
                semanticDescription: data.semanticDescription || null,
                outputSchema: data.outputSchema || null,
                confirmationPolicy: data.confirmationPolicy || 'AUTO',
                safetyFlags,
                exampleUtterances,
                // HTTP
                method: data.method,
                endpointUrl: data.endpointUrl,
                parametersSchema: data.parametersSchema || {},
                credentialId: data.credentialId || null,
                responseMapping: data.responseMapping || null,
                // Compatibilidad legacy
                triggerHints: data.triggerHints || [],
                timeoutMs: data.timeoutMs || 5000,
                retries: data.retries || 0,
                requireApproval: data.requireApproval || false,
                isActive: data.isActive !== undefined ? data.isActive : true
            }
        });
    }

    /**
     * Actualiza una herramienta AI.
     */
    async updateTool(tenantId: string, id: string, data: any) {
        const existing = await prisma.aiTool.findFirst({ where: { id, tenantId } });
        if (!existing) throw new Error('Tool not found');

        // Merge safetyFlags: mantener campos existentes, sobreescribir solo los enviados
        const existingSafetyFlags = (existing as any).safetyFlags || {};
        const safetyFlags = data.safetyFlags
            ? {
                canMutateData: false,
                requiresConfirmation: false,
                safeToAutoRun: true,
                idempotent: true,
                sensitiveOperation: false,
                ...existingSafetyFlags,
                ...data.safetyFlags
              }
            : existingSafetyFlags;

        return prisma.aiTool.update({
            where: { id },
            data: {
                name: data.name,
                displayName: data.displayName,
                description: data.description,
                category: data.category,
                // Campos semánticos
                capability: data.capability,
                customCapability: data.customCapability,
                semanticDescription: data.semanticDescription,
                outputSchema: data.outputSchema,
                confirmationPolicy: data.confirmationPolicy,
                safetyFlags,
                exampleUtterances: data.exampleUtterances,
                // HTTP
                method: data.method,
                endpointUrl: data.endpointUrl,
                parametersSchema: data.parametersSchema,
                credentialId: data.credentialId,
                responseMapping: data.responseMapping,
                triggerHints: data.triggerHints,
                timeoutMs: data.timeoutMs,
                retries: data.retries,
                requireApproval: data.requireApproval,
                isActive: data.isActive
            }
        });
    }

    /**
     * Elimina una herramienta AI.
     */
    async deleteTool(tenantId: string, id: string) {
        const existing = await prisma.aiTool.findFirst({ where: { id, tenantId } });
        if (!existing) throw new Error('Tool not found');
        await prisma.aiTool.delete({ where: { id } });
        return { success: true };
    }

    /**
     * Lista herramientas consolidadas para un perfil.
     * Incluye metadatos semánticos y estado de completitud de la herramienta.
     */
    async getProfileToolsConsolidated(tenantId: string, profileId: string) {
        const allTools = await prisma.aiTool.findMany({
            where: { tenantId },
            orderBy: { name: 'asc' }
        });

        const profileLinks = await prisma.aiProfileTool.findMany({
            where: { profileId, tenantId }
        });

        return allTools.map(tool => {
            const t = tool as any;
            const link = profileLinks.find(l => l.toolId === tool.id);

            // Calcular completitud semántica para guiar migración de tools antiguas
            const isSemanticComplete =
                !!t.semanticDescription &&
                t.capability !== 'general_api_fetch' &&
                !!t.capability;

            return {
                id: tool.id,
                name: tool.name,
                displayName: tool.displayName,
                description: tool.description,
                category: tool.category,
                // Semánticos
                capability: t.capability || 'general_api_fetch',
                confirmationPolicy: t.confirmationPolicy || 'AUTO',
                isSemanticComplete,                    // Señal para UI de migración
                hasGenericCapability: t.capability === 'general_api_fetch' || !t.capability,
                // Estado
                globalIsActive: tool.isActive,
                isLinked: !!link,
                profileIsActive: link ? link.isActive : false,
                profileLinkId: link?.id || null,
                effectivelyActive: tool.isActive && (link ? link.isActive : false)
            };
        });
    }

    /**
     * Vincula una herramienta a un perfil.
     */
    async linkToolToProfile(tenantId: string, profileId: string, toolId: string) {
        return prisma.aiProfileTool.upsert({
            where: { profileId_toolId: { profileId, toolId } },
            create: { tenantId, profileId, toolId, isActive: true },
            update: {}
        });
    }

    /**
     * Desvincula una herramienta de un perfil.
     */
    async unlinkToolFromProfile(tenantId: string, profileId: string, toolId: string) {
        return prisma.aiProfileTool.delete({
            where: { profileId_toolId: { profileId, toolId } }
        });
    }

    /**
     * Cambia el estado de activación de una herramienta en un perfil.
     */
    async toggleProfileToolStatus(tenantId: string, profileId: string, toolId: string, isActive: boolean) {
        return prisma.aiProfileTool.update({
            where: { profileId_toolId: { profileId, toolId } },
            data: { isActive }
        });
    }

    /**
     * Cambia el estado de activación global (tenant) de una herramienta.
     */
    async toggleGlobalToolStatus(tenantId: string, toolId: string, isActive: boolean) {
        return prisma.aiTool.update({
            where: { id: toolId, tenantId },
            data: { isActive }
        });
    }
}

export const aiToolsService = new AiToolsService();
