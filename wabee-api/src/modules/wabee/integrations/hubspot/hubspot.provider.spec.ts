import { describe, it, expect } from 'vitest';
import { hubSpotProvider } from './hubspot.provider';

describe('HubSpotProvider.buildAuthUrl', () => {

    const redirectUri = 'https://wabee-api.onrender.com/oauth/hubspot/callback';
    const state = 'estado-codificado-base64url';

    it('apunta al endpoint de autorización de HubSpot', () => {
        const url = hubSpotProvider.buildAuthUrl(redirectUri, state);
        expect(url.startsWith('https://app.hubspot.com/oauth/authorize')).toBe(true);
    });

    it('incluye el redirect_uri codificado', () => {
        const url = hubSpotProvider.buildAuthUrl(redirectUri, state);
        expect(url).toContain(encodeURIComponent(redirectUri));
    });

    it('incluye el state', () => {
        const url = hubSpotProvider.buildAuthUrl(redirectUri, state);
        expect(url).toContain(`state=${state}`);
    });

    it('solicita los scopes de contactos y deals', () => {
        const url = hubSpotProvider.buildAuthUrl(redirectUri, state);
        const decoded = decodeURIComponent(url);
        expect(decoded).toContain('crm.objects.contacts.read');
        expect(decoded).toContain('crm.objects.contacts.write');
        expect(decoded).toContain('crm.objects.deals.read');
        expect(decoded).toContain('crm.objects.deals.write');
    });

    it('expone el nombre de proveedor correcto', () => {
        expect(hubSpotProvider.providerName).toBe('HUBSPOT');
    });
});
