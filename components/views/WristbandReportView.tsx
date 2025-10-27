// FIX: Implemented the WristbandReportView component to resolve the module not found error.
import React, { useMemo, useState } from 'react';
import { Attendee, CheckinStatus, Sector } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';
import { SearchIcon } from '../icons';

interface WristbandReportViewProps {
  attendees: Attendee[];
  sectors: Sector[];
}

// Helper function for accent-insensitive search
const normalizeString = (str: string) => {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u3000-\u036f]/g, "")
    .trim();
};

const WristbandReportView: React.FC<WristbandReportViewProps> = ({ attendees, sectors }) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [sectorFilter, setSectorFilter] = useState<string | 'ALL'>('ALL');
  
  const sectorMap = useMemo(() => new Map(sectors.map(s => [s.id, s.label])), [sectors]);

  const filteredAttendees = useMemo(() => {
    const normalizedTerm = normalizeString(searchTerm);

    return attendees
      .filter(a => a.status === CheckinStatus.CHECKED_IN && a.wristbandNumber)
      .filter(attendee => {
        // Sector filter
        if (sectorFilter !== 'ALL' && attendee.sector !== sectorFilter) {
            return false;
        }
        // Search term filter
        if (normalizedTerm) {
            const nameMatch = normalizeString(attendee.name).includes(normalizedTerm);
            const cpfMatch = attendee.cpf.replace(/\D/g, '').includes(normalizedTerm);
            const wristbandMatch = normalizeString(attendee.wristbandNumber).includes(normalizedTerm);
            if (!nameMatch && !cpfMatch && !wristbandMatch) {
                return false;
            }
        }
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [attendees, searchTerm, sectorFilter]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-gray-700">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
          <h2 className="text-3xl font-bold text-white">{t('wristbandReport.title')}</h2>
          <button
            onClick={handlePrint}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300 print:hidden"
          >
            {t('wristbandReport.printButton')}
          </button>
        </div>
        
        <div className="flex flex-col md:flex-row gap-4 mb-6 print:hidden">
            <div className="relative flex-grow">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder={t('wristbandReport.searchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
            </div>
            <select
                value={sectorFilter}
                onChange={(e) => setSectorFilter(e.target.value)}
                className="w-full md:w-auto bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
                <option value="ALL">{t('wristbandReport.filter.allSectors')}</option>
                {sectors.map(sector => (
                    <option key={sector.id} value={sector.id}>{sector.label}</option>
                ))}
            </select>
        </div>
        
        {attendees.filter(a => a.status === CheckinStatus.CHECKED_IN && a.wristbandNumber).length === 0 ? (
          <p className="text-gray-400 text-center py-8">{t('wristbandReport.noData')}</p>
        ) : filteredAttendees.length === 0 ? (
          <p className="text-gray-400 text-center py-8">{t('wristbandReport.noResults')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-900/50">
                <tr>
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-white sm:pl-6">{t('wristbandReport.table.name')}</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-white">{t('wristbandReport.table.cpf')}</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-white">{t('wristbandReport.table.sector')}</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-white">{t('wristbandReport.table.wristband')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredAttendees.map((attendee) => (
                  <tr key={attendee.id} className="hover:bg-gray-700/50">
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-white sm:pl-6">{attendee.name}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-300">{attendee.cpf}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-300">{sectorMap.get(attendee.sector) || attendee.sector}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm font-bold text-indigo-400">{attendee.wristbandNumber}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default WristbandReportView;