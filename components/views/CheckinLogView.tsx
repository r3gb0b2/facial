import React, { useState, useMemo } from 'react';
import { Attendee, CheckinStatus } from '../../types.ts';
import { useTranslation } from '../../hooks/useTranslation.tsx';
import { SearchIcon, CalendarIcon, TagIcon, FaceSmileIcon } from '../icons.tsx';
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
  wristbands?: string;
}

const normalizeString = (str: string) => {
  if (!str) return '';
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
};

const CheckinLogView: React.FC<CheckinLogViewProps> = ({ attendees }) => {
    const { t } = useTranslation();
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('ALL');

    const allLogs = useMemo(() => {
        const logs: LogEntry[] = [];
        attendees.forEach(attendee => {
            const wristbandStr = attendee.wristbands 
                ? Object.values(attendee.wristbands).filter(Boolean).join(', ') 
                : '';

            if (attendee.checkinTime && attendee.checkinTime.seconds) {
                logs.push({
                    attendeeId: attendee.id,
                    name: attendee.name,
                    cpf: attendee.cpf,
                    photo: attendee.photo,
                    type: 'checkin',
                    timestamp: new Date(attendee.checkinTime.seconds * 1000),
                    user: attendee.checkedInBy,
                    wristbands: wristbandStr
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
                    wristbands: wristbandStr
                });
            }
        });
        return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }, [attendees]);
    
    const filteredLogs = useMemo(() => {
        const term = normalizeString(searchTerm);
        
        return allLogs.filter(log => {
            // Filtro de Tipo (Ação)
            if (typeFilter !== 'ALL' && log.type !== typeFilter) return false;

            // Busca de Texto
            if (term) {
                const match = normalizeString(log.name).includes(term) || 
                              log.cpf.replace(/\D/g, '').includes(term) ||
                              (log.wristbands && normalizeString(log.wristbands).includes(term));
                if (!match) return false;
            }
            return true;
        });
    }, [allLogs, searchTerm, typeFilter]);
    
    const formatCPF = (cpf: string) => {
        if (!cpf) return '';
        return cpf.replace(/\D/g, '').slice(0, 11).replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    };
    
    const formatTimestamp = (date: Date) => {
        return date.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="w-full max-w-6xl mx-auto pb-20">
            <div className="bg-gray-800/40 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-2xl border border-gray-700/50">
                <div className="flex flex-col lg:flex-row justify-between items-center gap-6 mb-8">
                    <h2 className="text-3xl font-black text-white uppercase tracking-tighter flex items-center gap-4">
                        <CalendarIcon className="w-8 h-8 text-indigo-500" />
                        Registros de Fluxo
                    </h2>
                    
                    <div className="flex flex-col md:flex-row gap-3 w-full lg:w-auto">
                        <div className="relative flex-grow md:w-80">
                            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                            <input
                                type="text"
                                placeholder="Nome, CPF ou Pulseira..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-gray-900/80 border border-gray-700 rounded-2xl py-3 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium text-sm"
                            />
                        </div>
                        <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value)}
                            className="bg-gray-900 border border-gray-700 rounded-2xl px-4 py-3 text-white text-[10px] font-black uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                        >
                            <option value="ALL">Ação: Todas</option>
                            <option value="checkin">Ação: Check-in</option>
                            <option value="checkout">Ação: Check-out</option>
                        </select>
                    </div>
                </div>
                
                <div className="overflow-x-auto rounded-2xl border border-white/5">
                    {filteredLogs.length > 0 ? (
                        <table className="w-full text-sm text-left text-gray-300">
                            <thead className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] bg-black/40">
                                <tr>
                                    <th className="px-6 py-5">Colaborador / Convidado</th>
                                    <th className="px-6 py-5">Ação Efetuada</th>
                                    <th className="px-6 py-5">Responsável</th>
                                    <th className="px-6 py-5 text-right">Horário</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredLogs.map((log, index) => (
                                    <tr key={`${log.attendeeId}-${log.type}-${index}`} className="hover:bg-white/5 transition-all group">
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 flex-shrink-0 relative">
                                                    <UserAvatar 
                                                        src={log.photo} 
                                                        alt={log.name} 
                                                        className="w-full h-full rounded-2xl object-cover bg-black border-2 border-white/5 shadow-lg group-hover:border-indigo-500/30 transition-all" 
                                                    />
                                                </div>
                                                <div>
                                                    <p className="font-black text-white uppercase tracking-tight text-sm">{log.name}</p>
                                                    <p className="text-[10px] text-gray-500 font-mono">{formatCPF(log.cpf)}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex flex-col gap-1.5">
                                                <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-md w-fit border ${log.type === 'checkin' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>
                                                    {log.type === 'checkin' ? 'Check-in Realizado' : 'Check-out Efetuado'}
                                                </span>
                                                {log.wristbands && (
                                                    <div className="flex items-center gap-1.5 text-indigo-400">
                                                        <TagIcon className="w-3 h-3" />
                                                        <span className="text-[11px] font-bold">#{log.wristbands}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest group-hover:text-gray-300 transition-colors">{log.user || 'SISTEMA'}</p>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <p className="text-sm font-black text-white tabular-nums tracking-tighter">{formatTimestamp(log.timestamp).split(', ')[1]}</p>
                                            <p className="text-[10px] text-gray-500 uppercase font-bold">{formatTimestamp(log.timestamp).split(', ')[0]}</p>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="text-center py-24 bg-black/10 rounded-3xl border-2 border-dashed border-gray-700/30">
                            <CalendarIcon className="w-16 h-16 mx-auto mb-6 text-gray-700 opacity-30" />
                            <p className="text-gray-600 font-black uppercase tracking-widest text-xs">Nenhum registro encontrado</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CheckinLogView;