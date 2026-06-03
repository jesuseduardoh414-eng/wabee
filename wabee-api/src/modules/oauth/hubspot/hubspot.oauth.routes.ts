import { Router } from 'express';
import { oauthStart, oauthCallback } from './hubspot.oauth.controller';

const router = Router();

router.get('/hubspot/start',    oauthStart);
router.get('/hubspot/callback', oauthCallback);

export default router;
