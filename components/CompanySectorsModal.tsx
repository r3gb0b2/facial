import React, { useState, useEffect } from 'react';
import { Sector } from '../types.ts';
import { useTranslation } from '../hooks/useTranslation.tsx';
import { XMarkIcon } from './icons.tsx';

interface CompanySectorsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (companyName: string, sectorIds: string[]) => void;
  company: { name: string; sectorIds: string[] } | null;
  allSectors: Sector[];
}

const CompanySectorsModal: React.FC<CompanySectorsModalProps> = ({ isOpen, onClose, onSave, company, allSectors }) => {
  const { t } = useTranslation();
  const [selectedSectorIds, setSelectedSectorIds] = useState<string[]>([]);
  
  useEffect(() => {
    if (company) {
      setSelectedSectorIds(company.sectorIds);
    }
  }, [company]);

  if (!isOpen || !company) return null;

  const handleSectorChange = (sectorId: string) => {
    setSelectedSectorIds(prev =>
      prev.includes(sectorId)
        ? prev.filter(id => id !== sectorId)
        : [...prev, sectorId]
    );
  };

  const handleSave = () => {
    onSave(company.name, selectedSectorIds);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-700 flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">
            {t('companies.modal.title', company.name)}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="p-8 space-y-4">
          <p className="text-gray-400">{t('companies.modal.description')}</p>
          <div className="grid grid-cols-2 gap-4 p-4 bg-gray-900/50 rounded-lg max-h-60 overflow-y-auto border border-gray-600">
            {allSectors.map(sector => (
              <div key={sector.id} className="flex items-center">
                <input
                  type="checkbox"
                  id={`company-sector-${sector.id}`}
                  checked={selectedSectorIds.includes(sector.id)}
                  onChange={() => handleSectorChange(sector.id)}
                  className="h-4 w-4 rounded border-gray-500 bg-gray-700 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor={`company-sector-${sector.id}`} className="ml-3 text-white flex items-center gap-2 cursor-pointer">
                    <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: sector.color || '#4B5563' }}></span>
                    {sector.label}
                </label>
              </div>
            ))}
          </div>
        </div>
        <div className="p-6 bg-gray-900/50 rounded-b-2xl">
          <button
            onClick={handleSave}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300"
          >
            {t('companies.modal.saveButton')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CompanySectorsModal;
