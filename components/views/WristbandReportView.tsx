import React, { useState, useMemo } from 'react';
import { Attendee, CheckinStatus, Sector } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';
import { SearchIcon, TagIcon } from '../icons';

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
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
};

const WristbandReportView: React.FC<WristbandReportViewProps> = ({ attendees, sectors }) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [sectorFilter, setSectorFilter] = useState<string | 'ALL'>('ALL');

  const sectorMap = useMemo(() => new Map(sectors.map(s => [s.id, s])), [sectors]);

  const deliveredAttendees = useMemo(() => {
    return attendees
      .filter(a => a.status === CheckinStatus.CHECKED_IN && a.wristbandNumber)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [attendees]);

  const sectorStats = useMemo(() => {
    return sectors.map(sector => {
      const total = attendees.filter(a => a.sector === sector.id).length;
      const delivered = deliveredAttendees.filter(a => a.sector === sector.id).length;
      return { ...sector, total, delivered };
    });
  }, [sectors, attendees, deliveredAttendees]);

  const filteredList = useMemo(() => {
    const normalizedTerm = normalizeString(searchTerm);
    return deliveredAttendees.filter(attendee => {
      if (sectorFilter !== 'ALL' && attendee.sector !== sectorFilter) {
        return false;
      }
      if (normalizedTerm) {
        const nameMatch = normalizeString(attendee.name).includes(normalizedTerm);
        const wristbandMatch = normalizeString(attendee.wristbandNumber).includes(normalizedTerm);
        const cpfMatch = normalizeString(attendee.cpf).includes(normalizedTerm);
        return nameMatch || wristbandMatch || cpfMatch;
      }
      return true;
    });
  }, [deliveredAttendees, searchTerm, sectorFilter]);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8">
      {/* Statistics Dashboard */}
      <div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {sectorStats.map(stat => (
            <div key={stat.id} className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 flex flex-col justify-between">
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: stat.color }}></span>
                <h3 className="font-bold text-white truncate">{stat.label}</h3>
              </div>
              <div>
                <p className="text-2xl font-bold text-indigo-400">{stat.delivered}</p>
                <p className="text-xs text-gray-400 font-medium">{t('wristbandReport.stats.deliveredOf', stat.delivered, stat.total)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters and List */}
      <div className="bg-gray-800/50 backdrop-blur-sm p-6 rounded-2xl shadow-2xl border border-gray-700">
        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
          <TagIcon className="w-7 h-7" />
          {t('wristbandReport.title')}
        </h2>

        {/* Filter Controls */}
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <div className="relative w-full md:flex-1">
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

        {/* Detailed List */}
        <div className="overflow-x-auto">
          {filteredList.length > 0 ? (
            <table className="w-full text-left">
              <thead className="border-b border-gray-600 text-xs text-gray-400 uppercase">
                <tr>
                  <th className="p-3">{t('wristbandReport.list.header.name')}</th>
                  <th className="p-3">{t('wristbandReport.list.header.wristband')}</th>
                  <th className="p-3">{t('wristbandReport.list.header.sector')}</th>
                  <th className="p-3 text-center">{t('wristbandReport.list.header.color')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {filteredList.map(attendee => {
                  const sector = sectorMap.get(attendee.sector);
                  return (
                    <tr key={attendee.id} className="hover:bg-gray-700/50">
                      <td className="p-3 font-medium text-white">{attendee.name}</td>
                      <td className="p-3 text-gray-300">{attendee.wristbandNumber}</td>
                      <td className="p-3 text-gray-300">{sector?.label || attendee.sector}</td>
                      <td className="p-3">
                        <div className="flex justify-center">
                          <span className="w-5 h-5 rounded-full" style={{ backgroundColor: sector?.color || '#4B5563' }}></span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-10">
              <p className="text-gray-500">
                {deliveredAttendees.length === 0 ? t('wristbandReport.noWristbands') : t('wristbandReport.noResults')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WristbandReportView;