
import React from 'react';
import { Attendee, CheckinStatus } from '../types';
import { CheckCircleIcon, ClockIcon } from './icons';

interface AttendeeCardProps {
  attendee: Attendee;
  onSelect: (attendee: Attendee) => void;
}

const AttendeeCard: React.FC<AttendeeCardProps> = ({ attendee, onSelect }) => {
  const isCheckedIn = attendee.status === CheckinStatus.CHECKED_IN;

  return (
    <div
      onClick={() => onSelect(attendee)}
      className={`bg-gray-800 rounded-xl overflow-hidden border border-gray-700 shadow-lg transition-all duration-300 transform hover:-translate-y-1 ${
        isCheckedIn ? 'opacity-50 cursor-default' : 'cursor-pointer hover:shadow-indigo-500/30 hover:border-indigo-500'
      }`}
    >
      <div className="relative">
        <img src={attendee.photo} alt={attendee.name} className="w-full h-48 object-cover" />
        {isCheckedIn && (
            <div className="absolute inset-0 bg-green-900/70 flex items-center justify-center">
                <div className="flex flex-col items-center text-white">
                    <CheckCircleIcon className="w-12 h-12" />
                    <p className="font-bold mt-2">Checked-in</p>
                </div>
            </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="text-lg font-bold text-white truncate">{attendee.name}</h3>
        <p className="text-sm text-gray-400 truncate">{attendee.email}</p>
        <div className="mt-3 flex justify-between items-center text-xs">
          <span
            className={`font-semibold px-2 py-1 rounded-full ${
              isCheckedIn ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
            }`}
          >
            {attendee.status}
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
