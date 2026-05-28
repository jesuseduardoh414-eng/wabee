import React, { useEffect, useState } from 'react';
import { getChannels, sendMessageBulk, Channel } from '@/api/wabee/whatsapp.api';

interface SendWhatsAppModalProps {
    contactId: string;
    contactPhone: string;
    contactName?: string;
    onClose: () => void;
    onSuccess: () => void;
}

export const SendWhatsAppModal: React.FC<SendWhatsAppModalProps> = ({
    contactId,
    contactPhone,
    contactName,
    onClose,
    onSuccess
}) => {
    const [channels, setChannels] = useState<Channel[]>([]);
    const [selectedChannelId, setSelectedChannelId] = useState('');
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [useTemplate, setUseTemplate] = useState(false);
    const [templateName, setTemplateName] = useState('hello_world');

    useEffect(() => {
        const loadChannels = async () => {
            try {
                const data = await getChannels();
                setChannels(data.filter(c => c.status === 'CONNECTED'));
                if (data.length > 0) {
                    setSelectedChannelId(data[0].id);
                }
            } catch (err) {
                console.error('Error loading channels:', err);
            }
        };
        loadChannels();
    }, []);

    const handleSend = async () => {
        if (!selectedChannelId) {
            setError('Selecciona un canal de WhatsApp');
            return;
        }

        if (!text && !useTemplate) {
            setError('Escribe un mensaje o activa el modo plantilla');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const params: any = {
                channelId: selectedChannelId,
                contactIds: [contactId]
            };

            if (useTemplate) {
                params.template = {
                    name: templateName,
                    language: { code: 'es_MX' } // Default for demo
                };
            } else {
                params.text = text;
            }

            const report = await sendMessageBulk(params);

            if (report.failed > 0) {
                const result = report.results[0];
                setError(result.errorMessage || 'Error al enviar mensaje');
            } else {
                onSuccess();
                onClose();
            }
        } catch (err: any) {
            setError(err.message || 'Error inesperado al enviar');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <header className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Enviar WhatsApp</h2>
                        <p className="text-xs text-gray-500 mt-0.5">A: {contactName || contactPhone}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition shadow-sm">
                        <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </header>

                <div className="p-6 space-y-4">
                    {/* Canal Selector */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Canal de WhatsApp</label>
                        <select
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition"
                            value={selectedChannelId}
                            onChange={(e) => setSelectedChannelId(e.target.value)}
                        >
                            {channels.length === 0 && <option value="">No hay canales conectados</option>}
                            {channels.map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.name} ({c.displayPhone || 'Sin número'})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Toggle Template */}
                    <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                        <input
                            type="checkbox"
                            id="use-template"
                            className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                            checked={useTemplate}
                            onChange={(e) => setUseTemplate(e.target.checked)}
                        />
                        <label htmlFor="use-template" className="text-sm font-semibold text-blue-900 cursor-pointer">
                            Usar Plantilla (Meta Template)
                        </label>
                    </div>

                    {!useTemplate ? (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Mensaje de Texto</label>
                            <textarea
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition min-h-[120px]"
                                placeholder="Escribe tu mensaje aquí..."
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                            />
                            <p className="text-[10px] text-gray-400 mt-2 italic">
                                * Nota: Solo funcionará si la ventana de 24h está abierta.
                            </p>
                        </div>
                    ) : (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Nombre de la Plantilla</label>
                            <input
                                type="text"
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition"
                                value={templateName}
                                onChange={(e) => setTemplateName(e.target.value)}
                            />
                            <p className="text-[10px] text-blue-500 mt-2 font-medium">
                                Recomendado para iniciar conversaciones o ventanas cerradas.
                            </p>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-50 border border-red-100 text-red-600 p-3 rounded-xl text-xs font-medium flex gap-2 items-center animate-shake">
                            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            {error}
                        </div>
                    )}
                </div>

                <footer className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 rounded-xl font-bold text-gray-700 bg-white border border-gray-200 hover:bg-gray-100 transition"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSend}
                        disabled={loading || !selectedChannelId}
                        className="flex-1 px-4 py-2.5 rounded-xl font-bold text-white bg-black hover:bg-gray-800 transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                Enviando...
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.438 9.889-9.889.002-5.462-4.415-9.89-9.875-9.89-5.451 0-9.89 4.437-9.892 9.886 0 2.235.614 4.09 1.761 5.764l-.999 3.649 3.725-.912zm10.53-7.234c-.287-.144-1.693-.836-1.956-.932-.262-.095-.453-.144-.644.144-.191.287-.74.932-.907 1.123-.167.191-.334.215-.62.072-.287-.144-1.21-.447-2.305-1.424-.852-.76-1.428-1.698-1.594-1.986-.167-.287-.018-.442.126-.583.13-.127.287-.334.43-.502.144-.167.191-.287.287-.478.095-.191.048-.359-.024-.502-.072-.144-.644-1.553-.883-2.126-.233-.558-.469-.482-.644-.491-.167-.008-.358-.01-.55-.01s-.501.072-.764.359c-.263.287-1.003.98-1.003 2.39s1.027 2.77 1.17 2.962c.144.191 2.02 3.085 4.895 4.327.684.296 1.218.473 1.634.605.687.218 1.313.187 1.807.113.551-.082 1.693-.693 1.932-1.362.24-.669.24-1.242.167-1.362-.072-.12-.263-.191-.55-.335z" /></svg>
                                Enviar
                            </>
                        )}
                    </button>
                </footer>
            </div>
        </div>
    );
};
