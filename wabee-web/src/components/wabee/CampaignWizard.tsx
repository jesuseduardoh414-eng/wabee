import { useState, useEffect } from 'react';
import {
    X,
    ChevronRight,
    ChevronLeft,
    Send,
    Layout,
    Users,
    Clock,
    CheckCircle2,
    Calendar,
    Target,
    Sliders,
    Info,
    AlertCircle,
    FileText,
    Image,
    Link,
    UploadCloud,
    Image as ImageIcon,
    Search
} from 'lucide-react';
import { getChannels, Channel } from '@/api/wabee/whatsapp.api';
import { templatesApi, Template } from '@/api/wabee/templates.api';
import { contactsApi } from '@/api/wabee/contacts.api';
import { createCampaign } from '@/api/wabee/campaigns.api';
import { InlineTemplateEditor } from './InlineTemplateEditor';
import {
    hasTemplateInputs,
    getTemplateInputs,
    validateMapping,
    InputDescriptor,
    TemplateInputMapping,
} from '@/utils/templateInputParser';
import { useToast } from '@/context/ToastContext';
import { T, S } from '@/lib/text-tokens';

interface CampaignWizardProps {
    initialData?: any;
    onClose: () => void;
    onSuccess: () => void;
}

// ─── Step constants ───────────────────────────────────────────────────────────
const STEP_CONFIG = 1;
const STEP_TEMPLATE = 2;
const STEP_PERSONALIZE = 3;
const STEP_AUDIENCE = 4; // rendered as 3 when no personalization needed

// ─── Label helpers ────────────────────────────────────────────────────────────
const CONTACT_FIELD_LABELS: Record<string, string> = {
    'contact.name': 'Nombre del contacto',
    'contact.phone': 'Teléfono del contacto',
    'contact.email': 'Email del contacto',
};

const KIND_ICON: Record<string, React.ReactNode> = {
    TEXT_VAR: <FileText size={14} />,
    URL_VAR: <Link size={14} />,
    MEDIA: <Image size={14} />,
};

export default function CampaignWizard({ initialData, onClose, onSuccess }: CampaignWizardProps) {
    const [step, setStep] = useState(STEP_CONFIG);
    const [loading, setLoading] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const { error: toastError } = useToast();

    // Form Data
    const [formData, setFormData] = useState({
        name: initialData?.name || '',
        channelId: initialData?.channelId || '',
        templateId: initialData?.templateId || '',
        audienceType: initialData?.audienceType || 'ALL_ACTIVE' as any,
        audienceFilter: initialData?.audienceFilter || {} as any,
        scheduledAt: initialData?.scheduledAt ? new Date(initialData.scheduledAt).toISOString().slice(0, 16) : '',
    });

    // Template inputs state
    const [templateInputs, setTemplateInputs] = useState<InputDescriptor[]>([]);
    const [inlineValues, setInlineValues] = useState<Record<string, string>>({});
    const [focusedId, setFocusedId] = useState<string | null>(null);

    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
    const [hasInputs, setHasInputs] = useState(false);

    // Add state for media upload type toggle (URL vs Upload)
    const [mediaInputType, setMediaInputType] = useState<Record<string, 'url' | 'upload'>>({});

    // Template search filter
    const [templateSearch, setTemplateSearch] = useState('');

    // Lists
    const [channels, setChannels] = useState<Channel[]>([]);
    const [templates, setTemplates] = useState<Template[]>([]);
    const [groups, setGroups] = useState<any[]>([]);
    const [segments, setSegments] = useState<any[]>([]);

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const [channelsData, groupsData, segmentsData] = await Promise.all([
                    getChannels({ status: 'CONNECTED' }),
                    contactsApi.listGroups(),
                    contactsApi.listSegments()
                ]);
                setChannels(channelsData);
                setGroups(groupsData);
                setSegments(segmentsData);
            } catch (err) {
                console.error('Error loading wizard data:', err);
            }
        };
        loadInitialData();
    }, []);

    useEffect(() => {
        if (formData.channelId) {
            templatesApi.listTemplates(formData.channelId)
                .then(res => setTemplates(res.items))
                .catch(err => console.error('Error loading templates:', err));
        }
    }, [formData.channelId]);

    // Recalculate inputs when template changes
    useEffect(() => {
        const tmpl = templates.find(t => t.id === formData.templateId) || null;
        setSelectedTemplate(tmpl);
        if (tmpl) {
            const inputs = getTemplateInputs(tmpl);
            setTemplateInputs(inputs);
            setHasInputs(inputs.length > 0);

            // Cargar inicial o default (solo 'fixed' y 'fixed_media')
            if (initialData?.templateInputMapping) {
                const initialInline: Record<string, string> = {};
                for (const key of Object.keys(initialData.templateInputMapping)) {
                    initialInline[key] = initialData.templateInputMapping[key]?.value || '';
                }
                setInlineValues(initialInline);
            } else {
                setInlineValues({});
            }
        } else {
            setTemplateInputs([]);
            setHasInputs(false);
        }
    }, [formData.templateId, templates]);

    // ─── Steps helpers ────────────────────────────────────────────────────────
    const totalSteps = hasInputs ? 4 : 3;

    // Visual step number (when no personalization, step 4 renders as "3")
    const visualStep = () => {
        if (!hasInputs && step === STEP_AUDIENCE) return 3;
        return step;
    };

    const stepLabel = () => {
        switch (step) {
            case STEP_CONFIG: return 'Configuración';
            case STEP_TEMPLATE: return 'Plantilla';
            case STEP_PERSONALIZE: return 'Personalizar';
            case STEP_AUDIENCE: return 'Audiencia';
            default: return '';
        }
    };

    // ─── Mapping helpers ──────────────────────────────────────────────────────
    const updateInlineValue = (id: string, value: string) => {
        setInlineValues(prev => ({ ...prev, [id]: value }));
    };

    const generateMapping = (): TemplateInputMapping => {
        const mapping: TemplateInputMapping = {};
        templateInputs.forEach(i => {
            if (inlineValues[i.id] !== undefined && inlineValues[i.id].trim() !== '') {
                mapping[i.id] = {
                    mode: i.kind === 'MEDIA' ? 'fixed_media' : 'fixed',
                    value: inlineValues[i.id]
                };
            }
        });
        return mapping;
    };

    const isMappingComplete = (): boolean => {
        if (!selectedTemplate) return true;
        const result = validateMapping(selectedTemplate, generateMapping());
        return result.valid;
    };

    // ─── Navigation ──────────────────────────────────────────────────────────
    const nextStep = () => {
        if (step === STEP_TEMPLATE) {
            if (hasInputs) {
                setStep(STEP_PERSONALIZE);
            } else {
                setInlineValues({});
                setStep(STEP_AUDIENCE);
            }
            return;
        }
        setStep(s => s + 1);
    };

    const prevStep = () => {
        if (step === STEP_AUDIENCE) {
            if (hasInputs) {
                setStep(STEP_PERSONALIZE);
            } else {
                setStep(STEP_TEMPLATE);
            }
            return;
        }
        setStep(s => s - 1);
    };

    const isNextDisabled = (): boolean => {
        if (step === STEP_CONFIG) return !formData.name || !formData.channelId;
        if (step === STEP_TEMPLATE) return !formData.templateId;
        if (step === STEP_PERSONALIZE) {
            const validation = selectedTemplate ? validateMapping(selectedTemplate, generateMapping()) : { valid: true };
            return !validation.valid;
        }
        return false;
    };

    const isLastStep = step === STEP_AUDIENCE;

    // ─── Submit ───────────────────────────────────────────────────────────────
    const handleSubmit = async () => {
        try {
            setLoading(true);

            // Convertir scheduledAt de formato datetime-local a ISO 8601 completo
            let scheduledAtIso: string | undefined = undefined;
            if (formData.scheduledAt) {
                const parsed = new Date(formData.scheduledAt);
                if (!isNaN(parsed.getTime())) {
                    scheduledAtIso = parsed.toISOString();
                }
            }

            const isEditing = !!initialData?.id;

            const dataToSubmit: Record<string, any> = {
                name: formData.name,
                channelId: formData.channelId,
                templateId: formData.templateId || undefined,
                audienceType: formData.audienceType,
                audienceFilter: formData.audienceFilter,
            };

            // Solo incluir scheduledAt si tiene valor válido
            if (scheduledAtIso) {
                dataToSubmit.scheduledAt = scheduledAtIso;
            }

            // Lógica de templateInputMapping:
            // - Al crear: siempre se envía (null si no hay variables)
            // - Al editar: solo se envía si el usuario pasó por el paso de personalización
            //   y las templates ya cargaron. Si hasInputs=false pero la campaña ya tenía
            //   un mapping, no lo pisamos (el backend preserva el valor existente).
            if (!isEditing) {
                // Creación: enviar siempre
                dataToSubmit.templateInputMapping = hasInputs ? generateMapping() : null;
            } else if (hasInputs) {
                // Edición con template que tiene variables: enviar el mapping actualizado
                dataToSubmit.templateInputMapping = generateMapping();
            } else if (selectedTemplate && !hasInputs) {
                // Edición con template estático (sin variables): limpiar mapping
                dataToSubmit.templateInputMapping = null;
            }
            // Si selectedTemplate es null (templates aún cargando), no incluimos
            // templateInputMapping → el backend preserva el valor existente en DB.

            if (isEditing) {
                const { updateCampaign } = await import('@/api/wabee/campaigns.api');
                await updateCampaign(initialData.id, dataToSubmit);
            } else {
                await createCampaign(dataToSubmit);
            }
            onSuccess();
        } catch (error: any) {
            if (error.status === 409) {
                if (error.message.includes('nombre')) {
                    setFieldErrors({ name: error.message });
                }
            }
            toastError(error.message || 'Error al guardar la campaña');
        } finally {
            setLoading(false);
        }

    };


    // ─── Step renderers ───────────────────────────────────────────────────────
    const renderStep1 = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
                <label className="block text-[10px] font-black text-[color:var(--tx-helperText-color)] uppercase tracking-widest mb-2">Nombre de la Campaña</label>
                <input
                    type="text"
                    placeholder="Ej: Promo Hot Sale 2024"
                    value={formData.name}
                    onChange={(e) => {
                        setFormData({ ...formData, name: e.target.value });
                        if (fieldErrors.name) setFieldErrors({ ...fieldErrors, name: '' });
                    }}
                    className={`w-full bg-[var(--bg-input)] border rounded-xl py-3 px-4 text-sm focus:border-[var(--brand-primary)] transition-all text-[color:var(--tx-inputText-color)] outline-none ${fieldErrors.name ? 'border-red-500' : 'border-[var(--border-default)]'}`}
                />
                {fieldErrors.name && <p className="text-red-500 text-[10px] mt-1 italic">{fieldErrors.name}</p>}

            </div>
            <div>
                <label className="block text-[10px] font-black text-[color:var(--tx-helperText-color)] uppercase tracking-widest mb-2">Canal de Envío</label>
                <div className="grid grid-cols-1 gap-3">
                    {channels.map(ch => (
                        <div
                            key={ch.id}
                            onClick={() => setFormData({ ...formData, channelId: ch.id })}
                            className={`p-4 border rounded-xl cursor-pointer transition-all flex items-center justify-between group ${formData.channelId === ch.id ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5' : 'border-[var(--border-default)] bg-[var(--bg-card)] hover:border-[var(--brand-primary)]'
                                } ${T.buttonPrimaryText}`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${formData.channelId === ch.id ? 'bg-[var(--brand-primary)] ' : 'bg-[var(--bg-elevated)] text-[color:var(--tx-helperText-color)]'} ${T.buttonPrimaryText}`}>
                                    <Send size={16} />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-[color:var(--tx-sectionTitle-color)]">{ch.name}</p>
                                    <p className="text-[10px] text-[color:var(--tx-helperText-color)]">{ch.displayPhone}</p>
                                </div>
                            </div>
                            {formData.channelId === ch.id && <CheckCircle2 size={16} className="text-[var(--brand-primary)]" />}
                        </div>
                    ))}
                    {channels.length === 0 && (
                        <p className="text-center py-4 text-[color:var(--tx-helperText-color)] text-xs italic">No hay canales conectados disponibles.</p>
                    )}
                </div>
            </div>
        </div>
    );

    const renderStep2 = () => {
        const filteredTemplates = templates.filter(t =>
            t.name.toLowerCase().includes(templateSearch.toLowerCase())
        );
        return (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <label className="block text-[10px] font-black text-[color:var(--tx-helperText-color)] uppercase tracking-widest">Selecciona una Plantilla de WhatsApp</label>

                {/* 🔍 Buscador por nombre */}
                <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--tx-helperText-color)] pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Buscar plantilla por nombre..."
                        value={templateSearch}
                        onChange={(e) => setTemplateSearch(e.target.value)}
                        className="w-full bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl py-2.5 pl-9 pr-4 text-xs text-[color:var(--tx-inputText-color)] outline-none focus:border-[var(--brand-primary)] transition-all font-bold"
                    />
                    {templateSearch && (
                        <button
                            onClick={() => setTemplateSearch('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--tx-helperText-color)] hover:text-[var(--brand-primary)] transition-colors text-[10px] font-bold"
                        >
                            ✕
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[340px] overflow-y-auto pr-2 custom-scrollbar">
                    {filteredTemplates.length > 0 ? filteredTemplates.map(tmpl => {
                        const tmplHasInputs = hasTemplateInputs(tmpl);
                        return (
                            <div
                                key={tmpl.id}
                                onClick={() => setFormData({ ...formData, templateId: tmpl.id })}
                                className={`p-4 border rounded-xl cursor-pointer transition-all flex flex-col gap-2 ${formData.templateId === tmpl.id ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5' : 'border-[var(--border-default)] bg-[var(--bg-card)] hover:border-[var(--brand-primary)]'
                                    } ${T.buttonPrimaryText}`}
                            >
                                <div className="flex justify-between items-start">
                                    <h4 className="text-[11px] font-black uppercase tracking-tight text-[color:var(--tx-sectionTitle-color)]">{tmpl.name}</h4>
                                    <div className="flex gap-1">
                                        {tmplHasInputs && (
                                            <span className={`text-[8px] bg-[var(--brand-primary)]/10 border border-[var(--brand-primary)]/20 px-1.5 py-0.5 rounded text-[var(--brand-primary)] font-bold ${T.buttonPrimaryText}`}>
                                                Personalizable
                                            </span>
                                        )}
                                        <span className="text-[8px] bg-[var(--bg-elevated)] px-1.5 py-0.5 rounded text-[color:var(--tx-helperText-color)] border border-[var(--border-default)] font-bold">{tmpl.language}</span>
                                    </div>
                                </div>
                                <p className="text-[10px] text-[color:var(--tx-helperText-color)] line-clamp-3 italic">
                                    {tmpl.components.find(c => c.type === 'BODY')?.text || 'Sin vista previa disponible'}
                                </p>
                            </div>
                        );
                    }) : (
                        <div className="col-span-2 flex flex-col items-center justify-center py-10 gap-2 text-[color:var(--tx-helperText-color)]">
                            <Search size={24} className="opacity-30" />
                            <p className="text-xs italic">No se encontraron plantillas con ese nombre.</p>
                        </div>
                    )}
                </div>

                {/* Info badge cuando la plantilla seleccionada no tiene inputs */}
                {formData.templateId && !hasInputs && (
                    <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                        <Info size={14} className="text-blue-500 flex-shrink-0" />
                        <p className="text-[10px] text-blue-600 dark:text-blue-300 font-bold">
                            Esta plantilla no tiene variables — se enviará tal como está al siguiente paso.
                        </p>
                    </div>
                )}
                {formData.templateId && hasInputs && (
                    <div className={`flex items-center gap-2 p-3 bg-[var(--brand-primary)]/10 border border-[var(--brand-primary)]/20 rounded-xl ${T.buttonPrimaryText}`}>
                        <Sliders size={14} className="text-[var(--brand-primary)] flex-shrink-0" />
                        <p className="text-[10px] text-[var(--brand-primary)] font-bold drop-shadow-sm">
                            Esta plantilla tiene {templateInputs.length} variable(s) — podrás configurarlas en el siguiente paso.
                        </p>
                    </div>
                )}
            </div>
        );
    };

    const renderStep3Personalize = () => {
        const completedInputs = templateInputs.filter(i => (inlineValues[i.id]?.trim()?.length || 0) > 0);
        const progress = templateInputs.length ? Math.round((completedInputs.length / templateInputs.length) * 100) : 0;
        const mediaInputs = templateInputs.filter(i => i.kind === 'MEDIA');

        return (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300 h-full flex flex-col">
                <div className="flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <Sliders size={16} className="text-[var(--brand-primary)]" />
                        <p className="text-[10px] font-black text-[color:var(--tx-helperText-color)] uppercase tracking-widest">
                            Personalización de Mensaje ({completedInputs.length} de {templateInputs.length} completas)
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setInlineValues({})}
                            className="text-[9px] font-bold text-[var(--brand-primary)] uppercase hover:underline"
                        >
                            Limpiar Todo
                        </button>
                        {progress === 100 && (
                            <div className="flex items-center gap-1.5 text-green-600 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20 font-bold">
                                <CheckCircle2 size={12} />
                                <span className="text-[9px] font-black uppercase tracking-wider">Completo</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-0 overflow-hidden w-full">
                    {mediaInputs.length > 0 && (
                        <div className="w-full md:w-[350px] flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar shrink-0">
                            {mediaInputs.map(input => (
                                <div key={input.id} className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-3 flex flex-col gap-2 shadow-sm">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-black text-[color:var(--tx-sectionTitle-color)] uppercase tracking-wider">
                                            Adjunto de Encabezado ({input.meta.format})
                                        </span>
                                        {((inlineValues[input.id]?.trim()?.length || 0) > 0) ? (
                                            <CheckCircle2 size={14} className="text-green-500" />
                                        ) : (
                                            <AlertCircle size={14} className="text-red-500" />
                                        )}
                                    </div>
                                    <div className="flex border border-[var(--border-default)] rounded-lg overflow-hidden bg-[var(--bg-input)]">
                                        <button
                                            onClick={() => setMediaInputType(prev => ({ ...prev, [input.id]: 'url' }))}
                                            className={`flex-1 py-1.5 text-[9px] font-bold uppercase tracking-wider transition-colors ${mediaInputType[input.id] !== 'upload' ? 'bg-[var(--brand-primary)] ' : 'text-[color:var(--tx-helperText-color)] hover:bg-[var(--bg-hover)]'} ${T.buttonPrimaryText}`}
                                        >
                                            URL Link
                                        </button>
                                        <button
                                            onClick={() => setMediaInputType(prev => ({ ...prev, [input.id]: 'upload' }))}
                                            className={`flex-1 py-1.5 text-[9px] font-bold uppercase tracking-wider flex justify-center items-center gap-1 transition-colors ${mediaInputType[input.id] === 'upload' ? 'bg-[var(--brand-primary)] ' : 'text-[color:var(--tx-helperText-color)] hover:bg-[var(--bg-hover)]'} ${T.buttonPrimaryText}`}
                                        >
                                            <UploadCloud size={10} />
                                            Subir Archivo
                                        </button>
                                    </div>
                                    <div className="pt-1">
                                        {mediaInputType[input.id] === 'upload' ? (
                                            <div>
                                                <label className="block border border-dashed border-[var(--border-default)] rounded-lg p-3 text-center cursor-pointer hover:border-[var(--brand-primary)] transition-colors bg-[var(--bg-input)]">
                                                    <UploadCloud size={16} className="text-[color:var(--tx-helperText-color)] mx-auto mb-1" />
                                                    <p className="text-[9px] text-[color:var(--tx-helperText-color)] font-bold">Click para seleccionar tu archivo Media</p>
                                                    <input
                                                        type="file"
                                                        className="hidden"
                                                        accept={input.meta.format === 'IMAGE' ? 'image/*' : input.meta.format === 'VIDEO' ? 'video/*' : '*/*'}
                                                        onChange={async (e) => {
                                                            const file = e.target.files?.[0];
                                                            if (file) {
                                                                try {
                                                                    const { uploadCampaignMedia } = await import('@/api/wabee/campaigns.api');
                                                                    updateInlineValue(input.id, 'Subiendo...');
                                                                    const res = await uploadCampaignMedia(file);
                                                                    updateInlineValue(input.id, res.id);
                                                                } catch (error: any) {
                                                                    console.error("Error al subir archivo", error);
                                                                    toastError(error.message || 'Error subiendo el archivo. Por favor intenta de nuevo.');
                                                                    updateInlineValue(input.id, '');
                                                                }
                                                            }
                                                        }}
                                                    />
                                                </label>
                                                {inlineValues[input.id] && mediaInputType[input.id] === 'upload' && (
                                                    <p className={`text-[10px] mt-2 font-bold flex items-center gap-1 ${inlineValues[input.id] === 'Subiendo...' ? 'text-[var(--brand-primary)]' : 'text-green-500'}`}>
                                                        {inlineValues[input.id] === 'Subiendo...' ? (
                                                            <>Subiendo archivo...</>
                                                        ) : (
                                                            <><CheckCircle2 size={10} /> Archivo adjuntado correctamente</>
                                                        )}
                                                    </p>
                                                )}
                                            </div>
                                        ) : (
                                            <input
                                                type="url"
                                                placeholder="Ingresa la URL pública de tu archivo (https://...)"
                                                value={inlineValues[input.id] || ''}
                                                onChange={(e) => updateInlineValue(input.id, e.target.value)}
                                                className="w-full bg-[var(--bg-input)] border border-[var(--border-default)] rounded-lg py-2 px-3 text-[10px] text-[color:var(--tx-inputText-color)] font-bold outline-none focus:border-[var(--brand-primary)]"
                                            />
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex-1 flex overflow-hidden min-h-0 w-full rounded-2xl border border-[var(--border-default)] relative shadow-inner bg-[var(--bg-card)]">
                        <div className="z-10 w-full flex items-center justify-center h-full">
                            <InlineTemplateEditor
                                template={selectedTemplate!}
                                inputs={templateInputs}
                                values={inlineValues}
                                onChange={updateInlineValue}
                                focusedId={focusedId}
                                templateInputMapping={generateMapping()}
                                tenantId={localStorage.getItem('wabee_orgId') || localStorage.getItem('tenant_key') || localStorage.getItem('orgId') || ''}
                                apiUrl={import.meta.env.VITE_API_URL || 'http://localhost:4000/v1'}
                            />
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderStep4Audience = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
                <label className="block text-[10px] font-black text-[color:var(--tx-helperText-color)] uppercase tracking-widest mb-3">Segmentación de Audiencia</label>
                <div className="flex gap-2 mb-6 p-1 bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-default)]">
                    {[
                        { id: 'ALL_ACTIVE', label: 'Todos', icon: Users },
                        { id: 'SEGMENT', label: 'Segmento', icon: Target },
                        { id: 'GROUP', label: 'Grupo', icon: Layout },
                        { id: 'TAGS', label: 'Etiquetas', icon: Target },
                    ].map(type => (
                        <button
                            key={type.id}
                            onClick={() => setFormData({ ...formData, audienceType: type.id as any, audienceFilter: {} })}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-bold transition-all ${formData.audienceType === type.id ? 'bg-[var(--brand-primary)]  shadow-md' : 'text-[color:var(--tx-helperText-color)] hover:text-[var(--brand-primary)]'
                                } ${T.buttonPrimaryText}`}
                        >
                            <type.icon size={12} />
                            {type.label}
                        </button>
                    ))}
                </div>

                {formData.audienceType === 'SEGMENT' && (
                    <select
                        className="w-full bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl py-3 px-4 text-sm text-[color:var(--tx-inputText-color)] font-bold outline-none cursor-pointer"
                        onChange={(e) => setFormData({ ...formData, audienceFilter: { segmentId: e.target.value } })}
                    >
                        <option className="bg-[var(--bg-card)]" value="">Selecciona un segmento guardado</option>
                        {segments.map(s => <option className="bg-[var(--bg-card)]" key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                )}

                {formData.audienceType === 'GROUP' && (
                    <select
                        className="w-full bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl py-3 px-4 text-sm text-[color:var(--tx-inputText-color)] font-bold outline-none cursor-pointer"
                        onChange={(e) => setFormData({ ...formData, audienceFilter: { groupId: e.target.value } })}
                    >
                        <option className="bg-[var(--bg-card)]" value="">Selecciona un grupo</option>
                        {groups.map(g => <option className="bg-[var(--bg-card)]" key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                )}

                {formData.audienceType === 'TAGS' && (
                    <input
                        type="text"
                        placeholder="Escribe etiquetas separadas por coma..."
                        className="w-full bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl py-3 px-4 text-sm text-[color:var(--tx-inputText-color)] font-bold outline-none focus:border-[var(--brand-primary)] font-bold"
                        onChange={(e) => setFormData({ ...formData, audienceFilter: { tags: e.target.value.split(',').map(t => t.trim()) } })}
                    />
                )}
            </div>

            <div>
                <label className="block text-[10px] font-black text-[color:var(--tx-helperText-color)] uppercase tracking-widest mb-3">Programación (Opcional)</label>
                <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--tx-helperText-color)]" size={16} />
                    <input
                        type="datetime-local"
                        value={formData.scheduledAt}
                        onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                        className="w-full bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl py-3 pl-12 pr-4 text-sm text-[color:var(--tx-inputText-color)] font-bold outline-none focus:border-[var(--brand-primary)] cursor-pointer"
                    />
                </div>
                <p className="text-[10px] text-[color:var(--tx-helperText-color)] mt-2 italic font-bold">Deja vacío para crear como borrador o iniciar manualmente.</p>
            </div>
        </div>
    );

    // ─── Progress bar segments ────────────────────────────────────────────────
    const progressSegments = hasInputs ? [1, 2, 3, 4] : [1, 2, 4]; // 4 steps or skip 3

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <div className="bg-[var(--bg-card)] border border-[var(--border-default)] w-full max-w-4xl rounded-[32px] overflow-hidden shadow-2xl flex flex-col h-[680px] animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-6 border-b border-[var(--border-default)] flex items-center justify-between bg-[var(--bg-elevated)]">
                    <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 bg-[var(--brand-primary)] rounded-xl flex items-center justify-center shadow-lg rotate-2 ${T.buttonPrimaryText}`}>
                            <Send size={18} className="text-[var(--brand-primary-foreground)]" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-[color:var(--tx-sectionTitle-color)] italic leading-tight">Constructor de Campaña</h2>
                            <p className="text-[8px] font-black text-[var(--brand-primary)] uppercase tracking-[0.2em]">
                                Paso {visualStep()} de {totalSteps} • {stepLabel()}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-[var(--bg-hover)] rounded-full text-[color:var(--tx-helperText-color)] transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Progress Bar */}
                <div className="h-1 bg-[var(--bg-input)] flex gap-0.5">
                    {progressSegments.map((s) => (
                        <div
                            key={s}
                            className={`h-full flex-1 transition-all duration-500 ${step >= s ? 'bg-[var(--brand-primary)]' : 'bg-transparent'} ${T.buttonPrimaryText}`}
                        />
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    {step === STEP_CONFIG && renderStep1()}
                    {step === STEP_TEMPLATE && renderStep2()}
                    {step === STEP_PERSONALIZE && renderStep3Personalize()}
                    {step === STEP_AUDIENCE && renderStep4Audience()}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-[var(--border-default)] flex gap-3 bg-[var(--bg-elevated)]">
                    {step > STEP_CONFIG && (
                        <button
                            onClick={prevStep}
                            className="px-5 py-2 border border-[var(--border-default)] text-[color:var(--tx-helperText-color)] rounded-xl hover:text-[color:var(--tx-buttonText-color)] bg-[var(--bg-card)] hover:border-[var(--brand-primary)] transition-all flex items-center gap-1.5 font-bold text-[10px]"
                        >
                            <ChevronLeft size={14} /> Atrás
                        </button>
                    )}
                    <div className="flex-1" />
                    <button
                        onClick={isLastStep ? handleSubmit : nextStep}
                        disabled={isNextDisabled() || loading}
                        className={`px-8 py-2 bg-[var(--brand-primary)]  rounded-xl hover:brightness-110 transition-all font-black uppercase tracking-widest text-[10px] flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-[#ead018]/10 ${T.buttonPrimaryText}`}
                    >
                        {loading ? 'Guardando...' : isLastStep ? 'Finalizar y Guardar' : 'Siguiente'}
                        {!loading && !isLastStep && <ChevronRight size={14} />}
                        {!loading && isLastStep && <CheckCircle2 size={14} />}
                    </button>
                </div>
            </div>
        </div>
    );
}
