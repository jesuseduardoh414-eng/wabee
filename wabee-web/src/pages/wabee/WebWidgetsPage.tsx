import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { webWidgetApi, WebWidget } from '@/api/wabee/webwidget.api';
import { PlusIcon, GlobeAltIcon, EyeIcon } from '@heroicons/react/24/outline';
import { useToast } from '@/context/ToastContext';

const WebWidgetsPage: React.FC = () => {
    const navigate = useNavigate();
    const [widgets, setWidgets] = useState<WebWidget[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newData, setNewData] = useState({
        title: 'Soporte WABEE',
        subtitle: 'Habla con nosotros',
        welcomeMessage: '¡Hola! ¿En qué podemos ayudarte hoy?',
    });

    const { error: toastError, success: toastSuccess } = useToast();

    const loadWidgets = async () => {
        setLoading(true);
        try {
            const data = await webWidgetApi.listWidgets();
            setWidgets(data);
        } catch (error) {
            console.error('Error loading widgets:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadWidgets();
    }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await webWidgetApi.createWidget(newData);
            setIsCreateModalOpen(false);
            loadWidgets();
            toastSuccess('Widget creado correctamente');
        } catch (error: any) {
            toastError(error.message || 'Error al crear widget');
        }
    };

    return (
        <div className="p-10 max-w-7xl mx-auto space-y-10 selection:bg-[#ead018]/30">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                    <h1 className="text-5xl font-black text-white tracking-tighter uppercase italic">Web <span className="text-[#ead018]">Widgets</span></h1>
                    <p className="text-[#a0a080] mt-2 font-medium">Integra WABEE en tu sitio web con widgets inteligentes y personalizados.</p>
                </div>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="bg-[#ead018] hover:brightness-110 text-[#121208] px-6 py-3.5 rounded-2xl font-black uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-[#ead018]/10 transition-all active:scale-95 transition-all"
                >
                    <PlusIcon className="h-5 w-5 stroke-[3px]" />
                    Nuevo Widget
                </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {loading && (
                    <div className="col-span-full py-32 flex flex-col items-center justify-center gap-4">
                        <div className="animate-spin rounded-full h-10 w-10 border-2 border-t-[#ead018] border-transparent"></div>
                        <span className="text-[#a0a080] text-[10px] font-black tracking-widest uppercase">Escaneando Widgets...</span>
                    </div>
                )}
                {!loading && widgets.length === 0 && (
                    <div className="col-span-full py-32 text-center bg-[#1c1c10] rounded-3xl border border-dashed border-[#2a2a1a] flex flex-col items-center">
                        <GlobeAltIcon className="h-16 w-16 text-[#a0a080]/20 mb-6" />
                        <p className="text-[#a0a080] font-bold uppercase tracking-widest text-xs">No tienes widgets web creados aún.</p>
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="mt-6 text-[#ead018] font-black uppercase tracking-widest text-[10px] hover:underline"
                        >
                            + CREAR MI PRIMER WIDGET
                        </button>
                    </div>
                )}
                {widgets.map(w => (
                    <div key={w.id} className="bg-[#1c1c10] p-8 rounded-[32px] border border-[#2a2a1a] shadow-2xl hover:border-[#ead018]/30 transition-all group relative overflow-hidden">
                        {/* Interactive glow effect */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[#ead018]/5 blur-[60px] pointer-events-none group-hover:bg-[#ead018]/10 transition-colors"></div>

                        <div className="flex justify-between items-start mb-6">
                            <div className="bg-[#ead018]/10 p-3 rounded-2xl text-[#ead018] border border-[#ead018]/20 group-hover:bg-[#ead018] group-hover:text-[#121208] transition-all duration-500">
                                <GlobeAltIcon className="h-6 w-6 stroke-[2px]" />
                            </div>
                            <div className="px-3 py-1 bg-[#0a0a05] rounded-full border border-[#2a2a1a]">
                                <span className="text-[9px] font-black text-[#505040] uppercase tracking-tighter">ID: {w.id.slice(0, 8)}</span>
                            </div>
                        </div>

                        <h3 className="text-2xl font-black text-white mb-2 tracking-tight transition-colors group-hover:text-[#ead018]">{w.title}</h3>
                        <p className="text-sm text-[#a0a080] mb-8 line-clamp-2 font-medium italic">"{w.welcomeMessage || 'Sin mensaje de bienvenida'}"</p>

                        <div className="bg-[#0a0a05] p-5 rounded-2xl mb-8 text-[11px] font-mono text-[#a0a080] break-all overflow-hidden relative group/code border border-[#2a2a1a] shadow-inner">
                            <div className="font-black mb-2 text-[#ead018] uppercase tracking-widest text-[9px]">Código de integración</div>
                            <code className="opacity-60 group-hover/code:opacity-100 transition-opacity">
                                {`<script>
  window.WabeeWidgetConfig = {
    widgetId: "${w.id}"
  };
</script>
<script src="${(window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' && (import.meta.env.VITE_API_URL || 'http://localhost:4000/v1').includes('localhost')) ? 'https://TU_BACKEND' : (import.meta.env.VITE_API_URL || 'http://localhost:4000/v1').replace(/\/v1\/?$/, '')}/v1/wabee-widget.js"></script>`}
                            </code>
                            <button
                                onClick={() => {
                                    const code = `<script>
  window.WabeeWidgetConfig = {
    widgetId: "${w.id}"
  };
</script>
<script src="${(window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' && (import.meta.env.VITE_API_URL || 'http://localhost:4000/v1').includes('localhost')) ? 'https://TU_BACKEND' : (import.meta.env.VITE_API_URL || 'http://localhost:4000/v1').replace(/\/v1\/?$/, '')}/v1/wabee-widget.js"></script>`;
                                    navigator.clipboard.writeText(code);
                                    toastSuccess('Código copiado al portapapeles');
                                }}
                                className="absolute top-4 right-4 bg-[#ead018] text-[#121208] border-none shadow-xl px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest opacity-0 hover:scale-105 active:scale-95 group-hover/code:opacity-100 transition-all cursor-pointer"
                            >
                                COPIAR
                            </button>
                        </div>

                        <div className="pt-6 border-t border-[#2a2a1a] flex gap-3">
                            <button
                                onClick={() => navigate(`/dashboard/wabee/widgets`)}
                                className="flex-1 bg-[#1c1c10] hover:bg-[#2a2a1a] text-[#ead018] font-black text-xs uppercase tracking-widest py-3.5 rounded-2xl flex items-center justify-center gap-2 border border-[#ead018]/20 transition-all active:scale-95 shadow-lg"
                            >
                                <EyeIcon className="h-4 w-4 stroke-[3px]" />
                                Abrir Constructor
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* CREATE MODAL */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#0a0a05]/80 backdrop-blur-xl animate-in fade-in duration-300">
                    <div className="bg-[#1c1c10] border border-[#2a2a1a] rounded-[40px] w-full max-w-lg shadow-2xl shadow-black/80 overflow-hidden p-10 space-y-8 relative">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#ead018] to-transparent"></div>

                        <div className="space-y-2">
                            <h2 className="text-4xl font-black text-white tracking-tighter uppercase italic">Nuevo <span className="text-[#ead018]">Widget</span></h2>
                            <p className="text-[#a0a080] text-sm font-medium">Define los parámetros básicos para tu nuevo asistente web.</p>
                        </div>

                        <form onSubmit={handleCreate} className="space-y-6">
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-[#a0a080] uppercase tracking-widest px-1">Título del Widget</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ej: Soporte VIP WABEE"
                                    value={newData.title}
                                    onChange={e => setNewData({ ...newData, title: e.target.value })}
                                    className="w-full px-5 py-4 bg-[#0a0a05] border border-[#2a2a1a] text-white rounded-2xl outline-none focus:ring-2 focus:ring-[#ead018]/50 focus:border-[#ead018] transition-all placeholder:text-[#a0a080] font-medium"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-[#a0a080] uppercase tracking-widest px-1">Subtítulo (Opcional)</label>
                                <input
                                    type="text"
                                    placeholder="Ej: Chat en vivo 24/7"
                                    value={newData.subtitle}
                                    onChange={e => setNewData({ ...newData, subtitle: e.target.value })}
                                    className="w-full px-5 py-4 bg-[#0a0a05] border border-[#2a2a1a] text-white rounded-2xl outline-none focus:ring-2 focus:ring-[#ead018]/50 focus:border-[#ead018] transition-all placeholder:text-[#a0a080] font-medium"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-[#a0a080] uppercase tracking-widest px-1">Mensaje de Bienvenida</label>
                                <textarea
                                    required
                                    placeholder="¡Hola! ¿Cómo podemos ayudarte hoy?"
                                    value={newData.welcomeMessage}
                                    onChange={e => setNewData({ ...newData, welcomeMessage: e.target.value })}
                                    className="w-full px-5 py-4 bg-[#0a0a05] border border-[#2a2a1a] text-white rounded-2xl outline-none focus:ring-2 focus:ring-[#ead018]/50 focus:border-[#ead018] transition-all placeholder:text-[#a0a080] h-32 font-medium resize-none shadow-inner"
                                />
                            </div>
                            <div className="pt-8 flex gap-4">
                                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="flex-1 py-4 text-[#a0a080] font-black uppercase tracking-widest text-[11px] hover:text-white transition-colors">Cancelar</button>
                                <button type="submit" className="flex-1 py-4 bg-[#ead018] text-[#121208] rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-lg shadow-[#ead018]/10 hover:brightness-110 active:scale-95 transition-all">Crear Widget</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WebWidgetsPage;
