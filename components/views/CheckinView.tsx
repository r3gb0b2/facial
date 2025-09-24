import React, { useState, useMemo } from 'react';
import { Attendee, CheckinStatus } from '../../types.ts';
import AttendeeCard from '../AttendeeCard.tsx';
import VerificationModal from '../VerificationModal.tsx';
import StatusUpdateModal from '../StatusUpdateModal.tsx';
import * as api from '../../firebase/service.ts';
import { useTranslation } from '../../hooks/useTranslation.tsx';
import { SearchIcon, CheckCircleIcon, UsersIcon } from '../icons.tsx';

interface CheckinViewProps {
  attendees: Attendee[];
  currentEventId: string;
}

const CheckinView: React.FC<CheckinViewProps> = ({ attendees, currentEventId }) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAttendee, setSelectedAttendee] = useState<Attendee | null>(null);
  const [attendeeForStatusUpdate, setAttendeeForStatusUpdate] = useState<Attendee | null>(null);
  
  const handleSelectAttendee = (attendee: Attendee) => {
    if (attendee.status === 'PENDING') {
      setSelectedAttendee(attendee);
    } else {
      setAttendeeForStatusUpdate(attendee);
    }
  };

  const handleConfirmCheckin = async () => {
    if (selectedAttendee) {
      await api.updateAttendeeStatus(currentEventId, selectedAttendee.id, CheckinStatus.CHECKED_IN);
      setSelectedAttendee(null);
    }
  };
  
  const handleUpdateStatus = async (status: CheckinStatus) => {
    if (attendeeForStatusUpdate) {
        await api.updateAttendeeStatus(currentEventId, attendeeForStatusUpdate.id, status);
        setAttendeeForStatusUpdate(null);
    }
  };

  const filteredAttendees = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return attendees;
    return attendees.filter(
      (attendee) =>
        attendee.name.toLowerCase().includes(term) ||
        attendee.cpf.replace(/\D/g, '').includes(term.replace(/\D/g, ''))
    );
  }, [attendees, searchTerm]);
  
  const stats = useMemo(() => {
    return {
        checkedIn: attendees.filter(a => a.status === 'CHECKED_IN').length,
        pending: attendees.filter(a => a.status === 'PENDING').length,
        total: attendees.length,
    }
  }, [attendees]);

  return (
    <div className="w-full max-w-7xl mx-auto">
      <div className="bg-gray-800/50 backdrop-blur-sm p-6 rounded-2xl shadow-2xl border border-gray-700 mb-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="relative w-full md:w-1/2">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                    type="text"
                    placeholder={t('checkin.searchPlaceholder')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
            </div>
            <div className="flex items-center gap-6 text-white">
                <div className="text-center">
                    <p className="text-2xl font-bold text-green-400 flex items-center gap-2"><CheckCircleIcon className="w-6 h-6"/> {stats.checkedIn}</p>
                    <p className="text-xs text-gray-400 uppercase font-semibold">{t('checkin.stats.checkedIn')}</p>
                </div>
                <div className="text-center">
                    <p className="text-2xl font-bold text-yellow-400">{stats.pending}</p>
                    <p className="text-xs text-gray-400 uppercase font-semibold">{t('checkin.stats.pending')}</p>
                </div>
                <div className="text-center">
                    <p className="text-2xl font-bold flex items-center gap-2"><UsersIcon className="w-6 h-6"/> {stats.total}</p>
                    <p className="text-xs text-gray-400 uppercase font-semibold">{t('checkin.stats.total')}</p>
                </div>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {filteredAttendees.map((attendee) => (
          <AttendeeCard key={attendee.id} attendee={attendee} onSelect={handleSelectAttendee} />
        ))}
      </div>
      
      {filteredAttendees.length === 0 && (
          <div className="text-center col-span-full py-16">
              <p className="text-gray-400">Nenhum participante encontrado.</p>
          </div>
      )}

      {selectedAttendee && (
        <VerificationModal
          attendee={selectedAttendee}
          onClose={() => setSelectedAttendee(null)}
          onConfirm={handleConfirmCheckin}
        />
      )}
      
      {attendeeForStatusUpdate && (
          <StatusUpdateModal
            attendee={attendeeForStatusUpdate}
            onClose={() => setAttendeeForStatusUpdate(null)}
            onUpdateStatus={handleUpdateStatus}
          />
      )}
    </div>
  );
};

export default CheckinView;
