
import React, { useState, useMemo, useEffect } from 'react';
import { Attendee, CheckinStatus, Supplier, Sector, User } from '../../types.ts';
import AttendeeCard from '../AttendeeCard.tsx';
import { AttendeeDetailModal } from '../AttendeeDetailModal.tsx';
import * as api from '../../firebase/service.ts';
import { useTranslation } from '../../hooks/useTranslation.tsx';
import { SearchIcon, CheckCircleIcon, UsersIcon, ArrowDownTrayIcon, FaceSmileIcon, XMarkIcon } from '../icons.tsx';
import * as XLSX from 'xlsx';

interface CheckinViewProps {
  user: User;
  attendees: Attendee[];
  suppliers: Supplier[];
  sectors: Sector[];
  currentEventId: string;
  currentEventName: string;
  onUpdateAttendeeDetails: (attendeeId: string, data: Partial<Attendee>) => Promise<void>;
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
      statusFilter: CheckinStatus.PENDING,
      supplierFilter: 'ALL',
      ageMin: '',
      ageMax: '',
    };
  });
  
  const { searchTerm, searchBy, statusFilter, supplierFilter, ageMin, ageMax } = filters;
  const [selectedAttendeeIds, setSelectedAttendeeIds] = useState<Set<string>>(new Set<string>());

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

  const toggleAttendeeSelection = (attendeeId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setSelectedAttendeeIds(prev => {
          const next = new Set(prev);
          if (next.has(attendeeId)) next.delete(attendeeId);
          else next.add(attendeeId);
          return next;
      });
  };

  const handleUpdateStatus = async (status: CheckinStatus, wristbands?: { [sectorId: string]: string }) => {
    if (selectedAttendee) {
      await api.updateAttendeeStatus(currentEventId, selectedAttendee.id, status, user.username, wristbands);
      setSelectedAttendee(null);
    }
  };
  
  const handleBulkStatusUpdate = async (status: CheckinStatus) => {
      try {
          // FIX: Explicitly typed id as string to avoid "unknown" type error during bulk update
          await Promise.all(Array.from(selectedAttendeeIds).map((id: string) => 
            api.updateAttendeeStatus(currentEventId, id, status, user.username)
          ));
          setSelectedAttendeeIds(new Set<string>());
      } catch (e) {
          setError("Falha na atualização em massa.");
      }
  };

  const formatCPF = (cpf: string) => {
    if (!cpf) return '';
    return cpf.replace(/\D/g, '').slice(0, 11).replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const handleExportToExcel = () => {
    const dataToExport = attendees.map(attendee => {
        // FIX: Improved type safety for sector labels join operation by using a type guard for filtering.
        const sectorLabels = (attendee.sectors || [])
            .map(id => sectorMap.get(id)?.label)
            .filter((l): l is string => typeof l === 'string')
            .join(', ');
        const supplierName = attendee.supplierId ? supplierMap.get(attendee.supplierId)?.name : '';
        const statusLabel = t(`status.${attendee.status.toLowerCase()}`);

        return {
            [isVip ? 'Nome do Convidado' : 'Nome']: attendee.name,
            'CPF': formatCPF(attendee.cpf),
            'Status': statusLabel,
            'Setor(es)': sectorLabels,
            [isVip ? 'Promoter' : 'Fornecedor']: supplierName,
            [isVip ? 'Local/Mesa' : 'Empresa']: attendee.subCompany || '',
        };
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lista');
    XLSX.writeFile(wb, `${currentEventName.replace(/\s/g, '_')}.xlsx`);
  };

  const filteredAttendees = useMemo(() => {
    const normalizedTerm = normalizeString(searchTerm);
    const min = parseInt(ageMin) || 0;
    const max = parseInt(ageMax) || 200;

    return attendees.filter((attendee) => {
      if (statusFilter !== 'ALL' && attendee.status !== statusFilter) return false;
      if (supplierFilter !== 'ALL') {
        if (supplierFilter === '') { if (attendee.supplierId) return false; } 
        else { if (attendee.supplierId !== supplierFilter) return false; }
      }
      
      // Filtro de idade
      if (ageMin || ageMax) {
          const attendeeAge = attendee.age || 0;
          if (attendeeAge < min || attendeeAge > max) return false;
      }

      if (normalizedTerm) {
        let match = false;
        if (searchBy === 'ALL') {
          match = normalizeString(attendee.name).includes(normalizedTerm) ||
                  attendee.cpf.replace(/\D/g, '').includes(normalizedTerm) ||
                  (attendee.subCompany ? normalizeString(attendee.subCompany).includes(normalizedTerm) : false);
        } else if (searchBy === 'NAME') { match = normalizeString(attendee.name).includes(normalizedTerm); }
        else if (searchBy === 'CPF') { match = attendee.cpf.replace(/\D/g, '').includes(normalizedTerm); }
        if (!match) return false;
      }
      return true;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [attendees, searchTerm, searchBy, statusFilter, supplierFilter, ageMin, ageMax]);

  const stats = useMemo(() => ({
      checkedIn: attendees.filter(a => a.status === CheckinStatus.CHECKED_IN).length,
      pending: attendees.filter(a => a.status === CheckinStatus.PENDING).length,
      rejected: attendees.filter(a => a.status === CheckinStatus.REJECTED || a.status === CheckinStatus.BLOCKED).length,
      total: attendees.length,
  }), [attendees]);

  const containerClass = isVip ? "bg-neutral-900/50 backdrop-blur-xl p-6 md:p-8 rounded-3xl shadow-2xl border border-white/10" : "bg-gray-800/50 backdrop-blur-sm p-6 rounded-2xl border border-gray-700";
  const inputClass = isVip ? "w-full bg-black/50 border border-neutral-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-rose-500/50 transition-all text-sm" : "w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm";

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 pb-32">
      
      {/* Dashboard de Contadores */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
              { label: t('checkin.stats.total'), val: stats.total, color: 'text-white' },
              { label: t('checkin.stats.pending'), val: stats.pending, color: 'text-amber-400' },
              { label: t('checkin.stats.checkedIn'), val: stats.checkedIn, color: 'text-rose-500' },
              { label: t('checkin.stats.rejected'), val: stats.rejected, color: 'text-neutral-500' }
          ].map(s => (
              <div key={s.label} className="bg-neutral-900/80 border border-white/5 p-6 rounded-[2rem] text-center shadow-xl">
                  <p className={`text-4xl font-black tracking-tighter ${s.color}`}>{s.val}</p>
                  <p className="text-[10px] text-neutral-500 uppercase font-black tracking-widest mt-2">{s.label}</p>
              </div>
          ))}
      </div>

      {/* Filtros */}
      <div className={containerClass}>
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-8 relative">
              <SearchIcon className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${isVip ? 'text-rose-400' : 'text-gray-400'}`} />
              <input
                type="text" placeholder={t('checkin.searchPlaceholder')}
                value={searchTerm} onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                className={`${inputClass} pl-12`}
              />
            </div>
            <select
              value={searchBy} onChange={(e) => handleFilterChange('searchBy', e.target.value)}
              className={`${inputClass} md:col-span-4 cursor-pointer`}
            >
              <option value="ALL">{t('checkin.filter.searchBy.all')}</option>
              <option value="NAME">{t('checkin.filter.searchBy.name')}</option>
              <option value="CPF">{t('checkin.filter.searchBy.cpf')}</option>
            </select>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
             <select
                value={statusFilter} onChange={(e) => handleFilterChange('statusFilter', e.target.value)}
                className={inputClass}
             >
                <option value="ALL">{t('checkin.filter.allStatuses')}</option>
                {/* FIX: Cast enum value s to string to ensure type safety in dynamic keys and toLowerCase calls */}
                {Object.values(CheckinStatus).map(s => <option key={s as string} value={s as string}>{t(`status.${(s as string).toLowerCase()}`)}</option>)}
             </select>
             <select
                value={supplierFilter} onChange={(e) => handleFilterChange('supplierFilter', e.target.value)}
                className={inputClass}
             >
                <option value="ALL">{t('checkin.filter.allSuppliers')}</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                <option value="">Sem Host Vinculada</option>
             </select>
             <div className="flex gap-2">
                <input type="number" placeholder="Min Idade" value={ageMin} onChange={(e) => handleFilterChange('ageMin', e.target.value)} className={inputClass} />
                <input type="number" placeholder="Max Idade" value={ageMax} onChange={(e) => handleFilterChange('ageMax', e.target.value)} className={inputClass} />
             </div>
             <button onClick={handleExportToExcel} className={`${isVip ? 'bg-white text-black hover:bg-neutral-200' : 'bg-green-600 hover:bg-green-700 text-white'} font-black text-[10px] uppercase tracking-widest py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-3 shadow-xl`}>
                <ArrowDownTrayIcon className="w-4 h-4" /> Exportar Lista
             </button>
          </div>
        </div>
      </div>

      {/* Grid de Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {filteredAttendees.map((attendee) => (
          <div key={attendee.id} className="relative group">
            <div 
                onClick={(e) => toggleAttendeeSelection(attendee.id, e)}
                className={`absolute top-4 left-4 z-20 w-6 h-6 rounded-lg border-2 transition-all cursor-pointer flex items-center justify-center ${selectedAttendeeIds.has(attendee.id) ? 'bg-rose-500 border-rose-500' : 'bg-black/40 border-white/20 hover:border-rose-500'}`}
            >
                {selectedAttendeeIds.has(attendee.id) && <CheckCircleIcon className="w-4 h-4 text-white" />}
            </div>
            <AttendeeCard 
              attendee={attendee} 
              onSelect={handleSelectAttendee}
              sectors={(attendee.sectors || []).map(id => ({ label: sectorMap.get(id)?.label || id, color: sectorMap.get(id)?.color }))}
              supplierName={attendee.supplierId ? supplierMap.get(attendee.supplierId)?.name : ''}
              isVipMode={isVip}
            />
          </div>
        ))}
      </div>
      
      {/* Botão de Ação em Massa */}
      {selectedAttendeeIds.size > 0 && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[80] bg-neutral-900 border border-rose-500/30 p-4 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.9)] flex items-center gap-6 animate-in slide-in-from-bottom-10">
              <p className="text-white font-black uppercase text-[10px] tracking-widest ml-4">{selectedAttendeeIds.size} selecionados</p>
              <div className="h-6 w-[1px] bg-white/10"></div>
              <button onClick={() => handleBulkStatusUpdate(CheckinStatus.CHECKED_IN)} className="bg-rose-600 text-white font-black uppercase tracking-widest text-[9px] py-3 px-6 rounded-xl hover:bg-rose-500">Aprovar Todos</button>
              <button onClick={() => setSelectedAttendeeIds(new Set<string>())} className="text-neutral-500 hover:text-white transition-colors p-2"><XMarkIcon className="w-6 h-6"/></button>
          </div>
      )}

      {selectedAttendee && (
        <AttendeeDetailModal
          user={user} attendee={selectedAttendee} sectors={sectors} suppliers={suppliers} allAttendees={attendees} currentEventId={currentEventId}
          onClose={() => setSelectedAttendee(null)} onUpdateStatus={handleUpdateStatus} onUpdateDetails={onUpdateAttendeeDetails}
          onDelete={onDeleteAttendee} onApproveSubstitution={onApproveSubstitution} onRejectSubstitution={onRejectSubstitution}
          onApproveSectorChange={onApproveSectorChange} onRejectSectorChange={onRejectSectorChange}
          onApproveNewRegistration={onApproveNewRegistration} onRejectNewRegistration={onRejectNewRegistration}
          setError={setError} supplier={selectedAttendee.supplierId ? supplierMap.get(selectedAttendee.supplierId) : undefined}
          isVip={isVip}
        />
      )}
    </div>
  );
};

export default CheckinView;
