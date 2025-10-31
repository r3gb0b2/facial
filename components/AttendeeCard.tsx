import React from 'react';
import { Attendee, CheckinStatus } from '../types.ts';
import { useTranslation } from '../hooks/useTranslation.tsx';
import { TagIcon } from './icons.tsx';

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
    [CheckinStatus.CHECKED_OUT]: { bg: 'bg-slate-500', text: 'text-white', label: t('status.checked_out') },
    [CheckinStatus.CANCELLED]: { bg: 'bg-red-600', text: 'text-white', label: t('status.cancelled') },
    [CheckinStatus.SUBSTITUTION]: { bg: 'bg-yellow-500', text: 'text-black', label: t('status.substitution') },
    [CheckinStatus.SUBSTITUTION_REQUEST]: { bg: 'bg-blue-500', text: 'text-white', label: t('status.substitution_request') },
    [CheckinStatus.SECTOR_CHANGE_REQUEST]: { bg: 'bg-purple-500', text: 'text-white', label: t('status.sector_change_request') },
    [CheckinStatus.MISSED]: { bg: 'bg-gray-800', text: 'text-gray-400', label: t('status.missed') },
  }[attendee.status] || { bg: 'bg-gray-600', text: 'text-gray-200', label: t('status.pending') };

  const formatCPF = (cpf: string) => {
    if (!cpf) return '';
    return cpf
      .replace(/\D/g, '')
      .slice(0, 11)
      .replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const wristbandNumbers = attendee.wristbands ? Object.values(attendee.wristbands).filter(Boolean).join(', ') : '';

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
        <h3 className="font-bold text-lg text-white">{attendee.name}</h3>
        <p className="text-sm text-gray-400">{formatCPF(attendee.cpf)}</p>
        <div className="mt-1 space-y-1 flex-grow">
            <p
              className="text-sm font-semibold capitalize"
              style={sectorColor ? { color: sectorColor } : { color: '#818cf8' }} // Fallback to indigo-400
            >
              {sectorLabel}
            </p>
            {supplierName && (
                <p className="text-xs text-gray-500 font-medium truncate">{t('attendeeCard.supplierLabel')}: {supplierName}</p>
            )}
            {attendee.subCompany && (
                <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium truncate">
                    <span className="truncate">{attendee.subCompany}</span>
                </div>
            )}
        </div>
        {(attendee.status === CheckinStatus.CHECKED_IN || attendee.status === CheckinStatus.CHECKED_OUT) && wristbandNumbers && (
            <div className="mt-2 flex items-center gap-1 text-xs text-gray-300 bg-gray-700/50 px-2 py-1 rounded-md">
                <TagIcon className="w-4 h-4 text-gray-400" />
                <span className="font-semibold">{t('attendeeCard.wristbandNumber')}:</span>
                <span>{wristbandNumbers}</span>
            </div>
        )}
      </div>
    </div>
  );
};

export default AttendeeCard;