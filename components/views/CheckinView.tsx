import React, { useState, useMemo } from 'react';
import { Attendee, CheckinStatus, Supplier, Sector } from '../../types.ts';
import AttendeeCard from '../AttendeeCard.tsx';
import AttendeeDetailModal from '../AttendeeDetailModal.tsx';
import * as api from '../../firebase/service.ts';
import { useTranslation } from '../../hooks/useTranslation.tsx';
import { SearchIcon, CheckCircleIcon, UsersIcon } from '../icons.tsx';

interface CheckinViewProps {
  attendees: Attendee[];
  suppliers: Supplier[];
  sectors: Sector[];
  currentEventId: string;
  onUpdateAttendeeDetails: (attendeeId: string, data: Partial<Pick<Attendee, 'name' | 'cpf' | 'sectors' | 'wristbands' | 'subCompany'>>) => Promise<void>;
  onDeleteAttendee: (attendeeId: string) => Promise<void>;
  onApproveSubstitution: (attendeeId: string) => Promise<void>;
  onRejectSubstitution: (attendeeId: string) => Promise<void>;
  setError: (message: string) => void;
}

// Helper function for accent-insensitive search
const normalizeString = (str: string) => {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
};

const CheckinView: React.FC<CheckinViewProps> = ({ attendees, suppliers, sectors, currentEventId, onUpdateAttendeeDetails, onDeleteAttendee, onApproveSubstitution, onRejectSubstitution, setError }) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<CheckinStatus | 'ALL'>(CheckinStatus.PENDING);
  const [supplierFilter, setSupplierFilter] = useState<string | 'ALL'>('ALL');
  const [selectedAttendee, setSelectedAttendee] = useState<Attendee | null>(null);

  const handleSelectAttendee = (attendee: Attendee) => {
    setSelectedAttendee(attendee);
  };

  const handleUpdateStatus = async (status: CheckinStatus, wristbands?: { [sectorId: string]: string }) => {
    if (selectedAttendee) {
      await api.updateAttendeeStatus(currentEventId, selectedAttendee.id, status, wristbands);
      // Optimistically update local state for a smoother UI
      setSelectedAttendee(prev => prev ? { ...prev, status, wristbands } : null);
    }
  };
  
  const handleDelete = async (attendeeId: string) => {
      await onDeleteAttendee(attendeeId);
      setSelectedAttendee(null); // Close modal on success
  };


  const sectorMap = useMemo(() => {
    return new Map(sectors.map(s => [s.id, s]));
  }, [sectors]);

  const supplierMap = useMemo(() => {
    return new Map(suppliers.map(s => [s.id, s]));
  }, [suppliers]);


  const filteredAttendees = useMemo(() => {
    const normalizedTerm = normalizeString(searchTerm);

    return attendees.filter((attendee) => {
      // Status filter
      if (statusFilter !== 'ALL' && attendee.status !== statusFilter) {
        return false;
      }
      
      // Supplier filter
      if (supplierFilter !== 'ALL') {
        if (supplierFilter === '') { // "Sem fornecedor" option
          if (attendee.supplierId) return false;
        } else { // A specific supplier is selected
          if (attendee.supplierId !== supplierFilter) return false;
        }
      }

      // Search term filter
      if (normalizedTerm) {
        const nameMatch = normalizeString(attendee.name).includes(normalizedTerm);
        const cpfMatch = attendee.cpf.replace(/\D/g, '').includes(normalizedTerm);
        const wristbandMatch = attendee.wristbands ? Object.values(attendee.wristbands).some(num => normalizeString(num).includes(normalizedTerm)) : false;
        const subCompanyMatch = attendee.subCompany ? normalizeString(attendee.subCompany).includes(normalizedTerm) : false;
        if (!nameMatch && !cpfMatch && !wristbandMatch && !subCompanyMatch) {
          return false; // if neither name, CPF, wristband nor sub-company matches, filter it out
        }
      }
      return true; // if it passes all filters, include it
    });
  }, [attendees, searchTerm, statusFilter, supplierFilter]);


  const stats = useMemo(() => {
    return {
      checkedIn: filteredAttendees.filter(a => a.status === 'CHECKED_IN').length,
      pending: filteredAttendees.filter(a => a.status === 'PENDING').length,
      total: filteredAttendees.length,
    };
  }, [filteredAttendees]);

  return (
    <div className="w-full max-w-7xl mx-auto">
      <div className="bg-gray-800/50 backdrop-blur-sm p-6 rounded-2xl shadow-2xl border border-gray-700 mb-6 space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="relative w-full md:w-1/3">
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
              <p className="text-2xl font-bold text-green-400 flex items-center gap-2"><CheckCircleIcon className="w-6 h-6" /> {stats.checkedIn}</p>
              <p className="text-xs text-gray-400 uppercase font-semibold">{t('checkin.stats.checkedIn')}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-400">{stats.pending}</p>
              <p className="text-xs text-gray-400 uppercase font-semibold">{t('checkin.stats.pending')}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold flex items-center gap-2"><UsersIcon className="w-6 h-6" /> {stats.total}</p>
              <p className="text-xs text-gray-400 uppercase font-semibold">{t('checkin.stats.total')}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col md:flex-row gap-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as CheckinStatus | 'ALL')}
            className="w-full md:w-1/2 bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">{t('checkin.filter.allStatuses')}</option>
            {Object.values(CheckinStatus).map(status => (
              // FIX: Cast result of t() to string to resolve 'unknown' type error.
              <option key={status} value={status}>{t(`status.${status.toLowerCase()}`) as string}</option>
            ))}
          </select>
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="w-full md:w-1/2 bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">{t('checkin.filter.allSuppliers')}</option>
            {suppliers.map(supplier => (
              <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
            ))}
             <option value="">Sem fornecedor</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {filteredAttendees.map((attendee) => {
            const attendeeSectors = Array.isArray(attendee.sectors) ? attendee.sectors : [];

            const labelsAndColors = attendeeSectors.map(id => {
                const sector = sectorMap.get(id);
                return {
                    label: sector?.label || id, // Fallback to ID if sector not found
                    color: sector?.color
                };
            });

            const joinedLabels = labelsAndColors.map(item => item.label).filter(Boolean).join(', ');
            const sectorLabel = joinedLabels || 'Sem setor';
            const primarySectorColor = labelsAndColors.length > 0 ? labelsAndColors[0].color : undefined;
            const supplier = attendee.supplierId ? supplierMap.get(attendee.supplierId) : undefined;
            
            return (
              <AttendeeCard 
                key={attendee.id} 
                attendee={attendee} 
                onSelect={handleSelectAttendee}
                sectorLabel={sectorLabel}
                sectorColor={primarySectorColor}
                supplierName={supplier?.name}
              />
            );
        })}
      </div>
      
      {filteredAttendees.length === 0 && (
          <div className="text-center col-span-full py-16">
              <p className="text-gray-400">
                {searchTerm.trim()
                  ? t('checkin.search.noResultsForTerm', searchTerm)
                  : t('checkin.search.noResultsForFilter')
                }
              </p>
          </div>
      )}
      
      {selectedAttendee && (() => {
          const supplier = selectedAttendee.supplierId ? supplierMap.get(selectedAttendee.supplierId) : undefined;
          
          return (
            <AttendeeDetailModal
              attendee={selectedAttendee}
              sectors={sectors}
              allAttendees={attendees}
              onClose={() => setSelectedAttendee(null)}
              onUpdateStatus={handleUpdateStatus}
              onUpdateDetails={onUpdateAttendeeDetails}
              onDelete={handleDelete}
              onApproveSubstitution={onApproveSubstitution}
              onRejectSubstitution={onRejectSubstitution}
              setError={setError}
              supplier={supplier}
            />
          );
      })()}
    </div>
  );
};

export default CheckinView;