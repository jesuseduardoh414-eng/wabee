import { Router } from 'express';
import { prisma } from '../../config/core/core.prisma';
import { coreAdapter } from '../core/core.adapter';
import { CoreInternalService } from '../core/core.internal.service';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireSuperAdmin } from '../../middleware/auth-role.middleware';
import jwt from 'jsonwebtoken';
import { coreEnv } from '../../config/core/core.env';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { uploadBranding, deleteBranding } from '../../lib/supabase-storage';
import { z } from 'zod';
import { GlobalAuditLogService } from '../audit/global-audit-log.service';
import { getAuditContext } from '../../shared/http/request-audit-context';
import { superAdminAuditRoutes } from './super-admin-audit.routes';
import { EmailTemplateRendererService } from '../wabee/email-customization/email-template-renderer.service';
import { DEFAULT_EMAIL_GLOBAL, DEFAULT_EMAIL_TEMPLATES, SUPPORTED_EMAIL_TEMPLATE_CODES } from '../wabee/email-customization/email-defaults';
import { env } from '../../config/env';

const router = Router();

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 } // 2MB
});

const GLOBAL_BRANDING_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const GLOBAL_BRANDING_THEME_ID = '00000000-0000-0000-0000-000000000001';

type BrandingAssetType = 'LOGO' | 'FAVICON';
type GlobalBrandingPayload = {
    logoUrl: string | null;
    faviconUrl: string | null;
    updatedAt: string | null;
};

// Compatibilidad temporal: las rutas legacy más abajo siguen referenciando este helper,
// pero las rutas activas de branding ya no dependen de Supabase.
const ensureGlobalBrandingTheme = async () => {
    const now = new Date();
    return prisma.ui_themes.upsert({
        where: { id: GLOBAL_BRANDING_THEME_ID },
        update: {
            updated_at: now,
            status: 'ACTIVE',
            is_active: true,
            scope: 'global'
        },
        create: {
            id: GLOBAL_BRANDING_THEME_ID,
            tenant_id: GLOBAL_BRANDING_TENANT_ID,
            name: 'Global Platform Branding',
            description: 'Tema técnico para branding global de plataforma',
            scope: 'global',
            status: 'ACTIVE',
            is_active: true,
            tokens: {},
            presets: {},
            created_by_user_id: null,
            updated_at: now
        }
    });
};

/** Extrae el nombre de archivo del storage_key o public_url de Supabase */
const getBrandingFileNameFromStorageKey = (storageKey?: string | null): string | null => {
    if (!storageKey) return null;
    // storage_key format: "wabee-branding/logo_uuid.png"
    const prefix = 'wabee-branding/';
    if (storageKey.includes(prefix)) return storageKey.split(prefix).pop() || null;
    // legacy: "uploads/branding/logo_uuid.png"
    const legacyPrefix = 'uploads/branding/';
    if (storageKey.includes(legacyPrefix)) return storageKey.split(legacyPrefix).pop() || null;
    return null;
};

const getGlobalBrandingFromWabee = async (): Promise<GlobalBrandingPayload> => {
    const assets = await prisma.ui_theme_assets.findMany({
        where: { theme_id: GLOBAL_BRANDING_THEME_ID }
    });

    const logo = assets.find((asset) => asset.asset_type === 'LOGO');
    const favicon = assets.find((asset) => asset.asset_type === 'FAVICON');
    const updatedAt = [...assets]
        .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())[0]?.created_at ?? null;

    return {
        logoUrl: logo?.public_url ?? null,
        faviconUrl: favicon?.public_url ?? null,
        updatedAt: updatedAt ? updatedAt.toISOString() : null
    };
};

const saveBrandingAsset = async (
    assetType: BrandingAssetType,
    file: Express.Multer.File,
    userId?: string | null
) => {
    await ensureGlobalBrandingTheme();

    const fileExt = file.mimetype.includes('svg')
        ? 'svg'
        : file.mimetype.includes('icon')
            ? 'ico'
            : (file.originalname.split('.').pop() || file.mimetype.split('/')[1] || 'bin').toLowerCase();

    const fileName = `${assetType.toLowerCase()}_${uuidv4()}.${fileExt}`;

    // Upload a Supabase Storage (bucket público)
    const publicUrl = await uploadBranding(fileName, file.buffer, file.mimetype);

    const previous = await prisma.ui_theme_assets.findFirst({
        where: { theme_id: GLOBAL_BRANDING_THEME_ID, asset_type: assetType as any }
    });

    const asset = await prisma.ui_theme_assets.upsert({
        where: {
            theme_id_asset_type: {
                theme_id: GLOBAL_BRANDING_THEME_ID,
                asset_type: assetType as any
            }
        },
        update: {
            label: assetType === 'LOGO' ? 'Logo global de plataforma' : 'Favicon global de plataforma',
            storage_key: `wabee-branding/${fileName}`,
            public_url: publicUrl,
            mime_type: file.mimetype,
            size_bytes: file.size,
            meta: {
                uploadedByUserId: userId ?? null,
                originalName: file.originalname
            }
        },
        create: {
            id: uuidv4(),
            tenant_id: GLOBAL_BRANDING_TENANT_ID,
            theme_id: GLOBAL_BRANDING_THEME_ID,
            asset_type: assetType as any,
            label: assetType === 'LOGO' ? 'Logo global de plataforma' : 'Favicon global de plataforma',
            storage_key: `wabee-branding/${fileName}`,
            public_url: publicUrl,
            mime_type: file.mimetype,
            size_bytes: file.size,
            meta: {
                uploadedByUserId: userId ?? null,
                originalName: file.originalname
            }
        }
    });

    // Eliminar archivo anterior de Supabase Storage
    if (previous?.storage_key && previous.storage_key !== `wabee-branding/${fileName}`) {
        const oldFileName = getBrandingFileNameFromStorageKey(previous.storage_key);
        if (oldFileName) {
            deleteBranding(oldFileName).catch(err =>
                console.warn('[Branding] No se pudo eliminar archivo anterior:', err.message)
            );
        }
    }

    return asset;
};

const deleteBrandingAsset = async (assetType: BrandingAssetType) => {
    const previous = await prisma.ui_theme_assets.findFirst({
        where: { theme_id: GLOBAL_BRANDING_THEME_ID, asset_type: assetType as any }
    });

    if (!previous) return;

    await prisma.ui_theme_assets.delete({
        where: { id: previous.id }
    });

    const oldFileName = getBrandingFileNameFromStorageKey(previous.storage_key);
    if (oldFileName) {
        deleteBranding(oldFileName).catch(err =>
            console.warn('[Branding] No se pudo eliminar archivo:', err.message)
        );
    }
};

const logToFile = (msg: string) => {
    console.log(`[SuperAdmin] ${msg}`);
};

// ─── Fuente de Verdad Canónica — 20 grupos oficiales ────────────────────────
// badgeText se excluye: su color es siempre contextual (estado semántico).
const VALID_GROUPS = new Set([
    'pageTitle', 'pageSubtitle', 'sectionTitle', 'sectionSubtitle',
    'cardTitle', 'cardSubtitle', 'kpiLabel', 'kpiValue',
    'labelText', 'inputText', 'buttonText', 'buttonPrimaryText', 'navText',
    'menuText', 'tableHeader', 'tableCell', 'statusText',
    'messageText', 'helperText', 'emptyStateTitle', 'emptyStateBody',
]);

const ALLOWED_FONTS = ['Inter', 'Poppins', 'Manrope', 'DM Sans', 'System UI'];
const HEX_COLOR_RE = /^#[0-9a-fA-F]{3,8}$/; // Soporta 3, 6 y 8 (con alpha) chars

const DEFAULT_COLORS: Record<string, string> = {
    'brand-primary': '#FFD700',
    'brand-primary-foreground': '#1A1A1A',
    'bg-page': '#1A1A1A',
    'bg-surface': '#232323',
    'bg-card': '#242424',
    'bg-elevated': '#2D2D2D',
    'bg-input': '#202020',
    'bg-hover': '#303030',
    'bg-selected': 'rgba(255, 215, 0, 0.12)',
    'text-strong': '#F4F4DC',
    'text-body': '#E7E2BF',
    'text-muted': '#B9B28E',
    'text-inverse': '#1A1A1A',
    'border-default': '#3A382F',
    'border-strong': '#5B5749',
    'border-focus': '#FFD700',
    'state-success': '#22c55e',
    'state-warning': '#f59e0b',
    'state-danger': '#ef4444',
    'state-info': '#3b82f6',
    'chart-1': '#FFD700',
    'chart-2': '#22c55e',
    'chart-3': '#3b82f6',
    'chart-4': '#9524E3',
    'chart-5': '#FF8C00',
    'chart-grid': '#3A382F',
    'chart-axis': '#B9B28E',
    'chart-tooltip-bg': '#242424',
    'chart-tooltip-text': '#F4F4DC',
};

const COLOR_SETTING_KEY = 'global_branding_colors';
const THEMES_SETTING_KEY = 'branding_themes_list';
const GLOBAL_BRAND_SETTING_KEY = 'global_platform_branding';

interface BrandingTheme {
    id: string;
    name: string;
    isActive: boolean;
    isPublished: boolean;
    variant?: 'light' | 'dark';
    colors: Record<string, string>;
    typography: Record<string, { color: string; fontFamily: string }>;
    updatedAt: string;
}

function validateTypography(input: Record<string, any>): { valid: boolean; error?: string } {
    for (const [group, values] of Object.entries(input)) {
        if (!VALID_GROUPS.has(group)) {
            return { valid: false, error: `Grupo no permitido: "${group}"` };
        }
        if (values.color !== undefined && !HEX_COLOR_RE.test(values.color)) {
            return { valid: false, error: `Color inválido en "${group}": "${values.color}" (esperado #rrggbb)` };
        }
        if (values.fontFamily !== undefined && !ALLOWED_FONTS.includes(values.fontFamily)) {
            return { valid: false, error: `Fuente no permitida en "${group}": "${values.fontFamily}"` };
        }
    }
    return { valid: true };
}

const DEFAULT_TYPOGRAPHY: Record<string, { color: string; fontFamily: string }> = {
    pageTitle:       { color: '#F4F4DC', fontFamily: 'Inter' },
    pageSubtitle:    { color: '#B9B28E', fontFamily: 'Inter' },
    sectionTitle:    { color: '#F4F4DC', fontFamily: 'Inter' },
    sectionSubtitle: { color: '#B9B28E', fontFamily: 'Inter' },
    cardTitle:       { color: '#F4F4DC', fontFamily: 'Inter' },
    cardSubtitle:    { color: '#B9B28E', fontFamily: 'Inter' },
    kpiLabel:        { color: '#B9B28E', fontFamily: 'Inter' },
    kpiValue:        { color: '#F4F4DC', fontFamily: 'Inter' },
    labelText:       { color: '#B9B28E', fontFamily: 'Inter' },
    inputText:       { color: '#F4F4DC', fontFamily: 'Inter' },
    buttonText:      { color: '#1A1A1A', fontFamily: 'Inter' },
    buttonPrimaryText:{ color: '#1A1A1A', fontFamily: 'Inter' },
    navText:         { color: '#B9B28E', fontFamily: 'Inter' },
    menuText:        { color: '#B9B28E', fontFamily: 'Inter' },
    tableHeader:     { color: '#B9B28E', fontFamily: 'Inter' },
    tableCell:       { color: '#F4F4DC', fontFamily: 'Inter' },
    statusText:      { color: '#B9B28E', fontFamily: 'Inter' },
    messageText:     { color: '#F4F4DC', fontFamily: 'Inter' },
    helperText:      { color: '#B9B28E', fontFamily: 'Inter' },
    emptyStateTitle: { color: '#F4F4DC', fontFamily: 'Inter' },
    emptyStateBody:  { color: '#B9B28E', fontFamily: 'Inter' },
};

const DEFAULT_LIGHT_COLORS: Record<string, string> = {
    'brand-primary': '#FFC21A',
    'brand-primary-foreground': '#1F1A17',
    'bg-page': '#FAF6EF',
    'bg-surface': '#F4EEE5',
    'bg-card': '#FFFAF3',
    'bg-elevated': '#FFFFFF',
    'bg-input': '#FFFBF6',
    'bg-hover': '#EEE6DA',
    'bg-selected': 'rgba(255, 194, 26, 0.14)',
    'text-strong': '#1F1A1F',
    'text-body': '#5C5752',
    'text-muted': '#766F69',
    'text-inverse': '#FFFAF3',
    'border-default': '#E7DDD0',
    'border-strong': '#D8CCBC',
    'border-focus': '#FFB000',
    'state-success': '#16a34a',
    'state-warning': '#d97706',
    'state-danger': '#cc2222',
    'state-info': '#2563eb',
    'chart-1': '#FFC21A',
    'chart-2': '#16a34a',
    'chart-3': '#2563eb',
    'chart-4': '#9524E3',
    'chart-5': '#FF8C00',
    'chart-grid': '#E8DED0',
    'chart-axis': '#837A72',
    'chart-tooltip-bg': '#FFFAF3',
    'chart-tooltip-text': '#1F1A1F',
};

const DEFAULT_LIGHT_TYPOGRAPHY: Record<string, { color: string; fontFamily: string }> = {
    pageTitle:        { color: '#1F1A1F', fontFamily: 'Inter' },
    pageSubtitle:     { color: '#766F69', fontFamily: 'Inter' },
    sectionTitle:     { color: '#1F1A1F', fontFamily: 'Inter' },
    sectionSubtitle:  { color: '#766F69', fontFamily: 'Inter' },
    cardTitle:        { color: '#1F1A1F', fontFamily: 'Inter' },
    cardSubtitle:     { color: '#5C5752', fontFamily: 'Inter' },
    kpiLabel:         { color: '#766F69', fontFamily: 'Inter' },
    kpiValue:         { color: '#1F1A1F', fontFamily: 'Inter' },
    labelText:        { color: '#766F69', fontFamily: 'Inter' },
    inputText:        { color: '#1F1A1F', fontFamily: 'Inter' },
    buttonText:       { color: '#1F1A17', fontFamily: 'Inter' },
    buttonPrimaryText:{ color: '#1F1A17', fontFamily: 'Inter' },
    navText:          { color: '#766F69', fontFamily: 'Inter' },
    menuText:         { color: '#766F69', fontFamily: 'Inter' },
    tableHeader:      { color: '#766F69', fontFamily: 'Inter' },
    tableCell:        { color: '#1F1A1F', fontFamily: 'Inter' },
    statusText:       { color: '#766F69', fontFamily: 'Inter' },
    messageText:      { color: '#1F1A1F', fontFamily: 'Inter' },
    helperText:       { color: '#766F69', fontFamily: 'Inter' },
    emptyStateTitle:  { color: '#1F1A1F', fontFamily: 'Inter' },
    emptyStateBody:   { color: '#766F69', fontFamily: 'Inter' },
};

const THEME_GLOBAL_TENANT_ID = GLOBAL_BRANDING_TENANT_ID;
const THEME_SCOPE = 'global';

const mergeThemeColors = (colors?: Record<string, string> | null, variant: 'light' | 'dark' = 'dark') => ({
    ...(variant === 'light' ? DEFAULT_LIGHT_COLORS : DEFAULT_COLORS),
    ...(colors || {})
});

const mergeThemeTypography = (
    typography?: Record<string, { color: string; fontFamily: string }> | null,
    variant: 'light' | 'dark' = 'dark'
) => ({
    ...(variant === 'light' ? DEFAULT_LIGHT_TYPOGRAPHY : DEFAULT_TYPOGRAPHY),
    ...(typography || {})
});

const buildThemeTokens = (theme: Partial<BrandingTheme>) => {
    const variant = theme.variant === 'light' ? 'light' : 'dark';
    return {
        variant,
        colors: mergeThemeColors(theme.colors, variant),
        typography: mergeThemeTypography(theme.typography, variant),
    };
};

const mapDbThemeToBrandingTheme = (theme: any): BrandingTheme => {
    const tokens = (theme?.tokens || {}) as any;
    const variant = tokens?.variant === 'light' ? 'light' : 'dark';
    return {
        id: theme.id,
        name: theme.name,
        isActive: Boolean(theme.is_active),
        isPublished: theme.status === 'ACTIVE',
        variant,
        colors: mergeThemeColors(tokens?.colors, variant),
        typography: mergeThemeTypography(tokens?.typography, variant),
        updatedAt: (theme.updated_at || theme.created_at || new Date()).toISOString(),
    };
};

const createThemeVersionSnapshot = (theme: BrandingTheme) => ({
    id: theme.id,
    name: theme.name,
    variant: theme.variant,
    colors: theme.colors,
    typography: theme.typography,
    isActive: theme.isActive,
    isPublished: theme.isPublished,
    updatedAt: theme.updatedAt,
});

const writeThemeVersion = async (themeId: string, snapshot: BrandingTheme, userId?: string | null) => {
    const lastVersion = await prisma.ui_theme_versions.findFirst({
        where: { theme_id: themeId },
        orderBy: { version_number: 'desc' }
    });

    await prisma.ui_theme_versions.create({
        data: {
            id: uuidv4(),
            theme_id: themeId,
            version_number: (lastVersion?.version_number || 0) + 1,
            snapshot: createThemeVersionSnapshot(snapshot),
            created_by_user_id: userId ?? null,
        }
    });
};

const syncLegacyThemeSettings = async (themes: BrandingTheme[]) => {
    await coreAdapter.system.upsertSetting({
        key: THEMES_SETTING_KEY,
        value: themes
    });

    const activeTheme = themes.find((theme) => theme.isActive);
    if (!activeTheme) return;

    await coreAdapter.system.upsertSetting({
        key: COLOR_SETTING_KEY,
        value: activeTheme.colors
    });
    await coreAdapter.system.upsertSetting({
        key: TYPOGRAPHY_SETTING_KEY,
        value: activeTheme.typography
    });
};

const safeSyncLegacyThemeSettings = async (themes: BrandingTheme[]) => {
    try {
        await syncLegacyThemeSettings(themes);
    } catch (error) {
        console.error('Legacy theme sync skipped:', error);
    }
};

const ensureDefaultUiThemes = async () => {
    const existing = await prisma.ui_themes.findMany({
        where: {
            tenant_id: THEME_GLOBAL_TENANT_ID,
            scope: THEME_SCOPE,
            NOT: { id: GLOBAL_BRANDING_THEME_ID }
        },
        orderBy: { created_at: 'asc' }
    });

    if (existing.length > 0) {
        const normalized = existing.map(mapDbThemeToBrandingTheme);
        const now = new Date();

        const likelyLightTheme = normalized.find((theme) =>
            theme.variant === 'light' ||
            /claro|light/i.test(theme.name)
        );

        let lightThemeId = likelyLightTheme?.id;

        if (!lightThemeId) {
            const createdLightTheme: BrandingTheme = {
                id: uuidv4(),
                name: 'Wabee Claro',
                isActive: true,
                isPublished: true,
                variant: 'light',
                colors: mergeThemeColors(undefined, 'light'),
                typography: mergeThemeTypography(undefined, 'light'),
                updatedAt: now.toISOString(),
            };

            await prisma.ui_themes.create({
                data: {
                    id: createdLightTheme.id,
                    tenant_id: THEME_GLOBAL_TENANT_ID,
                    name: createdLightTheme.name,
                    description: 'Tema claro base de Wabee administrable desde el panel',
                    scope: THEME_SCOPE,
                    status: 'ACTIVE',
                    is_active: false,
                    tokens: buildThemeTokens(createdLightTheme),
                    presets: { variant: 'light' },
                    created_by_user_id: null,
                    updated_at: now,
                }
            });

            await writeThemeVersion(createdLightTheme.id, createdLightTheme, null);
            lightThemeId = createdLightTheme.id;
        } else {
            const currentLight = normalized.find((theme) => theme.id === lightThemeId);
            if (currentLight && currentLight.variant !== 'light') {
                const upgradedLightTheme: BrandingTheme = {
                    ...currentLight,
                    variant: 'light',
                    colors: mergeThemeColors(currentLight.colors, 'light'),
                    typography: mergeThemeTypography(currentLight.typography, 'light'),
                    updatedAt: now.toISOString(),
                };

                await prisma.ui_themes.update({
                    where: { id: lightThemeId },
                    data: {
                        name: upgradedLightTheme.name || 'Wabee Claro',
                        tokens: buildThemeTokens(upgradedLightTheme),
                        presets: { variant: 'light' },
                        updated_at: now,
                    }
                });

                await writeThemeVersion(lightThemeId, upgradedLightTheme, null);
            }
        }

        const hasDarkTheme = normalized.some((theme) =>
            theme.variant === 'dark' || /oscuro|dark/i.test(theme.name)
        );

        if (!hasDarkTheme) {
            const createdDarkTheme: BrandingTheme = {
                id: uuidv4(),
                name: 'Wabee Oscuro',
                isActive: false,
                isPublished: true,
                variant: 'dark',
                colors: mergeThemeColors(undefined, 'dark'),
                typography: mergeThemeTypography(undefined, 'dark'),
                updatedAt: now.toISOString(),
            };

            await prisma.ui_themes.create({
                data: {
                    id: createdDarkTheme.id,
                    tenant_id: THEME_GLOBAL_TENANT_ID,
                    name: createdDarkTheme.name,
                    description: 'Tema oscuro oficial de Wabee para uso nocturno',
                    scope: THEME_SCOPE,
                    status: 'ACTIVE',
                    is_active: false,
                    tokens: buildThemeTokens(createdDarkTheme),
                    presets: { variant: 'dark' },
                    created_by_user_id: null,
                    updated_at: now,
                }
            });

            await writeThemeVersion(createdDarkTheme.id, createdDarkTheme, null);
        }

        if (lightThemeId) {
            await prisma.ui_themes.updateMany({
                where: {
                    tenant_id: THEME_GLOBAL_TENANT_ID,
                    scope: THEME_SCOPE,
                    NOT: { id: GLOBAL_BRANDING_THEME_ID }
                },
                data: {
                    is_active: false,
                    updated_at: now
                }
            });

            await prisma.ui_themes.update({
                where: { id: lightThemeId },
                data: {
                    is_active: true,
                    status: 'ACTIVE',
                    updated_at: now
                }
            });
        } else if (!normalized.some((theme) => theme.isActive)) {
            const firstTheme = normalized[0];
            await prisma.ui_themes.update({
                where: { id: firstTheme.id },
                data: { is_active: true, status: 'ACTIVE', updated_at: now }
            });
        }
        return;
    }
    const now = new Date();

    const seedThemes: BrandingTheme[] = [
        {
            id: uuidv4(),
            name: 'Wabee Claro',
            isActive: true,
            isPublished: true,
            variant: 'light',
            colors: mergeThemeColors(undefined, 'light'),
            typography: mergeThemeTypography(undefined, 'light'),
            updatedAt: now.toISOString(),
        },
        {
            id: uuidv4(),
            name: 'Wabee Oscuro',
            isActive: false,
            isPublished: true,
            variant: 'dark',
            colors: mergeThemeColors(undefined, 'dark'),
            typography: mergeThemeTypography(undefined, 'dark'),
            updatedAt: now.toISOString(),
        }
    ];

    for (const theme of seedThemes) {
        const created = await prisma.ui_themes.create({
            data: {
                id: theme.id,
                tenant_id: THEME_GLOBAL_TENANT_ID,
                name: theme.name,
                description: theme.variant === 'light'
                    ? 'Tema claro base de Wabee administrable desde el panel'
                    : 'Tema oscuro oficial de Wabee para uso nocturno',
                scope: THEME_SCOPE,
                status: theme.isPublished ? 'ACTIVE' : 'DRAFT',
                is_active: theme.isActive,
                tokens: buildThemeTokens(theme),
                presets: { variant: theme.variant },
                created_by_user_id: null,
                updated_at: now,
            }
        });

        await writeThemeVersion(created.id, theme, null);
    }

    await safeSyncLegacyThemeSettings(seedThemes);
};

const listBrandingThemes = async (): Promise<BrandingTheme[]> => {
    await ensureDefaultUiThemes();
    const themes = await prisma.ui_themes.findMany({
        where: {
            tenant_id: THEME_GLOBAL_TENANT_ID,
            scope: THEME_SCOPE,
            NOT: { id: GLOBAL_BRANDING_THEME_ID }
        },
        orderBy: [
            { is_active: 'desc' },
            { updated_at: 'desc' }
        ]
    });

    const mapped = themes.map(mapDbThemeToBrandingTheme);
    await safeSyncLegacyThemeSettings(mapped);
    return mapped;
};

const TYPOGRAPHY_SETTING_KEY = 'global_branding_typography';
const EMAIL_GLOBAL_KEY = 'email_customization_global';
const EMAIL_TEMPLATES_KEY = 'email_customization_templates';

// ─── CANONICAL DEFAULTS FOR EMAIL — imported from email-defaults.ts ─────────

// ─── VALIDATION SCHEMAS ────────────────────────────────────────────────────
const EmailGlobalSchema = z.object({
    identidad: z.object({
        brandName: z.string().min(1),
        senderName: z.string().min(1),
        supportEmail: z.string().email(),
        brandLogo: z.string().nullable().optional(),
        globalFooter: z.string().min(1)
    }),
    layout: z.object({
        bg: z.string(),
        card: z.string(),
        border: z.string(),
        buttonBg: z.string(),
        buttonText: z.string().optional(),
        subjectLabel: z.string()
    }),
    texts: z.object({
        title: z.object({ label: z.string().optional(), color: z.string(), font: z.string(), preview: z.string().optional() }),
        subtitle: z.object({ label: z.string().optional(), color: z.string(), font: z.string(), preview: z.string().optional() }),
        paragraph: z.object({ label: z.string().optional(), color: z.string(), font: z.string(), preview: z.string().optional() }),
        button: z.object({ label: z.string().optional(), color: z.string(), font: z.string(), preview: z.string().optional() }),
        footer: z.object({ label: z.string().optional(), color: z.string(), font: z.string(), preview: z.string().optional() })
    })
});

const EmailTemplateSchema = z.object({
    id: z.string(),
    code: z.string(),
    name: z.string(),
    category: z.string(),
    status: z.enum(['published', 'draft']),
    subject: z.string(),
    title: z.string(),
    body: z.string(),
    cta: z.string(),
    footer: z.string()
});

const EmailTemplatesArraySchema = z.array(EmailTemplateSchema);

// GET /v1/super-admin/text-style-groups
router.get('/text-style-groups', async (req: any, res) => {
    try {
        const setting = await coreAdapter.system.getSetting(TYPOGRAPHY_SETTING_KEY);

        const overrides = (setting?.value as Record<string, any>) || {};
        const config = { ...DEFAULT_TYPOGRAPHY };

        // Merge solo grupos válidos del override
        Object.keys(overrides).forEach(key => {
            if (VALID_GROUPS.has(key) && config[key]) {
                config[key] = { ...config[key], ...overrides[key] };
            }
        });

        res.json({ success: true, data: config });
    } catch (error: any) {
        console.error('Error fetching typography:', error);
        res.status(500).json({ error: { message: 'Error al obtener configuración tipográfica' } });
    }
});

// ─── GLOBAL BRANDING ENDPOINTS ───────────────────────────────────────────────

/**
 * @route GET /v1/super-admin/branding/global
 * @desc Obtener configuración de marca global (logo, etc)
 */
router.get('/branding/global', async (req, res) => {
    try {
        const data = await getGlobalBrandingFromWabee();
        res.json({
            success: true,
            data
        });
    } catch (error: any) {
        console.error('Error fetching global branding:', error);
        res.status(500).json({ error: { message: 'Error al obtener branding global' } });
    }
});

router.post('/branding/global/logo', authMiddleware, requireSuperAdmin, upload.single('file'), async (req: any, res, next) => {
    try {
        const file = req.file;
        if (!file) {
            return res.status(400).json({ error: { message: 'No se proporcionó ningún archivo' } });
        }

        const allowedMimes = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
        if (!allowedMimes.includes(file.mimetype)) {
            return res.status(400).json({
                error: { message: `Tipo de archivo no permitido. Permitidos: ${allowedMimes.join(', ')}` }
            });
        }

        await saveBrandingAsset('LOGO', file, req.user?.id);
        const data = await getGlobalBrandingFromWabee();
        return res.json({ success: true, data });
    } catch (error) {
        return next(error);
    }
});

router.delete('/branding/global/logo', authMiddleware, requireSuperAdmin, async (_req, res, next) => {
    try {
        await deleteBrandingAsset('LOGO');
        const data = await getGlobalBrandingFromWabee();
        return res.json({ success: true, data, message: 'Logo eliminado. Se usará el logo por defecto.' });
    } catch (error) {
        return next(error);
    }
});

router.post('/branding/global/favicon', authMiddleware, requireSuperAdmin, upload.single('file'), async (req: any, res, next) => {
    try {
        const file = req.file;
        if (!file) {
            return res.status(400).json({ error: { message: 'No se proporcionó ningún archivo' } });
        }

        const allowedMimes = ['image/png', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/svg+xml', 'image/webp', 'image/jpeg'];
        if (!allowedMimes.includes(file.mimetype)) {
            return res.status(400).json({
                error: { message: `Tipo de archivo no permitido (${file.mimetype}). Permitidos: PNG, ICO, SVG, WEBP, JPG` }
            });
        }

        await saveBrandingAsset('FAVICON', file, req.user?.id);
        const data = await getGlobalBrandingFromWabee();
        return res.json({ success: true, data });
    } catch (error) {
        return next(error);
    }
});

router.delete('/branding/global/favicon', authMiddleware, requireSuperAdmin, async (_req, res, next) => {
    try {
        await deleteBrandingAsset('FAVICON');
        const data = await getGlobalBrandingFromWabee();
        return res.json({ success: true, data, message: 'Favicon eliminado.' });
    } catch (error) {
        return next(error);
    }
});

// GET /v1/super-admin/branding/themes/published (PÚBLICO con auth normal — para selector de perfil)
router.get('/branding/themes/published', async (req: any, res) => {
    try {
        const themes = await listBrandingThemes();
        const published = themes.filter((theme) => theme.isPublished || theme.isActive);
        res.json({ success: true, data: published });
    } catch (error: any) {
        console.error('Error fetching published themes:', error);
        res.json({
            success: true,
            data: [
                {
                    id: 'fallback-light',
                    name: 'Wabee Claro',
                    isActive: true,
                    isPublished: true,
                    variant: 'light',
                    colors: DEFAULT_LIGHT_COLORS,
                    typography: DEFAULT_LIGHT_TYPOGRAPHY,
                    updatedAt: new Date().toISOString()
                },
                {
                    id: 'fallback-dark',
                    name: 'Wabee Oscuro',
                    isActive: false,
                    isPublished: true,
                    variant: 'dark',
                    colors: DEFAULT_COLORS,
                    typography: DEFAULT_TYPOGRAPHY,
                    updatedAt: new Date().toISOString()
                }
            ]
        });
    }
});

// GET /v1/super-admin/branding/themes/active (PÚBLICO para Landing Page)
router.get('/branding/themes/active', async (req: any, res) => {
    try {
        const themes = await listBrandingThemes();
        const activeTheme = themes.find((theme) => theme.isActive) || themes[0];

        if (!activeTheme) {
            return res.json({
                success: true,
                data: {
                    id: 'fallback-internal',
                    name: 'Wabee Claro',
                    isActive: true,
                    isPublished: true,
                    variant: 'light',
                    colors: DEFAULT_LIGHT_COLORS,
                    typography: DEFAULT_LIGHT_TYPOGRAPHY,
                    updatedAt: new Date().toISOString()
                }
            });
        }

        res.json({ success: true, data: activeTheme });
    } catch (error: any) {
        console.error('Error fetching active theme:', error);
        res.json({
            success: true,
            data: {
                id: 'fallback-light',
                name: 'Wabee Claro',
                isActive: true,
                isPublished: true,
                variant: 'light',
                colors: DEFAULT_LIGHT_COLORS,
                typography: DEFAULT_LIGHT_TYPOGRAPHY,
                updatedAt: new Date().toISOString()
            }
        });
    }
});

// A partir de aquí, todas las rutas requieren Auth y SuperAdmin
router.use(authMiddleware);
router.use(requireSuperAdmin);

// PUT /v1/super-admin/text-style-groups
router.put('/text-style-groups', async (req: any, res) => {
    try {
        const { typography } = req.body;
        if (!typography || typeof typography !== 'object') {
            return res.status(400).json({ error: { message: '"typography" es requerido y debe ser un objeto' } });
        }

        // Validación de seguridad
        const validation = validateTypography(typography);
        if (!validation.valid) {
            return res.status(400).json({ error: { message: validation.error } });
        }

        const newSetting = await coreAdapter.system.upsertSetting({
            key: TYPOGRAPHY_SETTING_KEY,
            value: typography,
            userId: req.user.id,
            actionName: 'update_text_style_group',
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({ success: true, data: newSetting.value });
    } catch (error: any) {
        console.error('Error updating typography:', error);
        res.status(500).json({ error: { message: 'Error al actualizar configuración tipográfica' } });
    }
});

// POST /v1/super-admin/text-style-groups/reset
router.post('/text-style-groups/reset', async (req: any, res) => {
    try {
        await coreAdapter.system.deleteSetting(
            TYPOGRAPHY_SETTING_KEY,
            req.user.id,
            req.ip,
            req.headers['user-agent']
        );

        res.json({ success: true, data: DEFAULT_TYPOGRAPHY });
    } catch (error: any) {
        console.error('Error resetting typography:', error);
        res.status(500).json({ error: { message: 'Error al restaurar tipografía' } });
    }
});

// GET /v1/super-admin/branding/colors
router.get('/branding/colors', async (req: any, res) => {
    try {
        const setting = await coreAdapter.system.getSetting(COLOR_SETTING_KEY);

        const overrides = (setting?.value as Record<string, string>) || {};
        const config = { ...DEFAULT_COLORS, ...overrides };

        res.json({ success: true, data: config });
    } catch (error: any) {
        console.error('Error fetching branding colors:', error);
        res.status(500).json({ error: { message: 'Error al obtener configuración de colores' } });
    }
});

// PUT /v1/super-admin/branding/colors
router.put('/branding/colors', async (req: any, res) => {
    try {
        const { colors } = req.body;
        if (!colors || typeof colors !== 'object') {
            return res.status(400).json({ error: { message: '"colors" es requerido y debe ser un objeto' } });
        }

        // Validación simple: asegurar que son hex o rgba válidos (muy laxo por ahora, permitimos strings)
        // Podríamos filtrar solo los keys de DEFAULT_COLORS si queremos ser estrictos
        const filteredColors: Record<string, string> = {};
        for (const [key, value] of Object.entries(colors)) {
            if (DEFAULT_COLORS.hasOwnProperty(key)) {
                filteredColors[key] = String(value);
            }
        }

        const newSetting = await coreAdapter.system.upsertSetting({
            key: COLOR_SETTING_KEY,
            value: filteredColors,
            userId: req.user.id,
            actionName: 'update_branding_colors',
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({ success: true, data: newSetting.value });
    } catch (error: any) {
        console.error('Error updating branding colors:', error);
        res.status(500).json({ error: { message: 'Error al actualizar configuración de colores' } });
    }
});

// GET /v1/super-admin/branding/themes
router.get('/branding/themes', async (req: any, res) => {
    try {
        {
            const themes = await listBrandingThemes();
            return res.json({ success: true, data: themes });
        }

        const themesSetting = await coreAdapter.system.getSetting(THEMES_SETTING_KEY);

        let themes: BrandingTheme[] = themesSetting?.value as any || [];

        // Migración automática en caliente para renombramiento
        let renamed = false;
        themes.forEach(t => {
            if (t.name === 'Tema por Defecto') { t.name = 'Modo Oscuro'; renamed = true; }
            if (t.name === 'Wabee Light') { t.name = 'Modo Claro'; renamed = true; }
        });
        if (renamed && themes.length > 0) {
            await coreAdapter.system.upsertSetting({
                key: THEMES_SETTING_KEY,
                value: themes
            });
        }

        // Migración: Si no hay temas, intentamos crear el Default basado en las configuraciones individuales
        if (themes.length === 0) {
            const colorsSetting = await coreAdapter.system.getSetting(COLOR_SETTING_KEY);
            const typographySetting = await coreAdapter.system.getSetting(TYPOGRAPHY_SETTING_KEY);

            const defaultTheme: BrandingTheme = {
                id: 'default-id',
                name: 'Modo Oscuro',
                isActive: true,
                isPublished: true,
                colors: { ...DEFAULT_COLORS, ...(colorsSetting?.value as any || {}) },
                typography: { ...DEFAULT_TYPOGRAPHY, ...(typographySetting?.value as any || {}) },
                updatedAt: new Date().toISOString()
            };
            themes = [defaultTheme];
            
            // Persistir migración inicial silenciosamente
            await coreAdapter.system.upsertSetting({
                key: THEMES_SETTING_KEY,
                value: themes
            });
        }

        res.json({ success: true, data: themes });
    } catch (error: any) {
        console.error('Error fetching themes:', error);
        res.json({
            success: true,
            data: [
                {
                    id: 'fallback-light',
                    name: 'Wabee Claro',
                    isActive: true,
                    isPublished: true,
                    variant: 'light',
                    colors: DEFAULT_LIGHT_COLORS,
                    typography: DEFAULT_LIGHT_TYPOGRAPHY,
                    updatedAt: new Date().toISOString()
                },
                {
                    id: 'fallback-dark',
                    name: 'Wabee Oscuro',
                    isActive: false,
                    isPublished: true,
                    variant: 'dark',
                    colors: DEFAULT_COLORS,
                    typography: DEFAULT_TYPOGRAPHY,
                    updatedAt: new Date().toISOString()
                }
            ]
        });
    }
});

// POST /v1/super-admin/branding/themes
router.post('/branding/themes', async (req: any, res) => {
    try {
        {
            const { name: requestedName, colors: requestedColors, typography: requestedTypography, variant: requestedVariant } = req.body;
            if (!requestedName) return res.status(400).json({ error: { message: 'El nombre del tema es requerido' } });

            const currentThemes = await listBrandingThemes();
            const themeVariant = requestedVariant === 'light' ? 'light' : 'dark';
            const newTheme: BrandingTheme = {
                id: uuidv4(),
                name: requestedName,
                isActive: currentThemes.length === 0,
                isPublished: currentThemes.length === 0,
                variant: themeVariant,
                colors: mergeThemeColors(requestedColors, themeVariant),
                typography: mergeThemeTypography(requestedTypography, themeVariant),
                updatedAt: new Date().toISOString()
            };

            await prisma.ui_themes.create({
                data: {
                    id: newTheme.id,
                    tenant_id: THEME_GLOBAL_TENANT_ID,
                    name: newTheme.name,
                    description: `Tema ${themeVariant === 'light' ? 'claro' : 'oscuro'} de Wabee`,
                    scope: THEME_SCOPE,
                    status: newTheme.isPublished ? 'ACTIVE' : 'DRAFT',
                    is_active: newTheme.isActive,
                    tokens: buildThemeTokens(newTheme),
                    presets: { variant: newTheme.variant },
                    created_by_user_id: req.user?.id || null,
                    updated_at: new Date()
                }
            });
            await writeThemeVersion(newTheme.id, newTheme, req.user?.id || null);
            await syncLegacyThemeSettings(await listBrandingThemes());

            return res.json({ success: true, data: newTheme });
        }

        const { name, colors, typography } = req.body;
        if (!name) return res.status(400).json({ error: { message: 'El nombre del tema es requerido' } });

        const themesSetting = await coreAdapter.system.getSetting(THEMES_SETTING_KEY);

        const themes: BrandingTheme[] = themesSetting?.value as any || [];
        
        const newTheme: BrandingTheme = {
            id: Math.random().toString(36).substring(2, 9),
            name,
            isActive: themes.length === 0, // El primero es activo por defecto
            isPublished: themes.length === 0, // El primero se publica por defecto
            colors: colors || DEFAULT_COLORS,
            typography: typography || DEFAULT_TYPOGRAPHY,
            updatedAt: new Date().toISOString()
        };

        const updatedThemes = [...themes, newTheme];

        await coreAdapter.system.upsertSetting({
            key: THEMES_SETTING_KEY,
            value: updatedThemes
        });

        res.json({ success: true, data: newTheme });
    } catch (error: any) {
        console.error('Error creating theme:', error);
        res.status(500).json({ error: { message: 'Error al crear tema' } });
    }
});

// PUT /v1/super-admin/branding/themes/:id
router.put('/branding/themes/:id', async (req: any, res) => {
    try {
        {
            const themeId = req.params.id;
            const incomingUpdates = req.body;
            const existingTheme = await prisma.ui_themes.findUnique({ where: { id: themeId } });
            if (!existingTheme || existingTheme.id === GLOBAL_BRANDING_THEME_ID) {
                return res.status(404).json({ error: { message: 'Tema no encontrado' } });
            }

            const currentTheme = mapDbThemeToBrandingTheme(existingTheme);
            const nextVariant = incomingUpdates.variant === 'light' || incomingUpdates.variant === 'dark'
                ? incomingUpdates.variant
                : currentTheme.variant;
            const updatedTheme: BrandingTheme = {
                ...currentTheme,
                name: incomingUpdates.name ?? currentTheme.name,
                variant: nextVariant,
                colors: mergeThemeColors(incomingUpdates.colors ?? currentTheme.colors, nextVariant),
                typography: mergeThemeTypography(incomingUpdates.typography ?? currentTheme.typography, nextVariant),
                updatedAt: new Date().toISOString()
            };

            await prisma.ui_themes.update({
                where: { id: themeId },
                data: {
                    name: updatedTheme.name,
                    tokens: buildThemeTokens(updatedTheme),
                    presets: { variant: updatedTheme.variant },
                    updated_at: new Date()
                }
            });
            await writeThemeVersion(themeId, updatedTheme, req.user?.id || null);
            await syncLegacyThemeSettings(await listBrandingThemes());

            return res.json({ success: true, data: updatedTheme });
        }

        const { id } = req.params;
        const updates = req.body;

        const themesSetting = await coreAdapter.system.getSetting(THEMES_SETTING_KEY);

        let themes: BrandingTheme[] = themesSetting?.value as any || [];
        const index = themes.findIndex(t => t.id === id);

        if (index === -1) return res.status(404).json({ error: { message: 'Tema no encontrado' } });

        themes[index] = { 
            ...themes[index], 
            ...updates, 
            updatedAt: new Date().toISOString() 
        };

        await coreAdapter.system.upsertSetting({
            key: THEMES_SETTING_KEY,
            value: themes
        });

        // Sincronizar con keys legacy si el tema actualizado es el activo
        if (themes[index].isActive) {
            if (updates.colors) {
                await coreAdapter.system.upsertSetting({
                    key: COLOR_SETTING_KEY,
                    value: themes[index].colors
                });
            }
            if (updates.typography) {
                await coreAdapter.system.upsertSetting({
                    key: TYPOGRAPHY_SETTING_KEY,
                    value: themes[index].typography
                });
            }
        }

        res.json({ success: true, data: themes[index] });
    } catch (error: any) {
        console.error('Error updating theme:', error);
        res.status(500).json({ error: { message: 'Error al actualizar tema' } });
    }
});

// DELETE /v1/super-admin/branding/themes/:id
router.delete('/branding/themes/:id', async (req: any, res) => {
    try {
        {
            const themeId = req.params.id;
            const theme = await prisma.ui_themes.findUnique({ where: { id: themeId } });
            if (!theme || theme.id === GLOBAL_BRANDING_THEME_ID) {
                return res.status(404).json({ error: { message: 'Tema no encontrado' } });
            }

            const themeToDelete = mapDbThemeToBrandingTheme(theme);
            if (themeToDelete.isActive) {
                return res.status(400).json({ error: { message: 'No puedes eliminar el tema activo' } });
            }

            await prisma.ui_themes.delete({ where: { id: themeId } });
            await syncLegacyThemeSettings(await listBrandingThemes());
            return res.json({ success: true });
        }

        const { id } = req.params;
        const themesSetting = await coreAdapter.system.getSetting(THEMES_SETTING_KEY);

        let themes: BrandingTheme[] = themesSetting?.value as any || [];
        const themeToDelete = themes.find(t => t.id === id);

        if (!themeToDelete) return res.status(404).json({ error: { message: 'Tema no encontrado' } });
        if (themeToDelete?.isActive) return res.status(400).json({ error: { message: 'No puedes eliminar el tema activo' } });

        const updatedThemes = themes.filter(t => t.id !== id);

        await coreAdapter.system.upsertSetting({
            key: THEMES_SETTING_KEY,
            value: updatedThemes
        });

        res.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting theme:', error);
        res.status(500).json({ error: { message: 'Error al eliminar tema' } });
    }
});

// POST /v1/super-admin/branding/themes/:id/publish (toggle publicar/despublicar)
router.post('/branding/themes/:id/publish', async (req: any, res) => {
    try {
        {
            const themeId = req.params.id;
            const shouldPublish = Boolean(req.body.publish);
            const theme = await prisma.ui_themes.findUnique({ where: { id: themeId } });
            if (!theme || theme.id === GLOBAL_BRANDING_THEME_ID) {
                return res.status(404).json({ error: { message: 'Tema no encontrado' } });
            }

            const currentTheme = mapDbThemeToBrandingTheme(theme);
            if (!shouldPublish && currentTheme.isActive) {
                return res.status(400).json({ error: { message: 'No puedes despublicar el tema activo' } });
            }

            const updatedTheme: BrandingTheme = {
                ...currentTheme,
                isPublished: shouldPublish,
                updatedAt: new Date().toISOString()
            };

            await prisma.ui_themes.update({
                where: { id: themeId },
                data: {
                    status: shouldPublish ? 'ACTIVE' : 'DRAFT',
                    updated_at: new Date()
                }
            });
            await writeThemeVersion(themeId, updatedTheme, req.user?.id || null);
            await syncLegacyThemeSettings(await listBrandingThemes());

            return res.json({ success: true, data: updatedTheme });
        }

        const { id } = req.params;
        const { publish } = req.body; // true = publicar, false = despublicar

        const themesSetting = await coreAdapter.system.getSetting(THEMES_SETTING_KEY);

        let themes: BrandingTheme[] = themesSetting?.value as any || [];
        const index = themes.findIndex(t => t.id === id);
        if (index === -1) return res.status(404).json({ error: { message: 'Tema no encontrado' } });

        // No se puede despublicar el tema activo
        if (!publish && themes[index].isActive) {
            return res.status(400).json({ error: { message: 'No puedes despublicar el tema activo' } });
        }

        themes[index] = {
            ...themes[index],
            isPublished: Boolean(publish),
            updatedAt: new Date().toISOString()
        };

        await coreAdapter.system.upsertSetting({
            key: THEMES_SETTING_KEY,
            value: themes
        });

        res.json({ success: true, data: themes[index] });
    } catch (error: any) {
        console.error('Error publishing theme:', error);
        res.status(500).json({ error: { message: 'Error al publicar/despublicar tema' } });
    }
});

// ─── EMAIL CUSTOMIZATION FUNCTIONAL ENDPOINTS ──────────────────────────────

/**
 * @route GET /v1/super-admin/email-customization
 * @desc Obtener toda la configuración de correos (Global + Templates)
 */
router.get('/email-customization', async (req: any, res) => {
    try {
        const [globalSetting, templatesSetting] = await Promise.all([
            coreAdapter.system.getSetting(EMAIL_GLOBAL_KEY),
            coreAdapter.system.getSetting(EMAIL_TEMPLATES_KEY)
        ]);

        let templates = (templatesSetting?.value || DEFAULT_EMAIL_TEMPLATES).filter((t: any) =>
            SUPPORTED_EMAIL_TEMPLATE_CODES.includes(t.code)
        );

        // Lógica de Autocuración: Asegurar que VERIFY_EMAIL y PASSWORD_RESET siempre existan
        const essentialCodes = [...SUPPORTED_EMAIL_TEMPLATE_CODES];
        let needsUpdate = false;

        essentialCodes.forEach(code => {
            if (!templates.find((t: any) => t.code === code)) {
                const defaultTpl = DEFAULT_EMAIL_TEMPLATES.find(t => t.code === code);
                if (defaultTpl) {
                    templates.push(defaultTpl);
                    needsUpdate = true;
                }
            }
        });

        if ((templatesSetting?.value || []).length !== templates.length) {
            needsUpdate = true;
        }

        if (needsUpdate && req.user?.id) {
            await coreAdapter.system.upsertSetting({
                key: EMAIL_TEMPLATES_KEY,
                value: templates,
                userId: req.user.id,
                actionName: 'normalize_email_templates',
                ip: req.ip,
                userAgent: req.headers['user-agent']
            });
        }

        res.json({
            success: true,
            data: {
                globalConfig: globalSetting?.value || DEFAULT_EMAIL_GLOBAL,
                templates: templates
            }
        });
    } catch (error: any) {
        console.error('Error fetching email customization:', error);
        res.status(500).json({ error: { message: 'Error al obtener personalización de correos' } });
    }
});

/**
 * @route PUT /v1/super-admin/email-customization/global
 * @desc Guardar configuración global de branding para emails
 */
router.put('/email-customization/global', authMiddleware, requireSuperAdmin, async (req: any, res) => {
    try {
        const validatedData = EmailGlobalSchema.parse(req.body);

        const oldSetting = await coreAdapter.system.getSetting(EMAIL_GLOBAL_KEY);
        const newSetting = await coreAdapter.system.upsertSetting({
            key: EMAIL_GLOBAL_KEY,
            value: validatedData,
            userId: req.user.id,
            actionName: 'update_email_global_config',
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });


        // --- Registro en Auditoría Global ---
        await GlobalAuditLogService.logEvent({
            category: 'system',
            eventType: 'system.config_changed',
            severity: 'info',
            outcome: 'success',
            message: 'Se actualizó la configuración global de correos',
            targetType: 'SystemSetting',
            targetLabel: 'Email Global Config',
            oldValues: oldSetting?.value,
            newValues: validatedData
        }, getAuditContext(req));
        // ------------------------------------

        res.json({ success: true, data: newSetting.value });
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: { message: 'Datos globales inválidos', details: error.errors } });
        }
        console.error('Error saving email global config:', error);
        res.status(500).json({ error: { message: 'Error al guardar configuración global de correos' } });
    }
});

/**
 * @route PUT /v1/super-admin/email-customization/templates
 * @desc Guardar conjunto de plantillas personalizadas
 */
router.put('/email-customization/templates', authMiddleware, requireSuperAdmin, async (req: any, res) => {
    try {
        const validatedData = EmailTemplatesArraySchema.parse(req.body).filter((template: any) =>
            SUPPORTED_EMAIL_TEMPLATE_CODES.includes(template.code)
        );

        const oldSetting = await coreAdapter.system.getSetting(EMAIL_TEMPLATES_KEY);
        const newSetting = await coreAdapter.system.upsertSetting({
            key: EMAIL_TEMPLATES_KEY,
            value: validatedData,
            userId: req.user.id,
            actionName: 'update_email_templates',
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });


        // --- Registro en Auditoría Global ---
        await GlobalAuditLogService.logEvent({
            category: 'system',
            eventType: 'system.config_changed',
            severity: 'info',
            outcome: 'success',
            message: `Se actualizaron ${validatedData.length} plantillas de correo`,
            targetType: 'SystemSetting',
            targetLabel: 'Email Templates',
            oldValues: oldSetting?.value,
            newValues: validatedData
        }, getAuditContext(req));
        // ------------------------------------

        res.json({ success: true, data: newSetting.value });
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: { message: 'Datos de plantillas inválidos', details: error.errors } });
        }
        console.error('Error saving email templates:', error);
        res.status(500).json({ error: { message: 'Error al guardar plantillas de correos' } });
    }
});

/**
 * @route POST /v1/super-admin/email-customization/preview-content
 * @desc Renderizar previsualización en tiempo real (Fix UI Error)
 */
router.post('/email-customization/preview-content', authMiddleware, requireSuperAdmin, async (req: any, res) => {
    try {
        const { globalConfig, template } = req.body;
        
        if (!globalConfig || !template) {
            return res.status(400).json({ error: { message: 'globalConfig y template son requeridos' } });
        }

        // Renderizado usando el motor centralizado (Espejo 100%)
        const rendered = EmailTemplateRendererService.render(
            globalConfig,
            template,
            EmailTemplateRendererService.getMockData(template.code)
        );

        res.json({
            success: true,
            data: {
                html: rendered.html,
                subject: rendered.subject
            }
        });
    } catch (error: any) {
        console.error('Error rendering email preview:', error);
        res.status(500).json({ error: { message: 'Error al renderizar previsualización' } });
    }
});

/**
 * @route POST /v1/super-admin/email-customization/reset
 * @desc Restaurar valores de fábrica (Elimina las personalizaciones)
 */
router.post('/email-customization/reset', authMiddleware, requireSuperAdmin, async (req: any, res) => {
    try {
        const [oldGlobal, oldTemplates] = await Promise.all([
            coreAdapter.system.getSetting(EMAIL_GLOBAL_KEY),
            coreAdapter.system.getSetting(EMAIL_TEMPLATES_KEY)
        ]);

        await coreAdapter.system.deleteManySettings(
            [EMAIL_GLOBAL_KEY, EMAIL_TEMPLATES_KEY],
            req.user.id,
            req.ip,
            req.headers['user-agent']
        );

        // --- Registro en Auditoría Global ---
        await GlobalAuditLogService.logEvent({
            category: 'system',
            eventType: 'system.config_changed',
            severity: 'warning',
            outcome: 'success',
            message: 'Se restauraron los valores de fábrica de la configuración de correos',
            targetType: 'SystemSetting',
            oldValues: { global: oldGlobal?.value, templates: oldTemplates?.value },
            newValues: { global: DEFAULT_EMAIL_GLOBAL, templates: DEFAULT_EMAIL_TEMPLATES }
        }, getAuditContext(req));
        // ------------------------------------

        res.json({
            success: true,
            data: {
                globalConfig: DEFAULT_EMAIL_GLOBAL,
                templates: DEFAULT_EMAIL_TEMPLATES
            }
        });
    } catch (error: any) {
        console.error('Error resetting email customization:', error);
        res.status(500).json({ error: { message: 'Error al restaurar valores de fábrica' } });
    }
});

// POST /v1/super-admin/branding/themes/:id/activate
router.post('/branding/themes/:id/activate', async (req: any, res) => {
    try {
        {
            const themeId = req.params.id;
            const themes = await listBrandingThemes();
            const exists = themes.some((theme) => theme.id === themeId);
            if (!exists) return res.status(404).json({ error: { message: 'Tema no encontrado' } });

            await prisma.ui_themes.updateMany({
                where: {
                    tenant_id: THEME_GLOBAL_TENANT_ID,
                    scope: THEME_SCOPE,
                    NOT: { id: GLOBAL_BRANDING_THEME_ID }
                },
                data: {
                    is_active: false,
                    updated_at: new Date()
                }
            });

            await prisma.ui_themes.update({
                where: { id: themeId },
                data: {
                    is_active: true,
                    status: 'ACTIVE',
                    updated_at: new Date()
                }
            });

            const refreshedThemes = await listBrandingThemes();
            const activeTheme = refreshedThemes.find((theme) => theme.id === themeId);
            if (!activeTheme) {
                return res.status(500).json({ error: { message: 'No se pudo resolver el tema activo' } });
            }

            await writeThemeVersion(themeId, activeTheme, req.user?.id || null);
            await syncLegacyThemeSettings(refreshedThemes);

            await GlobalAuditLogService.logEvent({
                category: 'system',
                eventType: 'system.config_reload',
                severity: 'info',
                outcome: 'success',
                message: `Se activó un nuevo tema visual: ${themeId}`,
                targetType: 'BrandingTheme',
                targetId: themeId,
                metadata: { themeId }
            }, getAuditContext(req));

            return res.json({ success: true, data: activeTheme });
        }

        const { id } = req.params;
        const themesSetting = await coreAdapter.system.getSetting(THEMES_SETTING_KEY);

        let themes: BrandingTheme[] = themesSetting?.value as any || [];
        
        const exists = themes.some(t => t.id === id);
        if (!exists) return res.status(404).json({ error: { message: 'Tema no encontrado' } });

        const updatedThemes = themes.map(t => ({
            ...t,
            isActive: t.id === id
        }));

        await coreAdapter.system.upsertSetting({
            key: THEMES_SETTING_KEY,
            value: updatedThemes
        });

        // Opcional: Actualizar los keys legacy para compatibilidad con código que aún los consuma
        const activeTheme = updatedThemes.find(t => t.isActive);
        if (activeTheme) {
            await coreAdapter.system.upsertSetting({
                key: COLOR_SETTING_KEY,
                value: activeTheme!.colors
            });
            await coreAdapter.system.upsertSetting({
                key: TYPOGRAPHY_SETTING_KEY,
                value: activeTheme!.typography
            });
        }

        // --- Registro en Auditoría Global ---
        await GlobalAuditLogService.logEvent({
            category: 'system',
            eventType: 'system.config_reload',
            severity: 'info',
            outcome: 'success',
            message: `Se activó un nuevo tema visual: ${id}`,
            targetType: 'BrandingTheme',
            targetId: id,
            metadata: { themeId: id }
        }, getAuditContext(req));
        // ------------------------------------

        res.json({ success: true, data: updatedThemes.find(t => t.id === id) });
    } catch (error: any) {
        console.error('Error activating theme:', error);
        res.status(500).json({ error: { message: 'Error al activar tema' } });
    }
});

// GET /v1/super-admin/organizations/stats
router.get('/organizations/stats', async (req: any, res) => {
    try {
        const stats = await coreAdapter.organizations.getStats();

        res.json({
            success: true,
            data: stats
        });
    } catch (error: any) {
        console.error('Error fetching super-admin stats:', error);
        res.status(500).json({ error: { message: 'Error al obtener estadísticas globales' } });
    }
});

// GET /v1/super-admin/organizations
// GET /v1/super-admin/tenants (alias para compatibilidad)
router.get(['/organizations', '/tenants'], async (req: any, res) => {
    try {
        const result = await coreAdapter.organizations.list({
            page: parseInt(req.query.page) || 1,
            pageSize: parseInt(req.query.pageSize) || 20,
            search: req.query.search as string,
            status: req.query.status as string,
            plan: req.query.plan as string,
            sortBy: (req.query.sortBy as string) || 'createdAt',
            sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc'
        });

        res.json({
            success: true,
            data: result
        });
    } catch (error: any) {
        console.error('Error fetching organizations for super admin:', error);
        res.status(500).json({ error: { message: 'Error al obtener listado de organizaciones' } });
    }
});

// GET /v1/super-admin/organizations/:id/members
router.get('/organizations/:id/members', async (req: any, res) => {
    try {
        const { id } = req.params;
        const members = await coreAdapter.organizations.listMembersByOrgId(id);

        res.json({
            success: true,
            data: members
        });
    } catch (error: any) {
        res.status(500).json({ error: { message: 'Error al obtener miembros de la organización' } });
    }
});

// GET /v1/super-admin/impersonation/current
router.get('/impersonation/current', async (req: any, res) => {
    try {
        if (!req.user || !req.user.isImpersonating) {
            return res.json({ success: true, isImpersonating: false });
        }

        const impersonatedOrgId = req.user.impersonatedOrgId;
        const impersonatedUserId = req.user.impersonatedUserId || req.user.id;
        const sessionId = req.user.impersonationSessionId;

        // 1. Validar sesión en DB mediante el adaptador
        const session = await (coreAdapter.auth as any).impersonation.getSession(sessionId);

        if (!session || !session.isActive) {
            return res.json({ 
                success: true, 
                isImpersonating: false, 
                reason: 'SESSION_INACTIVE' 
            });
        }

        // 2. Validar que el usuario objetivo sigue siendo activo y obtener nombre de Org
        const member = await (coreAdapter.auth as any).impersonation.getMembershipDetailed(impersonatedOrgId, impersonatedUserId);

        if (!member || member.status !== 'active') {
             return res.json({ 
                success: true, 
                isImpersonating: false, 
                reason: 'USER_INVALID_OR_STALE' 
            });
        }

        res.json({
            success: true,
            isImpersonating: true,
            data: {
                impersonatorUserId: req.user.impersonatorUserId,
                impersonatedUserId,
                impersonatedOrgId,
                impersonatedOrgName: (member.organization as any)?.name || 'Organización',
                targetUserEmail: (member.user as any)?.email,
                targetUserName: (member.user as any)?.name,
                effectiveRole: req.user.effectiveRole
            }
        });

    } catch (error: any) {
        res.status(500).json({ error: { message: 'Error verificando estado de suplantación' } });
    }
});

// POST /v1/super-admin/organizations/:orgId/impersonate (Auto)
// POST /v1/super-admin/organizations/:orgId/impersonate/:userId (Explícito)
router.post(['/organizations/:orgId/impersonate', '/organizations/:orgId/impersonate/:userId'], async (req: any, res) => {
    const correlationId = Math.random().toString(36).substring(7);
    const { orgId, userId: explicitUserId } = req.params;
    
    logToFile(`[Impersonate][${correlationId}] Iniciando suplantación en org ${orgId}...`);
    
    try {
        const tenant = await coreAdapter.organizations.getById(orgId);

        if (!tenant) {
            logToFile(`[Impersonate][${correlationId}] ADVERTENCIA: Tenant no encontrado: ${orgId}`);
            return res.status(404).json({ error: { message: 'Organización no encontrada' } });
        }

        const realUserId = req.user.id || req.user.sub;
        const realUserEmail = req.user.email;
        logToFile(`[Impersonate][${correlationId}] Actor: ${realUserEmail} (${realUserId})`);

        if (!realUserId) {
            return res.status(401).json({ error: { message: 'No se pudo identificar tu ID de Super Admin.' } });
        }

        let targetMember;
        if (explicitUserId) {
            logToFile(`[Impersonate][${correlationId}] Buscando usuario específico: ${explicitUserId}`);
            targetMember = await (coreAdapter.auth as any).impersonation.getMembershipDetailed(orgId, explicitUserId);
            
            if (!targetMember || targetMember.status !== 'active') {
                return res.status(400).json({ error: { message: 'El usuario seleccionado no existe o no está activo en esta organización.' } });
            }
        } else {
            logToFile(`[Impersonate][${correlationId}] Buscando miembro administrativo automático...`);
            // Se usa listMembersByRoles para buscar admins
            const adminMembers = await CoreInternalService.listMembersByRoles(orgId, ['admin', 'administrator', 'owner', 'super-admin', 'ADMIN', 'SUPER_ADMIN']);
            targetMember = adminMembers[0] || (await coreAdapter.organizations.listMembersByOrgId(orgId))[0];
        }

        if (!targetMember) {
            logToFile(`[Impersonate][${correlationId}] ADVERTENCIA: No se encontró miembro objetivo activo`);
            return res.status(400).json({ error: { message: 'No se encontró un usuario activo en esta organización para suplantar.' } });
        }

        const targetUserId = targetMember.userId;
        const effectiveRole = (targetMember.role as any)?.slug || 'member';

        // 2. Crear una Sesión de Suplantación Real en DB mediante el adaptador
        const session = await (coreAdapter.auth as any).impersonation.start({
            tenantId: orgId,
            adminUserId: realUserId,
            targetUserId: targetUserId,
            reason: req.body.reason || 'Super Admin Explicit Selection',
            isActive: true,
            metadata: {
                initiatedBy: 'SUPER_ADMIN_DASHBOARD',
                realUserEmail,
                correlationId,
                explicit: !!explicitUserId
            }
        });

        // Registrar en AuditTrail 
        // Registrar en AuditTrail mediante el adaptador
        try {
            await coreAdapter.system.createAuditLog({
                data: {
                    tenantId: orgId,
                    userId: realUserId,
                    action: 'IMPERSONATE_START',
                    modelType: 'Organization',
                    modelId: orgId,
                    newValues: {
                        realUserEmail,
                        targetTenantId: orgId,
                        targetTenantName: tenant.name,
                        targetUserId: targetUserId,
                        effectiveRole,
                        sessionId: session.id,
                        correlationId
                    }
                }
            });
        } catch (auditError: any) {
            logToFile(`[Impersonate][${correlationId}] ERROR registrando AuditTrail: ${auditError.message}`);
        }

        // --- Registro en Auditoría Global ---
        await GlobalAuditLogService.logEvent({
            category: 'auth',
            eventType: 'auth.impersonate_tenant',
            severity: 'warning',
            outcome: 'success',
            message: `Super Admin inició suplantación de la organización ${tenant.name}`,
            affectedTenantId: orgId,
            targetId: targetUserId,
            targetType: 'User',
            targetLabel: tenant.name,
            metadata: {
                realUserEmail,
                effectiveRole,
                sessionId: session.id,
                correlationId
            }
        }, getAuditContext(req));
        // ------------------------------------

        // 3. Generar nuevo token de impersonación (Identity Swap)
        const impersonationToken = jwt.sign(
            {
                id: targetUserId,
                email: realUserEmail,
                globalRole: 'admin',
                isImpersonating: true,
                impersonatorUserId: realUserId,
                impersonatedUserId: targetUserId,
                impersonatedOrgId: orgId,
                impersonatedTenantId: orgId, // Alias para máxima compatibilidad con adaptadores
                impersonationSessionId: session.id,
                effectiveRole: effectiveRole
            },
            coreEnv.JWT_SECRET as string,
            { expiresIn: '8h' }
        );

        res.json({
            success: true,
            token: impersonationToken,
            tenant: {
                id: tenant.id,
                name: tenant.name,
                slug: tenant.slug
            },
            targetUser: {
                id: targetUserId,
                role: effectiveRole
            }
        });

    } catch (error: any) {
        logToFile(`[Impersonate][${correlationId}] FATAL ERROR: ${error.message}`);
        res.status(500).json({ error: { message: error.message || 'Error interno durante la suplantación' } });
    }
});

// Alias compatible para la ruta anterior si existe en el front (aunque se debe actualizar)
router.post('/impersonate', async (req: any, res) => {
    const { tenantId } = req.body;
    if (!tenantId) return res.status(400).json({ error: { message: 'tenantId requerido' } });
    req.params.orgId = tenantId;
    // @ts-ignore
    return router.handle(req, res); // Re-enviar a la lógica nueva
});

// POST /v1/super-admin/stop-impersonation
router.post('/stop-impersonation', async (req: any, res) => {
    const correlationId = Math.random().toString(36).substring(7);
    logToFile(`[StopImpersonate][${correlationId}] Iniciando cierre de suplantación...`);
    
    try {
        const realUserId = req.user.impersonatorUserId || req.user.id;
        const realUserEmail = req.user.email;
        const tenantId = req.user.impersonatedOrgId || req.user.impersonatedTenantId; // Compatibilidad con anterior
        const sessionId = req.user.impersonationSessionId;

        logToFile(`[StopImpersonate][${correlationId}] Actor Real: ${realUserId}, SessionId: ${sessionId}, TenantId: ${tenantId}`);

        if (tenantId) {
            // Cerrar sesión en DB mediante el adaptador
            if (sessionId) {
                logToFile(`[StopImpersonate][${correlationId}] Marcando sesión como inactiva en DB...`);
                try {
                    await (coreAdapter.auth as any).impersonation.stop(sessionId, {
                        isActive: false,
                        endedAt: new Date(),
                        endedBy: realUserId
                    });
                    logToFile(`[StopImpersonate][${correlationId}] Sesión cerrada con éxito.`);
                } catch (e: any) {
                    logToFile(`[StopImpersonate][${correlationId}] ERROR cerrando sesión: ${e.message}`);
                }
            }

            logToFile(`[StopImpersonate][${correlationId}] Registrando AuditLog de STOP...`);
            try {
                await (coreAdapter.system as any).createAuditLog({
                    data: {
                        tenantId: tenantId,
                        userId: realUserId,
                        action: 'IMPERSONATE_STOP',
                        modelType: 'Organization',
                        modelId: tenantId,
                        details: {
                            realUserEmail,
                            sessionId,
                            correlationId
                        }
                    }
                });
            } catch (auditError: any) {
                logToFile(`[StopImpersonate][${correlationId}] ERROR AuditLog: ${auditError.message}`);
            }

            // --- Registro en Auditoría Global ---
            await GlobalAuditLogService.logEvent({
                category: 'auth',
                eventType: 'auth.stop_impersonation',
                severity: 'info',
                outcome: 'success',
                message: `Super Admin finalizó suplantación`,
                affectedTenantId: tenantId,
                metadata: {
                    realUserEmail,
                    sessionId,
                    correlationId
                }
            }, getAuditContext(req));
            // ------------------------------------
        }

        // Generar token original
        logToFile(`[StopImpersonate][${correlationId}] Restaurando token original del Super Admin...`);
        const originalToken = jwt.sign(
            {
                id: realUserId,
                email: realUserEmail,
                globalRole: 'admin'
            },
            coreEnv.JWT_SECRET as string,
            { expiresIn: '24h' }
        );

        logToFile(`[StopImpersonate][${correlationId}] Cierre EXITOSO`);
        res.json({
            success: true,
            token: originalToken
        });

    } catch (error: any) {
        logToFile(`[StopImpersonate][${correlationId}] FATAL ERROR: ${error.message} - ${error.stack}`);
        res.status(500).json({ 
            error: { 
                message: error.message || 'Error al detener la suplantación' 
            } 
        });
    }
});

// Montar rutas de auditoría global
router.use('/audit', superAdminAuditRoutes);

export const superAdminRoutes = router;
