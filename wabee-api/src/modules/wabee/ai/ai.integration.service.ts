import { prisma } from '@/lib/prisma';
import { encrypt, decrypt } from '../channels/whatsapp/token.crypto';
import { ToolAuthType } from '@prisma/client';

export interface CreateIntegrationDto {
    name: string;
    authType: ToolAuthType;
    config: any; // Se enviará plano desde el cliente, se guardará encriptado
}

export interface UpdateIntegrationDto {
    name?: string;
    authType?: ToolAuthType;
    config?: any; // Opcional, si no viene, se mantiene el actual
}

export class AiIntegrationService {
    /**
     * Obtiene integraciones y retorna configuración omitida o parcialmente ofuscada.
     */
    async getTenantIntegrations(tenantId: string) {
        const integrations = await prisma.integrationCredential.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'desc' }
        });

        return integrations.map(i => ({
            id: i.id,
            name: i.name,
            authType: i.authType,
            hasConfig: i.encryptedConfig !== null && Object.keys(i.encryptedConfig as any).length > 0,
            createdAt: i.createdAt
        }));
    }

    async getIntegrationById(tenantId: string, id: string) {
        const i = await prisma.integrationCredential.findFirst({
            where: { id, tenantId }
        });
        if (!i) throw new Error('Integration not found');

        return {
            id: i.id,
            name: i.name,
            authType: i.authType,
            hasConfig: i.encryptedConfig !== null && Object.keys(i.encryptedConfig as any).length > 0,
            createdAt: i.createdAt
        };
    }

    /**
     * Decifra la configuración en tiempo de ejecución (Usado por ToolExecutor)
     */
    async getDecryptedConfig(tenantId: string, id: string): Promise<any> {
        const i = await prisma.integrationCredential.findFirst({
            where: { id, tenantId }
        });
        if (!i) throw new Error('Integration not found');

        if (!i.encryptedConfig || Object.keys(i.encryptedConfig).length === 0) return {};

        try {
            const encryptedData = i.encryptedConfig as any;
            if (encryptedData.ciphertext && encryptedData.iv && encryptedData.tag) {
                const jsonStr = decrypt(encryptedData);
                return JSON.parse(jsonStr);
            }
            return encryptedData; // Fallback si por alguna razón no estaba encriptado (Legacy)
        } catch (e) {
            console.error(`[AiIntegrationService] Error decrypting config para ${id}`, e);
            return {};
        }
    }

    async createIntegration(tenantId: string, dto: CreateIntegrationDto) {
        let encryptedConfig = {};
        if (dto.config && Object.keys(dto.config).length > 0) {
            encryptedConfig = encrypt(JSON.stringify(dto.config));
        }

        const created = await prisma.integrationCredential.create({
            data: {
                tenantId,
                name: dto.name,
                authType: dto.authType,
                encryptedConfig
            }
        });

        return {
            id: created.id,
            name: created.name,
            authType: created.authType,
            hasConfig: true
        };
    }

    async updateIntegration(tenantId: string, id: string, dto: UpdateIntegrationDto) {
        const existing = await prisma.integrationCredential.findFirst({
            where: { id, tenantId }
        });
        if (!existing) throw new Error('Integration not found');

        const dataToUpdate: any = {};
        if (dto.name) dataToUpdate.name = dto.name;
        if (dto.authType) dataToUpdate.authType = dto.authType;

        // Si se provee config explícitamente y no es null/undefined, la reemplazamos
        // Si no se provee o es empty, mantenemos existing.encryptedConfig
        if (dto.config !== undefined && dto.config !== null) {
            if (Object.keys(dto.config).length > 0) {
                dataToUpdate.encryptedConfig = encrypt(JSON.stringify(dto.config));
            } else {
                dataToUpdate.encryptedConfig = {};
            }
        }

        const updated = await prisma.integrationCredential.update({
            where: { id },
            data: dataToUpdate
        });

        return {
            id: updated.id,
            name: updated.name,
            authType: updated.authType,
            hasConfig: updated.encryptedConfig && Object.keys(updated.encryptedConfig).length > 0
        };
    }

    async deleteIntegration(tenantId: string, id: string) {
        // Validation: Ensure it's not used by any tool
        const toolsUsingIt = await prisma.aiTool.count({
            where: { credentialId: id, tenantId }
        });

        if (toolsUsingIt > 0) {
            throw new Error(`Cannot delete integration. It is used by ${toolsUsingIt} tools.`);
        }

        await prisma.integrationCredential.delete({
            where: { id } // tenantId is implicit via findFirst check earlier, but Prisma delete Needs Unique.
        });
        return { success: true };
    }
}

export const aiIntegrationService = new AiIntegrationService();
