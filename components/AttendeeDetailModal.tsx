
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
  user, attendee, sectors, suppliers, onClose, onUpdateStatus, onDelete, onApproveSubstitution, onRejectSubstitution, onApproveSectorChange, onRejectSectorChange, onApproveNewRegistration, onRejectNewRegistration, supplier,
}) => {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isVip = true; // Forçando estética VIP conforme solicitado anteriormente

  const statusInfo = {
    [CheckinStatus.PENDING]: { bg: 'bg-amber-600', text: 'text-white', label: t('status.pending') },
    [CheckinStatus.CHECKED_IN]: { bg: 'bg-rose-600', text: 'text-white', label: t('status.checked_in') },
    [CheckinStatus.CHECKED_OUT]: { bg: 'bg-neutral-800', text: 'text-neutral-400', label: t('status.checked_out') },
    [CheckinStatus.CANCELLED]: { bg: 'bg-red-600', text: 'text-white', label: t('status.cancelled') },
    [CheckinStatus.PENDING_APPROVAL]: { bg: 'bg-indigo-600', text: 'text-white', label: 'AGUARDANDO APROVAÇÃO' },
    [CheckinStatus.SUBSTITUTION_REQUEST]: { bg: 'bg-purple-600', text: 'text-white', label: 'SUBSTITUIÇÃO PENDENTE' },
    [CheckinStatus.SECTOR_CHANGE_REQUEST]: { bg: 'bg-blue-600', text: 'text-white', label: 'TROCA DE ÁREA' },
    [CheckinStatus.REJECTED]: { bg: 'bg-red-900', text: 'text-white', label: 'REJEITADO' },
  }[attendee.status] || { bg: 'bg-gray-600', text: 'text-white', label: attendee.status };

  const formatCPF = (cpf: string) => {
    if (!cpf) return '';
    const raw = cpf.replace(/\D/g, '');
    return `***.***.${raw.slice(6, 9)}-${raw.slice(9, 11)}`;
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

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-2xl rounded-[3rem] overflow-hidden border border-white/10 bg-[#0a0a0a] shadow-[0_50px_100px_rgba(0,0,0,1)] relative">
        
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-600 via-amber-400 to-rose-600"></div>

        <div className="p-8">
            <div className="flex justify-between items-start mb-8">
                <div className="flex items-center gap-6">
                    <div className="w-24 h-24 rounded-[2rem] overflow-hidden border-2 border-white/5 shadow-2xl relative">
                        <UserAvatar src={attendee.photo} alt={attendee.name} className="w-full h-full object-cover" />
                    </div>
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-[0.4em] mb-1 block text-rose-500">
                            Gestão de Identidade VIP
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

            <div className="bg-white/5 rounded-3xl p-6 grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 border border-white/5">
                <div className="space-y-4">
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-1 block">Documento</span>
                        <p className="text-white font-bold tracking-widest">{formatCPF(attendee.cpf)}</p>
                    </div>
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-1 block">Promoter Responsável</span>
                        <p className="text-white font-bold">{supplier?.name || 'Venda Direta'}</p>
                    </div>
                </div>
                <div className="space-y-4">
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-1 block">Mesa / Camarote</span>
                        <p className="text-white font-bold italic">{attendee.subCompany || 'Individual'}</p>
                    </div>
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-1 block">Email</span>
                        <p className="text-white font-bold truncate text-sm">{attendee.email || 'N/A'}</p>
                    </div>
                </div>
            </div>

            {/* SEÇÃO DE SUBSTITUIÇÃO (COMPARATIVO) */}
            {attendee.status === CheckinStatus.SUBSTITUTION_REQUEST && attendee.substitutionData && (
                <div className="mb-8 animate-in slide-in-from-bottom-4">
                    <div className="flex items-center gap-2 mb-4">
                        <ArrowPathIcon className="w-4 h-4 text-purple-400" />
                        <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Dados da Nova Bio-Identidade</span>
                    </div>
                    <div className="bg-purple-600/5 border border-purple-500/20 rounded-[2rem] p-6 flex items-center gap-6">
                        <div className="w-20 h-20 rounded-2xl overflow-hidden border border-purple-500/30">
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

            {/* SEÇÃO DE TROCA DE SETOR */}
            {attendee.status === CheckinStatus.SECTOR_CHANGE_REQUEST && attendee.sectorChangeData && (
                <div className="mb-8 p-6 bg-blue-600/5 border border-blue-500/20 rounded-[2rem]">
                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2 block">Nova Área Solicitada</span>
                    <p className="text-white font-bold text-xl">
                        {sectors.find(s => s.id === attendee.sectorChangeData?.newSectorId)?.label || 'Indefinido'}
                    </p>
                    {attendee.sectorChangeData.justification && (
                        <p className="text-neutral-500 text-xs mt-2">" {attendee.sectorChangeData.justification} "</p>
                    )}
                </div>
            )}

            {/* BOTÕES DE AÇÃO BASEADOS NO STATUS */}
            <div className="space-y-3">
                {/* Caso: Novo Registro Pendente de Aprovação */}
                {attendee.status === CheckinStatus.PENDING_APPROVAL && (
                    <div className="flex flex-col gap-3">
                        <button onClick={() => handleAction(() => onApproveNewRegistration(attendee.id))} disabled={isSubmitting} className="w-full py-5 bg-white text-black font-black uppercase tracking-widest text-[11px] rounded-2xl hover:bg-neutral-200 transition-all shadow-xl flex items-center justify-center gap-2">
                            <CheckCircleIcon className="w-5 h-5" /> Autorizar Convidado
                        </button>
                        <button onClick={() => handleAction(() => onRejectNewRegistration(attendee.id))} disabled={isSubmitting} className="w-full py-5 bg-rose-600/10 text-rose-500 border border-rose-500/20 font-black uppercase tracking-widest text-[11px] rounded-2xl hover:bg-rose-600/20 transition-all">
                            <NoSymbolIcon className="w-5 h-5 inline mr-2" /> Recusar Cadastro
                        </button>
                    </div>
                )}

                {/* Caso: Solicitação de Substituição */}
                {attendee.status === CheckinStatus.SUBSTITUTION_REQUEST && (
                    <div className="flex flex-col gap-3">
                        <button onClick={() => handleAction(() => onApproveSubstitution(attendee.id))} disabled={isSubmitting} className="w-full py-5 bg-white text-black font-black uppercase tracking-widest text-[11px] rounded-2xl hover:bg-neutral-200 transition-all shadow-xl flex items-center justify-center gap-2">
                             Confirmar Substituição VIP
                        </button>
                        <button onClick={() => handleAction(() => onRejectSubstitution(attendee.id))} disabled={isSubmitting} className="w-full py-5 bg-rose-600/10 text-rose-500 border border-rose-500/20 font-black uppercase tracking-widest text-[11px] rounded-2xl hover:bg-rose-600/20 transition-all">
                             Manter Convidado Original
                        </button>
                    </div>
                )}

                {/* Caso: Solicitação de Troca de Setor */}
                {attendee.status === CheckinStatus.SECTOR_CHANGE_REQUEST && (
                    <div className="flex flex-col gap-3">
                        <button onClick={() => handleAction(() => onApproveSectorChange(attendee.id))} disabled={isSubmitting} className="w-full py-5 bg-white text-black font-black uppercase tracking-widest text-[11px] rounded-2xl hover:bg-neutral-200 transition-all shadow-xl">
                             Aprovar Upgrade de Área
                        </button>
                        <button onClick={() => handleAction(() => onRejectSectorChange(attendee.id))} disabled={isSubmitting} className="w-full py-5 bg-rose-600/10 text-rose-500 border border-rose-500/20 font-black uppercase tracking-widest text-[11px] rounded-2xl hover:bg-rose-600/20 transition-all">
                             Manter Área Atual
                        </button>
                    </div>
                )}

                {/* Ações de Check-in Padrão */}
                {attendee.status === CheckinStatus.PENDING && (
                    <button onClick={() => { onUpdateStatus(CheckinStatus.CHECKED_IN); onClose(); }} className="w-full py-5 bg-white text-black font-black uppercase tracking-widest text-[11px] rounded-2xl hover:bg-neutral-200 transition-all shadow-xl">
                        Liberar Entrada VIP
                    </button>
                )}
                
                {attendee.status === CheckinStatus.CHECKED_IN && (
                    <button onClick={() => { onUpdateStatus(CheckinStatus.CHECKED_OUT); onClose(); }} className="w-full py-5 bg-rose-600/10 text-rose-500 border border-rose-500/20 font-black uppercase tracking-widest text-[11px] rounded-2xl hover:bg-rose-600/20 transition-all">
                        Confirmar Saída
                    </button>
                )}
            </div>

            {user.role === 'superadmin' && (
                <div className="flex justify-center mt-8 border-t border-white/5 pt-6">
                    <button onClick={() => { if(window.confirm('Excluir registro permanentemente?')) onDelete(attendee.id); }} className="text-[10px] font-black uppercase tracking-[0.4em] text-neutral-700 hover:text-red-500 transition-all">Deletar Registro do Banco</button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
