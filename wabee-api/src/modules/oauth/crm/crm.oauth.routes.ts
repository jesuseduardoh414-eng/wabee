import { Router } from 'express';
import { oauthStart, oauthCallback } from './crm.oauth.controller';

const router = Router();

// Covers Zoho, Salesforce, Dynamics 365 (not Pipedrive — uses API key)
router.get('/:provider/start',    oauthStart);
router.get('/:provider/callback', oauthCallback);

export default router;
