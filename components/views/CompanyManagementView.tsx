import React, { useState, useMemo } from 'react';
import { Attendee, Sector } from '../../types.ts';
import { useTranslation } from '../../hooks/useTranslation.tsx';
import { BuildingOfficeIcon, PencilIcon } from '../icons.tsx';
import CompanySectorsModal from '../CompanySectorsModal.tsx';

interface CompanyManagementViewProps {
    attendees: Attendee[];
    sectors: Sector[];
    onUpdateCompanySectors: (companyName: string, sectorIds: string[]) => Promise<void>;
    setError: (message: string) => void;
}

const CompanyManagementView: React.FC<CompanyManagementViewProps> = ({
    attendees,
    sectors,
    onUpdateCompanySectors,
    setError,
}) => {
    const { t } = useTranslation();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState<{ name: string; sectorIds: string[] } | null>(null);

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
            attendeeCount: data.attendees.length,
            sectorIds: Array.from(data.sectors)
        })).sort((a, b) => a.name.localeCompare(b.name));
    }, [attendees]);

    const handleEditClick = (company: { name: string; sectorIds: string[] }) => {
        setSelectedCompany(company);
        setIsModalOpen(true);
    };
    
    const handleSaveSectors = async (companyName: string, sectorIds: string[]) => {
        try {
            await onUpdateCompanySectors(companyName, sectorIds);
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
                    <ul className="space-y-3">
                        {companies.map((company) => (
                            <li key={company.name} className="bg-gray-900/70 p-4 rounded-lg flex items-center justify-between transition-all hover:bg-gray-800">
                                <div className="flex-grow">
                                    <p className="font-semibold text-white text-lg">{company.name}</p>
                                    <p className="text-sm text-gray-400">{t('companies.attendeeCount', company.attendeeCount)}</p>
                                    <div className="flex flex-wrap gap-1 mt-2">
                                        {company.sectorIds.map(id => {
                                            const sector = sectorMap.get(id);
                                            return sector ? (
                                                <span key={id} className="text-xs font-medium px-2 py-1 rounded-full" style={{ backgroundColor: `${sector.color}33`, color: sector.color }}>
                                                    {sector.label}
                                                </span>
                                            ) : null;
                                        })}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => handleEditClick(company)} className="p-2 text-gray-400 hover:text-yellow-400 transition-colors rounded-full hover:bg-gray-700" title={t('companies.editButton')}>
                                        <PencilIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
             <CompanySectorsModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveSectors}
                company={selectedCompany}
                allSectors={sectors}
            />
        </div>
    );
};

export default CompanyManagementView;
