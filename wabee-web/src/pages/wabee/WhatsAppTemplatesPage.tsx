import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { apiClient } from '@/api/wabee/client';
import { useToast } from '@/context/ToastContext';
import { useDialog } from '@/context/DialogContext';

interface Template {
    id: string;
    name: string;
    language: string;
    category: string;
    status: string;
    components: any[];
    createdAt: string;
    updatedAt: string;
}

interface TemplatesResponse {
    items: Template[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

export default function WhatsAppTemplatesPage() {
    const { channelId } = useParams<{ channelId: string }>();
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(false);
    const [importing, setImporting] = useState(false);
    const [meta, setMeta] = useState<any>(null);
    const [filters, setFilters] = useState({
        status: '',
        language: '',
        category: '',
        q: ''
    });

    const { error: toastError, success: toastSuccess, info: toastInfo } = useToast();
    const { confirm } = useDialog();

    const fetchTemplates = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.status) params.append('status', filters.status);
            if (filters.language) params.append('language', filters.language);
            if (filters.category) params.append('category', filters.category);
            if (filters.q) params.append('q', filters.q);

            const data = await apiClient<TemplatesResponse>(
                `/channels/${channelId}/templates?${params.toString()}`,
                { method: 'GET' }
            );

            setTemplates(data.items);
            setMeta(data.meta);
        } catch (error: any) {
            console.error('Error fetching templates:', error);
            toastError(error.message || 'Error loading templates');
        } finally {
            setLoading(false);
        }
    };

    const handleImport = async () => {
        const isConfirmed = await confirm({
            title: 'Importar Templates',
            description: '¿Importar templates desde Meta? Esto puede tomar unos segundos.',
            confirmText: 'Importar'
        });
        if (!isConfirmed) return;

        setImporting(true);
        try {
            const data = await apiClient<{ imported: number; updated: number; skipped: number }>(
                `/channels/${channelId}/templates/import`,
                { method: 'POST' }
            );

            toastSuccess(`Importación completa: ${data.imported} importados, ${data.updated} actualizados, ${data.skipped} omitidos.`);

            await fetchTemplates();
        } catch (error: any) {
            console.error('Error importing templates:', error);
            toastError(error.message || 'Error importing templates');
        } finally {
            setImporting(false);
        }
    };

    const extractBodyPreview = (components: any[]): string => {
        if (!components || !Array.isArray(components)) return 'N/A';

        const bodyComponent = components.find(c => c.type === 'BODY');
        if (!bodyComponent || !bodyComponent.text) return 'N/A';

        return bodyComponent.text.replace(/\{\{(\d+)\}\}/g, '____');
    };

    useEffect(() => {
        fetchTemplates();
    }, [channelId]);

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="mb-6 flex justify-between items-center">
                <h1 className="text-2xl font-bold">WhatsApp Templates</h1>
                <button
                    onClick={handleImport}
                    disabled={importing}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {importing ? 'Importando...' : 'Importar desde Meta'}
                </button>
            </div>

            {/* Filters */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-4 rounded-lg shadow">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                    <select
                        value={filters.status}
                        onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                        <option value="">Todos</option>
                        <option value="APPROVED">APPROVED</option>
                        <option value="PENDING">PENDING</option>
                        <option value="REJECTED">REJECTED</option>
                        <option value="DISABLED">DISABLED</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Idioma</label>
                    <input
                        type="text"
                        value={filters.language}
                        onChange={(e) => setFilters({ ...filters, language: e.target.value })}
                        placeholder="ej: en_US"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                    <select
                        value={filters.category}
                        onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                        <option value="">Todas</option>
                        <option value="MARKETING">MARKETING</option>
                        <option value="UTILITY">UTILITY</option>
                        <option value="AUTHENTICATION">AUTHENTICATION</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
                    <input
                        type="text"
                        value={filters.q}
                        onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                        placeholder="Nombre del template"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                </div>

                <div className="md:col-span-4">
                    <button
                        onClick={fetchTemplates}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                        Aplicar Filtros
                    </button>
                </div>
            </div>

            {/* Table */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            ) : (
                <>
                    <div className="bg-white rounded-lg shadow overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Nombre
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Idioma
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Categoría
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Estado
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Preview
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {templates.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                            No hay templates. Haz clic en "Importar desde Meta" para obtenerlos.
                                        </td>
                                    </tr>
                                ) : (
                                    templates.map((template) => (
                                        <tr key={template.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                {template.name}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {template.language}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                <span className={`px-2 py-1 rounded text-xs ${template.category === 'MARKETING' ? 'bg-purple-100 text-purple-800' :
                                                    template.category === 'UTILITY' ? 'bg-blue-100 text-blue-800' :
                                                        'bg-green-100 text-green-800'
                                                    }`}>
                                                    {template.category}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                <span className={`px-2 py-1 rounded text-xs ${template.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                                                    template.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                                                        template.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                                                            'bg-gray-100 text-gray-800'
                                                    }`}>
                                                    {template.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                                                {extractBodyPreview(template.components)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {meta && meta.total > 0 && (
                        <div className="mt-4 flex justify-between items-center text-sm text-gray-700">
                            <div>
                                Mostrando {templates.length} de {meta.total} templates
                            </div>
                            <div>
                                Página {meta.page} de {meta.totalPages}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
