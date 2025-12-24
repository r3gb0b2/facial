import React, { useState, useMemo } from 'react';
import { Supplier, Sector, Attendee, SubCompany, CheckinStatus, EventType } from '../../types.ts';
import { useTranslation } from '../../hooks/useTranslation.tsx';
import { LinkIcon, NoSymbolIcon, CheckCircleIcon, PencilIcon, TrashIcon, XMarkIcon, EyeIcon, KeyIcon, FaceSmileIcon, UsersIcon } from '../icons.tsx';
import BulkUpdateSectorsModal from '../CompanySectorsModal.tsx';
import * as api from '../../firebase/service.ts';
import UserAvatar from '../UserAvatar.tsx';


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
    
    // State for the creation form
    const [supplierName, setSupplierName] = useState('');
    const [supplierEmail, setSupplierEmail] = useState('');
    const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
    const [limit, setLimit] = useState('');
    const [subCompanies, setSubCompanies] = useState<SubCompany[]>([]);
    const [currentSubCompanyName, setCurrentSubCompanyName] = useState('');
    const [currentSubCompanySector, setCurrentSubCompanySector] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // State for inline editing
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
    const [editSubCompanyName, setEditSubCompanyName] = useState('');
    const [editSubCompanySector, setEditSubCompanySector] = useState('');

    // State for UI feedback & new selection logic
    const [copiedLink, setCopiedLink] = useState<string | null>(null);
    const [copiedAdminLink, setCopiedAdminLink] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedAttendeeIds, setSelectedAttendeeIds] = useState<Set<string>>(new Set());
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

    const sortedSuppliers = useMemo(() => 
        [...suppliers].sort((a, b) => a.name.localeCompare(b.name)), 
    [suppliers]);

    const formatCPF = (cpf: string) => {
        if (!cpf) return '';
        return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    };

    const handleSectorChange = (sectorId: string, isEditing: boolean) => {
        if (isEditing) {
            if (!editingSupplier) return;
            const current = editingSupplier.sectors || [];
            const newSectors = current.includes(sectorId)
                ? current.filter(s => s !== sectorId)
                : [...current, sectorId];
            setEditingSupplier({ ...editingSupplier, sectors: newSectors });
        } else {
            const current = selectedSectors;
            const newSectors = current.includes(sectorId)
                ? current.filter(s => s !== sectorId)
                : [...current, sectorId];
            setSelectedSectors(newSectors);
        }
    };
    
    // --- Sub-company handlers ---
    const handleAddSubCompany = (isEditing: boolean) => {
        const name = (isEditing ? editSubCompanyName : currentSubCompanyName).trim();
        const sector = isEditing ? editSubCompanySector : currentSubCompanySector;
        if (!name || !sector) return;

        if (isEditing) {
            if (editingSupplier) {
                const existingCompanies = editingSupplier.subCompanies || [];
                if (!existingCompanies.some(sc => sc.name === name)) {
                    setEditingSupplier({ ...editingSupplier, subCompanies: [...existingCompanies, { name, sector }] });
                }
            }
            setEditSubCompanyName('');
            setEditSubCompanySector('');
        } else {
            if (!subCompanies.some(sc => sc.name === name)) {
                setSubCompanies([...subCompanies, { name, sector }]);
            }
            setCurrentSubCompanyName('');
            setCurrentSubCompanySector('');
        }
    };
    
    const handleRemoveSubCompany = (companyNameToRemove: string, isEditing: boolean) => {
        if (isEditing) {
            if (editingSupplier) {
                setEditingSupplier({ ...editingSupplier, subCompanies: (editingSupplier.subCompanies || []).filter(sc => sc.name !== companyNameToRemove) });
            }
        } else {
            setSubCompanies(subCompanies.filter(sc => sc.name !== companyNameToRemove));
        }
    };


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!supplierName.trim()) {
            setError(t('suppliers.noNameError'));
            return;
        }
        if (!supplierEmail.trim()) {
            setError("O e-mail da divulgadora é obrigatório.");
            return;
        }
        if (selectedSectors.length === 0 && !isVip) {
            setError(t('suppliers.noSectorsError'));
            return;
        }
        const registrationLimit = parseInt(limit, 10);
        if (isNaN(registrationLimit) || registrationLimit <= 0) {
            setError(t('suppliers.noLimitError'));
            return;
        }

        let finalSectors = selectedSectors;
        if (isVip && selectedSectors.length === 0 && sectors.length > 0) {
            finalSectors = [sectors[0].id];
        }

        setIsSubmitting(true);
        try {
            await onAddSupplier(supplierName, finalSectors, registrationLimit, subCompanies, supplierEmail);
            setSupplierName('');
            setSupplierEmail('');
            setSelectedSectors([]);
            setLimit('');
            setSubCompanies([]);
            setCurrentSubCompanyName('');
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleEditClick = (supplier: Supplier, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingSupplier({...supplier});
        setEditSubCompanySector(sectors.length > 0 ? sectors[0].id : '');
        setExpandedSupplierId(null);
    };

    const handleCancelEdit = () => {
        setEditingSupplier(null);
    };
    
    const handleSaveEdit = async () => {
        if (!editingSupplier) return;

        if (!editingSupplier.name.trim()) {
            setError(t('suppliers.noNameError'));
            return;
        }
        if (editingSupplier.sectors.length === 0 && !isVip) {
            setError(t('suppliers.noSectorsError'));
            return;
        }
        
        const { id, ...dataToUpdate } = editingSupplier;
        await onUpdateSupplier(id, dataToUpdate);
        setEditingSupplier(null);
    };

    const handleCopyLink = (supplierId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const url = `${window.location.origin}?eventId=${currentEventId}&supplierId=${supplierId}`;
        navigator.clipboard.writeText(url);
        setCopiedLink(supplierId);
        setTimeout(() => setCopiedLink(null), 2000);
    };

    const handleCopyAdminLink = (token: string, supplierId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const url = `${window.location.origin}?verify=${token}`;
        navigator.clipboard.writeText(url);
        setCopiedAdminLink(supplierId);
        setTimeout(() => setCopiedAdminLink(null), 2000);
    };

    const handleRegenerateToken = async (supplier: Supplier, e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm(`Deseja gerar um novo link de organizador para "${supplier.name}"?`)) {
            const newToken = await onRegenerateAdminToken(supplier.id);
            handleCopyAdminLink(newToken, supplier.id, e);
        }
    };

    const handleDelete = async (supplier: Supplier, e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm(t('suppliers.deleteConfirm', { 0: supplier.name }))) {
            try {
                await onDeleteSupplier(supplier);
            } catch (err: any) {
                 if (err.message.includes("cannot be deleted")) {
                    setError(t('suppliers.deleteErrorInUse', { 0: supplier.name }));
                } else {
                    setError(err.message || 'Falha ao deletar.');
                }
            }
        }
    };

    const handleToggleSupplier = (supplierId: string) => {
        setExpandedSupplierId(prev => (prev === supplierId ? null : supplierId));
    };

    const handleToggleAttendee = (attendeeId: string) => {
        setSelectedAttendeeIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(attendeeId)) {
                newSet.delete(attendeeId);
            } else {
                newSet.add(attendeeId);
            }
            return newSet;
        });
    };

    const handleSelectAllInSupplier = (supplierAttendees: Attendee[]) => {
        const supplierAttendeeIds = supplierAttendees.map(a => a.id);
        const allSelectedInSupplier = supplierAttendeeIds.every(id => selectedAttendeeIds.has(id));

        setSelectedAttendeeIds(prev => {
            const newSet = new Set(prev);
            if (allSelectedInSupplier) {
                supplierAttendeeIds.forEach(id => newSet.delete(id));
            } else {
                supplierAttendeeIds.forEach(id => newSet.add(id));
            }
            return newSet;
        });
    };

    const handleSaveSectors = async (sectorIds: string[]) => {
        try {
            await onUpdateSectorsForSelectedAttendees(Array.from(selectedAttendeeIds), sectorIds);
            setSelectedAttendeeIds(new Set());
        } catch (error) {
            console.error(error);
            setError("Falha ao atualizar setores.");
        }
    };

    const handleBlockUser = async (attendeeId: string) => {
        const reason = window.prompt("Motivo do bloqueio (opcional):");
        if(reason !== null) await api.blockAttendee(currentEventId, attendeeId, reason);
    }

    const handleUnblockUser = async (attendeeId: string) => {
        if(window.confirm('Deseja realmente desbloquear?')) await api.unblockAttendee(currentEventId, attendeeId);
    }
    
    const renderSectorCheckboxes = (isEditing: boolean) => {
        const currentSectors = isEditing ? editingSupplier?.sectors || [] : selectedSectors;
        return sectors.map(sector => (
            <div key={sector.id} className="flex items-center space-x-3">
                <span className="w-5 h-5 rounded-full border border-gray-500" style={{ backgroundColor: sector.color || '#4B5563' }}></span>
                <input
                    type="checkbox"
                    id={`sector-${sector.id}-${isEditing}`}
                    checked={currentSectors.includes(sector.id)}
                    onChange={() => handleSectorChange(sector.id, isEditing)}
                    className="h-4 w-4 rounded border-gray-500 bg-gray-700 text-pink-600 focus:ring-pink-500"
                />
                <label htmlFor={`sector-${sector.id}-${isEditing}`} className="text-white cursor-pointer">{sector.label}</label>
            </div>
        ));
    };
    
    const renderSubCompanyManager = (isEditing: boolean) => {
        const currentList = isEditing ? editingSupplier?.subCompanies || [] : subCompanies;
        const nameValue = isEditing ? editSubCompanyName : currentSubCompanyName;
        const setNameValue = isEditing ? setEditSubCompanyName : setCurrentSubCompanyName;
        const sectorValue = isEditing ? editSubCompanySector : currentSubCompanySector;
        const setSectorValue = isEditing ? setEditSubCompanySector : setCurrentSubCompanySector;
        
        return (
            <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">{isVip ? "Grupos Vinculados" : t('suppliers.subCompaniesLabel')}</label>
                <div className="flex flex-col sm:flex-row gap-2">
                    <input
                        type="text" value={nameValue} onChange={(e) => setNameValue(e.target.value)}
                        className="flex-grow bg-gray-900/50 border border-gray-700/50 rounded-lg py-2 px-4 text-white focus:outline-none focus:ring-1 focus:ring-pink-500/50"
                        placeholder={isVip ? "Nome do Grupo" : t('suppliers.subCompaniesPlaceholder')}
                    />
                    <select
                        value={sectorValue} onChange={(e) => setSectorValue(e.target.value)}
                        className="bg-gray-900/50 border border-gray-700/50 rounded-lg py-2 px-4 text-white"
                    >
                        <option value="" disabled>{isVip ? "Tipo" : t('suppliers.subCompanySectorPlaceholder')}</option>
                        {sectors.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                    <button type="button" onClick={() => handleAddSubCompany(isEditing)} className="bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-4 rounded-lg">Adicionar</button>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                    {currentList.map(company => (
                        <div key={company.name} className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full flex items-center gap-2 border border-white/10 bg-white/5">
                            <span style={{ color: sectorMap.get(company.sector)?.color || '#E5E7EB' }}>{company.name}</span>
                            <button type="button" onClick={() => handleRemoveSubCompany(company.name, isEditing)} className="text-gray-400 hover:text-white"><XMarkIcon className="w-3 h-3"/></button>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="w-full max-w-7xl mx-auto space-y-6">
            <div className={`bg-gray-800/30 backdrop-blur-xl p-8 rounded-2xl shadow-2xl border ${isVip ? 'border-pink-500/20 shadow-pink-500/5' : 'border-gray-700/50'}`}>
                <h2 className="text-3xl font-extrabold text-white text-center mb-2 tracking-tight">{isVip ? "Gestão de Divulgadoras" : t('suppliers.generateTitle')}</h2>
                <p className="text-center text-gray-500 text-sm mb-8">{isVip ? "Crie links exclusivos para promoters." : "Crie links de cadastro para fornecedores."}</p>
                
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="supplierName" className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">{isVip ? "Nome da Divulgadora" : t('suppliers.nameLabel')}</label>
                            <input
                                type="text" id="supplierName" value={supplierName} onChange={(e) => setSupplierName(e.target.value)}
                                className="w-full bg-gray-900/50 border border-gray-700/50 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-pink-500/30"
                                placeholder={isVip ? "Ex: Divulgadora Maria" : t('suppliers.namePlaceholder')}
                            />
                        </div>
                        <div>
                            <label htmlFor="supplierEmail" className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">E-mail da Divulgadora</label>
                            <input
                                type="email" id="supplierEmail" value={supplierEmail} onChange={(e) => setSupplierEmail(e.target.value)}
                                className="w-full bg-gray-900/50 border border-gray-700/50 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-pink-500/30"
                                placeholder="exemplo@email.com"
                                required
                            />
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="limit" className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">{isVip ? "Limite de Convidados" : t('suppliers.limitLabel')}</label>
                            <input
                                type="number" id="limit" value={limit} onChange={(e) => setLimit(e.target.value)}
                                className="w-full bg-gray-900/50 border border-gray-700/50 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-pink-500/30"
                                placeholder="Ex: 100" min="1"
                            />
                        </div>
                        {!isVip && (
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">{t('suppliers.sectorsLabel')}</label>
                                <div className="grid grid-cols-2 gap-2 p-3 bg-gray-900/30 rounded-xl border border-gray-700/50">{renderSectorCheckboxes(false)}</div>
                            </div>
                        )}
                    </div>

                    {renderSubCompanyManager(false)}

                    <button type="submit" disabled={isSubmitting} className={`w-full text-white font-black uppercase tracking-widest py-4 rounded-xl transition-all ${isVip ? 'bg-gradient-to-r from-pink-600 to-rose-700 hover:scale-[1.01]' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                        {isVip ? "Cadastrar Divulgadora" : t('suppliers.generateButton')}
                    </button>
                </form>
            </div>

            <div className={`bg-gray-800/30 backdrop-blur-xl p-8 rounded-2xl shadow-2xl border ${isVip ? 'border-pink-500/20 shadow-pink-500/5' : 'border-gray-700/50'}`}>
                <h3 className="text-2xl font-bold text-white text-center mb-8">{isVip ? "Divulgadoras e Links Ativos" : t('suppliers.existingLinks')}</h3>
                <div className="grid grid-cols-1 gap-4">
                    {sortedSuppliers.map(supplier => {
                        const isExpanded = expandedSupplierId === supplier.id;
                        const currentCount = registrationCounts.get(supplier.id) || 0;
                        const supplierAttendees = attendees.filter(a => a.supplierId === supplier.id).sort((a,b) => a.name.localeCompare(b.name));
                        
                        return (
                            <div key={supplier.id} className="bg-gray-900/40 rounded-2xl overflow-hidden border border-gray-700/50">
                                <div onClick={() => handleToggleSupplier(supplier.id)} className="p-5 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 cursor-pointer hover:bg-white/5">
                                    <div className="flex-grow">
                                        <div className="flex items-center gap-3">
                                            <h4 className="font-black text-xl text-white tracking-tight">{supplier.name}</h4>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tighter ${supplier.active ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                                {supplier.active ? "Ativa" : "Inativa"}
                                            </span>
                                        </div>
                                        <p className="text-gray-500 text-xs mt-0.5 font-medium">{supplier.email || 'Sem e-mail'}</p>
                                        <div className="flex items-center gap-4 text-[10px] text-gray-500 mt-3 font-bold uppercase tracking-widest">
                                            <span className="flex items-center gap-1.5"><UsersIcon className="w-3 h-3"/> {isVip ? 'Convidados' : t('suppliers.registrations')}: <span className="text-white">{currentCount} / {supplier.registrationLimit}</span></span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                        <button onClick={() => onSupplierStatusUpdate(supplier.id, !supplier.active)} className="p-2 text-gray-500 hover:text-white rounded-xl hover:bg-gray-800">{supplier.active ? <NoSymbolIcon className="w-5 h-5"/> : <CheckCircleIcon className="w-5 h-5"/>}</button>
                                        <button onClick={(e) => handleCopyLink(supplier.id, e)} className="p-2 text-gray-500 hover:text-pink-400 rounded-xl hover:bg-gray-800">{copiedLink === supplier.id ? <CheckCircleIcon className="w-5 h-5 text-green-400"/> : <LinkIcon className="w-5 h-5"/>}</button>
                                        <button onClick={(e) => handleEditClick(supplier, e)} className="p-2 text-gray-500 hover:text-yellow-400 rounded-xl hover:bg-gray-800"><PencilIcon className="w-5 h-5"/></button>
                                        <button onClick={(e) => handleDelete(supplier, e)} className="p-2 text-gray-500 hover:text-red-500 rounded-xl hover:bg-gray-800"><TrashIcon className="w-5 h-5"/></button>
                                    </div>
                                </div>
                                {isExpanded && (
                                    <div className="p-6 border-t border-white/5 bg-black/40 overflow-x-auto">
                                        <table className="w-full text-xs text-left text-gray-400">
                                            <thead className="text-[10px] text-gray-500 uppercase font-black bg-gray-900/50">
                                                <tr><th className="px-4 py-3">Convidado</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-center">Ações</th></tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {supplierAttendees.map(attendee => (
                                                    <tr key={attendee.id}>
                                                        <td className="px-4 py-3"><div className="flex items-center gap-3"><UserAvatar src={attendee.photo} alt={attendee.name} className="w-10 h-10 rounded-full bg-black border border-white/10"/><p className="font-bold text-gray-200">{attendee.name}</p></div></td>
                                                        <td className="px-4 py-3">{t(`status.${attendee.status.toLowerCase()}`)}</td>
                                                        <td className="px-4 py-3 text-center">
                                                            {attendee.status === CheckinStatus.BLOCKED ? <button onClick={() => handleUnblockUser(attendee.id)} className="text-green-500">Desbloquear</button> : <button onClick={() => handleBlockUser(attendee.id)} className="text-red-500">Bloquear</button>}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
             <BulkUpdateSectorsModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveSectors} selectedCount={selectedAttendeeIds.size} allSectors={sectors} />
        </div>
    );
};

export default SupplierManagementView;