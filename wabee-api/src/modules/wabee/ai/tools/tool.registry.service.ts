import { prisma } from '@/lib/prisma';
import { FunctionDeclaration } from '../gemini.client';
import { buildLlmToolDescription } from './tool.scorer';

export class ToolRegistryService {
    /**
     * Obtiene todas las tools activas asignadas a un perfil y las formatea
     * como FunctionDeclarations para Gemini, con descripción semántica rica.
     */
    async getProfileTools(profileId: string): Promise<FunctionDeclaration[]> {
        const profileTools = await prisma.aiProfileTool.findMany({
            where: {
                profileId,
                isActive: true,
                tool: { isActive: true }
            },
            include: { tool: true }
        });

        return profileTools.map(pt => {
            const t = pt.tool;
            return {
                name: t.name,
                // Descripción estructurada semánticamente para el LLM
                description: buildLlmToolDescription(t),
                parameters: t.parametersSchema as any
            };
        });
    }

    /**
     * Busca el ID de una tool por su nombre técnico dentro de un perfil.
     */
    async getToolIdByNameForProfile(profileId: string, name: string): Promise<string | null> {
        const profileTool = await prisma.aiProfileTool.findFirst({
            where: { profileId, tool: { name } },
            select: { toolId: true }
        });
        return profileTool?.toolId || null;
    }

    /**
     * Obtiene el objeto completo de una tool con metadatos de gobernanza.
     * Si hay un servicio activo, aplica la gobernanza específica del servicio.
     * Si no, usa confirmationPolicy + safetyFlags de la tool directamente.
     */
    async getToolByNameForProfile(profileId: string, name: string, activeServiceId?: string) {
        const profileTool = await prisma.aiProfileTool.findFirst({
            where: { profileId, tool: { name } },
            include: { tool: true }
        });

        if (!profileTool) return null;

        const tool = profileTool.tool;

        // Gobernanza por defecto desde los campos semánticos de la tool
        let governance = {
            executionMode: (tool as any).confirmationPolicy || 'AUTO',
            actionType: (tool as any).safetyFlags && (tool as any).safetyFlags.canMutateData ? 'CREATE' : 'READ',
        };

        // Si hay servicio activo, los metadatos del AiServiceTool tienen precedencia
        if (activeServiceId) {
            const serviceTool = await prisma.aiServiceTool.findFirst({
                where: { serviceId: activeServiceId, toolId: tool.id }
            });

            if (serviceTool) {
                governance.executionMode = serviceTool.executionMode;
                governance.actionType = serviceTool.actionType;
            }
        }

        return { ...tool, governance };
    }
}

export const toolRegistryService = new ToolRegistryService();
