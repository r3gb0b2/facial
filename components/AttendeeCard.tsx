import React from 'react';
import { Attendee, CheckinStatus } from '../types';
import { CheckCircleIcon, ClockIcon } from './icons';
import { useTranslation } from '../hooks/useTranslation';

interface AttendeeCardProps {
  attendee: Attendee;
  onSelect: (attendee: Attendee) => void;
}

const AttendeeCard: React.FC<AttendeeCardProps> = ({ attendee, onSelect }) => {
  const { t, sectors } = useTranslation();
  
  const getStatusInfo = (status: CheckinStatus) => {
    switch (status) {
      case CheckinStatus.CHECKED_IN:
        return { text: t('attendeeCard.status.checkedIn'), color: 'bg-green-500/20 text-green-400' };
      case CheckinStatus.CANCELLED:
        return { text: t('attendeeCard.status.cancelled'), color: 'bg-red-500/20 text-red-400' };
      case CheckinStatus.SUBSTITUTION:
        return { text: t('attendeeCard.status.substitution'), color: 'bg-yellow-500/20 text-yellow-400' };
      case CheckinStatus.MISSED:
        return { text: t('attendeeCard.status.missed'), color: 'bg-gray-500/20 text-gray-400' };
      default:
        return { text: t('attendeeCard.status.registered'), color: 'bg-blue-500/20 text-blue-400' };
    }
  };

  const statusInfo = getStatusInfo(attendee.status);
  const isInactive = attendee.status !== CheckinStatus.REGISTERED;
  const isCheckedIn = attendee.status === CheckinStatus.CHECKED_IN;
  const sectorLabel = sectors.find(s => s.value === attendee.sector)?.label || attendee.sector;

  const getOverlayBgColor = () => {
    switch(attendee.status) {
      case CheckinStatus.CHECKED_IN: return 'bg-green-900/70';
      case CheckinStatus.CANCELLED: return 'bg-red-900/70';
      case CheckinStatus.SUBSTITUTION: return 'bg-yellow-900/70';
      case CheckinStatus.MISSED: return 'bg-gray-900/70';
      default: return '';
    }
  }

  return (
    <div
      onClick={() => onSelect(attendee)}
      className={`bg-gray-800 rounded-xl overflow-hidden border border-gray-700 shadow-lg transition-all duration-300 transform cursor-pointer hover:-translate-y-1 hover:shadow-indigo-500/30 hover:border-indigo-500 ${isInactive ? 'opacity-70' : ''}`}
    >
      <div className="relative">
        <img src={attendee.photo} alt={attendee.name} className="w-full h-48 object-cover" />
        {isInactive && (
            <div className={`absolute inset-0 flex items-center justify-center ${getOverlayBgColor()}`}>
                <div className="flex flex-col items-center text-white text-center p-2">
                    {isCheckedIn && <CheckCircleIcon className="w-12 h-12" />}
                    <p className="font-bold mt-2">{statusInfo.text}</p>
                </div>
            </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="text-lg font-bold text-white truncate">{attendee.name}</h3>
        <p className="text-sm text-gray-400 truncate">{attendee.cpf}</p>
        {attendee.sector && <p className="text-xs text-indigo-300 mt-1">{t('attendeeCard.sectorLabel')}: {sectorLabel}</p>}
        <div className="mt-3 flex justify-between items-center text-xs">
          <span
            className={`font-semibold px-2 py-1 rounded-full ${statusInfo.color}`}
          >
            {statusInfo.text}
          </span>
          {isCheckedIn && attendee.checkinTime && (
            <span className="flex items-center gap-1 text-gray-400">
                <ClockIcon className="w-3 h-3" />
                {attendee.checkinTime}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default AttendeeCard;