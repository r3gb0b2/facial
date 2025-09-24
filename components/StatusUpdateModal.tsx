import React from 'react';
import { Attendee, CheckinStatus } from '../types.ts';
import { useTranslation } from '../hooks/useTranslation.tsx';
import { XMarkIcon } from './icons.tsx';

interface StatusUpdateModalProps {
  attendee: Attendee;
  onClose: () => void;
  onUpdateStatus: (status: CheckinStatus) => void;
}

const StatusUpdateModal: React.FC<StatusUpdateModalProps> = ({ attendee, onClose, onUpdateStatus }) => {
  const { t } = useTranslation();

  const statusInfo = {
    [CheckinStatus.PENDING]: { bg: 'bg-gray-600', text: 'text-gray-200', label: t('status.pending') },
    [CheckinStatus.CHECKED_IN]: { bg: 'bg-green-600', text: 'text-white', label: t('status.checked_in') },
    [CheckinStatus.CANCELLED]: { bg: 'bg-red-600', text: 'text-white', label: t('status.cancelled') },
    [CheckinStatus.SUBSTITUTION]: { bg: 'bg-yellow-500', text: 'text-black', label: t('status.substitution') },
    [CheckinStatus.MISSED]: { bg: 'bg-gray-800', text: 'text-gray-400', label: t('status.missed') },
  }[attendee.status] || { bg: 'bg-gray-600', text: 'text-gray-200', label: attendee.status };


  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700 flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-700 flex justify-between items-center">
          <div>
             <h2 className="text-2xl font-bold text-white">{t('statusUpdateModal.title')}</h2>
             <p className="text-indigo-400">{attendee.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="p-8 space-y-4">
          <div className="text-center">
            <p className="text-sm text-gray-400">{t('statusUpdateModal.currentStatus')}</p>
            <span className={`px-3 py-1 text-sm font-bold rounded-full ${statusInfo.bg} ${statusInfo.text}`}>
              {statusInfo.label}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 pt-4">
            {attendee.status === CheckinStatus.CHECKED_IN && (
              <button onClick={() => onUpdateStatus(CheckinStatus.PENDING)} className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-3 px-4 rounded-lg transition-colors">
                {t('statusUpdateModal.cancelCheckin')}
              </button>
            )}
            
            {attendee.status === CheckinStatus.PENDING && (
              <button onClick={() => onUpdateStatus(CheckinStatus.MISSED)} className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-lg transition-colors">
                {t('statusUpdateModal.markAsMissed')}
              </button>
            )}

            {[CheckinStatus.PENDING, CheckinStatus.MISSED].includes(attendee.status) && (
              <button onClick={() => onUpdateStatus(CheckinStatus.SUBSTITUTION)} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors">
                {t('statusUpdateModal.allowSubstitution')}
              </button>
            )}
            
            {[CheckinStatus.PENDING, CheckinStatus.MISSED, CheckinStatus.SUBSTITUTION].includes(attendee.status) && (
                <button onClick={() => onUpdateStatus(CheckinStatus.CANCELLED)} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition-colors">
                    {t('statusUpdateModal.cancelRegistration')}
                </button>
            )}

          </div>
        </div>
         <div className="p-6 bg-gray-900/50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="w-full bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
          >
            {t('statusUpdateModal.closeButton')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StatusUpdateModal;
