
import React, { useState, useMemo } from 'react';
import { Attendee, CheckinStatus, Sector, Supplier, User } from '../types.ts';
import { useTranslation } from '../hooks/useTranslation.tsx';
import { XMarkIcon, CheckCircleIcon, NoSymbolIcon, SparklesIcon, ArrowPathIcon } from './icons.tsx';
import UserAvatar from './UserAvatar.tsx';

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
  user, attendee, sectors, suppliers, onClose, onUpdateStatus, onDelete, onApproveSubstitution, onRejectSubstitution, onApproveSectorChange, onRejectSectorChange, onApproveNewRegistration, onRejectNewRegistration, supplier, isVip = false
}) => {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const statusInfo = {
    [CheckinStatus.PENDING]: { bg: isVip ? 'bg-amber-600' : 'bg-gray-600', text: 'text-white', label: t('status.pending') },
    [CheckinStatus.CHECKED_IN]: { bg: isVip ? 'bg-rose-600' : 'bg-indigo-600', text: 'text-white', label: t('status.checked_in') },
    [CheckinStatus.CHECKED_OUT]: { bg: 'bg-neutral-800', text: 'text-neutral-400', label: t('status.checked_out') },
    [CheckinStatus.CANCELLED]: { bg: 'bg-red-600', text: 'text-white', label: t('status.cancelled') },
    [CheckinStatus.PENDING_APPROVAL]: { bg: 'bg-indigo-600', text: 'text-white', label: t('status.pending_approval') },
    [CheckinStatus.SUBSTITUTION_REQUEST]: { bg: 'bg-purple-600', text: 'text-white', label: 'SUBSTITUIÇÃO' },
    [CheckinStatus.SECTOR_CHANGE_REQUEST]: { bg: 'bg-blue-600', text: 'text-white', label: 'TROCA DE ÁREA' },
    [CheckinStatus.REJECTED]: { bg: 'bg-red-900', text: 'text-white', label: t('status.rejected') },
  }[attendee.status] || { bg: 'bg-gray-600', text: 'text-white', label: attendee.status };

  const formatCPF = (cpf: string) => {
    if (!cpf) return '';
    const raw = cpf.replace(/\D/g, '');
    return raw.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const handleAction = async (action: () => Promise<void>) => {
    setIsSubmitting(true);
    try {
      await action();
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const themeColors = isVip 
    ? { primary: 'from-rose-600 via-amber-400 to-rose-600', button: 'bg-white text-black hover:bg-neutral-200' }
    : { primary: 'from-indigo-600 via-blue-400 to-indigo-600', button: 'bg-indigo-600 text-white hover:bg-indigo-700' };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
      <div className={`w-full max-w-2xl rounded-[2rem] overflow-hidden border border-white/10 ${isVip ? 'bg-[#0a0a0a]' : 'bg-gray-900'} shadow-[0_50px_100px_rgba(0,0,0,1)] relative`}>
        
        <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${themeColors.primary}`}></div>

        <div className="p-8">
            <div className="flex justify-between items-start mb-8">
                <div className="flex items-center gap-6">
                    <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-white/5 shadow-2xl relative bg-black">
                        <UserAvatar src={attendee.photo} alt={attendee.name} className="w-full h-full object-cover" />
                    </div>
                    <div>
                        <span className={`text-[10px] font-black uppercase tracking-[0.4em] mb-1 block ${isVip ? 'text-rose-500' : 'text-indigo-400'}`}>
                            {isVip ? 'Snapshot Premium' : 'Participante'}
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

            <div className="bg-white/5 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 border border-white/5">
                <div className="space-y-4">
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-1 block">Documento</span>
                        <p className="text-white font-bold tracking-widest">{formatCPF(attendee.cpf)}</p>
                    </div>
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-1 block">{isVip ? 'Host / Promoter' : 'Fornecedor'}</span>
                        <p className="text-white font-bold">{supplier?.name || 'Direto'}</p>
                    </div>
                </div>
                <div className="space-y-4">
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-1 block">{isVip ? 'Mesa / Camarote' : 'Empresa'}</span>
                        <p className="text-white font-bold italic">{attendee.subCompany || 'Individual'}</p>
                    </div>
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-1 block">Email</span>
                        <p className="text-white font-bold truncate text-sm">{attendee.email || 'N/A'}</p>
                    </div>
                </div>
            </div>

            {/* SEÇÃO DE SUBSTITUIÇÃO */}
            {attendee.status === CheckinStatus.SUBSTITUTION_REQUEST && attendee.substitutionData && (
                <div className="mb-8 animate-in slide-in-from-bottom-4">
                    <div className="flex items-center gap-2 mb-4">
                        <ArrowPathIcon className="w-4 h-4 text-purple-400" />
                        <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Nova Identidade Solicitada</span>
                    </div>
                    <div className="bg-purple-600/5 border border-purple-500/20 rounded-2xl p-6 flex items-center gap-6">
                        <div className="w-20 h-20 rounded-xl overflow-hidden border border-purple-500/30 bg-black">
                            <UserAvatar src={attendee.substitutionData.photo} alt="Novo" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-grow">
                            <p className="text-white font-black uppercase tracking-tight text-lg leading-tight">{attendee.substitutionData.name}</p>
                            <p className="text-purple-400 text-xs font-bold tracking-widest mt-1">{formatCPF(attendee.substitutionData.cpf)}</p>
                            <p className="text-neutral-500 text-[10px] mt-1 truncate">{attendee.substitutionData.email}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* BOTÕES DE AÇÃO */}
            <div className="space-y-3">
                {attendee.status === CheckinStatus.PENDING_APPROVAL && (
                    <div className="flex flex-col gap-3">
                        <button onClick={() => handleAction(() => onApproveNewRegistration(attendee.id))} disabled={isSubmitting} className={`w-full py-5 font-black uppercase tracking-widest text-[11px] rounded-xl transition-all shadow-xl flex items-center justify-center gap-2 ${themeColors.button}`}>
                            <CheckCircleIcon className="w-5 h-5" /> Autorizar Cadastro
                        </button>
                        <button onClick={() => handleAction(() => onRejectNewRegistration(attendee.id))} disabled={isSubmitting} className="w-full py-5 bg-red-600/10 text-red-500 border border-red-500/20 font-black uppercase tracking-widest text-[11px] rounded-xl hover:bg-red-600/20 transition-all">
                             Recusar Registro
                        </button>
                    </div>
                )}

                {attendee.status === CheckinStatus.SUBSTITUTION_REQUEST && (
                    <div className="flex flex-col gap-3">
                        <button onClick={() => handleAction(() => onApproveSubstitution(attendee.id))} disabled={isSubmitting} className={`w-full py-5 font-black uppercase tracking-widest text-[11px] rounded-xl transition-all shadow-xl ${themeColors.button}`}>
                             Confirmar Alteração
                        </button>
                        <button onClick={() => handleAction(() => onRejectSubstitution(attendee.id))} disabled={isSubmitting} className="w-full py-5 bg-gray-800 text-gray-400 font-black uppercase tracking-widest text-[11px] rounded-xl hover:bg-gray-700 transition-all">
                             Manter Dados Originais
                        </button>
                    </div>
                )}

                {attendee.status === CheckinStatus.PENDING && (
                    <button onClick={() => { onUpdateStatus(CheckinStatus.CHECKED_IN); onClose(); }} className={`w-full py-5 font-black uppercase tracking-widest text-[11px] rounded-xl transition-all shadow-xl ${themeColors.button}`}>
                        Liberar Entrada
                    </button>
                )}
                
                {attendee.status === CheckinStatus.CHECKED_IN && (
                    <button onClick={() => { onUpdateStatus(CheckinStatus.CHECKED_OUT); onClose(); }} className="w-full py-5 bg-amber-600/10 text-amber-500 border border-amber-500/20 font-black uppercase tracking-widest text-[11px] rounded-xl hover:bg-amber-600/20 transition-all">
                        Registrar Saída
                    </button>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};
