
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
    return savedFilters ? JSON.parse(savedFilters) : {
      searchTerm: '',
      searchBy: 'ALL',
      statusFilter: 'ALL',
      supplierFilter: 'ALL',
      companyFilter: 'ALL',
    };
  });
  
  const { searchTerm, searchBy, statusFilter, supplierFilter, companyFilter } = filters;
  const [selectedAttendeeIds, setSelectedAttendeeIds] = useState<Set<string>>(new Set<string>());

  useEffect(() => {
    sessionStorage.setItem(sessionKey, JSON.stringify(filters));
  }, [filters, sessionKey]);

  const [selectedAttendee, setSelectedAttendee] = useState<Attendee | null>(null);

  const sectorMap = useMemo(() => new Map(sectors.map(s => [s.id, s])), [sectors]);
  const supplierMap = useMemo(() => new Map(suppliers.map(s => [s.id, s])), [suppliers]);

  const availableCompanies = useMemo(() => {
    const companies = new Set<string>();
    attendees.forEach(a => { if (a.subCompany) companies.add(a.subCompany); });
    return Array.from(companies).sort();
  }, [attendees]);

  const handleFilterChange = (key: string, value: any) => {
    setFilters((prev: any) => ({ ...prev, [key]: value }));
  };

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

  const handleExportToExcel = () => {
    const dataToExport = attendees.map(attendee => ({
        [isVip ? 'Nome do Convidado' : 'Nome']: attendee.name,
        'CPF': attendee.cpf,
        'Status': t(`status.${attendee.status.toLowerCase()}`),
        'Empresa': attendee.subCompany || '',
        'Fornecedor': attendee.supplierId ? supplierMap.get(attendee.supplierId)?.name : '',
    }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lista');
    XLSX.writeFile(wb, `${currentEventName}.xlsx`);
  };

  const filteredAttendees = useMemo(() => {
    const normalizedTerm = normalizeString(searchTerm);

    return attendees.filter((attendee) => {
      if (statusFilter !== 'ALL' && attendee.status !== statusFilter) return false;
      if (supplierFilter !== 'ALL' && attendee.supplierId !== supplierFilter) return false;
      if (companyFilter !== 'ALL' && attendee.subCompany !== companyFilter) return false;

      if (normalizedTerm) {
        const wristbandsStr = attendee.wristbands ? Object.values(attendee.wristbands).join(' ') : '';
        if (searchBy === 'ALL') {
          return normalizeString(attendee.name).includes(normalizedTerm) ||
                 attendee.cpf.includes(normalizedTerm) ||
                 normalizeString(wristbandsStr).includes(normalizedTerm) ||
                 (attendee.subCompany && normalizeString(attendee.subCompany).includes(normalizedTerm));
        }
        if (searchBy === 'NAME') return normalizeString(attendee.name).includes(normalizedTerm);
        if (searchBy === 'CPF') return attendee.cpf.includes(normalizedTerm);
      }
      return true;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [attendees, searchTerm, searchBy, statusFilter, supplierFilter, companyFilter]);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 pb-32">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
              { label: 'Total Geral', val: attendees.length, color: 'text-white' },
              { label: 'Presentes', val: attendees.filter(a => a.status === CheckinStatus.CHECKED_IN).length, color: isVip ? 'text-rose-500' : 'text-green-400' },
              { label: 'Pendentes', val: attendees.filter(a => a.status === CheckinStatus.PENDING).length, color: 'text-amber-400' },
              { label: 'Filtrados', val: filteredAttendees.length, color: 'text-indigo-400' }
          ].map(s => (
              <div key={s.label} className="bg-neutral-900/80 border border-white/5 p-6 rounded-[2rem] text-center shadow-xl">
                  <p className={`text-4xl font-black tracking-tighter ${s.color}`}>{s.val}</p>
                  <p className="text-[10px] text-neutral-500 uppercase font-black tracking-widest mt-2">{s.label}</p>
              </div>
          ))}
      </div>

      <div className="bg-neutral-900/50 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-2xl">
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-8 relative">
              <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-600" />
              <input type="text" placeholder="Nome, CPF, Pulseira ou Empresa..." value={searchTerm} onChange={(e) => handleFilterChange('searchTerm', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl py-4 px-12 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all font-medium" />
            </div>
            <select value={searchBy} onChange={(e) => handleFilterChange('searchBy', e.target.value)} className="md:col-span-4 bg-black/40 border border-white/10 rounded-xl py-4 px-4 text-white focus:outline-none font-bold uppercase text-[10px] tracking-widest">
              <option value="ALL">Buscar por Tudo</option>
              <option value="NAME">Por Nome</option>
              <option value="CPF">Por CPF</option>
            </select>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
             <select value={statusFilter} onChange={(e) => handleFilterChange('statusFilter', e.target.value)} className="bg-black/40 border border-white/10 rounded-xl py-4 px-4 text-white focus:outline-none font-bold uppercase text-[10px] tracking-widest">
                <option value="ALL">Todos os Status</option>
                {Object.values(CheckinStatus).map(s => <option key={s} value={s}>{t(`status.${s.toLowerCase()}`)}</option>)}
             </select>
             <select value={companyFilter} onChange={(e) => handleFilterChange('companyFilter', e.target.value)} className="bg-black/40 border border-white/10 rounded-xl py-4 px-4 text-white focus:outline-none font-bold uppercase text-[10px] tracking-widest">
                <option value="ALL">Todas as Empresas</option>
                {availableCompanies.map(c => <option key={c} value={c}>{c}</option>)}
             </select>
             <select value={supplierFilter} onChange={(e) => handleFilterChange('supplierFilter', e.target.value)} className="bg-black/40 border border-white/10 rounded-xl py-4 px-4 text-white focus:outline-none font-bold uppercase text-[10px] tracking-widest">
                <option value="ALL">Todos Fornecedores</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
             </select>
             <button onClick={handleExportToExcel} className="bg-white text-black hover:bg-neutral-200 font-black text-[10px] uppercase tracking-widest py-4 px-6 rounded-xl transition-all flex items-center justify-center gap-3 shadow-xl">
                <ArrowDownTrayIcon className="w-4 h-4" /> Exportar Planilha
             </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {filteredAttendees.map((attendee) => (
          <div key={attendee.id} className="relative group">
            <div onClick={(e) => toggleAttendeeSelection(attendee.id, e)} className={`absolute top-4 left-4 z-20 w-6 h-6 rounded-lg border-2 transition-all cursor-pointer flex items-center justify-center ${selectedAttendeeIds.has(attendee.id) ? 'bg-indigo-500 border-indigo-500' : 'bg-black/40 border-white/20'}`}>
                {selectedAttendeeIds.has(attendee.id) && <CheckCircleIcon className="w-4 h-4 text-white" />}
            </div>
            <AttendeeCard attendee={attendee} onSelect={setSelectedAttendee} sectors={(attendee.sectors || []).map(id => ({ label: sectorMap.get(id)?.label || id, color: sectorMap.get(id)?.color }))} supplierName={attendee.supplierId ? supplierMap.get(attendee.supplierId)?.name : ''} />
          </div>
        ))}
      </div>

      {selectedAttendee && (
        <AttendeeDetailModal user={user} attendee={selectedAttendee} sectors={sectors} suppliers={suppliers} allAttendees={attendees} currentEventId={currentEventId} onClose={() => setSelectedAttendee(null)} onUpdateStatus={handleUpdateStatus} onUpdateDetails={onUpdateAttendeeDetails} onDelete={onDeleteAttendee} onApproveSubstitution={onApproveSubstitution} onRejectSubstitution={onRejectSubstitution} onApproveSectorChange={onApproveSectorChange} onRejectSectorChange={onRejectSectorChange} onApproveNewRegistration={onApproveNewRegistration} onRejectNewRegistration={onRejectNewRegistration} setError={setError} supplier={selectedAttendee.supplierId ? supplierMap.get(selectedAttendee.supplierId) : undefined} isVip={isVip} />
      )}
    </div>
  );
};

export default CheckinView;
