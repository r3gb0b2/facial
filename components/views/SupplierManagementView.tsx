import React, { useState, useMemo } from 'react';
// FIX: Add file extensions to local imports.
import { Supplier, Sector, Attendee, SubCompany } from '../../types.ts';
// FIX: Added .tsx extension to module import.
import { useTranslation } from '../../hooks/useTranslation.tsx';
import { LinkIcon, ClipboardDocumentIcon, NoSymbolIcon, CheckCircleIcon, PencilIcon, TrashIcon, XMarkIcon, EyeIcon, KeyIcon } from '../icons.tsx';

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
    setError: (message: string) => void;
}


const SupplierManagementView: React.FC<SupplierManagementViewProps> = ({ currentEventId, suppliers, attendees, sectors, onAddSupplier, onUpdateSupplier, onDeleteSupplier, onSupplierStatusUpdate, onRegenerateAdminToken, setError }) => {
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

    // State for UI feedback
    const [copiedLink, setCopiedLink] = useState<string | null>(null);
    const [copiedAdminLink, setCopiedAdminLink] = useState<string | null>(null);

    
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
    
    const handleEditClick = (supplier: Supplier) => {
        setEditingSupplier({...supplier});
        setEditSubCompanySector(sectors.length > 0 ? sectors[0].id : '');
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

    const handleCopyLink = (supplierId: string) => {
        const url = `${window.location.origin}?eventId=${currentEventId}&supplierId=${supplierId}`;
        navigator.clipboard.writeText(url);
        setCopiedLink(supplierId);
        setTimeout(() => setCopiedLink(null), 2000);
    };

    const handleCopyAdminLink = (token: string, supplierId: string) => {
        const url = `${window.location.origin}?verify=${token}`;
        navigator.clipboard.writeText(url);
        setCopiedAdminLink(supplierId);
        setTimeout(() => setCopiedAdminLink(null), 2000);
    };

    const handleRegenerateToken = async (supplier: Supplier) => {
        if (window.confirm(`Tem certeza que deseja gerar um novo link de administrador para "${supplier.name}"? O link antigo deixará de funcionar.`)) {
            const newToken = await onRegenerateAdminToken(supplier.id);
            handleCopyAdminLink(newToken, supplier.id);
        }
    };

    const handleDelete = async (supplier: Supplier) => {
        if (window.confirm(t('suppliers.deleteConfirm', supplier.name))) {
            try {
                await onDeleteSupplier(supplier);
            } catch (e: any) {
                 if (e.message.includes("cannot be deleted")) {
                    setError(t('suppliers.deleteErrorInUse', supplier.name));
                } else {
                    setError(e.message || 'Falha ao deletar o fornecedor.');
                }
            }
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
                {suppliers.length > 0 ? (
                    <div className="space-y-4">
                        {suppliers.map(supplier => {
                            const isEditing = editingSupplier?.id === supplier.id;
                            const currentCount = registrationCounts.get(supplier.id) || 0;
                            
                            return (
                                <div key={supplier.id} className="bg-gray-900/70 p-4 rounded-lg space-y-4 transition-all">
                                    {isEditing && editingSupplier ? (
                                        // EDITING VIEW
                                        <div className="space-y-4">
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
                                        // DISPLAY VIEW
                                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
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
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <button onClick={() => onSupplierStatusUpdate(supplier.id, !supplier.active)} className="p-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-gray-700" title={supplier.active ? t('suppliers.disableButton') : t('suppliers.enableButton')}>
                                                    {supplier.active ? <NoSymbolIcon className="w-5 h-5"/> : <CheckCircleIcon className="w-5 h-5"/>}
                                                </button>
                                                <button onClick={() => handleCopyLink(supplier.id)} className="p-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-gray-700" title={t('suppliers.copyButton')}>
                                                    {copiedLink === supplier.id ? <CheckCircleIcon className="w-5 h-5 text-green-400"/> : <LinkIcon className="w-5 h-5"/>}
                                                </button>
                                                {supplier.adminToken && (
                                                    <>
                                                        <button onClick={() => handleCopyAdminLink(supplier.adminToken!, supplier.id)} className="p-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-gray-700" title={t('suppliers.adminLink.copyTooltip')}>
                                                          {copiedAdminLink === supplier.id ? <CheckCircleIcon className="w-5 h-5 text-green-400"/> : <EyeIcon className="w-5 h-5"/>}
                                                        </button>
                                                        <button onClick={() => handleRegenerateToken(supplier)} className="p-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-gray-700" title={t('suppliers.adminLink.regenerateTooltip')}>
                                                          <KeyIcon className="w-5 h-5"/>
                                                        </button>
                                                    </>
                                                )}
                                                <button onClick={() => handleEditClick(supplier)} className="p-2 text-gray-400 hover:text-yellow-400 transition-colors rounded-full hover:bg-gray-700" title={t('suppliers.editButton')}>
                                                    <PencilIcon className="w-5 h-5"/>
                                                </button>
                                                <button onClick={() => handleDelete(supplier)} className="p-2 text-gray-400 hover:text-red-400 transition-colors rounded-full hover:bg-gray-700" title={t('suppliers.deleteButton')}>
                                                    <TrashIcon className="w-5 h-5"/>
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                     <p className="text-center text-gray-500">{t('suppliers.noLinks')}</p>
                )}
            </div>
        </div>
    );
};

// FIX: Added missing default export.
export default SupplierManagementView;
