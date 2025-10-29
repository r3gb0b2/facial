import React, { useState, useMemo, useCallback } from 'react';
import { Attendee, CheckinStatus, Sector, Supplier } from '../../types.ts';
import { useTranslation } from '../../hooks/useTranslation.tsx';
import AttendeeCard from '../AttendeeCard.tsx';
import VerificationModal from '../VerificationModal.tsx';
import { AttendeeDetailModal } from '../AttendeeDetailModal.tsx';
import { SearchIcon, UsersIcon, CheckCircleIcon, SpinnerIcon } from '../icons.tsx';
import * as api from '../../firebase/service.ts';

interface CheckinViewProps {
  attendees: Attendee[];
  suppliers: Supplier[];
  sectors: Sector[];
  eventId: string;
  allAttendees: Attendee[];
  setError: (message: string) => void;
}

const normalizeString = (str: string) => {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
};

const CheckinView: React.FC<CheckinViewProps> = ({ attendees, suppliers, sectors, eventId, allAttendees, setError }) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({ status: 'ALL', supplier: 'ALL' });
  const [selectedAttendee, setSelectedAttendee] = useState<Attendee | null>(null);
  const [verifyingAttendee, setVerifyingAttendee] = useState<Attendee | null>(null);
  
  const sectorMap = useMemo(() => new Map(sectors.map(s => [s.id, s])), [sectors]);
  const supplierMap = useMemo(() => new Map(suppliers.map(s => [s.id, s])), [suppliers]);

  const stats = useMemo(() => {
    return attendees.reduce(
      (acc, attendee) => {
        acc.total++;
        if (attendee.status === CheckinStatus.CHECKED_IN) {
          acc.checkedIn++;
        } else if (attendee.status === CheckinStatus.PENDING) {
          acc.pending++;
        }
        return acc;
      },
      { checkedIn: 0, pending: 0, total: 0 }
    );
  }, [attendees]);

  const filteredAttendees = useMemo(() => {
    const normalizedTerm = normalizeString(searchTerm);

    return attendees.filter(attendee => {
      if (filters.status !== 'ALL' && attendee.status !== filters.status) {
        return false;
      }
      if (filters.supplier !== 'ALL' && attendee.supplierId !== filters.supplier) {
        return false;
      }
      if (normalizedTerm) {
        const nameMatch = normalizeString(attendee.name).includes(normalizedTerm);
        const cpfMatch = attendee.cpf.includes(normalizedTerm);
        const wristbandMatch = attendee.wristbands ? Object.values(attendee.wristbands).some(wb => normalizeString(wb).includes(normalizedTerm)) : false;
        
        return nameMatch || cpfMatch || wristbandMatch;
      }
      return true;
    });
  }, [attendees, searchTerm, filters]);
  
  const handleUpdateStatus = useCallback(async (attendeeId: string, status: CheckinStatus, wristbands?: { [sectorId: string]: string }) => {
    await api.updateAttendeeStatus(eventId, attendeeId, status, wristbands);
  }, [eventId]);

  const handleUpdateDetails = useCallback(async (attendeeId: string, data: Partial<Attendee>) => {
    await api.updateAttendeeDetails(eventId, attendeeId, data);
  }, [eventId]);

  const handleDelete = useCallback(async (attendeeId: string) => {
    await api.deleteAttendee(eventId, attendeeId);
    setSelectedAttendee(null);
  }, [eventId]);
  
  const handleApproveSubstitution = useCallback(async (attendeeId: string) => {
    await api.approveSubstitution(eventId, attendeeId);
    setSelectedAttendee(null);
  }, [eventId]);
  
  const handleRejectSubstitution = useCallback(async (attendeeId: string) => {
    await api.rejectSubstitution(eventId, attendeeId);
    setSelectedAttendee(null);
  }, [eventId]);

  const handleVerificationSuccess = (attendee: Attendee) => {
    setVerifyingAttendee(null);
    setSelectedAttendee(attendee);
  }

  const renderNoResults = () => {
    if (searchTerm) {
      return <p className="text-center text-gray-400">{t('checkin.search.noResultsForTerm', searchTerm)}</p>;
    }
    return <p className="text-center text-gray-400">{t('checkin.search.noResultsForFilter')}</p>;
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800/50 p-4 rounded-lg flex items-center gap-4 border border-gray-700">
            <CheckCircleIcon className="w-8 h-8 text-green-400"/>
            <div>
                <div className="text-2xl font-bold text-white">{stats.checkedIn}</div>
                <div className="text-sm font-semibold text-gray-400 uppercase">{t('checkin.stats.checkedIn')}</div>
            </div>
        </div>
        <div className="bg-gray-800/50 p-4 rounded-lg flex items-center gap-4 border border-gray-700">
            <SpinnerIcon className="w-8 h-8 text-yellow-400 !animate-none"/>
            <div>
                <div className="text-2xl font-bold text-white">{stats.pending}</div>
                <div className="text-sm font-semibold text-gray-400 uppercase">{t('checkin.stats.pending')}</div>
            </div>
        </div>
        <div className="bg-gray-800/50 p-4 rounded-lg flex items-center gap-4 border border-gray-700">
            <UsersIcon className="w-8 h-8 text-indigo-400"/>
            <div>
                <div className="text-2xl font-bold text-white">{stats.total}</div>
                <div className="text-sm font-semibold text-gray-400 uppercase">{t('checkin.stats.total')}</div>
            </div>
        </div>
      </div>
      
      <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
        <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-grow">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                  type="text"
                  placeholder={t('checkin.searchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
                <option value="ALL">{t('checkin.filter.allStatuses')}</option>
                {Object.values(CheckinStatus).map(s => <option key={s} value={s}>{t(`status.${s.toLowerCase()}`)}</option>)}
            </select>
            <select
                value={filters.supplier}
                onChange={(e) => setFilters(prev => ({ ...prev, supplier: e.target.value }))}
                className="bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
                <option value="ALL">{t('checkin.filter.allSuppliers')}</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {filteredAttendees.length > 0 ? (
          filteredAttendees.map(attendee => {
            const primarySectorId = attendee.sectors?.[0];
            const primarySector = primarySectorId ? sectorMap.get(primarySectorId) : undefined;
            
            return (
              <AttendeeCard
                key={attendee.id}
                attendee={attendee}
                onSelect={() => {
                  if (attendee.status === CheckinStatus.PENDING) {
                    setVerifyingAttendee(attendee);
                  } else {
                    setSelectedAttendee(attendee);
                  }
                }}
                sectorLabel={primarySector?.label || 'N/A'}
                sectorColor={primarySector?.color}
                supplierName={attendee.supplierId ? supplierMap.get(attendee.supplierId)?.name : undefined}
              />
            );
          })
        ) : (
          <div className="col-span-full py-8">
            {renderNoResults()}
          </div>
        )}
      </div>

      {verifyingAttendee && (
        <VerificationModal
          attendee={verifyingAttendee}
          onClose={() => setVerifyingAttendee(null)}
          onConfirm={() => handleVerificationSuccess(verifyingAttendee)}
        />
      )}

      {selectedAttendee && (
        <AttendeeDetailModal
          attendee={selectedAttendee}
          sectors={sectors}
          suppliers={suppliers}
          allAttendees={allAttendees}
          onClose={() => setSelectedAttendee(null)}
          onUpdateStatus={(status, wristbands) => handleUpdateStatus(selectedAttendee.id, status, wristbands)}
          onUpdateDetails={handleUpdateDetails}
          onDelete={handleDelete}
          onApproveSubstitution={handleApproveSubstitution}
          onRejectSubstitution={handleRejectSubstitution}
          setError={setError}
          supplier={selectedAttendee.supplierId ? supplierMap.get(selectedAttendee.supplierId) : undefined}
        />
      )}
    </div>
  );
};

export default CheckinView;
