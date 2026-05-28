
import { Router } from 'express';
import { tenantMiddleware } from '@/middleware/tenant';
import { prisma } from '@/lib/prisma';

const router = Router();
router.use(tenantMiddleware);

router.get('/', async (req: any, res) => {
    try {
        const tenantId = req.tenantId;
        const channels = await prisma.whatsappChannel.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'desc' }
        });
        res.json(channels);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
