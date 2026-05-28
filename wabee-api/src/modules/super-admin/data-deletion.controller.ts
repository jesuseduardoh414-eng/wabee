import { Request, Response } from 'express';
import { DataDeletionService, DeletionRequestStatus } from './data-deletion.service';

/**
 * Endpoint Público: Crear una solicitud de eliminación de datos.
 */
export async function createPublicRequest(req: Request, res: Response) {
    try {
        const { fullName, email, phone, description } = req.body;

        if (!fullName || !email || !phone) {
            return res.status(400).json({ message: 'Nombre, email y teléfono son obligatorios.' });
        }

        const request = await DataDeletionService.createRequest({
            fullName,
            email,
            phone,
            description
        });

        res.status(201).json({
            success: true,
            message: 'Solicitud recibida correctamente.',
            data: { id: request.id }
        });
    } catch (error) {
        console.error('[DataDeletionController] Error createPublicRequest:', error);
        res.status(500).json({ message: 'Error al procesar la solicitud.' });
    }
}

/**
 * Endpoint Público: Confirmar una solicitud de eliminación de datos.
 */
export async function confirmPublicRequest(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const request = await DataDeletionService.confirmRequest(id);

        res.json({
            success: true,
            message: 'Solicitud confirmada exitosamente.',
            data: request
        });
    } catch (error: any) {
        console.error('[DataDeletionController] Error confirmPublicRequest:', error);
        res.status(400).json({ message: error.message || 'Error al confirmar la solicitud.' });
    }
}

/**
 * Super Admin: Listar solicitudes.
 */
export async function listRequests(req: any, res: Response) {
    try {
        const requests = await DataDeletionService.listRequests();
        res.json({ success: true, data: requests });
    } catch (error) {
        console.error('[DataDeletionController] Error listRequests:', error);
        res.status(500).json({ message: 'Error al obtener las solicitudes.' });
    }
}

/**
 * Super Admin: Obtener detalle de una solicitud.
 */
export async function getRequestDetail(req: any, res: Response) {
    try {
        const { id } = req.params;
        const request = await DataDeletionService.getRequestById(id);
        
        if (!request) {
            return res.status(404).json({ message: 'Solicitud no encontrada.' });
        }

        res.json({ success: true, data: request });
    } catch (error) {
        console.error('[DataDeletionController] Error getRequestDetail:', error);
        res.status(500).json({ message: 'Error al obtener el detalle.' });
    }
}

/**
 * Super Admin: Actualizar estado.
 */
export async function updateRequestStatus(req: any, res: Response) {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!Object.values(DeletionRequestStatus).includes(status)) {
            return res.status(400).json({ message: 'Estado no válido.' });
        }

        const request = await DataDeletionService.updateStatus(id, status, req.user.id);
        res.json({ success: true, data: request });
    } catch (error) {
        console.error('[DataDeletionController] Error updateRequestStatus:', error);
        res.status(500).json({ message: 'Error al actualizar el estado.' });
    }
}

/**
 * Super Admin: Completar y anonimizar.
 */
export async function completeAndAnonymize(req: any, res: Response) {
    try {
        const { id } = req.params;
        const reviewerId = req.user.id;

        const result = await DataDeletionService.completeAndAnonymize(id, reviewerId);
        
        res.json({
            success: true,
            message: 'Anonimización completada exitosamente.',
            data: result
        });
    } catch (error: any) {
        console.error('[DataDeletionController] Error completeAndAnonymize:', error);
        res.status(500).json({ message: error.message || 'Error al completar la anonimización.' });
    }
}

/**
 * Super Admin: Eliminar solicitud (Físico).
 */
export async function deleteRequest(req: any, res: Response) {
    try {
        const { id } = req.params;
        await DataDeletionService.deleteRequest(id);
        res.json({ success: true, message: 'Solicitud eliminada correctamente.' });
    } catch (error) {
        console.error('[DataDeletionController] Error deleteRequest:', error);
        res.status(500).json({ message: 'Error al eliminar la solicitud.' });
    }
}
