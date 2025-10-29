import React, { useState, useMemo } from 'react';
import { Attendee, Sector } from '../../types.ts';
import { useTranslation } from '../../hooks/useTranslation.tsx';
import { BuildingOfficeIcon, PencilIcon } from '../icons.tsx';
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
            if (newSet.has(attendeeId)) {
                newSet.delete(attendeeId);
            } else {
                newSet.add(attendeeId);
            }
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
            setSelectedAttendeeIds(new Set()); // Clear selection on success
        } catch (error) {
            console.error("Failed to update company sectors:", error);
            setError("Falha ao atualizar setores.");
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto">
            <div className="bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-gray-700">
                <h2 className="text-3xl font-bold text-white mb-6 flex items-center justify-center gap-3">
                    <BuildingOfficeIcon className="w-8 h-8"/>
                    {t('companies.title')}
                </h2>
                {companies.length === 0 ? (
                    <div className="text-center text-gray-400 py-8">
                        <p className="text-lg mb-2">{t('companies.noCompanies')}</p>
                        <p className="text-sm">{t('companies.noCompaniesSubtitle')}</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {companies.map((company) => {
                             const isExpanded = expandedCompany === company.name;
                             const allInCompanySelected = company.attendees.every(a => selectedAttendeeIds.has(a.id));

                             return (
                                <div key={company.name} className="bg-gray-900/70 rounded-lg overflow-hidden">
                                    <button onClick={() => handleToggleCompany(company.name)} className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-800 transition-colors">
                                        <div>
                                            <p className="font-semibold text-white text-lg">{company.name}</p>
                                            <p className="text-sm text-gray-400">{t('companies.attendeeCount', company.attendees.length)}</p>
                                        </div>
                                        <svg className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>
                                     {isExpanded && (
                                        <div className="p-4 border-t border-gray-700 bg-black/20">
                                            <div className="flex items-center mb-2 p-2">
                                                <input
                                                    type="checkbox"
                                                    id={`select-all-${company.name}`}
                                                    checked={allInCompanySelected}
                                                    onChange={() => handleSelectAllInCompany(company.attendees)}
                                                    className="h-4 w-4 rounded border-gray-500 bg-gray-700 text-indigo-600 focus:ring-indigo-500"
                                                />
                                                <label htmlFor={`select-all-${company.name}`} className="ml-3 text-sm font-medium text-gray-300 cursor-pointer">{t('companies.selectAll')}</label>
                                            </div>
                                            <ul className="space-y-1 max-h-60 overflow-y-auto">
                                                {company.attendees.map(attendee => (
                                                    <li key={attendee.id} className="p-2 rounded-md hover:bg-gray-700/50">
                                                        <label className="flex items-center cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedAttendeeIds.has(attendee.id)}
                                                                onChange={() => handleToggleAttendee(attendee.id)}
                                                                className="h-4 w-4 rounded border-gray-500 bg-gray-700 text-indigo-600 focus:ring-indigo-500"
                                                            />
                                                            <span className="ml-3 text-white">{attendee.name}</span>
                                                        </label>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                     )}
                                </div>
                             );
                        })}
                    </div>
                )}
            </div>
            {selectedAttendeeIds.size > 0 && (
                <div className="fixed bottom-5 right-5 z-20 bg-gray-800 border border-gray-600 shadow-2xl rounded-lg p-3 flex items-center gap-4 animate-fade-in-up">
                    <p className="text-white font-semibold">{t('companies.selectedCount', selectedAttendeeIds.size)}</p>
                    <button 
                        onClick={() => setIsModalOpen(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"
                    >
                       <PencilIcon className="w-4 h-4" />
                       {t('companies.editSelectedButton')}
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