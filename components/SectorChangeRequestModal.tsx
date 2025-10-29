import React, { useState, useMemo } from 'react';
import { Attendee, Sector } from '../types.ts';
import { useTranslation } from '../hooks/useTranslation.tsx';
import * as api from '../firebase/service.ts';
import { XMarkIcon, SpinnerIcon, CheckCircleIcon } from './icons.tsx';

interface SectorChangeRequestModalProps {
  attendee: Attendee;
  eventId: string;
  allowedSectors: Sector[];
  allSectors: Sector[]; // For looking up current sector name
  onClose: () => void;
  onSuccess: (attendeeId: string) => void;
}

const SectorChangeRequestModal: React.FC<SectorChangeRequestModalProps> = ({ attendee, eventId, allowedSectors, allSectors, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const [newSectorId, setNewSectorId] = useState('');
  const [justification, setJustification] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  const currentSectorLabel = useMemo(() => {
    const sector = allSectors.find(s => s.id === attendee.sectors[0]);
    return sector ? sector.label : 'N/A';
  }, [attendee, allSectors]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSectorId) {
      setError("Por favor, selecione um novo setor.");
      return;
    }
    setIsSubmitting(true);
    setError('');

    try {
      await api.requestSectorChange(eventId, attendee.id, { newSectorId, justification });
      onSuccess(attendee.id);
      onClose();
    } catch (err) {
      console.error(err);
      setError("Falha ao enviar a solicitação.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-700 flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">{t('sectorChangeModal.title')} <span className="text-indigo-400">{attendee.name}</span></h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[80vh] overflow-y-auto">
            <div>
                <label className="block text-sm font-medium text-gray-400">{t('sectorChangeModal.currentSector')}</label>
                <p className="text-lg text-white font-semibold">{currentSectorLabel}</p>
            </div>
            <div>
              <label htmlFor="newSector" className="block text-sm font-medium text-gray-300 mb-1">{t('sectorChangeModal.newSector')}</label>
              <select
                id="newSector"
                value={newSectorId}
                onChange={(e) => setNewSectorId(e.target.value)}
                className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={isSubmitting}
              >
                <option value="" disabled>{t('sectorChangeModal.selectSector')}</option>
                {allowedSectors.map(sector => (
                    <option key={sector.id} value={sector.id}>{sector.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="justification" className="block text-sm font-medium text-gray-300 mb-1">{t('sectorChangeModal.justification')}</label>
              <textarea
                id="justification"
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                rows={3}
                className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder={t('sectorChangeModal.justificationPlaceholder')}
                disabled={isSubmitting}
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
                type="submit"
                disabled={isSubmitting || !newSectorId}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 disabled:bg-gray-500 disabled:cursor-not-allowed"
            >
                {isSubmitting ? <SpinnerIcon className="w-5 h-5" /> : <CheckCircleIcon className="w-6 h-6" />}
                {isSubmitting ? "Enviando..." : t('sectorChangeModal.submitButton')}
            </button>
        </form>
      </div>
    </div>
  );
};

export default SectorChangeRequestModal;
