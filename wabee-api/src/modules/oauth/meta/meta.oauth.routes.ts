import { Router } from 'express';
import * as metaOauthController from './meta.oauth.controller';

const router = Router();

// Start flow (Public entry point, internal tenant resolution)
router.get('/meta/start', metaOauthController.oauthStart);

// Callback from Meta (Public)
router.get('/meta/callback', metaOauthController.oauthCallback);

export default router;
