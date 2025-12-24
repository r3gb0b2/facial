import React from 'react';
import { Attendee, CheckinStatus } from '../types.ts';
import { useTranslation } from '../hooks/useTranslation.tsx';
import { TagIcon, SparklesIcon } from './icons.tsx';
import UserAvatar from './UserAvatar.tsx';

interface AttendeeCardProps {
  attendee: Attendee;
  onSelect: (attendee: Attendee) => void;
  sectors: { label: string; color?: string }[];
  supplierName?: string;
  isVipMode?: boolean;
}

const AttendeeCard: React.FC<AttendeeCardProps> = ({ attendee, onSelect, sectors, supplierName, isVipMode = false }) => {
  const { t } = useTranslation();

  const statusInfo = {
    [CheckinStatus.PENDING]: { bg: isVipMode ? 'bg-amber-600' : 'bg-gray-600', text: 'text-white', label: t('status.pending') },
    [CheckinStatus.CHECKED_IN]: { bg: isVipMode ? 'bg-rose-600' : 'bg-green-600', text: 'text-white', label: t('status.checked_in') },
    [CheckinStatus.CHECKED_OUT]: { bg: 'bg-neutral-800', text: 'text-neutral-400', label: t('status.checked_out') },
    [CheckinStatus.CANCELLED]: { bg: 'bg-red-600', text: 'text-white', label: t('status.cancelled') },
    [CheckinStatus.PENDING_APPROVAL]: { bg: 'bg-indigo-600', text: 'text-white', label: isVipMode ? 'APROVAÇÃO' : t('status.pending_approval') },
    [CheckinStatus.BLOCKED]: { bg: 'bg-red-700', text: 'text-white', label: 'BLOQUEADO' },
  }[attendee.status] || { bg: 'bg-gray-600', text: 'text-white', label: attendee.status };

  const formatCPF = (cpf: string) => {
    if (!cpf) return '';
    const raw = cpf.replace(/\D/g, '');
    return `***.***.${raw.slice(6, 9)}-${raw.slice(9, 11)}`;
  };
  
  if (isVipMode) {
    return (
      <div
        onClick={() => onSelect(attendee)}
        className="group relative bg-neutral-900/40 rounded-[2rem] overflow-hidden border border-white/5 cursor-pointer transition-all hover:scale-[1.05] hover:shadow-[0_30px_60px_rgba(0,0,0,0.8)] active:scale-95"
      >
        {/* Glow effect on hover */}
        <div className="absolute -inset-1 bg-gradient-to-tr from-rose-500 to-amber-500 opacity-0 group-hover:opacity-10 transition-opacity duration-700 blur-2xl"></div>
        
        <div className="relative aspect-[4/5] bg-neutral-950 overflow-hidden">
          <UserAvatar 
              src={attendee.photo} 
              alt={attendee.name} 
              className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" 
          />
          
          {/* VIP Label */}
          <div className="absolute top-4 left-4 z-10">
              <div className={`${statusInfo.bg} ${statusInfo.text} px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-[0.2em] shadow-xl flex items-center gap-1.5`}>
                <div className="w-1 h-1 rounded-full bg-white animate-pulse"></div>
                {statusInfo.label}
              </div>
          </div>

          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-80"></div>
          
          {/* Bottom Info */}
          <div className="absolute bottom-0 left-0 right-0 p-6 text-center">
             <h3 className="font-black text-lg text-white uppercase tracking-tighter leading-none mb-1 group-hover:text-rose-400 transition-colors">{attendee.name}</h3>
             <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">{formatCPF(attendee.cpf)}</p>
          </div>
        </div>

        <div className="p-5 bg-black/40 backdrop-blur-md flex flex-col gap-3">
             <div className="flex flex-wrap justify-center gap-2">
                {attendee.subCompany ? (
                    <span className="text-[9px] font-black text-amber-500/80 uppercase tracking-widest border border-amber-500/20 px-2 py-0.5 rounded-lg bg-amber-500/5">
                        {attendee.subCompany}
                    </span>
                ) : (
                    <span className="text-[9px] font-black text-neutral-600 uppercase tracking-widest">Convidado Individual</span>
                )}
             </div>
             
             {supplierName && (
                <div className="flex items-center justify-center gap-2 border-t border-white/5 pt-3">
                    <span className="text-[8px] font-bold text-neutral-700 uppercase tracking-[0.2em]">Host:</span>
                    <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">{supplierName}</span>
                </div>
             )}
        </div>
      </div>
    );
  }

  // --- MODO CORPORATIVO PADRÃO ---
  return (
    <div
      onClick={() => onSelect(attendee)}
      className="bg-gray-800 rounded-lg shadow-lg overflow-hidden cursor-pointer transition-transform transform hover:scale-105 border border-gray-700 hover:border-indigo-500 flex flex-col h-full"
    >
      <div className="relative h-48 bg-black">
        <UserAvatar 
            src={attendee.photo} 
            alt={attendee.name} 
            className="w-full h-full object-contain" 
        />
        <div className={`absolute top-2 right-2 px-2 py-1 text-xs font-bold rounded ${statusInfo.bg} ${statusInfo.text} shadow-md`}>
          {statusInfo.label}
        </div>
      </div>
      <div className="p-4 flex-grow flex flex-col">
        <h3 className="font-bold text-lg text-white leading-tight mb-1 truncate">{attendee.name}</h3>
        <p className="text-sm text-gray-400 mb-2">{attendee.cpf.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}</p>
        
        <div className="flex-grow">
            <div className="flex flex-wrap gap-2 mb-2">
                {sectors.map((sector, index) => (
                    <span 
                        key={index}
                        className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-700/50 border border-gray-600/50"
                        style={{ color: sector.color || '#818cf8' }}
                    >
                        {sector.label}
                    </span>
                ))}
            </div>

            {supplierName && (
                <p className="text-xs text-gray-500 font-medium truncate mt-1">Org: {supplierName}</p>
            )}
            {attendee.subCompany && (
                <p className="text-xs text-indigo-400 font-bold truncate mt-0.5">{attendee.subCompany}</p>
            )}
        </div>
      </div>
    </div>
  );
};

export default AttendeeCard;