import React from 'react';
import { Attendee, CheckinStatus } from '../types';
// FIX: Added .tsx extension to module import.
import { useTranslation } from '../hooks/useTranslation.tsx';

interface AttendeeCardProps {
  attendee: Attendee;
  onSelect: (attendee: Attendee) => void;
}

const AttendeeCard: React.FC<AttendeeCardProps> = ({ attendee, onSelect }) => {
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
      className="bg-gray-800 rounded-lg shadow-lg overflow-hidden cursor-pointer transition-transform transform hover:scale-105 border border-gray-700 hover:border-indigo-500"
    >
      <div className="relative">
        <img src={attendee.photo} alt={attendee.name} className="w-full h-48 object-cover object-top" />
        <div className={`absolute top-2 right-2 px-2 py-1 text-xs font-bold rounded ${statusInfo.bg} ${statusInfo.text}`}>
          {statusInfo.label}
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-bold text-lg text-white truncate">{attendee.name}</h3>
        <p className="text-sm text-gray-400">{formatCPF(attendee.cpf)}</p>
        <p className="text-sm text-indigo-400 mt-1 capitalize">{attendee.sector}</p>
      </div>
    </div>
  );
};

export default AttendeeCard;