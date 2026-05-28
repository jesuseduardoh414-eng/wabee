import { env } from '@/config/env';
import { prisma } from '@/lib/prisma';
import { widgetCache } from './widget.cache';
import { CreateWebWidgetInput } from './webwidget.schemas';
import { aiWidgetResponderService } from '../ai/ai.widgetResponder.service';
import { withDbRetry } from '@/utils/db.utils';
import { AnalyticsService } from '../analytics/analytics.service';
import { GlobalAuditLogService } from '@/modules/audit/global-audit-log.service';
import { coreAdapter } from '@/modules/core/core.adapter';

// Deep merge helper
function deepMerge(target: any, source: any) {
    if (typeof target !== 'object' || target === null) return source;
    if (typeof source !== 'object' || source === null) return source;

    const output = { ...target };
    Object.keys(source).forEach(key => {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            if (!(key in target)) Object.assign(output, { [key]: source[key] });
            else output[key] = deepMerge(target[key], source[key]);
        } else {
            Object.assign(output, { [key]: source[key] });
        }
    });
    return output;
}

export class WebWidgetService {
    // --- Admin Logic ---
    static async getWidgets(tenantId: string) {
        return await prisma.webWidget.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'desc' }
        });
    }

    static async createWebWidget(tenantId: string, data: CreateWebWidgetInput) {
        // Enforce single widget per tenant
        const existing = await prisma.webWidget.findFirst({
            where: { tenantId }
        });

        if (existing) {
            throw { status: 409, message: 'Widget already exists for this organization' };
        }

        // Map legacy top-level fields to json structure if missing
        const content = data.content || {
            title: data.title,
            subtitle: data.subtitle,
            welcomeMessage: data.welcomeMessage,
        };

        const ai = data.ai || {
            enabled: data.aiEnabled
        };

        return await prisma.webWidget.create({
            data: {
                tenantId,
                title: data.title,
                subtitle: data.subtitle,
                welcomeMessage: data.welcomeMessage,
                domainAllowed: data.domainAllowed || [],
                aiEnabled: data.aiEnabled || false,
                content: content as any,
                theme: (data.theme || {}) as any,
                ai: ai as any,
                features: (data.features || {}) as any
            }
        });
    }

    static async getWidgetById(tenantId: string, id: string) {
        return await prisma.webWidget.findUnique({
            where: { id, tenantId }
        });
    }

    static async updateWebWidget(tenantId: string, id: string, data: any) {
        const existing = await prisma.webWidget.findUnique({ where: { id, tenantId } });
        if (!existing) throw { status: 404, message: 'Widget not found' };

        // Normalize domains if present
        let domainAllowed = existing.domainAllowed;
        if (data.domainAllowed && Array.isArray(data.domainAllowed)) {
            domainAllowed = data.domainAllowed
                .map((d: string) => d.toLowerCase().trim())
                .filter((d: string) => d.length > 0);
        }

        // Deep merge JSON fields
        const content = deepMerge(existing.content || {}, data.content || {});
        // Also update legacy top-level fields for backwards compatibility
        if (content.title !== undefined) data.title = content.title;
        if (content.subtitle !== undefined) data.subtitle = content.subtitle;
        if (content.welcomeMessage !== undefined) data.welcomeMessage = content.welcomeMessage;

        const theme = deepMerge(existing.theme || {}, data.theme || {});
        let ai = deepMerge(existing.ai || {}, data.ai || {});

        // Normalize confidenceThreshold on save
        if (ai.confidenceThreshold !== undefined) {
            const val = typeof ai.confidenceThreshold === 'number' ? ai.confidenceThreshold : Number(ai.confidenceThreshold);
            if (Number.isFinite(val)) {
                const norm = val > 1 ? val / 100 : val;
                ai.confidenceThreshold = Math.max(0, Math.min(1, norm));
            }
        }

        if (ai.enabled !== undefined) data.aiEnabled = ai.enabled;

        const features = deepMerge(existing.features || {}, data.features || {});

        const updatedWidget = await prisma.webWidget.update({
            where: { id, tenantId },
            data: {
                title: data.title,
                subtitle: data.subtitle,
                welcomeMessage: data.welcomeMessage,
                domainAllowed,
                aiEnabled: data.aiEnabled,
                content: content as any,
                theme: theme as any,
                ai: ai as any,
                features: features as any,
            }
        });

        // Invalidar y refrescar caché proactivamente
        widgetCache.delete(id);
        widgetCache.set(id, updatedWidget);

        return updatedWidget;
    }

    // --- Public Logic ---
    static async validateWidgetDomain(widgetId: string, originOrReferer: string | undefined): Promise<any> {
        const start = Date.now();
        let widget = widgetCache.get(widgetId);

        if (!widget) {
            widget = await withDbRetry(async () => {
                const found = await prisma.webWidget.findUnique({
                    where: { id: widgetId }
                });

                if (!found) {
                    throw { status: 404, message: 'Widget not found' };
                }
                return found;
            }, { label: 'WIDGET_CONFIG' });

            widgetCache.set(widgetId, widget);
        }

        if (!widget) {
            console.error(`[WebWidgetService] Widget not found: ${widgetId}`);
            throw { status: 404, message: 'Widget not found' };
        }

        // Normalization Helper: Extracts clean hostname
        const normalizeHost = (url: string | undefined): string => {
            if (!url) return '';
            try {
                const fullUrl = url.includes('://') ? url : `http://${url}`;
                const parsed = new URL(fullUrl);
                let hostname = parsed.hostname.toLowerCase();
                if (hostname.startsWith('www.')) {
                    hostname = hostname.substring(4);
                }
                return hostname;
            } catch (e) {
                return url.toLowerCase()
                    .replace(/^(https?:\/\/)/, '')
                    .split('/')[0]
                    .split(':')[0]
                    .replace(/^www\./, '');
            }
        };

        const currentHost = normalizeHost(originOrReferer);
        const allowedDomains = (widget.domainAllowed as string[]) || [];
        const isDev = env.NODE_ENV === 'development';

        // LOGGING detallado para trazabilidad
        console.log(`[WABEE-WIDGET][PUBLIC] Validación de dominio:
  widgetId:        ${widgetId}
  tenantId:        ${widget.tenantId}
  origin/referer:  ${originOrReferer || 'N/A'}
  host_normalizado: ${currentHost}
  dominios_permitidos: [${allowedDomains.join(', ')}]
  aiEnabled:       ${widget.aiEnabled}
  entorno:         ${env.NODE_ENV}
  ruta:            PUBLIC`);

        // 1. OPEN MODE: Si no hay dominios configurados, acceso libre (setup inicial / sin restricciones)
        if (allowedDomains.length === 0) {
            console.log(`[WABEE-WIDGET][PUBLIC] Resultado: PERMITIDO (Open Mode - sin restricción de dominios)`);
            return widget;
        }

        // 2. LOCALHOST EXCEPTION: Siempre permitir en desarrollo local
        if (isDev && (currentHost === 'localhost' || currentHost === '127.0.0.1')) {
            console.log(`[WABEE-WIDGET][PUBLIC] Resultado: PERMITIDO (Excepción Localhost Dev)`);
            return widget;
        }

        // 3. STRICT CHECK: El dominio debe estar en la lista permitida
        const isAllowed = allowedDomains.some(d => {
            const cleanD = normalizeHost(d);
            return cleanD === currentHost || d === '*';
        });

        const duration = Date.now() - start;

        if (isAllowed) {
            console.log(`[WABEE-WIDGET][PUBLIC] Resultado: PERMITIDO (dominio autorizado) ms=${duration}`);
            return widget;
        }

        console.warn(`[WABEE-WIDGET][PUBLIC] Resultado: DENEGADO
  motivo: Host '${currentHost}' no está autorizado para widgetId '${widgetId}'
  dominios_permitidos: [${allowedDomains.join(', ')}]
  ms=${duration}`);

        // Audit Security Failure (Domain Denial)
        await GlobalAuditLogService.logEvent({
            category: 'widget',
            eventType: 'widget.domain_denied',
            severity: 'warning',
            outcome: 'failure',
            message: `Acceso denegado: Host '${currentHost}' no autorizado para widget ${widgetId}`,
            targetType: 'web_widget',
            targetId: widgetId,
            metadata: { 
                host: currentHost, 
                origin: originOrReferer, 
                allowedDomains,
                affectedTenantId: widget.tenantId 
            },
            affectedTenantId: widget.tenantId
        });

        throw { status: 403, message: 'Domain not authorized for this widget' };
    }

    static async getPublicConfig(widgetId: string, origin: string | undefined) {
        const widget = await this.validateWidgetDomain(widgetId, origin);

        // Merge legacy fields with json fields to ensure complete data
        const rawContent = (widget.content as any) || {};
        const content = {
            ...rawContent,
            title: rawContent.title || widget.title,
            subtitle: rawContent.subtitle || widget.subtitle || "",
            welcomeMessage: rawContent.welcomeMessage || widget.welcomeMessage
        };

        const ai = {
            enabled: widget.aiEnabled,
            ...(widget.ai as any || {})
        };

        return {
            widgetId: widget.id,
            content,
            theme: widget.theme || {},
            ai,
            features: widget.features || {}
        };
    }

    /**
     * SHARED FLOW: Núcleo de procesamiento reutilizado tanto por el endpoint público
     * como por el endpoint interno de preview. No hace validación de dominio.
     */
    static async executeWidgetMessageFlow(
        widget: any,
        visitorId: string,
        sessionId: string | undefined,
        text: string,
        previewConfig?: any
    ): Promise<{ type: string; message?: any; text?: string }> {
        const tenantId = widget.tenantId;

        // Encontrar o crear conversación
        let thread = await prisma.webThread.findFirst({
            where: {
                tenantId,
                widgetId: widget.id,
                visitorId,
                status: 'OPEN'
            },
            orderBy: { createdAt: 'desc' }
        });

        if (!thread) {
            thread = await prisma.webThread.create({
                data: {
                    tenantId,
                    widgetId: widget.id,
                    visitorId,
                    sessionId: sessionId || null,
                    status: 'OPEN'
                }
            });

            AnalyticsService.emitEvent({
                tenantId,
                eventType: 'THREAD_CREATED',
                channel: 'web',
                threadId: thread.id,
                meta: { visitorId, sessionId }
            });
        }

        // Persistir mensaje del usuario
        const message = await prisma.webMessage.create({
            data: {
                tenantId,
                threadId: thread.id,
                direction: 'INBOUND',
                actorType: 'USER',
                text
            }
        });

        AnalyticsService.emitEvent({
            tenantId,
            eventType: 'MESSAGE_INBOUND_USER',
            channel: 'web',
            threadId: thread.id,
            meta: { messageId: message.id }
        });

        await prisma.webThread.update({
            where: { id: thread.id },
            data: { lastMessageAt: new Date() }
        });

        // === Flujo de IA ===
        const ALWAYS = env.AI_WIDGET_ALWAYS_RESPOND === 'true';
        if (env.ENABLE_AI_WIDGET === 'true' || ALWAYS) {
            try {
                const aiResult = await aiWidgetResponderService.decideAndRespondWebWidget(
                    tenantId,
                    widget.id,
                    thread.id,
                    message,
                    previewConfig
                );

                if (aiResult.type === 'AI_MESSAGE' && aiResult.message) {
                    return {
                        type: 'AI_MESSAGE',
                        message: {
                            id: aiResult.message.id,
                            textBody: aiResult.message.text,
                            role: 'ASSISTANT',
                            origin: 'AI',
                            createdAt: aiResult.message.createdAt
                        }
                    };
                }

                if (aiResult.type === 'FALLBACK' || aiResult.type === 'BLOCKED') {
                    return {
                        type: 'FALLBACK',
                        text: aiResult.fallbackText || 'Gracias por tu mensaje. Un agente te atenderá pronto.'
                    };
                }

            } catch (error: any) {
                console.error('[WebWidgetService] Error en flujo de IA:', error);
                
                // Audit Technical Failure (AI Flow)
                await GlobalAuditLogService.logEvent({
                    category: 'widget',
                    eventType: 'widget.ai_flow.failed',
                    severity: 'critical',
                    outcome: 'failure',
                    message: `Fallo crítico en motor de IA (Widget): ${error.message}`,
                    targetType: 'web_widget',
                    targetId: widget.id,
                    metadata: { 
                        threadId: thread.id, 
                        error: error.message,
                        affectedTenantId: tenantId
                    },
                    affectedTenantId: tenantId
                });

                return {
                    type: 'FALLBACK',
                    text: 'Gracias por tu mensaje. Un agente te atenderá pronto.'
                };
            }
        }

        // Respuesta por defecto (sin IA o IA deshabilitada)
        return {
            type: 'FALLBACK',
            text: 'Gracias por tu mensaje. Un agente te atenderá pronto.'
        };
    }

    /**
     * ENDPOINT PÚBLICO: Valida dominio y delega al shared flow.
     */
    static async processInboundMessage(
        widgetId: string,
        visitorId: string,
        sessionId: string | undefined,
        text: string,
        origin?: string,
        previewConfig?: any
    ) {
        const widget = await this.validateWidgetDomain(widgetId, origin);
        return this.executeWidgetMessageFlow(widget, visitorId, sessionId, text, previewConfig);
    }

    /**
     * ENDPOINT INTERNO DE PREVIEW: Solo verifica ownership por tenantId.
     * No valida dominio. Requiere sesión autenticada del dashboard.
     */
    static async processPreviewMessage(
        userId: string,
        widgetId: string,
        visitorId: string,
        sessionId: string | undefined,
        text: string,
        previewConfig?: any
    ) {
        // 1. Buscar el widget y extraer su tenantId
        const widget = await prisma.webWidget.findUnique({
            where: { id: widgetId }
        });

        if (!widget) {
            console.warn(`[WABEE-WIDGET][PREVIEW] Widget no encontrado: widgetId=${widgetId}`);
            throw { status: 404, message: 'Widget not found' };
        }

        const tenantId = widget.tenantId;

        // 2. Verificar que el usuario pertenece a esa organización (y no está suspendido)
        const membership = await coreAdapter.organizations.getMembership(tenantId, userId);

        if (!membership) {
            console.warn(`[WABEE-WIDGET][PREVIEW] Acceso denegado (No Owner):
  widgetId: ${widgetId}
  userId: ${userId}
  tenantId_widget: ${tenantId}`);
            throw { status: 403, message: 'No tienes acceso a este widget' };
        }

        if (membership.status === 'suspended') {
            console.warn(`[WABEE-WIDGET][PREVIEW] Acceso denegado (Suspendido): userId=${userId} tenantId=${tenantId}`);
            throw { status: 403, message: 'Tu acceso a esta organización está suspendido.' };
        }

        console.log(`[WABEE-WIDGET][PREVIEW] Procesando mensaje interno:
  widgetId: ${widgetId}
  userId: ${userId}
  tenantId_resuelto: ${tenantId}
  visitorId: ${visitorId}
  aiEnabled: ${widget.aiEnabled}
  ruta: PREVIEW_INTERNAL (membership validado)`);

        return this.executeWidgetMessageFlow(widget, visitorId, sessionId, text, previewConfig);
    }

    static async getThreadHistory(widgetId: string, visitorId: string, origin?: string) {
        const widget = await this.validateWidgetDomain(widgetId, origin);
        const tenantId = widget.tenantId;

        const thread = await prisma.webThread.findFirst({
            where: {
                tenantId,
                widgetId,
                visitorId,
                status: 'OPEN'
            },
            include: {
                messages: {
                    orderBy: { createdAt: 'asc' },
                    take: 50
                }
            }
        });

        // Prepare config for return
        const rawContent = (widget.content as any) || {};
        const content = {
            ...rawContent,
            title: rawContent.title || widget.title,
            subtitle: rawContent.subtitle || widget.subtitle || "",
            welcomeMessage: rawContent.welcomeMessage || widget.welcomeMessage
        };

        const config = {
            title: content.title,
            subtitle: content.subtitle,
            welcomeMessage: content.welcomeMessage,
            theme: widget.theme,
            features: widget.features
        };

        if (!thread) {
            return {
                thread: null,
                messages: [],
                widget: config
            };
        }

        return {
            thread,
            messages: thread.messages,
            widget: config
        };
    }
}
