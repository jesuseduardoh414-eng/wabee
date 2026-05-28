import React, { useState, useEffect } from 'react';
import { aiApi, AiProfile, KbFile, ConsolidatedProfileTool } from '@/api/wabee/ai.api';
import { useToast } from '@/context/ToastContext';
import { useDialog } from '@/context/DialogContext';
import WhatsAppAgentTestModal from '@/components/wabee/WhatsAppAgentTestModal';
import { T, S } from '@/lib/text-tokens';

const TONE_OPTIONS = [
    { value: 'Professional', label: 'Profesional' },
    { value: 'Friendly', label: 'Amigable' },
    { value: 'Casual', label: 'Casual' },
    { value: 'Empathetic', label: 'Empático' },
    { value: 'Enthusiastic', label: 'Entusiasta' },
    { value: 'Formal', label: 'Formal' },
    { value: 'Direct', label: 'Directo' },
    { value: 'Humorous', label: 'Humor' },
];

interface FallbackPreset {
    value: 'PRESET_A' | 'PRESET_B' | 'PRESET_C' | 'CUSTOM';
    label: string;
    text: string;
}

const FALLBACK_PRESETS: FallbackPreset[] = [
    { value: 'PRESET_A', label: 'Preset A (Email/WhatsApp)', text: 'Un agente te atenderá pronto. ¿Puedes dejar tu correo o WhatsApp?' },
    { value: 'PRESET_B', label: 'Preset B (Asesor)', text: 'Gracias. En este momento no puedo responder. Te canalizo con un asesor.' },
    { value: 'PRESET_C', label: 'Preset C (Humano breve)', text: 'Para darte la mejor respuesta necesito un asesor humano. En breve te contactamos.' },
    { value: 'CUSTOM', label: 'Personalizado', text: '' },
];

const AiProfilesPage: React.FC = () => {
    const [profiles, setProfiles] = useState<AiProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [kbFiles, setKbFiles] = useState<KbFile[]>([]);
    const [uploading, setUploading] = useState(false);
    const [testingProfile, setTestingProfile] = useState<AiProfile | null>(null);
    const [profileTools, setProfileTools] = useState<ConsolidatedProfileTool[]>([]);
    const [loadingTools, setLoadingTools] = useState(false);

    const [formData, setFormData] = useState<Omit<AiProfile, 'id' | 'createdAt' | 'kbFiles' | '_count'>>({
        name: '',
        agentName: '',
        roleTitle: '',
        personalityNotes: '',
        greetingStyle: 'WARM',
        tones: [],
        systemPrompt: '', // This acts as "Mission/Objective" now
        fallbackMode: 'CUSTOM',
        fallbackCustomMessage: '',
        confidenceThreshold: 0.6,
        channelType: 'WIDGET',
        maxTokens: 1000,
        kbEnabled: true,
    });

    const { error: toastError, success: toastSuccess } = useToast();
    const { confirm } = useDialog();

    useEffect(() => {
        loadProfiles();
    }, []);

    useEffect(() => {
        if (editingId) {
            loadKbFiles(editingId);
            loadProfileTools(editingId);
        }
    }, [editingId]);

    const getTenantKey = () => {
        return localStorage.getItem('wabee_tenant_key') || localStorage.getItem('tenant_key') || 'dev-api-key-tenant-1';
    };

    const loadProfiles = async () => {
        setLoading(true);
        try {
            const data = await aiApi.listProfiles();
            setProfiles(data);
        } catch (error: any) {
            console.error('[AiProfiles] Error loading profiles:', error);
            toastError(error.message || 'Error al cargar perfiles');
        } finally {
            setLoading(false);
        }
    };

    const loadKbFiles = async (profileId: string) => {
        try {
            const data = await aiApi.getKbFiles(profileId);
            setKbFiles(data);
        } catch (error: any) {
            console.error('[AiProfiles] Error loading KB files:', error);
        }
    };

    const loadProfileTools = async (profileId: string) => {
        setLoadingTools(true);
        try {
            const data = await aiApi.listProfileTools(profileId);
            setProfileTools(data);
        } catch (error: any) {
            console.error('[AiProfiles] Error loading profile tools:', error);
        } finally {
            setLoadingTools(false);
        }
    };

    const handleToggleProfileTool = async (toolId: string, currentStatus: boolean) => {
        if (!editingId) return;
        try {
            await aiApi.updateProfileToolStatus(editingId, toolId, !currentStatus);
            loadProfileTools(editingId);
            toastSuccess(`Estado de la herramienta actualizado`);
        } catch (error: any) {
            toastError('Error al actualizar herramienta: ' + (error.message || 'Error desconocido'));
        }
    };

    const handleToggleGlobalTool = async (toolId: string, currentStatus: boolean) => {
        if (!editingId) return;
        try {
            await aiApi.updateGlobalToolStatus(toolId, !currentStatus);
            loadProfileTools(editingId);
            toastSuccess(`Estado global de la herramienta actualizado`);
        } catch (error: any) {
            toastError('Error al actualizar estado global: ' + (error.message || 'Error desconocido'));
        }
    };

    const handleLinkTool = async (toolId: string) => {
        if (!editingId) return;
        try {
            await aiApi.linkTool(editingId, toolId);
            loadProfileTools(editingId);
            toastSuccess('Herramienta vinculada');
        } catch (error: any) {
            toastError('Error vinculando herramienta: ' + (error.message || 'Error desconocido'));
        }
    };

    const handleUnlinkTool = async (toolId: string) => {
        if (!editingId) return;
        try {
            await aiApi.unlinkTool(editingId, toolId);
            loadProfileTools(editingId);
            toastSuccess('Herramienta desvinculada');
        } catch (error: any) {
            toastError('Error desvinculando herramienta: ' + (error.message || 'Error desconocido'));
        }
    };

    const handleUploadPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!editingId || !e.target.files?.[0]) return;
        setUploading(true);
        try {
            await aiApi.uploadKbFile(editingId, e.target.files[0]);
            loadKbFiles(editingId);
            loadProfiles();
            toastSuccess('Archivo subido correctamente');
        } catch (error: any) {
            toastError('Error subiendo archivo: ' + (error.message || 'Error desconocido'));
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const handleDeleteKbFile = async (fileId: string) => {
        if (!editingId) return;
        const isConfirmed = await confirm({
            title: 'Eliminar Archivo',
            description: '¿Eliminar este archivo de la base de conocimiento?',
            isDestructive: true,
            confirmText: 'Eliminar'
        });
        if (!isConfirmed) return;

        try {
            await aiApi.deleteKbFile(editingId, fileId);
            loadKbFiles(editingId);
            loadProfiles();
            toastSuccess('Archivo eliminado');
        } catch (error: any) {
            console.error('[AiProfiles] Error deleting KB file:', error);
            toastError('Error al eliminar archivo');
        }
    };

    const handleReindexKbFile = async (fileId: string) => {
        if (!editingId) return;
        try {
            await aiApi.reindexKbFile(editingId, fileId);
            loadKbFiles(editingId);
        } catch (error: any) {
            console.error('[AiProfiles] Error reindexing KB file:', error);
        }
    };

    const handleViewKbFile = (fileId: string) => {
        if (!editingId) return;
        const url = aiApi.viewKbFileUrl(editingId, fileId);
        window.open(url, '_blank');
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await aiApi.createProfile(formData);
            loadProfiles();
            setShowCreate(false);
            resetForm();
            toastSuccess('Perfil creado correctamente');
        } catch (error: any) {
            toastError('Error creating profile: ' + (error.message || 'Error desconocido'));
        }
    };

    const handleUpdate = async (id: string) => {
        try {
            await aiApi.updateProfile(id, formData);
            loadProfiles();
            setEditingId(null);
            resetForm();
            toastSuccess('Perfil actualizado correctamente');
        } catch (error: any) {
            toastError('Error updating profile: ' + (error.message || 'Error desconocido'));
        }
    };

    const handleDelete = async (id: string) => {
        const isConfirmed = await confirm({
            title: 'Eliminar Perfil IA',
            description: '¿Estás seguro de eliminar este perfil de IA?',
            isDestructive: true,
            confirmText: 'Eliminar'
        });
        if (!isConfirmed) return;

        try {
            await aiApi.deleteProfile(id);
            loadProfiles();
            toastSuccess('Perfil eliminado');
        } catch (error: any) {
            console.error('[AiProfiles] Delete error:', error);
            toastError('Error al eliminar perfil');
        }
    };

    const startEdit = (profile: AiProfile) => {
        setFormData({
            name: profile.name,
            agentName: profile.agentName || '',
            roleTitle: profile.roleTitle || '',
            personalityNotes: profile.personalityNotes || '',
            greetingStyle: profile.greetingStyle || 'WARM',
            tones: profile.tones || [],
            systemPrompt: profile.systemPrompt,
            fallbackMode: profile.fallbackMode,
            fallbackCustomMessage: profile.fallbackCustomMessage || '',
            confidenceThreshold: profile.confidenceThreshold,
            channelType: profile.channelType || 'WIDGET',
            maxTokens: profile.maxTokens || 1000,
            kbEnabled: profile.kbEnabled ?? true,
        });
        setEditingId(profile.id);
        setShowCreate(false);
    };

    const resetForm = () => {
        setFormData({
            name: '',
            agentName: '',
            roleTitle: '',
            personalityNotes: '',
            greetingStyle: 'WARM',
            tones: [],
            systemPrompt: '',
            fallbackMode: 'CUSTOM',
            fallbackCustomMessage: '',
            confidenceThreshold: 0.6,
            channelType: 'WIDGET',
            maxTokens: 1000,
            kbEnabled: true,
        });
        setKbFiles([]);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setShowCreate(false);
        resetForm();
    };

    const toggleTone = (tone: string) => {
        setFormData(prev => ({
            ...prev,
            tones: prev.tones.includes(tone)
                ? prev.tones.filter(t => t !== tone)
                : [...prev.tones, tone]
        }));
    };

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-6 bg-[var(--bg-page)] min-h-screen">
            <header className="flex justify-between items-end">
                <div>
                    <h1 className={`${T.pageTitle} ${S.displayMd}`}>Perfiles de <span className="text-[var(--ty-accent)]">IA</span></h1>
                    <p className={`${T.pageSubtitle} ${S.body}`}>Configura los perfiles conversacionales y base de conocimiento.</p>
                </div>
                {!showCreate && !editingId && (
                    <button
                        onClick={() => { setShowCreate(true); setEditingId(null); resetForm(); }}
                        className={`bg-[var(--brand-primary)]  px-5 py-2.5 rounded-xl font-bold shadow-lg hover:brightness-110 transition active:scale-95 ${T.buttonPrimaryText}`}
                    >
                        + Nuevo Perfil
                    </button>
                )}
            </header>

            {/* Form Modal / Section */}
            {(showCreate || editingId) && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-[var(--bg-card)] p-6 rounded-2xl border border-[var(--border-default)] shadow-2xl">
                            <h2 className={`${T.sectionTitle} text-xl flex justify-between items-center`}>
                                <span>{editingId ? 'Editar Perfil' : 'Crear Perfil'}</span>
                                <div className="flex items-center gap-4">
                                    <div className="flex bg-[var(--bg-input)] p-1 rounded-xl">
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, channelType: 'WIDGET' })}
                                            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${formData.channelType === 'WIDGET' ? 'bg-[var(--brand-primary)] text-[var(--brand-primary-foreground)] shadow-lg' : 'text-[var(--text-muted)] hover:text-[var(--text-strong)]'}`}
                                        >
                                            Widget
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, channelType: 'WHATSAPP' })}
                                            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${formData.channelType === 'WHATSAPP' ? 'bg-[var(--brand-primary)] text-[var(--brand-primary-foreground)] shadow-lg' : 'text-[var(--text-muted)] hover:text-[var(--text-strong)]'}`}
                                        >
                                            WhatsApp
                                        </button>
                                    </div>
                                    <button onClick={cancelEdit} className={`${T.helperText} hover:brightness-150 text-sm transition-colors`}>Cerrar</button>
                                </div>
                            </h2>
                            <form onSubmit={(e) => editingId ? (e.preventDefault(), handleUpdate(editingId)) : handleCreate(e)} className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className={`${T.labelText} ${S.meta} block mb-1`}>Nombre del Perfil (Interno)</label>
                                        <input
                                            type="text" required
                                            className={`ui-input ${T.inputText} ${S.body}`}
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="Ej: Ventas México"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-1">
                                        <label className={`${T.labelText} ${S.meta} block mb-1`}>Nombre Agente (Público)</label>
                                        <input
                                            type="text"
                                            className={`ui-input ${T.inputText} ${S.body}`}
                                            value={formData.agentName || ''}
                                            onChange={(e) => setFormData({ ...formData, agentName: e.target.value })}
                                            placeholder="Ej: Ana, Soporte, Bot"
                                        />
                                    </div>
                                    <div className="col-span-1">
                                        <label className={`${T.labelText} ${S.meta} block mb-1`}>Título/Rol</label>
                                        <input
                                            type="text"
                                            className={`ui-input ${T.inputText} ${S.body}`}
                                            value={formData.roleTitle || ''}
                                            onChange={(e) => setFormData({ ...formData, roleTitle: e.target.value })}
                                            placeholder="Ej: Asistente Virtual"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className={`${T.labelText} ${S.meta} block mb-3`}>Tonos Conversacionales</label>
                                    <div className="flex flex-wrap gap-2">
                                        {TONE_OPTIONS.map((option: any) => (
                                            <button
                                                key={option.value}
                                                type="button"
                                                onClick={() => toggleTone(option.value)}
                                                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${formData.tones.includes(option.value)
                                                    ? 'bg-[var(--brand-primary)] border-[var(--brand-primary)] text-[var(--brand-primary-foreground)] shadow-md'
                                                    : 'bg-[var(--bg-input)] border-[var(--border-default)] text-[var(--text-muted)] hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]'
                                                    }`}
                                            >
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className={`${T.labelText} ${S.meta} block mb-1`}>Misión / Objetivo (Prompt Base)</label>
                                    <textarea
                                        required rows={4}
                                        className={`ui-textarea ${T.inputText} ${S.body} font-mono text-xs leading-relaxed`}
                                        value={formData.systemPrompt}
                                        onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                                        placeholder="Tu misión es ayudar a..."
                                    />
                                </div>

                                <div>
                                    <label className={`${T.labelText} ${S.meta} block mb-1`}>Notas de Personalidad (Opcional)</label>
                                    <textarea
                                        rows={2}
                                        className={`ui-textarea ${T.inputText} ${S.body}`}
                                        value={formData.personalityNotes || ''}
                                        onChange={(e) => setFormData({ ...formData, personalityNotes: e.target.value })}
                                        placeholder="Ej: Evita usar jerga técnica. Sé muy amable con las quejas."
                                    />
                                </div>



                                <div className="p-4 bg-[var(--bg-input)] rounded-xl space-y-4 border border-[var(--border-default)]">
                                    <h3 className={`${T.cardTitle} text-sm`}>Manejo de Respuestas Fallidas (Baja Confianza)</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {FALLBACK_PRESETS.map((preset: FallbackPreset) => (
                                            <label key={preset.value} className={`p-3 rounded-lg border transition-all cursor-pointer ${formData.fallbackMode === preset.value ? 'bg-[var(--brand-primary)]/10 border-[var(--brand-primary)] shadow-lg' : 'bg-[var(--bg-card)] border-[var(--border-default)] hover:border-[var(--text-muted)]/20'
                                                }`}>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <input
                                                        type="radio" name="fallback"
                                                        className="accent-[var(--brand-primary)]"
                                                        checked={formData.fallbackMode === preset.value}
                                                        onChange={() => setFormData({ ...formData, fallbackMode: preset.value })}
                                                    />
                                                    <span className={`text-xs font-bold ${formData.fallbackMode === preset.value ? 'text-[var(--brand-primary)]' : 'text-[var(--text-strong)]'}`}>{preset.label}</span>
                                                </div>
                                                {preset.text && <p className="text-[10px] text-[var(--text-muted)] leading-tight">{preset.text}</p>}
                                            </label>
                                        ))}
                                    </div>
                                    {formData.fallbackMode === 'CUSTOM' && (
                                        <textarea
                                            rows={2}
                                            className={`ui-textarea ${T.inputText} ${S.body} bg-[var(--bg-card)]`}
                                            value={formData.fallbackCustomMessage}
                                            onChange={(e) => setFormData({ ...formData, fallbackCustomMessage: e.target.value })}
                                            placeholder="Mensaje personalizado de fallback..."
                                        />
                                    )}
                                </div>

                                <div className="flex gap-4">
                                    <button
                                        type="submit"
                                        className={`flex-1 bg-[var(--brand-primary)]  py-3 rounded-xl font-bold hover:brightness-110 transition shadow-lg ${T.buttonPrimaryText}`}
                                    >
                                        {editingId ? 'Guardar Cambios' : 'Crear Perfil'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>

                    {/* Sidebar: KB & Settings */}
                    <div className="space-y-6">
                        {editingId ? (
                            <>
                            <div className="bg-[var(--bg-card)] p-6 rounded-2xl border border-[var(--border-default)] shadow-2xl overflow-hidden">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className={`${T.cardTitle} text-sm`}>Base de Conocimiento</h3>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox" className="sr-only peer"
                                            checked={formData.kbEnabled}
                                            onChange={(e) => setFormData({ ...formData, kbEnabled: e.target.checked })}
                                        />
                                        <div className="w-9 h-5 bg-[var(--bg-input)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-[var(--bg-page)] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[var(--text-muted)] after:border-[var(--border-default)] after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--brand-primary)]"></div>
                                    </label>
                                </div>

                                <div className="mb-6">
                                    <div className={`border-2 border-dashed rounded-xl p-4 text-center transition ${uploading ? 'bg-[var(--bg-input)] border-[var(--border-default)]' : 'border-[var(--border-default)] bg-[var(--bg-card)] hover:bg-[var(--bg-input)] hover:border-[var(--brand-primary)]/50'}`}>
                                        <input
                                            type="file"
                                            accept=".pdf,.csv,.xlsx,.xls,application/pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                                            className="hidden"
                                            id="kb-upload"
                                            onChange={handleUploadPdf}
                                            disabled={uploading}
                                        />
                                        <label htmlFor="kb-upload" className="cursor-pointer block">
                                            <div className="text-[var(--brand-primary)] mb-1">
                                                <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                                            </div>
                                            <span className={`${T.menuText} text-xs`}>{uploading ? 'Subiendo...' : 'Subir documento'}</span>
                                            <p className={`${T.helperText} text-[9px] mt-0.5`}>PDF · CSV · XLSX · XLS — máx. 25 MB</p>
                                        </label>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {kbFiles.length === 0 && <p className={`${T.emptyStateBody} text-center text-xs py-4`}>Sin documentos indexados</p>}
                                    {kbFiles.map((file: KbFile) => (
                                        <div key={file.id} className="p-3 bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl relative group transition-all hover:border-[var(--brand-primary)]/30">
                                            <div className="flex justify-between items-start">
                                                <div className="max-w-[80%]">
                                                    <p className={`${T.tableCell} text-xs truncate`}>{file.filename}</p>
                                                    <p className={`${T.helperText} text-[10px]`}>{(file.size / 1024).toFixed(1)} KB</p>
                                                </div>
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                                                    <button onClick={() => handleViewKbFile(file.id)} className="p-1 hover:bg-[var(--brand-primary)]/20 rounded transition" title="Ver PDF">
                                                        <svg className="w-3.5 h-3.5 text-[var(--brand-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                                    </button>
                                                    <button onClick={() => handleReindexKbFile(file.id)} className="p-1 hover:bg-[var(--brand-primary)]/20 rounded transition" title="Reindexar">
                                                        <svg className="w-3.5 h-3.5 text-[var(--brand-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                                    </button>
                                                    <button onClick={() => handleDeleteKbFile(file.id)} className="p-1 hover:bg-red-500/20 rounded transition" title="Eliminar">
                                                        <svg className="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="mt-2 flex items-center justify-between">
                                                <span className={`${T.statusText} text-[9px] px-1.5 py-0.5 rounded ${
                                                    file.status === 'INDEXED' ? 'bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]' :
                                                    file.status === 'PROCESSING' ? 'bg-yellow-500/20 text-yellow-500' : 'bg-red-500/20 text-red-500'
                                                }`}>
                                                    {file.status}
                                                </span>
                                                <span className={`${T.helperText} text-[9px]`}>{new Date(file.updatedAt).toLocaleDateString()}</span>
                                            </div>
                                            {file.error && <p className="mt-1 text-[8px] text-red-400 leading-tight italic line-clamp-2">{file.error}</p>}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* AI Tools Section */}
                            <div className="bg-[var(--bg-card)] p-6 rounded-2xl border border-[var(--border-default)] shadow-2xl">
                                <div className="flex flex-col mb-4">
                                    <h3 className={`${T.cardTitle} text-sm`}>Herramientas del Asistente</h3>
                                    <p className={`${T.cardSubtitle} text-xs mt-1`}>Activa las herramientas a las que este Agente tendrá acceso.</p>
                                </div>
                                <div className="space-y-4">
                                    {loadingTools && <div className={`${T.helperText} py-10 text-center text-xs`}>Cargando herramientas...</div>}
                                    {!loadingTools && profileTools.length === 0 && (
                                        <div className="py-6 text-center bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl flex flex-col items-center justify-center">
                                            <p className={`${T.emptyStateBody} text-xs mb-3`}>No hay herramientas configuradas en este tenant.</p>
                                            <a href="/wabee/ai-tools" className="text-xs text-[var(--brand-primary)] hover:underline">Ir a crear una Herramienta</a>
                                        </div>
                                    )}
                                    {profileTools.map(tool => (
                                        <div key={tool.id} className={`p-4 bg-[var(--bg-input)] border rounded-xl transition-all ${tool.isLinked ? 'border-[var(--brand-primary)]/50 shadow-sm' : 'border-[var(--border-default)]'}`}>
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <h4 className={`${T.menuText} text-sm`}>{tool.displayName}</h4>
                                                        <span className={`${T.helperText} text-[10px] lowercase px-1.5 py-0.5 bg-[var(--bg-card)] rounded border border-[var(--border-default)]`}>{tool.name}</span>
                                                    </div>
                                                    <p className={`${T.helperText} text-[10px] mt-1 pr-4`}>{tool.description}</p>
                                                    
                                                    {!tool.globalIsActive && (
                                                        <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-[10px]">
                                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                                            Herramienta Inactiva Globalmente (No será usada)
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-4 ml-4">
                                                    {tool.isLinked ? (
                                                        <div className="flex flex-col items-end gap-2">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`${T.helperText} text-[10px]`}>Estado en este Perfil:</span>
                                                                <button
                                                                    onClick={() => handleToggleProfileTool(tool.id, tool.profileIsActive)}
                                                                    className={`w-9 h-5 rounded-full relative transition-colors duration-200 focus:outline-none ${tool.profileIsActive ? 'bg-[var(--brand-primary)]' : 'bg-[var(--bg-input)]'}`}
                                                                >
                                                                    <div className={`absolute top-[2px] w-4 h-4 bg-white rounded-full transition-transform duration-200 ${tool.profileIsActive ? 'translate-x-[18px]' : 'translate-x-[2px]'}`} />
                                                                </button>
                                                            </div>
                                                            <button
                                                                onClick={() => handleUnlinkTool(tool.id)}
                                                                className={`${T.helperText} text-[10px] text-red-400 hover:text-red-300 transition-colors`}
                                                            >
                                                                Desvincular
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleLinkTool(tool.id)}
                                                            className={`${T.buttonText} px-3 py-1.5 bg-[var(--bg-input)] hover:bg-[var(--bg-card)] text-xs rounded-lg transition-colors border border-[var(--border-default)] hover:border-[var(--brand-primary)]/50`}
                                                        >
                                                            + Vincular Tool
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            {tool.isLinked && (
                                                <div className="mt-3 flex items-center justify-between border-t border-[var(--border-default)] pt-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`w-2 h-2 rounded-full ${tool.effectivelyActive ? 'bg-green-500 animate-pulse shadow-[0_0_5px_#22c55e]' : 'bg-red-500 shadow-[0_0_5px_#ef4444]'}`} />
                                                        <span className={`${T.statusText} text-[10px] ${tool.effectivelyActive ? 'text-green-500' : 'text-red-500'}`}>
                                                            {tool.effectivelyActive ? 'Lista para usarse por el LLM' : 'Inactiva P/ LLM'}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            </>
                        ) : (
                            <div className="bg-[var(--bg-card)] p-6 rounded-2xl border border-[var(--border-default)] shadow-xl text-center">
                                <div className="text-[var(--text-muted)] mb-3"><svg className="w-10 h-10 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
                                <h4 className="text-sm font-bold text-[var(--text-strong)] mb-2">Base de Conocimiento / Herramientas</h4>
                                <p className="text-xs text-[var(--text-muted)]">Guarda el perfil primero para poder configurar documentos y herramientas de negocio.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            {/* Profiles List */}
            {!showCreate && !editingId && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {loading && Array(3).fill(0).map((_, i) => (
                        <div key={i} className="h-64 bg-[var(--bg-card)] animate-pulse rounded-2xl border border-[var(--border-default)]"></div>
                    ))}
                    {!loading && profiles.length === 0 && (
                        <div className="col-span-full py-20 text-center text-[var(--text-muted)] font-medium">
                            No hay perfiles configurados
                        </div>
                    )}
                    {!loading && profiles.map((profile: AiProfile) => (
                        <div key={profile.id} className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-default)] shadow-lg hover:shadow-[var(--brand-primary)]/5 hover:border-[var(--brand-primary)]/30 transition-all group border-b-4 border-b-[var(--border-default)] active:translate-y-1">
                            <div className="p-6">
                                <div className="flex justify-between items-center mb-3">
                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${profile.channelType === 'WHATSAPP' ? 'bg-green-500/10 text-green-600' : 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]'}`}>
                                        {profile.channelType || 'WIDGET'}
                                    </span>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => setTestingProfile(profile)}
                                            title="Probar Agente IA"
                                            className={`p-2 rounded-full transition-all ${profile.channelType === 'WHATSAPP' ? 'hover:bg-green-500/10 text-[var(--text-muted)] hover:text-green-600' : 'hover:bg-[var(--brand-primary)]/10 text-[var(--text-muted)] hover:text-[var(--brand-primary)]'}`}
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        </button>
                                        <button onClick={() => startEdit(profile)} className="p-2 hover:bg-[var(--bg-input)] rounded-full text-[var(--text-muted)] hover:text-[var(--brand-primary)] transition-all"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
                                        <button onClick={() => handleDelete(profile.id)} className="p-2 hover:bg-red-500/10 rounded-full text-[var(--text-muted)] hover:text-red-500 transition-all"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                                    </div>
                                </div>
                                <h3 className={`${T.cardTitle} text-xl group-hover:text-[var(--brand-primary)] transition truncate pr-2 mb-4`}>{profile.name}</h3>
                                <div className="flex flex-wrap gap-1.5 mb-4">
                                    {profile.tones?.map((t: string) => (
                                        <span key={t} className="px-2 py-0.5 bg-[var(--bg-input)] text-[var(--brand-primary)] text-[10px] font-bold rounded uppercase tracking-wider border border-[var(--border-default)]">{t}</span>
                                    ))}
                                    {(!profile.tones || profile.tones.length === 0) && <span className="text-[10px] text-[var(--text-muted)] italic">Sin tonos</span>}
                                </div>
                                <p className={`${T.cardSubtitle} text-xs italic mb-4 line-clamp-3 leading-relaxed`}>"{profile.systemPrompt}"</p>
                                <div className="pt-4 border-t border-[var(--border-default)] flex justify-between items-center text-[10px] font-bold">
                                    <div className="flex gap-2 text-[var(--text-muted)]">
                                        <span className="flex items-center gap-1"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> {profile._count?.kbFiles || 0} docs</span>
                                    </div>
                                    <span className="text-[var(--text-muted)]/50">{new Date(profile.createdAt).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}


            {testingProfile && (
                <WhatsAppAgentTestModal
                    profile={testingProfile}
                    onClose={() => setTestingProfile(null)}
                />
            )}

        </div>
    );
};

export default AiProfilesPage;
