import { z } from 'zod';
import axios from 'axios';
import { prisma } from '@/lib/prisma';
import { AiTool, IntegrationCredential, ToolExecutionStatus } from '@prisma/client';
import { aiIntegrationService } from '../ai.integration.service';

export interface ExecuteToolParams {
    toolId: string;
    tenantId: string;
    payload: any;
    threadId?: string;
}

const urlSchema = z.string().url().refine((url) => {
    if (process.env.NODE_ENV === 'development') return true;
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:') return false;
        const host = parsed.hostname;
        if (
            host === 'localhost' ||
            host === '127.0.0.1' ||
            host.startsWith('10.') ||
            host.startsWith('192.168.') ||
            /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)
        ) {
            return false;
        }
        return true;
    } catch {
        return false;
    }
}, { message: "URL inválida o insegura." });

export class ToolExecutorService {

    async execute(params: ExecuteToolParams): Promise<any> {
        const { toolId, tenantId, payload, threadId } = params;
        const startTime = Date.now();
        let executionStatus: ToolExecutionStatus = 'PENDING';
        let responsePayload: any = null;
        let errorMessage: string | null = null;
        const sanitizedRequestPayload = payload;

        try {
            const tool = await prisma.aiTool.findFirst({
                where: { id: toolId, tenantId, isActive: true },
                include: { credential: true }
            });

            if (!tool) {
                throw new Error("Tool no encontrada, inactiva, o no pertenece a este tenant.");
            }

            const parsedUrl = urlSchema.safeParse(tool.endpointUrl);
            if (!parsedUrl.success) {
                throw new Error("El endpoint de la herramienta es inválido o no seguro para ejecución.");
            }

            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            };

            if (tool.credential) {
                const decryptedConfig = await aiIntegrationService.getDecryptedConfig(tenantId, tool.credentialId!);
                this.injectCredentials(headers, tool.credential, decryptedConfig);
            }

            const method = (tool.method || 'POST').toUpperCase().trim();
            const isGetLike = ['GET', 'DELETE'].includes(method);

            console.log(`[ToolExecutor] 🚀 Iniciando llamada | method=${method} | tool=${tool.name}`);
            console.log(`[ToolExecutor] URL Base: ${tool.endpointUrl}`);
            if (isGetLike) {
                console.log(`[ToolExecutor] Query Params:`, JSON.stringify(payload));
            } else {
                console.log(`[ToolExecutor] Body Payload:`, JSON.stringify(payload));
            }

            const response = await axios({
                method,
                url: tool.endpointUrl,
                data: !isGetLike ? payload : undefined,
                params: isGetLike ? payload : undefined,
                headers,
                timeout: tool.timeoutMs || 5000,
                // Evitar que axios serialice el body si es GET (algunos adaptadores fallan)
            });

            responsePayload = response.data;
            executionStatus = 'SUCCESS';

            console.log(`[ToolExecutor] ✅ SUCCESS (${response.status}) | duration=${Date.now() - startTime}ms`);
            return responsePayload;

        } catch (error: any) {
            executionStatus = 'ERROR';
            const duration = Date.now() - startTime;

            if (axios.isAxiosError(error)) {
                const status = error.response?.status;
                const data = error.response?.data;
                errorMessage = data ? JSON.stringify(data) : error.message;
                responsePayload = { statusCode: status, data };
                console.error(`[ToolExecutor] ❌ HTTP ERROR ${status} | tool=${toolId} | msg=${error.message} | duration=${duration}ms`);
            } else {
                errorMessage = error.message;
                console.error(`[ToolExecutor] ❌ SYSTEM ERROR | tool=${toolId} | msg=${errorMessage}`);
            }
            throw new Error(`Fallo ejecucion de herramienta: ${errorMessage}`);

        } finally {
            const durationMs = Date.now() - startTime;
            await prisma.aiToolExecution.create({
                data: {
                    tenantId,
                    toolId,
                    threadId,
                    status: executionStatus,
                    requestPayload: sanitizedRequestPayload || {},
                    responsePayload: responsePayload || {},
                    errorMessage,
                    durationMs
                }
            }).catch(dbErr => {
                console.error("[ToolExecutor] Error crítico guardando ejecución en DB:", dbErr);
            });
        }
    }

    private injectCredentials(headers: Record<string, string>, credential: IntegrationCredential, config: any) {
        if (!config) return;

        switch (credential.authType) {
            case 'BEARER_TOKEN':
                if (config.token) headers['Authorization'] = `Bearer ${config.token}`;
                break;
            case 'API_KEY_HEADER':
                if (config.headerName && (config.headerValue || config.apiKey)) {
                    headers[config.headerName] = config.headerValue || config.apiKey;
                }
                break;
            case 'BASIC_AUTH':
                if (config.username && config.password) {
                    const encoded = Buffer.from(`${config.username}:${config.password}`).toString('base64');
                    headers['Authorization'] = `Basic ${encoded}`;
                }
                break;
            case 'NONE':
            default:
                break;
        }
    }
}

export const toolExecutorService = new ToolExecutorService();
