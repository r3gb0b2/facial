
import React, { useState, useMemo } from 'react';
import { Supplier, Sector, Attendee, SubCompany, CheckinStatus, EventType } from '../../types.ts';
import { useTranslation } from '../../hooks/useTranslation.tsx';
import { LinkIcon, NoSymbolIcon, CheckCircleIcon, PencilIcon, TrashIcon, XMarkIcon, EyeIcon, KeyIcon, FaceSmileIcon, UsersIcon } from '../icons.tsx';
import BulkUpdateSectorsModal from '../CompanySectorsModal.tsx';
import * as api from '../../firebase/service.ts';
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


const SupplierManagementView: React.FC<SupplierManagementViewProps> = ({ currentEventId, suppliers, attendees, sectors, onAddSupplier, onUpdateSupplier, onDeleteSupplier, onSupplierStatusUpdate, onRegenerateAdminToken, onUpdateSectorsForSelectedAttendees, setError, eventType = 'CREDENTIALING' }) => {
    const { t } = useTranslation();
    const isVip = eventType === 'VIP_LIST';
    
    const [supplierName, setSupplierName] = useState('');
    const [supplierEmail, setSupplierEmail] = useState('');
    const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
    const [limit, setLimit] = useState('');
    const [subCompanies, setSubCompanies] = useState<SubCompany[]>([]);
    const [currentSubCompanyName, setCurrentSubCompanyName] = useState('');
    const [currentSubCompanySector, setCurrentSubCompanySector] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [expandedSupplierId, setExpandedSupplierId] = useState<string | null>(null);
    const [copiedLink, setCopiedLink] = useState<string | null>(null);

    const registrationCounts = useMemo(() => {
        const counts = new Map<string, number>();
        attendees.forEach(a => { if (a.supplierId) counts.set(a.supplierId, (counts.get(a.supplierId) || 0) + 1); });
        return counts;
    }, [attendees]);

    const sectorMap = useMemo(() => new Map(sectors.map(s => [s.id, s])), [sectors]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!supplierName.trim() || !supplierEmail.trim()) {
            setError("Nome e e-mail são obrigatórios.");
            return;
        }
        const registrationLimit = parseInt(limit, 10);
        if (isNaN(registrationLimit) || registrationLimit <= 0) {
            setError(t('suppliers.noLimitError'));
            return;
        }

        setIsSubmitting(true);
        try {
            await onAddSupplier(supplierName, isVip && sectors.length > 0 ? [sectors[0].id] : selectedSectors, registrationLimit, subCompanies, supplierEmail.trim());
            setSupplierName(''); setSupplierEmail(''); setLimit(''); setSubCompanies([]);
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

    const handleDelete = async (supplier: Supplier, e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm(t('suppliers.deleteConfirm', { 0: supplier.name }))) {
            try {
                await onDeleteSupplier(supplier);
            } catch (err: any) {
                setError(err.message || 'Falha ao deletar.');
            }
        }
    };

    return (
        <div className="w-full max-w-7xl mx-auto space-y-8">
            {/* Form de Criação */}
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

            {/* Lista Ativa */}
            <div className="space-y-4">
                <h3 className="text-xl font-black text-white px-4 uppercase tracking-tighter">Promoters em Operação</h3>
                {suppliers.sort((a,b) => a.name.localeCompare(b.name)).map(supplier => {
                    const isExpanded = expandedSupplierId === supplier.id;
                    const currentCount = registrationCounts.get(supplier.id) || 0;
                    const supplierAttendees = attendees.filter(a => a.supplierId === supplier.id).sort((a,b) => a.name.localeCompare(b.name));
                    
                    return (
                        <div key={supplier.id} className="bg-neutral-900/40 rounded-[2rem] overflow-hidden border border-white/5 transition-all">
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
                                    <button onClick={(e) => handleCopyLink(supplier.id, e)} className="p-4 bg-rose-600 text-white rounded-2xl transition-all hover:scale-105 active:scale-95 shadow-lg shadow-rose-600/20">
                                        {copiedLink === supplier.id ? <CheckCircleIcon className="w-5 h-5"/> : <LinkIcon className="w-5 h-5"/>}
                                    </button>
                                    <button onClick={(e) => handleDelete(supplier, e)} className="p-4 bg-neutral-800 text-neutral-500 hover:text-red-500 rounded-2xl transition-colors"><TrashIcon className="w-5 h-5"/></button>
                                </div>
                            </div>
                            
                            {isExpanded && (
                                <div className="p-8 bg-black/40 border-t border-white/5 animate-in slide-in-from-top-2">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                                        {supplierAttendees.map(attendee => (
                                            <AttendeeCard 
                                                key={attendee.id} attendee={attendee} isVipMode={true} onSelect={() => {}}
                                                sectors={(attendee.sectors || []).map(id => ({ label: sectorMap.get(id)?.label || id, color: sectorMap.get(id)?.color }))}
                                            />
                                        ))}
                                        {supplierAttendees.length === 0 && (
                                            <div className="col-span-full py-10 text-center border-2 border-dashed border-white/5 rounded-3xl">
                                                <p className="text-neutral-600 font-black uppercase text-[10px] tracking-[0.3em]">Lista Tardia / Sem Convidados</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default SupplierManagementView;
