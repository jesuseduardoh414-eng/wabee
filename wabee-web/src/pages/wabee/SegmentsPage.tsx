import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { contactsApi } from '@/api/wabee/contacts.api';
import {
    Plus,
    Users,
    Filter,
    Search,
    Trash2,
    ChevronDown,
    ArrowRight,
    Tag,
    Layers,
    PlusCircle,
    Play,
    Calendar
} from 'lucide-react';
import { CreateSegmentModal } from './contacts/components/CreateSegmentModal';
import { useToast } from '@/context/ToastContext';
import { useDialog } from '@/context/DialogContext';
import { T, S } from '@/lib/text-tokens';

const SegmentsPage: React.FC = () => {
    const navigate = useNavigate();
    const [segments, setSegments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingSegment, setEditingSegment] = useState<any>(null);
    const { error: toastError, success: toastSuccess } = useToast();
    const { confirm } = useDialog();

    const loadSegments = async () => {
        setLoading(true);
        try {
            const data = await contactsApi.listSegments();
            setSegments(data);
        } catch (error) {
            console.error('Error loading segments:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSegments();
    }, []);

    const handleDeleteSegment = async (id: string) => {
        const isConfirmed = await confirm({
            title: 'Eliminar Segmento',
            description: '¿Estás seguro de eliminar este segmento dinámico?',
            isDestructive: true,
            confirmText: 'Eliminar'
        });
        if (!isConfirmed) return;

        try {
            await contactsApi.deleteSegment(id);
            toastSuccess('Segmento eliminado con éxito');
            loadSegments();
        } catch (error: any) {
            toastError(error.message || 'Error al eliminar el segmento');
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-10 bg-[var(--bg-page)] min-h-screen">
            <header className="flex justify-between items-end gap-6 mb-4">
                <div className="space-y-2">
                    <h1 className={`${T.pageTitle} ${S.displayMd} italic flex items-center gap-4`}>
                        <Layers size={48} className="text-[var(--brand-primary)]" /> Segmentación <span className="text-[var(--brand-primary)]">Inteligente</span>
                    </h1>
                    <p className={`${T.pageSubtitle} ${S.body} max-w-md`}>Filtros dinámicos que se actualizan automáticamente según tus reglas de negocio definidas.</p>
                </div>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className={`${T.buttonPrimaryText} ${S.meta} bg-[var(--brand-primary)] px-8 py-3 rounded-2xl shadow-xl hover:brightness-110 transition-all active:scale-95 flex items-center gap-2`}
                >
                    <PlusCircle size={18} />
                    Nuevo Segmento
                </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {loading && (
                    <div className="col-span-full py-32 flex flex-col items-center gap-6">
                        <div className="w-16 h-16 border-4 border-[var(--brand-primary)]/10 border-t-[var(--brand-primary)] rounded-full animate-spin"></div>
                        <p className={`${T.helperText} ${S.meta} uppercase animate-pulse`}>Sincronizando Algoritmos...</p>
                    </div>
                )}

                {!loading && segments.length === 0 && (
                    <div className="col-span-full py-32 text-center bg-[var(--bg-elevated)] rounded-[40px] border border-[var(--border-default)] shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-[var(--brand-primary)]/5 blur-[100px] pointer-events-none"></div>
                        <Filter className="h-20 w-20 mx-auto mb-6 text-[var(--border-default)] transition-colors" />
                        <h3 className={`${T.emptyStateTitle} ${S.headingMd} mb-3 italic`}>Zona Desértica</h3>
                        <p className={`${T.emptyStateBody} ${S.body} max-w-xs mx-auto mb-8`}>No se han detectado reglas de segmentación en este entorno. Comienza a definir tu audiencia.</p>
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className={`${T.buttonText} ${S.meta} bg-[var(--bg-card)] px-10 py-3 rounded-2xl border border-[var(--brand-primary)]/20 hover:bg-[var(--bg-muted)] transition-all flex items-center justify-center mx-auto`}
                        >
                            Comenzar ahora
                        </button>
                    </div>
                )}

                {segments.map(s => (
                    <div key={s.id} className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-[32px] hover:border-[var(--brand-primary)]/40 transition-all group overflow-hidden relative flex flex-col shadow-2xl active:scale-[0.98]">
                        <div className="p-8 pb-4">
                            <div className="flex justify-between items-start mb-8">
                                <div className="bg-[var(--bg-muted)] p-4 rounded-2xl text-[var(--brand-primary)] border border-[var(--border-default)] shadow-inner group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
                                    <Layers size={28} strokeWidth={2.5} />
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setEditingSegment(s)}
                                        className="p-3 text-[color:var(--tx-helperText-color)] hover:text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/10 rounded-xl transition-all"
                                        title="Editar Segmento"
                                    >
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                    </button>
                                    <button
                                        onClick={() => handleDeleteSegment(s.id)}
                                        className="p-3 text-[color:var(--tx-helperText-color)] hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                                        title="Eliminar Segmento"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            </div>

                            <h3 className={`${T.cardTitle} ${S.headingMd} mb-2 italic group-hover:text-[var(--brand-primary)] transition-colors`}>{s.name}</h3>
                            <p className={`${T.messageText} ${S.body} mb-8 line-clamp-2 h-10 leading-relaxed`}>{s.description || 'Procesamiento de datos sin descripción extendida.'}</p>

                            <div className="flex flex-wrap gap-3 mb-8">
                                {s.filter?.lifecycleStatus && (
                                    <div className={`${T.badgeText} ${S.meta} flex items-center gap-2 uppercase text-[var(--brand-primary)] bg-[var(--brand-primary)]/5 px-3 py-1.5 rounded-lg border border-[var(--brand-primary)]/10 overflow-hidden relative group/tag`}>
                                        <div className="absolute inset-y-0 left-0 w-[2px] bg-[var(--brand-primary)]"></div>
                                        Etapa: {s.filter.lifecycleStatus}
                                    </div>
                                )}
                                {s.filter?.tag && (
                                    <div className={`${T.badgeText} ${S.meta} flex items-center gap-2 uppercase text-blue-400 bg-blue-500/5 px-3 py-1.5 rounded-lg border border-blue-500/10 overflow-hidden relative`}>
                                        <div className="absolute inset-y-0 left-0 w-[2px] bg-blue-400"></div>
                                        Query: {s.filter.tag}
                                    </div>
                                )}
                                {s.filter?.search && (
                                    <div className={`${T.badgeText} ${S.meta} flex items-center gap-2 uppercase text-emerald-400 bg-emerald-500/5 px-3 py-1.5 rounded-lg border border-emerald-500/10 overflow-hidden relative`}>
                                        <div className="absolute inset-y-0 left-0 w-[2px] bg-emerald-400"></div>
                                        Match: "{s.filter.search}"
                                    </div>
                                )}
                            </div>

                            <div className={`${T.helperText} ${S.meta} flex items-center gap-4 uppercase mt-auto border-t border-[var(--border-default)] pt-6`}>
                                <div className="flex items-center gap-2">
                                    <Calendar size={14} className="text-[var(--brand-primary)]" />
                                    Generado: <span className="font-bold not-italic">{new Date(s.createdAt).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </div>

                        <div className="p-6">
                            <button
                                onClick={() => navigate(`/dashboard/wabee/contacts?segmentId=${s.id}`)}
                                className={`${T.buttonPrimaryText} ${S.meta} w-full flex items-center justify-center gap-3 py-4 bg-[var(--brand-primary)] uppercase rounded-2xl hover:brightness-110 active:scale-95 transition-all shadow-lg`}
                            >
                                <Play size={16} fill="currentColor" /> Ejecutar Visión
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Pagination / Footer placeholder if needed */}
            <footer className="mt-12 pt-8 border-t border-[var(--border-default)] flex justify-between items-center px-4">
                <div className={`${T.helperText} ${S.meta} uppercase italic opacity-60`}>WABEE CORE V2 // Engine</div>
                <div className="h-1 w-32 bg-[var(--bg-muted)] rounded-full overflow-hidden">
                    <div className="h-full bg-[var(--brand-primary)] w-1/3"></div>
                </div>
            </footer>

            {(isCreateModalOpen || editingSegment) && (
                <CreateSegmentModal
                    initialData={editingSegment}
                    onClose={() => {
                        setIsCreateModalOpen(false);
                        setEditingSegment(null);
                    }}
                    onSuccess={() => loadSegments()}
                />
            )}
        </div>
    );
};

export default SegmentsPage;
