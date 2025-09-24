import React, { useState } from 'react';
import { Attendee } from '../../types';
import AttendeeCard from '../AttendeeCard';
import { FingerPrintIcon, SearchIcon } from '../icons';
import { useTranslation } from '../../hooks/useTranslation';

interface CheckinViewProps {
  attendees: Attendee[];
  onSelectAttendee: (attendee: Attendee) => void;
}

const CheckinView: React.FC<CheckinViewProps> = ({ attendees, onSelectAttendee }) => {
  const { t, sectors } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');

  const filteredAttendees = attendees.filter(attendee => {
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    const nameMatch = attendee.name.toLowerCase().includes(lowerCaseSearchTerm);
    const cpfMatch = attendee.cpf.includes(searchTerm.replace(/\D/g, '')); // Search by numbers in CPF
    const sectorMatch = sectorFilter ? attendee.sector === sectorFilter : true;
    return (nameMatch || cpfMatch) && sectorMatch;
  });

  return (
    <div className="w-full max-w-5xl mx-auto">
      <h2 className="text-3xl font-bold text-center text-white mb-8 flex items-center justify-center gap-3">
        <FingerPrintIcon className="w-8 h-8"/>
        {t('checkin.title')}
      </h2>
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative md:col-span-2">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3">
            <SearchIcon className="w-5 h-5 text-gray-400" />
          </span>
          <input
            type="text"
            placeholder={t('checkin.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded-md py-2 pl-10 pr-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
          />
        </div>
        <select
          onChange={(e) => setSectorFilter(e.target.value)}
          value={sectorFilter}
          className="w-full bg-gray-800 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">{t('checkin.filterSectorPlaceholder')}</option>
          {sectors.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>
      {attendees.length === 0 ? (
        <div className="text-center text-gray-400 bg-gray-800/50 p-8 rounded-2xl border border-gray-700">
          <p className="text-lg">{t('checkin.noAttendees')}</p>
          <p>{t('checkin.noAttendeesSubtitle')}</p>
        </div>
      ) : filteredAttendees.length === 0 ? (
        <div className="text-center text-gray-400 bg-gray-800/50 p-8 rounded-2xl border border-gray-700">
          <p className="text-lg">{t('checkin.noResults')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAttendees.map(attendee => (
            <AttendeeCard key={attendee.id} attendee={attendee} onSelect={onSelectAttendee} />
          ))}
        </div>
      )}
    </div>
  );
};

export default CheckinView;