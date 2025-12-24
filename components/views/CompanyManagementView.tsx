
import React, { useState, useMemo } from 'react';
import { Attendee, Sector } from '../../types.ts';
import { useTranslation } from '../../hooks/useTranslation.tsx';
import { BuildingOfficeIcon, PencilIcon, CheckCircleIcon, XMarkIcon } from '../icons.tsx';
import BulkUpdateSectorsModal from '../CompanySectorsModal.tsx';

interface CompanyManagementViewProps {
    attendees: Attendee[];
    sectors: Sector[];
    onUpdateSectorsForSelectedAttendees: (attendeeIds: string[], sectorIds: string[]) => Promise<void>;
    setError: (message: string) => void;
}

const CompanyManagementView: React.FC<CompanyManagementViewProps> = ({
    attendees,
    sectors,
    onUpdateSectorsForSelectedAttendees,
    setError,
}) => {
    const { t } = useTranslation();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedAttendeeIds, setSelectedAttendeeIds] = useState<Set<string>>(new Set());
    const [expandedCompany, setExpandedCompany] = useState<string | null>(null);

    const companies = useMemo(() => {
        const companyMap = new Map<string, Attendee[]>();
        attendees.forEach(attendee => {
            if (attendee.subCompany) {
                const companyName = attendee.subCompany.trim();
                if (!companyMap.has(companyName)) {
                    companyMap.set(companyName, []);
                }
                companyMap.get(companyName)!.push(attendee);
            }
        });
        
        return Array.from(companyMap.entries())
            .map(([name, companyAttendees]) => ({
                name,
                attendees: companyAttendees.sort((a,b) => a.name.localeCompare(b.name)),
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [attendees]);

    const handleToggleCompany = (companyName: string) => {
        setExpandedCompany(prev => (prev === companyName ? null : companyName));
    };

    const handleToggleAttendee = (attendeeId: string) => {
        setSelectedAttendeeIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(attendeeId)) newSet.delete(attendeeId);
            else newSet.add(attendeeId);
            return newSet;
        });
    };

    const handleSelectAllInCompany = (companyAttendees: Attendee[]) => {
        const companyAttendeeIds = companyAttendees.map(a => a.id);
        const allSelectedInCompany = companyAttendeeIds.every(id => selectedAttendeeIds.has(id));

        setSelectedAttendeeIds(prev => {
            const newSet = new Set(prev);
            if (allSelectedInCompany) {
                companyAttendeeIds.forEach(id => newSet.delete(id));
            } else {
                companyAttendeeIds.forEach(id => newSet.add(id));
            }
            return newSet;
        });
    };
    
    const handleSaveSectors = async (sectorIds: string[]) => {
        try {
            await onUpdateSectorsForSelectedAttendees(Array.from(selectedAttendeeIds), sectorIds);
            setSelectedAttendeeIds(new Set());
        } catch (error) {
            setError("Falha ao atualizar setores.");
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto">
            <div className="bg-gray-800 p-8 rounded-xl border border-gray-700 shadow-xl">
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                    <BuildingOfficeIcon className="w-6 h-6 text-indigo-500" />
                    {t('companies.title')}
                </h2>
                
                {companies.length === 0 ? (
                    <div className="text-center py-10 border-2 border-dashed border-gray-700 rounded-xl">
                        <p className="text-gray-500 font-medium">{t('companies.noCompanies')}</p>
                        <p className="text-xs text-gray-600 mt-1">{t('companies.noCompaniesSubtitle')}</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {companies.map((company) => {
                             const isExpanded = expandedCompany === company.name;
                             const allInCompanySelected = company.attendees.every(a => selectedAttendeeIds.has(a.id));

                             return (
                                <div key={company.name} className="bg-gray-900/50 border border-gray-700 rounded-lg overflow-hidden transition-all">
                                    <button onClick={() => handleToggleCompany(company.name)} className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-800">
                                        <div>
                                            <p className="font-bold text-white">{company.name}</p>
                                            <p className="text-xs text-indigo-400">{t('companies.attendeeCount', company.attendees.length)}</p>
                                        </div>
                                        <svg className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>
                                    
                                     {isExpanded && (
                                        <div className="p-4 border-t border-gray-700 bg-black/20">
                                            <div className="flex items-center mb-4 pb-3 border-b border-gray-800">
                                                <input
                                                    type="checkbox"
                                                    id={`select-all-${company.name}`}
                                                    checked={allInCompanySelected}
                                                    onChange={() => handleSelectAllInCompany(company.attendees)}
                                                    className="h-4 w-4 rounded border-gray-500 bg-gray-700 text-indigo-600 focus:ring-indigo-500"
                                                />
                                                <label htmlFor={`select-all-${company.name}`} className="ml-3 text-sm font-bold text-gray-300 cursor-pointer">{t('companies.selectAll')}</label>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-2">
                                                {company.attendees.map(attendee => (
                                                    <label key={attendee.id} className="flex items-center p-2 rounded hover:bg-gray-800 cursor-pointer group">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedAttendeeIds.has(attendee.id)}
                                                            onChange={() => handleToggleAttendee(attendee.id)}
                                                            className="h-4 w-4 rounded border-gray-500 bg-gray-700 text-indigo-600 focus:ring-indigo-500"
                                                        />
                                                        <span className="ml-3 text-sm text-gray-300 group-hover:text-white">{attendee.name}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                     )}
                                </div>
                             );
                        })}
                    </div>
                )}
            </div>

            {selectedAttendeeIds.size > 0 && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 bg-indigo-600 text-white shadow-2xl rounded-full px-6 py-4 flex items-center gap-6 animate-in slide-in-from-bottom-10">
                    <p className="text-sm font-black uppercase tracking-widest">{t('companies.selectedCount', selectedAttendeeIds.size)}</p>
                    <div className="w-[1px] h-6 bg-white/20"></div>
                    <button 
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2 hover:scale-105 transition-transform"
                    >
                       <PencilIcon className="w-5 h-5" />
                       <span className="text-sm font-bold uppercase tracking-widest">{t('companies.editSelectedButton')}</span>
                    </button>
                    <button onClick={() => setSelectedAttendeeIds(new Set())} className="text-white/60 hover:text-white">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>
            )}

             <BulkUpdateSectorsModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveSectors}
                selectedCount={selectedAttendeeIds.size}
                allSectors={sectors}
            />
        </div>
    );
};

export default CompanyManagementView;
