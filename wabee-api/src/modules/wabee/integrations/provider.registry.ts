import { ICrmProvider } from './crm.provider.interface';
import { hubSpotProvider } from './hubspot/hubspot.provider';

// Providers are registered lazily so missing optional deps don't crash startup.
// Each entry is a factory to avoid circular imports.
const REGISTRY: Record<string, () => ICrmProvider> = {
    HUBSPOT:    () => hubSpotProvider,
    PIPEDRIVE:  () => require('./pipedrive/pipedrive.provider').pipedriveProvider,
    ZOHO:       () => require('./zoho/zoho.provider').zohoProvider,
    SALESFORCE: () => require('./salesforce/salesforce.provider').salesforceProvider,
    DYNAMICS365:() => require('./dynamics365/dynamics365.provider').dynamics365Provider,
};

export function getProvider(name: string): ICrmProvider | null {
    const factory = REGISTRY[name.toUpperCase()];
    if (!factory) return null;
    try {
        return factory();
    } catch {
        return null;
    }
}
