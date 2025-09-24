import React, { useState } from 'react';
import { Supplier } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';
import { LinkIcon, ClipboardDocumentIcon, NoSymbolIcon, CheckCircleIcon } from '../icons';

interface SupplierManagementViewProps {
    currentEventId: string;
    suppliers: Supplier[];
    onAddSupplier: (name: string, sectors: string[]) => Promise<void>;
    onSupplierStatusUpdate: (supplierId: string, active: boolean) => Promise<void>;
    setError: (message: string) => void;
}

const SupplierManagementView: React.FC<SupplierManagementViewProps> = ({ currentEventId, suppliers, onAddSupplier, onSupplierStatusUpdate, setError }) => {
    const { t, sectors } = useTranslation();
    const [supplierName, setSupplierName] = useState('');
    const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [copiedLink, setCopiedLink] = useState<string | null>(null);

    const handleSectorChange = (sectorValue: string) => {
        setSelectedSectors(prev =>
            prev.includes(sectorValue)
                ? prev.filter(s => s !== sectorValue)
                : [...prev, sectorValue]
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
        setIsSubmitting(true);
        try {
            await onAddSupplier(supplierName, selectedSectors);
            setSupplierName('');
            setSelectedSectors([]);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCopyLink = (supplier: Supplier) => {
        const url = `${window.location.origin}?eventId=${currentEventId}&supplierId=${supplier.id}`;
        navigator.clipboard.writeText(url);
        setCopiedLink(supplier.id);
        setTimeout(() => setCopiedLink(null), 2000);
    };
    
    const getSectorLabel = (value: string) => {
        const sector = sectors.find(s => s.value === value);
        return sector ? sector.label : value;
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
                    <div>
                        <label htmlFor="supplierName" className="block text-sm font-medium text-gray-300 mb-1">{t('suppliers.nameLabel')}</label>
                        <input
                            type="text"
                            id="supplierName"
                            value={supplierName}
                            onChange={(e) => setSupplierName(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder={t('suppliers.namePlaceholder')}
                            disabled={isSubmitting}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">{t('suppliers.sectorsLabel')}</label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {sectors.map(sector => (
                                <label key={sector.value} className="flex items-center space-x-2 text-white cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={selectedSectors.includes(sector.value)}
                                        onChange={() => handleSectorChange(sector.value)}
                                        className="h-4 w-4 rounded border-gray-500 bg-gray-700 text-indigo-600 focus:ring-indigo-500"
                                        disabled={isSubmitting}
                                    />
                                    <span>{sector.label}</span>
                                </label>
                            ))}
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
                            <div key={supplier.id} className="bg-gray-800 p-4 rounded-lg border border-gray-700 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                <div className="flex-grow">
                                    <div className="flex items-center gap-3 mb-1">
                                        <p className="font-bold text-white">{supplier.name}</p>
                                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${supplier.active ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-200'}`}>
                                          {supplier.active ? t('suppliers.active') : t('suppliers.inactive')}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-400">
                                        Setores: {(supplier.sectors || []).map(getSectorLabel).join(', ')}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <button
                                        onClick={() => handleCopyLink(supplier)}
                                        className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-3 rounded-lg transition-colors flex items-center gap-2 justify-center w-32"
                                    >
                                        {copiedLink === supplier.id ? (
                                            <>
                                                <CheckCircleIcon className="w-5 h-5" />
                                                <span>{t('suppliers.copiedButton')}</span>
                                            </>
                                        ) : (
                                            <>
                                                <ClipboardDocumentIcon className="w-5 h-5" />
                                                <span>{t('suppliers.copyButton')}</span>
                                            </>
                                        )}
                                    </button>
                                     <button
                                        onClick={() => onSupplierStatusUpdate(supplier.id, !supplier.active)}
                                        className={`font-bold py-2 px-3 rounded-lg transition-colors flex items-center gap-2 ${supplier.active ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}`}
                                    >
                                        {supplier.active ? <NoSymbolIcon className="w-4 h-4"/> : <CheckCircleIcon className="w-4 h-4"/>}
                                        {supplier.active ? t('suppliers.disableButton') : t('suppliers.enableButton')}
                                    </button>
                                </div>
                            </div>
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
