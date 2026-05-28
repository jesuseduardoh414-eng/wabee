import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
    Trash2, 
    UserX, 
    Clock, 
    CheckCircle, 
    XCircle, 
    Search, 
    RefreshCw,
    MoreHorizontal,
    ExternalLink,
    AlertTriangle,
    Loader2
} from 'lucide-react';
import { T, S } from '@/lib/text-tokens';
import client from '@/api/client';

interface DataDeletionRequest {
    id: string;
    fullName: string;
    email: string;
    phone?: string;
    description?: string;
    status: 'PENDING' | 'IN_REVIEW' | 'CONFIRMED' | 'COMPLETED' | 'REJECTED' | 'SPAM';
    hasMatch: boolean;
    internalNote?: string;
    requestedAt: string;
    completedAt?: string;
}

export const DataDeletionAdminPage: React.FC = () => {
    const [requests, setRequests] = useState<DataDeletionRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [menuCoords, setMenuCoords] = useState<{ top: number, left: number } | null>(null);

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const response = await client.get('/super-admin/data-deletion');
            setRequests(response.data.data);
        } catch (error) {
            console.error('Error fetching deletion requests:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    const handleUpdateStatus = async (id: string, status: string) => {
        setActionLoading(id);
        try {
            await client.patch(`/super-admin/data-deletion/${id}/status`, { status });
            await fetchRequests();
        } catch (error) {
            console.error('Error updating status:', error);
            alert('Error al actualizar el estado.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleComplete = async (id: string) => {
        const req = requests.find(r => r.id === id);
        if (req && !req.hasMatch) {
            alert('No se puede completar una solicitud sin contacto asociado.');
            return;
        }

        if (!confirm('¿Estás seguro de completar esta solicitud? Esta acción anonimizará permanentemente los datos del contacto en la base de datos.')) {
            return;
        }

        setActionLoading(id);
        try {
            await client.post(`/super-admin/data-deletion/${id}/complete`);
            await fetchRequests();
            alert('Anonimización completada con éxito.');
        } catch (error: any) {
            console.error('Error completing request:', error);
            alert(error.response?.data?.message || 'Error al completar la solicitud.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar esta solicitud del registro? Esta acción es irreversible.')) {
            return;
        }

        setActionLoading(id);
        try {
            await client.delete(`/super-admin/data-deletion/${id}`);
            await fetchRequests();
        } catch (error) {
            console.error('Error deleting request:', error);
            alert('Error al eliminar la solicitud.');
        } finally {
            setActionLoading(null);
        }
    };

    const filteredRequests = requests.filter(r => {
        const matchesSearch = r.fullName.toLowerCase().includes(search.toLowerCase()) || 
                             r.email.toLowerCase().includes(search.toLowerCase()) ||
                             (r.phone && r.phone.includes(search));
        const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'PENDING': return <span className="px-2 py-1 bg-yellow-500/10 text-yellow-500 text-[10px] uppercase tracking-wider rounded-md font-bold border border-yellow-500/20">Pendiente</span>;
            case 'IN_REVIEW': return <span className="px-2 py-1 bg-blue-500/10 text-blue-500 text-[10px] uppercase tracking-wider rounded-md font-bold border border-blue-500/20">En Revisión</span>;
            case 'CONFIRMED': return <span className="px-2 py-1 bg-indigo-500/10 text-indigo-500 text-[10px] uppercase tracking-wider rounded-md font-bold border border-indigo-500/20">Confirmado</span>;
            case 'COMPLETED': return <span className="px-2 py-1 bg-green-500/10 text-green-500 text-[10px] uppercase tracking-wider rounded-md font-bold border border-green-500/20">Completado</span>;
            case 'REJECTED': return <span className="px-2 py-1 bg-red-500/10 text-red-500 text-[10px] uppercase tracking-wider rounded-md font-bold border border-red-500/20">Rechazado</span>;
            case 'SPAM': return <span className="px-2 py-1 bg-gray-500/10 text-gray-500 text-[10px] uppercase tracking-wider rounded-md font-bold border border-gray-500/20">SPAM</span>;
            default: return null;
        }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1">
                    <h1 className={`${T.pageTitle} ${S.headingLg}`}>Privacidad y Cumplimiento</h1>
                    <p className={`${T.pageSubtitle} ${S.body} opacity-60 italic`}>
                        Gestión de solicitudes de eliminación de datos (Meta/WhatsApp Compliance).
                    </p>
                </div>
                <button 
                    onClick={fetchRequests} 
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-xl hover:bg-[var(--bg-hover)] transition-all disabled:opacity-50"
                >
                    <RefreshCw className={`${loading ? 'animate-spin' : ''}`} size={18} />
                    <span className={`${T.buttonText} ${S.body}`}>Actualizar</span>
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-col space-y-4">
                <div className="flex flex-wrap gap-2">
                    {['ALL', 'PENDING', 'IN_REVIEW', 'CONFIRMED', 'COMPLETED', 'SPAM'].map((status) => (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                statusFilter === status 
                                ? 'bg-[var(--brand-primary)] text-[var(--brand-primary-foreground)] border-[var(--brand-primary)]' 
                                : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border-default)] hover:border-[var(--text-muted)]'
                            }`}
                        >
                            {status === 'ALL' ? 'Todos' : status === 'PENDING' ? 'Pendientes' : status === 'IN_REVIEW' ? 'En Revisión' : status === 'CONFIRMED' ? 'Confirmados' : status === 'COMPLETED' ? 'Completados' : 'SPAM'}
                        </button>
                    ))}
                </div>

                {/* Search Bar */}
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={18} />
                    <input 
                        type="text" 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar por nombre, email o teléfono..." 
                        className="ui-input pl-12"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-2xl shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-[var(--border-default)] bg-[var(--bg-elevated)]/30">
                                <th className={`p-4 ${T.tableHeader} ${S.ui}`}>Usuario / Solicitante</th>
                                <th className={`p-4 ${T.tableHeader} ${S.ui}`}>Contacto</th>
                                <th className={`p-4 ${T.tableHeader} ${S.ui}`}>Estado / Match</th>
                                <th className={`p-4 ${T.tableHeader} ${S.ui}`}>Fecha Petición</th>
                                <th className={`p-4 ${T.tableHeader} ${S.ui} text-right`}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center">
                                        <div className="flex flex-col items-center gap-4">
                                            <Loader2 className="animate-spin text-[var(--brand-primary)]" size={32} />
                                            <p className={`${T.helperText} ${S.body}`}>Cargando solicitudes...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredRequests.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center">
                                        <div className="flex flex-col items-center gap-4 opacity-40">
                                            <UserX size={48} />
                                            <p className={`${T.helperText} ${S.body}`}>No se encontraron solicitudes.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredRequests.map((request) => (
                                    <tr key={request.id} className="border-b border-[var(--border-default)] hover:bg-[var(--bg-hover)] transition-colors group">
                                        <td className="p-4">
                                            <div className="flex flex-col">
                                                <span className={`${T.tableCell} ${S.body} font-black uppercase italic tracking-tighter`}>{request.fullName}</span>
                                                <span className={`${T.helperText} ${S.meta} opacity-40`}>ID: {request.id.split('-')[0]}...</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col">
                                                <span className={`${T.tableCell} ${S.body}`}>{request.email}</span>
                                                {request.phone && <span className={`${T.helperText} ${S.meta} opacity-40`}>{request.phone}</span>}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col gap-1.5">
                                                {getStatusBadge(request.status)}
                                                <div className="flex items-center gap-1.5">
                                                    {request.hasMatch ? (
                                                        <span className="flex items-center gap-1 text-[10px] text-[var(--state-success)] font-medium">
                                                            <CheckCircle size={10} /> Encontrado
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-1 text-[10px] text-[var(--state-danger)] font-medium">
                                                            <AlertTriangle size={10} /> No encontrado
                                                        </span>
                                                    )}
                                                </div>
                                                {request.internalNote && (
                                                    <span className="text-[10px] text-[var(--text-muted)] italic leading-tight">
                                                        {request.internalNote}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2 text-[var(--text-muted)]">
                                                <Clock size={14} className="opacity-40" />
                                                <span className={`${T.helperText} ${S.meta}`}>
                                                    {new Date(request.requestedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                                                </span>
                                            </div>
                                        </td>
                                        <td className={`p-4 text-right transition-all duration-300 ${openMenuId === request.id ? 'z-[100] sticky right-0 bg-[var(--bg-card)]/80 backdrop-blur-md' : 'z-10'}`}>
                                            <div className="flex items-center justify-end relative">
                                                {actionLoading === request.id ? (
                                                    <Loader2 className="animate-spin text-[var(--brand-primary)]" size={18} />
                                                ) : (
                                                    <div className="relative">
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const rect = e.currentTarget.getBoundingClientRect();
                                                                setMenuCoords({ 
                                                                    top: rect.bottom + window.scrollY, 
                                                                    left: rect.right + window.scrollX - 224 // 224px is w-56
                                                                });
                                                                setOpenMenuId(openMenuId === request.id ? null : request.id);
                                                            }}
                                                            className={`p-2 rounded-lg transition-all ${openMenuId === request.id ? 'bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-strong)] hover:bg-[var(--bg-elevated)]'}`}
                                                            title="Opciones de acción"
                                                        >
                                                            <MoreHorizontal size={18} />
                                                        </button>

                                                        {openMenuId === request.id && menuCoords && createPortal(
                                                            <>
                                                                {/* Overlay para cerrar al hacer clic fuera */}
                                                                <div 
                                                                    className="fixed inset-0 z-[9998]"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setOpenMenuId(null);
                                                                    }}
                                                                ></div>
                                                                
                                                                <div 
                                                                    className="absolute w-56 bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[9999] py-2 animate-in fade-in zoom-in-95 duration-200 backdrop-blur-xl"
                                                                    style={{ 
                                                                        top: menuCoords.top + 8, 
                                                                        left: menuCoords.left
                                                                    }}
                                                                >
                                                                    <div className="px-4 py-2 border-b border-[var(--border-default)]/50 mb-1">
                                                                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Acciones</span>
                                                                    </div>
                                                                    {request.status === 'PENDING' && (
                                                                        <button 
                                                                            onClick={() => { handleUpdateStatus(request.id, 'IN_REVIEW'); setOpenMenuId(null); }}
                                                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-gray-100 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
                                                                        >
                                                                            <RefreshCw size={16} className="text-blue-500" />
                                                                            <span>Marcar en revisión</span>
                                                                        </button>
                                                                    )}
                                                                    
                                                                    {(request.status === 'PENDING' || request.status === 'IN_REVIEW' || request.status === 'CONFIRMED') && (
                                                                        <>
                                                                            <button 
                                                                                onClick={() => { handleUpdateStatus(request.id, 'REJECTED'); setOpenMenuId(null); }}
                                                                                className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-gray-100 hover:text-red-400 hover:bg-red-500/10 transition-all"
                                                                            >
                                                                                <XCircle size={16} className="text-red-500" />
                                                                                <span>Rechazar solicitud</span>
                                                                            </button>
                                                                        </>
                                                                    )}

                                                                    {request.status === 'CONFIRMED' && (
                                                                        <button 
                                                                            onClick={() => { handleComplete(request.id); setOpenMenuId(null); }}
                                                                            disabled={!request.hasMatch}
                                                                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold transition-all ${
                                                                                request.hasMatch 
                                                                                ? 'text-gray-100 hover:text-green-400 hover:bg-green-500/10' 
                                                                                : 'text-gray-500 opacity-40 cursor-not-allowed'
                                                                            }`}
                                                                        >
                                                                            <CheckCircle size={16} className={request.hasMatch ? 'text-green-500' : 'text-gray-500'} />
                                                                            <span>Aceptar (Completar y anonimizar)</span>
                                                                        </button>
                                                                    )}

                                                                    {(request.status === 'SPAM' || request.status === 'REJECTED' || request.status === 'COMPLETED') && (
                                                                        <div className="border-t border-[var(--border-default)] my-1"></div>
                                                                    )}

                                                                    {(request.status === 'SPAM' || request.status === 'REJECTED' || request.status === 'COMPLETED') && (
                                                                        <button 
                                                                            onClick={() => { handleDelete(request.id); setOpenMenuId(null); }}
                                                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-gray-100 hover:text-red-400 hover:bg-red-500/10 transition-all"
                                                                        >
                                                                            <Trash2 size={16} className="text-red-500" />
                                                                            <span>Eliminar registro</span>
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </>,
                                                            document.body
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
