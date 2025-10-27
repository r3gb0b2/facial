import React, { useState, useEffect } from 'react';
import { Sector } from '../types';
// FIX: Removed .tsx extension from module import to fix module resolution error.
import { useTranslation } from '../hooks/useTranslation';
import { XMarkIcon } from './icons';

interface SectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { label: string, color: string }, sectorId?: string) => void;
  sectorToEdit?: Sector | null;
}

const SectorModal: React.FC<SectorModalProps> = ({ isOpen, onClose, onSave, sectorToEdit }) => {
  const { t } = useTranslation();
  const [sectorLabel, setSectorLabel] = useState('');
  const [sectorColor, setSectorColor] = useState('#4f46e5'); // Default to indigo
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
        if (sectorToEdit) {
            setSectorLabel(sectorToEdit.label);
            setSectorColor(sectorToEdit.color || '#4f46e5');
        } else {
            setSectorLabel('');
            setSectorColor('#4f46e5');
        }
        setError('');
    }
  }, [sectorToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!sectorLabel.trim()) {
      setError(t('sectors.modal.error'));
      return;
    }
    onSave({ label: sectorLabel, color: sectorColor }, sectorToEdit?.id);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700 flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">
            {sectorToEdit ? t('sectors.modal.editTitle') : t('sectors.modal.createTitle')}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="p-8 space-y-6">
          <div>
            <label htmlFor="sectorLabel" className="block text-sm font-medium text-gray-300 mb-1">
              {t('sectors.modal.labelLabel')}
            </label>
            <input
              type="text"
              id="sectorLabel"
              value={sectorLabel}
              onChange={(e) => setSectorLabel(e.target.value)}
              className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder={t('sectors.modal.labelPlaceholder')}
              autoFocus
            />
            {error && <p className="text-red-400 text-sm mt-1">{error}</p>}
          </div>
          <div>
            <label htmlFor="sectorColor" className="block text-sm font-medium text-gray-300 mb-1">
              {t('sectors.modal.colorLabel')}
            </label>
            <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border border-gray-500" style={{ backgroundColor: sectorColor }}></div>
                <input
                  type="color"
                  id="sectorColor"
                  value={sectorColor}
                  onChange={(e) => setSectorColor(e.target.value)}
                  className="w-full h-10 bg-gray-900 border border-gray-600 rounded-md pl-10 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer"
                />
            </div>
          </div>
        </div>
        <div className="p-6 bg-gray-900/50 rounded-b-2xl">
          <button
            onClick={handleSave}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300"
          >
            {sectorToEdit ? t('sectors.modal.saveButton') : t('sectors.modal.createButton')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SectorModal;