import { core } from '../../config/core/core.infra';
import { coreAdapter } from '../core/core.adapter';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../../config/core/core.prisma';

export enum DeletionRequestStatus {
    PENDING = 'PENDING',
    IN_REVIEW = 'IN_REVIEW',
    CONFIRMED = 'CONFIRMED',
    COMPLETED = 'COMPLETED',
    REJECTED = 'REJECTED',
    SPAM = 'SPAM'
}

export class DataDeletionService {
    /**
     * Crea una nueva solicitud de eliminación de datos (Público).
     * Incluye validación automática contra contactos existentes.
     */
    static async createRequest(data: { fullName: string; email: string; phone?: string; description?: string }) {
        const id = uuidv4();
        
        // 1. Validar si existe el dato en el sistema (Organization, Channel o Contact)
        const [orgMatch, channelMatch, contactMatch] = await Promise.all([
            coreAdapter.organizations.findByEmail(data.email),
            data.phone ? (prisma as any).whatsappChannel.findFirst({ where: { displayPhone: data.phone } }) : null,
            (prisma as any).contact.findFirst({
                where: {
                    OR: [
                        { email: data.email },
                        data.phone ? { phone: data.phone } : undefined
                    ].filter(Boolean)
                }
            })
        ]);

        const hasMatch = !!(orgMatch || channelMatch || contactMatch);
        const status = hasMatch ? DeletionRequestStatus.PENDING : DeletionRequestStatus.SPAM;
        
        // Nota interna para auditoría de Super Admin
        let internalNote = null;
        if (!hasMatch) {
            internalNote = 'No se encontró información asociada (Email/Teléfono)';
        } else if (orgMatch) {
            internalNote = `Coincidencia con Organización: ${orgMatch.name}`;
        } else if (channelMatch) {
            internalNote = `Coincidencia con Canal WhatsApp: ${channelMatch.name}`;
        } else if (contactMatch) {
            internalNote = `Coincidencia con Contacto: ${contactMatch.name}`;
        }

        // 2. Insertar solicitud mediante el adaptador
        await coreAdapter.system.privacy.createRequest({ 
            id, 
            fullName: data.fullName, 
            email: data.email, 
            phone: data.phone, 
            description: data.description, 
            status, 
            hasMatch, 
            internalNote 
        });
        
        return { id, status, hasMatch };
    }

    /**
     * Lista todas las solicitudes para Super Admin.
     */
    static async listRequests() {
        return await coreAdapter.system.privacy.listRequests();
    }

    /**
     * Obtiene una solicitud por ID.
     */
    static async getRequestById(id: string) {
        return await coreAdapter.system.privacy.getRequestById(id);
    }

    /**
     * Elimina físicamente una solicitud (Reservado para limpieza de SPAM).
     */
    static async deleteRequest(id: string) {
        return await coreAdapter.system.privacy.deleteRequest(id);
    }

    /**
     * Actualiza el estado de una solicitud.
     */
    static async updateStatus(id: string, status: DeletionRequestStatus, reviewerId?: string) {
        await coreAdapter.system.privacy.updateStatus(id, status as any, reviewerId);

        const updatedRequest = await this.getRequestById(id);

        // ENVIAR NOTIFICACIÓN SI ENTRA EN REVISIÓN
        if (status === DeletionRequestStatus.IN_REVIEW && updatedRequest) {
            try {
                console.log(`[DataDeletion] Enviando correo de confirmación a: ${updatedRequest.email}`);
                await core.notifications.send({
                    to: updatedRequest.email,
                    channel: 'email',
                    templateName: 'DATA_DELETION_CONFIRMATION',
                    subject: 'Revisión: Solicitud de Eliminación de Datos',
                    content: 'Hola {{fullName}},<br><br>Hemos recibido una solicitud para la eliminación de tus datos asociados a este correo electrónico.<br><br>Para proceder con la eliminación y confirmar que solicitaste esta acción, por favor haz clic en el botón de confirmar de abajo o contáctanos haciendo referencia a tu ID de solicitud: <strong>{{requestId}}</strong>.<br><br>Fecha de Solicitud: {{requestedAt}}',
                    data: {
                        fullName: updatedRequest.fullName,
                        requestId: updatedRequest.id,
                        requestedAt: new Date(updatedRequest.requestedAt).toLocaleDateString(),
                        link: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/data-deletion/confirm/${updatedRequest.id}`,
                        cta_override: 'Confirmar solicitud'
                    }
                });
            } catch (notifyErr) {
                console.error('[DataDeletion] Error al enviar notificación:', notifyErr);
            }
        }

        return updatedRequest;
    }

    /**
     * Confirma una solicitud desde el correo del usuario
     */
    static async confirmRequest(id: string) {
        const request = await this.getRequestById(id);
        if (!request) throw new Error('Solicitud no encontrada');

        if (request.status !== DeletionRequestStatus.IN_REVIEW) {
            throw new Error('La solicitud no está en revisión o ya fue procesada.');
        }

        return await this.updateStatus(id, DeletionRequestStatus.CONFIRMED);
    }

    /**
     * Ejecuta la anonimización de contactos que coincidan con la solicitud.
     */
    static async completeAndAnonymize(id: string, reviewerId: string) {
        const request = await this.getRequestById(id);
        if (!request) throw new Error('Solicitud no encontrada');

        // VALIDACIÓN DE SEGURIDAD: Solo anonimizar si hubo match
        if (!request.hasMatch) {
            throw new Error('No se puede anonimizar una solicitud sin contacto asociado (SPAM)');
        }

        const { email, phone } = request;
        
        // 1. Buscar todos los contactos que coincidan por email o teléfono
        const contacts = await (prisma as any).contact.findMany({
            where: {
                OR: [
                    { email: email },
                    phone ? { phone: phone } : undefined
                ].filter(Boolean)
            }
        });

        console.log(`[DataDeletion] Se encontraron ${contacts.length} contactos para anonimizar.`);

        // 2. Anonimizar cada contacto
        for (const contact of contacts) {
            await (prisma as any).contact.update({
                where: { id: contact.id },
                data: {
                    name: 'Usuario eliminado',
                    email: null,
                    phone: `deleted_${contact.id}`
                }
            });
        }

        // 3. Marcar la solicitud como completada
        return await this.updateStatus(id, DeletionRequestStatus.COMPLETED, reviewerId);
    }
}
