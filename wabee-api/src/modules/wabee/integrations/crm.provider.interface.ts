import { CrmSyncStatus, SyncDirection } from '@prisma/client';

// ── Entidades normalizadas (agnósticas al proveedor) ──────────────────────────

export interface CrmContact {
    externalId: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    lifecycleStage?: string;
    meta?: Record<string, any>;
}

export interface CrmDeal {
    externalId: string;
    name: string;
    stage?: string;
    amount?: number;
    contactExternalId?: string;
    meta?: Record<string, any>;
}

export interface SyncResult {
    entityType: string;
    entityId?: string;
    operation: string;
    direction: SyncDirection;
    status: CrmSyncStatus;
    errorMessage?: string;
    meta?: Record<string, any>;
}

// ── Interface que todo conector CRM debe implementar ─────────────────────────

export interface ICrmProvider {
    /** Identifier matching the CrmProvider enum value */
    readonly providerName: string;

    /** Exchange auth code for tokens (OAuth flow) */
    exchangeCode(code: string, redirectUri: string): Promise<{
        accessToken: string;
        refreshToken?: string;
        expiresAt?: Date;
        scopes: string[];
    }>;

    /** Refresh an expired access token */
    refreshAccessToken(refreshToken: string): Promise<{
        accessToken: string;
        expiresAt?: Date;
    }>;

    /** Push a Wabee contact to the CRM */
    pushContact(accessToken: string, contact: CrmContact): Promise<SyncResult>;

    /** Pull contacts updated after a given date */
    pullContacts(accessToken: string, since?: Date): Promise<CrmContact[]>;

    /** Push a deal/opportunity to the CRM */
    pushDeal(accessToken: string, deal: CrmDeal): Promise<SyncResult>;

    /** Pull deals updated after a given date */
    pullDeals(accessToken: string, since?: Date): Promise<CrmDeal[]>;

    /** Build the OAuth authorization URL to redirect the user to */
    buildAuthUrl(redirectUri: string, state: string): string;
}
