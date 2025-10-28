import React, { useState, useMemo } from 'react';
import { Attendee, CheckinStatus, Sector } from '../../types.ts';
import { useTranslation } from '../../hooks/useTranslation.tsx';
import { SearchIcon, TagIcon } from '../icons.tsx';

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
  const [sectorFilter, setSectorFilter] = useState('ALL');

  const sectorMap = useMemo(() => new Map(sectors.map(sector => [sector.id, sector])), [sectors]);

  const stats = useMemo(() => {
    const sectorStats: { [key: string]: { delivered: number, total: number, label: string, color?: string } } = {};

    sectors.forEach(sector => {
      sectorStats[sector.id] = { delivered: 0, total: 0, label: sector.label, color: sector.color };
    });

    attendees.forEach(attendee => {
      (attendee.sectors || []).forEach(sectorId => {
        if (sectorStats[sectorId]) {
          sectorStats[sectorId].total++;
          if (attendee.status === CheckinStatus.CHECKED_IN && attendee.wristbands?.[sectorId]) {
            sectorStats[sectorId].delivered++;
          }
        }
      });
    });

    return Object.values(sectorStats).sort((a, b) => a.label.localeCompare(b.label));
  }, [attendees, sectors]);


  const wristbandData = useMemo(() => {
    const checkedInAttendees = attendees.filter(a => a.status === CheckinStatus.CHECKED_IN && a.wristbands);
    const normalizedTerm = normalizeString(searchTerm);
    const areSectorsLoading = sectors.length === 0;

    const data: { attendeeId: string, name: string, cpf: string, sectorId: string, sectorLabel: string, sectorColor?: string, wristbandNumber: string }[] = [];

    for (const attendee of checkedInAttendees) {
      if (!attendee.wristbands) continue;

      for (const [sectorId, wristbandNumber] of Object.entries(attendee.wristbands)) {
        if (!wristbandNumber) continue;

        if (sectorFilter !== 'ALL' && sectorId !== sectorFilter) continue;

        if (normalizedTerm) {
          const nameMatch = normalizeString(attendee.name).includes(normalizedTerm);
          const cpfMatch = attendee.cpf.replace(/\D/g, '').includes(normalizedTerm);
          const wristbandMatch = normalizeString(wristbandNumber).includes(normalizedTerm);
          if (!nameMatch && !cpfMatch && !wristbandMatch) continue;
        }

        const sectorInfo = sectorMap.get(sectorId);
        const sectorLabel = sectorInfo?.label || (areSectorsLoading ? 'Carregando...' : sectorId);

        data.push({
          attendeeId: attendee.id,
          name: attendee.name,
          cpf: attendee.cpf,
          sectorId: sectorId,
          sectorLabel: sectorLabel,
          sectorColor: sectorInfo?.color,
          wristbandNumber: wristbandNumber,
        });
      }
    }
    return data.sort((a, b) => a.name.localeCompare(b.name));
  }, [attendees, sectors, searchTerm, sectorFilter, sectorMap]);
  
  const formatCPF = (cpf: string) => {
    if (!cpf) return '';
    return cpf
      .replace(/\D/g, '')
      .slice(0, 11)
      .replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      <div className="bg-gray-800/50 backdrop-blur-sm p-6 rounded-2xl shadow-2xl border border-gray-700">
        <h2 className="text-3xl font-bold text-white mb-4 text-center">{t('wristbandReport.title')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {stats.map(stat => (
            <div key={stat.label} className="bg-gray-900/50 p-4 rounded-lg text-center border border-gray-700">
              <div className="flex items-center justify-center gap-2">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: stat.color || '#4B5563' }}></span>
                  <h3 className="font-semibold text-white truncate" title={stat.label}>{stat.label}</h3>
              </div>
              <p className="text-2xl font-bold text-indigo-400 mt-1">{stat.delivered}</p>
              <p className="text-xs text-gray-400 uppercase font-semibold">
                {/* FIX: Explicitly cast the result of the translation function `t` to a string. This resolves a TypeScript error where the return type was inferred as `unknown`, which is not assignable to the `string` child expected by the `<p>` element. */}
                {String(t('wristbandReport.stats.deliveredOf', stat.delivered, stat.total))}
              </p>
            </div>
          ))}
        </div>
      </div>
      
      <div className="bg-gray-800/50 backdrop-blur-sm p-6 rounded-2xl shadow-2xl border border-gray-700">
        <div className="flex flex-col md:flex-row gap-4 mb-4">
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
            {sectors.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-300">
            <thead className="text-xs text-gray-400 uppercase bg-gray-900/50">
              <tr>
                <th scope="col" className="px-6 py-3">{t('wristbandReport.list.header.name')}</th>
                <th scope="col" className="px-6 py-3">{t('wristbandReport.list.header.wristband')}</th>
                <th scope="col" className="px-6 py-3">{t('wristbandReport.list.header.sector')}</th>
                <th scope="col" className="px-6 py-3 text-center">{t('wristbandReport.list.header.color')}</th>
              </tr>
            </thead>
            <tbody>
              {wristbandData.map(item => (
                <tr key={`${item.attendeeId}-${item.sectorId}`} className="bg-gray-800/60 border-b border-gray-700 hover:bg-gray-700/60">
                  <td className="px-6 py-4 font-medium text-white">
                      {item.name}
                      <span className="block text-xs text-gray-400">{formatCPF(item.cpf)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-gray-700 text-gray-200 text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1.5 w-fit">
                        <TagIcon className="w-3 h-3" />
                        {item.wristbandNumber}
                    </span>
                  </td>
                  <td className="px-6 py-4">{item.sectorLabel}</td>
                  <td className="px-6 py-4 text-center">
                    <div className="w-5 h-5 rounded-full mx-auto" style={{ backgroundColor: item.sectorColor || '#4B5563' }}></div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {wristbandData.length === 0 && (
             <div className="text-center py-10 text-gray-500">
                {/* FIX: Explicitly cast the result of the translation function `t` to a string. This resolves a TypeScript error where the return type of the ternary expression was inferred as `unknown`, which is not a valid React child. */}
                <p>{attendees.filter(a => a.status === 'CHECKED_IN').length === 0 ? String(t('wristbandReport.noWristbands')) : String(t('wristbandReport.noResults'))}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WristbandReportView;