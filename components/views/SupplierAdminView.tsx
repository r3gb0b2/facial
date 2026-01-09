
import React, { useState, useMemo } from 'react';
import { Attendee, CheckinStatus, Sector, Supplier } from '../../types.ts';
import { useTranslation } from '../../hooks/useTranslation.tsx';
import { EyeIcon, PencilIcon, SearchIcon, UsersIcon, CheckCircleIcon, XMarkIcon } from '../icons.tsx';
import SubstitutionRequestModal from '../SubstitutionRequestModal.tsx';
import SupplierRegistrationModal from '../SupplierRegistrationModal.tsx';
import * as api from '../../firebase/service.ts';
import UserAvatar from '../UserAvatar.tsx';

interface SupplierAdminViewProps {
  eventName: string;
  attendees: Attendee[];
  eventId: string;
  supplier: Supplier;
  sectors: Sector[];
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


const SupplierAdminView: React.FC<SupplierAdminViewProps> = ({ eventName, attendees, eventId, supplier, sectors }) => {
  const { t } = useTranslation();
  const [editingAttendee, setEditingAttendee] = useState<Attendee | null>(null);
  const [submittedEdits, setSubmittedEdits] = useState<Set<string>>(new Set());
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // State for filters
  const [searchTerm, setSearchTerm] = useState('');
  const [companyFilter, setCompanyFilter] = useState('ALL');
  
  // State for batch approval
  const [selectedForApproval, setSelectedForApproval] = useState<Set<string>>(new Set());
  const [isApproving, setIsApproving] = useState(false);

  const handleEditSuccess = (attendeeId: string) => {
    setSubmittedEdits(prev => new Set(prev).add(attendeeId));
  };
  
  const handleRegisterSuccess = () => {
    setSuccessMessage(t('supplierAdmin.modal.successMessage'));
    setTimeout(() => setSuccessMessage(''), 5000);
  };

  const pendingAttendees = useMemo(() => {
    return attendees.filter(a => a.status === CheckinStatus.SUPPLIER_REVIEW);
  }, [attendees]);

  const activeAttendees = useMemo(() => {
    return attendees.filter(a => a.status !== CheckinStatus.SUPPLIER_REVIEW);
  }, [attendees]);

  const uniqueCompanies = useMemo(() => {
    const companies = new Set<string>();
    attendees.forEach(attendee => {
        if (attendee.subCompany) {
            companies.add(attendee.subCompany);
        }
    });
    return Array.from(companies).sort();
  }, [attendees]);

  const filteredAttendees = useMemo(() => {
    const normalizedTerm = normalizeString(searchTerm);

    const filtered = activeAttendees.filter((attendee) => {
      if (companyFilter !== 'ALL' && attendee.subCompany !== companyFilter) {
        return false;
      }
      if (normalizedTerm) {
        const nameMatch = normalizeString(attendee.name).includes(normalizedTerm);
        if (!nameMatch) return false;
      }
      return true;
    });

    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [activeAttendees, searchTerm, companyFilter]);

  const allowedSectorsForSupplier = useMemo(() => {
    return sectors.filter(s => (supplier.sectors || []).includes(s.id));
  }, [sectors, supplier]);

  const handleToggleSelection = (id: string) => {
    setSelectedForApproval(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
    });
  };

  const handleBatchApprove = async () => {
    if (selectedForApproval.size === 0) return;
    setIsApproving(true);
    try {
        await api.approveAttendeesBySupplier(eventId, Array.from(selectedForApproval));
        setSelectedForApproval(new Set());
        setSuccessMessage(`${selectedForApproval.size} colaborador(es) liberados com sucesso!`);
        setTimeout(() => setSuccessMessage(''), 5000);
    } catch (e) {
        console.error(e);
        alert("Falha ao aprovar.");
    } finally {
        setIsApproving(false);
    }
  };

  return (
    <div className="w-full min-h-screen p-4 md:p-8 bg-neutral-950">
      <div className="w-full max-w-7xl mx-auto">
        <header className="py-6 text-center">
            <EyeIcon className="w-12 h-12 mx-auto text-indigo-400 mb-2" />
            <h1 className="text-3xl md:text-4xl font-bold text-white uppercase tracking-tighter">
            {t('supplierAdmin.title')}
            </h1>
            <p className="text-gray-500 mt-1 text-lg font-bold uppercase tracking-widest">{supplier.name} &bull; <span className="text-indigo-400">{eventName}</span></p>
        </header>

        {/* Section: Pending Approvals */}
        {pendingAttendees.length > 0 && (
            <section className="mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
                <div className="bg-blue-600/10 border border-blue-500/20 rounded-[2.5rem] p-8 shadow-2xl">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-8">
                        <div>
                            <h2 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                                <UsersIcon className="w-6 h-6 text-blue-400" />
                                Aprovação Pendente ({pendingAttendees.length})
                            </h2>
                            <p className="text-blue-400/60 text-xs font-bold uppercase tracking-widest mt-1">Colaboradores aguardando sua liberação para acesso</p>
                        </div>
                        <div className="flex items-center gap-4">
                             {selectedForApproval.size > 0 && (
                                <button 
                                    onClick={handleBatchApprove}
                                    disabled={isApproving}
                                    className="bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest text-[10px] py-4 px-8 rounded-2xl shadow-xl transition-all active:scale-95 flex items-center gap-2"
                                >
                                    {isApproving ? 'Processando...' : `Aprovar Selecionados (${selectedForApproval.size})`}
                                </button>
                             )}
                             <button 
                                onClick={() => setSelectedForApproval(new Set(pendingAttendees.map(a => a.id)))}
                                className="text-[10px] font-black uppercase tracking-widest text-blue-400/80 hover:text-blue-300"
                             >
                                Selecionar Tudo
                             </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {pendingAttendees.map(attendee => (
                            <div 
                                key={attendee.id} 
                                onClick={() => handleToggleSelection(attendee.id)}
                                className={`relative p-5 rounded-[2rem] border transition-all cursor-pointer group ${selectedForApproval.has(attendee.id) ? 'bg-blue-600/20 border-blue-500/40 shadow-lg' : 'bg-black/40 border-white/5 hover:border-blue-500/20'}`}
                            >
                                <div className={`absolute top-4 right-4 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${selectedForApproval.has(attendee.id) ? 'bg-blue-500 border-blue-500' : 'border-white/10 group-hover:border-blue-500/40'}`}>
                                    {selectedForApproval.has(attendee.id) && <CheckCircleIcon className="w-4 h-4 text-white" />}
                                </div>
                                <div className="flex items-center gap-5">
                                    <UserAvatar src={attendee.photo} alt={attendee.name} className="w-[100px] h-[100px] rounded-3xl object-cover bg-black shadow-2xl" />
                                    <div className="overflow-hidden">
                                        <p className="font-black text-white uppercase tracking-tight text-base truncate">{attendee.name}</p>
                                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">{attendee.subCompany || 'Individual'}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        )}

        {/* Filters Section */}
        <div className="bg-neutral-900/60 backdrop-blur-xl p-6 rounded-[2rem] border border-white/10 mb-8 flex flex-col md:flex-row gap-4 shadow-xl">
            <div className="relative flex-grow">
                <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-600" />
                <input
                    type="text"
                    placeholder={t('supplierAdmin.filter.searchPlaceholder')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-black/40 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-bold uppercase text-[10px] tracking-widest"
                />
            </div>
            {uniqueCompanies.length > 0 && (
                 <select
                    value={companyFilter}
                    onChange={(e) => setCompanyFilter(e.target.value)}
                    className="bg-black/40 border border-white/5 rounded-2xl py-4 px-6 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-bold uppercase text-[10px] tracking-widest appearance-none cursor-pointer"
                >
                    <option value="ALL">{t('supplierAdmin.filter.allCompanies')}</option>
                    {uniqueCompanies.map(company => (
                        <option key={company} value={company}>{company}</option>
                    ))}
                </select>
            )}
             <button
                onClick={() => setIsRegisterModalOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest text-[10px] py-4 px-8 rounded-2xl transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3"
            >
                <UsersIcon className="w-5 h-5" />
                {t('supplierAdmin.registerButton')}
            </button>
        </div>
        
        {successMessage && (
          <div className="fixed top-10 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-10 py-5 rounded-3xl shadow-2xl font-black uppercase tracking-widest text-xs animate-in slide-in-from-top-10">
              {successMessage}
          </div>
        )}

        <main>
            {activeAttendees.length > 0 ? (
                filteredAttendees.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8">
                        {filteredAttendees.map((attendee) => {
                          const isPending = attendee.status === CheckinStatus.PENDING;
                          const isEditRequested = submittedEdits.has(attendee.id) || attendee.status === CheckinStatus.SUBSTITUTION_REQUEST;
                          
                          return (
                            <div key={attendee.id} className="bg-neutral-900 border border-white/5 rounded-[2rem] overflow-hidden shadow-lg transition-all hover:border-indigo-500/30 group">
                                <div className="relative aspect-square">
                                    <UserAvatar 
                                        src={attendee.photo} 
                                        alt={attendee.name} 
                                        className="w-full h-full object-cover transition-all duration-500" 
                                    />
                                    <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black to-transparent">
                                         <h3 className="font-black text-sm text-white uppercase tracking-tight truncate">{attendee.name}</h3>
                                         <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest truncate">{attendee.subCompany || 'Individual'}</p>
                                    </div>
                                </div>
                                <div className="p-4 bg-black/40">
                                      {isPending && (
                                          <button
                                            onClick={() => setEditingAttendee(attendee)}
                                            disabled={isEditRequested}
                                            className={`w-full text-[10px] font-black uppercase tracking-widest py-3 rounded-xl transition-all flex items-center justify-center gap-2 ${isEditRequested ? 'bg-gray-800 text-gray-500' : 'bg-white/5 text-gray-400 hover:bg-indigo-600 hover:text-white'}`}
                                          >
                                            <PencilIcon className="w-3 h-3" />
                                            {isEditRequested ? t('supplierAdmin.editRequested') : t('supplierAdmin.requestEdit')}
                                          </button>
                                      )}
                                      {!isPending && (
                                           <div className="text-center py-2">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400/60">Acesso Liberado</span>
                                           </div>
                                      )}
                                </div>
                            </div>
                          )
                        })}
                    </div>
                ) : (
                    <div className="text-center text-gray-600 py-32">
                        <p className="text-sm font-bold uppercase tracking-widest">{t('checkin.search.noResultsForFilter')}</p>
                    </div>
                )
            ) : (
                <div className="text-center text-gray-600 py-32">
                    <p className="text-sm font-bold uppercase tracking-widest">{t('supplierAdmin.noAttendees')}</p>
                </div>
            )}
        </main>
      </div>
      {editingAttendee && (
        <SubstitutionRequestModal 
            attendee={editingAttendee}
            eventId={eventId}
            onClose={() => setEditingAttendee(null)}
            onSuccess={handleEditSuccess}
            allowedSectors={allowedSectorsForSupplier}
        />
      )}
      {isRegisterModalOpen && (
        <SupplierRegistrationModal
          eventId={eventId}
          supplier={supplier}
          allowedSectors={allowedSectorsForSupplier}
          onClose={() => setIsRegisterModalOpen(false)}
          onSuccess={handleRegisterSuccess}
        />
      )}
    </div>
  );
};

export default SupplierAdminView;
