import React, { useState, useMemo } from 'react';
import { Supplier, Sector, Attendee } from '../../types.ts';
import { useTranslation } from '../../hooks/useTranslation.tsx';
import { LinkIcon, ClipboardDocumentIcon, NoSymbolIcon, CheckCircleIcon, PencilIcon, TrashIcon } from '../icons.tsx';

interface SupplierManagementViewProps {
    currentEventId: string;
    suppliers: Supplier[];
    attendees: Attendee[];
    sectors: Sector[];
    onAddSupplier: (name: string, sectors: string[], registrationLimit: number) => Promise<void>;
    onUpdateSupplier: (supplierId: string, data: Partial<Supplier>) => Promise<void>;
    onDeleteSupplier: (supplier: Supplier) => Promise<void>;
    onSupplierStatusUpdate: (supplierId: string, active: boolean) => Promise<void>;
    setError: (message: string) => void;
}

const SupplierManagementView: React.FC<SupplierManagementViewProps> = ({ currentEventId, suppliers, attendees, sectors, onAddSupplier, onUpdateSupplier, onDeleteSupplier, onSupplierStatusUpdate, setError }) => {
    const { t } = useTranslation();
    
    // State for the creation form
    const [supplierName, setSupplierName] = useState('');
    const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
    const [limit, setLimit] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // State for inline editing
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

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
        const stateSetter = isEditing ? (updater: (prev: string[]) => string[]) => setEditingSupplier(prev => prev ? {...prev, sectors: updater(prev.sectors)} : null) : setSelectedSectors;
        const currentSectors = isEditing ? editingSupplier?.sectors || [] : selectedSectors;

        stateSetter(prev =>
            currentSectors.includes(sectorId)
                ? currentSectors.filter(s => s !== sectorId)
                : [...currentSectors, sectorId]
        );
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
            await onAddSupplier(supplierName, selectedSectors, registrationLimit);
            setSupplierName('');
            setSelectedSectors([]);
            setLimit('');
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
    
    const getSectorLabel = (id: string) => {
        const sector = sectors.find(s => s.id === id);
        return sector ? sector.label : id;
    };

    const renderSectorCheckboxes = (isEditing: boolean) => {
        const currentSectors = isEditing ? editingSupplier?.sectors || [] : selectedSectors;
        
        return sectors.map(sector => (
            <label key={sector.id} className="flex items-center space-x-2 text-white cursor-pointer">
                <input
                    type="checkbox"
                    checked={currentSectors.includes(sector.id)}
                    onChange={() => handleSectorChange(sector.id, isEditing)}
                    className="h-4 w-4 rounded border-gray-500 bg-gray-700 text-indigo-600 focus:ring-indigo-500"
                    disabled={isSubmitting && !isEditing}
                />
                <span>{sector.label}</span>
            </label>
        ));
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
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                           {renderSectorCheckboxes(false)}
                        </div>
                    </div>
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
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 border-t border-gray-600 pt-3">
                                        {renderSectorCheckboxes(true)}
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
                                        <p className="text-sm text-gray-400 mt-1">
                                            Setores: {(supplier.sectors || []).map(getSectorLabel).join(', ')}
                                        </p>
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
                                         <button onClick={() => handleDelete(supplier)} className="bg-red-600 hover:bg-red-700 text-white font-bold p-2.5 rounded-lg flex items-center gap-2">
                                            <TrashIcon className="w-4 h-4" />
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