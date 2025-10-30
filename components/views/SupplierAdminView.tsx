import React, { useState, useMemo } from 'react';
import { Attendee, CheckinStatus, Sector, Supplier } from '../../types.ts';
import { useTranslation } from '../../hooks/useTranslation.tsx';
import { EyeIcon, PencilIcon, SearchIcon } from '../icons.tsx';
import SubstitutionRequestModal from '../SubstitutionRequestModal.tsx';

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
  
  // State for filters
  const [searchTerm, setSearchTerm] = useState('');
  const [companyFilter, setCompanyFilter] = useState('ALL');

  const handleEditSuccess = (attendeeId: string) => {
    setSubmittedEdits(prev => new Set(prev).add(attendeeId));
  };
  
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

    return attendees.filter((attendee) => {
      // Company filter
      if (companyFilter !== 'ALL' && attendee.subCompany !== companyFilter) {
        return false;
      }

      // Search term filter
      if (normalizedTerm) {
        const nameMatch = normalizeString(attendee.name).includes(normalizedTerm);
        if (!nameMatch) {
          return false;
        }
      }
      return true;
    });
  }, [attendees, searchTerm, companyFilter]);

  const allowedSectorsForSupplier = useMemo(() => {
    return sectors.filter(s => (supplier.sectors || []).includes(s.id));
  }, [sectors, supplier]);


  return (
    <div className="w-full min-h-screen p-4 md:p-8">
      <div className="w-full max-w-7xl mx-auto">
        <header className="py-6 text-center">
            <EyeIcon className="w-12 h-12 mx-auto text-indigo-400 mb-2" />
            <h1 className="text-3xl md:text-4xl font-bold text-white">
            {t('supplierAdmin.title')}
            </h1>
            <p className="text-gray-400 mt-1 text-lg">{t('supplierAdmin.supplier')} <span className="font-semibold text-gray-300">{eventName}</span></p>
        </header>

        {/* Filters Section */}
        <div className="bg-gray-800/50 backdrop-blur-sm p-4 rounded-xl shadow-lg border border-gray-700 mb-8 flex flex-col md:flex-row gap-4">
            <div className="relative flex-grow">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                    type="text"
                    placeholder={t('supplierAdmin.filter.searchPlaceholder')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
            </div>
            {uniqueCompanies.length > 0 && (
                 <select
                    value={companyFilter}
                    onChange={(e) => setCompanyFilter(e.target.value)}
                    className="w-full md:w-1/3 bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                    <option value="ALL">{t('supplierAdmin.filter.allCompanies')}</option>
                    {uniqueCompanies.map(company => (
                        <option key={company} value={company}>{company}</option>
                    ))}
                </select>
            )}
        </div>

        <main>
            {attendees.length > 0 ? (
                filteredAttendees.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
                        {filteredAttendees.map((attendee) => {
                          const isPending = attendee.status === CheckinStatus.PENDING;
                          const isEditRequested = submittedEdits.has(attendee.id) || attendee.status === CheckinStatus.SUBSTITUTION_REQUEST;
                          
                          return (
                            <div key={attendee.id} className="bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-700 flex flex-col">
                                <img 
                                    src={attendee.photo} 
                                    alt={attendee.name} 
                                    className="w-full aspect-square object-contain bg-black" 
                                />
                                <div className="p-3 text-center flex-grow flex flex-col justify-between">
                                    <div>
                                        <h3 className="font-semibold text-base text-white truncate" title={attendee.name}>{attendee.name}</h3>
                                        {attendee.subCompany && <p className="text-xs text-gray-400 truncate" title={attendee.subCompany}>{attendee.subCompany}</p>}
                                    </div>
                                    <div className='space-y-1 mt-2'>
                                      {isPending && (
                                        <>
                                          <button
                                            onClick={() => setEditingAttendee(attendee)}
                                            disabled={isEditRequested}
                                            className="w-full text-sm font-semibold py-2 px-2 rounded-md transition-colors flex items-center justify-center gap-1.5 disabled:bg-gray-600 disabled:cursor-not-allowed bg-indigo-600 hover:bg-indigo-700 text-white whitespace-nowrap"
                                          >
                                            <PencilIcon className="w-4 h-4" />
                                            {isEditRequested ? t('supplierAdmin.editRequested') : t('supplierAdmin.requestEdit')}
                                          </button>
                                        </>
                                      )}
                                    </div>
                                </div>
                            </div>
                          )
                        })}
                    </div>
                ) : (
                    <div className="text-center text-gray-500 py-16">
                        <p>{t('checkin.search.noResultsForFilter')}</p>
                    </div>
                )
            ) : (
                <div className="text-center text-gray-500 py-16">
                    <p>{t('supplierAdmin.noAttendees')}</p>
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
    </div>
  );
};

export default SupplierAdminView;