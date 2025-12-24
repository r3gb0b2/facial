import React, { useState, useMemo, useEffect } from 'react';
import { Attendee, CheckinStatus, Supplier, Sector, User } from '../../types.ts';
import AttendeeCard from '../AttendeeCard.tsx';
import { AttendeeDetailModal } from '../AttendeeDetailModal.tsx';
import * as api from '../../firebase/service.ts';
import { useTranslation } from '../../hooks/useTranslation.tsx';
import { SearchIcon, CheckCircleIcon, UsersIcon, ArrowDownTrayIcon, FaceSmileIcon } from '../icons.tsx';
import * as XLSX from 'xlsx';

interface CheckinViewProps {
  user: User;
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
  isVip?: boolean;
}

const normalizeString = (str: string) => {
  if (!str) return '';
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
};

const CheckinView: React.FC<CheckinViewProps> = ({ user, attendees, suppliers, sectors, currentEventId, currentEventName, onUpdateAttendeeDetails, onDeleteAttendee, onApproveSubstitution, onRejectSubstitution, onApproveSectorChange, onRejectSectorChange, onApproveNewRegistration, onRejectNewRegistration, setError, isVip = false }) => {
  const { t } = useTranslation();
  const sessionKey = `filters_${currentEventId}`;

  const [filters, setFilters] = useState(() => {
    const savedFilters = sessionStorage.getItem(sessionKey);
    if (savedFilters) return JSON.parse(savedFilters);
    
    return {
      searchTerm: '',
      searchBy: 'ALL',
      // FIX: Em modo VIP, o padrão é "ALL" para que cadastros PENDING_APPROVAL apareçam imediatamente
      statusFilter: isVip ? 'ALL' : CheckinStatus.PENDING,
      supplierFilter: 'ALL',
    };
  });
  
  const { searchTerm, searchBy, statusFilter, supplierFilter } = filters;

  useEffect(() => {
    sessionStorage.setItem(sessionKey, JSON.stringify(filters));
  }, [filters, sessionKey]);

  const [selectedAttendee, setSelectedAttendee] = useState<Attendee | null>(null);

  const sectorMap = useMemo(() => new Map(sectors.map(s => [s.id, s])), [sectors]);
  const supplierMap = useMemo(() => new Map(suppliers.map(s => [s.id, s])), [suppliers]);

  const handleFilterChange = (key: keyof typeof filters, value: any) => {
    setFilters((prev: any) => ({ ...prev, [key]: value }));
  };

  const handleSelectAttendee = (attendee: Attendee) => setSelectedAttendee(attendee);

  const handleUpdateStatus = async (status: CheckinStatus, wristbands?: { [sectorId: string]: string }) => {
    if (selectedAttendee) {
      await api.updateAttendeeStatus(currentEventId, selectedAttendee.id, status, user.username, wristbands);
      setSelectedAttendee(prev => {
        if (!prev) return null;
        const updated = { ...prev, status };
        if (wristbands !== undefined) updated.wristbands = wristbands;
        return updated;
      });
    }
  };
  
  const handleDelete = async (attendeeId: string) => {
      await onDeleteAttendee(attendeeId);
      setSelectedAttendee(null);
  };

  const formatCPF = (cpf: string) => {
    if (!cpf) return '';
    return cpf.replace(/\D/g, '').slice(0, 11).replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const handleExportToExcel = () => {
    const dataToExport = attendees.map(attendee => {
        const sectorLabels = (attendee.sectors || []).map(id => sectorMap.get(id)?.label).filter(Boolean).join(', ');
        const supplierName = attendee.supplierId ? supplierMap.get(attendee.supplierId)?.name : '';
        const wristbandNumbers = attendee.wristbands ? Object.values(attendee.wristbands).filter(Boolean).join(', ') : '';
        const statusLabel = t(`status.${attendee.status.toLowerCase()}`);

        return {
            [isVip ? 'Nome do Convidado' : 'Nome']: attendee.name,
            'CPF': formatCPF(attendee.cpf),
            'Status': statusLabel,
            'Setor(es)': sectorLabels,
            [isVip ? 'Divulgadora / Host' : 'Fornecedor']: supplierName,
            [isVip ? 'Grupo / Empresa' : 'Empresa']: attendee.subCompany || '',
            'Pulseira(s)': wristbandNumbers,
        };
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, isVip ? 'Convidados' : 'Colaboradores');
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${currentEventName.replace(/\s/g, '_')}_lista.xlsx`;
    link.click();
  };

  const filteredAttendees = useMemo(() => {
    const normalizedTerm = normalizeString(searchTerm);

    return attendees.filter((attendee) => {
      if (statusFilter !== 'ALL' && attendee.status !== statusFilter) return false;
      if (supplierFilter !== 'ALL') {
        if (supplierFilter === '') { if (attendee.supplierId) return false; } 
        else { if (attendee.supplierId !== supplierFilter) return false; }
      }
      if (normalizedTerm) {
        let match = false;
        if (searchBy === 'ALL') {
          match = normalizeString(attendee.name).includes(normalizedTerm) ||
                  attendee.cpf.replace(/\D/g, '').includes(normalizedTerm) ||
                  (attendee.wristbands ? Object.values(attendee.wristbands).some(num => normalizeString(String(num)).includes(normalizedTerm)) : false) ||
                  (attendee.subCompany ? normalizeString(attendee.subCompany).includes(normalizedTerm) : false);
        } else if (searchBy === 'NAME') { match = normalizeString(attendee.name).includes(normalizedTerm); }
        else if (searchBy === 'CPF') { match = attendee.cpf.replace(/\D/g, '').includes(normalizedTerm); }
        else if (searchBy === 'WRISTBAND') { match = attendee.wristbands ? Object.values(attendee.wristbands).some(num => normalizeString(String(num)).includes(normalizedTerm)) : false; }
        if (!match) return false;
      }
      return true;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [attendees, searchTerm, searchBy, statusFilter, supplierFilter]);

  const stats = useMemo(() => ({
      checkedIn: filteredAttendees.filter(a => a.status === CheckinStatus.CHECKED_IN).length,
      pending: filteredAttendees.filter(a => a.status === CheckinStatus.PENDING || a.status === CheckinStatus.PENDING_APPROVAL).length,
      total: filteredAttendees.length,
  }), [filteredAttendees]);

  // --- VIP STYLES ---
  const containerClass = isVip 
    ? "bg-neutral-900/40 backdrop-blur-2xl p-8 rounded-[2.5rem] shadow-[0_40px_100px_rgba(0,0,0,0.6)] border border-white/5" 
    : "bg-gray-800/50 backdrop-blur-sm p-6 rounded-2xl shadow-2xl border border-gray-700";

  const inputClass = isVip
    ? "w-full bg-black/40 border border-neutral-800 rounded-2xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 transition-all placeholder:text-neutral-700 font-medium"
    : "w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500";

  return (
    <div className="w-full max-w-7xl mx-auto">
      <div className={`${containerClass} mb-8 space-y-6`}>
        <div className="flex flex-col xl:flex-row justify-between items-center gap-8">
          <div className="flex-grow w-full flex flex-col md:flex-row gap-4">
            <div className="relative flex-grow">
              <SearchIcon className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${isVip ? 'text-rose-500' : 'text-gray-400'}`} />
              <input
                type="text"
                placeholder={isVip ? "Buscar convidado ou grupo..." : t('checkin.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                className={`${inputClass} pl-12`}
              />
            </div>
            <select
              value={searchBy}
              onChange={(e) => handleFilterChange('searchBy', e.target.value)}
              className={`${inputClass} md:w-60 cursor-pointer`}
            >
              <option value="ALL">{t('checkin.filter.searchBy.all')}</option>
              <option value="NAME">{t('checkin.filter.searchBy.name')}</option>
              <option value="CPF">{t('checkin.filter.searchBy.cpf')}</option>
              <option value="WRISTBAND">{t('checkin.filter.searchBy.wristband')}</option>
            </select>
          </div>
          
          <div className="flex items-center gap-10 text-white flex-shrink-0">
            <div className="text-center group">
              <p className={`text-3xl font-black ${isVip ? 'text-rose-400' : 'text-green-400'} flex items-center justify-center gap-2`}>
                <CheckCircleIcon className="w-7 h-7" /> {stats.checkedIn}
              </p>
              <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mt-1">Presentes</p>
            </div>
            <div className="text-center">
              <p className={`text-3xl font-black ${isVip ? 'text-amber-300' : 'text-yellow-400'}`}>{stats.pending}</p>
              <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mt-1">Lista de Espera</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-black flex items-center justify-center gap-2">
                {isVip ? <FaceSmileIcon className="w-7 h-7 text-neutral-400" /> : <UsersIcon className="w-7 h-7 text-neutral-400" />} 
                {stats.total}
              </p>
              <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mt-1">Capacidade</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <select
            value={statusFilter}
            onChange={(e) => handleFilterChange('statusFilter', e.target.value as CheckinStatus | 'ALL')}
            className={inputClass}
          >
            <option value="ALL">{t('checkin.filter.allStatuses')}</option>
            {Object.values(CheckinStatus).map(status => (
              <option key={status} value={status}>{t(`status.${status.toLowerCase()}`)}</option>
            ))}
          </select>
          <select
            value={supplierFilter}
            onChange={(e) => handleFilterChange('supplierFilter', e.target.value)}
            className={inputClass}
          >
            <option value="ALL">{isVip ? "Todas as Divulgadoras" : t('checkin.filter.allSuppliers')}</option>
            {suppliers.map(supplier => (
              <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
            ))}
             <option value="">Sem Host Vinculada</option>
          </select>
        </div>

        <div className="pt-6 border-t border-white/5 flex justify-end">
          <button
            onClick={handleExportToExcel}
            className={`${isVip ? 'bg-white text-black hover:bg-neutral-200' : 'bg-green-700 hover:bg-green-600 text-white'} font-black text-[10px] uppercase tracking-widest py-3 px-6 rounded-2xl transition-all flex items-center gap-3 shadow-xl`}
          >
            <ArrowDownTrayIcon className="w-4 h-4" />
            Exportar Lista
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 animate-in fade-in duration-700">
        {filteredAttendees.map((attendee) => {
            const attendeeSectors = Array.isArray(attendee.sectors) ? attendee.sectors : [];
            const sectorsList = attendeeSectors.map(id => {
                const sector = sectorMap.get(id);
                return { label: sector?.label || id, color: sector?.color };
            });
            const supplier = attendee.supplierId ? supplierMap.get(attendee.supplierId) : undefined;
            
            return (
              <div key={attendee.id} className={isVip ? "transform transition-all hover:scale-[1.03]" : ""}>
                <AttendeeCard 
                  attendee={attendee} 
                  onSelect={handleSelectAttendee}
                  sectors={sectorsList}
                  supplierName={supplier?.name}
                />
              </div>
            );
        })}
      </div>
      
      {filteredAttendees.length === 0 && (
          <div className="text-center col-span-full py-32 opacity-40">
              {isVip && <FaceSmileIcon className="w-16 h-16 mx-auto mb-4 text-neutral-600" />}
              <p className="text-gray-500 font-bold uppercase tracking-widest text-sm">
                {searchTerm.trim() ? `Nenhum convidado encontrado para "${searchTerm}"` : "A lista VIP está vazia no momento"}
              </p>
          </div>
      )}
      
      {selectedAttendee && (() => {
          const supplier = selectedAttendee.supplierId ? supplierMap.get(selectedAttendee.supplierId) : undefined;
          return (
            <AttendeeDetailModal
              user={user}
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