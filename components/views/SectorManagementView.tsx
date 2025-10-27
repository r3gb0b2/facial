import React, { useState } from 'react';
import { Sector } from '../../types.ts';
import { useTranslation } from '../../hooks/useTranslation.tsx';
import { PencilIcon, TagIcon, TrashIcon } from '../icons.tsx';
import SectorModal from '../SectorModal.tsx';

interface SectorManagementViewProps {
    sectors: Sector[];
    onAddSector: (label: string) => Promise<void>;
    onUpdateSector: (sectorId: string, label: string) => Promise<void>;
    onDeleteSector: (sector: Sector) => Promise<void>;
    setError: (message: string) => void;
}

const SectorManagementView: React.FC<SectorManagementViewProps> = ({
    sectors,
    onAddSector,
    onUpdateSector,
    onDeleteSector,
    setError,
}) => {
    const { t } = useTranslation();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [sectorToEdit, setSectorToEdit] = useState<Sector | null>(null);

    const handleOpenModal = (sector: Sector | null) => {
        setSectorToEdit(sector);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setSectorToEdit(null);
        setIsModalOpen(false);
    };

    const handleSave = async (label: string, sectorId?: string) => {
        try {
            if (sectorId) {
                await onUpdateSector(sectorId, label);
            } else {
                await onAddSector(label);
            }
            handleCloseModal();
        } catch (error) {
            // Error is displayed by the App component
            console.error(error);
        }
    };
    
    const handleDelete = async (sector: Sector) => {
        if (window.confirm(t('sectors.deleteConfirm', sector.label))) {
            try {
                await onDeleteSector(sector);
            } catch (e: any) {
                if (e.message === 'Sector is in use and cannot be deleted.') {
                    setError(t('sectors.deleteErrorInUse', sector.label));
                } else {
                    setError(e.message || 'Falha ao deletar o setor.');
                }
            }
        }
    };

    return (
        <div className="w-full max-w-3xl mx-auto">
            <div className="bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-gray-700">
                <h2 className="text-3xl font-bold text-white mb-6 flex items-center justify-center gap-3">
                    <TagIcon className="w-8 h-8"/>
                    {t('sectors.title')}
                </h2>
                {sectors.length === 0 ? (
                    <div className="text-center text-gray-400 py-8">
                        <p className="text-lg mb-2">{t('sectors.noSectors')}</p>
                        <p className="text-sm">{t('sectors.noSectorsSubtitle')}</p>
                    </div>
                ) : (
                    <ul className="space-y-3">
                        {sectors.map((sector) => (
                            <li key={sector.id} className="bg-gray-900/70 p-4 rounded-lg flex items-center justify-between transition-all hover:bg-gray-800">
                                <p className="font-semibold text-white">{sector.label}</p>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => handleOpenModal(sector)} className="p-2 text-gray-400 hover:text-yellow-400 transition-colors rounded-full hover:bg-gray-700">
                                        <PencilIcon className="w-5 h-5" />
                                    </button>
                                    <button onClick={() => handleDelete(sector)} className="p-2 text-gray-400 hover:text-red-400 transition-colors rounded-full hover:bg-gray-700">
                                        <TrashIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
                <div className="mt-8">
                    <button onClick={() => handleOpenModal(null)} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300">
                        {t('sectors.createButton')}
                    </button>
                </div>
            </div>
            <SectorModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSave={handleSave}
                sectorToEdit={sectorToEdit}
            />
        </div>
    );
};

export default SectorManagementView;