import React, { useState, useMemo } from 'react';
import { Attendee, Sector, CheckinStatus } from '../../types';
import { useTranslation } from '../../hooks/useTranslation.tsx';
import { SearchIcon, UsersIcon } from '../icons.tsx';

interface LocationViewProps {
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

const LocationView: React.FC<LocationViewProps> = ({ attendees, sectors }) => {
    const { t } = useTranslation();
    const [searchTerm, setSearchTerm] = useState('');

    const locations = useMemo(() => {
        const sectorMap = new Map<string, { sector: Sector, attendees: Attendee[] }>();
        sectors.forEach(sector => {
            sectorMap.set(sector.id, { sector, attendees: [] });
        });

        attendees.forEach(attendee => {
            // Only show checked-in attendees in the location view
            if (attendee.status === CheckinStatus.CHECKED_IN && attendee.currentSectorId) {
                const location = sectorMap.get(attendee.currentSectorId);
                if (location) {
                    location.attendees.push(attendee);
                }
            }
        });

        return Array.from(sectorMap.values()).map(loc => ({
            ...loc,
            attendees: loc.attendees.sort((a,b) => a.name.localeCompare(b.name))
        })).sort((a,b) => a.sector.label.localeCompare(b.sector.label));
    }, [attendees, sectors]);
    
    const filteredLocations = useMemo(() => {
        if (!searchTerm.trim()) {
            return locations;
        }
        const normalizedTerm = normalizeString(searchTerm);

        // Filter attendees within each sector, and only show sectors that have matching attendees
        return locations
            .map(location => ({
                ...location,
                attendees: location.attendees.filter(attendee => 
                    normalizeString(attendee.name).includes(normalizedTerm)
                ),
            }))
            .filter(location => location.attendees.length > 0);

    }, [locations, searchTerm]);

    const formatTime = (timestamp: any) => {
        if (!timestamp || !timestamp.seconds) return '';
        return new Date(timestamp.seconds * 1000).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit'
        });
    };

    return (
        <div className="w-full max-w-7xl mx-auto">
            <div className="bg-gray-800/50 backdrop-blur-sm p-6 rounded-2xl shadow-2xl border border-gray-700">
                <h2 className="text-3xl font-bold text-white mb-4 text-center">{t('location.title')}</h2>
                <div className="relative w-full md:w-1/2 mx-auto mb-6">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder={t('location.searchPlaceholder')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
                
                {sectors.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">{t('location.noSectors')}</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredLocations.map(({ sector, attendees: sectorAttendees }) => (
                            <div key={sector.id} className="bg-gray-900/50 rounded-lg border border-gray-700 flex flex-col">
                                <div className="p-4 border-b border-gray-700" style={{ borderBottomColor: sector.color || 'inherit' }}>
                                    <h3 className="font-bold text-xl flex items-center gap-2" style={{ color: sector.color || 'white' }}>
                                        {sector.label}
                                    </h3>
                                    <p className="text-sm text-gray-400 font-semibold">{t('location.inSector', sectorAttendees.length, sector.label)}</p>
                                </div>
                                <div className="p-2 flex-grow">
                                    {sectorAttendees.length > 0 ? (
                                        <ul className="space-y-1 max-h-80 overflow-y-auto">
                                            {sectorAttendees.map(attendee => (
                                                <li key={attendee.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-700/50">
                                                    <img src={attendee.photo} alt={attendee.name} className="w-10 h-10 rounded-full object-contain bg-black flex-shrink-0" />
                                                    <div className="flex-grow overflow-hidden">
                                                        <p className="text-white font-medium truncate">{attendee.name}</p>
                                                        <p className="text-xs text-gray-400">
                                                          Entrada: {formatTime(attendee.lastSectorEntryTime)}
                                                        </p>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <div className="flex items-center justify-center text-center text-gray-500 h-full p-4">
                                            <p>{t('location.noAttendees')}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default LocationView;
