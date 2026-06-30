import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TourButton } from '../../components/TourButton';
import { contactsApi } from '@/api/wabee/contacts.api';
import { Filter, Trash2, Layers, PlusCircle, Play, Calendar } from 'lucide-react';
import { CreateSegmentModal } from './contacts/components/CreateSegmentModal';
import { useToast } from '@/context/ToastContext';
import { useDialog } from '@/context/DialogContext';
import { T, S } from '@/lib/text-tokens';

const COPY = {
    title: 'Segmentos',
    highlight: '',
    subtitle: 'Agrupa contactos automáticamente según tus reglas (etapa o etiquetas).',
    newSegment: 'Nuevo segmento',
    loading: 'Cargando…',
    emptyTitle: 'Aún no tienes segmentos',
    emptyBody: 'Crea tu primer segmento para agrupar contactos por etapa o etiquetas.',
    startNow: 'Crear segmento',
    editTitle: 'Editar segmento',
    deleteTitle: 'Eliminar segmento',
    noDescription: 'Sin descripción.',
    stage: 'Etapa',
    query: 'Filtro',
    match: 'Coinciden',
    generated: 'Creado',
    execute: 'Ejecutar',
    footer: '',
    confirmTitle: 'Eliminar segmento',
    confirmDescription: '¿Eliminar este segmento?',
    confirmButton: 'Eliminar',
    deleted: 'Segmento eliminado',
    deleteError: 'Error al eliminar el segmento',
} as const;

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
            title: COPY.confirmTitle,
            description: COPY.confirmDescription,
            isDestructive: true,
            confirmText: COPY.confirmButton
        });
        if (!isConfirmed) return;

        try {
            await contactsApi.deleteSegment(id);
            toastSuccess(COPY.deleted);
            loadSegments();
        } catch (error: any) {
            toastError(error.message || COPY.deleteError);
        }
    };

    return (
        <div className="mx-auto min-h-screen max-w-7xl space-y-8 bg-[var(--bg-page)] px-4 py-6 sm:space-y-10 sm:px-6 sm:py-8 lg:px-8">
            <header className="mb-2 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl space-y-3">
                    <h1 className={`${T.pageTitle} ${S.displayMd} flex items-center gap-3 sm:gap-4`}>
                        <Layers size={34} className="shrink-0 text-[var(--brand-primary)] sm:size-[48px]" />
                        <span className="leading-tight">{COPY.title}</span>
                    </h1>
                    <p className={`${T.pageSubtitle} ${S.body} max-w-xl`}>{COPY.subtitle}</p>
                </div>
                <div className="flex items-center gap-2">
                    <TourButton moduleKey="segments" />
                    <button
                        data-tour="segments-create"
                        onClick={() => setIsCreateModalOpen(true)}
                        className={`${T.buttonPrimaryText} ${S.meta} flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--brand-primary)] px-6 py-3 shadow-xl transition-all hover:brightness-110 active:scale-95 sm:w-auto sm:px-8`}
                    >
                        <PlusCircle size={18} />
                        {COPY.newSegment}
                    </button>
                </div>
            </header>

            <div data-tour="segments-list" className="grid grid-cols-1 gap-5 sm:gap-6 md:grid-cols-2 xl:grid-cols-3">
                {loading && (
                    <div className="col-span-full flex flex-col items-center gap-6 py-24 sm:py-32">
                        <div className="h-16 w-16 animate-spin rounded-full border-4 border-[var(--brand-primary)]/10 border-t-[var(--brand-primary)]"></div>
                        <p className={`${T.helperText} ${S.meta} uppercase animate-pulse`}>{COPY.loading}</p>
                    </div>
                )}

                {!loading && segments.length === 0 && (
                    <div className="relative col-span-full overflow-hidden rounded-[32px] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-6 py-20 text-center shadow-2xl sm:rounded-[40px] sm:px-8 sm:py-24">
                        <div className="pointer-events-none absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 bg-[var(--brand-primary)]/5 blur-[100px]"></div>
                        <Filter className="mx-auto mb-6 h-16 w-16 text-[var(--border-default)] transition-colors sm:h-20 sm:w-20" />
                        <h3 className={`${T.emptyStateTitle} ${S.headingMd} mb-3 italic`}>{COPY.emptyTitle}</h3>
                        <p className={`${T.emptyStateBody} ${S.body} mx-auto mb-8 max-w-xs`}>{COPY.emptyBody}</p>
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className={`${T.buttonText} ${S.meta} mx-auto flex items-center justify-center rounded-2xl border border-[var(--brand-primary)]/20 bg-[var(--bg-card)] px-8 py-3 transition-all hover:bg-[var(--bg-muted)] sm:px-10`}
                        >
                            {COPY.startNow}
                        </button>
                    </div>
                )}

                {segments.map((s) => (
                    <article
                        key={s.id}
                        className="group relative flex flex-col overflow-hidden rounded-[28px] border border-[var(--border-default)] bg-[var(--bg-card)] shadow-2xl transition-all hover:border-[var(--brand-primary)]/40 active:scale-[0.98] sm:rounded-[32px]"
                    >
                        <div className="flex flex-1 flex-col p-5 pb-4 sm:p-6 md:p-8 md:pb-4">
                            <div className="mb-6 flex items-start justify-between gap-4 sm:mb-8">
                                <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-muted)] p-3 text-[var(--brand-primary)] shadow-inner transition-all duration-500 group-hover:scale-110 group-hover:rotate-6 sm:p-4">
                                    <Layers size={24} strokeWidth={2.5} className="sm:size-[28px]" />
                                </div>
                                <div className="flex items-center gap-1.5 sm:gap-2">
                                    <button
                                        onClick={() => setEditingSegment(s)}
                                        className="rounded-xl p-2.5 text-[color:var(--tx-helperText-color)] transition-all hover:bg-[var(--brand-primary)]/10 hover:text-[var(--brand-primary)] sm:p-3"
                                        title={COPY.editTitle}
                                    >
                                        <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                    </button>
                                    <button
                                        onClick={() => handleDeleteSegment(s.id)}
                                        className="rounded-xl p-2.5 text-[color:var(--tx-helperText-color)] transition-all hover:bg-red-500/10 hover:text-red-500 sm:p-3"
                                        title={COPY.deleteTitle}
                                    >
                                        <Trash2 size={18} className="sm:size-5" />
                                    </button>
                                </div>
                            </div>

                            <h3 className={`${T.cardTitle} ${S.headingMd} mb-2 italic transition-colors group-hover:text-[var(--brand-primary)] break-words`}>
                                {s.name}
                            </h3>
                            <p className={`${T.messageText} ${S.body} mb-6 min-h-[3rem] leading-relaxed sm:mb-8`}>
                                {s.description || COPY.noDescription}
                            </p>

                            <div className="mb-6 flex flex-wrap gap-2.5 sm:mb-8 sm:gap-3">
                                {s.filter?.lifecycleStatus && (
                                    <div className={`${T.badgeText} ${S.meta} relative overflow-hidden rounded-lg border border-[var(--brand-primary)]/10 bg-[var(--brand-primary)]/5 px-3 py-1.5 uppercase text-[var(--brand-primary)]`}>
                                        <div className="absolute inset-y-0 left-0 w-[2px] bg-[var(--brand-primary)]"></div>
                                        {COPY.stage}: {Array.isArray(s.filter.lifecycleStatus) ? s.filter.lifecycleStatus.join(', ') : s.filter.lifecycleStatus}
                                    </div>
                                )}
                                {s.filter?.tag && (
                                    <div className={`${T.badgeText} ${S.meta} relative overflow-hidden rounded-lg border border-blue-500/10 bg-blue-500/5 px-3 py-1.5 uppercase text-blue-400`}>
                                        <div className="absolute inset-y-0 left-0 w-[2px] bg-blue-400"></div>
                                        {COPY.query}: {s.filter.tag}
                                    </div>
                                )}
                                {s.filter?.search && (
                                    <div className={`${T.badgeText} ${S.meta} relative overflow-hidden rounded-lg border border-emerald-500/10 bg-emerald-500/5 px-3 py-1.5 uppercase text-emerald-400`}>
                                        <div className="absolute inset-y-0 left-0 w-[2px] bg-emerald-400"></div>
                                        {COPY.match}: "{s.filter.search}"
                                    </div>
                                )}
                            </div>

                            <div className={`${T.helperText} ${S.meta} mt-auto flex items-center gap-2 border-t border-[var(--border-default)] pt-5 uppercase sm:gap-4 sm:pt-6`}>
                                <Calendar size={14} className="shrink-0 text-[var(--brand-primary)]" />
                                <span className="min-w-0">
                                    {COPY.generated}: <span className="font-bold not-italic">{new Date(s.createdAt).toLocaleDateString()}</span>
                                </span>
                            </div>
                        </div>

                        <div className="p-5 pt-0 sm:p-6 sm:pt-0">
                            <button
                                onClick={() => navigate(`/dashboard/wabee/contacts?segmentId=${s.id}`)}
                                className={`${T.buttonPrimaryText} ${S.meta} flex w-full items-center justify-center gap-3 rounded-2xl bg-[var(--brand-primary)] py-4 uppercase shadow-lg transition-all hover:brightness-110 active:scale-95`}
                            >
                                <Play size={16} fill="currentColor" /> {COPY.execute}
                            </button>
                        </div>
                    </article>
                ))}
            </div>

            <footer className="mt-8 flex flex-col gap-4 border-t border-[var(--border-default)] px-2 pt-6 sm:mt-12 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:pt-8">
                <div className={`${T.helperText} ${S.meta} uppercase italic opacity-60`}>{COPY.footer}</div>
                <div className="h-1 w-full max-w-[8rem] overflow-hidden rounded-full bg-[var(--bg-muted)] sm:w-32">
                    <div className="h-full w-1/3 bg-[var(--brand-primary)]"></div>
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
