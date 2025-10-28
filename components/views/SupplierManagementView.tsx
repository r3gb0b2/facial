import React, { useState, useMemo } from 'react';
import { Supplier, Sector, Attendee, SubCompany } from '../../types';
// FIX: Added .tsx extension to module import.
import { useTranslation } from '../../hooks/useTranslation.tsx';
import { LinkIcon, ClipboardDocumentIcon, NoSymbolIcon, CheckCircleIcon, PencilIcon, TrashIcon, XMarkIcon } from '../icons';

interface SupplierManagementViewProps {
    currentEventId: string;
    suppliers: Supplier[];
    attendees: Attendee[];
    sectors: Sector[];
    onAddSupplier: (name: string, sectors: string[], registrationLimit: number, subCompanies: SubCompany[]) => Promise<void>;
    onUpdateSupplier: (supplierId: string, data: Partial<Supplier>) => Promise<void>;
    onDeleteSupplier: (supplier: Supplier) => Promise<void>;
    onSupplierStatusUpdate: (supplierId: string, active: boolean) => Promise<void>;
    setError: (message: string) => void;
}

// Helper to determine text color based on background
const getTextColorForBackground = (hexcolor: string): 'black' | 'white' => {
  if (!hexcolor) return 'white';
  const hex = hexcolor.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 128) ? 'black' : 'white';
};


const SupplierManagementView: React.FC<SupplierManagementViewProps> = ({ currentEventId, suppliers, attendees, sectors, onAddSupplier, onUpdateSupplier, onDeleteSupplier, onSupplierStatusUpdate, setError }) => {
    const { t } = useTranslation();
    
    // State for the creation form
    const [supplierName, setSupplierName] = useState('');
    const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
    const [limit, setLimit] = useState('');
    const [subCompanies, setSubCompanies] = useState<SubCompany[]>([]);
    const [currentSubCompanyName, setCurrentSubCompanyName] = useState('');
    const [currentSubCompanyColor, setCurrentSubCompanyColor] = useState('#4f46e5'); // Default indigo
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // State for inline editing
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
    const [editSubCompanyName, setEditSubCompanyName] = useState('');
    const [editSubCompanyColor, setEditSubCompanyColor] = useState('#4f46e5');

    // State for UI feedback
    const [copiedLink, setCopiedLink] = useState<string | null>(null);
    
    const registrationCounts = useMemo(() => {
        const counts = new Map<string, number>();
        for (const attendee of attendees) {
            if (attendee.supplierId) {
                counts.set(attendee.supplierId, (counts.get(attendee.supplierId) || 0) + 1);
            }
        }
        return counts;
    }, [attendees]);

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
        const color = isEditing ? editSubCompanyColor : currentSubCompanyColor;
        if (!name) return;

        if (isEditing) {
            if (editingSupplier) {
                const existingCompanies = editingSupplier.subCompanies || [];
                if (!existingCompanies.some(sc => sc.name === name)) {
                    setEditingSupplier({ ...editingSupplier, subCompanies: [...existingCompanies, { name, color }] });
                }
            }
            setEditSubCompanyName('');
            setEditSubCompanyColor('#4f46e5');
        } else {
            if (!subCompanies.some(sc => sc.name === name)) {
                setSubCompanies([...subCompanies, { name, color }]);
            }
            setCurrentSubCompanyName('');
            setCurrentSubCompanyColor('#4f46e5');
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

    const handleCopyLink = (supplier: Supplier) => {
        const url = `${window.location.origin}?eventId=${currentEventId}&supplierId=${supplier.id}`;
        navigator.clipboard.writeText(url);
        setCopiedLink(supplier.id);
        setTimeout(() => setCopiedLink(null), 2000);
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
    
    const getSectorInfo = (id: string) => {
        return sectors.find(s => s.id === id) || { label: id, color: '#4B5563' };
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
        const colorValue = isEditing ? editSubCompanyColor : currentSubCompanyColor;
        const setColorValue = isEditing ? setEditSubCompanyColor : setCurrentSubCompanyColor;
        
        return (
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">{t('suppliers.subCompaniesLabel')}</label>
                <div className="flex flex-col sm:flex-row gap-2">
                    <input
                        type="text"
                        value={nameValue}
                        onChange={(e) => setNameValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSubCompany(isEditing))}
                        className="flex-grow bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder={t('suppliers.subCompaniesPlaceholder')}
                    />
                    <div className="flex items-center gap-2">
                        <label htmlFor={`color-picker-${isEditing}`} className="text-sm font-medium text-gray-300">{t('suppliers.subCompanyColorLabel')}:</label>
                        <input
                            type="color"
                            id={`color-picker-${isEditing}`}
                            value={colorValue}
                            onChange={(e) => setColorValue(e.target.value)}
                            className="h-10 w-12 bg-gray-900 border border-gray-600 rounded-md cursor-pointer"
                        />
                        <button type="button" onClick={() => handleAddSubCompany(isEditing)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg flex-shrink-0">{t('suppliers.addSubCompanyButton')}</button>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                    {currentList.map(company => (
                        <div key={company.name} className="text-sm font-medium px-3 py-1 rounded-full flex items-center gap-2" style={{ backgroundColor: company.color, color: getTextColorForBackground(company.color) }}>
                            <span>{company.name}</span>
                            <button type="button" onClick={() => handleRemoveSubCompany(company.name, isEditing)} className="text-current opacity-70 hover:opacity-100">
                                <XMarkIcon className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        );
    };


    return (
        <div className="w-full max-w-4xl mx-auto space-y-10">
            {/* Form for new supplier */}
            <div className="bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-gray-700">
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                    <LinkIcon className="w-7 h-7"/>
                    {t('suppliers.generateTitle')}
                </h2>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="supplierName" className="block text-sm font-medium text-gray-300 mb-1">{t('suppliers.nameLabel')}</label>
                            <input
                                type="text" id="supplierName" value={supplierName}
                                onChange={(e) => setSupplierName(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder={t('suppliers.namePlaceholder')} disabled={isSubmitting}
                            />
                        </div>
                        <div>
                            <label htmlFor="limit" className="block text-sm font-medium text-gray-300 mb-1">{t('suppliers.limitLabel')}</label>
                            <input
                                type="number" id="limit" value={limit}
                                onChange={(e) => setLimit(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder={t('suppliers.limitPlaceholder')} disabled={isSubmitting} min="1"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">{t('suppliers.sectorsLabel')}</label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                           {renderSectorCheckboxes(false)}
                        </div>
                    </div>
                    {renderSubCompanyManager(false)}
                    <button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:bg-indigo-400 disabled:cursor-wait">
                        {isSubmitting ? 'Gerando...' : t('suppliers.generateButton')}
                    </button>
                </form>
            </div>

            {/* List of existing suppliers */}
            <div>
                <h3 className="text-xl font-bold text-white mb-4">{t('suppliers.existingLinks')}</h3>
                {suppliers.length > 0 ? (
                    <div className="space-y-4">
                        {suppliers.map(supplier => (
                            editingSupplier?.id === supplier.id ? (
                                // EDITING VIEW
                                <div key={supplier.id} className="bg-gray-700 p-4 rounded-lg border-2 border-indigo-500 space-y-4">
                                    <input
                                        type="text" value={editingSupplier.name}
                                        onChange={(e) => setEditingSupplier({...editingSupplier, name: e.target.value })}
                                        className="w-full bg-gray-800 border border-gray-600 rounded-md py-2 px-3 text-white"
                                    />
                                    <input
                                        type="number" value={editingSupplier.registrationLimit}
                                        onChange={(e) => setEditingSupplier({...editingSupplier, registrationLimit: parseInt(e.target.value, 10) || 0 })}
                                        className="w-full bg-gray-800 border border-gray-600 rounded-md py-2 px-3 text-white"
                                    />
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-gray-600 pt-3">
                                        {renderSectorCheckboxes(true)}
                                    </div>
                                    <div className="border-t border-gray-600 pt-3">
                                        {renderSubCompanyManager(true)}
                                    </div>
                                    <div className="flex justify-end gap-2">
                                        <button onClick={handleCancelEdit} className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg">{t('suppliers.cancelButton')}</button>
                                        <button onClick={handleSaveEdit} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg">{t('suppliers.saveButton')}</button>
                                    </div>
                                </div>
                            ) : (
                                // NORMAL VIEW
                                <div key={supplier.id} className="bg-gray-800 p-4 rounded-lg border border-gray-700 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                    <div className="flex-grow">
                                        <div className="flex items-center gap-3 mb-1">
                                            <p className="font-bold text-white">{supplier.name}</p>
                                            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${supplier.active ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-200'}`}>
                                            {supplier.active ? t('suppliers.active') : t('suppliers.inactive')}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-400">
                                            {t('suppliers.registrations')}: {registrationCounts.get(supplier.id) || 0} / {supplier.registrationLimit}
                                        </p>
                                        <div className="text-sm text-gray-400 mt-1 flex items-center flex-wrap gap-x-4 gap-y-1">
                                            <span>Setores:</span>
                                            <div className="flex flex-wrap items-center gap-2">
                                            {(supplier.sectors || []).map(sectorId => {
                                                const sector = getSectorInfo(sectorId);
                                                return (
                                                <div key={sectorId} className="flex items-center gap-1.5">
                                                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: sector.color }}></span>
                                                    <span>{sector.label}</span>
                                                </div>
                                            )})}
                                            </div>
                                        </div>
                                         {(supplier.subCompanies && supplier.subCompanies.length > 0) && (
                                            <div className="text-sm text-gray-400 mt-2">
                                                <span className="font-medium">Sub-empresas:</span>
                                                <div className="flex flex-wrap gap-2 mt-1">
                                                    {supplier.subCompanies.map(sc => (
                                                        <span key={sc.name} className="px-2 py-1 text-xs rounded-full" style={{ backgroundColor: sc.color, color: getTextColorForBackground(sc.color) }}>
                                                            {sc.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <button onClick={() => handleCopyLink(supplier)} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-3 rounded-lg flex items-center gap-2 justify-center w-32">
                                            {copiedLink === supplier.id ? <><CheckCircleIcon className="w-5 h-5" /><span>{t('suppliers.copiedButton')}</span></> : <><ClipboardDocumentIcon className="w-5 h-5" /><span>{t('suppliers.copyButton')}</span></>}
                                        </button>
                                        <button onClick={() => onSupplierStatusUpdate(supplier.id, !supplier.active)} className={`font-bold py-2 px-3 rounded-lg flex items-center gap-2 ${supplier.active ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white`}>
                                            {supplier.active ? <NoSymbolIcon className="w-4 h-4"/> : <CheckCircleIcon className="w-4 h-4"/>}
                                            {supplier.active ? t('suppliers.disableButton') : t('suppliers.enableButton')}
                                        </button>
                                        <button onClick={() => handleEditClick(supplier)} className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-2 px-3 rounded-lg flex items-center gap-2">
                                            <PencilIcon className="w-4 h-4" />
                                            {t('suppliers.editButton')}
                                        </button>
                                         <button onClick={() => handleDelete(supplier)} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-3 rounded-lg flex items-center gap-2">
                                            <TrashIcon className="w-4 h-4" />
                                            <span>{t('suppliers.deleteButton')}</span>
                                        </button>
                                    </div>
                                </div>
                            )
                        ))}
                    </div>
                ) : (
                    <p className="text-gray-500 text-center py-4">{t('suppliers.noLinks')}</p>
                )}
            </div>
        </div>
    );
};

export default SupplierManagementView;