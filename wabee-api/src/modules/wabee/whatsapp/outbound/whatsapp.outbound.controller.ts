import { Response, NextFunction } from 'express';
import { WhatsAppOutboundService } from './whatsapp.outbound.service';

export async function sendBulkMessages(req: any, res: Response, next: NextFunction) {
    try {
        const tenantId = req.tenantId;
        const { channelId, contactIds, text, template } = req.body;

        if (!channelId) {
            return res.status(400).json({ message: 'channelId es requerido' });
        }

        if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
            return res.status(400).json({ message: 'contactIds debe ser un array no vacío' });
        }

        if (!text && !template) {
            return res.status(400).json({ message: 'Se requiere text o template' });
        }

        const report = await WhatsAppOutboundService.sendBulk({
            tenantId,
            channelId,
            contactIds,
            text,
            template
        });

        res.json(report);
    } catch (error) {
        next(error);
    }
}
