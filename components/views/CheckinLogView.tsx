import React, { useState, useMemo } from 'react';
import { Attendee } from '../../types.ts';
import { useTranslation } from '../../hooks/useTranslation.tsx';
import { SearchIcon, CalendarIcon } from '../icons.tsx';
import UserAvatar from '../UserAvatar.tsx';

interface CheckinLogViewProps {
  attendees: Attendee[];
}

interface LogEntry {
  attendeeId: string;
  name: string;
  cpf: string;
  photo: string;
  type: 'checkin' | 'checkout';
  timestamp: Date;
  user?: string;
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

const CheckinLogView: React.FC<CheckinLogViewProps> = ({ attendees }) => {
    const { t } = useTranslation();
    const [searchTerm, setSearchTerm] = useState('');

    const allLogs = useMemo(() => {
        const logs: LogEntry[] = [];
        attendees.forEach(attendee => {
            if (attendee.checkinTime && attendee.checkinTime.seconds) {
                logs.push({
                    attendeeId: attendee.id,
                    name: attendee.name,
                    cpf: attendee.cpf,
                    photo: attendee.photo,
                    type: 'checkin',
                    timestamp: new Date(attendee.checkinTime.seconds * 1000),
                    user: attendee.checkedInBy,
                });
            }
            if (attendee.checkoutTime && attendee.checkoutTime.seconds) {
                logs.push({
                    attendeeId: attendee.id,
                    name: attendee.name,
                    cpf: attendee.cpf,
                    photo: attendee.photo,
                    type: 'checkout',
                    timestamp: new Date(attendee.checkoutTime.seconds * 1000),
                    user: attendee.checkedOutBy,
                });
            }
        });
        // Sort by most recent first
        return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }, [attendees]);
    
    const filteredLogs = useMemo(() => {
        if (!searchTerm.trim()) {
            return allLogs;
        }
        const normalizedTerm = normalizeString(searchTerm);
        return allLogs.filter(log => 
            normalizeString(log.name).includes(normalizedTerm) || 
            log.cpf.replace(/\D/g, '').includes(normalizedTerm)
        );
    }, [allLogs, searchTerm]);
    
    const formatCPF = (cpf: string) => {
        if (!cpf) return '';
        return cpf
          .replace(/\D/g, '')
          .slice(0, 11)
          .replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    };
    
    const formatTimestamp = (date: Date) => {
        return date.toLocaleString('pt-BR', {
            dateStyle: 'short',
            timeStyle: 'medium'
        });
    };

    return (
        <div className="w-full max-w-5xl mx-auto">
            <div className="bg-gray-800/50 backdrop-blur-sm p-6 rounded-2xl shadow-2xl border border-gray-700">
                <h2 className="text-3xl font-bold text-white mb-4 text-center">{t('checkinLog.title')}</h2>
                <div className="relative w-full md:w-1/2 mx-auto mb-6">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder={t('checkinLog.searchPlaceholder')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
                
                <div className="overflow-x-auto">
                    {filteredLogs.length > 0 ? (
                        <table className="w-full text-sm text-left text-gray-300">
                            <thead className="text-xs text-gray-400 uppercase bg-gray-900/50">
                                <tr>
                                    <th scope="col" className="px-6 py-3">{t('checkinLog.header.attendee')}</th>
                                    <th scope="col" className="px-6 py-3">{t('checkinLog.header.action')}</th>
                                    <th scope="col" className="px-6 py-3">{t('checkinLog.header.user')}</th>
                                    <th scope="col" className="px-6 py-3 text-right">{t('checkinLog.header.timestamp')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredLogs.map((log, index) => (
                                    <tr key={`${log.attendeeId}-${log.type}-${index}`} className="bg-gray-800/60 border-b border-gray-700 hover:bg-gray-700/60">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 flex-shrink-0">
                                                    <UserAvatar 
                                                        src={log.photo} 
                                                        alt={log.name} 
                                                        className="w-full h-full rounded-full object-contain bg-black border-2 border-gray-600" 
                                                    />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-white">{log.name}</p>
                                                    <p className="text-xs text-gray-400">{formatCPF(log.cpf)}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {log.type === 'checkin' ? (
                                                <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-green-500/20 text-green-300">
                                                    {t('checkinLog.action.checkin')}
                                                </span>
                                            ) : (
                                                <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-yellow-500/20 text-yellow-300">
                                                    {t('checkinLog.action.checkout')}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 font-mono text-xs">{log.user || 'N/A'}</td>
                                        <td className="px-6 py-4 text-right font-mono text-gray-400">
                                            {formatTimestamp(log.timestamp)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="text-center py-16 text-gray-500">
                            <CalendarIcon className="w-12 h-12 mx-auto mb-4" />
                            <p>{allLogs.length === 0 ? t('checkinLog.noLogs') : t('checkinLog.noResults')}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CheckinLogView;