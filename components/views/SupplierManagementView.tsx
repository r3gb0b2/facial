
import React, { useState, useMemo } from 'react';
// FIX: Add file extensions to local imports.
import { Supplier, Sector, Attendee, SubCompany, CheckinStatus } from '../../types.ts';
// FIX: Added .tsx extension to module import.
import { useTranslation } from '../../hooks/useTranslation.tsx';
import { LinkIcon, ClipboardDocumentIcon, NoSymbolIcon, CheckCircleIcon, PencilIcon, TrashIcon, XMarkIcon, EyeIcon, KeyIcon } from '../icons.tsx';
import BulkUpdateSectorsModal from '../CompanySectorsModal.tsx';
import * as api from '../../firebase/service.ts';

interface SupplierManagementViewProps {
    currentEventId: string;
    suppliers: Supplier[];
    attendees: Attendee[];
    sectors: Sector[];
    onAddSupplier: (name: string, sectors: string[], registrationLimit: number, subCompanies: SubCompany[]) => Promise<void>;
    onUpdateSupplier: (supplierId: string, data: Partial<Supplier>) => Promise<void>;
    onDeleteSupplier: (supplier: Supplier) => Promise<void>;
    onSupplierStatusUpdate: (supplierId: string, active: boolean) => Promise<void>;
    onRegenerateAdminToken: (supplierId: string) => Promise<string>;
    onUpdateSectorsForSelectedAttendees: (attendeeIds: string[], sectorIds: string[]) => Promise<void>;
    setError: (message: string) => void;
}

const formatCPF = (cpf: string) => {
  if (!cpf) return '';
  return cpf
    .replace(/\D/g, '')
    .slice(0, 11)
    .replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
};

const formatTimestamp = (timestamp: any) => {
    if (!timestamp || !timestamp.seconds) return '';
    return new Date(timestamp.seconds * 1000).toLocaleString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit'
    });
};


const SupplierManagementView: React.FC<SupplierManagementViewProps> = ({ currentEventId, suppliers, attendees, sectors, onAddSupplier, onUpdateSupplier, onDeleteSupplier, onSupplierStatusUpdate, onRegenerateAdminToken, onUpdateSectorsForSelectedAttendees, setError }) => {
    const { t } = useTranslation();
    
    // State for the creation form
    const [supplierName, setSupplierName] = useState('');
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
        if (selectedSectors.length === 0) {
            setError(t('suppliers.noSectorsError'));
            return;
        }
        const registrationLimit = parseInt(limit, 10);
        if (isNaN(registrationLimit) || registrationLimit <= 0) {
            setError(t('suppliers.noLimitError'));
            return;
        }

        setIsSubmitting(true);
        try {
            await onAddSupplier(supplierName, selectedSectors, registrationLimit, subCompanies);
            setSupplierName('');
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
        if (editingSupplier.sectors.length === 0) {
            setError(t('suppliers.noSectorsError'));
            return;
        }
        if (isNaN(editingSupplier.registrationLimit) || editingSupplier.registrationLimit <= 0) {
            setError(t('suppliers.noLimitError'));
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
        if (window.confirm(`Tem certeza que deseja gerar um novo link de administrador para "${supplier.name}"? O link antigo deixará de funcionar.`)) {
            const newToken = await onRegenerateAdminToken(supplier.id);
            handleCopyAdminLink(newToken, supplier.id, e);
        }
    };

    const handleDelete = async (supplier: Supplier, e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm(t('suppliers.deleteConfirm', supplier.name))) {
            try {
                await onDeleteSupplier(supplier);
            } catch (err: any) {
                 if (err.message.includes("cannot be deleted")) {
                    setError(t('suppliers.deleteErrorInUse', supplier.name));
                } else {
                    setError(err.message || 'Falha ao deletar o fornecedor.');
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
            console.error("Failed to update sectors:", error);
            setError("Falha ao atualizar setores.");
        }
    };
    
    const handleBlockAttendee = async (attendeeId: string) => {
        if (window.confirm("Tem certeza que deseja bloquear este colaborador? Ele não poderá fazer check-in.")) {
            try {
                await api.blockAttendee(currentEventId, attendeeId);
            } catch (e) {
                setError("Falha ao bloquear.");
            }
        }
    };

    const handleUnblockAttendee = async (attendeeId: string) => {
         try {
            await api.unblockAttendee(currentEventId, attendeeId);
        } catch (e) {
            setError("Falha ao desbloquear.");
        }
    };

    
    const renderSectorCheckboxes = (isEditing: boolean) => {
        const currentSectors = isEditing ? editingSupplier?.sectors || [] : selectedSectors;
        
        return sectors.map(sector => (
            <div key={sector.id} className="flex items-center space-x-3">
                <span className="w-5 h-5 rounded-full border border-gray-500 flex-shrink-0" style={{ backgroundColor: sector.color || '#4B5563' }}></span>
                <input
                    type="checkbox"
                    id={`sector-${sector.id}-${isEditing}`}
                    checked={currentSectors.includes(sector.id)}
                    onChange={() => handleSectorChange(sector.id, isEditing)}
                    className="h-4 w-4 rounded border-gray-500 bg-gray-700 text-indigo-600 focus:ring-indigo-500"
                    disabled={isSubmitting && !isEditing}
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
                <label className="block text-sm font-medium text-gray-300 mb-2">{t('suppliers.subCompaniesLabel')}</label>
                <div className="flex flex-col sm:flex-row gap-2">
                    <input
                        type="text"
                        value={nameValue}
                        onChange={(e) => setNameValue(e.target.value)}
                        className="flex-grow bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder={t('suppliers.subCompaniesPlaceholder')}
                    />
                    <select
                        value={sectorValue}
                        onChange={(e) => setSectorValue(e.target.value)}
                        className="bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="" disabled>{t('suppliers.subCompanySectorPlaceholder')}</option>
                        {sectors.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                    <button type="button" onClick={() => handleAddSubCompany(isEditing)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg flex-shrink-0">{t('suppliers.addSubCompanyButton')}</button>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                    {currentList.map(company => {
                        const sectorInfo = sectorMap.get(company.sector);
                        return (
                            <div key={company.name} className="text-sm font-medium px-3 py-1 rounded-full flex items-center gap-2" style={{ backgroundColor: sectorInfo?.color ? `${sectorInfo.color}33` : '#4B556333' }}>
                                <span style={{ color: sectorInfo?.color || '#E5E7EB' }}>{company.name}</span>
                                <button type="button" onClick={() => handleRemoveSubCompany(company.name, isEditing)} className="text-gray-400 hover:text-white">
                                    <XMarkIcon className="w-3 h-3"/>
                                </button>
                            </div>
                        )
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="w-full max-w-7xl mx-auto space-y-6">
            <div className="bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-gray-700">
                <h2 className="text-3xl font-bold text-white text-center mb-6">{t('suppliers.generateTitle')}</h2>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="supplierName" className="block text-sm font-medium text-gray-300 mb-1">{t('suppliers.nameLabel')}</label>
                            <input
                                type="text" id="supplierName" value={supplierName} onChange={(e) => setSupplierName(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder={t('suppliers.namePlaceholder')}
                            />
                        </div>
                        <div>
                            <label htmlFor="limit" className="block text-sm font-medium text-gray-300 mb-1">{t('suppliers.limitLabel')}</label>
                            <input
                                type="number" id="limit" value={limit} onChange={(e) => setLimit(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder={t('suppliers.limitPlaceholder')}
                                min="1"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">{t('suppliers.sectorsLabel')}</label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 p-4 bg-gray-900/50 rounded-lg">
                            {renderSectorCheckboxes(false)}
                        </div>
                    </div>

                    {renderSubCompanyManager(false)}

                    <button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-300 disabled:bg-gray-500">
                        {t('suppliers.generateButton')}
                    </button>
                </form>
            </div>

            <div className="bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-gray-700">
                <h3 className="text-2xl font-bold text-white text-center mb-6">{t('suppliers.existingLinks')}</h3>
                {sortedSuppliers.length > 0 ? (
                    <div className="space-y-4">
                        {sortedSuppliers.map(supplier => {
                            const isEditing = editingSupplier?.id === supplier.id;
                            const isExpanded = expandedSupplierId === supplier.id;
                            const currentCount = registrationCounts.get(supplier.id) || 0;
                            const supplierAttendees = attendees
                                .filter(a => a.supplierId === supplier.id)
                                .sort((a, b) => a.name.localeCompare(b.name));
                            const allInSupplierSelected = supplierAttendees.length > 0 && supplierAttendees.every(a => selectedAttendeeIds.has(a.id));

                            return (
                                <div key={supplier.id} className="bg-gray-900/70 rounded-lg overflow-hidden transition-all">
                                    {isEditing && editingSupplier ? (
                                        <div className="p-4 space-y-4">
                                            <input type="text" value={editingSupplier.name} onChange={(e) => setEditingSupplier({ ...editingSupplier, name: e.target.value })} className="w-full bg-gray-800 border border-gray-600 rounded-md py-2 px-3 text-white"/>
                                            <input type="number" value={editingSupplier.registrationLimit} onChange={(e) => setEditingSupplier({ ...editingSupplier, registrationLimit: parseInt(e.target.value, 10) || 0 })} className="w-full bg-gray-800 border border-gray-600 rounded-md py-2 px-3 text-white"/>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2 bg-gray-800/50 rounded-lg">{renderSectorCheckboxes(true)}</div>
                                            {renderSubCompanyManager(true)}
                                            <div className="flex justify-end gap-2">
                                                <button onClick={handleCancelEdit} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">{t('suppliers.cancelButton')}</button>
                                                <button onClick={handleSaveEdit} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg">{t('suppliers.saveButton')}</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                        <div onClick={() => handleToggleSupplier(supplier.id)} className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 cursor-pointer hover:bg-gray-800/50 border-b border-gray-800">
                                            <div className="flex-grow">
                                                <h4 className="font-bold text-lg text-white">{supplier.name}</h4>
                                                <div className="flex items-center gap-2 text-sm text-gray-400 mt-1">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${supplier.active ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                                                        {supplier.active ? t('suppliers.active') : t('suppliers.inactive')}
                                                    </span>
                                                    <span>&bull;</span>
                                                    <span>{t('suppliers.registrations')}: {currentCount} / {supplier.registrationLimit}</span>
                                                </div>
                                                 <div className="flex flex-wrap gap-1 mt-2">
                                                    {(supplier.sectors || []).map(id => {
                                                        const sector = sectorMap.get(id);
                                                        return sector ? <span key={id} className="text-xs font-medium px-2 py-1 rounded-full" style={{ backgroundColor: `${sector.color}33`, color: sector.color }}>{sector.label}</span> : null
                                                    })}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 flex-wrap" onClick={e => e.stopPropagation()}>
                                                <button onClick={(e) => onSupplierStatusUpdate(supplier.id, !supplier.active)} className="p-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-gray-700" title={supplier.active ? t('suppliers.disableButton') : t('suppliers.enableButton')}>
                                                    {supplier.active ? <NoSymbolIcon className="w-5 h-5"/> : <CheckCircleIcon className="w-5 h-5"/>}
                                                </button>
                                                <button onClick={(e) => handleCopyLink(supplier.id, e)} className="p-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-gray-700" title={t('suppliers.copyButton')}>
                                                    {copiedLink === supplier.id ? <CheckCircleIcon className="w-5 h-5 text-green-400"/> : <LinkIcon className="w-5 h-5"/>}
                                                </button>
                                                {supplier.adminToken && (
                                                    <>
                                                        <button onClick={(e) => handleCopyAdminLink(supplier.adminToken!, supplier.id, e)} className="p-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-gray-700" title={t('suppliers.adminLink.copyTooltip')}>
                                                          {copiedAdminLink === supplier.id ? <CheckCircleIcon className="w-5 h-5 text-green-400"/> : <EyeIcon className="w-5 h-5"/>}
                                                        </button>
                                                        <button onClick={(e) => handleRegenerateToken(supplier, e)} className="p-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-gray-700" title={t('suppliers.adminLink.regenerateTooltip')}>
                                                          <KeyIcon className="w-5 h-5"/>
                                                        </button>
                                                    </>
                                                )}
                                                <button onClick={(e) => handleEditClick(supplier, e)} className="p-2 text-gray-400 hover:text-yellow-400 transition-colors rounded-full hover:bg-gray-700" title={t('suppliers.editButton')}>
                                                    <PencilIcon className="w-5 h-5"/>
                                                </button>
                                                <button onClick={(e) => handleDelete(supplier, e)} className="p-2 text-gray-400 hover:text-red-400 transition-colors rounded-full hover:bg-gray-700" title={t('suppliers.deleteButton')}>
                                                    <TrashIcon className="w-5 h-5"/>
                                                </button>
                                                 <svg className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </div>
                                        </div>
                                         {isExpanded && (
                                            <div className="p-4 border-t border-gray-700 bg-black/20">
                                                {supplierAttendees.length > 0 ? (
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full text-sm text-left text-gray-300">
                                                            <thead className="text-xs text-gray-400 uppercase bg-gray-800/50">
                                                                <tr>
                                                                    <th scope="col" className="p-4">
                                                                        <div className="flex items-center">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={allInSupplierSelected}
                                                                                onChange={() => handleSelectAllInSupplier(supplierAttendees)}
                                                                                className="h-4 w-4 rounded border-gray-500 bg-gray-700 text-indigo-600 focus:ring-indigo-500"
                                                                            />
                                                                        </div>
                                                                    </th>
                                                                    <th scope="col" className="px-6 py-3">{t('suppliers.table.colaborador')}</th>
                                                                    <th scope="col" className="px-6 py-3">{t('suppliers.table.documento')}</th>
                                                                    <th scope="col" className="px-6 py-3">{t('suppliers.table.origem')}</th>
                                                                    <th scope="col" className="px-6 py-3">{t('suppliers.table.checkin')}</th>
                                                                    <th scope="col" className="px-6 py-3 text-right">{t('suppliers.table.acoes')}</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {supplierAttendees.map((attendee) => {
                                                                    const attendeeSectors = (attendee.sectors || []).map(id => sectorMap.get(id)).filter(Boolean);
                                                                    const statusLabel = t(`status.${attendee.status.toLowerCase()}`);
                                                                    const isBlocked = attendee.status === CheckinStatus.BLOCKED || attendee.status === CheckinStatus.REJECTED;
                                                                    
                                                                    // Determine status style
                                                                    const statusStyle = {
                                                                        [CheckinStatus.PENDING]: 'bg-gray-600 text-gray-200',
                                                                        [CheckinStatus.CHECKED_IN]: 'bg-green-600 text-white',
                                                                        [CheckinStatus.CHECKED_OUT]: 'bg-slate-500 text-white',
                                                                        [CheckinStatus.CANCELLED]: 'bg-red-600 text-white',
                                                                        [CheckinStatus.SUBSTITUTION]: 'bg-yellow-500 text-black',
                                                                        [CheckinStatus.SUBSTITUTION_REQUEST]: 'bg-blue-500 text-white',
                                                                        [CheckinStatus.SECTOR_CHANGE_REQUEST]: 'bg-purple-500 text-white',
                                                                        [CheckinStatus.PENDING_APPROVAL]: 'bg-yellow-500 text-black',
                                                                        [CheckinStatus.MISSED]: 'bg-gray-800 text-gray-400',
                                                                        [CheckinStatus.REJECTED]: 'bg-red-800 text-red-200 border border-red-500',
                                                                        [CheckinStatus.BLOCKED]: 'bg-red-900 text-red-100 border border-red-500 font-bold',
                                                                    }[attendee.status] || 'bg-gray-600 text-gray-200';

                                                                    return (
                                                                        <tr key={attendee.id} className={`border-b border-gray-700 hover:bg-gray-700/50 ${isBlocked ? 'bg-red-900/10' : 'bg-gray-800/50'}`}>
                                                                            <td className="w-4 p-4">
                                                                                <div className="flex items-center">
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        checked={selectedAttendeeIds.has(attendee.id)}
                                                                                        onChange={() => handleToggleAttendee(attendee.id)}
                                                                                        className="h-4 w-4 rounded border-gray-500 bg-gray-700 text-indigo-600 focus:ring-indigo-500"
                                                                                    />
                                                                                </div>
                                                                            </td>
                                                                            <td className="px-6 py-4 font-medium text-white">
                                                                                <div className="flex items-center gap-3">
                                                                                    <img src={attendee.photo} alt={attendee.name} className="w-10 h-10 rounded-full object-cover bg-black border border-gray-600" />
                                                                                    <div>
                                                                                        <p className="font-bold text-sm">{attendee.name}</p>
                                                                                        <p className="text-xs text-gray-400">{attendee.subCompany || '-'}</p>
                                                                                         <div className="flex flex-wrap gap-1 mt-1">
                                                                                            {attendeeSectors.map((s: any) => (
                                                                                                <span key={s.id} className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${s.color}33`, color: s.color }}>
                                                                                                    {s.label}
                                                                                                </span>
                                                                                            ))}
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            </td>
                                                                            <td className="px-6 py-4 font-mono text-xs text-gray-300 whitespace-nowrap">
                                                                                {formatCPF(attendee.cpf)}
                                                                            </td>
                                                                            <td className="px-6 py-4 text-xs text-gray-400">
                                                                                 <p>{t('suppliers.trace.registeredBy', { supplier: supplier.name })}</p>
                                                                            </td>
                                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                                <div className="flex flex-col gap-1">
                                                                                    <span className={`text-xs font-medium px-2 py-0.5 rounded w-fit ${statusStyle}`}>
                                                                                        {statusLabel}
                                                                                    </span>
                                                                                    {attendee.checkinTime && (
                                                                                        <span className="text-[10px] text-gray-500">
                                                                                            {t('suppliers.trace.checkedInBy', { user: attendee.checkedInBy || 'System', time: formatTimestamp(attendee.checkinTime) })}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </td>
                                                                             <td className="px-6 py-4 text-right">
                                                                                {isBlocked ? (
                                                                                    <button 
                                                                                        onClick={() => handleUnblockAttendee(attendee.id)}
                                                                                        className="text-xs bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded"
                                                                                    >
                                                                                        {t('suppliers.actions.unblock')}
                                                                                    </button>
                                                                                ) : (
                                                                                    <button 
                                                                                        onClick={() => handleBlockAttendee(attendee.id)}
                                                                                        className="text-xs bg-red-600/80 hover:bg-red-700 text-white px-2 py-1 rounded border border-red-500"
                                                                                        title="Adicionar registro negativo"
                                                                                    >
                                                                                        {t('suppliers.actions.block')}
                                                                                    </button>
                                                                                )}
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-gray-500 text-center py-4">Nenhum colaborador cadastrado para este fornecedor.</p>
                                                )}
                                            </div>
                                         )}
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                     <p className="text-center text-gray-500">{t('suppliers.noLinks')}</p>
                )}
            </div>
             {selectedAttendeeIds.size > 0 && (
                <div className="fixed bottom-5 right-5 z-20 bg-gray-800 border border-gray-600 shadow-2xl rounded-lg p-3 flex items-center gap-4 animate-fade-in-up">
                    <p className="text-white font-semibold">{t('companies.selectedCount', selectedAttendeeIds.size)}</p>
                    <button 
                        onClick={() => setIsModalOpen(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"
                    >
                       <PencilIcon className="w-4 h-4" />
                       {t('companies.editSelectedButton')}
                    </button>
                </div>
            )}
             <BulkUpdateSectorsModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveSectors}
                selectedCount={selectedAttendeeIds.size}
                allSectors={sectors}
            />
        </div>
    );
};

export default SupplierManagementView;
