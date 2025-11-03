import React, { useState, useMemo, useEffect } from 'react';
import { Attendee, CheckinStatus, Supplier, Sector } from '../../types.ts';
import AttendeeCard from '../AttendeeCard.tsx';
// FIX: Changed to a named import to resolve module error.
import { AttendeeDetailModal } from '../AttendeeDetailModal.tsx';
import * as api from '../../firebase/service.ts';
import { useTranslation } from '../../hooks/useTranslation.tsx';
import { SearchIcon, CheckCircleIcon, UsersIcon, ArrowDownTrayIcon } from '../icons.tsx';
import * as XLSX from 'xlsx';

type UserRole = 'admin' | 'checkin';

interface CheckinViewProps {
  userRole: UserRole;
  attendees: Attendee[];
  suppliers: Supplier[];
  sectors: Sector[];
  currentEventId: string;
  currentEventName: string;
  onUpdateAttendeeDetails: (attendeeId: string, data: Partial<Pick<Attendee, 'name' | 'cpf' | 'sectors' | 'wristbands' | 'subCompany' | 'supplierId'>>) => Promise<void>;
  onDeleteAttendee: (attendeeId: string) => Promise<void>;
  onApproveSubstitution: (attendeeId: string) => Promise<void>;
  onRejectSubstitution: (attendeeId: string) => Promise<void>;
  onApproveSectorChange: (attendeeId: string) => Promise<void>;
  onRejectSectorChange: (attendeeId: string) => Promise<void>;
  onApproveNewRegistration: (attendeeId: string) => Promise<void>;
  onRejectNewRegistration: (attendeeId: string) => Promise<void>;
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

const CheckinView: React.FC<CheckinViewProps> = ({ userRole, attendees, suppliers, sectors, currentEventId, currentEventName, onUpdateAttendeeDetails, onDeleteAttendee, onApproveSubstitution, onRejectSubstitution, onApproveSectorChange, onRejectSectorChange, onApproveNewRegistration, onRejectNewRegistration, setError }) => {
  const { t } = useTranslation();
  const sessionKey = `filters_${currentEventId}`;

  const [filters, setFilters] = useState(() => {
    const savedFilters = sessionStorage.getItem(sessionKey);
    if (savedFilters) {
      return JSON.parse(savedFilters);
    }
    return {
      searchTerm: '',
      searchBy: 'ALL',
      statusFilter: CheckinStatus.PENDING,
      supplierFilter: 'ALL',
    };
  });
  
  const { searchTerm, searchBy, statusFilter, supplierFilter } = filters;

  useEffect(() => {
    sessionStorage.setItem(sessionKey, JSON.stringify(filters));
  }, [filters, sessionKey]);

  const [selectedAttendee, setSelectedAttendee] = useState<Attendee | null>(null);

  const sectorMap = useMemo(() => {
    return new Map(sectors.map(s => [s.id, s]));
  }, [sectors]);

  const supplierMap = useMemo(() => {
    return new Map(suppliers.map(s => [s.id, s]));
  }, [suppliers]);

  const handleFilterChange = (key: keyof typeof filters, value: any) => {
    setFilters((prev: any) => ({ ...prev, [key]: value }));
  };

  const handleSelectAttendee = (attendee: Attendee) => {
    setSelectedAttendee(attendee);
  };

  const handleUpdateStatus = async (status: CheckinStatus, wristbands?: { [sectorId: string]: string }) => {
    if (selectedAttendee) {
      await api.updateAttendeeStatus(currentEventId, selectedAttendee.id, status, wristbands);
      // Optimistically update local state for a smoother UI
      setSelectedAttendee(prev => {
        if (!prev) return null;
        
        // Start with the guaranteed update
        const updatedAttendee: Attendee = { ...prev, status };

        // Only update wristbands in the local state if a new value was provided
        if (wristbands !== undefined) {
          updatedAttendee.wristbands = wristbands;
        }

        return updatedAttendee;
      });
    }
  };
  
  const handleDelete = async (attendeeId: string) => {
      await onDeleteAttendee(attendeeId);
      setSelectedAttendee(null); // Close modal on success
  };

  const formatCPF = (cpf: string) => {
    if (!cpf) return '';
    return cpf
      .replace(/\D/g, '')
      .slice(0, 11)
      .replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const handleExportToExcel = () => {
    const dataToExport = attendees.map(attendee => {
        const sectorLabels = (attendee.sectors || [])
            .map(id => sectorMap.get(id)?.label)
            .filter(Boolean)
            .join(', ');

        const supplierName = attendee.supplierId ? supplierMap.get(attendee.supplierId)?.name : '';
        const wristbandNumbers = attendee.wristbands ? Object.values(attendee.wristbands).filter(Boolean).join(', ') : '';
        const statusLabel = t(`status.${attendee.status.toLowerCase()}`);

        return {
            'Nome': attendee.name,
            'CPF': formatCPF(attendee.cpf),
            'Status': statusLabel,
            'Setor(es)': sectorLabels,
            'Fornecedor': supplierName,
            'Empresa': attendee.subCompany || '',
            'Pulseira(s)': wristbandNumbers,
        };
    });

    // Create a new worksheet from the JSON data
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    
    // Create a new workbook
    const wb = XLSX.utils.book_new();
    
    // Append the worksheet to the workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Colaboradores');
    
    // Generate the XLSX file data
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    
    // Create a Blob from the data
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
    
    // Create a download link
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    const fileName = `${currentEventName.replace(/\s/g, '_')}_colaboradores.xlsx`;
    link.setAttribute('download', fileName);
    
    // Trigger the download
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
        let match = false;
        if (searchBy === 'ALL') {
          match = normalizeString(attendee.name).includes(normalizedTerm) ||
                  attendee.cpf.replace(/\D/g, '').includes(normalizedTerm) ||
                  (attendee.wristbands ? Object.values(attendee.wristbands).some(num => normalizeString(String(num)).includes(normalizedTerm)) : false) ||
                  (attendee.subCompany ? normalizeString(attendee.subCompany).includes(normalizedTerm) : false);
        } else if (searchBy === 'NAME') {
          match = normalizeString(attendee.name).includes(normalizedTerm);
        } else if (searchBy === 'CPF') {
          match = attendee.cpf.replace(/\D/g, '').includes(normalizedTerm);
        } else if (searchBy === 'WRISTBAND') {
          match = attendee.wristbands ? Object.values(attendee.wristbands).some(num => normalizeString(String(num)).includes(normalizedTerm)) : false;
        }
        if (!match) return false;
      }
      
      return true;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [attendees, searchTerm, searchBy, statusFilter, supplierFilter]);


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
          <div className="flex-grow w-full flex flex-col sm:flex-row gap-2">
            <div className="relative flex-grow">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder={t('checkin.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <select
              value={searchBy}
              onChange={(e) => handleFilterChange('searchBy', e.target.value)}
              className="w-full sm:w-48 bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">{t('checkin.filter.searchBy.all')}</option>
              <option value="NAME">{t('checkin.filter.searchBy.name')}</option>
              <option value="CPF">{t('checkin.filter.searchBy.cpf')}</option>
              <option value="WRISTBAND">{t('checkin.filter.searchBy.wristband')}</option>
            </select>
          </div>
          <div className="flex items-center gap-6 text-white flex-shrink-0">
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
            onChange={(e) => handleFilterChange('statusFilter', e.target.value as CheckinStatus | 'ALL')}
            className="w-full md:w-1/2 bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">{t('checkin.filter.allStatuses')}</option>
            {Object.values(CheckinStatus).map(status => (
              <option key={status} value={status}>{t(`status.${status.toLowerCase()}`)}</option>
            ))}
          </select>
          <select
            value={supplierFilter}
            onChange={(e) => handleFilterChange('supplierFilter', e.target.value)}
            className="w-full md:w-1/2 bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">{t('checkin.filter.allSuppliers')}</option>
            {suppliers.map(supplier => (
              <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
            ))}
             <option value="">Sem fornecedor</option>
          </select>
        </div>
        <div className="pt-4 border-t border-gray-700/50 flex justify-end">
          <button
            onClick={handleExportToExcel}
            className="bg-green-700 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
          >
            <ArrowDownTrayIcon className="w-5 h-5" />
            {t('checkin.exportExcelButton')}
          </button>
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
              userRole={userRole}
              attendee={selectedAttendee}
              sectors={sectors}
              suppliers={suppliers}
              allAttendees={attendees}
              currentEventId={currentEventId}
              onClose={() => setSelectedAttendee(null)}
              onUpdateStatus={handleUpdateStatus}
              onUpdateDetails={onUpdateAttendeeDetails}
              onDelete={handleDelete}
              onApproveSubstitution={onApproveSubstitution}
              onRejectSubstitution={onRejectSubstitution}
              onApproveSectorChange={onApproveSectorChange}
              onRejectSectorChange={onRejectSectorChange}
              onApproveNewRegistration={onApproveNewRegistration}
              onRejectNewRegistration={onRejectNewRegistration}
              setError={setError}
              supplier={supplier}
            />
          );
      })()}
    </div>
  );
};

export default CheckinView;