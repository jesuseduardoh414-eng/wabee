import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getChannels, Channel } from '@/api/wabee/whatsapp.api';

export const TemplatesSelectChannelPage = () => {
    const navigate = useNavigate();
    const [channels, setChannels] = useState<Channel[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchChannels = async () => {
            try {
                const data = await getChannels({});
                setChannels(data.filter((c: Channel) => c.status === 'CONNECTED'));
            } catch (error) {
                console.error('Error loading channels:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchChannels();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Seleccionar Canal para Templates</h1>

            {channels.length === 0 ? (
                <div className="bg-[var(--state-warning)]/10 border border-[var(--state-warning)]/20 rounded-lg p-6 text-center">
                    <p className="text-[var(--text-body)]">No hay canales conectados. Por favor, conecta un canal de WhatsApp primero.</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {channels.map((channel) => (
                        <button
                            key={channel.id}
                            onClick={() => navigate(`/app/admin/channels/${channel.id}/templates`)}
                            className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-lg p-4 hover:shadow-md hover:border-[var(--brand-primary)]/40 transition-all text-left"
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-semibold text-[var(--text-strong)]">{channel.name}</h3>
                                    <p className="text-sm text-[var(--text-muted)]">{channel.displayPhone}</p>
                                </div>
                                <svg className="w-5 h-5 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
