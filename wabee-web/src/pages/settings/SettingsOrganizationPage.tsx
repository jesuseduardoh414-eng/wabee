import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Building2, Globe, Mail, Calendar,
    ShieldCheck, Loader2, Save, CheckCircle2
} from 'lucide-react';
import client from '../../api/client';
import { T, S } from '@/lib/text-tokens';

export const SettingsOrganizationPage = () => {
    const queryClient = useQueryClient();
    const orgId = localStorage.getItem('wabee_orgId');
    const role = (localStorage.getItem('wabee_role') || 'AGENT').toUpperCase();
    const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';

    const [form, setForm] = useState({
        name: '',
        email: ''
    });
    const [statusMes, setStatusMes] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: ['org', 'summary', orgId],
        queryFn: async () => {
            const { data } = await client.get(`/orgs/${orgId}/summary`);
            return data;
        },
        enabled: !!orgId
    });

    useEffect(() => {
        if (data?.organization) {
            setForm({
                name: data.organization.name,
                email: data.organization.email
            });
        }
    }, [data]);

    const updateMutation = useMutation({
        mutationFn: async (payload: any) => {
            const { name, email } = payload;
            return await client.patch(`/orgs/${orgId}`, {
                name,
                email
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['org', 'summary', orgId] });
            setStatusMes({ type: 'success', msg: 'Configuración actualizada correctamente.' });
            setTimeout(() => setStatusMes(null), 3000);
        },
        onError: (err: any) => {
            const msg = err.response?.data?.error?.message || 'Error al actualizar la configuración.';
            setStatusMes({ type: 'error', msg });
        }
    });

    const handleSave = () => {
        if (!isAdmin) return;
        updateMutation.mutate(form);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="animate-spin text-[var(--brand-primary)]" size={40} />
            </div>
        );
    }

    const { organization, plan } = data || {};

    return (
        <div className="space-y-10 animate-in fade-in duration-500 pb-20">
            {/* Header */}
            <div>
                <h1 className={`${T.pageTitle} ${S.displayMd}`}>
                    Ajustes de <span className="text-[var(--ty-accent)]">Organización</span>
                </h1>
                <p className={`${T.pageSubtitle} ${S.body}`}>
                    Gestiona la identidad legal y el perfil corporativo de tu empresa.
                </p>
            </div>

            {/* Sidebar & Form Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">

                {/* ── Columna Izquierda: Tarjeta de Identidad Visual ── */}
                <div className="lg:col-span-4 space-y-8">
                    <div className="bg-[var(--bg-page)] border border-[var(--border-default)] rounded-[3rem] p-10 text-center relative overflow-hidden group">
                        {/* Glow decorativo — usa color de marca */}
                        <div className="absolute -top-32 -right-32 w-64 h-64 bg-[var(--brand-primary)]/5 blur-[80px] rounded-full group-hover:bg-[var(--brand-primary)]/10 transition-all duration-700" />

                        {/* Logo / Avatar */}
                        <div className="relative w-36 h-36 mx-auto mb-8">
                            <div className="w-full h-full rounded-[2.5rem] bg-[var(--bg-card)] border-4 border-[var(--border-default)] flex items-center justify-center overflow-hidden shadow-2xl transition-transform group-hover:scale-105 duration-500">
                                {organization?.logoUrl ? (
                                    <img src={organization.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                                ) : (
                                    <Building2 size={56} className="text-[var(--brand-primary)] opacity-80" />
                                )}
                            </div>
                        </div>

                        {/* Nombre de organización */}
                        <h2 className={`${T.cardTitle} ${S.headingLg} mb-2 leading-tight`}>
                            {form.name || organization?.name}
                        </h2>

                        {/* Badge de status */}
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--brand-primary)]/5 border border-[var(--brand-primary)]/20 mb-10">
                            <div className="w-2 h-2 rounded-full bg-[var(--brand-primary)] animate-pulse" />
                            <span className={`${T.badgeText} ${S.meta} text-[var(--brand-primary)] uppercase tracking-[0.2em]`}>
                                {organization?.status || 'Active'}
                            </span>
                        </div>

                        {/* Plan y Registro */}
                        <div className="space-y-5 pt-8 border-t border-[var(--border-default)]">
                            <div className="flex items-center justify-between">
                                <span className={`${T.helperText} ${S.meta} uppercase tracking-widest`}>
                                    Plan Activo
                                </span>
                                <span className={`${T.badgeText} ${S.meta} bg-[var(--brand-primary)]/10 px-4 py-1.5 rounded-xl border border-[var(--brand-primary)]/20 text-[var(--brand-primary)]`}>
                                    {plan?.name || 'Starter'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className={`${T.helperText} ${S.meta} uppercase tracking-widest`}>
                                    Registro
                                </span>
                                <span className={`${T.helperText} ${S.meta} font-bold`}>
                                    {new Date(organization?.createdAt).toLocaleDateString()}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Columna Derecha: Formulario Principal ── */}
                <div className="lg:col-span-8 space-y-10">
                    <div className="bg-[var(--bg-page)] border border-[var(--border-default)] rounded-[3rem] p-10 lg:p-14 relative overflow-hidden">
                        {/* Glow decorativo */}
                        <div className="absolute top-0 right-0 w-80 h-80 bg-[var(--brand-primary)]/[0.02] blur-[120px] rounded-full pointer-events-none" />

                        {/* Encabezado de sección */}
                        <div className="flex items-center gap-4 mb-12">
                            <div className="w-12 h-12 rounded-2xl bg-[var(--brand-primary)]/10 flex items-center justify-center text-[var(--brand-primary)]">
                                <ShieldCheck size={24} />
                            </div>
                            <h3 className={`${T.sectionTitle} ${S.headingLg}`}>
                                Perfil <span className="text-[var(--brand-primary)]">Corporativo</span>
                            </h3>
                        </div>

                        {/* Campos del formulario */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            {/* Nombre Legal */}
                            <div className="space-y-4">
                                <label className={`${T.labelText} ${S.meta} uppercase tracking-[3px] ml-1`}>
                                    Nombre Legal
                                </label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    disabled={!isAdmin}
                                    className={`${T.inputText} ${S.body} w-full bg-[var(--bg-input)] border border-[var(--border-default)] px-6 py-4 rounded-[1.5rem] focus:border-[var(--brand-primary)]/50 outline-none transition-all disabled:opacity-40`}
                                />
                            </div>

                            {/* Email de Contacto */}
                            <div className="space-y-4">
                                <label className={`${T.labelText} ${S.meta} uppercase tracking-[3px] ml-1`}>
                                    Email de Contacto
                                </label>
                                <div className="relative">
                                    <Mail className="absolute left-6 top-1/2 -translate-y-1/2 opacity-40 text-[var(--ty-muted)]" size={20} />
                                    <input
                                        type="email"
                                        value={form.email}
                                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                                        disabled={!isAdmin}
                                        className={`${T.inputText} ${S.body} w-full bg-[var(--bg-input)] border border-[var(--border-default)] px-6 py-4 pl-16 rounded-[1.5rem] focus:border-[var(--brand-primary)]/50 outline-none transition-all disabled:opacity-40`}
                                    />
                                </div>
                            </div>

                            {/* Sello de Registro (read-only) */}
                            <div className="space-y-4 md:col-span-2">
                                <label className={`${T.labelText} ${S.meta} uppercase tracking-[3px] ml-1 opacity-50`}>
                                    Sello de Registro
                                </label>
                                <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] px-8 py-5 rounded-[1.5rem] flex items-center gap-4 opacity-60">
                                    <Calendar size={20} className="text-[var(--brand-primary)]" />
                                    <span className={`${T.inputText} ${S.body} uppercase tracking-widest`}>
                                        {new Date(organization?.createdAt).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Barra de Acción: Sincronización Global ── */}
                    <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-[2.5rem] p-8 sm:p-10 flex flex-col sm:flex-row items-center justify-between gap-8">
                        <div>
                            <p className={`${T.sectionTitle} ${S.meta} mb-1`}>
                                Sincronización Global
                            </p>
                            <p className={`${T.helperText} ${S.body}`}>
                                Aplica los cambios a todas las instancias de la organización.
                            </p>
                        </div>
                        <button
                            onClick={handleSave}
                            disabled={!isAdmin || updateMutation.isPending}
                            className={`px-12 py-5 bg-[var(--brand-primary)] rounded-[1.5rem] ${T.buttonPrimaryText} ${S.body} hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-3 shadow-xl`}
                        >
                            {updateMutation.isPending ? <Loader2 className="animate-spin" size={20} /> : <Save size={22} />}
                            {updateMutation.isPending ? 'Procesando...' : 'Confirmar'}
                        </button>
                    </div>

                    {/* ── Mensaje de Estado ── */}
                    {statusMes && (
                        <div className={`p-6 rounded-[1.5rem] border flex items-center gap-4 animate-in slide-in-from-top-4 duration-300 ${
                            statusMes.type === 'success'
                                ? 'bg-[var(--state-success)]/10 border-[var(--state-success)]/20 text-[var(--state-success)]'
                                : 'bg-[var(--state-danger)]/10 border-[var(--state-danger)]/20 text-[var(--state-danger)]'
                        }`}>
                            {statusMes.type === 'success' ? <CheckCircle2 size={24} /> : <ShieldCheck size={24} />}
                            <p className={`${T.messageText} ${S.body} uppercase tracking-widest font-bold`}>
                                {statusMes.msg}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
