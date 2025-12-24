
import React, { useState, useEffect, useMemo } from 'react';
import { Attendee, CheckinStatus, Sector, Supplier, User } from '../types.ts';
import { useTranslation } from '../hooks/useTranslation.tsx';
import { XMarkIcon, PencilIcon, TrashIcon, CheckCircleIcon, SpinnerIcon, NoSymbolIcon, FaceSmileIcon } from './icons.tsx';
import QRCodeDisplay from './QRCodeDisplay.tsx';
import UserAvatar from './UserAvatar.tsx';
import WebcamCapture from './WebcamCapture.tsx';
import * as api from '../firebase/service.ts';

interface AttendeeDetailModalProps {
  user: User;
  attendee: Attendee;
  sectors: Sector[];
  suppliers: Supplier[];
  allAttendees: Attendee[];
  currentEventId: string;
  onClose: () => void;
  onUpdateStatus: (status: CheckinStatus, wristbands?: { [sectorId: string]: string }) => void;
  onUpdateDetails: (attendeeId: string, data: Partial<Pick<Attendee, 'name' | 'cpf' | 'sectors' | 'subCompany' | 'wristbands' | 'supplierId' | 'photo'>>) => Promise<void>;
  onDelete: (attendeeId: string) => Promise<void>;
  onApproveSubstitution: (attendeeId: string) => Promise<void>;
  onRejectSubstitution: (attendeeId: string) => Promise<void>;
  onApproveSectorChange: (attendeeId: string) => Promise<void>;
  onRejectSectorChange: (attendeeId: string) => Promise<void>;
  onApproveNewRegistration: (attendeeId: string) => Promise<void>;
  onRejectNewRegistration: (attendeeId: string) => Promise<void>;
  setError: (message: string) => void;
  supplier?: Supplier;
  isVip?: boolean;
}

export const AttendeeDetailModal: React.FC<AttendeeDetailModalProps> = ({
  user, attendee, sectors, suppliers, allAttendees, currentEventId, onClose, onUpdateStatus, onUpdateDetails, onDelete, onApproveSubstitution, onRejectSubstitution, onApproveSectorChange, onRejectSectorChange, onApproveNewRegistration, onRejectNewRegistration, setError, supplier,
}) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isVip = attendee.email !== undefined || (attendee.subCompany && !attendee.wristbands); // Heuristic for VIP mode if prop not passed

  const attendeeSectors = useMemo(() => {
    return (attendee.sectors || []).map(id => sectors.find(s => s.id === id)).filter(Boolean) as Sector[];
  }, [attendee.sectors, sectors]);

  const statusInfo = {
    [CheckinStatus.PENDING]: { bg: isVip ? 'bg-amber-600' : 'bg-gray-600', text: 'text-white', label: t('status.pending') },
    [CheckinStatus.CHECKED_IN]: { bg: isVip ? 'bg-rose-600' : 'bg-green-600', text: 'text-white', label: t('status.checked_in') },
    [CheckinStatus.CHECKED_OUT]: { bg: 'bg-neutral-800', text: 'text-neutral-400', label: t('status.checked_out') },
    [CheckinStatus.CANCELLED]: { bg: 'bg-red-600', text: 'text-white', label: t('status.cancelled') },
  }[attendee.status] || { bg: 'bg-gray-600', text: 'text-white', label: attendee.status };

  const formatCPF = (cpf: string) => {
    if (!cpf) return '';
    const raw = cpf.replace(/\D/g, '');
    return `***.***.${raw.slice(6, 9)}-${raw.slice(9, 11)}`;
  };

  const renderVipAction = (status: CheckinStatus, label: string, colorClass: string) => (
    <button
      onClick={() => { onUpdateStatus(status); onClose(); }}
      className={`w-full py-4 px-6 rounded-2xl font-black uppercase tracking-widest text-[11px] transition-all shadow-xl active:scale-95 ${colorClass}`}
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
      <div className={`w-full max-w-xl rounded-[3rem] overflow-hidden border shadow-[0_50px_100px_rgba(0,0,0,1)] relative ${isVip ? 'bg-[#0a0a0a] border-white/10' : 'bg-gray-800 border-gray-700'}`}>
        
        {/* Background Decor */}
        {isVip && <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-600 via-amber-400 to-rose-600"></div>}

        <div className="p-8">
            <div className="flex justify-between items-start mb-10">
                <div className="flex items-center gap-6">
                    <div className="w-24 h-24 rounded-[2rem] overflow-hidden border-2 border-white/5 shadow-2xl relative group">
                        <UserAvatar src={attendee.photo} alt={attendee.name} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-all"></div>
                    </div>
                    <div>
                        <span className={`text-[10px] font-black uppercase tracking-[0.4em] mb-1 block ${isVip ? 'text-rose-500' : 'text-indigo-400'}`}>
                            {isVip ? 'Guest Status' : 'Perfil do Colaborador'}
                        </span>
                        <h2 className="text-3xl font-black text-white tracking-tighter uppercase leading-none">{attendee.name}</h2>
                        <div className={`mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${statusInfo.bg} ${statusInfo.text}`}>
                            <div className="w-1 h-1 rounded-full bg-white animate-pulse"></div>
                            {statusInfo.label}
                        </div>
                    </div>
                </div>
                <button onClick={onClose} className="p-3 text-neutral-600 hover:text-white transition-all hover:bg-white/5 rounded-full">
                    <XMarkIcon className="w-7 h-7" />
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                <div className="space-y-6">
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-1 block">Bio-Identidade</span>
                        <p className="text-white font-bold tracking-widest">{formatCPF(attendee.cpf)}</p>
                    </div>
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-1 block">Responsável</span>
                        <p className="text-white font-bold">{supplier?.name || 'Venda Direta'}</p>
                    </div>
                </div>
                <div className="space-y-6">
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-1 block">Grupo / Empresa</span>
                        <p className="text-white font-bold italic">{attendee.subCompany || 'Convidado Individual'}</p>
                    </div>
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-1 block">Email Exclusive</span>
                        <p className="text-white font-bold truncate">{attendee.email || 'Não informado'}</p>
                    </div>
                </div>
            </div>

            {/* Ações */}
            <div className="space-y-3 pt-8 border-t border-white/5">
                {attendee.status === CheckinStatus.PENDING && (
                    <div className="grid grid-cols-1 gap-4">
                        {renderVipAction(CheckinStatus.CHECKED_IN, "Liberar Entrada VIP", "bg-white text-black hover:bg-neutral-200")}
                    </div>
                )}
                {attendee.status === CheckinStatus.CHECKED_IN && (
                    <div className="grid grid-cols-1 gap-4">
                        {renderVipAction(CheckinStatus.CHECKED_OUT, "Confirmar Saída do Guest", "bg-rose-600/10 text-rose-500 border border-rose-500/20 hover:bg-rose-600/20")}
                    </div>
                )}
                {attendee.status === CheckinStatus.CHECKED_OUT && (
                    <div className="grid grid-cols-1 gap-4">
                        {renderVipAction(CheckinStatus.CHECKED_IN, "Reativar Acesso VIP", "bg-neutral-900 text-white border border-white/10 hover:bg-neutral-800")}
                    </div>
                )}
            </div>

            {user.role !== 'checkin' && (
                <div className="flex justify-center mt-6">
                    <button onClick={() => { if(window.confirm('Excluir este convidado?')) onDelete(attendee.id); }} className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-700 hover:text-red-500 transition-all">Excluir Registro</button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
