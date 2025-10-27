import React from 'react';
import { Attendee, CheckinStatus } from '../types';
// FIX: Removed .tsx extension from module import to fix module resolution error.
import { useTranslation } from '../hooks/useTranslation';
import { TagIcon } from './icons';

interface AttendeeCardProps {
  attendee: Attendee;
  onSelect: (attendee: Attendee) => void;
  sectorLabel: string;
  sectorColor?: string;
  supplierName?: string;
}

const AttendeeCard: React.FC<AttendeeCardProps> = ({ attendee, onSelect, sectorLabel, sectorColor, supplierName }) => {
  const { t } = useTranslation();

  const statusInfo = {
    [CheckinStatus.PENDING]: { bg: 'bg-gray-600', text: 'text-gray-200', label: t('status.pending') },
    [CheckinStatus.CHECKED_IN]: { bg: 'bg-green-600', text: 'text-white', label: t('status.checked_in') },
    [CheckinStatus.CANCELLED]: { bg: 'bg-red-600', text: 'text-white', label: t('status.cancelled') },
    [CheckinStatus.SUBSTITUTION]: { bg: 'bg-yellow-500', text: 'text-black', label: t('status.substitution') },
    [CheckinStatus.MISSED]: { bg: 'bg-gray-800', text: 'text-gray-400', label: t('status.missed') },
  }[attendee.status] || { bg: 'bg-gray-600', text: 'text-gray-200', label: t('status.pending') };

  const formatCPF = (cpf: string) => {
    if (!cpf) return '';
    return cpf
      .replace(/\D/g, '')
      .slice(0, 11)
      .replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  return (
    <div
      onClick={() => onSelect(attendee)}
      className="bg-gray-800 rounded-lg shadow-lg overflow-hidden cursor-pointer transition-transform transform hover:scale-105 border border-gray-700 hover:border-indigo-500 flex flex-col"
    >
      <div className="relative">
        <img src={attendee.photo} alt={attendee.name} className="w-full h-48 object-contain bg-black" />
        <div className={`absolute top-2 right-2 px-2 py-1 text-xs font-bold rounded ${statusInfo.bg} ${statusInfo.text}`}>
          {statusInfo.label}
        </div>
      </div>
      <div className="p-4 flex-grow flex flex-col">
        <h3 className="font-bold text-lg text-white truncate">{attendee.name}</h3>
        <p className="text-sm text-gray-400">{formatCPF(attendee.cpf)}</p>
        <div className="mt-1 space-y-1 flex-grow">
            <p
              className="text-sm font-semibold capitalize truncate"
              style={sectorColor ? { color: sectorColor } : { color: '#818cf8' }} // Fallback to indigo-400
            >
              {sectorLabel}
            </p>
            {supplierName && (
                <p className="text-xs text-gray-500 font-medium truncate">{t('attendeeCard.supplierLabel')}: {supplierName}</p>
            )}
        </div>
        {attendee.status === CheckinStatus.CHECKED_IN && attendee.wristbandNumber && (
            <div className="mt-2 flex items-center gap-1 text-xs text-gray-300 bg-gray-700/50 px-2 py-1 rounded-md">
                <TagIcon className="w-4 h-4 text-gray-400" />
                <span className="font-semibold">{t('attendeeCard.wristbandNumber')}:</span>
                <span>{attendee.wristbandNumber}</span>
            </div>
        )}
      </div>
    </div>
  );
};

export default AttendeeCard;