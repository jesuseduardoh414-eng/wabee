import { Request, Response } from 'express';
import { prisma } from '@/lib/prisma';
import { aiOrchestratorService, UniversalMessageContext } from './ai.orchestrator.service';
import { v4 as uuidv4 } from 'uuid';

/**
 * AiWhatsappTestController
 * ─────────────────────────────────────────────────────────────────────
 * Endpoint de prueba aislado para el Agente WhatsApp.
 * NO toca el Inbox real, ni contactos reales, ni threads reales.
 *
 * ⚠️  SOLUCIÓN UUID:
 *   - threadId debe ser un UUID real (@db.Uuid en ConversationState)
 *   - sessionId es ya un uuidv4() → se usa directamente como threadId
 *   - El aislamiento se garantiza NO vinculando la sesión al WhatsappThread real
 *   - El ConversationState de prueba vive solo en esa tabla con el threadId-UUID generado
 */
export class AiWhatsappTestController {

    /**
     * POST /v1/wabee/ai-profiles/:id/whatsapp-test
     *
     * Body: { message: string, sessionId?: string }
     *   - sessionId: si el frontend ya tiene una sesión activa, la manda para continuar el contexto
     *
     * Respuesta: { reply, action, sessionId, conversationMode, lifecycleTransition, meta }
     */
    static async testMessage(req: Request, res: Response) {
        try {
            const tenantId = (req as any).tenantId;
            const profileId = req.params.id;
            const { message, sessionId } = req.body;

            if (!message || typeof message !== 'string' || !message.trim()) {
                return res.status(400).json({ error: 'message es requerido' });
            }

            // ── 1. Validar perfil (tenant-safe) ──────────────────────
            const profile = await prisma.aiProfile.findFirst({
                where: { id: profileId, tenantId }
            });

            if (!profile) {
                return res.status(404).json({ error: 'Perfil IA no encontrado o acceso denegado.' });
            }

            if (profile.channelType !== 'WHATSAPP' && profile.channelType !== 'WIDGET') {
                return res.status(400).json({ error: 'Este endpoint prueba perfiles tipo WHATSAPP o WIDGET.' });
            }

            // ── 2. Resolver UUID de sesión ────────────────────────────
            // sessionId ya viene como uuidv4 desde el frontend o lo generamos aquí.
            // LO USAMOS DIRECTAMENTE COMO threadId — es un UUID válido.
            // No prefijamos con "test_" para no romper el tipo @db.Uuid.
            const resolvedSessionId: string = sessionId || uuidv4();

            // threadId = resolvedSessionId (UUID puro — válido para Prisma @db.Uuid)
            const testThreadId: string = resolvedSessionId;

            // ── 3. Asegurar ConversationState de prueba ───────────────
            // Como el threadId es un UUID real (no pertenece a ningún WhatsappThread real),
            // simplemente vivve aislado en la tabla conversation_states.
            let convState = await prisma.conversationState.findUnique({
                where: { threadId: testThreadId }
            });

            if (!convState) {
                convState = await prisma.conversationState.create({
                    data: {
                        tenantId,
                        threadId: testThreadId,  // UUID real ✅
                        mode: 'AI_MANAGED'
                    }
                });
                console.log(`[WA-Test] 🆕 Sesión de prueba creada | sessionId=${resolvedSessionId}`);
            } else {
                console.log(`[WA-Test] 🔁 Sesión reutilizada | mode=${convState.mode} sessionId=${resolvedSessionId}`);
            }

            // ── 4. Construir UniversalMessageContext simulado ─────────
            // No se usa contactId real — se omite para que no toque contactos.
            // channelId tampoco apunta a un canal real.
            const context: UniversalMessageContext = {
                tenantId,
                channelType: profile.channelType as any,
                channelId: `${profileId}`,    // Solo para trazabilidad interna
                threadId: testThreadId,        // UUID real ✅
                contactId: undefined,          // Sin contacto real — no actualiza lifecycle
                userIdentificator: `TEST_${resolvedSessionId.substring(0, 8)}`,
                message: {
                    id: uuidv4(),              // UUID real para el mensaje simulado ✅
                    text: message.trim(),
                    type: 'text'
                },
                aiConfig: {
                    profileId,
                    enabled: true,
                    handoffKeys: ['asesor', 'humano', 'agente', 'quiero hablar con alguien']
                }
            };

            console.log(`[WA-Test] ▶ Mensaje enviado al orquestador | profileId=${profileId} msg="${message.substring(0, 50)}"`);

            // ── 5. Ejecutar el orquestador real ───────────────────────
            const decision = await aiOrchestratorService.processInbound(context);

            // ── 6. Leer el ConversationState actualizado ──────────────
            const updatedState = await prisma.conversationState.findUnique({
                where: { threadId: testThreadId }
            });

            console.log(`[WA-Test] ✅ Resultado: action=${decision.action} | mode=${updatedState?.mode}`);

            return res.json({
                sessionId: resolvedSessionId,   // UUID puro — el frontend lo persiste para la próxima llamada
                action: decision.action,
                reply: decision.replyText || null,
                handoffReason: decision.handoffReason || null,
                conversationMode: updatedState?.mode || 'AI_MANAGED',
                handoffAt: updatedState?.handoffAt || null,
                lifecycleTransition: decision.lifecycleTransition || null,
                meta: {
                    profileId,
                    profileName: profile.name,
                    agentName: profile.agentName,
                    kbChunksUsed: decision.kbChunksUsed?.length || 0,
                    tokensUsed: decision.tokensUsed || 0,
                    intent: decision.meta?.intent || null,
                    kbBestScore: decision.meta?.kbBestScore || null,
                    debug: decision.debug || null
                }
            });

        } catch (error: any) {
            console.error('[WA-Test] ❌ Error en prueba del agente:', error);
            return res.status(500).json({
                error: 'Error ejecutando la prueba del agente.',
                details: error.message
            });
        }
    }

    /**
     * DELETE /v1/wabee/ai-profiles/:id/whatsapp-test/:sessionId
     * Limpia (soft-delete) el ConversationState de la sesión de prueba.
     * sessionId aquí es el UUID del thread de prueba.
     */
    static async clearSession(req: Request, res: Response) {
        try {
            const tenantId = (req as any).tenantId;
            const profileId = req.params.id;
            const sessionId = req.params.sessionId;  // UUID real del thread de prueba

            // Validar acceso al perfil
            const profile = await prisma.aiProfile.findFirst({
                where: { id: profileId, tenantId }
            });
            if (!profile) {
                return res.status(404).json({ error: 'Perfil no encontrado.' });
            }

            // Eliminar solo por tenantId + threadId (doble validación tenant)
            const deleted = await prisma.conversationState.deleteMany({
                where: {
                    tenantId,
                    threadId: sessionId   // UUID real ✅
                }
            });

            console.log(`[WA-Test] 🗑️ Sesión limpiada | sessionId=${sessionId} profileId=${profileId} deleted=${deleted.count}`);
            return res.json({ message: 'Sesión de prueba reiniciada.', sessionId, deleted: deleted.count });

        } catch (error: any) {
            console.error('[WA-Test] ❌ Error limpiando sesión:', error);
            return res.status(500).json({ error: 'Error al limpiar la sesión.' });
        }
    }
}
