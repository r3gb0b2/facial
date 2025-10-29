import React, { useState, useMemo } from 'react';
import { Attendee, Sector } from '../../types.ts';
import { useTranslation } from '../../hooks/useTranslation.tsx';
import { BuildingOfficeIcon, PencilIcon } from '../icons.tsx';
import BulkUpdateSectorsModal from '../BulkUpdateSectorsModal.tsx';

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
    const [expandedCompany, setExpandedCompany] = useState<string | null>(null);
    const [selectedAttendees, setSelectedAttendees] = useState<Set<string>>(new Set());

    const sectorMap = useMemo(() => new Map(sectors.map(s => [s.id, s])), [sectors]);

    const companies = useMemo(() => {
        const companyMap = new Map<string, { attendees: Attendee[], sectors: Set<string> }>();
        attendees.forEach(attendee => {
            if (attendee.subCompany) {
                const companyName = attendee.subCompany.trim();
                if (!companyMap.has(companyName)) {
                    companyMap.set(companyName, { attendees: [], sectors: new Set() });
                }
                const entry = companyMap.get(companyName)!;
                entry.attendees.push(attendee);
                (attendee.sectors || []).forEach(sectorId => entry.sectors.add(sectorId));
            }
        });
        return Array.from(companyMap.entries()).map(([name, data]) => ({
            name,
            attendees: data.attendees.sort((a, b) => a.name.localeCompare(b.name)),
            attendeeCount: data.attendees.length,
        })).sort((a, b) => a.name.localeCompare(b.name));
    }, [attendees]);
    
    const handleToggleAttendee = (attendeeId: string) => {
        setSelectedAttendees(prev => {
            const newSet = new Set(prev);
            if (newSet.has(attendeeId)) {
                newSet.delete(attendeeId);
            } else {
                newSet.add(attendeeId);
            }
            return newSet;
        });
    };

    const handleSelectAll = (companyAttendees: Attendee[], isChecked: boolean) => {
        setSelectedAttendees(prev => {
            const newSet = new Set(prev);
            companyAttendees.forEach(attendee => {
                if (isChecked) {
                    newSet.add(attendee.id);
                } else {
                    newSet.delete(attendee.id);
                }
            });
            return newSet;
        });
    };

    const handleSaveSectors = async (sectorIds: string[]) => {
        try {
            await onUpdateSectorsForSelectedAttendees(Array.from(selectedAttendees), sectorIds);
        } catch (error) {
            console.error("Failed to update company sectors:", error);
            setError("Falha ao atualizar setores.");
        } finally {
            setIsModalOpen(false);
            setSelectedAttendees(new Set());
        }
    };

    const isAllSelected = (companyAttendees: Attendee[]) => {
        if (companyAttendees.length === 0) return false;
        return companyAttendees.every(a => selectedAttendees.has(a.id));
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
                    <div className="space-y-3">
                        {companies.map((company) => (
                            <div key={company.name} className="bg-gray-900/70 rounded-lg transition-all">
                                <button
                                    onClick={() => setExpandedCompany(expandedCompany === company.name ? null : company.name)}
                                    className="w-full p-4 flex items-center justify-between text-left"
                                >
                                    <div>
                                        <p className="font-semibold text-white text-lg">{company.name}</p>
                                        <p className="text-sm text-gray-400">{t('companies.attendeeCount', company.attendeeCount)}</p>
                                    </div>
                                    <svg className={`w-5 h-5 text-gray-400 transform transition-transform ${expandedCompany === company.name ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>
                                {expandedCompany === company.name && (
                                    <div className="p-4 border-t border-gray-700">
                                        <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-700">
                                            <h4 className="font-semibold text-gray-300">{t('companies.attendeesHeader')}</h4>
                                            <div className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    id={`select-all-${company.name}`}
                                                    checked={isAllSelected(company.attendees)}
                                                    onChange={(e) => handleSelectAll(company.attendees, e.target.checked)}
                                                    className="h-4 w-4 rounded border-gray-500 bg-gray-700 text-indigo-600 focus:ring-indigo-500"
                                                />
                                                <label htmlFor={`select-all-${company.name}`} className="ml-2 text-sm text-gray-300 cursor-pointer">{t('companies.selectAll')}</label>
                                            </div>
                                        </div>
                                        <ul className="space-y-2 max-h-60 overflow-y-auto">
                                            {company.attendees.map(attendee => (
                                                <li key={attendee.id} className="flex items-center justify-between p-2 rounded-md hover:bg-gray-800">
                                                    <div className="flex items-center">
                                                        <input
                                                            type="checkbox"
                                                            id={`attendee-${attendee.id}`}
                                                            checked={selectedAttendees.has(attendee.id)}
                                                            onChange={() => handleToggleAttendee(attendee.id)}
                                                            className="h-4 w-4 rounded border-gray-500 bg-gray-700 text-indigo-600 focus:ring-indigo-500"
                                                        />
                                                        <label htmlFor={`attendee-${attendee.id}`} className="ml-3 text-white cursor-pointer">{attendee.name}</label>
                                                    </div>
                                                     <div className="flex flex-wrap gap-1" title={t('companies.currentSectors')}>
                                                        {(attendee.sectors || []).map(id => {
                                                            const sector = sectorMap.get(id);
                                                            return sector ? (
                                                                <span key={id} className="w-3 h-3 rounded-full" style={{ backgroundColor: sector.color }} title={sector.label}></span>
                                                            ) : null;
                                                        })}
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        ))}
                    </ul>
                )}
            </div>
            
            {selectedAttendees.size > 0 && (
                <div className="fixed bottom-5 right-5 z-20 bg-gray-800 border border-gray-600 rounded-lg shadow-lg p-3 flex items-center gap-4 animate-fade-in-up">
                    <span className="font-semibold text-white">{t('companies.selected', selectedAttendees.size)}</span>
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
                selectionCount={selectedAttendees.size}
                allSectors={sectors}
            />
        </div>
    );
};

export default CompanyManagementView;