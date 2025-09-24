import React from 'react';
import { Attendee, CheckinStatus } from '../types';
import { useTranslation } from '../hooks/useTranslation';
import { XMarkIcon } from './icons';

interface StatusUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (newStatus: CheckinStatus) => void;
  attendee: Attendee | null;
}

const StatusUpdateModal: React.FC<StatusUpdateModalProps> = ({ isOpen, onClose, onUpdate, attendee }) => {
  const { t } = useTranslation();

  if (!isOpen || !attendee) return null;

  const handleUpdate = (status: CheckinStatus) => {
    onUpdate(status);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700 flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white truncate">{t('checkin.statusModal.title', attendee.name)}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="p-8 space-y-4">
          <button onClick={() => handleUpdate(CheckinStatus.CHECKED_IN)} className="w-full text-left p-4 bg-gray-700 hover:bg-green-600 rounded-lg transition-colors font-semibold">
            {t('checkin.statusModal.checkinButton')}
          </button>
          <button onClick={() => handleUpdate(CheckinStatus.CANCELLED)} className="w-full text-left p-4 bg-gray-700 hover:bg-red-600 rounded-lg transition-colors font-semibold">
            {t('checkin.statusModal.cancelButton')}
          </button>
          <button onClick={() => handleUpdate(CheckinStatus.SUBSTITUTION)} className="w-full text-left p-4 bg-gray-700 hover:bg-yellow-600 rounded-lg transition-colors font-semibold">
            {t('checkin.statusModal.substituteButton')}
          </button>
          <button onClick={() => handleUpdate(CheckinStatus.MISSED)} className="w-full text-left p-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors font-semibold">
            {t('checkin.statusModal.missedButton')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StatusUpdateModal;