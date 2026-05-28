import React, { useState, useEffect } from 'react';
import { aiApi, AiTool, IntegrationCredential, CreateIntegrationDto, UpdateIntegrationDto } from '@/api/wabee/ai.api';
import { useToast } from '@/context/ToastContext';
import { 
    Plus, Pencil, Trash2, KeyRound, CheckCircle2, ShieldAlert, X, 
    Wrench, PlayCircle, Terminal, Layers, Info, Shield, CheckCircle, Clock, Smartphone,
    ChevronRight, ArrowRight, Save, Settings as SettingsIcon, Globe, Lock, Cpu, Zap, Activity, Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { T, S } from '@/lib/text-tokens';

const AUTH_TYPES = [
    { value: 'NONE', label: 'NINGUNA (PÚBLICA)', icon: Globe },
    { value: 'BEARER_TOKEN', label: 'BEARER TOKEN', icon: Lock },
    { value: 'API_KEY_HEADER', label: 'API KEY (HEADER)', icon: KeyRound },
    { value: 'BASIC_AUTH', label: 'BASIC AUTH', icon: Shield },
];

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

export default function AiIntegrationsPage() {
    const { success, error: toastError } = useToast();
    const [activeTab, setActiveTab] = useState<'integrations' | 'tools'>('integrations');
    const [isLoading, setIsLoading] = useState(true);

    // Data State
    const [integrations, setIntegrations] = useState<IntegrationCredential[]>([]);
    const [tools, setTools] = useState<AiTool[]>([]);

    // --- INTEGRATIONS MODAL STATE ---
    const [isIntModalOpen, setIsIntModalOpen] = useState(false);
    const [intEditingId, setIntEditingId] = useState<string | null>(null);
    const [isIntSubmitting, setIsIntSubmitting] = useState(false);
    const [intName, setIntName] = useState('');
    const [intAuthType, setIntAuthType] = useState<'NONE' | 'BEARER_TOKEN' | 'API_KEY_HEADER' | 'BASIC_AUTH'>('NONE');
    const [intConfig, setIntConfig] = useState<any>({});
    const [intUpdateCredentials, setIntUpdateCredentials] = useState(false);
    const [intHasExistingConfig, setIntHasExistingConfig] = useState(false);

    // --- TOOLS MODAL STATE ---
    const [isToolModalOpen, setIsToolModalOpen] = useState(false);
    const [toolEditingId, setToolEditingId] = useState<string | null>(null);
    const [isToolSubmitting, setIsToolSubmitting] = useState(false);
    const [toolFormData, setToolFormData] = useState<Partial<AiTool>>({
        name: '', displayName: '', description: '', method: 'POST', endpointUrl: '',
        credentialId: 'none', parametersSchema: '{\n  "type": "object",\n  "properties": {}\n}',
        timeoutMs: 5000, retries: 0, requireApproval: false, isActive: true,
        triggerHints: [], exampleUtterances: [], responseMapping: '', outputSchema: '',
        capability: 'general_api_fetch', customCapability: '', semanticDescription: '',
        confirmationPolicy: 'AUTO',
        safetyFlags: { canMutateData: false, requiresConfirmation: false, safeToAutoRun: true, idempotent: true, sensitiveOperation: false },
    });
    const [toolJsonErrorSchema, setToolJsonErrorSchema] = useState('');
    const [toolJsonErrorMapping, setToolJsonErrorMapping] = useState('');
    const [toolJsonErrorOutput, setToolJsonErrorOutput] = useState('');
    const [toolTagInput, setToolTagInput] = useState('');

    // --- TEST MODAL STATE ---
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
            const [iData, tData] = await Promise.all([
                aiApi.listIntegrations(),
                aiApi.listTools()
            ]);
            setIntegrations(iData);
            setTools(tData);
        } catch (err: any) {
            toastError('Error cargando datos: ' + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    // --- INTEGRATIONS HANDLERS ---
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
        if (!confirm(`¿Eliminar integración "${name}"? Afectará a las herramientas que la usen.`)) return;
        try {
            await aiApi.deleteIntegration(id);
            success('Integración eliminada');
            loadData();
        } catch (err: any) {
            toastError('Error: ' + err.message);
        }
    };

    // --- TOOLS HANDLERS ---
    const handleOpenToolModal = (tool?: AiTool) => {
        setToolJsonErrorSchema('');
        setToolJsonErrorMapping('');
        setToolJsonErrorOutput('');
        if (tool) {
            setToolEditingId(tool.id);
            setToolFormData({
                ...tool,
                credentialId: tool.credentialId || 'none',
                parametersSchema: typeof tool.parametersSchema === 'object' && tool.parametersSchema !== null ? JSON.stringify(tool.parametersSchema, null, 2) : (tool.parametersSchema || ''),
                responseMapping: typeof tool.responseMapping === 'object' && tool.responseMapping !== null ? JSON.stringify(tool.responseMapping, null, 2) : (tool.responseMapping || ''),
                outputSchema: typeof tool.outputSchema === 'object' && tool.outputSchema !== null ? JSON.stringify(tool.outputSchema, null, 2) : (tool.outputSchema || ''),
                capability: tool.capability || 'general_api_fetch',
                customCapability: tool.customCapability || '',
                semanticDescription: tool.semanticDescription || '',
                confirmationPolicy: tool.confirmationPolicy || 'AUTO',
                safetyFlags: tool.safetyFlags || { canMutateData: false, requiresConfirmation: false, safeToAutoRun: true, idempotent: true, sensitiveOperation: false },
                exampleUtterances: Array.isArray(tool.exampleUtterances) ? tool.exampleUtterances : [],
                triggerHints: Array.isArray(tool.triggerHints) ? tool.triggerHints : []
            });
            setToolTagInput('');
        } else {
            setToolEditingId(null);
            setToolFormData({
                name: '', displayName: '', description: '', method: 'POST', endpointUrl: '',
                credentialId: 'none', parametersSchema: '{\n  "type": "object",\n  "properties": {}\n}',
                timeoutMs: 5000, retries: 0, requireApproval: false, isActive: true,
                triggerHints: [], exampleUtterances: [], responseMapping: '', outputSchema: '',
                capability: 'general_api_fetch', customCapability: '', semanticDescription: '',
                confirmationPolicy: 'AUTO',
                safetyFlags: { canMutateData: false, requiresConfirmation: false, safeToAutoRun: true, idempotent: true, sensitiveOperation: false },
            });
            setToolTagInput('');
        }
        setIsToolModalOpen(true);
    };

    const validateJson = (val: string, setter: (e: string) => void) => {
        if (!val || val.trim() === '') { setter(''); return true; }
        try { JSON.parse(val); setter(''); return true; } catch (e) { setter('JSON Inválido'); return false; }
    };

    const handleToolSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const schemaOk = validateJson(toolFormData.parametersSchema as string, setToolJsonErrorSchema);
        const mappingOk = validateJson(toolFormData.responseMapping as string, setToolJsonErrorMapping);
        const outputOk = validateJson(toolFormData.outputSchema as string, setToolJsonErrorOutput);

        if (!schemaOk || !mappingOk || !outputOk) {
            toastError('Revisa los errores de JSON en el formulario.');
            return;
        }

        setIsToolSubmitting(true);
        try {
            const payload = {
                ...toolFormData,
                parametersSchema: JSON.parse(toolFormData.parametersSchema as string || '{}'),
                responseMapping: toolFormData.responseMapping ? JSON.parse(toolFormData.responseMapping as string) : null,
                outputSchema: toolFormData.outputSchema ? JSON.parse(toolFormData.outputSchema as string) : null,
                credentialId: toolFormData.credentialId === 'none' ? null : toolFormData.credentialId,
                triggerHints: Array.isArray(toolFormData.triggerHints) ? toolFormData.triggerHints : [],
                exampleUtterances: Array.isArray(toolFormData.exampleUtterances) ? toolFormData.exampleUtterances : []
            };
            if (toolEditingId) {
                await aiApi.updateTool(toolEditingId, payload);
                success('Herramienta actualizada');
            } else {
                await aiApi.createTool(payload);
                success('Herramienta creada');
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
        if (!confirm(`¿Eliminar herramienta "${name}"?`)) return;
        try {
            await aiApi.deleteTool(id);
            success('Herramienta eliminada');
            loadData();
        } catch (err: any) {
            toastError('Error: ' + err.message);
        }
    };

    const handleAddTag = (val: string) => {
        const clean = val.trim().replace(/,$/, '');
        if (!clean) return;
        const current = Array.isArray(toolFormData.exampleUtterances) ? toolFormData.exampleUtterances : [];
        if (current.includes(clean)) {
            setToolTagInput('');
            return;
        }
        setToolFormData((p: any) => ({ ...p, exampleUtterances: [...current, clean] }));
        setToolTagInput('');
    };

    const handleRemoveTag = (index: number) => {
        const current = Array.isArray(toolFormData.exampleUtterances) ? toolFormData.exampleUtterances : [];
        setToolFormData((p: any) => ({ ...p, exampleUtterances: current.filter((_, i) => i !== index) }));
    };

    const handleTagKeyDown = (e: React.KeyboardEvent) => {
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
        let dummyPayload = "{\n  \n}";
        try {
            const schema = typeof tool.parametersSchema === 'string' ? JSON.parse(tool.parametersSchema) : tool.parametersSchema;
            if (schema?.properties) {
                const dummy: any = {};
                for (const key of Object.keys(schema.properties)) {
                    dummy[key] = schema.properties[key].type === 'string' ? '' : null;
                }
                dummyPayload = JSON.stringify(dummy, null, 2);
            }
        } catch(e) {}
        setTestPayload(dummyPayload);
        setIsTestModalOpen(true);
    };

    const handleRunTest = async () => {
        if (!testTool) return;
        setIsTesting(true);
        try {
            const res = await aiApi.testTool(testTool.id, JSON.parse(testPayload));
            setTestResult(res);
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
                <div className="bg-[var(--state-success)]/10 p-4 rounded-xl flex items-center gap-3 border border-[var(--state-success)]/30 mt-2">
                    <CheckCircle2 className="w-5 h-5 text-[color:var(--state-success)]" />
                    <div className="text-sm">
                        <p className={`font-bold text-[color:var(--text-strong)] ${T.cardTitle}`}>Credenciales configuradas de forma segura</p>
                        <p className={`text-[color:var(--text-muted)] text-xs ${T.helperText}`}>Los secretos están cifrados y no se muestran por seguridad.</p>
                    </div>
                </div>
            );
        }

        switch (intAuthType) {
            case 'BEARER_TOKEN':
                return (
                    <div className="space-y-2 mt-4 animate-in fade-in duration-300">
                        <label className={`${T.labelText} ${S.meta} block text-[color:var(--text-muted)] uppercase tracking-widest`}>Token de Acceso</label>
                        <input type="password" placeholder="ey..." className={`${T.inputText} w-full px-4 py-4 bg-[var(--bg-page)] border border-[var(--border-default)] rounded-xl focus:ring-2 focus:ring-[var(--brand-primary)]/50 outline-none`} value={intConfig.token || ''} onChange={(e) => setIntConfig((p: any) => ({...p, token: e.target.value}))} required />
                    </div>
                );
            case 'API_KEY_HEADER':
                return (
                    <div className="space-y-4 mt-4 animate-in fade-in duration-300">
                        <div className="space-y-2">
                            <label className={`${T.labelText} ${S.meta} block text-[color:var(--text-muted)] uppercase tracking-widest`}>Nombre del Header</label>
                            <input placeholder="x-api-key" className={`${T.inputText} w-full px-4 py-4 bg-[var(--bg-page)] border border-[var(--border-default)] rounded-xl outline-none`} value={intConfig.headerName || ''} onChange={(e) => setIntConfig((p: any) => ({...p, headerName: e.target.value}))} required />
                        </div>
                        <div className="space-y-2">
                            <label className={`${T.labelText} ${S.meta} block text-[color:var(--text-muted)] uppercase tracking-widest`}>Valor (Secret Key)</label>
                            <input type="password" placeholder="sk_live_..." className={`${T.inputText} w-full px-4 py-4 bg-[var(--bg-page)] border border-[var(--border-default)] rounded-xl outline-none`} value={intConfig.headerValue || ''} onChange={(e) => setIntConfig((p: any) => ({...p, headerValue: e.target.value}))} required />
                        </div>
                    </div>
                );
            case 'BASIC_AUTH':
                return (
                    <div className="space-y-4 mt-4 animate-in fade-in duration-300">
                        <div className="space-y-2">
                            <label className={`${T.labelText} ${S.meta} block text-[color:var(--text-muted)] uppercase tracking-widest`}>Usuario</label>
                            <input placeholder="admin" className={`${T.inputText} w-full px-4 py-4 bg-[var(--bg-page)] border border-[var(--border-default)] rounded-xl outline-none`} value={intConfig.username || ''} onChange={(e) => setIntConfig((p: any) => ({...p, username: e.target.value}))} required />
                        </div>
                        <div className="space-y-2">
                            <label className={`${T.labelText} ${S.meta} block text-[color:var(--text-muted)] uppercase tracking-widest`}>Contraseña</label>
                            <input type="password" placeholder="••••••••" className={`${T.inputText} w-full px-4 py-4 bg-[var(--bg-page)] border border-[var(--border-default)] rounded-xl outline-none`} value={intConfig.password || ''} onChange={(e) => setIntConfig((p: any) => ({...p, password: e.target.value}))} required />
                        </div>
                    </div>
                );
            case 'NONE': default:
                return (
                    <div className="mt-4 bg-[var(--brand-primary)]/5 p-4 rounded-xl flex gap-3 border border-[var(--brand-primary)]/20 animate-in fade-in duration-500">
                        <ShieldAlert className="w-5 h-5 text-[color:var(--brand-primary)] shrink-0" />
                        <span className={`${T.helperText} ${S.meta} text-[color:var(--text-muted)]`}>
                            Esta API es pública o no requiere cabeceras configurables.
                        </span>
                    </div>
                );
        }
    };

    return (
        <div className="p-10 max-w-7xl mx-auto space-y-12 bg-[var(--bg-page)] min-h-screen content-fade-in pb-32">
            {/* Header / Command Center */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-10">
                <div className="space-y-2">
                    <h1 className={`${T.pageTitle} ${S.displayMd}`}>Engine <span className="text-[var(--ty-accent)]">Control</span></h1>
                    <p className={`${T.pageSubtitle} ${S.body}`}>Orquestación de capacidades cognitivas y conectores externos de WABEE.</p>
                </div>
                <div className="flex bg-[var(--bg-card)] p-1.5 rounded-[1.5rem] border border-[var(--border-default)] shadow-inner">
                    <button 
                        onClick={() => setActiveTab('integrations')} 
                        className={`flex items-center gap-3 px-8 py-3.5 rounded-xl transition-all duration-500 ${activeTab === 'integrations' ? 'bg-[var(--brand-primary)]  shadow-lg transform scale-[1.05]' : 'text-[color:var(--text-muted)] hover:text-[color:var(--brand-primary)]'}`}
                    >
                        <KeyRound size={18} />
                        <span className={`${T.buttonPrimaryText} ${S.meta} uppercase tracking-widest`}>Conectores</span>
                    </button>
                    <button 
                        onClick={() => setActiveTab('tools')} 
                        className={`flex items-center gap-3 px-8 py-3.5 rounded-xl transition-all duration-500 ${activeTab === 'tools' ? 'bg-[var(--brand-primary)]  shadow-lg transform scale-[1.05]' : 'text-[color:var(--text-muted)] hover:text-[color:var(--brand-primary)]'}`}
                    >
                        <Zap size={18} />
                        <span className={`${T.buttonPrimaryText} ${S.meta} uppercase tracking-widest`}>Habilidades</span>
                    </button>
                </div>
            </header>

            {activeTab === 'integrations' ? (
                <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4 px-6 py-3 bg-[var(--brand-primary)]/5 border border-[var(--brand-primary)]/10 rounded-full">
                        <Shield size={16} className="text-[color:var(--brand-primary)]" />
                        <p className={`${T.helperText} ${S.meta} text-[color:var(--brand-primary)] uppercase tracking-[3px]`}>Credenciales Cifradas AES-256</p>
                    </div>
                    <button 
                        onClick={() => handleOpenIntModal()} 
                        className={`flex items-center gap-3 bg-[var(--brand-primary)] px-10 py-5 rounded-[1.5rem] ${T.buttonPrimaryText} ${S.body} hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl uppercase tracking-widest`}
                    >
                        <Plus size={20} />
                        Nueva Integración
                    </button>
                </div>
                    <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-[3rem] overflow-hidden shadow-2xl relative">
                        <div className="absolute top-0 right-0 w-80 h-80 bg-[var(--brand-primary)]/[0.01] blur-[100px] rounded-full pointer-events-none"></div>
                        {isLoading ? (
                            <div className="p-24 text-center">
                                <Loader2 className="animate-spin text-[color:var(--brand-primary)] mx-auto mb-6" size={40} />
                                <p className={`${T.helperText} ${S.meta} text-[color:var(--text-muted)] uppercase tracking-[4px]`}>Sincronizando conectores...</p>
                            </div>
                        ) : integrations.length === 0 ? (
                            <div className="p-24 text-center">
                                <KeyRound size={60} className="mx-auto text-[var(--border-default)] mb-6 opacity-20" />
                                <p className={`${T.helperText} ${S.meta} text-[color:var(--text-muted)] uppercase tracking-[4px]`}>Sin integraciones activas</p>
                            </div>
                    ) : (
                        <div className="divide-y divide-[var(--border-default)]">
                                {integrations.map(item => (
                                    <div key={item.id} className="p-8 flex items-center justify-between hover:bg-[var(--brand-primary)]/[0.02] transition-all duration-500 group">
                                        <div className="flex items-center gap-6">
                                            <div className="w-14 h-14 rounded-2xl bg-[var(--bg-input)] border border-[var(--border-default)] flex items-center justify-center text-[var(--brand-primary)] shadow-inner group-hover:scale-110 transition-transform duration-500">
                                                <KeyRound size={24} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-3">
                                                    <h3 className={`${T.cardTitle} ${S.body} tracking-wider`}>{item.name}</h3>
                                                    <span className={`${T.badgeText} text-[9px] px-3 py-1 rounded-lg bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] border border-[var(--brand-primary)]/20 uppercase tracking-[2px]`}>
                                                        {item.authType.replace('_', ' ')}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-4 mt-1.5 opacity-60">
                                                    <div className="flex items-center gap-1.5">
                                                        <Clock size={12} className="text-[color:var(--text-muted)]" />
                                                        <span className={`${T.helperText} ${S.meta} uppercase tracking-widest text-[9px] text-[color:var(--text-muted)]`}>
                                                            {format(new Date(item.createdAt), "dd MMM yyyy")}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        {item.hasConfig ? <Lock size={12} className="text-[color:var(--state-success)]" /> : <Globe size={12} className="text-[color:var(--text-muted)]" />}
                                                        <span className={`${T.helperText} ${S.meta} uppercase tracking-widest text-[9px] text-[color:var(--text-muted)]`}>
                                                            {item.hasConfig ? 'Cifrado' : 'Público'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-4">
                                            <button 
                                                onClick={() => handleOpenIntModal(item)} 
                                                className="w-12 h-12 flex items-center justify-center bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-[var(--brand-primary)] rounded-xl transition-all border border-transparent hover:border-[var(--brand-primary)]/30 shadow-lg"
                                            >
                                                <Pencil size={18} />
                                            </button>
                                            <button 
                                                onClick={() => handleIntDelete(item.id, item.name)} 
                                                className="w-12 h-12 flex items-center justify-center bg-[var(--bg-input)] text-[color:var(--text-muted)] hover:text-[color:var(--state-danger)] rounded-xl transition-all border border-transparent hover:border-[var(--state-danger)]/30 shadow-lg"
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
                <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4 px-6 py-3 bg-[var(--brand-primary)]/5 border border-[var(--brand-primary)]/10 rounded-full">
                            <Activity size={16} className="text-[color:var(--brand-primary)]" />
                            <p className={`${T.helperText} ${S.meta} text-[color:var(--brand-primary)] uppercase tracking-[3px]`}>Monitoreo de Latencia Activo</p>
                        </div>
                        <button 
                            onClick={() => handleOpenToolModal()} 
                            className={`flex items-center gap-3 bg-[var(--brand-primary)] px-10 py-5 rounded-[1.5rem] ${T.buttonPrimaryText} ${S.body} hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl uppercase tracking-widest`}
                        >
                            <Plus size={20} />
                            Nueva Habilidad
                        </button>
                    </div>

                    <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-[3rem] overflow-hidden shadow-2xl relative">
                        <div className="absolute top-0 right-0 w-80 h-80 bg-[var(--brand-primary)]/[0.01] blur-[100px] rounded-full pointer-events-none"></div>
                        {isLoading ? (
                            <div className="p-24 text-center">
                                <Loader2 className="animate-spin text-[color:var(--brand-primary)] mx-auto mb-6" size={40} />
                                <p className={`${T.helperText} ${S.meta} text-[color:var(--text-muted)] uppercase tracking-[4px]`}>Indexando habilidades...</p>
                            </div>
                        ) : tools.length === 0 ? (
                            <div className="p-24 text-center">
                                <Wrench size={60} className="mx-auto text-[var(--border-default)] mb-6 opacity-20" />
                                <p className={`${T.helperText} ${S.meta} text-[color:var(--text-muted)] uppercase tracking-[4px]`}>Sin habilidades configuradas</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className={`${T.labelText} ${S.meta} text-[color:var(--text-muted)] uppercase tracking-[3px] border-b border-[var(--border-default)] bg-[var(--bg-surface)]/50`}>
                                            <th className="py-6 px-10 text-left">Habilidad / ID</th>
                                            <th className="py-6 px-10 text-left">Punto de Enlace</th>
                                            <th className="py-6 px-10 text-center">Ejecución</th>
                                            <th className="py-6 px-10 text-center">Estado</th>
                                            <th className="py-6 px-10 text-right">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--border-default)]">
                                        {tools.map(tool => (
                                            <tr key={tool.id} className="hover:bg-[var(--brand-primary)]/[0.02] transition-all duration-500 group">
                                                <td className="py-6 px-10">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-xl bg-[var(--bg-input)] border border-[var(--border-default)] flex items-center justify-center text-[var(--brand-primary)]/60 group-hover:text-[var(--brand-primary)] transition-colors">
                                                            <Cpu size={20} />
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className={`${T.cardTitle} ${S.body} tracking-wider`}>{tool.displayName || tool.name}</span>
                                                                {(!tool.capability || tool.capability === 'general_api_fetch') && (
                                                                    <span className={`${T.badgeText} ${S.meta} text-[8px] px-1.5 py-0.5 rounded bg-[var(--state-warning)]/10 text-[color:var(--state-warning)] border border-[var(--state-warning)]/20 uppercase tracking-tighter`}>Legacy</span>
                                                                )}
                                                            </div>
                                                            <div className={`${T.helperText} ${S.meta} text-[color:var(--brand-primary)]/40 font-mono text-[9px] mt-0.5 tracking-widest uppercase`}>ID: {tool.name}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-6 px-10">
                                                    <div className="flex items-center gap-3">
                                                        <span className={`${S.meta} px-2 py-0.5 rounded-lg bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] font-black text-[9px] border border-[var(--brand-primary)]/20`}>{tool.method}</span>
                                                        <span className={`${S.meta} text-[var(--text-muted)] text-[10px] font-black uppercase tracking-widest truncate max-w-[200px]`}>{tool.endpointUrl}</span>
                                                    </div>
                                                </td>
                                                <td className="py-6 px-10 text-center">
                                                    {(tool.confirmationPolicy === 'MANUAL' || tool.requireApproval) ? (
                                                        <span className={`${T.badgeText} ${S.meta} px-3 py-1 rounded-full bg-[var(--state-danger)]/10 text-[color:var(--state-danger)] text-[9px] border border-[var(--state-danger)]/20 uppercase tracking-widest`}>Manual</span>
                                                    ) : tool.confirmationPolicy === 'HYBRID' ? (
                                                        <span className={`${T.badgeText} ${S.meta} px-3 py-1 rounded-full bg-[var(--state-warning)]/10 text-[color:var(--state-warning)] text-[9px] border border-[var(--state-warning)]/20 uppercase tracking-widest`}>Híbrido</span>
                                                    ) : (
                                                        <span className={`${T.helperText} ${S.meta} text-[color:var(--text-muted)] text-[9px] uppercase tracking-widest opacity-40`}>Automático</span>
                                                    )}
                                                </td>
                                                <td className="py-6 px-10 text-center">
                                                    <div className={`w-2 h-2 rounded-full mx-auto ${tool.isActive ? 'bg-[var(--state-success)] shadow-[0_0_8px_var(--state-success)]/50' : 'bg-[var(--state-danger)] shadow-[0_0_8px_var(--state-danger)]/50'}`} />
                                                </td>
                                                <td className="py-6 px-10 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <button 
                                                            onClick={() => handleOpenTest(tool)} 
                                                            className="w-10 h-10 flex items-center justify-center text-[color:var(--state-info)] hover:bg-[var(--state-info)]/10 rounded-xl transition-all border border-transparent hover:border-[var(--state-info)]/20" 
                                                            title="Probar Habilidad"
                                                        >
                                                            <PlayCircle size={20} />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleOpenToolModal(tool)} 
                                                            className="w-10 h-10 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--brand-primary)] rounded-xl transition-all border border-transparent hover:border-[var(--brand-primary)]/20"
                                                        >
                                                            <Pencil size={20} />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleToolDelete(tool.id, tool.name)} 
                                                            className="w-10 h-10 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--state-danger)] rounded-xl transition-all border border-transparent hover:border-[var(--state-danger)]/20"
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
                        )}
                    </div>
                </div>
            )}

            {/* --- INTEGRATION MODAL --- */}
            {isIntModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setIsIntModalOpen(false)} />
                    <div className="relative bg-[var(--bg-card)] border border-[var(--border-default)] w-full max-w-xl rounded-[3rem] shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="absolute -top-40 -right-40 w-96 h-96 bg-[var(--brand-primary)]/[0.05] blur-[150px] rounded-full pointer-events-none shrink-0" />
                        
                        <div className="p-10 sm:p-14 pb-6 flex items-center gap-6 shrink-0 relative z-10">
                            <div className="w-16 h-16 rounded-[1.5rem] bg-[var(--brand-primary)]/10 flex items-center justify-center text-[var(--brand-primary)] shadow-inner">
                                <KeyRound size={32} />
                            </div>
                            <div>
                                <h2 className={`${T.sectionTitle} ${S.headingLg} tracking-tighter`}>
                                    {intEditingId ? 'Editar' : 'Nueva'} <span className="text-[var(--ty-accent)]">Integración</span>
                                </h2>
                                <p className={`${T.pageSubtitle} ${S.body} text-[color:var(--text-muted)]`}>Configura un conector seguro para servicios externos.</p>
                            </div>
                        </div>

                        <form onSubmit={handleIntSubmit} className="px-10 sm:px-14 pb-14 space-y-10 relative overflow-y-auto custom-scrollbar flex-1 min-h-0">
                            <div className="space-y-3">
                                <label className={`${T.labelText} ${S.meta} tracking-[4px] ml-4 text-[color:var(--text-muted)]`}>Nombre del Conector</label>
                                <input 
                                    className={`${T.inputText} ${S.body} w-full bg-[var(--bg-page)] border border-[var(--border-default)] rounded-[1.5rem] py-5 px-8 focus:border-[var(--brand-primary)]/50 outline-none transition-all placeholder:text-[color:var(--text-muted)] shadow-inner`} 
                                    value={intName} 
                                    onChange={e => setIntName(e.target.value)} 
                                    required 
                                    placeholder="Ej: Hubspot, Stripe, etc..." 
                                />
                            </div>

                            <div className="space-y-3">
                                <label className={`${T.labelText} ${S.meta} uppercase tracking-[4px] ml-4 text-[color:var(--brand-primary)]`}>Tipo de Autenticación</label>
                                <div className="grid grid-cols-2 gap-4">
                                    {AUTH_TYPES.map(opt => {
                                        const Icon = opt.icon;
                                        return (
                                            <div
                                                key={opt.value}
                                                onClick={() => { setIntAuthType(opt.value as any); setIntConfig({}); if (intEditingId) setIntUpdateCredentials(true); }}
                                                className={`cursor-pointer p-6 rounded-[1.5rem] border-2 transition-all flex flex-col items-center gap-3 relative overflow-hidden group/auth ${intAuthType === opt.value
                                                    ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5'
                                                    : 'border-[var(--border-default)] bg-[var(--bg-page)] hover:border-[var(--brand-primary)]/30'
                                                }`}
                                            >
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${intAuthType === opt.value ? 'bg-[var(--brand-primary)] ' : 'bg-[var(--bg-surface)] text-[color:var(--text-muted)]'}`}>
                                                    <Icon size={22} />
                                                </div>
                                                <p className={`${T.buttonText} ${S.meta} uppercase tracking-widest text-center leading-tight ${intAuthType === opt.value ? 'text-[color:var(--text-strong)]' : 'text-[color:var(--text-muted)]'}`}>
                                                    {opt.label}
                                                </p>
                                                {intAuthType === opt.value && (
                                                    <div className="absolute top-2 right-2">
                                                        <CheckCircle size={14} className="text-[var(--brand-primary)]" />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {intEditingId && intAuthType !== 'NONE' && (
                                <div 
                                    onClick={() => setIntUpdateCredentials(!intUpdateCredentials)}
                                    className={`flex items-center justify-between p-6 rounded-[1.5rem] border-2 cursor-pointer transition-all ${intUpdateCredentials ? 'border-[var(--brand-primary)]/50 bg-[var(--brand-primary)]/5' : 'border-[var(--border-default)] bg-[var(--bg-page)]'}`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2 rounded-lg ${intUpdateCredentials ? 'bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]' : 'bg-[var(--bg-surface)] text-[color:var(--text-muted)]'}`}>
                                            <Lock size={18} />
                                        </div>
                                        <p className={`${T.buttonText} ${S.meta} uppercase tracking-widest ${intUpdateCredentials ? 'text-[color:var(--text-strong)]' : 'text-[color:var(--text-muted)]'}`}>Actualizar credenciales</p>
                                    </div>
                                    <div className={`w-10 h-5 rounded-full relative transition-colors ${intUpdateCredentials ? 'bg-[var(--brand-primary)]' : 'bg-[var(--bg-surface)]'}`}>
                                        <div className={`absolute top-[2px] w-4 h-4 bg-white rounded-full transition-transform ${intUpdateCredentials ? 'translate-x-[22px]' : 'translate-x-[2px]'}`} />
                                    </div>
                                </div>
                            )}

                            <div className="pt-2 animate-in fade-in zoom-in-95 duration-500">
                                {renderIntConfigFields()}
                             <div className="flex flex-col sm:flex-row gap-5 pt-4">
                                <button 
                                    type="button" 
                                    onClick={() => setIsIntModalOpen(false)} 
                                    className="flex-1 py-5 bg-[var(--bg-card)] border-2 border-[var(--border-default)] rounded-[1.5rem] transition-all uppercase tracking-widest active:scale-95 flex items-center justify-center gap-3"
                                >
                                    <X size={20} className={`${T.labelText} text-[color:var(--text-strong)]`} />
                                    <span className={`${T.labelText} ${S.body} font-black uppercase tracking-widest text-[color:var(--text-strong)]`}>Cancelar</span>
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={isIntSubmitting} 
                                    className={`flex-[2] py-5 bg-[var(--brand-primary)]  rounded-[1.5rem] hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-2xl uppercase tracking-widest active:scale-95`}
                                >
                                    {isIntSubmitting ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                                    <span className={`${T.buttonPrimaryText} ${S.body}`}>
                                        {intEditingId ? 'Sincronizar' : 'Crear Conector'}
                                    </span>
                                </button>
                            </div>

                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- TOOL MODAL --- */}
            {isToolModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setIsToolModalOpen(false)} />
                    <div className="relative bg-[var(--bg-card)] border border-[var(--border-default)] w-full max-w-5xl rounded-[3rem] shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="absolute -top-40 -right-40 w-96 h-96 bg-[var(--brand-primary)]/[0.05] blur-[150px] rounded-full pointer-events-none"></div>
                        
                        <header className="px-10 py-8 border-b border-[var(--border-default)] flex justify-between items-center shrink-0 bg-[var(--bg-surface)]/50">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-[var(--brand-primary)]/10 flex items-center justify-center text-[var(--brand-primary)]">
                                    <Cpu size={24} />
                                </div>
                                <div>
                                    <h2 className={`${T.sectionTitle} ${S.headingLg} tracking-tighter`}>
                                        {toolEditingId ? 'Editar' : 'Nueva'} <span className="text-[var(--brand-primary)]">Habilidad IA</span>
                                    </h2>
                                    <p className={`${T.helperText} ${S.meta} uppercase tracking-widest text-[color:var(--text-muted)]`}>Definición de capacidad cognitiva</p>
                                </div>
                            </div>
                            <button onClick={() => setIsToolModalOpen(false)} className="w-12 h-12 flex items-center justify-center text-[color:var(--text-muted)] hover:text-[color:var(--text-strong)] transition-colors active:scale-95">
                                <X size={32} strokeWidth={1.5} />
                            </button>
                        </header>
                        
                        <form onSubmit={handleToolSubmit} className="p-10 overflow-y-auto space-y-12 custom-scrollbar flex-1 relative min-h-0">
                            {/* Sección 1: Identidad */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div className="space-y-8">
                                    <div className="space-y-3">
                                        <label className={`${T.labelText} ${S.meta} uppercase tracking-[4px] ml-4 text-[color:var(--brand-primary)]`}>Nombre del Sistema (call:ID)</label>
                                        <input 
                                            className={`${T.inputText} ${S.body} w-full bg-[var(--bg-page)] border border-[var(--border-default)] rounded-[1.5rem] py-4 px-6 font-mono focus:border-[var(--brand-primary)]/50 outline-none transition-all`} 
                                            value={toolFormData.name} 
                                            onChange={e => setToolFormData((p: any) => ({...p, name: e.target.value.replace(/[^a-zA-Z0-9_]/g, '')}))} 
                                            required 
                                            placeholder="ej: buscar_inventario" 
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label className={`${T.labelText} ${S.meta} uppercase tracking-[4px] ml-4 text-[color:var(--brand-primary)]`}>Título Público</label>
                                        <input 
                                            className={`${T.inputText} ${S.body} w-full bg-[var(--bg-page)] border border-[var(--border-default)] rounded-[1.5rem] py-4 px-6 focus:border-[var(--brand-primary)]/50 outline-none transition-all`} 
                                            value={toolFormData.displayName} 
                                            onChange={e => setToolFormData((p: any) => ({...p, displayName: e.target.value}))} 
                                            required 
                                            placeholder="Ej: Consulta de Stock" 
                                        />
                                    </div>
                                </div>
                                <div className="space-y-8">
                                    <div className="space-y-3">
                                        <label className={`${T.labelText} ${S.meta} uppercase tracking-[4px] ml-4 text-[color:var(--brand-primary)]`}>Categoría (Capability)</label>
                                        <div className="relative">
                                            <select 
                                                className={`${T.inputText} ${S.body} w-full bg-[var(--bg-page)] border border-[var(--border-default)] rounded-[1.5rem] py-4 px-6 appearance-none focus:border-[var(--brand-primary)]/50 outline-none transition-all`} 
                                                value={toolFormData.capability} 
                                                onChange={e => setToolFormData((p: any) => ({...p, capability: e.target.value}))}
                                            >
                                                <option value="product_search">Product Search</option>
                                                <option value="appointment_lookup">Appointment Lookup</option>
                                                <option value="appointment_create">Appointment Create</option>
                                                <option value="order_status">Order Status</option>
                                                <option value="lead_create">Lead Create</option>
                                                <option value="general_api_fetch">General API Fetch</option>
                                                <option value="CUSTOM">Custom Capability</option>
                                            </select>
                                                <ChevronRight className="absolute right-6 top-1/2 -translate-y-1/2 rotate-90 text-[color:var(--text-strong)] pointer-events-none" size={18} />
                                        </div>
                                    </div>
                                    {toolFormData.capability === 'CUSTOM' && (
                                        <div className="space-y-3 animate-in slide-in-from-top-4 duration-300">
                                            <label className={`${T.labelText} ${S.meta} uppercase tracking-[4px] ml-4 text-[color:var(--brand-primary)]`}>ID de Capacidad Personalizada</label>
                                            <input 
                                                className="w-full bg-[var(--bg-page)] border border-[var(--border-default)] rounded-[1.5rem] py-4 px-6 text-[color:var(--text-strong)] text-sm focus:border-[var(--brand-primary)]/50 outline-none transition-all" 
                                                value={toolFormData.customCapability} 
                                                onChange={e => setToolFormData((p: any) => ({...p, customCapability: e.target.value}))} 
                                                placeholder="ej: operacion_critica" 
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className={`${T.labelText} ${S.meta} uppercase tracking-[4px] ml-4 text-[color:var(--brand-primary)]`}>Instrucción Semántica (Para el LLM)</label>
                                <textarea 
                                    className={`${T.inputText} ${S.body} w-full bg-[var(--bg-page)] border border-[var(--border-default)] rounded-[2rem] p-6 min-h-[120px] focus:border-[var(--brand-primary)]/50 outline-none transition-all resize-none leading-relaxed placeholder:text-[color:var(--text-muted)]`} 
                                    value={toolFormData.semanticDescription} 
                                    onChange={e => setToolFormData((p: any) => ({...p, semanticDescription: e.target.value, description: e.target.value}))} 
                                    required 
                                    placeholder="Describe detalladamente cómo y cuándo la IA debe usar esta herramienta..." 
                                />
                            </div>

                            {/* Sección 2: Conexión */}
                            <div className="p-8 bg-[var(--brand-primary)]/[0.02] border border-[var(--brand-primary)]/10 rounded-[2.5rem] space-y-8">
                                <h4 className={`${T.labelText} ${S.meta} uppercase tracking-[6px] text-center text-[color:var(--brand-primary)]`}>Parámetros de Red</h4>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                    <div className="md:col-span-3 space-y-3">
                                        <label className={`${T.labelText} ${S.meta} uppercase tracking-[3px] text-[10px] text-[color:var(--text-muted)]`}>Punto de Acceso (Endpoint)</label>
                                        <input 
                                            className={`${T.inputText} w-full bg-[var(--bg-page)] border border-[var(--border-default)] rounded-2xl py-3 px-5 text-xs font-mono focus:border-[var(--brand-primary)] outline-none transition-all`} 
                                            value={toolFormData.endpointUrl} 
                                            onChange={e => setToolFormData((p: any) => ({...p, endpointUrl: e.target.value}))} 
                                            required 
                                            placeholder="https://api.negocio.com/v1/metodo" 
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label className={`${T.labelText} ${S.meta} uppercase tracking-[3px] text-[10px] text-[color:var(--text-muted)]`}>Método</label>
                                        <div className="relative">
                                            <select 
                                                className={`${T.inputText} w-full bg-[var(--bg-page)] border border-[var(--border-default)] rounded-2xl py-3 px-5 text-xs outline-none appearance-none focus:border-[var(--brand-primary)]`} 
                                                value={toolFormData.method} 
                                                onChange={e => setToolFormData((p: any) => ({...p, method: e.target.value}))}
                                            >
                                                {HTTP_METHODS.map(m => <option key={m} value={m} className="text-[color:var(--text-strong)] bg-[var(--bg-card)]">{m}</option>)}
                                            </select>
                                            <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 rotate-90 text-[color:var(--text-strong)] pointer-events-none transition-colors" size={14} />
                                        </div>
                                    </div>
                                    <div className="md:col-span-2 space-y-3">
                                        <label className={`${T.labelText} ${S.meta} uppercase tracking-[3px] text-[10px] text-[color:var(--text-muted)]`}>Conector de Seguridad</label>
                                        <div className="relative">
                                            <select 
                                                className={`${T.inputText} w-full bg-[var(--bg-page)] border border-[var(--border-default)] rounded-2xl py-3 px-5 text-xs outline-none appearance-none focus:border-[var(--brand-primary)]`} 
                                                value={toolFormData.credentialId || 'none'} 
                                                onChange={e => setToolFormData((p: any) => ({...p, credentialId: e.target.value}))}
                                            >
                                                <option value="none" className="text-[color:var(--text-strong)] bg-[var(--bg-card)]">Sin Autenticación (Público)</option>
                                                {integrations.map(i => <option key={i.id} value={i.id} className="text-[color:var(--text-strong)] bg-[var(--bg-card)]">{i.name}</option>)}
                                            </select>
                                            <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 rotate-90 text-[color:var(--text-strong)] pointer-events-none transition-colors" size={14} />
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <label className={`${T.labelText} ${S.meta} uppercase tracking-[3px] text-[10px] text-[color:var(--text-muted)]`}>Timeout (ms)</label>
                                        <input type="number" className={`${T.inputText} w-full bg-[var(--bg-page)] border border-[var(--border-default)] rounded-2xl py-3 px-5 text-xs outline-none focus:border-[var(--brand-primary)]`} value={toolFormData.timeoutMs} onChange={e => setToolFormData((p: any) => ({...p, timeoutMs: parseInt(e.target.value)}))} />
                                    </div>
                                    <div className="space-y-3">
                                        <label className={`${T.labelText} ${S.meta} uppercase tracking-[3px] text-[10px] text-[color:var(--text-muted)]`}>Reintentos</label>
                                        <input type="number" className={`${T.inputText} w-full bg-[var(--bg-page)] border border-[var(--border-default)] rounded-2xl py-3 px-5 text-xs outline-none focus:border-[var(--brand-primary)]`} value={toolFormData.retries} onChange={e => setToolFormData((p: any) => ({...p, retries: parseInt(e.target.value)}))} />
                                    </div>
                                </div>
                            </div>

                            {/* Sección 3: Esquemas */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center px-4">
                                        <label className={`${T.labelText} ${S.meta} uppercase tracking-[4px] text-[color:var(--brand-primary)]`}>Input Schema</label>
                                        {toolJsonErrorSchema && <span className="text-[10px] text-[color:var(--state-danger)] font-black animate-pulse">{toolJsonErrorSchema}</span>}
                                    </div>
                                    <textarea 
                                        className={`${T.inputText} w-full h-48 bg-[var(--bg-page)] border-2 rounded-[2rem] p-6 font-mono text-[10px] outline-none transition-all ${toolJsonErrorSchema ? 'border-[var(--state-danger)]/50 shadow-[0_0_20px_rgba(239,68,68,0.1)]' : 'border-[var(--border-default)] focus:border-[var(--brand-primary)]/30'}`} 
                                        value={toolFormData.parametersSchema as string} 
                                        onChange={e => { setToolFormData((p: any) => ({...p, parametersSchema: e.target.value})); validateJson(e.target.value, setToolJsonErrorSchema); }} 
                                    />
                                </div>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center px-4">
                                        <label className={`${T.labelText} ${S.meta} uppercase tracking-[4px] text-[color:var(--brand-primary)]`}>Output Schema</label>
                                        {toolJsonErrorOutput && <span className="text-[10px] text-[color:var(--state-danger)] font-black animate-pulse">{toolJsonErrorOutput}</span>}
                                    </div>
                                    <textarea 
                                        className={`${T.inputText} w-full h-48 bg-[var(--bg-page)] border-2 rounded-[2rem] p-6 font-mono text-[10px] outline-none transition-all ${toolJsonErrorOutput ? 'border-[var(--state-danger)]/50 shadow-[0_0_20px_rgba(239,68,68,0.1)]' : 'border-[var(--border-default)] focus:border-[var(--brand-primary)]/30'}`} 
                                        value={toolFormData.outputSchema as string} 
                                        onChange={e => { setToolFormData((p: any) => ({...p, outputSchema: e.target.value})); validateJson(e.target.value, setToolJsonErrorOutput); }} 
                                    />
                                </div>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center px-4">
                                        <label className={`${T.labelText} ${S.meta} uppercase tracking-[4px] text-[color:var(--brand-primary)]`}>Resp. Mapping</label>
                                        {toolJsonErrorMapping && <span className="text-[10px] text-[color:var(--state-danger)] font-black animate-pulse">{toolJsonErrorMapping}</span>}
                                    </div>
                                    <textarea 
                                        className={`${T.inputText} w-full h-48 bg-[var(--bg-page)] border-2 rounded-[2rem] p-6 font-mono text-[10px] outline-none transition-all ${toolJsonErrorMapping ? 'border-[var(--state-danger)]/50 shadow-[0_0_20px_rgba(239,68,68,0.1)]' : 'border-[var(--border-default)] focus:border-[var(--brand-primary)]/30'}`} 
                                        value={toolFormData.responseMapping as string} 
                                        onChange={e => { setToolFormData((p: any) => ({...p, responseMapping: e.target.value})); validateJson(e.target.value, setToolJsonErrorMapping); }} 
                                    />
                                </div>
                            </div>

                            {/* Sección 4: Políticas */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 border-t border-[var(--border-default)] pt-12">
                                <div className="space-y-8">
                                    <div className="space-y-4">
                                        <label className={`${T.labelText} ${S.meta} uppercase tracking-[4px] ml-4 text-[color:var(--brand-primary)]`}>Gobierno y Confirmación</label>
                                        <div className="relative">
                                            <select 
                                                className={`${T.inputText} ${S.body} w-full bg-[var(--bg-page)] border border-[var(--border-default)] rounded-[1.5rem] py-4 px-6 appearance-none focus:border-[var(--brand-primary)]/50 outline-none transition-all`} 
                                                value={toolFormData.confirmationPolicy} 
                                                onChange={e => setToolFormData((p: any) => ({...p, confirmationPolicy: e.target.value}))}
                                            >
                                                <option value="AUTO" className="text-[var(--text-strong)] bg-[var(--bg-card)]">Automático (Ejecución fluida)</option>
                                                <option value="HYBRID" className="text-[var(--text-strong)] bg-[var(--bg-card)]">Híbrido (Confirmar con usuario)</option>
                                                <option value="MANUAL" className="text-[var(--text-strong)] bg-[var(--bg-card)]">Manual (Solo intervención humana)</option>
                                            </select>
                                             <ChevronRight className={`absolute right-6 top-1/2 -translate-y-1/2 rotate-90 ${T.labelText} text-[color:var(--text-strong)] pointer-events-none`} size={18} />
                                        </div>
                                    </div>
                                    <div className="bg-[var(--bg-page)] border border-[var(--border-default)] p-8 rounded-[2rem] grid grid-cols-2 gap-y-6 gap-x-10 shadow-inner">
                                        {[
                                            { key: 'canMutateData', label: 'Escribe Datos' },
                                            { key: 'requiresConfirmation', label: 'Req. Visto Bueno' },
                                            { key: 'safeToAutoRun', label: 'Auto-ejecutable' },
                                            { key: 'idempotent', label: 'Idempotente' }
                                        ].map(f => (
                                            <label key={f.key} className="flex items-center justify-between cursor-pointer group">
                                                <span className={`${T.labelText} ${S.meta} uppercase text-[10px] tracking-widest text-[color:var(--text-strong)] group-hover:text-[var(--brand-primary)] transition-colors`}>{f.label}</span>
                                                <div 
                                                    onClick={() => setToolFormData((p: any) => ({...p, safetyFlags: { ...p.safetyFlags, [f.key]: !(p.safetyFlags as any)?.[f.key] }}))}
                                                    className={`w-10 h-5 rounded-full relative transition-colors ${(toolFormData.safetyFlags as any)?.[f.key] ? 'bg-[var(--brand-primary)] shadow-[0_0_8px_var(--brand-primary)]/50' : 'bg-[var(--border-default)]/50 border border-[var(--border-default)]'}`}
                                                >
                                                    <div className={`absolute top-[1.5px] w-4 h-4 rounded-full transition-transform ${(toolFormData.safetyFlags as any)?.[f.key] ? 'translate-x-[22px] bg-white' : 'translate-x-[2px] bg-[var(--text-muted)]'}`} />
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <label className={`${T.labelText} ${S.meta} uppercase tracking-[4px] ml-4 text-[color:var(--brand-primary)]`}>Entrenamiento (Hints)</label>
                                    <div className="bg-[var(--bg-page)] border border-[var(--border-default)] p-8 rounded-[2rem] min-h-[160px] flex flex-wrap gap-3 shadow-inner content-start">
                                        {(Array.isArray(toolFormData.exampleUtterances) ? toolFormData.exampleUtterances : []).map((tag, idx) => (
                                            <span key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-[var(--brand-primary)]/10 text-[color:var(--brand-primary)] text-[10px] font-black rounded-lg border border-[var(--brand-primary)]/20 uppercase tracking-widest group">
                                                {tag}
                                                <button type="button" onClick={() => handleRemoveTag(idx)} className="text-[color:var(--brand-primary)]/40 hover:text-[color:var(--text-strong)] transition-colors"><X size={12} /></button>
                                            </span>
                                        ))}
                                        <input 
                                            placeholder="Escribe una frase y pulsa Enter..." 
                                            className={`${S.meta} flex-1 bg-transparent border-none outline-none text-[color:var(--brand-primary)] text-[10px] font-black uppercase tracking-widest placeholder:text-[color:var(--text-muted)] min-w-[200px]`} 
                                            value={toolTagInput} 
                                            onChange={e => setToolTagInput(e.target.value)} 
                                            onKeyDown={handleTagKeyDown} 
                                            onBlur={() => toolTagInput && handleAddTag(toolTagInput)} 
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="h-20 shrink-0" />
                        </form>

                        <footer className="px-10 py-8 border-t border-[var(--border-default)] flex items-center justify-between bg-[var(--bg-surface)] shrink-0">
                            <div className="flex gap-10">
                                <label className="flex items-center gap-4 cursor-pointer group">
                                    <div 
                                        onClick={() => setToolFormData((p: any) => ({...p, isActive: !p.isActive}))}
                                        className={`w-12 h-6 rounded-full relative transition-all duration-300 ${toolFormData.isActive ? 'bg-[var(--state-success)] shadow-[0_0_8px_var(--state-success)]/40' : 'bg-[var(--border-default)]/50 border border-[var(--border-default)]'}`}
                                    >
                                        <div className={`absolute top-[3px] w-4 h-4 rounded-full transition-transform ${toolFormData.isActive ? 'translate-x-6 bg-white' : 'translate-x-1.5 bg-[var(--text-muted)]'}`} />
                                    </div>
                                    <span className={`${T.labelText} ${S.meta} uppercase tracking-widest text-[color:var(--text-strong)] group-hover:text-[var(--brand-primary)] transition-colors`}>Estado: {toolFormData.isActive ? 'Activa' : 'Inactiva'}</span>
                                </label>
                            </div>
                            <div className="flex gap-6">
                                <button 
                                    type="button" 
                                    onClick={() => setIsToolModalOpen(false)} 
                                    className="px-10 py-4 bg-[var(--bg-card)] border-2 border-[var(--border-default)] rounded-2xl transition-all uppercase tracking-widest active:scale-95 flex items-center justify-center gap-3 min-w-[160px]"
                                >
                                    <X size={20} className={`${T.labelText} text-[color:var(--text-strong)]`} />
                                    <span className={`${T.labelText} ${S.body} font-black uppercase tracking-widest text-[color:var(--text-strong)]`}>Cerrar</span>
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={isToolSubmitting} 
                                    className={`px-12 py-4 bg-[var(--brand-primary)]  rounded-2xl hover:brightness-110 transition-all shadow-2xl disabled:opacity-50 flex items-center gap-3 uppercase tracking-widest active:scale-95`}
                                >
                                    {isToolSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                    <span className={`${T.buttonPrimaryText} ${S.body}`}>
                                        {toolEditingId ? 'Sincronizar' : 'Desplegar Tool'}
                                    </span>
                                </button>
                            </div>
                        </footer>
                    </div>
                </div>
            )}

            {/* --- TEST MODAL --- */}
            {isTestModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setIsTestModalOpen(false)} />
                    <div className="relative bg-[var(--bg-card)] border border-[var(--border-default)] w-full max-w-2xl rounded-[3rem] shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="absolute -top-40 -right-40 w-96 h-96 bg-[var(--brand-primary)]/[0.05] blur-[150px] rounded-full pointer-events-none"></div>
                        
                        <header className="px-10 py-8 border-b border-[var(--border-default)] flex justify-between items-center bg-[var(--bg-surface)]/50 shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-[var(--state-success)]/10 flex items-center justify-center text-[var(--state-success)]">
                                    <Terminal size={24} />
                                </div>
                                <div>
                                    <h2 className={`${T.sectionTitle} ${S.headingLg} tracking-tighter uppercase`}>Laboratorio de <span className="text-[var(--ty-accent)]">Pruebas</span></h2>
                                    <p className={`${T.helperText} ${S.meta} text-[color:var(--text-muted)] uppercase tracking-widest`}>{testTool?.displayName || testTool?.name}</p>
                                </div>
                            </div>
                            <button onClick={() => setIsTestModalOpen(false)} className="w-12 h-12 flex items-center justify-center text-[color:var(--text-muted)] hover:text-[color:var(--ty-strong)] transition-colors active:scale-95">
                                <X size={32} strokeWidth={1.5} />
                            </button>
                        </header>

                        <div className="p-10 space-y-10 overflow-y-auto custom-scrollbar flex-1 relative">
                            <div className="p-6 bg-[var(--bg-page)] border border-[var(--border-default)] rounded-[1.5rem] font-mono text-xs flex items-center gap-4 shadow-inner">
                                <span className="px-3 py-1 bg-[var(--brand-primary)]  text-[10px] font-black rounded uppercase">{testTool?.method}</span>
                                <span className={`${T.helperText} ${S.meta} text-[color:var(--text-muted)] truncate`}>{testTool?.endpointUrl}</span>
                            </div>

                            <div className="space-y-4">
                                <label className={`${T.labelText} ${S.meta} uppercase tracking-[4px] ml-4 text-[color:var(--brand-primary)]`}>Payload de Ejecución (JSON)</label>
                                <div className="relative group">
                                    <textarea 
                                        className={`${T.inputText} w-full h-48 bg-[var(--bg-page)] border border-[var(--border-default)] rounded-[2rem] p-6 text-sm font-mono focus:border-[var(--brand-primary)]/50 outline-none transition-all resize-none leading-relaxed shadow-inner placeholder:text-[color:var(--text-muted)]`} 
                                        value={testPayload} 
                                        onChange={e => setTestPayload(e.target.value)} 
                                        placeholder='{ "param": "valor" }'
                                    />
                                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="px-3 py-1 bg-[var(--bg-card)] border border-[var(--border-default)] rounded-lg text-[10px] text-[color:var(--text-muted)] uppercase tracking-widest backdrop-blur-md">JSON Editor</div>
                                    </div>
                                </div>
                            </div>

                            <button 
                                onClick={handleRunTest} 
                                disabled={isTesting} 
                                className={`w-full py-6 bg-[var(--brand-primary)] ${T.buttonPrimaryText} ${S.body} rounded-[2rem] hover:scale-[1.02] transition-all disabled:opacity-50 flex items-center justify-center gap-4 shadow-2xl uppercase tracking-widest relative overflow-hidden`}
                            >
                                {isTesting && <div className="absolute inset-0 bg-[var(--brand-primary)]/20 animate-pulse" />}
                                {isTesting ? <Loader2 size={24} className="animate-spin" /> : <PlayCircle size={24} />}
                                {isTesting ? 'Invocando API...' : 'Ejecutar Simulación'}
                            </button>

                            {testResult && (
                                <div className="space-y-4 animate-in slide-in-from-top-4 duration-500">
                                    <div className="flex items-center justify-between px-4">
                                        <label className={`${T.labelText} ${S.meta} uppercase tracking-[4px] text-[color:var(--state-success)]`}>Respuesta de Servidor</label>
                                        <span className={`${T.labelText} ${S.meta} text-[color:var(--state-success)] flex items-center gap-2 bg-[var(--state-success)]/10 px-3 py-1 rounded-full border border-[var(--state-success)]/20 uppercase`}>
                                            <div className="w-1.5 h-1.5 bg-[var(--state-success)] rounded-full animate-pulse" /> Success 200
                                        </span>
                                    </div>
                                    <div className="relative">
                                        <div className="absolute inset-0 bg-[var(--state-success)]/5 blur-2xl rounded-full" />
                                        <div className="relative p-8 bg-[var(--bg-surface)] border-2 border-[var(--border-default)] rounded-[2.5rem] overflow-auto max-h-64 font-mono text-[10px] text-[color:var(--text-strong)] shadow-2xl custom-scrollbar">
                                            <pre className="text-[color:var(--state-success)]/90 leading-relaxed">{JSON.stringify(testResult, null, 2)}</pre>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
