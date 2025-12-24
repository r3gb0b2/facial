import React, { useState, useMemo } from 'react';
import { Attendee, CheckinStatus, Sector, Supplier } from '../../types.ts';
import { useTranslation } from '../../hooks/useTranslation.tsx';
import { EyeIcon, PencilIcon, SearchIcon, UsersIcon, SparklesIcon, TrashIcon } from '../icons.tsx';
import SubstitutionRequestModal from '../SubstitutionRequestModal.tsx';
import SupplierRegistrationModal from '../SupplierRegistrationModal.tsx';

interface SupplierAdminViewProps {
  eventName: string;
  attendees: Attendee[];
  eventId: string;
  supplier: Supplier;
  sectors: Sector[];
}

const normalizeString = (str: string) => {
  if (!str) return '';
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
};

const SupplierAdminView: React.FC<SupplierAdminViewProps> = ({ eventName, attendees, eventId, supplier, sectors }) => {
  const { t } = useTranslation();
  const [editingAttendee, setEditingAttendee] = useState<Attendee | null>(null);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const stats = useMemo(() => {
    const total = attendees.length;
    const limit = supplier.registrationLimit || 0;
    return { total, limit, available: limit - total };
  }, [attendees, supplier]);

  const filteredAttendees = useMemo(() => {
    const normalizedTerm = normalizeString(searchTerm);
    return attendees.filter(a => normalizeString(a.name).includes(normalizedTerm))
                    .sort((a, b) => a.name.localeCompare(b.name));
  }, [attendees, searchTerm]);

  return (
    <div className="min-h-screen bg-[#050505] text-white p-4 md:p-10 font-sans selection:bg-rose-500/30">
      <div className="max-w-7xl mx-auto space-y-12">
        
        {/* Header Premium */}
        <header className="flex flex-col lg:flex-row justify-between items-end lg:items-center gap-8 bg-neutral-900/40 p-8 md:p-12 rounded-[3rem] border border-white/5 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-600 via-amber-400 to-rose-600"></div>
            <div>
                <div className="flex items-center gap-3 mb-4">
                    <SparklesIcon className="w-5 h-5 text-rose-500" />
                    <span className="text-[10px] font-black uppercase tracking-[0.5em] text-neutral-500">Concierge Dashboard</span>
                </div>
                <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase leading-none mb-3">
                    {supplier.name}
                </h1>
                <p className="text-neutral-500 font-bold text-sm tracking-widest uppercase">{eventName}</p>
            </div>

            <div className="flex items-center gap-10">
                <div className="text-center">
                    <p className="text-4xl font-black tracking-tighter leading-none">{stats.total}</p>
                    <p className="text-[9px] text-neutral-600 uppercase font-black tracking-widest mt-2">Ativos</p>
                </div>
                <div className="w-[1px] h-12 bg-white/5"></div>
                <div className="text-center">
                    <p className={`text-4xl font-black tracking-tighter leading-none ${stats.available > 0 ? 'text-amber-500' : 'text-red-500'}`}>
                        {stats.available}
                    </p>
                    <p className="text-[9px] text-neutral-600 uppercase font-black tracking-widest mt-2">Vagas</p>
                </div>
                <button 
                    onClick={() => setIsRegisterModalOpen(true)}
                    disabled={stats.total >= stats.limit}
                    className="bg-white text-black font-black uppercase tracking-widest text-[11px] py-5 px-10 rounded-2xl hover:scale-105 transition-all shadow-2xl active:scale-95 disabled:bg-neutral-800 disabled:text-neutral-600"
                >
                    Novo Convidado VIP
                </button>
            </div>
        </header>

        {/* Guest Gallery */}
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 px-4">
                <h2 className="text-2xl font-black uppercase tracking-tighter">Minha Guest List <span className="text-neutral-700 ml-2">/ {filteredAttendees.length}</span></h2>
                <div className="relative w-full md:w-80">
                    <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600" />
                    <input 
                        type="text" 
                        placeholder="Buscar convidado..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-neutral-900 border border-white/5 rounded-xl py-3 pl-12 pr-6 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500/30 w-full"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-8">
                {filteredAttendees.map(attendee => (
                    <div key={attendee.id} className="group bg-neutral-900/40 rounded-[2.5rem] overflow-hidden border border-white/5 hover:border-white/20 transition-all hover:shadow-[0_40px_80px_rgba(0,0,0,0.8)] flex flex-col">
                        <div className="aspect-[4/5] relative overflow-hidden bg-neutral-950">
                            <img src={attendee.photo} className="w-full h-full object-cover transition-all duration-1000 group-hover:scale-110" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-90"></div>
                            
                            {/* Status Badge */}
                            <div className="absolute top-4 left-4">
                                <div className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${attendee.status === CheckinStatus.CHECKED_IN ? 'bg-rose-600 text-white' : 'bg-neutral-800 text-neutral-400'}`}>
                                    {t(`status.${attendee.status.toLowerCase()}`)}
                                </div>
                            </div>

                            <div className="absolute bottom-6 left-0 right-0 px-6 text-center">
                                <h3 className="font-black text-lg uppercase tracking-tighter leading-none mb-1">{attendee.name}</h3>
                                <p className="text-[9px] text-rose-500/80 font-black uppercase tracking-widest">{attendee.subCompany || 'Individual'}</p>
                            </div>
                        </div>
                        
                        <div className="p-4 bg-black/40 flex items-center justify-center gap-2 border-t border-white/5">
                            <button 
                                onClick={() => setEditingAttendee(attendee)}
                                className="flex-grow flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-[10px] font-black uppercase tracking-widest"
                            >
                                <PencilIcon className="w-3 h-3 text-neutral-400" />
                                Ajustar
                            </button>
                        </div>
                    </div>
                ))}
            </div>
            
            {filteredAttendees.length === 0 && (
                <div className="text-center py-40 border-2 border-dashed border-white/5 rounded-[4rem] bg-neutral-900/10">
                    <UsersIcon className="w-16 h-16 mx-auto mb-4 text-neutral-800" />
                    <p className="text-neutral-600 font-bold uppercase tracking-widest text-xs">Nenhum convidado localizado na lista vip.</p>
                </div>
            )}
        </div>

      </div>

      {isRegisterModalOpen && (
        <SupplierRegistrationModal
          eventId={eventId}
          supplier={supplier}
          allowedSectors={sectors}
          onClose={() => setIsRegisterModalOpen(false)}
          onSuccess={() => {}}
        />
      )}
      
      {editingAttendee && (
        <SubstitutionRequestModal 
            attendee={editingAttendee}
            eventId={eventId}
            onClose={() => setEditingAttendee(null)}
            onSuccess={() => {}}
            allowedSectors={sectors}
        />
      )}
    </div>
  );
};

export default SupplierAdminView;