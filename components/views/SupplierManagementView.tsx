
import React, { useState, useMemo } from 'react';
import { Supplier, Sector, Attendee, SubCompany, EventType } from '../../types.ts';
import { useTranslation } from '../../hooks/useTranslation.tsx';
import { LinkIcon, NoSymbolIcon, CheckCircleIcon, TrashIcon, KeyIcon, UsersIcon, TagIcon } from '../icons.tsx';
import UserAvatar from '../UserAvatar.tsx';
import AttendeeCard from '../AttendeeCard.tsx';

interface SupplierManagementViewProps {
    currentEventId: string;
    suppliers: Supplier[];
    attendees: Attendee[];
    sectors: Sector[];
    onAddSupplier: (name: string, sectors: string[], registrationLimit: number, subCompanies: SubCompany[], email?: string) => Promise<void>;
    onUpdateSupplier: (supplierId: string, data: Partial<Supplier>) => Promise<void>;
    onDeleteSupplier: (supplier: Supplier) => Promise<void>;
    onSupplierStatusUpdate: (supplierId: string, active: boolean) => Promise<void>;
    onRegenerateAdminToken: (supplierId: string) => Promise<string>;
    onUpdateSectorsForSelectedAttendees: (attendeeIds: string[], sectorIds: string[]) => Promise<void>;
    setError: (message: string) => void;
    eventType?: EventType;
}

const SupplierManagementView: React.FC<SupplierManagementViewProps> = ({ currentEventId, suppliers, attendees, sectors, onAddSupplier, onDeleteSupplier, onSupplierStatusUpdate, onRegenerateAdminToken, setError, eventType = 'CREDENTIALING' }) => {
    const { t } = useTranslation();
    const isVip = eventType === 'VIP_LIST';
    
    const [supplierName, setSupplierName] = useState('');
    const [supplierEmail, setSupplierEmail] = useState('');
    const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
    const [limit, setLimit] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [copiedLink, setCopiedLink] = useState<string | null>(null);
    const [copiedAdminLink, setCopiedAdminLink] = useState<string | null>(null);
    const [expandedSupplierId, setExpandedSupplierId] = useState<string | null>(null);

    const registrationCounts = useMemo(() => {
        const counts = new Map<string, number>();
        for (const attendee of attendees) {
            if (attendee.supplierId) {
                counts.set(attendee.supplierId, (counts.get(attendee.supplierId) || 0) + 1);
            }
        }
        return counts;
    }, [attendees]);

    const sectorMap = useMemo(() => new Map(sectors.map(s => [s.id, s])), [sectors]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!supplierName.trim()) return;
        const registrationLimit = parseInt(limit, 10) || 0;

        setIsSubmitting(true);
        try {
            await onAddSupplier(supplierName, isVip && sectors.length > 0 ? [sectors[0].id] : selectedSectors, registrationLimit, [], supplierEmail.trim());
            setSupplierName(''); setSupplierEmail(''); setLimit(''); setSelectedSectors([]);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCopyLink = (supplierId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const url = `${window.location.origin}?eventId=${currentEventId}&supplierId=${supplierId}`;
        navigator.clipboard.writeText(url);
        setCopiedLink(supplierId);
        setTimeout(() => setCopiedLink(null), 2000);
    };

    const handleCopyAdminLink = (supplier: Supplier, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!supplier.adminToken) return;
        const url = `${window.location.origin}?verify=${supplier.adminToken}`;
        navigator.clipboard.writeText(url);
        setCopiedAdminLink(supplier.id);
        setTimeout(() => setCopiedAdminLink(null), 2000);
    };

    // --- RENDER MODO VIP ---
    if (isVip) {
        return (
            <div className="w-full max-w-7xl mx-auto space-y-8">
                <div className="bg-neutral-900/60 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/5 shadow-2xl">
                    <h2 className="text-3xl font-black text-white text-center mb-10 tracking-tighter uppercase">Configurar Promoter VIP</h2>
                    <form onSubmit={handleSubmit} className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="relative group">
                                <input type="text" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} className="w-full bg-transparent border-b border-neutral-800 py-3 text-white focus:outline-none focus:border-rose-500 font-bold placeholder:text-neutral-800" placeholder="NOME DA DIVULGADORA" required />
                                <label className="absolute -top-4 left-0 text-[10px] font-black uppercase tracking-widest text-neutral-600">Promoter / Host</label>
                            </div>
                            <div className="relative group">
                                <input type="email" value={supplierEmail} onChange={(e) => setSupplierEmail(e.target.value)} className="w-full bg-transparent border-b border-neutral-800 py-3 text-white focus:outline-none focus:border-rose-500 font-bold placeholder:text-neutral-800" placeholder="EMAIL@EXEMPLO.COM" required />
                                <label className="absolute -top-4 left-0 text-[10px] font-black uppercase tracking-widest text-neutral-600">Contato Exclusive</label>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-end">
                            <div className="relative group">
                                <input type="number" value={limit} onChange={(e) => setLimit(e.target.value)} className="w-full bg-transparent border-b border-neutral-800 py-3 text-white focus:outline-none focus:border-rose-500 font-bold placeholder:text-neutral-800" placeholder="QTD MÁX" required />
                                <label className="absolute -top-4 left-0 text-[10px] font-black uppercase tracking-widest text-neutral-600">Limite de Guest List</label>
                            </div>
                            <button type="submit" disabled={isSubmitting} className="md:col-span-2 bg-white text-black font-black uppercase tracking-widest py-4 rounded-xl transition-all hover:scale-[1.01] active:scale-95 shadow-2xl">
                                {isSubmitting ? "Gerando..." : "Habilitar Link da Promoter"}
                            </button>
                        </div>
                    </form>
                </div>

                <div className="space-y-4">
                    <h3 className="text-xl font-black text-white px-4 uppercase tracking-tighter">Promoters em Operação</h3>
                    {suppliers.sort((a,b) => a.name.localeCompare(b.name)).map(supplier => {
                        const isExpanded = expandedSupplierId === supplier.id;
                        const currentCount = registrationCounts.get(supplier.id) || 0;
                        const supplierAttendees = attendees.filter(a => a.supplierId === supplier.id);
                        
                        return (
                            <div key={supplier.id} className="bg-neutral-900/40 rounded-[2rem] overflow-hidden border border-white/5">
                                <div onClick={() => setExpandedSupplierId(isExpanded ? null : supplier.id)} className="p-6 flex flex-col md:flex-row justify-between items-center gap-6 cursor-pointer hover:bg-white/5 transition-all">
                                    <div className="flex-grow text-center md:text-left">
                                        <h4 className="font-black text-2xl text-white tracking-tighter uppercase">{supplier.name}</h4>
                                        <p className="text-neutral-500 text-[10px] font-bold tracking-widest uppercase mt-1">{supplier.email}</p>
                                        <div className="flex items-center justify-center md:justify-start gap-4 mt-4">
                                            <div className="bg-rose-600/10 px-3 py-1 rounded-full border border-rose-500/20">
                                                <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">{currentCount} / {supplier.registrationLimit} VIPs</span>
                                            </div>
                                            <span className={`text-[10px] font-black uppercase ${supplier.active ? 'text-green-500' : 'text-red-500'}`}>
                                                ● {supplier.active ? 'Ativa' : 'Inativa'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                                        <button onClick={() => onSupplierStatusUpdate(supplier.id, !supplier.active)} className="p-4 bg-white/5 text-neutral-400 hover:text-white rounded-2xl transition-colors">{supplier.active ? <NoSymbolIcon className="w-5 h-5"/> : <CheckCircleIcon className="w-5 h-5"/>}</button>
                                        <button onClick={(e) => handleCopyAdminLink(supplier, e)} className="p-4 bg-amber-600/20 text-amber-500 hover:bg-amber-600 hover:text-white rounded-2xl transition-all border border-amber-500/30">
                                            {copiedAdminLink === supplier.id ? <CheckCircleIcon className="w-5 h-5"/> : <KeyIcon className="w-5 h-5"/>}
                                        </button>
                                        <button onClick={(e) => handleCopyLink(supplier.id, e)} className="p-4 bg-rose-600 text-white rounded-2xl transition-all shadow-lg">
                                            {copiedLink === supplier.id ? <CheckCircleIcon className="w-5 h-5"/> : <LinkIcon className="w-5 h-5"/>}
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); if(confirm('Remover?')) onDeleteSupplier(supplier); }} className="p-4 bg-neutral-800 text-neutral-500 hover:text-red-500 rounded-2xl transition-colors"><TrashIcon className="w-5 h-5"/></button>
                                    </div>
                                </div>
                                {isExpanded && (
                                    <div className="p-8 bg-black/40 border-t border-white/5">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                                            {supplierAttendees.map(attendee => (
                                                <AttendeeCard key={attendee.id} attendee={attendee} isVipMode={true} onSelect={() => {}} sectors={[]} supplierName={supplier.name} />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    // --- RENDER MODO CREDENCIAMENTO (CORPORATIVO) ---
    return (
        <div className="w-full max-w-6xl mx-auto space-y-6">
            <div className="bg-gray-800 p-8 rounded-xl border border-gray-700 shadow-xl">
                <h2 className="text-2xl font-bold text-white mb-6">Novo Fornecedor</h2>
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Nome do Fornecedor / Empresa</label>
                        <input type="text" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Limite de Cadastros</label>
                        <input type="number" value={limit} onChange={(e) => setLimit(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
                    </div>
                    <button type="submit" disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-lg transition-colors">
                        {isSubmitting ? "Salvando..." : "Adicionar Fornecedor"}
                    </button>
                </form>

                <div className="mt-6">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Setores Permitidos para este Fornecedor</label>
                    <div className="flex flex-wrap gap-3">
                        {sectors.map(sector => (
                            <button
                                key={sector.id} type="button"
                                onClick={() => setSelectedSectors(prev => prev.includes(sector.id) ? prev.filter(id => id !== sector.id) : [...prev, sector.id])}
                                className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${selectedSectors.includes(sector.id) ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-500'}`}
                            >
                                {sector.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-900 text-xs font-bold text-gray-400 uppercase tracking-widest">
                        <tr>
                            <th className="px-6 py-4">Fornecedor</th>
                            <th className="px-6 py-4">Uso / Limite</th>
                            <th className="px-6 py-4">Setores</th>
                            <th className="px-6 py-4 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                        {suppliers.map(supplier => {
                            const count = registrationCounts.get(supplier.id) || 0;
                            return (
                                <tr key={supplier.id} className="hover:bg-gray-700/30 transition-colors">
                                    <td className="px-6 py-4">
                                        <p className="font-bold text-white">{supplier.name}</p>
                                        <p className="text-xs text-gray-500">ID: {supplier.id.slice(0,8)}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`text-sm font-mono ${count >= supplier.registrationLimit ? 'text-red-400' : 'text-indigo-400'}`}>
                                            {count} / {supplier.registrationLimit}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-1">
                                            {supplier.sectors.map(sId => (
                                                <span key={sId} className="text-[9px] bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded">
                                                    {sectorMap.get(sId)?.label || sId}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={(e) => handleCopyLink(supplier.id, e)} title="Copiar Link de Cadastro" className="p-2 bg-gray-700 hover:bg-indigo-600 text-white rounded transition-colors">
                                                {copiedLink === supplier.id ? <CheckCircleIcon className="w-4 h-4"/> : <LinkIcon className="w-4 h-4"/>}
                                            </button>
                                            <button onClick={() => onSupplierStatusUpdate(supplier.id, !supplier.active)} title={supplier.active ? 'Bloquear' : 'Ativar'} className={`p-2 rounded transition-colors ${supplier.active ? 'bg-gray-700 text-gray-400 hover:text-red-400' : 'bg-green-900 text-green-400'}`}>
                                                {supplier.active ? <NoSymbolIcon className="w-4 h-4"/> : <CheckCircleIcon className="w-4 h-4"/>}
                                            </button>
                                            <button onClick={() => { if(confirm('Remover?')) onDeleteSupplier(supplier); }} className="p-2 bg-gray-700 hover:bg-red-600 text-white rounded transition-colors">
                                                <TrashIcon className="w-4 h-4"/>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {suppliers.length === 0 && (
                    <div className="p-10 text-center text-gray-500">Nenhum fornecedor cadastrado para este evento.</div>
                )}
            </div>
        </div>
    );
};

export default SupplierManagementView;
