import React, { useEffect, useState } from 'react';
import { aiApi, AiTool, IntegrationCredential, CreateIntegrationDto, UpdateIntegrationDto, ToolCapability, ToolConfirmationPolicy } from '@/api/wabee/ai.api';
import { useToast } from '@/context/ToastContext';
import {
    Plus,
    Pencil,
    Trash2,
    KeyRound,
    CheckCircle2,
    ShieldAlert,
    X,
    Wrench,
    PlayCircle,
    Terminal,
    Cpu,
    Zap,
    Activity,
    Loader2,
    Globe,
    Lock,
    Save,
    CheckCircle,
    Clock,
} from 'lucide-react';
import { format } from 'date-fns';
import { T, S } from '@/lib/text-tokens';

const AUTH_TYPES = [
    { value: 'NONE', label: 'Ninguna (Pública)', icon: Globe },
    { value: 'BEARER_TOKEN', label: 'Bearer Token', icon: Lock },
    { value: 'API_KEY_HEADER', label: 'API Key (Header)', icon: KeyRound },
    { value: 'BASIC_AUTH', label: 'Basic Auth', icon: CheckCircle2 },
] as const;

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

type ToolFormState = {
    name: string;
    displayName: string;
    description: string;
    method: string;
    endpointUrl: string;
    credentialId: string;
    parametersSchema: string;
    timeoutMs: number;
    retries: number;
    requireApproval: boolean;
    isActive: boolean;
    triggerHints: string[];
    exampleUtterances: string[];
    responseMapping: string;
    outputSchema: string;
    capability: ToolCapability | string;
    customCapability: string;
    semanticDescription: string;
    confirmationPolicy: ToolConfirmationPolicy | string;
    safetyFlags: {
        canMutateData: boolean;
        requiresConfirmation: boolean;
        safeToAutoRun: boolean;
        idempotent: boolean;
        sensitiveOperation: boolean;
    };
};

const defaultSafetyFlags = {
    canMutateData: false,
    requiresConfirmation: false,
    safeToAutoRun: true,
    idempotent: true,
    sensitiveOperation: false,
};

const defaultToolForm: ToolFormState = {
    name: '',
    displayName: '',
    description: '',
    method: 'POST',
    endpointUrl: '',
    credentialId: 'none',
    parametersSchema: '{\n  "type": "object",\n  "properties": {}\n}',
    timeoutMs: 5000,
    retries: 0,
    requireApproval: false,
    isActive: true,
    triggerHints: [],
    exampleUtterances: [],
    responseMapping: '',
    outputSchema: '',
    capability: 'general_api_fetch',
    customCapability: '',
    semanticDescription: '',
    confirmationPolicy: 'AUTO',
    safetyFlags: defaultSafetyFlags,
};

export default function AiIntegrationsPage() {
    const { success, error: toastError } = useToast();
    const [activeTab, setActiveTab] = useState<'integrations' | 'tools'>('integrations');
    const [isLoading, setIsLoading] = useState(true);
    const [integrations, setIntegrations] = useState<IntegrationCredential[]>([]);
    const [tools, setTools] = useState<AiTool[]>([]);

    const [isIntModalOpen, setIsIntModalOpen] = useState(false);
    const [intEditingId, setIntEditingId] = useState<string | null>(null);
    const [isIntSubmitting, setIsIntSubmitting] = useState(false);
    const [intName, setIntName] = useState('');
    const [intAuthType, setIntAuthType] = useState<'NONE' | 'BEARER_TOKEN' | 'API_KEY_HEADER' | 'BASIC_AUTH'>('NONE');
    const [intConfig, setIntConfig] = useState<any>({});
    const [intUpdateCredentials, setIntUpdateCredentials] = useState(false);
    const [intHasExistingConfig, setIntHasExistingConfig] = useState(false);

    const [isToolModalOpen, setIsToolModalOpen] = useState(false);
    const [toolEditingId, setToolEditingId] = useState<string | null>(null);
    const [isToolSubmitting, setIsToolSubmitting] = useState(false);
    const [toolFormData, setToolFormData] = useState<ToolFormState>(defaultToolForm);
    const [toolJsonErrorSchema, setToolJsonErrorSchema] = useState('');
    const [toolJsonErrorMapping, setToolJsonErrorMapping] = useState('');
    const [toolJsonErrorOutput, setToolJsonErrorOutput] = useState('');
    const [toolTagInput, setToolTagInput] = useState('');

    const [isTestModalOpen, setIsTestModalOpen] = useState(false);
    const [testTool, setTestTool] = useState<AiTool | null>(null);
    const [testPayload, setTestPayload] = useState('{\n  \n}');
    const [testResult, setTestResult] = useState<any>(null);
    const [isTesting, setIsTesting] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [integrationData, toolData] = await Promise.all([aiApi.listIntegrations(), aiApi.listTools()]);
            setIntegrations(integrationData);
            setTools(toolData);
        } catch (err: any) {
            toastError('Error cargando datos: ' + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenIntModal = (integration?: IntegrationCredential) => {
        if (integration) {
            setIntEditingId(integration.id);
            setIntName(integration.name);
            setIntAuthType(integration.authType);
            setIntHasExistingConfig(integration.hasConfig);
            setIntUpdateCredentials(false);
            setIntConfig({});
        } else {
            setIntEditingId(null);
            setIntName('');
            setIntAuthType('NONE');
            setIntConfig({});
            setIntHasExistingConfig(false);
            setIntUpdateCredentials(true);
        }
        setIsIntModalOpen(true);
    };

    const handleIntSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsIntSubmitting(true);
        try {
            if (intEditingId) {
                const payload: UpdateIntegrationDto = { name: intName, authType: intAuthType };
                if (intUpdateCredentials) payload.config = intConfig;
                await aiApi.updateIntegration(intEditingId, payload);
                success('Integración actualizada');
            } else {
                const payload: CreateIntegrationDto = { name: intName, authType: intAuthType, config: intConfig };
                await aiApi.createIntegration(payload);
                success('Integración creada');
            }
            setIsIntModalOpen(false);
            loadData();
        } catch (err: any) {
            toastError('Error: ' + err.message);
        } finally {
            setIsIntSubmitting(false);
        }
    };

    const handleIntDelete = async (id: string, name: string) => {
        if (!window.confirm(`¿Eliminar integración "${name}"? Afectará a las herramientas que la usen.`)) return;
        try {
            await aiApi.deleteIntegration(id);
            success('Integración eliminada');
            loadData();
        } catch (err: any) {
            toastError('Error: ' + err.message);
        }
    };

    const normalizeToolForm = (tool?: AiTool) => {
        if (!tool) {
            setToolFormData(defaultToolForm);
            return;
        }

        setToolFormData({
            ...defaultToolForm,
            ...tool,
            credentialId: tool.credentialId || 'none',
            parametersSchema:
                typeof tool.parametersSchema === 'object' && tool.parametersSchema !== null
                    ? JSON.stringify(tool.parametersSchema, null, 2)
                    : tool.parametersSchema || defaultToolForm.parametersSchema,
            responseMapping:
                typeof tool.responseMapping === 'object' && tool.responseMapping !== null
                    ? JSON.stringify(tool.responseMapping, null, 2)
                    : tool.responseMapping || '',
            outputSchema:
                typeof tool.outputSchema === 'object' && tool.outputSchema !== null
                    ? JSON.stringify(tool.outputSchema, null, 2)
                    : tool.outputSchema || '',
            capability: tool.capability || 'general_api_fetch',
            customCapability: tool.customCapability || '',
            semanticDescription: tool.semanticDescription || '',
            confirmationPolicy: tool.confirmationPolicy || 'AUTO',
            safetyFlags: tool.safetyFlags || defaultSafetyFlags,
            exampleUtterances: Array.isArray(tool.exampleUtterances) ? tool.exampleUtterances : [],
            triggerHints: Array.isArray(tool.triggerHints) ? tool.triggerHints : [],
        });
    };

    const handleOpenToolModal = (tool?: AiTool) => {
        setToolJsonErrorSchema('');
        setToolJsonErrorMapping('');
        setToolJsonErrorOutput('');
        setToolEditingId(tool?.id || null);
        setToolTagInput('');
        normalizeToolForm(tool);
        setIsToolModalOpen(true);
    };

    const validateJson = (value: string, setError: (message: string) => void) => {
        if (!value || value.trim() === '') {
            setError('');
            return true;
        }

        try {
            JSON.parse(value);
            setError('');
            return true;
        } catch {
            setError('JSON inválido');
            return false;
        }
    };

    const handleToolSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const schemaOk = validateJson(toolFormData.parametersSchema, setToolJsonErrorSchema);
        const mappingOk = validateJson(toolFormData.responseMapping, setToolJsonErrorMapping);
        const outputOk = validateJson(toolFormData.outputSchema, setToolJsonErrorOutput);

        if (!schemaOk || !mappingOk || !outputOk) {
            toastError('Revisa los errores de JSON en el formulario.');
            return;
        }

        setIsToolSubmitting(true);
        try {
            const payload = {
                ...toolFormData,
                parametersSchema: JSON.parse(toolFormData.parametersSchema || '{}'),
                responseMapping: toolFormData.responseMapping ? JSON.parse(toolFormData.responseMapping) : null,
                outputSchema: toolFormData.outputSchema ? JSON.parse(toolFormData.outputSchema) : null,
                credentialId: toolFormData.credentialId === 'none' ? null : toolFormData.credentialId,
                triggerHints: Array.isArray(toolFormData.triggerHints) ? toolFormData.triggerHints : [],
                exampleUtterances: Array.isArray(toolFormData.exampleUtterances) ? toolFormData.exampleUtterances : [],
                capability: toolFormData.capability as ToolCapability,
                confirmationPolicy: toolFormData.confirmationPolicy as ToolConfirmationPolicy,
            };

            if (toolEditingId) {
                await aiApi.updateTool(toolEditingId, payload);
                success('Habilidad actualizada');
            } else {
                await aiApi.createTool(payload);
                success('Habilidad creada');
            }

            setIsToolModalOpen(false);
            loadData();
        } catch (err: any) {
            toastError('Error: ' + err.message);
        } finally {
            setIsToolSubmitting(false);
        }
    };

    const handleToolDelete = async (id: string, name: string) => {
        if (!window.confirm(`¿Eliminar herramienta "${name}"?`)) return;
        try {
            await aiApi.deleteTool(id);
            success('Habilidad eliminada');
            loadData();
        } catch (err: any) {
            toastError('Error: ' + err.message);
        }
    };

    const handleAddTag = (value: string) => {
        const clean = value.trim().replace(/,$/, '');
        if (!clean) return;
        const current = Array.isArray(toolFormData.exampleUtterances) ? toolFormData.exampleUtterances : [];
        if (current.includes(clean)) {
            setToolTagInput('');
            return;
        }
        setToolFormData((prev) => ({ ...prev, exampleUtterances: [...current, clean] }));
        setToolTagInput('');
    };

    const handleRemoveTag = (index: number) => {
        const current = Array.isArray(toolFormData.exampleUtterances) ? toolFormData.exampleUtterances : [];
        setToolFormData((prev) => ({ ...prev, exampleUtterances: current.filter((_, itemIndex) => itemIndex !== index) }));
    };

    const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if ((e.key === 'Enter' || e.key === ',') && toolTagInput) {
            e.preventDefault();
            handleAddTag(toolTagInput);
        } else if (e.key === 'Backspace' && !toolTagInput) {
            const current = Array.isArray(toolFormData.exampleUtterances) ? toolFormData.exampleUtterances : [];
            if (current.length > 0) handleRemoveTag(current.length - 1);
        }
    };

    const handleOpenTest = (tool: AiTool) => {
        setTestTool(tool);
        setTestResult(null);
        let dummyPayload = '{\n  \n}';

        try {
            const schema = typeof tool.parametersSchema === 'string' ? JSON.parse(tool.parametersSchema) : tool.parametersSchema;
            if (schema?.properties) {
                const dummy: any = {};
                for (const key of Object.keys(schema.properties)) {
                    dummy[key] = schema.properties[key].type === 'string' ? '' : null;
                }
                dummyPayload = JSON.stringify(dummy, null, 2);
            }
        } catch {
            // ignore
        }

        setTestPayload(dummyPayload);
        setIsTestModalOpen(true);
    };

    const handleRunTest = async () => {
        if (!testTool) return;
        setIsTesting(true);
        try {
            const result = await aiApi.testTool(testTool.id, JSON.parse(testPayload));
            setTestResult(result);
            success('Prueba terminada');
        } catch (err: any) {
            setTestResult({ error: true, message: err.message });
        } finally {
            setIsTesting(false);
        }
    };

    const renderIntConfigFields = () => {
        if (intEditingId && intHasExistingConfig && !intUpdateCredentials) {
            return (
                <div className="mt-2 flex items-center gap-3 rounded-xl border border-[var(--state-success)]/30 bg-[var(--state-success)]/10 p-4">
                    <CheckCircle2 className="h-5 w-5 text-[color:var(--state-success)]" />
                    <div className="text-sm">
                        <p className={`font-bold text-[color:var(--text-strong)] ${T.cardTitle}`}>Credenciales configuradas de forma segura</p>
                        <p className={`text-xs text-[color:var(--text-muted)] ${T.helperText}`}>Los secretos están cifrados y no se muestran por seguridad.</p>
                    </div>
                </div>
            );
        }

        if (intAuthType === 'BEARER_TOKEN') {
            return (
                <div className="mt-4 space-y-2">
                    <label className={`${T.labelText} ${S.meta} block uppercase tracking-widest text-[color:var(--text-muted)]`}>Token de acceso</label>
                    <input
                        type="password"
                        placeholder="ey..."
                        className={`${T.inputText} w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-page)] px-4 py-4 outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/50`}
                        value={intConfig.token || ''}
                        onChange={(e) => setIntConfig((prev: any) => ({ ...prev, token: e.target.value }))}
                        required
                    />
                </div>
            );
        }

        if (intAuthType === 'API_KEY_HEADER') {
            return (
                <div className="mt-4 space-y-4">
                    <div className="space-y-2">
                        <label className={`${T.labelText} ${S.meta} block uppercase tracking-widest text-[color:var(--text-muted)]`}>Nombre del header</label>
                        <input
                            placeholder="x-api-key"
                            className={`${T.inputText} w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-page)] px-4 py-4 outline-none`}
                            value={intConfig.headerName || ''}
                            onChange={(e) => setIntConfig((prev: any) => ({ ...prev, headerName: e.target.value }))}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <label className={`${T.labelText} ${S.meta} block uppercase tracking-widest text-[color:var(--text-muted)]`}>Valor secreto</label>
                        <input
                            type="password"
                            placeholder="sk_live_..."
                            className={`${T.inputText} w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-page)] px-4 py-4 outline-none`}
                            value={intConfig.headerValue || ''}
                            onChange={(e) => setIntConfig((prev: any) => ({ ...prev, headerValue: e.target.value }))}
                            required
                        />
                    </div>
                </div>
            );
        }

        if (intAuthType === 'BASIC_AUTH') {
            return (
                <div className="mt-4 space-y-4">
                    <div className="space-y-2">
                        <label className={`${T.labelText} ${S.meta} block uppercase tracking-widest text-[color:var(--text-muted)]`}>Usuario</label>
                        <input
                            placeholder="admin"
                            className={`${T.inputText} w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-page)] px-4 py-4 outline-none`}
                            value={intConfig.username || ''}
                            onChange={(e) => setIntConfig((prev: any) => ({ ...prev, username: e.target.value }))}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <label className={`${T.labelText} ${S.meta} block uppercase tracking-widest text-[color:var(--text-muted)]`}>Contraseña</label>
                        <input
                            type="password"
                            placeholder="••••••••"
                            className={`${T.inputText} w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-page)] px-4 py-4 outline-none`}
                            value={intConfig.password || ''}
                            onChange={(e) => setIntConfig((prev: any) => ({ ...prev, password: e.target.value }))}
                            required
                        />
                    </div>
                </div>
            );
        }

        return (
            <div className="mt-4 flex gap-3 rounded-xl border border-[var(--brand-primary)]/20 bg-[var(--brand-primary)]/5 p-4">
                <ShieldAlert className="h-5 w-5 shrink-0 text-[color:var(--brand-primary)]" />
                <span className={`${T.helperText} ${S.meta} text-[color:var(--text-muted)]`}>
                    Esta API es pública o no requiere cabeceras configurables.
                </span>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-[var(--bg-page)] px-4 pb-24 pt-6 sm:px-6 lg:px-10">
            <div className="mx-auto max-w-7xl space-y-8 lg:space-y-10">
                <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                    <div className="space-y-2">
                        <h1 className={`${T.pageTitle} ${S.displayMd}`}>Engine <span className="text-[var(--ty-accent)]">Control</span></h1>
                        <p className={`${T.pageSubtitle} ${S.body} max-w-xl`}>Orquestación de capacidades cognitivas y conectores externos de WABEE.</p>
                    </div>

                    <div className="grid w-full grid-cols-2 gap-2 rounded-[1.5rem] border border-[var(--border-default)] bg-[var(--bg-card)] p-1.5 shadow-inner lg:w-auto">
                        <button
                            onClick={() => setActiveTab('integrations')}
                            className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 transition-all ${activeTab === 'integrations' ? 'bg-[var(--brand-primary)] shadow-lg' : 'text-[color:var(--text-muted)] hover:text-[color:var(--brand-primary)]'}`}
                        >
                            <KeyRound size={18} />
                            <span className={`${T.buttonPrimaryText} ${S.meta} uppercase tracking-widest`}>Conectores</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('tools')}
                            className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 transition-all ${activeTab === 'tools' ? 'bg-[var(--brand-primary)] shadow-lg' : 'text-[color:var(--text-muted)] hover:text-[color:var(--brand-primary)]'}`}
                        >
                            <Zap size={18} />
                            <span className={`${T.buttonPrimaryText} ${S.meta} uppercase tracking-widest`}>Habilidades</span>
                        </button>
                    </div>
                </header>

                {activeTab === 'integrations' ? (
                    <div className="space-y-6">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-3 rounded-full border border-[var(--brand-primary)]/10 bg-[var(--brand-primary)]/5 px-4 py-3">
                                <ShieldAlert size={16} className="text-[color:var(--brand-primary)]" />
                                <p className={`${T.helperText} ${S.meta} uppercase tracking-[3px] text-[color:var(--brand-primary)]`}>Credenciales cifradas AES-256</p>
                            </div>
                            <button
                                onClick={() => handleOpenIntModal()}
                                className={`flex items-center justify-center gap-3 rounded-[1.25rem] bg-[var(--brand-primary)] px-6 py-4 shadow-xl transition-all active:scale-[0.98] ${T.buttonPrimaryText} ${S.body} uppercase tracking-widest`}
                            >
                                <Plus size={20} />
                                Nueva integración
                            </button>
                        </div>

                        <div className="overflow-hidden rounded-[2rem] border border-[var(--border-default)] bg-[var(--bg-card)] shadow-2xl">
                            {isLoading ? (
                                <div className="p-16 text-center">
                                    <Loader2 className="mx-auto mb-5 animate-spin text-[color:var(--brand-primary)]" size={36} />
                                    <p className={`${T.helperText} ${S.meta} uppercase tracking-[4px] text-[color:var(--text-muted)]`}>Sincronizando conectores...</p>
                                </div>
                            ) : integrations.length === 0 ? (
                                <div className="p-16 text-center">
                                    <KeyRound size={56} className="mx-auto mb-5 opacity-20" />
                                    <p className={`${T.helperText} ${S.meta} uppercase tracking-[4px] text-[color:var(--text-muted)]`}>Sin integraciones activas</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-[var(--border-default)]">
                                    {integrations.map((item) => (
                                        <div key={item.id} className="flex flex-col gap-4 p-5 transition-all hover:bg-[var(--brand-primary)]/[0.02] sm:flex-row sm:items-center sm:justify-between sm:p-8">
                                            <div className="flex items-start gap-4 sm:gap-6">
                                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--brand-primary)] shadow-inner sm:h-14 sm:w-14">
                                                    <KeyRound size={22} />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <h3 className={`${T.cardTitle} ${S.body} tracking-wider`}>{item.name}</h3>
                                                        <span className={`${T.badgeText} rounded-lg border border-[var(--brand-primary)]/20 bg-[var(--brand-primary)]/10 px-2 py-1 text-[8px] uppercase tracking-[2px] text-[var(--brand-primary)] sm:text-[9px]`}>
                                                            {item.authType.replace('_', ' ')}
                                                        </span>
                                                    </div>
                                                    <div className="mt-1.5 flex flex-wrap items-center gap-3 opacity-70 sm:gap-4">
                                                        <div className="flex items-center gap-1.5">
                                                            <Clock size={12} className="text-[color:var(--text-muted)]" />
                                                            <span className={`${T.helperText} ${S.meta} text-[9px] uppercase tracking-widest text-[color:var(--text-muted)]`}>
                                                                {format(new Date(item.createdAt), 'dd MMM yyyy')}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            {item.hasConfig ? <Lock size={12} className="text-[color:var(--state-success)]" /> : <Globe size={12} className="text-[color:var(--text-muted)]" />}
                                                            <span className={`${T.helperText} ${S.meta} text-[9px] uppercase tracking-widest text-[color:var(--text-muted)]`}>
                                                                {item.hasConfig ? 'Cifrado' : 'Público'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex gap-3 self-end sm:self-auto">
                                                <button
                                                    onClick={() => handleOpenIntModal(item)}
                                                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-transparent bg-[var(--bg-input)] text-[var(--text-muted)] shadow-lg transition-all hover:border-[var(--brand-primary)]/30 hover:text-[var(--brand-primary)]"
                                                >
                                                    <Pencil size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleIntDelete(item.id, item.name)}
                                                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-transparent bg-[var(--bg-input)] text-[var(--text-muted)] shadow-lg transition-all hover:border-[var(--state-danger)]/30 hover:text-[var(--state-danger)]"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-3 rounded-full border border-[var(--brand-primary)]/10 bg-[var(--brand-primary)]/5 px-4 py-3">
                                <Activity size={16} className="text-[color:var(--brand-primary)]" />
                                <p className={`${T.helperText} ${S.meta} uppercase tracking-[3px] text-[color:var(--brand-primary)]`}>Monitoreo de latencia activo</p>
                            </div>
                            <button
                                onClick={() => handleOpenToolModal()}
                                className={`flex items-center justify-center gap-3 rounded-[1.25rem] bg-[var(--brand-primary)] px-6 py-4 shadow-xl transition-all active:scale-[0.98] ${T.buttonPrimaryText} ${S.body} uppercase tracking-widest`}
                            >
                                <Plus size={20} />
                                Nueva habilidad
                            </button>
                        </div>

                        {isLoading ? (
                            <div className="rounded-[2rem] border border-[var(--border-default)] bg-[var(--bg-card)] p-16 text-center shadow-2xl">
                                <Loader2 className="mx-auto mb-5 animate-spin text-[color:var(--brand-primary)]" size={36} />
                                <p className={`${T.helperText} ${S.meta} uppercase tracking-[4px] text-[color:var(--text-muted)]`}>Indexando habilidades...</p>
                            </div>
                        ) : tools.length === 0 ? (
                            <div className="rounded-[2rem] border border-[var(--border-default)] bg-[var(--bg-card)] p-16 text-center shadow-2xl">
                                <Wrench size={56} className="mx-auto mb-5 opacity-20" />
                                <p className={`${T.helperText} ${S.meta} uppercase tracking-[4px] text-[color:var(--text-muted)]`}>Sin habilidades configuradas</p>
                            </div>
                        ) : (
                            <>
                                <div className="hidden overflow-hidden rounded-[2rem] border border-[var(--border-default)] bg-[var(--bg-card)] shadow-2xl lg:block">
                                    <div className="overflow-x-auto">
                                        <table className="w-full border-collapse">
                                            <thead>
                                                <tr className={`${T.labelText} ${S.meta} border-b border-[var(--border-default)] bg-[var(--bg-surface)]/50 uppercase tracking-[3px] text-[color:var(--text-muted)]`}>
                                                    <th className="px-8 py-6 text-left">Habilidad / ID</th>
                                                    <th className="px-8 py-6 text-left">Punto de enlace</th>
                                                    <th className="px-8 py-6 text-center">Ejecución</th>
                                                    <th className="px-8 py-6 text-center">Estado</th>
                                                    <th className="px-8 py-6 text-right">Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-[var(--border-default)]">
                                                {tools.map((tool) => (
                                                    <tr key={tool.id} className="transition-all hover:bg-[var(--brand-primary)]/[0.02]">
                                                        <td className="px-8 py-6">
                                                            <div className="flex items-center gap-4">
                                                                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--brand-primary)]/60">
                                                                    <Cpu size={20} />
                                                                </div>
                                                                <div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className={`${T.cardTitle} ${S.body} tracking-wider`}>{tool.displayName || tool.name}</span>
                                                                        {(!tool.capability || tool.capability === 'general_api_fetch') && (
                                                                            <span className={`${T.badgeText} ${S.meta} rounded border border-[var(--state-warning)]/20 bg-[var(--state-warning)]/10 px-1.5 py-0.5 text-[8px] uppercase tracking-tighter text-[color:var(--state-warning)]`}>
                                                                                Legacy
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div className={`${T.helperText} ${S.meta} mt-0.5 font-mono text-[9px] uppercase tracking-widest text-[color:var(--brand-primary)]/40`}>
                                                                        ID: {tool.name}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-8 py-6">
                                                            <div className="flex items-center gap-3">
                                                                <span className={`${S.meta} rounded-lg border border-[var(--brand-primary)]/20 bg-[var(--brand-primary)]/10 px-2 py-0.5 text-[9px] font-black text-[var(--brand-primary)]`}>
                                                                    {tool.method}
                                                                </span>
                                                                <span className={`${S.meta} max-w-[220px] truncate text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]`}>
                                                                    {tool.endpointUrl}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-8 py-6 text-center">
                                                            {(tool.confirmationPolicy === 'MANUAL' || tool.requireApproval) ? (
                                                                <span className={`${T.badgeText} ${S.meta} rounded-full border border-[var(--state-danger)]/20 bg-[var(--state-danger)]/10 px-3 py-1 text-[9px] uppercase tracking-widest text-[color:var(--state-danger)]`}>
                                                                    Manual
                                                                </span>
                                                            ) : tool.confirmationPolicy === 'HYBRID' ? (
                                                                <span className={`${T.badgeText} ${S.meta} rounded-full border border-[var(--state-warning)]/20 bg-[var(--state-warning)]/10 px-3 py-1 text-[9px] uppercase tracking-widest text-[color:var(--state-warning)]`}>
                                                                    Híbrido
                                                                </span>
                                                            ) : (
                                                                <span className={`${T.helperText} ${S.meta} text-[9px] uppercase tracking-widest text-[color:var(--text-muted)] opacity-50`}>
                                                                    Automático
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-8 py-6 text-center">
                                                            <div className={`mx-auto h-2 w-2 rounded-full ${tool.isActive ? 'bg-[var(--state-success)]' : 'bg-[var(--state-danger)]'}`} />
                                                        </td>
                                                        <td className="px-8 py-6">
                                                            <div className="flex justify-end gap-2">
                                                                <button
                                                                    onClick={() => handleOpenTest(tool)}
                                                                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-transparent text-[color:var(--state-info)] transition-all hover:border-[var(--state-info)]/20 hover:bg-[var(--state-info)]/10"
                                                                    title="Probar habilidad"
                                                                >
                                                                    <PlayCircle size={20} />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleOpenToolModal(tool)}
                                                                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-transparent text-[var(--text-muted)] transition-all hover:border-[var(--brand-primary)]/20 hover:text-[var(--brand-primary)]"
                                                                >
                                                                    <Pencil size={20} />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleToolDelete(tool.id, tool.name)}
                                                                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-transparent text-[var(--text-muted)] transition-all hover:border-[var(--state-danger)]/20 hover:text-[var(--state-danger)]"
                                                                >
                                                                    <Trash2 size={20} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div className="space-y-4 lg:hidden">
                                    {tools.map((tool) => (
                                        <div key={tool.id} className="rounded-[2rem] border border-[var(--border-default)] bg-[var(--bg-card)] p-5 shadow-xl">
                                            <div className="flex items-start gap-4">
                                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--brand-primary)]/70">
                                                    <Cpu size={22} />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <h3 className={`${T.cardTitle} ${S.body}`}>{tool.displayName || tool.name}</h3>
                                                        {(!tool.capability || tool.capability === 'general_api_fetch') && (
                                                            <span className={`${T.badgeText} ${S.meta} rounded border border-[var(--state-warning)]/20 bg-[var(--state-warning)]/10 px-1.5 py-0.5 text-[8px] uppercase tracking-tighter text-[color:var(--state-warning)]`}>
                                                                Legacy
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className={`${T.helperText} ${S.meta} mt-1 font-mono uppercase tracking-widest text-[color:var(--brand-primary)]/40`}>
                                                        ID: {tool.name}
                                                    </p>
                                                    <div className="mt-3 flex flex-wrap items-center gap-2">
                                                        <span className={`${S.meta} rounded-lg border border-[var(--brand-primary)]/20 bg-[var(--brand-primary)]/10 px-2 py-0.5 text-[9px] font-black text-[var(--brand-primary)]`}>
                                                            {tool.method}
                                                        </span>
                                                        <span className={`${T.helperText} ${S.meta} rounded bg-[var(--bg-input)] px-2 py-0.5`}>
                                                            {tool.confirmationPolicy === 'MANUAL' || tool.requireApproval
                                                                ? 'Manual'
                                                                : tool.confirmationPolicy === 'HYBRID'
                                                                  ? 'Híbrido'
                                                                  : 'Automático'}
                                                        </span>
                                                        <span className={`${T.helperText} ${S.meta} flex items-center gap-1 rounded bg-[var(--bg-input)] px-2 py-0.5`}>
                                                            <span className={`h-2 w-2 rounded-full ${tool.isActive ? 'bg-[var(--state-success)]' : 'bg-[var(--state-danger)]'}`} />
                                                            {tool.isActive ? 'Activa' : 'Inactiva'}
                                                        </span>
                                                    </div>
                                                    <p className={`${T.helperText} ${S.meta} mt-3 truncate uppercase tracking-widest text-[var(--text-muted)]`}>
                                                        {tool.endpointUrl}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="mt-4 flex justify-end gap-2">
                                                <button
                                                    onClick={() => handleOpenTest(tool)}
                                                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-transparent text-[color:var(--state-info)] transition-all hover:border-[var(--state-info)]/20 hover:bg-[var(--state-info)]/10"
                                                >
                                                    <PlayCircle size={20} />
                                                </button>
                                                <button
                                                    onClick={() => handleOpenToolModal(tool)}
                                                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-transparent text-[var(--text-muted)] transition-all hover:border-[var(--brand-primary)]/20 hover:text-[var(--brand-primary)]"
                                                >
                                                    <Pencil size={20} />
                                                </button>
                                                <button
                                                    onClick={() => handleToolDelete(tool.id, tool.name)}
                                                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-transparent text-[var(--text-muted)] transition-all hover:border-[var(--state-danger)]/20 hover:text-[var(--state-danger)]"
                                                >
                                                    <Trash2 size={20} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {isIntModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setIsIntModalOpen(false)} />
                        <div className="relative flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-[2rem] border border-[var(--border-default)] bg-[var(--bg-card)] shadow-2xl sm:rounded-[2.5rem]">
                            <div className="p-6 pb-4 sm:p-10 sm:pb-6">
                                <div className="flex items-center gap-4">
                                    <div className="flex h-14 w-14 items-center justify-center rounded-[1.25rem] bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] shadow-inner">
                                        <KeyRound size={28} />
                                    </div>
                                    <div>
                                        <h2 className={`${T.sectionTitle} ${S.headingLg}`}>
                                            {intEditingId ? 'Editar' : 'Nueva'} <span className="text-[var(--ty-accent)]">Integración</span>
                                        </h2>
                                        <p className={`${T.pageSubtitle} ${S.body} text-[color:var(--text-muted)]`}>Configura un conector seguro para servicios externos.</p>
                                    </div>
                                </div>
                            </div>

                            <form onSubmit={handleIntSubmit} className="flex-1 overflow-y-auto px-6 pb-6 sm:px-10 sm:pb-10">
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className={`${T.labelText} ${S.meta} ml-2 uppercase tracking-[4px] text-[color:var(--text-muted)]`}>Nombre del conector</label>
                                        <input
                                            className={`${T.inputText} ${S.body} w-full rounded-[1.25rem] border border-[var(--border-default)] bg-[var(--bg-page)] px-5 py-4 outline-none transition-all placeholder:text-[color:var(--text-muted)]`}
                                            value={intName}
                                            onChange={(e) => setIntName(e.target.value)}
                                            required
                                            placeholder="Ej: Hubspot, Stripe, etc..."
                                        />
                                    </div>

                                    <div className="space-y-3">
                                        <label className={`${T.labelText} ${S.meta} ml-2 uppercase tracking-[4px] text-[color:var(--brand-primary)]`}>Tipo de autenticación</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            {AUTH_TYPES.map((option) => {
                                                const Icon = option.icon;
                                                return (
                                                    <button
                                                        key={option.value}
                                                        type="button"
                                                        onClick={() => {
                                                            setIntAuthType(option.value);
                                                            setIntConfig({});
                                                            if (intEditingId) setIntUpdateCredentials(true);
                                                        }}
                                                        className={`flex min-h-[120px] flex-col items-center justify-center gap-3 rounded-[1.25rem] border-2 p-4 text-center transition-all ${
                                                            intAuthType === option.value
                                                                ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5'
                                                                : 'border-[var(--border-default)] bg-[var(--bg-page)] hover:border-[var(--brand-primary)]/30'
                                                        }`}
                                                    >
                                                        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${intAuthType === option.value ? 'bg-[var(--brand-primary)] text-white' : 'bg-[var(--bg-surface)] text-[color:var(--text-muted)]'}`}>
                                                            <Icon size={22} />
                                                        </div>
                                                        <p className={`${T.buttonText} ${S.meta} leading-tight uppercase tracking-widest ${intAuthType === option.value ? 'text-[color:var(--text-strong)]' : 'text-[color:var(--text-muted)]'}`}>
                                                            {option.label}
                                                        </p>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {intEditingId && intAuthType !== 'NONE' && (
                                        <button
                                            type="button"
                                            onClick={() => setIntUpdateCredentials(!intUpdateCredentials)}
                                            className={`flex w-full items-center justify-between rounded-[1.25rem] border-2 p-5 transition-all ${
                                                intUpdateCredentials ? 'border-[var(--brand-primary)]/50 bg-[var(--brand-primary)]/5' : 'border-[var(--border-default)] bg-[var(--bg-page)]'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`rounded-lg p-2 ${intUpdateCredentials ? 'bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]' : 'bg-[var(--bg-surface)] text-[color:var(--text-muted)]'}`}>
                                                    <Lock size={18} />
                                                </div>
                                                <p className={`${T.buttonText} ${S.meta} uppercase tracking-widest ${intUpdateCredentials ? 'text-[color:var(--text-strong)]' : 'text-[color:var(--text-muted)]'}`}>Actualizar credenciales</p>
                                            </div>
                                            <div className={`relative h-5 w-10 rounded-full transition-colors ${intUpdateCredentials ? 'bg-[var(--brand-primary)]' : 'bg-[var(--bg-surface)]'}`}>
                                                <div className={`absolute top-[2px] h-4 w-4 rounded-full bg-white transition-transform ${intUpdateCredentials ? 'translate-x-[22px]' : 'translate-x-[2px]'}`} />
                                            </div>
                                        </button>
                                    )}

                                    {renderIntConfigFields()}

                                    <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">
                                        <button
                                            type="button"
                                            onClick={() => setIsIntModalOpen(false)}
                                            className="flex items-center justify-center gap-3 rounded-[1.25rem] border-2 border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-4 uppercase tracking-widest transition-all active:scale-95"
                                        >
                                            <X size={18} className={`${T.labelText} text-[color:var(--text-strong)]`} />
                                            <span className={`${T.labelText} ${S.body} text-[color:var(--text-strong)]`}>Cancelar</span>
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isIntSubmitting}
                                            className="flex items-center justify-center gap-3 rounded-[1.25rem] bg-[var(--brand-primary)] px-4 py-4 shadow-2xl transition-all active:scale-95 disabled:opacity-50"
                                        >
                                            {isIntSubmitting ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                                            <span className={`${T.buttonPrimaryText} ${S.body}`}>{intEditingId ? 'Sincronizar' : 'Crear conector'}</span>
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {isToolModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4">
                        <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsToolModalOpen(false)} />
                        <div className="relative flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-[2rem] border border-[var(--border-default)] bg-[var(--bg-card)] shadow-2xl sm:rounded-[2.5rem]">
                            <header className="shrink-0 border-b border-[var(--border-default)] bg-[var(--bg-surface)]/50 px-6 py-5 sm:px-8">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]">
                                            <Cpu size={24} />
                                        </div>
                                        <div>
                                            <h2 className={`${T.sectionTitle} ${S.headingLg}`}>
                                                {toolEditingId ? 'Editar' : 'Nueva'} <span className="text-[var(--brand-primary)]">Habilidad IA</span>
                                            </h2>
                                            <p className={`${T.helperText} ${S.meta} uppercase tracking-widest text-[color:var(--text-muted)]`}>Definición de capacidad cognitiva</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setIsToolModalOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-full text-[color:var(--text-muted)] transition-colors hover:text-[color:var(--text-strong)]">
                                        <X size={28} strokeWidth={1.5} />
                                    </button>
                                </div>
                            </header>

                            <form id="tool-form" onSubmit={handleToolSubmit} className="flex-1 overflow-y-auto px-6 py-6 sm:px-8">
                                <div className="space-y-8">
                                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <label className={`${T.labelText} ${S.meta} ml-2 uppercase tracking-[4px] text-[color:var(--brand-primary)]`}>Nombre del sistema</label>
                                            <input
                                                className={`${T.inputText} ${S.body} w-full rounded-[1.25rem] border border-[var(--border-default)] bg-[var(--bg-page)] px-5 py-4 font-mono outline-none`}
                                                value={toolFormData.name}
                                                onChange={(e) => setToolFormData((prev) => ({ ...prev, name: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') }))}
                                                required
                                                placeholder="ej: buscar_inventario"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className={`${T.labelText} ${S.meta} ml-2 uppercase tracking-[4px] text-[color:var(--brand-primary)]`}>Título público</label>
                                            <input
                                                className={`${T.inputText} ${S.body} w-full rounded-[1.25rem] border border-[var(--border-default)] bg-[var(--bg-page)] px-5 py-4 outline-none`}
                                                value={toolFormData.displayName}
                                                onChange={(e) => setToolFormData((prev) => ({ ...prev, displayName: e.target.value }))}
                                                required
                                                placeholder="Ej: Consulta de stock"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <label className={`${T.labelText} ${S.meta} ml-2 uppercase tracking-[4px] text-[color:var(--brand-primary)]`}>Categoría</label>
                                            <select
                                                className={`${T.inputText} ${S.body} w-full rounded-[1.25rem] border border-[var(--border-default)] bg-[var(--bg-page)] px-5 py-4 outline-none`}
                                                value={toolFormData.capability}
                                                onChange={(e) => setToolFormData((prev) => ({ ...prev, capability: e.target.value }))}
                                            >
                                                <option value="product_search">Product Search</option>
                                                <option value="appointment_lookup">Appointment Lookup</option>
                                                <option value="appointment_create">Appointment Create</option>
                                                <option value="order_status">Order Status</option>
                                                <option value="lead_create">Lead Create</option>
                                                <option value="general_api_fetch">General API Fetch</option>
                                                <option value="CUSTOM">Custom Capability</option>
                                            </select>
                                        </div>
                                        {toolFormData.capability === 'CUSTOM' && (
                                            <div className="space-y-2">
                                                <label className={`${T.labelText} ${S.meta} ml-2 uppercase tracking-[4px] text-[color:var(--brand-primary)]`}>Capability personalizada</label>
                                                <input
                                                    className={`${T.inputText} ${S.body} w-full rounded-[1.25rem] border border-[var(--border-default)] bg-[var(--bg-page)] px-5 py-4 outline-none`}
                                                    value={toolFormData.customCapability}
                                                    onChange={(e) => setToolFormData((prev) => ({ ...prev, customCapability: e.target.value }))}
                                                    placeholder="ej: operacion_critica"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <label className={`${T.labelText} ${S.meta} ml-2 uppercase tracking-[4px] text-[color:var(--brand-primary)]`}>Instrucción semántica</label>
                                        <textarea
                                            className={`${T.inputText} ${S.body} min-h-[120px] w-full resize-none rounded-[1.5rem] border border-[var(--border-default)] bg-[var(--bg-page)] p-5 outline-none placeholder:text-[color:var(--text-muted)]`}
                                            value={toolFormData.semanticDescription}
                                            onChange={(e) => setToolFormData((prev) => ({ ...prev, semanticDescription: e.target.value, description: e.target.value }))}
                                            required
                                            placeholder="Describe detalladamente cómo y cuándo la IA debe usar esta herramienta..."
                                        />
                                    </div>

                                    <div className="rounded-[1.75rem] border border-[var(--brand-primary)]/10 bg-[var(--brand-primary)]/[0.02] p-5 sm:p-6">
                                        <h4 className={`${T.labelText} ${S.meta} mb-5 text-center uppercase tracking-[6px] text-[color:var(--brand-primary)]`}>Parámetros de red</h4>
                                        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                                            <div className="space-y-2 md:col-span-3">
                                                <label className={`${T.labelText} ${S.meta} uppercase tracking-[3px] text-[10px] text-[color:var(--text-muted)]`}>Endpoint</label>
                                                <input
                                                    className={`${T.inputText} w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-page)] px-5 py-3 text-xs font-mono outline-none`}
                                                    value={toolFormData.endpointUrl}
                                                    onChange={(e) => setToolFormData((prev) => ({ ...prev, endpointUrl: e.target.value }))}
                                                    required
                                                    placeholder="https://api.negocio.com/v1/metodo"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className={`${T.labelText} ${S.meta} uppercase tracking-[3px] text-[10px] text-[color:var(--text-muted)]`}>Método</label>
                                                <select
                                                    className={`${T.inputText} w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-page)] px-5 py-3 text-xs outline-none`}
                                                    value={toolFormData.method}
                                                    onChange={(e) => setToolFormData((prev) => ({ ...prev, method: e.target.value }))}
                                                >
                                                    {HTTP_METHODS.map((method) => (
                                                        <option key={method} value={method}>
                                                            {method}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="space-y-2 md:col-span-2">
                                                <label className={`${T.labelText} ${S.meta} uppercase tracking-[3px] text-[10px] text-[color:var(--text-muted)]`}>Conector de seguridad</label>
                                                <select
                                                    className={`${T.inputText} w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-page)] px-5 py-3 text-xs outline-none`}
                                                    value={toolFormData.credentialId || 'none'}
                                                    onChange={(e) => setToolFormData((prev) => ({ ...prev, credentialId: e.target.value }))}
                                                >
                                                    <option value="none">Sin autenticación (Público)</option>
                                                    {integrations.map((integration) => (
                                                        <option key={integration.id} value={integration.id}>
                                                            {integration.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <label className={`${T.labelText} ${S.meta} uppercase tracking-[3px] text-[10px] text-[color:var(--text-muted)]`}>Timeout (ms)</label>
                                                <input
                                                    type="number"
                                                    className={`${T.inputText} w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-page)] px-5 py-3 text-xs outline-none`}
                                                    value={toolFormData.timeoutMs}
                                                    onChange={(e) => setToolFormData((prev) => ({ ...prev, timeoutMs: parseInt(e.target.value) }))}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className={`${T.labelText} ${S.meta} uppercase tracking-[3px] text-[10px] text-[color:var(--text-muted)]`}>Reintentos</label>
                                                <input
                                                    type="number"
                                                    className={`${T.inputText} w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-page)] px-5 py-3 text-xs outline-none`}
                                                    value={toolFormData.retries}
                                                    onChange={(e) => setToolFormData((prev) => ({ ...prev, retries: parseInt(e.target.value) }))}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between px-2">
                                                <label className={`${T.labelText} ${S.meta} uppercase tracking-[4px] text-[color:var(--brand-primary)]`}>Input Schema</label>
                                                {toolJsonErrorSchema && <span className="text-[10px] font-black text-[color:var(--state-danger)]">{toolJsonErrorSchema}</span>}
                                            </div>
                                            <textarea
                                                className={`${T.inputText} h-48 w-full rounded-[1.5rem] border-2 bg-[var(--bg-page)] p-5 font-mono text-[10px] outline-none ${toolJsonErrorSchema ? 'border-[var(--state-danger)]/50' : 'border-[var(--border-default)]'}`}
                                                value={toolFormData.parametersSchema}
                                                onChange={(e) => {
                                                    setToolFormData((prev) => ({ ...prev, parametersSchema: e.target.value }));
                                                    validateJson(e.target.value, setToolJsonErrorSchema);
                                                }}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between px-2">
                                                <label className={`${T.labelText} ${S.meta} uppercase tracking-[4px] text-[color:var(--brand-primary)]`}>Output Schema</label>
                                                {toolJsonErrorOutput && <span className="text-[10px] font-black text-[color:var(--state-danger)]">{toolJsonErrorOutput}</span>}
                                            </div>
                                            <textarea
                                                className={`${T.inputText} h-48 w-full rounded-[1.5rem] border-2 bg-[var(--bg-page)] p-5 font-mono text-[10px] outline-none ${toolJsonErrorOutput ? 'border-[var(--state-danger)]/50' : 'border-[var(--border-default)]'}`}
                                                value={toolFormData.outputSchema}
                                                onChange={(e) => {
                                                    setToolFormData((prev) => ({ ...prev, outputSchema: e.target.value }));
                                                    validateJson(e.target.value, setToolJsonErrorOutput);
                                                }}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between px-2">
                                                <label className={`${T.labelText} ${S.meta} uppercase tracking-[4px] text-[color:var(--brand-primary)]`}>Response Mapping</label>
                                                {toolJsonErrorMapping && <span className="text-[10px] font-black text-[color:var(--state-danger)]">{toolJsonErrorMapping}</span>}
                                            </div>
                                            <textarea
                                                className={`${T.inputText} h-48 w-full rounded-[1.5rem] border-2 bg-[var(--bg-page)] p-5 font-mono text-[10px] outline-none ${toolJsonErrorMapping ? 'border-[var(--state-danger)]/50' : 'border-[var(--border-default)]'}`}
                                                value={toolFormData.responseMapping}
                                                onChange={(e) => {
                                                    setToolFormData((prev) => ({ ...prev, responseMapping: e.target.value }));
                                                    validateJson(e.target.value, setToolJsonErrorMapping);
                                                }}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-8 border-t border-[var(--border-default)] pt-8 lg:grid-cols-2">
                                        <div className="space-y-4">
                                            <label className={`${T.labelText} ${S.meta} ml-2 uppercase tracking-[4px] text-[color:var(--brand-primary)]`}>Gobierno y confirmación</label>
                                            <select
                                                className={`${T.inputText} ${S.body} w-full rounded-[1.25rem] border border-[var(--border-default)] bg-[var(--bg-page)] px-5 py-4 outline-none`}
                                                value={toolFormData.confirmationPolicy}
                                                onChange={(e) => setToolFormData((prev) => ({ ...prev, confirmationPolicy: e.target.value }))}
                                            >
                                                <option value="AUTO">Automático</option>
                                                <option value="HYBRID">Híbrido</option>
                                                <option value="MANUAL">Manual</option>
                                            </select>
                                            <div className="grid grid-cols-1 gap-3 rounded-[1.5rem] border border-[var(--border-default)] bg-[var(--bg-page)] p-5 sm:grid-cols-2">
                                                {[
                                                    { key: 'canMutateData', label: 'Escribe datos' },
                                                    { key: 'requiresConfirmation', label: 'Req. visto bueno' },
                                                    { key: 'safeToAutoRun', label: 'Auto-ejecutable' },
                                                    { key: 'idempotent', label: 'Idempotente' },
                                                ].map((flag) => (
                                                    <button
                                                        key={flag.key}
                                                        type="button"
                                                        onClick={() =>
                                                            setToolFormData((prev) => ({
                                                                ...prev,
                                                                safetyFlags: { ...prev.safetyFlags, [flag.key]: !(prev.safetyFlags as any)?.[flag.key] },
                                                            }))
                                                        }
                                                        className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-3 text-left"
                                                    >
                                                        <span className={`${T.labelText} ${S.meta} text-[10px] uppercase tracking-widest text-[color:var(--text-strong)]`}>{flag.label}</span>
                                                        <div className={`relative h-5 w-10 rounded-full transition-colors ${(toolFormData.safetyFlags as any)?.[flag.key] ? 'bg-[var(--brand-primary)]' : 'bg-[var(--border-default)]/50'}`}>
                                                            <div className={`absolute top-[2px] h-4 w-4 rounded-full bg-white transition-transform ${(toolFormData.safetyFlags as any)?.[flag.key] ? 'translate-x-[22px]' : 'translate-x-[2px]'}`} />
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <label className={`${T.labelText} ${S.meta} ml-2 uppercase tracking-[4px] text-[color:var(--brand-primary)]`}>Entrenamiento</label>
                                            <div className="min-h-[160px] rounded-[1.5rem] border border-[var(--border-default)] bg-[var(--bg-page)] p-5 shadow-inner">
                                                <div className="flex flex-wrap gap-2">
                                                    {(Array.isArray(toolFormData.exampleUtterances) ? toolFormData.exampleUtterances : []).map((tag, index) => (
                                                        <span key={index} className="flex items-center gap-2 rounded-lg border border-[var(--brand-primary)]/20 bg-[var(--brand-primary)]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-[color:var(--brand-primary)]">
                                                            {tag}
                                                            <button type="button" onClick={() => handleRemoveTag(index)} className="text-[color:var(--brand-primary)]/40 hover:text-[color:var(--text-strong)]">
                                                                <X size={12} />
                                                            </button>
                                                        </span>
                                                    ))}
                                                    <input
                                                        placeholder="Escribe una frase y pulsa Enter..."
                                                        className={`${S.meta} min-w-[200px] flex-1 bg-transparent text-[10px] font-black uppercase tracking-widest text-[color:var(--brand-primary)] outline-none placeholder:text-[color:var(--text-muted)]`}
                                                        value={toolTagInput}
                                                        onChange={(e) => setToolTagInput(e.target.value)}
                                                        onKeyDown={handleTagKeyDown}
                                                        onBlur={() => toolTagInput && handleAddTag(toolTagInput)}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </form>

                            <footer className="shrink-0 border-t border-[var(--border-default)] bg-[var(--bg-surface)] px-6 py-5 sm:px-8">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                    <button
                                        type="button"
                                        onClick={() => setToolFormData((prev) => ({ ...prev, isActive: !prev.isActive }))}
                                        className="flex items-center gap-3"
                                    >
                                        <div className={`relative h-6 w-12 rounded-full transition-all ${toolFormData.isActive ? 'bg-[var(--state-success)]' : 'bg-[var(--border-default)]/50'}`}>
                                            <div className={`absolute top-[3px] h-4 w-4 rounded-full bg-white transition-transform ${toolFormData.isActive ? 'translate-x-6' : 'translate-x-1.5'}`} />
                                        </div>
                                        <span className={`${T.labelText} ${S.meta} uppercase tracking-widest text-[color:var(--text-strong)]`}>Estado: {toolFormData.isActive ? 'Activa' : 'Inactiva'}</span>
                                    </button>

                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <button
                                            type="button"
                                            onClick={() => setIsToolModalOpen(false)}
                                            className="flex items-center justify-center gap-3 rounded-2xl border-2 border-[var(--border-default)] bg-[var(--bg-card)] px-6 py-4 uppercase tracking-widest transition-all active:scale-95"
                                        >
                                            <X size={18} className={`${T.labelText} text-[color:var(--text-strong)]`} />
                                            <span className={`${T.labelText} ${S.body} text-[color:var(--text-strong)]`}>Cerrar</span>
                                        </button>
                                        <button
                                            type="submit"
                                            form="tool-form"
                                            disabled={isToolSubmitting}
                                            className="flex items-center justify-center gap-3 rounded-2xl bg-[var(--brand-primary)] px-6 py-4 shadow-2xl transition-all active:scale-95 disabled:opacity-50"
                                        >
                                            {isToolSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                            <span className={`${T.buttonPrimaryText} ${S.body}`}>{toolEditingId ? 'Sincronizar' : 'Desplegar tool'}</span>
                                        </button>
                                    </div>
                                </div>
                            </footer>
                        </div>
                    </div>
                )}

                {isTestModalOpen && (
                    <div className="fixed inset-0 z-[200] flex items-end justify-center p-0 sm:items-center sm:p-4">
                        <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setIsTestModalOpen(false)} />
                        <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[2rem] border border-[var(--border-default)] bg-[var(--bg-card)] shadow-2xl sm:rounded-[2.5rem]">
                            <header className="shrink-0 border-b border-[var(--border-default)] bg-[var(--bg-surface)]/50 px-6 py-5 sm:px-8">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--state-success)]/10 text-[var(--state-success)]">
                                            <Terminal size={24} />
                                        </div>
                                        <div>
                                            <h2 className={`${T.sectionTitle} ${S.headingLg} uppercase`}>Laboratorio de <span className="text-[var(--ty-accent)]">Pruebas</span></h2>
                                            <p className={`${T.helperText} ${S.meta} uppercase tracking-widest text-[color:var(--text-muted)]`}>{testTool?.displayName || testTool?.name}</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setIsTestModalOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-full text-[color:var(--text-muted)] transition-colors hover:text-[color:var(--text-strong)]">
                                        <X size={28} strokeWidth={1.5} />
                                    </button>
                                </div>
                            </header>

                            <div className="flex-1 space-y-8 overflow-y-auto px-6 py-6 sm:px-8">
                                <div className="flex flex-wrap items-center gap-3 rounded-[1.25rem] border border-[var(--border-default)] bg-[var(--bg-page)] p-4 font-mono text-xs shadow-inner">
                                    <span className="rounded bg-[var(--brand-primary)] px-3 py-1 text-[10px] font-black uppercase">{testTool?.method}</span>
                                    <span className={`${T.helperText} ${S.meta} truncate text-[color:var(--text-muted)]`}>{testTool?.endpointUrl}</span>
                                </div>

                                <div className="space-y-3">
                                    <label className={`${T.labelText} ${S.meta} ml-2 uppercase tracking-[4px] text-[color:var(--brand-primary)]`}>Payload de ejecución (JSON)</label>
                                    <textarea
                                        className={`${T.inputText} h-48 w-full resize-none rounded-[1.5rem] border border-[var(--border-default)] bg-[var(--bg-page)] p-5 font-mono text-sm outline-none shadow-inner`}
                                        value={testPayload}
                                        onChange={(e) => setTestPayload(e.target.value)}
                                        placeholder='{ "param": "valor" }'
                                    />
                                </div>

                                <button
                                    onClick={handleRunTest}
                                    disabled={isTesting}
                                    className={`flex w-full items-center justify-center gap-4 rounded-[1.5rem] bg-[var(--brand-primary)] py-5 shadow-2xl transition-all disabled:opacity-50 ${T.buttonPrimaryText} ${S.body} uppercase tracking-widest`}
                                >
                                    {isTesting ? <Loader2 size={22} className="animate-spin" /> : <PlayCircle size={22} />}
                                    {isTesting ? 'Invocando API...' : 'Ejecutar simulación'}
                                </button>

                                {testResult && (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <label className={`${T.labelText} ${S.meta} uppercase tracking-[4px] text-[color:var(--state-success)]`}>Respuesta de servidor</label>
                                            <span className={`${T.labelText} ${S.meta} flex items-center gap-2 rounded-full border border-[var(--state-success)]/20 bg-[var(--state-success)]/10 px-3 py-1 uppercase text-[color:var(--state-success)]`}>
                                                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--state-success)]" />
                                                Success 200
                                            </span>
                                        </div>
                                        <div className="max-h-64 overflow-auto rounded-[1.5rem] border-2 border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-2xl">
                                            <pre className="text-[10px] leading-relaxed text-[color:var(--state-success)]/90">{JSON.stringify(testResult, null, 2)}</pre>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
