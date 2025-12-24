
import React, { useState, useEffect } from 'react';
import { Attendee, Sector, CheckinStatus } from '../types.ts';
import { useTranslation } from '../hooks/useTranslation.tsx';
import * as api from '../firebase/service.ts';
import { XMarkIcon, SpinnerIcon, CheckCircleIcon, TrashIcon, SparklesIcon, UserCircleIcon } from './icons.tsx';
import WebcamCapture from './WebcamCapture.tsx';
import UserAvatar from './UserAvatar.tsx';

interface SubstitutionRequestModalProps {
  attendee: Attendee;
  eventId: string;
  onClose: () => void;
  onSuccess: (attendeeId: string) => void;
  allowedSectors: Sector[];
}

const formatCPF = (value: string) => {
    return value.replace(/\D/g, '').slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};

const SubstitutionRequestModal: React.FC<SubstitutionRequestModalProps> = ({ attendee, eventId, onClose, onSuccess, allowedSectors }) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubstitution = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawCpf = cpf.replace(/\D/g, '');
    if (!name.trim() || rawCpf.length !== 11 || !photo || !email) {
      setError(t('register.errors.allFields'));
      return;
    }
    setIsSubmitting(true);
    try {
      await api.requestSubstitution(eventId, attendee.id, { 
          name: name.trim(), 
          cpf: rawCpf, 
          photo, 
          email: email.trim(),
          newSectorIds: attendee.sectors 
      });
      onSuccess(attendee.id);
      onClose();
    } catch (err) {
      setError("Falha ao solicitar substituição.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoval = async () => {
      if (!window.confirm(t('supplierAdmin.request.removeConfirm'))) return;
      setIsSubmitting(true);
      try {
          await api.updateAttendeeDetails(eventId, attendee.id, { 
              status: CheckinStatus.PENDING_APPROVAL, 
              blockReason: "SOLICITAÇÃO DE REMOÇÃO PELO PROMOTER" 
          });
          onSuccess(attendee.id);
          onClose();
      } catch (err) {
          setError("Falha ao solicitar remoção.");
      } finally {
          setIsSubmitting(false);
      }
  };

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-xl flex items-center justify-center z-[110] p-4" onClick={onClose}>
      <div className="bg-[#0a0a0a] rounded-[3rem] shadow-[0_50px_100px_rgba(0,0,0,1)] w-full max-w-4xl border border-white/10 flex flex-col overflow-hidden animate-in fade-in" onClick={(e) => e.stopPropagation()}>
        
        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-black/40">
          <div>
            <div className="flex items-center gap-2 mb-1">
                <SparklesIcon className="w-4 h-4 text-rose-500" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-500">Exclusive Management</span>
            </div>
            <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Gestão de <span className="text-rose-500">Convidado</span></h2>
          </div>
          <button onClick={onClose} className="p-4 text-neutral-600 hover:text-white transition-all bg-white/5 rounded-full">
            <XMarkIcon className="w-8 h-8" />
          </button>
        </div>

        <div className="p-10 grid grid-cols-1 md:grid-cols-12 gap-12 items-start max-h-[75vh] overflow-y-auto">
          <div className="md:col-span-4 flex flex-col items-center">
             <div className="text-center mb-6">
                <span className="text-[9px] font-black uppercase tracking-widest text-rose-500">Perfil Atual</span>
                <p className="text-white font-bold text-lg mt-1">{attendee.name}</p>
             </div>
             <div className="w-48 h-60 rounded-3xl overflow-hidden border border-white/10 relative bg-neutral-950">
                <UserAvatar src={attendee.photo} alt={attendee.name} className="w-full h-full object-cover grayscale opacity-50" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <UserCircleIcon className="w-12 h-12 text-neutral-800" />
                </div>
             </div>
             <button onClick={handleRemoval} className="mt-8 w-full text-rose-600 hover:text-rose-500 font-black uppercase tracking-widest text-[10px] py-4 px-8 border border-rose-900/30 rounded-2xl hover:bg-rose-950/20 transition-all flex items-center justify-center gap-3">
                <TrashIcon className="w-4 h-4" />
                Solicitar Remoção
             </button>
          </div>

          <form onSubmit={handleSubstitution} className="md:col-span-8 space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-600">Novo Nome</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-neutral-900 border-b border-neutral-800 p-3 text-white focus:outline-none focus:border-rose-500 transition-all font-bold placeholder:text-neutral-800" placeholder="NOME DO SUBSTITUTO" required disabled={isSubmitting} />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-600">Novo Documento (CPF)</label>
                    <input type="text" value={cpf} onChange={(e) => setCpf(formatCPF(e.target.value))} className="w-full bg-neutral-900 border-b border-neutral-800 p-3 text-white focus:outline-none focus:border-rose-500 transition-all font-bold placeholder:text-neutral-800" placeholder="000.000.000-00" required disabled={isSubmitting} />
                </div>
            </div>
            <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-600">Novo E-mail Exclusive</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-neutral-900 border-b border-neutral-800 p-3 text-white focus:outline-none focus:border-rose-500 transition-all font-bold placeholder:text-neutral-800" placeholder="CONTATO@EMAIL.COM" required disabled={isSubmitting} />
            </div>
            <div className="space-y-6">
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-600">Nova Bio-Identidade</label>
                <div className="max-w-[280px] mx-auto">
                    <WebcamCapture onCapture={setPhoto} capturedImage={photo} disabled={isSubmitting} allowUpload={true} />
                </div>
            </div>
            <div className="bg-neutral-950 p-4 rounded-2xl border border-white/5 flex items-start gap-4">
                <div className="bg-rose-500/20 p-2 rounded-lg"><SparklesIcon className="w-4 h-4 text-rose-500" /></div>
                <p className="text-[9px] text-neutral-500 font-bold uppercase tracking-wider leading-relaxed">{t('supplierAdmin.request.notice')}</p>
            </div>
            <button type="submit" disabled={isSubmitting || !name || !cpf || !photo} className="w-full bg-white text-black font-black uppercase tracking-[0.3em] text-[11px] py-6 rounded-2xl transition-all shadow-2xl disabled:bg-neutral-800">
                {isSubmitting ? "Enviando Requisição..." : "Solicitar Substituição"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SubstitutionRequestModal;
