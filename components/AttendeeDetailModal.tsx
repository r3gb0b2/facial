import React, { useState, useEffect, useMemo } from 'react';
import { Attendee, CheckinStatus, Sector, Supplier, User } from '../types.ts';
import { useTranslation } from '../hooks/useTranslation.tsx';
import { XMarkIcon, PencilIcon, TrashIcon, CheckCircleIcon, NoSymbolIcon, TagIcon, ArrowPathIcon } from './icons.tsx';
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
  user, attendee, sectors, suppliers, allAttendees, currentEventId, onClose, onUpdateStatus, onUpdateDetails, onDelete, onApproveSubstitution, onRejectSubstitution, onApproveSectorChange, onRejectSectorChange, onApproveNewRegistration, onRejectNewRegistration, setError, supplier, isVip = false
}) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [wristbands, setWristbands] = useState(attendee.wristbands || {});
  const [wristbandErrorSectors, setWristbandErrorSectors] = useState<Set<string>>(new Set());
  const [showWristbandSuccess, setShowWristbandSuccess] = useState(false);
  const [editData, setEditData] = useState({
    name: attendee.name,
    cpf: attendee.cpf,
    sectors: attendee.sectors,
    subCompany: attendee.subCompany || '',
    supplierId: attendee.supplierId || '',
    photo: attendee.photo,
  });
  
  const attendeeSectors = useMemo(() => {
    return (attendee.sectors || []).map(id => sectors.find(s => s.id === id)).filter(Boolean) as Sector[];
  }, [attendee.sectors, sectors]);


  useEffect(() => {
    const availableSectorIds = new Set(sectors.map(s => s.id));
    const validAttendeeSectors = (attendee.sectors || []).filter(id => availableSectorIds.has(id));

    setEditData({
      name: attendee.name,
      cpf: formatCPF(attendee.cpf),
      sectors: validAttendeeSectors,
      subCompany: attendee.subCompany || '',
      supplierId: attendee.supplierId || '',
      photo: attendee.photo,
    });
    setWristbands(attendee.wristbands || {});
    setIsEditing(false);
    setShowWristbandSuccess(false);
    setWristbandErrorSectors(new Set());
  }, [attendee, sectors]);

  const statusInfo = {
    [CheckinStatus.PENDING]: { bg: isVip ? 'bg-amber-500' : 'bg-gray-600', text: 'text-white', label: t('status.pending') },
    [CheckinStatus.CHECKED_IN]: { bg: isVip ? 'bg-rose-500' : 'bg-green-600', text: 'text-white', label: t('status.checked_in') },
    [CheckinStatus.CANCELLED]: { bg: 'bg-red-600', text: 'text-white', label: t('status.cancelled') },
    [CheckinStatus.SUBSTITUTION]: { bg: 'bg-yellow-500', text: 'text-black', label: t('status.substitution') },
    [CheckinStatus.SUBSTITUTION_REQUEST]: { bg: 'bg-blue-500', text: 'text-white', label: t('status.substitution_request') },
    [CheckinStatus.SECTOR_CHANGE_REQUEST]: { bg: 'bg-purple-500', text: 'text-white', label: t('status.sector_change_request') },
    [CheckinStatus.PENDING_APPROVAL]: { bg: 'bg-yellow-500', text: 'text-black', label: t('status.pending_approval') },
    [CheckinStatus.MISSED]: { bg: 'bg-gray-800', text: 'text-gray-400', label: t('status.missed') },
    [CheckinStatus.BLOCKED]: { bg: 'bg-red-700', text: 'text-white', label: t('status.blocked') },
  }[attendee.status] || { bg: 'bg-gray-600', text: 'text-gray-200', label: attendee.status };
  
  const formatCPF = (cpf: string) => {
    if (!cpf) return '';
    return cpf.replace(/\D/g, '').slice(0, 11).replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const handleUpdateWristbands = async () => {
    setShowWristbandSuccess(false);
    setWristbandErrorSectors(new Set());
    const errors = new Set<string>();
    const duplicateNumbers: string[] = [];

    const otherAttendees = allAttendees.filter(a => a.id !== attendee.id);
    for (const sectorId of attendeeSectors.map(s => s.id)) {
      const number = wristbands[sectorId];
      if (number) {
        const isDuplicate = otherAttendees.some(other =>
          other.wristbands && other.wristbands[sectorId] === number
        );
        if (isDuplicate) {
          errors.add(sectorId);
          duplicateNumbers.push(number);
        }
      }
    }

    setWristbandErrorSectors(errors);
    if (errors.size > 0) {
      setError(t('attendeeDetail.wristbandsDuplicateError', { numbers: duplicateNumbers.join(', ') }));
      return;
    }
    await onUpdateStatus(CheckinStatus.CHECKED_IN, wristbands);
    setShowWristbandSuccess(true);
    setTimeout(() => { setShowWristbandSuccess(false); onClose(); }, 1000);
  };

  const handleWristbandChange = (sectorId: string, value: string) => {
    setWristbands(prev => ({ ...prev, [sectorId]: value }));
    if (wristbandErrorSectors.has(sectorId)) {
        setWristbandErrorSectors(prev => {
            const newErrors = new Set(prev);
            newErrors.delete(sectorId);
            return newErrors;
        });
    }
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      const rawCpf = editData.cpf.replace(/\D/g, '');
      if (rawCpf.length !== 11) {
        setError("CPF inválido.");
        setIsSubmitting(false);
        return;
      }
      await onUpdateDetails(attendee.id, {
        name: editData.name,
        cpf: rawCpf,
        sectors: editData.sectors,
        subCompany: editData.subCompany,
        supplierId: editData.supplierId,
        photo: editData.photo,
      });
      setIsEditing(false);
    } catch (err: any) {
      setError(err.message || "Falha ao atualizar.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBlock = async () => {
    const reason = window.prompt("Motivo do bloqueio (opcional):");
    if(reason !== null){ 
        await api.blockAttendee(currentEventId, attendee.id, reason);
        onClose();
    }
  }

  const renderQuickActions = () => {
    if (isEditing) return null;

    if (attendee.status === CheckinStatus.PENDING) {
      return (
        <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-6 h-full flex flex-col justify-between">
          <div className="space-y-4">
             <div className="flex items-center gap-2 mb-1">
                 <TagIcon className="w-5 h-5 text-green-400" />
                 <span className="text-[11px] font-black uppercase tracking-widest text-green-400">Vincular Pulseira</span>
             </div>
             <div className="grid grid-cols-1 gap-3">
                {attendeeSectors.map(sector => (
                    <div key={sector.id} className="relative">
                        <input
                            type="text"
                            value={wristbands[sector.id] || ''}
                            onChange={(e) => handleWristbandChange(sector.id, e.target.value)}
                            className={`w-full bg-black/60 border-2 rounded-xl py-4 px-5 text-white text-lg font-black focus:outline-none transition-all ${wristbandErrorSectors.has(sector.id) ? 'border-red-500 ring-red-500/20' : 'border-white/10 focus:border-green-500'}`}
                            placeholder={`${sector.label}...`}
                            autoFocus
                        />
                    </div>
                ))}
             </div>
          </div>
          <button onClick={handleUpdateWristbands} className={`mt-6 w-full ${isVip ? 'bg-rose-600 hover:bg-rose-500' : 'bg-green-600 hover:bg-green-500'} text-white font-black uppercase tracking-widest text-xs py-5 rounded-2xl transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3`}>
            <CheckCircleIcon className="w-6 h-6"/>
            Efetuar Check-in
          </button>
        </div>
      );
    }
    
    if (attendee.status === CheckinStatus.CHECKED_IN) {
      const wristbandNumbers = attendee.wristbands ? Object.values(attendee.wristbands).filter(Boolean).join(', ') : '';
      return (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 h-full flex flex-col justify-between">
            <div className="text-center space-y-4">
                 <span className="text-[10px] font-black uppercase tracking-widest text-red-400 block">Check-in Concluído</span>
                 <div className="py-4 bg-black/40 rounded-xl border border-white/5">
                    <p className="text-[9px] text-gray-500 uppercase font-black tracking-widest mb-1">Pulseira(s) Ativa(s)</p>
                    <p className="text-xl font-black text-indigo-400 tracking-tighter">#{wristbandNumbers || 'N/A'}</p>
                 </div>
                 <p className="text-gray-400 text-[11px] leading-relaxed">Deseja anular este registro? O acesso e a pulseira serão invalidados.</p>
            </div>
            <button onClick={() => onUpdateStatus(CheckinStatus.PENDING)} className="w-full bg-red-600/20 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/30 font-black uppercase tracking-widest text-[11px] py-5 rounded-2xl transition-all flex items-center justify-center gap-3">
                <ArrowPathIcon className="w-5 h-5"/>
                Anular Check-in
            </button>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-[100] p-4" onClick={onClose}>
      <div className="bg-neutral-900 rounded-[2.5rem] shadow-[0_50px_100px_rgba(0,0,0,1)] w-full max-w-6xl border border-white/10 overflow-hidden flex flex-col animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
        
        {/* Header Ultra Compacto */}
        <div className="px-8 py-4 border-b border-white/5 flex justify-between items-center bg-black/40">
           <div className="flex items-center gap-4">
              <div className={`w-3 h-3 rounded-full ${statusInfo.bg} shadow-[0_0_15px_rgba(0,0,0,0.5)]`}></div>
              <span className="text-[11px] font-black uppercase tracking-[0.4em] text-gray-400">{statusInfo.label}</span>
           </div>
           <div className="flex items-center gap-3">
                {user.role !== 'checkin' && !isEditing && (
                  <button onClick={() => setIsEditing(true)} className="p-3 text-gray-400 hover:text-white transition-all hover:bg-white/5 rounded-xl">
                    <PencilIcon className="w-5 h-5" />
                  </button>
                )}
                <button onClick={onClose} className="p-3 text-gray-400 hover:text-white transition-all hover:bg-white/5 rounded-xl">
                  <XMarkIcon className="w-6 h-6" />
                </button>
           </div>
        </div>

        <div className="p-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch">
                
                {/* Coluna 1: Identidade Visual */}
                <div className="lg:col-span-3 flex flex-col items-center text-center">
                    <div className="w-full aspect-square max-w-[240px] rounded-[2rem] overflow-hidden border-4 border-white/5 shadow-[0_20px_60px_rgba(0,0,0,0.8)] bg-black relative mb-6 group">
                         <UserAvatar src={attendee.photo} alt={attendee.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                    </div>
                    <h2 className="text-3xl font-black text-white uppercase tracking-tighter leading-none mb-2">{attendee.name}</h2>
                    <p className="text-xs font-mono text-neutral-500 tracking-[0.2em]">{formatCPF(attendee.cpf)}</p>
                </div>

                {/* Coluna 2: Grid de Dados Técnicos (Horizontalizada) */}
                <div className="lg:col-span-5 flex flex-col justify-center">
                    <div className="bg-white/[0.02] rounded-[2.5rem] p-10 border border-white/5 space-y-10">
                        <div className="grid grid-cols-2 gap-10">
                            <div>
                                <span className="text-[10px] font-black text-neutral-600 uppercase tracking-widest block mb-3">Setor de Acesso</span>
                                <div className="flex flex-wrap gap-2">
                                    {attendeeSectors.map(s => (
                                        <span key={s.id} className="text-[11px] font-black px-4 py-1.5 rounded-xl bg-white/5 border border-white/10" style={{ color: s.color }}>{s.label}</span>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <span className="text-[10px] font-black text-neutral-600 uppercase tracking-widest block mb-3">{isVip ? 'Local / Mesa' : 'Empresa'}</span>
                                <p className="text-white font-black text-lg tracking-tight truncate">{attendee.subCompany || 'Individual'}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-10 pt-6 border-t border-white/5">
                            <div>
                                <span className="text-[10px] font-black text-neutral-600 uppercase tracking-widest block mb-3">{isVip ? 'Promoter' : 'Fornecedor'}</span>
                                <p className="text-neutral-400 font-bold text-sm truncate">{supplier?.name || 'Direto'}</p>
                            </div>
                            <div>
                                <span className="text-[10px] font-black text-neutral-600 uppercase tracking-widest block mb-3">Horário de Entrada</span>
                                <p className={`text-[12px] font-black uppercase ${attendee.checkinTime ? 'text-rose-500' : 'text-amber-500'}`}>
                                    {attendee.checkinTime ? formatTimestamp(attendee.checkinTime) : 'Aguardando'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Coluna 3: Ações de Check-in (Onde o foco operacional está) */}
                <div className="lg:col-span-4">
                    {renderQuickActions()}
                </div>
            </div>
        </div>

        {/* Footer Minimalista */}
        <div className="px-8 py-5 bg-black/40 border-t border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-8">
                 {user.role !== 'checkin' && attendee.status !== CheckinStatus.BLOCKED && (
                    <button onClick={handleBlock} className="text-[10px] font-black uppercase tracking-widest text-red-500/40 hover:text-red-500 transition-colors">Negativar Registro</button>
                 )}
                 {user.role !== 'checkin' && (
                    <button onClick={() => { if(confirm('Excluir permanentemente?')) onDelete(attendee.id); }} className="text-[10px] font-black uppercase tracking-widest text-neutral-600 hover:text-white transition-colors">Remover Sistema</button>
                 )}
            </div>
            <div className="flex items-center gap-4">
                <span className="text-[9px] font-black text-neutral-700 uppercase tracking-[0.3em]">ID Interno: {attendee.id.slice(0, 8)}</span>
            </div>
        </div>

        {/* Overlay de Edição */}
        {isEditing && (
            <div className="absolute inset-0 bg-neutral-950 z-50 p-12 flex flex-col">
                <div className="flex justify-between items-center mb-10">
                    <h3 className="text-4xl font-black text-white uppercase tracking-tighter">Ficha de Edição</h3>
                    <button onClick={() => setIsEditing(false)} className="text-gray-600 p-3 hover:bg-white/5 rounded-full transition-all"><XMarkIcon className="w-8 h-8"/></button>
                </div>
                <div className="flex-grow overflow-y-auto pr-6 custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                         <div className="space-y-10">
                            <div>
                                <label className="text-[11px] font-black text-neutral-600 uppercase tracking-widest block mb-4">Nome Completo</label>
                                <input type="text" value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-2xl py-5 px-6 text-white text-xl font-black focus:outline-none focus:border-rose-500 transition-all" />
                            </div>
                            <div>
                                <label className="text-[11px] font-black text-neutral-600 uppercase tracking-widest block mb-4">Documento CPF</label>
                                <input type="text" value={editData.cpf} onChange={e => setEditData({ ...editData, cpf: formatCPF(e.target.value) })} className="w-full bg-white/5 border border-white/10 rounded-2xl py-5 px-6 text-white text-xl font-black focus:outline-none focus:border-rose-500 transition-all" />
                            </div>
                            <div>
                                <label className="text-[11px] font-black text-neutral-600 uppercase tracking-widest block mb-4">Localização / Empresa</label>
                                <input type="text" value={editData.subCompany} onChange={e => setEditData({ ...editData, subCompany: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-2xl py-5 px-6 text-white text-xl font-black focus:outline-none focus:border-rose-500 transition-all" />
                            </div>
                         </div>
                         <div className="flex flex-col items-center">
                             <span className="text-[11px] font-black text-neutral-600 uppercase tracking-widest block mb-6">Bio-Scan Identidade</span>
                             <div className="w-full max-w-sm">
                                <WebcamCapture onCapture={(img) => setEditData(prev => ({ ...prev, photo: img }))} capturedImage={editData.photo} allowUpload={true} />
                             </div>
                         </div>
                    </div>
                </div>
                <div className="pt-10 mt-6 border-t border-white/5 flex gap-6">
                    <button onClick={() => setIsEditing(false)} className="flex-grow py-6 bg-neutral-900 text-neutral-500 font-black uppercase tracking-widest text-xs rounded-3xl border border-white/5 hover:bg-neutral-800 transition-all">Cancelar Edição</button>
                    <button onClick={handleSave} className="flex-grow py-6 bg-white text-black font-black uppercase tracking-widest text-xs rounded-3xl shadow-2xl hover:bg-neutral-200 transition-all">Salvar Ficha</button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

const formatTimestamp = (timestamp: any) => {
    if (!timestamp || !timestamp.seconds) return '-';
    return new Date(timestamp.seconds * 1000).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
};