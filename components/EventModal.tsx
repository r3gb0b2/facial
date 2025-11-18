import React, { useState, useEffect } from 'react';
import { Event, EventModules } from '../types.ts';
import { useTranslation } from '../hooks/useTranslation.tsx';
import { XMarkIcon } from './icons.tsx';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, eventId?: string, modules?: EventModules, allowPhotoChange?: boolean, allowGuestUploads?: boolean) => void;
  eventToEdit?: Event | null;
}

const defaultModules: EventModules = {
    scanner: true,
    logs: true,
    register: true,
    companies: true,
    spreadsheet: true,
    reports: true,
};

const EventModal: React.FC<EventModalProps> = ({ isOpen, onClose, onSave, eventToEdit }) => {
  const { t } = useTranslation();
  const [eventName, setEventName] = useState('');
  const [modules, setModules] = useState<EventModules>(defaultModules);
  const [allowPhotoChange, setAllowPhotoChange] = useState(true);
  const [allowGuestUploads, setAllowGuestUploads] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (eventToEdit) {
      setEventName(eventToEdit.name);
      setModules(eventToEdit.modules || defaultModules);
      setAllowPhotoChange(eventToEdit.allowPhotoChange !== undefined ? eventToEdit.allowPhotoChange : true);
      setAllowGuestUploads(eventToEdit.allowGuestUploads !== undefined ? eventToEdit.allowGuestUploads : false);
    } else {
      setEventName('');
      setModules(defaultModules);
      setAllowPhotoChange(true);
      setAllowGuestUploads(false);
    }
    setError('');
  }, [eventToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!eventName.trim()) {
      setError(t('events.modal.error'));
      return;
    }
    onSave(eventName, eventToEdit?.id, modules, allowPhotoChange, allowGuestUploads);
  };
  
  const toggleModule = (key: keyof EventModules) => {
      setModules(prev => ({
          ...prev,
          [key]: !prev[key]
      }));
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
        <div className="p-8 space-y-6">
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
            
             <div className="flex items-center mt-3">
                <input
                    type="checkbox"
                    id="allowPhotoChange"
                    checked={allowPhotoChange}
                    onChange={(e) => setAllowPhotoChange(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-500 bg-gray-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="allowPhotoChange" className="ml-2 text-sm text-gray-300 cursor-pointer select-none">
                    {t('events.modal.allowPhotoChange')}
                </label>
            </div>
             <div className="flex items-center mt-3">
                <input
                    type="checkbox"
                    id="allowGuestUploads"
                    checked={allowGuestUploads}
                    onChange={(e) => setAllowGuestUploads(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-500 bg-gray-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="allowGuestUploads" className="ml-2 text-sm text-gray-300 cursor-pointer select-none">
                    {t('events.modal.allowGuestUploads')}
                </label>
            </div>
          </div>
          
          <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                  {t('events.modal.modulesLabel')}
              </label>
              <div className="grid grid-cols-2 gap-3">
                  {Object.keys(defaultModules).map((key) => (
                       <div key={key} className="flex items-center space-x-3 p-2 bg-gray-900/50 rounded-lg border border-gray-700">
                            <input
                                type="checkbox"
                                id={`module-${key}`}
                                checked={modules[key as keyof EventModules]}
                                onChange={() => toggleModule(key as keyof EventModules)}
                                className="h-4 w-4 rounded border-gray-500 bg-gray-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                            <label htmlFor={`module-${key}`} className="text-sm text-gray-200 cursor-pointer select-none">
                                {t(`events.modules.${key}`)}
                            </label>
                        </div>
                  ))}
              </div>
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