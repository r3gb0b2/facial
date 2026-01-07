
import React, { useState, useEffect, useMemo } from 'react';
import { Attendee, CheckinStatus, Sector, Supplier, User } from '../types.ts';
import { useTranslation } from '../hooks/useTranslation.tsx';
import { XMarkIcon, PencilIcon, TrashIcon, CheckCircleIcon, SpinnerIcon, NoSymbolIcon, TagIcon } from './icons.tsx';
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
}

export const AttendeeDetailModal: React.FC<AttendeeDetailModalProps> = ({
  user, attendee, sectors, suppliers, allAttendees, currentEventId, onClose, onUpdateStatus, onUpdateDetails, onDelete, onApproveSubstitution, onRejectSubstitution, onApproveSectorChange, onRejectSectorChange, onApproveNewRegistration, onRejectNewRegistration, setError, supplier,
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
    [CheckinStatus.PENDING]: { bg: 'bg-gray-600', text: 'text-gray-200', label: t('status.pending') },
    [CheckinStatus.CHECKED_IN]: { bg: 'bg-green-600', text: 'text-white', label: t('status.checked_in') },
    [CheckinStatus.CHECKED_OUT]: { bg: 'bg-slate-500', text: 'text-white', label: t('status.checked_out') },
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
    setTimeout(() => { setShowWristbandSuccess(false); onClose(); }, 1500);
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

  // FIX: Added missing handleSave function to update attendee details from the editing view.
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
      setError(err.message || "Falha ao atualizar cadastro.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBlock = async () => {
    const reason = window.prompt("Por favor, informe o motivo do bloqueio (opcional):");
    if(reason !== null){ 
        await api.blockAttendee(currentEventId, attendee.id, reason);
        onClose();
    }
  }

  const selectedSupplierData = useMemo(() => suppliers.find(s => s.id === editData.supplierId), [editData.supplierId, suppliers]);

  // Layout logic for actions (Primary)
  const renderQuickActions = () => {
    if (isEditing || attendee.status === CheckinStatus.SUBSTITUTION_REQUEST || attendee.status === CheckinStatus.SECTOR_CHANGE_REQUEST || attendee.status === CheckinStatus.PENDING_APPROVAL) return null;

    if (attendee.status === CheckinStatus.PENDING) {
      return (
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 h-full flex flex-col justify-between">
          <div className="space-y-3">
             <div className="flex items-center gap-2 mb-1">
                 <TagIcon className="w-4 h-4 text-green-400" />
                 <span className="text-[10px] font-black uppercase tracking-widest text-green-400">Vincular Pulseira</span>
             </div>
             <div className="grid grid-cols-1 gap-2">
                {attendeeSectors.map(sector => (
                    <div key={sector.id} className="relative">
                        <input
                            type="text"
                            value={wristbands[sector.id] || ''}
                            onChange={(e) => handleWristbandChange(sector.id, e.target.value)}
                            className={`w-full bg-black/40 border rounded-lg py-2.5 px-3 text-white text-sm focus:outline-none focus:ring-1 ${wristbandErrorSectors.has(sector.id) ? 'border-red-500 ring-red-500' : 'border-white/10 focus:ring-green-500'}`}
                            placeholder={`${sector.label}...`}
                            autoFocus
                        />
                    </div>
                ))}
             </div>
          </div>
          <button onClick={handleUpdateWristbands} className="mt-4 w-full bg-green-600 hover:bg-green-500 text-white font-black uppercase tracking-widest text-xs py-4 rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2">
            <CheckCircleIcon className="w-5 h-5"/>
            Liberar Entrada
          </button>
        </div>
      );
    }
    
    if (attendee.status === CheckinStatus.CHECKED_IN || attendee.status === CheckinStatus.CHECKED_OUT) {
      const wristbandForQr = attendee.wristbands ? Object.values(attendee.wristbands).find(num => num) : undefined;
      return (
        <div className="bg-gray-900/50 border border-white/5 rounded-xl p-4 h-full flex flex-col items-center justify-center text-center">
             {wristbandForQr ? (
                 <div className="w-full">
                     <QRCodeDisplay data={wristbandForQr} />
                     <p className="text-[10px] font-bold text-gray-500 uppercase mt-2 tracking-widest">Código Ativo: {wristbandForQr}</p>
                 </div>
             ) : (
                 <p className="text-gray-500 text-xs italic">Sem QR Code gerado.</p>
             )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-3xl shadow-[0_50px_100px_rgba(0,0,0,0.5)] w-full max-w-5xl border border-white/10 overflow-hidden flex flex-col animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
        
        {/* Header Compacto */}
        <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-gray-900/40">
           <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${statusInfo.bg} animate-pulse`}></div>
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">{statusInfo.label}</span>
           </div>
           <div className="flex items-center gap-2">
                {user.role !== 'checkin' && !isEditing && attendee.status !== CheckinStatus.PENDING_APPROVAL && (
                  <button onClick={() => setIsEditing(true)} className="p-2 text-gray-500 hover:text-white transition-colors hover:bg-white/5 rounded-lg">
                    <PencilIcon className="w-5 h-5" />
                  </button>
                )}
                <button onClick={onClose} className="p-2 text-gray-500 hover:text-white transition-colors hover:bg-white/5 rounded-lg">
                  <XMarkIcon className="w-6 h-6" />
                </button>
           </div>
        </div>

        <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                
                {/* Coluna 1: Avatar e Nome */}
                <div className="lg:col-span-3 flex flex-col items-center text-center">
                    <div className="w-full aspect-square max-w-[200px] rounded-2xl overflow-hidden border-2 border-white/5 shadow-2xl bg-black relative mb-4">
                         <UserAvatar src={attendee.photo} alt={attendee.name} className="w-full h-full object-cover" />
                    </div>
                    <h2 className="text-xl font-black text-white uppercase tracking-tight leading-tight mb-1">{attendee.name}</h2>
                    <p className="text-xs font-mono text-gray-500">{formatCPF(attendee.cpf)}</p>
                </div>

                {/* Coluna 2: Dados Técnicos (Grid) */}
                <div className="lg:col-span-5 flex flex-col justify-center">
                    <div className="bg-black/20 rounded-2xl p-6 border border-white/5 space-y-6">
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest block mb-1">Setor / Acesso</span>
                                <div className="flex flex-wrap gap-1">
                                    {attendeeSectors.map(s => (
                                        <span key={s.id} className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/5 border border-white/10" style={{ color: s.color }}>{s.label}</span>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest block mb-1">Grupo / Unidade</span>
                                <p className="text-gray-300 font-bold text-xs truncate">{attendee.subCompany || 'Individual'}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest block mb-1">Fornecedor</span>
                                <p className="text-gray-300 font-medium text-xs truncate">{supplier?.name || 'Direto'}</p>
                            </div>
                            <div>
                                <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest block mb-1">Status do Registro</span>
                                <p className={`text-[10px] font-black uppercase ${attendee.status === CheckinStatus.PENDING ? 'text-yellow-500' : 'text-green-500'}`}>{statusInfo.label}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Coluna 3: Ações de Check-in (Onde o foco está) */}
                <div className="lg:col-span-4">
                    {renderQuickActions()}
                </div>
            </div>
        </div>

        {/* Footer para ações secundárias */}
        <div className="px-6 py-4 bg-gray-900/40 border-t border-white/5 flex flex-wrap gap-4 items-center justify-between">
            <div className="flex gap-4">
                {attendee.status === CheckinStatus.CHECKED_IN && (
                     <button onClick={() => onUpdateStatus(CheckinStatus.CHECKED_OUT)} className="bg-yellow-600/10 text-yellow-500 border border-yellow-500/20 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-yellow-600/20 transition-all">Registrar Saída</button>
                )}
                {attendee.status === CheckinStatus.CHECKED_OUT && (
                     <button onClick={() => onUpdateStatus(CheckinStatus.CHECKED_IN)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all">Reativar Entrada</button>
                )}
            </div>
            
            <div className="flex items-center gap-3">
                 {user.role !== 'checkin' && attendee.status !== CheckinStatus.BLOCKED && (
                    <button onClick={handleBlock} className="text-[10px] font-black uppercase tracking-widest text-red-500/50 hover:text-red-500 transition-colors">Bloquear Registro</button>
                 )}
                 {user.role !== 'checkin' && (
                    <button onClick={() => { if(confirm('Excluir permanentemente?')) onDelete(attendee.id); }} className="text-[10px] font-black uppercase tracking-widest text-gray-600 hover:text-white transition-colors">Excluir</button>
                 )}
            </div>
        </div>

        {/* Overlay de Edição (Se ativo) */}
        {isEditing && (
            <div className="absolute inset-0 bg-gray-900 z-50 p-8 flex flex-col">
                <div className="flex justify-between items-center mb-8">
                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Editar Cadastro</h3>
                    <button onClick={() => setIsEditing(false)} className="text-gray-500"><XMarkIcon className="w-8 h-8"/></button>
                </div>
                <div className="flex-grow overflow-y-auto pr-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                         <div className="space-y-6">
                            <div>
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Nome Completo</label>
                                <input type="text" value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-indigo-500" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">CPF</label>
                                <input type="text" value={editData.cpf} onChange={e => setEditData({ ...editData, cpf: formatCPF(e.target.value) })} className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-indigo-500" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Unidade / Empresa</label>
                                <input type="text" value={editData.subCompany} onChange={e => setEditData({ ...editData, subCompany: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-indigo-500" />
                            </div>
                         </div>
                         <div className="flex flex-col items-center">
                             <WebcamCapture onCapture={(img) => setEditData(prev => ({ ...prev, photo: img }))} capturedImage={editData.photo} allowUpload={true} />
                         </div>
                    </div>
                </div>
                <div className="pt-6 border-t border-white/5 flex gap-4">
                    <button onClick={() => setIsEditing(false)} className="flex-grow py-4 bg-gray-800 text-white font-black uppercase tracking-widest text-xs rounded-xl">Cancelar</button>
                    <button onClick={handleSave} className="flex-grow py-4 bg-indigo-600 text-white font-black uppercase tracking-widest text-xs rounded-xl shadow-lg">Salvar Alterações</button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};
