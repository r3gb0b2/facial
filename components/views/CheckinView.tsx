import React, { useState } from 'react';
import { Attendee, CheckinStatus, Sector } from '../../types';
import AttendeeCard from '../AttendeeCard';
import { FingerPrintIcon, SearchIcon } from '../icons';
import { useTranslation } from '../../hooks/useTranslation';
import StatusUpdateModal from '../StatusUpdateModal';

interface CheckinViewProps {
  attendees: Attendee[];
  sectors: Sector[];
  onStatusUpdate: (attendee: Attendee, newStatus: CheckinStatus) => void;
}

// Helper function to normalize strings for accent-insensitive search
const normalizeString = (str: string): string => {
  if (!str) return '';
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

const CheckinView: React.FC<CheckinViewProps> = ({ attendees, sectors, onStatusUpdate }) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAttendee, setSelectedAttendee] = useState<Attendee | null>(null);

  const handleOpenModal = (attendee: Attendee) => {
    setSelectedAttendee(attendee);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedAttendee(null);
  };

  const handleUpdate = (newStatus: CheckinStatus) => {
    if (selectedAttendee) {
      onStatusUpdate(selectedAttendee, newStatus);
    }
  };

  const filteredAttendees = attendees.filter(attendee => {
    const normalizedSearchTerm = normalizeString(searchTerm);
    const nameMatch = normalizeString(attendee.name).includes(normalizedSearchTerm);
    const cpfMatch = attendee.cpf.includes(searchTerm.replace(/\D/g, ''));
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
          {sectors.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
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
            <AttendeeCard key={attendee.id} attendee={attendee} onSelect={handleOpenModal} />
          ))}
        </div>
      )}
      <StatusUpdateModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onUpdate={handleUpdate}
        attendee={selectedAttendee}
      />
    </div>
  );
};

export default CheckinView;