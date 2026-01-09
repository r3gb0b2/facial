
import React, { useState, useEffect } from 'react';
import { Attendee, Sector } from '../types.ts';
import { useTranslation } from '../hooks/useTranslation.tsx';
import * as api from '../firebase/service.ts';
import { XMarkIcon, SpinnerIcon, CheckCircleIcon } from './icons.tsx';
import WebcamCapture from './WebcamCapture.tsx';
import UserAvatar from './UserAvatar.tsx';

interface SubstitutionRequestModalProps {
  attendee: Attendee;
  eventId: string;
  onClose: () => void;
  onSuccess: (attendeeId: string) => void;
  allowedSectors: Sector[];
}

const formatCPF = (value: string) => {
    return value
      .replace(/\D/g, '') // Remove all non-digit characters
      .slice(0, 11) // Limit to 11 digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};

const SubstitutionRequestModal: React.FC<SubstitutionRequestModalProps> = ({ attendee, eventId, onClose, onSuccess, allowedSectors }) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [newSectorIds, setNewSectorIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const validCurrentSectors = (attendee.sectors || []).filter(sectorId =>
        allowedSectors.some(s => s.id === sectorId)
    );
    setNewSectorIds(validCurrentSectors);
    setName('');
    setCpf('');
    setPhoto(null);
  }, [attendee, allowedSectors]);


  const handleSectorChange = (sectorId: string) => {
    setNewSectorIds(prev =>
      prev.includes(sectorId)
        ? prev.filter(id => id !== sectorId)
        : [...prev, sectorId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawCpf = cpf.replace(/\D/g, '');

    if (!name.trim() || rawCpf.length !== 11 || !photo || newSectorIds.length === 0) {
      setError(t('substitutionModal.formError'));
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const substitutionData = {
        name: name.trim(),
        cpf: rawCpf,
        photo,
        newSectorIds,
      };
      await api.requestSubstitution(eventId, attendee.id, substitutionData);
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
      <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl border border-gray-700 flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">{t('editModal.title')} <span className="text-indigo-400">{attendee.name}</span></h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8 items-start max-h-[80vh] overflow-y-auto">
          <form onSubmit={handleSubmit} className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-300">{t('editModal.newData')}</h3>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">{t('register.form.nameLabel')}</label>
              <input
                type="text" id="name" value={name} onChange={(e) => setName(e.target.value)}
                className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder={t('register.form.namePlaceholder')}
                disabled={isSubmitting}
              />
            </div>
             <div>
              <label htmlFor="cpf" className="block text-sm font-medium text-gray-300 mb-1">{t('register.form.cpfLabel')}</label>
              <input
                type="text" id="cpf" value={cpf} onChange={(e) => setCpf(formatCPF(e.target.value))}
                className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder={t('register.form.cpfPlaceholder')}
                disabled={isSubmitting}
              />
            </div>
             <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">{t('register.form.sectorLabel')}</label>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 p-2 bg-gray-900 rounded-md max-h-48 overflow-y-auto border border-gray-600">
                {allowedSectors.map(sector => (
                    <div key={sector.id} className="flex items-center p-1 rounded-md hover:bg-gray-700/50">
                        <input
                            type="checkbox"
                            id={`edit-sector-${sector.id}`}
                            checked={newSectorIds.includes(sector.id)}
                            onChange={() => handleSectorChange(sector.id)}
                            className="h-4 w-4 rounded border-gray-500 bg-gray-700 text-indigo-600 focus:ring-indigo-500"
                            disabled={isSubmitting}
                        />
                        <label htmlFor={`edit-sector-${sector.id}`} className="ml-2 text-white cursor-pointer flex items-center gap-2">
                            <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: sector.color || '#4B5563' }}></span>
                            {sector.label}
                        </label>
                    </div>
                ))}
              </div>
            </div>
            
            {error && <p className="text-red-400 text-sm">{error}</p>}
             <button
                type="submit"
                disabled={isSubmitting || !name || !cpf || !photo || newSectorIds.length === 0}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 disabled:bg-gray-500 disabled:cursor-not-allowed"
              >
                {isSubmitting ? <SpinnerIcon className="w-5 h-5" /> : <CheckCircleIcon className="w-6 h-6" />}
                {isSubmitting ? "Enviando..." : t('editModal.submitButton')}
              </button>
          </form>
          <div className="flex flex-col items-center">
            <WebcamCapture onCapture={setPhoto} capturedImage={photo} disabled={isSubmitting} />
            <div className="w-full mt-8 border-t border-gray-700 pt-4">
                 <h4 className="text-sm font-medium text-gray-400 mb-2 text-center">Atual</h4>
                 <div className="w-24 h-24 mx-auto">
                    <UserAvatar 
                        src={attendee.photo} 
                        alt={attendee.name} 
                        className="w-full h-full object-contain rounded-lg bg-black border-2 border-gray-600"
                    />
                 </div>
                 <p className="text-center text-gray-300 text-sm mt-2">{attendee.name}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubstitutionRequestModal;
