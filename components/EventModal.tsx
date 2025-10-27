import React, { useState, useEffect } from 'react';
import { Event } from '../types.ts';
import { useTranslation } from '../hooks/useTranslation.tsx';
import { XMarkIcon } from './icons.tsx';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, eventId?: string) => void;
  eventToEdit?: Event | null;
}

const EventModal: React.FC<EventModalProps> = ({ isOpen, onClose, onSave, eventToEdit }) => {
  const { t } = useTranslation();
  const [eventName, setEventName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (eventToEdit) {
      setEventName(eventToEdit.name);
    } else {
      setEventName('');
    }
    setError('');
  }, [eventToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!eventName.trim()) {
      setError(t('events.modal.error'));
      return;
    }
    onSave(eventName, eventToEdit?.id);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700 flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">
            {eventToEdit ? t('events.modal.editTitle') : t('events.modal.createTitle')}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="p-8 space-y-4">
          <div>
            <label htmlFor="eventName" className="block text-sm font-medium text-gray-300 mb-1">
              {t('events.modal.nameLabel')}
            </label>
            <input
              type="text"
              id="eventName"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder={t('events.modal.namePlaceholder')}
              autoFocus
            />
            {error && <p className="text-red-400 text-sm mt-1">{error}</p>}
          </div>
        </div>
        <div className="p-6 bg-gray-900/50 rounded-b-2xl">
          <button
            onClick={handleSave}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300"
          >
            {eventToEdit ? t('events.modal.saveButton') : t('events.modal.createButton')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EventModal;