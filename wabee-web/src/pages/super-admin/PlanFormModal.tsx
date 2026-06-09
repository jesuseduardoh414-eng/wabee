import React, { useState } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { T, S } from '@/lib/text-tokens';
import { Plan, CreatePlanPayload, PatchPlanPayload, superAdminPlansApi } from '@/api/wabee/plans.api';

interface PlanFormModalProps {
    plan?: Plan | null;
    onClose: () => void;
    onSaved: () => void;
}

const CURRENCIES = ['mxn', 'usd', 'eur', 'cop', 'ars'];
const INTERVALS = [{ value: 'month', label: 'Mensual' }, { value: 'year', label: 'Anual' }];

const DEFAULT_LIMITS = { channels: 1, contacts: 500, aiTokensPerMonth: 10000, aiAgents: 1, storageMb: 50, campaignsPerMonth: 1, users: 5 };
const DEFAULT_MODULES = { 
    team: true, audit: true, dashboard: true, inbox: true, 
    contacts: true, segments: true, groups: true, channels: true,
    aiProfiles: false, campaigns: false, templatesHub: false, 
    webWidgets: false, integrationsTools: false 
};

const VERSION_TRIGGER_FIELDS = ['monthlyPrice', 'annualPrice', 'currency', 'limitsJson', 'modulesJson'];

const LIMIT_LABELS: Record<string, string> = {
    aiAgents: 'Agentes de IA',
    aiTokensPerMonth: 'Tokens IA / Mes',
    campaignsPerMonth: 'Campañas / Mes',
    storageMb: 'Almacenamiento (MB)',
    channels: 'Canales',
    contacts: 'Contactos',
    users: 'Usuarios/Agentes'
};

export const PlanFormModal: React.FC<PlanFormModalProps> = ({ plan, onClose, onSaved }) => {
    const isEdit = !!plan;
    const cv = plan?.currentVersion;

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [willVersion, setWillVersion] = useState(false);

    // Campos del plan base
    const [name, setName] = useState(plan?.name || '');
    const [code, setCode] = useState(plan?.code || '');
    const [description, setDescription] = useState(plan?.description || '');
    const [status, setStatus] = useState<'draft' | 'active' | 'archived'>(plan?.status || 'draft');

    // Campos de la versión (materiales)
    const [monthlyPrice, setMonthlyPrice] = useState(cv?.monthlyPrice?.toString() || '0');
    const [annualPrice, setAnnualPrice] = useState(cv?.annualPrice?.toString() || '0');
    const [currency, setCurrency] = useState(cv?.currency || 'mxn');
    
    // Estados de Sync (sólo lectura de la versión actual si existe)
    const stripeSyncStatus = cv?.stripeSyncStatus || 'PENDING';
    const stripeSyncError = cv?.stripeSyncError || '';

    // Límites (Omitimos 'automations' si viene de versiones antiguas)
    const [limits, setLimits] = useState(() => {
        const base = { ...DEFAULT_LIMITS, ...(cv?.limitsJson || {}) };
        const { automations, ...rest } = base as any;
        return rest;
    });
    // Modules
    const [modules, setModules] = useState<Record<string, boolean>>({ ...DEFAULT_MODULES, ...(cv?.modulesJson || {}) });

    const isPriceFree = Number(monthlyPrice) === 0 && Number(annualPrice) === 0;
    const hasMonthly = Number(monthlyPrice) > 0;
    const hasAnnual = Number(annualPrice) > 0;

    const checkWillVersion = (field: string, value: any) => {
        if (!isEdit) return;
        const currentValues: Record<string, any> = { monthlyPrice: cv?.monthlyPrice?.toString(), annualPrice: cv?.annualPrice?.toString(), currency: cv?.currency, limitsJson: cv?.limitsJson, modulesJson: cv?.modulesJson };
        const changed = JSON.stringify(currentValues[field]) !== JSON.stringify(value);
        if (changed && VERSION_TRIGGER_FIELDS.includes(field)) setWillVersion(true);
    };

    const toggleModule = (key: string, checked: boolean) => {
        const updatedModules = { ...modules, [key]: checked };
        const updatedLimits = { ...limits };

        // ── Dependencias Lógicas ──────────────────────────────────────────
        if (key === 'aiProfiles' && !checked) {
            updatedModules.webWidgets = false;
            updatedModules.integrationsTools = false;
            updatedLimits.aiTokensPerMonth = 0; 
            updatedLimits.aiAgents = 0;
        }
        if (key === 'campaigns' || key === 'templatesHub') {
            updatedModules.campaigns = checked;
            updatedModules.templatesHub = checked;
            if (!checked) {
                updatedLimits.campaignsPerMonth = 0;
            } else if (updatedLimits.campaignsPerMonth === 0 || updatedLimits.campaignsPerMonth === null) {
                updatedLimits.campaignsPerMonth = 1;
            }
        }
        if (key === 'contacts' && !checked) {
            updatedModules.segments = false;
            updatedModules.groups = false;
            updatedLimits.contacts = 0;
        }
        if (key === 'channels' && !checked) {
            updatedLimits.channels = 0;
        }
        if (key === 'team' && !checked) {
            updatedLimits.users = 0;
        }

        // Si se activa, restaurar límites mínimos o dejar que el admin los edite
        if (checked) {
            if (key === 'aiProfiles' && (updatedLimits.aiTokensPerMonth === 0 || updatedLimits.aiTokensPerMonth === null)) {
                updatedLimits.aiTokensPerMonth = 10000;
                updatedLimits.aiAgents = 1;
            }
            if (key === 'campaigns' && (updatedLimits.campaignsPerMonth === 0 || updatedLimits.campaignsPerMonth === null)) updatedLimits.campaignsPerMonth = 1;
            if (key === 'contacts' && (updatedLimits.contacts === 0 || updatedLimits.contacts === null)) updatedLimits.contacts = 500;
            if (key === 'channels' && (updatedLimits.channels === 0 || updatedLimits.channels === null)) updatedLimits.channels = 1;
            if (key === 'team' && (updatedLimits.users === 0 || updatedLimits.users === null)) updatedLimits.users = 5;
        }

        setModules(updatedModules);
        setLimits(updatedLimits);
        checkWillVersion('modulesJson', updatedModules);
        checkWillVersion('limitsJson', updatedLimits);
    };

    const handleSave = async () => {
        setError('');
        if (!name.trim()) return setError('El nombre es requerido.');
        if (!code.trim()) return setError('El código es requerido.');
        
        setSaving(true);
        try {
            const mPrice = Number(monthlyPrice) || 0;
            const aPrice = Number(annualPrice) || 0;

            // Limpieza de límites: Si el módulo está apagado, forzar null/0
            // El backend tratará los 0/null como 'no disponible'
            const processedLimits = { ...limits };
            if (!modules.channels) processedLimits.channels = null as any;
            if (!modules.contacts) processedLimits.contacts = null as any;
            if (!modules.campaigns) processedLimits.campaignsPerMonth = null as any;
            if (!modules.aiProfiles) {
                processedLimits.aiTokensPerMonth = null as any;
                processedLimits.aiAgents = null as any;
            }
            if (!modules.team) processedLimits.users = null as any;

            if (isEdit) {
                const patch: PatchPlanPayload = {
                    name: name !== plan.name ? name : undefined,
                    description: description !== plan.description ? description : undefined,
                    monthlyPrice: mPrice,
                    annualPrice: aPrice,
                    currency: currency !== cv?.currency ? currency : undefined,
                    status: status !== plan.status ? status : undefined,
                    limitsJson: processedLimits,
                    modulesJson: modules,
                };
                await superAdminPlansApi.patchPlan(plan.id, patch);
            } else {
                const payload: CreatePlanPayload = { 
                    name, 
                    code, 
                    description: description || undefined, 
                    monthlyPrice: mPrice,
                    annualPrice: aPrice,
                    currency, 
                    limitsJson: processedLimits, 
                    modulesJson: modules,
                };
                await superAdminPlansApi.createPlan(payload);
            }
            onSaved();
        } catch (e: any) {
            setError(e.response?.data?.error?.message || 'Error al guardar el plan.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative z-10 flex max-h-[100dvh] w-full flex-col overflow-hidden rounded-t-[2rem] border border-[var(--border-default)] bg-[var(--bg-card)] shadow-2xl sm:max-h-[90vh] sm:max-w-3xl sm:rounded-[2rem]">
                {/* Header */}
                <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[var(--border-default)] bg-[var(--bg-card)] px-5 py-5 sm:items-center sm:px-6">
                    <div className="min-w-0">
                        <h2 className={`${T.cardTitle} ${S.headingLg}`}>{isEdit ? 'Editar Plan' : 'Crear Nuevo Plan'}</h2>
                        {isEdit && <p className={`${T.helperText} ${S.meta} mt-1`}>Versión vigente: <span className="text-[var(--brand-primary)]">{cv?.displayCode || `v${cv?.versionNumber}`}</span></p>}
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl text-[var(--text-muted)] hover:bg-[var(--bg-hover)] transition-all"><X size={20} /></button>
                </div>

                <div className="space-y-6 overflow-y-auto px-5 py-5 pb-28 sm:px-6">
                    {/* Banner de nueva versión */}
                    {isEdit && willVersion && (
                        <div className="p-4 rounded-xl bg-[var(--state-warning)]/10 border border-[var(--state-warning)]/30">
                            <p className={`${T.helperText} ${S.body} text-[var(--state-warning)] font-bold`}>⚠️ Se creará una nueva versión del plan</p>
                            <p className={`${T.helperText} ${S.meta} text-[var(--state-warning)]/80 mt-1`}>Los clientes actuales conservarán la configuración de la versión anterior. Solo nuevas suscripciones usarán esta versión.</p>
                        </div>
                    )}

                    {error && (
                        <div className="p-4 rounded-xl bg-[var(--state-danger)]/10 border border-[var(--state-danger)]/30">
                            <p className={`${T.helperText} ${S.body} text-[var(--state-danger)]`}>{error}</p>
                        </div>
                    )}

                    {/* Stripe Readiness Hint */}
                    {/* Banner Informativo sobre Stripe */}
                    {!isPriceFree && (
                        <div className="p-4 rounded-xl bg-[var(--brand-primary)]/5 border border-[var(--brand-primary)]/20">
                            <p className={`${T.helperText} ${S.body} font-black uppercase tracking-wider text-[var(--brand-primary)]`}>
                                ✨ Sincronización Automática Activa
                            </p>
                            <p className={`${T.helperText} ${S.meta} text-[var(--text-muted)] mt-1`}>
                                Al guardar, el sistema creará automáticamente los productos y precios en Stripe para {hasMonthly && 'Mensual'}{hasMonthly && hasAnnual && ' y '}{hasAnnual && 'Anual'}.
                            </p>
                        </div>
                    )}

                    {/* Plan Base */}
                    <section>
                        <h3 className={`${T.sectionTitle} ${S.meta} uppercase tracking-widest mb-4`}>Información del Plan</h3>
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label className={`${T.helperText} ${S.meta} block mb-2`}>Nombre del Plan</label>
                                    <input value={name} onChange={e => setName(e.target.value)} placeholder="Pro Hub" className={`w-full bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl py-3 px-4 ${T.inputText} ${S.body} focus:border-[var(--brand-primary)]/50 outline-none transition-all placeholder:text-[var(--text-muted)]/40`} />
                                </div>
                                <div>
                                    <label className={`${T.helperText} ${S.meta} block mb-2`}>Código Único {isEdit && <span className="text-[var(--text-muted)]/50">(no editable)</span>}</label>
                                    <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} disabled={isEdit} placeholder="PRO" className={`w-full bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl py-3 px-4 ${T.inputText} ${S.body} focus:border-[var(--brand-primary)]/50 outline-none transition-all placeholder:text-[var(--text-muted)]/40 disabled:opacity-40 disabled:cursor-not-allowed`} />
                                </div>
                            </div>
                            <div>
                                <label className={`${T.helperText} ${S.meta} block mb-2`}>Descripción</label>
                                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Descríbelo brevemente..." className={`w-full bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl py-3 px-4 ${T.inputText} ${S.body} focus:border-[var(--brand-primary)]/50 outline-none transition-all placeholder:opacity-40 resize-none`} />
                            </div>

                            {isEdit && (
                                <div>
                                    <label className={`${T.helperText} ${S.meta} block mb-2`}>Estado del Plan</label>
                                    <div className="relative">
                                        <select 
                                            value={status} 
                                            onChange={e => setStatus(e.target.value as any)} 
                                            className={`w-full appearance-none bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl py-3 px-4 pr-10 ${T.inputText} ${S.body} focus:border-[var(--brand-primary)]/50 outline-none transition-all`}
                                        >
                                            <option value="draft">Borrador (No visible para orgs)</option>
                                            <option value="active">Activo (Visible en el catálogo)</option>
                                            <option value="archived">Archivado (Solo mantenimiento)</option>
                                        </select>
                                        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
                                    </div>
                                    <p className={`${T.helperText} ${S.meta} mt-1 opacity-60 italic`}>Archivar un plan evita que nuevas organizaciones lo compren.</p>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Precios — MATERIAL */}
                    <section>
                        <h3 className={`${T.sectionTitle} ${S.meta} uppercase tracking-widest mb-1`}>Configuración Comercial</h3>
                        <p className={`${T.helperText} ${S.meta} mb-4 opacity-60`}>Define los precios. El sistema sincronizará con Stripe automáticamente.</p>
                        
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:items-end">
                            <div className="sm:col-span-1">
                                <label className={`${T.helperText} ${S.meta} block mb-2`}>Moneda</label>
                                <div className="relative">
                                    <select value={currency} onChange={e => { setCurrency(e.target.value); checkWillVersion('currency', e.target.value); }} className={`w-full appearance-none bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl py-3 px-4 pr-10 ${T.inputText} ${S.body} focus:border-[var(--brand-primary)]/50 outline-none transition-all`}>
                                        {CURRENCIES.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
                                    </select>
                                    <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
                                </div>
                            </div>
                            <div>
                                <label className={`${T.helperText} ${S.meta} block mb-2`}>Precio Mensual</label>
                                <input type="number" min={0} step={0.01} value={monthlyPrice} onChange={e => { setMonthlyPrice(e.target.value); checkWillVersion('monthlyPrice', e.target.value); }} className={`w-full bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl py-3 px-4 ${T.inputText} ${S.body} focus:border-[var(--brand-primary)]/50 outline-none transition-all`} />
                            </div>
                            <div>
                                <label className={`${T.helperText} ${S.meta} block mb-2`}>Precio Anual</label>
                                <input type="number" min={0} step={0.01} value={annualPrice} onChange={e => { setAnnualPrice(e.target.value); checkWillVersion('annualPrice', e.target.value); }} className={`w-full bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl py-3 px-4 ${T.inputText} ${S.body} focus:border-[var(--brand-primary)]/50 outline-none transition-all`} />
                            </div>
                            <div className="flex h-full flex-col justify-end">
                                <label className={`${T.helperText} ${S.meta} text-[var(--text-muted)] mb-2`}>Periodicidad</label>
                                <div className="p-3 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl text-center">
                                    <span className={`${S.meta} font-bold opacity-60 text-[var(--text-muted)]`}>
                                        {(Number(monthlyPrice) > 0 && Number(annualPrice) > 0) ? 'Ambas' : (Number(monthlyPrice) > 0 ? 'Sólo Mensual' : (Number(annualPrice) > 0 ? 'Sólo Anual' : 'Gratis'))}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Estado de Sincronización Stripe */}
                    {isEdit && !isPriceFree && (
                        <section className={`p-5 rounded-2xl border transition-all ${
                            willVersion ? 'bg-[var(--bg-page)] border-[var(--border-default)] opacity-60' :
                            stripeSyncStatus === 'READY' ? 'bg-[var(--state-success)]/5 border-[var(--state-success)]/20 shadow-sm shadow-[var(--state-success)]/10' :
                            stripeSyncStatus === 'FAILED' ? 'bg-[var(--state-danger)]/5 border-[var(--state-danger)]/20' :
                            'bg-[var(--brand-primary)]/5 border-[var(--brand-primary)]/20'
                        }`}>
                            <div className="flex items-center justify-between mb-2">
                                <h3 className={`${T.sectionTitle} ${S.meta} uppercase tracking-widest ${
                                    willVersion ? 'text-[var(--text-muted)]' :
                                    stripeSyncStatus === 'READY' ? 'text-[var(--state-success)]' :
                                    stripeSyncStatus === 'FAILED' ? 'text-[var(--state-danger)]' :
                                    'text-[var(--brand-primary)]'
                                }`}>
                                    Sincronización Stripe (v{cv?.versionNumber})
                                </h3>
                                <div className={`px-3 py-1 rounded-full ${S.meta} font-bold ${
                                    willVersion ? 'bg-[var(--text-muted)] text-white' :
                                    stripeSyncStatus === 'READY' ? 'bg-[var(--state-success)] text-white' :
                                    stripeSyncStatus === 'FAILED' ? 'bg-[var(--state-danger)] text-white' :
                                    stripeSyncStatus === 'PARTIAL' ? 'bg-[var(--state-warning)] text-white' :
                                    'bg-[var(--brand-primary)] text-[var(--brand-primary-foreground)]'
                                }`}>
                                    {willVersion ? 'REQUIERE ACTUALIZAR' : stripeSyncStatus}
                                </div>
                            </div>
                            
                            <p className={`${T.helperText} ${S.meta} opacity-70`}>
                                {willVersion ? 'Has cambiado datos comerciales. Al guardar se creará una nueva versión y se iniciará una nueva sincronización.' :
                                 stripeSyncStatus === 'READY' ? '✓ Producto y precios sincronizados correctamente.' :
                                 stripeSyncStatus === 'PARTIAL' ? '⚠ Algunos periodos no se sincronizaron.' :
                                 stripeSyncStatus === 'FAILED' ? `✕ Error: ${stripeSyncError || 'Fallo desconocido'}` :
                                 'Sincronización pendiente o en proceso...'}
                            </p>

                            {!willVersion && (cv?.stripePriceMonthlyId || cv?.stripePriceAnnualId) && (
                                <div className="mt-4 grid grid-cols-1 gap-4 border-t border-[var(--border-default)]/50 pt-4 sm:grid-cols-2">
                                    {cv.stripePriceMonthlyId?.startsWith?.('price_') && (
                                        <div className="flex flex-col">
                                            <span className={`${S.meta} ${T.helperText} text-[10px] uppercase font-bold`}>ID Mensual</span>
                                            <code className={`${T.helperText} text-[11px] text-[var(--brand-primary)] opacity-70 truncate`}>{cv.stripePriceMonthlyId}</code>
                                        </div>
                                    )}
                                    {cv.stripePriceAnnualId?.startsWith?.('price_') && (
                                        <div className="flex flex-col">
                                            <span className={`${S.meta} text-[var(--text-muted)] text-[10px] uppercase font-bold`}>ID Anual</span>
                                            <code className="text-[11px] text-[var(--brand-primary)] opacity-70 truncate">{cv.stripePriceAnnualId}</code>
                                        </div>
                                    )}
                                </div>
                            )}
                        </section>
                    )}
                    
                    {/* Módulos de Producto */}
                    <section>
                        <h3 className={`${T.sectionTitle} ${S.meta} uppercase tracking-widest mb-1`}>Módulos del Producto</h3>
                        <p className={`${T.helperText} ${S.meta} mb-4 opacity-60`}>Activa o desactiva las secciones principales del dashboard</p>
                        
                        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {Object.entries(modules).map(([key, val]) => {
                                // Deshabilitar si dependen de otro (visual solamente)
                                const isDependent = (key === 'webWidgets' || key === 'integrationsTools') ? !modules.aiProfiles : 
                                                   (key === 'segments' || key === 'groups') ? !modules.contacts : false;

                                return (
                                    <label key={key} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                                        isDependent ? 'opacity-40 cursor-not-allowed bg-[var(--bg-card)] border-[var(--border-default)]' : 
                                        'bg-[var(--bg-surface)] border-[var(--border-default)] cursor-pointer hover:border-[var(--brand-primary)]/30'
                                    }`}>
                                        <input 
                                            type="checkbox" 
                                            checked={Boolean(val)} 
                                            disabled={isDependent}
                                            onChange={e => toggleModule(key, e.target.checked)} 
                                            className="accent-[var(--brand-primary)] w-4 h-4 rounded" 
                                        />
                                        <div className="flex flex-col">
                                            <span className={`${T.helperText} ${S.body} capitalize leading-tight`}>{key.replace(/([A-Z])/g, ' $1').replace(/_/, ' ')}</span>
                                            {isDependent && <span className="text-[10px] text-[var(--state-danger)] opacity-80">Requiere módulo padre</span>}
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                    </section>

                    {/* Límites */}
                    <section>
                        <h3 className={`${T.sectionTitle} ${S.meta} uppercase tracking-widest mb-1`}>Límites</h3>
                        <p className={`${T.helperText} ${S.meta} mb-4 opacity-60`}>Cambios aquí crean una nueva versión</p>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                            {Object.entries(limits).map(([key, val]) => (
                                <div key={key}>
                                    <label className={`${T.helperText} ${S.meta} block mb-2 capitalize`}>{LIMIT_LABELS[key] || key.replace(/([A-Z])/g, ' $1')}</label>
                                    <input type="number" min={0} value={String(val)} onChange={e => { const updated = { ...limits, [key]: Number(e.target.value) }; setLimits(updated); checkWillVersion('limitsJson', updated); }} className={`w-full bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl py-3 px-4 ${T.inputText} ${S.body} focus:border-[var(--brand-primary)]/50 outline-none transition-all`} />
                                </div>
                            ))}
                        </div>
                    </section>

                </div>

                {/* Footer */}
                <div className="sticky bottom-0 flex flex-col-reverse gap-3 border-t border-[var(--border-default)] bg-[var(--bg-card)] px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6">
                    <button onClick={onClose} className={`w-full rounded-xl border border-[var(--border-default)] px-6 py-3 ${T.navText} ${S.body} transition-all hover:bg-[var(--bg-hover)] sm:w-auto`}>Cancelar</button>
                    <button onClick={handleSave} disabled={saving} className={`flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand-primary)] px-6 py-3 ${T.buttonPrimaryText} ${S.body} transition-all hover:scale-[1.02] shadow-lg disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto`}>
                        {saving ? 'Guardando...' : isEdit ? (willVersion ? '✦ Guardar (nueva versión)' : 'Guardar cambios') : 'Crear Plan'}
                    </button>
                </div>
            </div>
        </div>
    );
};
