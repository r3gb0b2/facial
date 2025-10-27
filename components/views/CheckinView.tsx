import React, { useState, useMemo } from 'react';
import { Attendee, CheckinStatus, Supplier, Sector, SupplierCategory } from '../../types';
import AttendeeCard from '../AttendeeCard';
import AttendeeDetailModal from '../AttendeeDetailModal';
import * as api from '../../firebase/service';
import { useTranslation } from '../../hooks/useTranslation';
import { SearchIcon, CheckCircleIcon, UsersIcon } from '../icons';

interface CheckinViewProps {
  attendees: Attendee[];
  suppliers: Supplier[];
  sectors: Sector[];
  supplierCategories: SupplierCategory[];
  currentEventId: string;
  onUpdateAttendeeDetails: (attendeeId: string, data: Partial<Pick<Attendee, 'name' | 'cpf' | 'sector' | 'wristbandNumber'>>) => Promise<void>;
  onDeleteAttendee: (attendeeId: string) => Promise<void>;
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

const CheckinView: React.FC<CheckinViewProps> = ({ attendees, suppliers, sectors, supplierCategories, currentEventId, onUpdateAttendeeDetails, onDeleteAttendee, setError }) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<CheckinStatus | 'ALL'>(CheckinStatus.PENDING);
  const [categoryFilter, setCategoryFilter] = useState<string | 'ALL'>('ALL');
  const [supplierFilter, setSupplierFilter] = useState<string | 'ALL'>('ALL');
  const [selectedAttendee, setSelectedAttendee] = useState<Attendee | null>(null);

  const handleSelectAttendee = (attendee: Attendee) => {
    setSelectedAttendee(attendee);
  };

  const handleUpdateStatus = async (status: CheckinStatus, wristbandNumber?: string) => {
    if (selectedAttendee) {
      await api.updateAttendeeStatus(currentEventId, selectedAttendee.id, status, wristbandNumber);
      // Optimistically update local state for a smoother UI
      setSelectedAttendee(prev => prev ? { ...prev, status, wristbandNumber } : null);
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
    return new Map(suppliers.map(s => [s.id, s.name]));
  }, [suppliers]);

  const suppliersForDropdown = useMemo(() => {
    if (categoryFilter === 'ALL') {
      return suppliers;
    }
    return suppliers.filter(s => s.categoryId === categoryFilter);
  }, [suppliers, categoryFilter]);

  const filteredAttendees = useMemo(() => {
    const normalizedTerm = normalizeString(searchTerm);

    return attendees.filter((attendee) => {
      // Status filter
      if (statusFilter !== 'ALL' && attendee.status !== statusFilter) {
        return false;
      }

      // Category and Supplier filters
      if (categoryFilter !== 'ALL') {
        const supplier = suppliers.find(s => s.id === attendee.supplierId);
        if (!supplier || supplier.categoryId !== categoryFilter) {
          return false;
        }
      }
      
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
        const wristbandMatch = attendee.wristbandNumber ? normalizeString(attendee.wristbandNumber).includes(normalizedTerm) : false;
        if (!nameMatch && !cpfMatch && !wristbandMatch) {
          return false; // if neither name, CPF nor wristband matches, filter it out
        }
      }
      return true; // if it passes all filters, include it
    });
  }, [attendees, searchTerm, statusFilter, categoryFilter, supplierFilter, suppliers]);


  const stats = useMemo(() => {
    return {
      checkedIn: attendees.filter(a => a.status === 'CHECKED_IN').length,
      pending: attendees.filter(a => a.status === 'PENDING').length,
      total: attendees.length,
    };
  }, [attendees]);
  
  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCategoryFilter(e.target.value);
    setSupplierFilter('ALL'); // Reset supplier filter when category changes
  };

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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as CheckinStatus | 'ALL')}
            className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">{t('checkin.filter.allStatuses')}</option>
            {Object.values(CheckinStatus).map(status => (
              <option key={status} value={status}>{t(`status.${status.toLowerCase()}` as any)}</option>
            ))}
          </select>
          <select
            value={categoryFilter}
            onChange={handleCategoryChange}
            className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">{t('checkin.filter.allSupplierCategories')}</option>
            {supplierCategories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">{t('checkin.filter.allSuppliers')}</option>
            {suppliersForDropdown.map(supplier => (
              <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
            ))}
            <option value="">Sem fornecedor</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {filteredAttendees.map((attendee) => {
            const sector = sectorMap.get(attendee.sector);
            const supplierName = attendee.supplierId ? supplierMap.get(attendee.supplierId) : undefined;
            return (
              <AttendeeCard 
                key={attendee.id} 
                attendee={attendee} 
                onSelect={handleSelectAttendee}
                sectorLabel={sector?.label || attendee.sector}
                sectorColor={sector?.color}
                supplierName={supplierName}
              />
            );
        })}
      </div>
      
      {filteredAttendees.length === 0 && (
          <div className="text-center col-span-full py-16">
              <p className="text-gray-400">
                {searchTerm.trim()
                  ? t('checkin.search.noResultsForTerm', searchTerm)
                  // @ts-ignore
                  : t('checkin.search.noResultsForFilter')
                }
              </p>
          </div>
      )}
      
      {selectedAttendee && (
        <AttendeeDetailModal
          attendee={selectedAttendee}
          sectors={sectors}
          onClose={() => setSelectedAttendee(null)}
          onUpdateStatus={handleUpdateStatus}
          onUpdateDetails={onUpdateAttendeeDetails}
          onDelete={handleDelete}
          setError={setError}
        />
      )}
    </div>
  );
};

export default CheckinView;