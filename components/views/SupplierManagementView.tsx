import React, { useState, useEffect } from 'react';
import { Supplier, Sector } from '../../types.ts';
import { useTranslation } from '../../hooks/useTranslation.tsx';
import { PencilIcon, TrashIcon, UsersIcon, LinkIcon, ClipboardDocumentIcon, XMarkIcon, EyeIcon, KeyIcon } from '../icons.tsx';

interface SupplierManagementViewProps {
    suppliers: Supplier[];
    sectors: Sector[];
    onAddSupplier: (name: string, sectorIds: string[]) => Promise<any>;
    onUpdateSupplier: (supplierId: string, data: Partial<Supplier>) => Promise<void>;
    onDeleteSupplier: (supplier: Supplier) => Promise<void>;
    onToggleRegistration: (supplierId: string, isOpen: boolean) => Promise<void>;
    onRegenerateAdminToken: (supplierId: string) => Promise<void>;
    onRegenerateRegistrationToken: (supplierId: string) => Promise<void>;
    setError: (message: string) => void;
}

const SupplierModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: { name: string, sectors: string[] }, id?: string) => void;
    supplierToEdit: Supplier | null;
    allSectors: Sector[];
}> = ({ isOpen, onClose, onSave, supplierToEdit, allSectors }) => {
    const { t } = useTranslation();
    const [name, setName] = useState('');
    const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
    const [error, setError] = useState('');

    useEffect(() => {
        if (supplierToEdit) {
            setName(supplierToEdit.name);
            setSelectedSectors(supplierToEdit.sectors);
        } else {
            setName('');
            setSelectedSectors([]);
        }
        setError('');
    }, [supplierToEdit, isOpen]);

    const handleSave = () => {
        if (!name.trim() || selectedSectors.length === 0) {
            setError(t('suppliers.modal.error'));
            return;
        }
        onSave({ name, sectors: selectedSectors }, supplierToEdit?.id);
    };

    const handleSectorToggle = (sectorId: string) => {
        setSelectedSectors(prev =>
            prev.includes(sectorId) ? prev.filter(id => id !== sectorId) : [...prev, sectorId]
        );
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-700 flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-gray-700 flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-white">{supplierToEdit ? t('suppliers.modal.editTitle') : t('suppliers.modal.createTitle')}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors"><XMarkIcon className="w-6 h-6" /></button>
                </div>
                <div className="p-8 space-y-6 overflow-y-auto max-h-[70vh]">
                    <div>
                        <label htmlFor="supplierName" className="block text-sm font-medium text-gray-300 mb-1">{t('suppliers.modal.nameLabel')}</label>
                        <input type="text" id="supplierName" value={name} onChange={e => setName(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" autoFocus />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">{t('suppliers.modal.sectorsLabel')}</label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {allSectors.map(sector => (
                                <button key={sector.id} onClick={() => handleSectorToggle(sector.id)} className={`p-2 rounded-md text-sm border transition-colors ${selectedSectors.includes(sector.id) ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'}`}>
                                    {sector.label}
                                </button>
                            ))}
                        </div>
                    </div>
                     {error && <p className="text-red-400 text-sm">{error}</p>}
                </div>
                <div className="p-6 bg-gray-900/50 rounded-b-2xl">
                    <button onClick={handleSave} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg">{supplierToEdit ? t('suppliers.modal.saveButton') : t('suppliers.modal.createButton')}</button>
                </div>
            </div>
        </div>
    );
};


const SupplierManagementView: React.FC<SupplierManagementViewProps> = (props) => {
    const { t } = useTranslation();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [supplierToEdit, setSupplierToEdit] = useState<Supplier | null>(null);
    const [copiedToken, setCopiedToken] = useState<string | null>(null);

    const handleOpenModal = (supplier: Supplier | null) => {
        setSupplierToEdit(supplier);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setSupplierToEdit(null);
        setIsModalOpen(false);
    };

    const handleSave = async (data: { name: string; sectors: string[] }, supplierId?: string) => {
        try {
            if (supplierId) {
                await props.onUpdateSupplier(supplierId, data);
            } else {
                await props.onAddSupplier(data.name, data.sectors);
            }
            handleCloseModal();
        } catch (error) {
            console.error(error);
        }
    };
    
    const handleDelete = (supplier: Supplier) => {
        if (window.confirm(t('suppliers.deleteConfirm', supplier.name))) {
            props.onDeleteSupplier(supplier).catch(e => props.setError(e.message));
        }
    };
    
    const handleCopyLink = (token: string, type: 'register' | 'admin') => {
        const url = `${window.location.origin}${window.location.pathname}?${type === 'register' ? 'register_token' : 'verify'}=${token}`;
        navigator.clipboard.writeText(url);
        setCopiedToken(token);
        setTimeout(() => setCopiedToken(null), 2000);
    };
    
    const handleRegenerate = (supplierId: string, type: 'registration' | 'admin') => {
        const confirmMessage = t('suppliers.confirmRegenerate', type === 'registration' ? 'cadastro' : 'visualização');
        if (window.confirm(confirmMessage)) {
            if (type === 'registration') {
                props.onRegenerateRegistrationToken(supplierId);
            } else {
                props.onRegenerateAdminToken(supplierId);
            }
        }
    }

    return (
        <div className="w-full max-w-5xl mx-auto">
            <div className="bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-gray-700">
                <h2 className="text-3xl font-bold text-white mb-6 flex items-center justify-center gap-3">
                    <UsersIcon className="w-8 h-8"/>
                    {t('suppliers.title')}
                </h2>
                {props.suppliers.length === 0 ? (
                    <div className="text-center text-gray-400 py-8">
                        <p className="text-lg mb-2">{t('suppliers.noSuppliers')}</p>
                        <p className="text-sm">{t('suppliers.noSuppliersSubtitle')}</p>
                    </div>
                ) : (
                    <ul className="space-y-4">
                        {props.suppliers.map((supplier) => (
                            <li key={supplier.id} className="bg-gray-900/70 p-4 rounded-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all hover:bg-gray-800">
                                <div className="flex-grow">
                                    <p className="font-semibold text-white text-lg">{supplier.name}</p>
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-x-6 gap-y-2 mt-2">
                                        {/* Registration Link */}
                                        <div className="flex items-center gap-2">
                                             <span className="text-sm font-medium text-gray-300 flex items-center gap-1.5"><LinkIcon className="w-4 h-4" />{t('suppliers.registrationLink')}:</span>
                                             <button onClick={() => handleCopyLink(supplier.registrationToken || '', 'register')} disabled={!supplier.registrationToken} className="text-xs font-semibold bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded-md text-indigo-300 disabled:opacity-50">{copiedToken === supplier.registrationToken ? t('suppliers.copied') : t('suppliers.copy')}</button>
                                             <button onClick={() => handleRegenerate(supplier.id, 'registration')} className="text-xs font-semibold bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded-md text-yellow-300">{t('suppliers.regenerateLink')}</button>
                                        </div>
                                         {/* Admin Link */}
                                        <div className="flex items-center gap-2">
                                             <span className="text-sm font-medium text-gray-300 flex items-center gap-1.5"><EyeIcon className="w-4 h-4" />{t('suppliers.adminLink')}:</span>
                                             <button onClick={() => handleCopyLink(supplier.adminToken || '', 'admin')} disabled={!supplier.adminToken} className="text-xs font-semibold bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded-md text-indigo-300 disabled:opacity-50">{copiedToken === supplier.adminToken ? t('suppliers.copied') : t('suppliers.copy')}</button>
                                             <button onClick={() => handleRegenerate(supplier.id, 'admin')} className="text-xs font-semibold bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded-md text-yellow-300">{t('suppliers.regenerateLink')}</button>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 w-full md:w-auto self-start md:self-center">
                                    <div className="flex items-center gap-2 mr-4 flex-grow">
                                        <span className="text-xs font-medium text-gray-400">{t('suppliers.registrationStatus')}:</span>
                                        <button onClick={() => props.onToggleRegistration(supplier.id, !supplier.registrationOpen)} className={`px-2 py-0.5 text-xs font-bold rounded-full ${supplier.registrationOpen ? 'bg-green-500/80 text-white' : 'bg-red-500/80 text-white'}`}>
                                            {supplier.registrationOpen ? t('suppliers.open') : t('suppliers.closed')}
                                        </button>
                                    </div>
                                    <button onClick={() => handleOpenModal(supplier)} className="p-2 text-gray-400 hover:text-yellow-400 transition-colors rounded-full hover:bg-gray-700">
                                        <PencilIcon className="w-5 h-5" />
                                    </button>
                                    <button onClick={() => handleDelete(supplier)} className="p-2 text-gray-400 hover:text-red-400 transition-colors rounded-full hover:bg-gray-700">
                                        <TrashIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
                <div className="mt-8">
                    <button onClick={() => handleOpenModal(null)} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300">
                        {t('suppliers.createButton')}
                    </button>
                </div>
            </div>
            {isModalOpen && <SupplierModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSave={handleSave}
                supplierToEdit={supplierToEdit}
                allSectors={props.sectors}
            />}
        </div>
    );
};

export default SupplierManagementView;