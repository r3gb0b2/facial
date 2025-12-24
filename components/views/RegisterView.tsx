
import React, { useState, useEffect, useMemo } from 'react';
import { Attendee, Sector, Supplier, SubCompany, EventType } from '../../types.ts';
import WebcamCapture from '../WebcamCapture.tsx';
import { useTranslation } from '../../hooks/useTranslation.tsx';
import { UsersIcon, CheckCircleIcon, SpinnerIcon, NoSymbolIcon, FaceSmileIcon, ArrowUpTrayIcon, SparklesIcon } from '../icons.tsx';
import * as api from '../../firebase/service.ts';

interface RegisterViewProps {
  onRegister: (newAttendee: Omit<Attendee, 'id' | 'status' | 'eventId' | 'createdAt'>, supplierId?: string) => Promise<void>;
  setError: (message: string) => void;
  sectors: Sector[];
  suppliers?: Supplier[];
  predefinedSector?: string | string[];
  eventName?: string;
  supplierName?: string;
  supplierInfo?: { data: Supplier & { eventId: string } };
  currentEventId?: string;
  allowPhotoChange?: boolean;
  allowGuestUploads?: boolean;
  eventType?: EventType;
}

const RegisterView: React.FC<RegisterViewProps> = (props) => {
  const { onRegister, setError, sectors, suppliers = [], predefinedSector, eventName, supplierInfo, currentEventId, allowPhotoChange = true, allowGuestUploads = false, eventType = 'CREDENTIALING' } = props;
  const { t } = useTranslation();
  const isVip = eventType === 'VIP_LIST';

  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [age, setAge] = useState('');
  const [sector, setSector] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [subCompany, setSubCompany] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingCpf, setIsCheckingCpf] = useState(false);
  const [cpfCheckMessage, setCpfCheckMessage] = useState('');
  const [existingAttendeeFound, setExistingAttendeeFound] = useState(false);
  const [isPhotoLocked, setIsPhotoLocked] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const isAdminView = !predefinedSector;

  useEffect(() => {
    if (isVip && sectors.length > 0 && !sector) {
      setSector(sectors[0].id);
    }
  }, [sectors, isVip, sector]);

  const handleCpfBlur = async () => {
    const rawCpf = cpf.replace(/\D/g, '');
    if (rawCpf.length !== 11) return;

    setIsCheckingCpf(true);
    setCpfCheckMessage(t('register.checkingCpf'));
    
    try {
        const activeEventId = isAdminView ? currentEventId : supplierInfo?.data.eventId;
        const existingAttendee = await api.findAttendeeByCpf(rawCpf, activeEventId);
        
        if (existingAttendee) {
            setName(existingAttendee.name);
            setEmail(existingAttendee.email || '');
            setAge(existingAttendee.age ? String(existingAttendee.age) : '');
            setPhoto(existingAttendee.photo);
            if (activeEventId && existingAttendee.eventId === activeEventId) {
              setCpfCheckMessage(t('register.cpfAlreadyRegistered'));
              setExistingAttendeeFound(true);
              setIsPhotoLocked(true); 
            } else {
              setCpfCheckMessage(t('register.cpfFound'));
              setExistingAttendeeFound(false); 
              if (!allowPhotoChange) setIsPhotoLocked(true);
            }
        } else {
            setCpfCheckMessage(t('register.cpfNotFound'));
            setExistingAttendeeFound(false);
        }
    } finally {
        setIsCheckingCpf(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawCpf = cpf.replace(/\D/g, '');
    if (!name || !rawCpf || !photo || (isVip && !email)) {
      setError(t('register.errors.allFields'));
      return;
    }
    setIsSubmitting(true);
    try {
      await onRegister({ 
          name, cpf: rawCpf, email: email.trim(), 
          age: age ? parseInt(age) : undefined,
          photo, sectors: [sector], subCompany 
      }, isAdminView ? selectedSupplierId : undefined);
      setName(''); setCpf(''); setEmail(''); setAge(''); setPhoto(null); setSubCompany('');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 5000);
    } catch (error: any) {
      setError(error.message || "Falha ao registrar.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCPF = (value: string) => value.replace(/\D/g, '').slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');

  if (isVip) {
      return (
          <div className="w-full max-w-5xl mx-auto">
              <div className="bg-neutral-900 border border-white/10 rounded-[2.5rem] overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.8)] relative">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-rose-600/10 blur-[100px] pointer-events-none"></div>
                  <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-500/10 blur-[100px] pointer-events-none"></div>

                  <div className="grid grid-cols-1 md:grid-cols-12 items-center">
                      <div className="md:col-span-5 p-8 bg-black/40 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-white/5">
                          <div className="w-full max-w-[280px]">
                              <div className="mb-6 text-center">
                                  <span className="text-[10px] font-black uppercase tracking-[0.4em] text-rose-500 mb-1 block">Bio-Identidade</span>
                                  <h3 className="text-white font-bold text-lg">Snapshot VIP</h3>
                              </div>
                              <WebcamCapture onCapture={setPhoto} capturedImage={photo} disabled={isSubmitting || isPhotoLocked} allowUpload={isAdminView || allowGuestUploads} />
                              {isPhotoLocked && <p className="text-[9px] font-black uppercase tracking-widest mt-4 text-neutral-500 text-center">Foto Validada</p>}
                          </div>
                      </div>

                      <div className="md:col-span-7 p-10 md:p-12">
                          <header className="mb-10">
                              <h2 className="text-3xl font-black text-white uppercase tracking-tighter leading-none mb-2">
                                  Acesso <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-amber-400">Exclusivo</span>
                              </h2>
                              <p className="text-neutral-500 text-xs font-bold tracking-widest uppercase">{eventName}</p>
                          </header>

                          <form onSubmit={handleRegisterSubmit} className="space-y-8">
                              <div className="space-y-6">
                                  <div className="relative group">
                                      <input type="text" value={cpf} onChange={(e) => setCpf(formatCPF(e.target.value))} onBlur={handleCpfBlur} className="w-full bg-transparent border-b border-neutral-800 py-3 text-white focus:outline-none focus:border-rose-500 transition-all font-bold placeholder:text-neutral-800 text-lg" placeholder="000.000.000-00" required disabled={isSubmitting} />
                                      <label className="absolute -top-4 left-0 text-[10px] font-black uppercase tracking-widest text-neutral-600">Documento (CPF)</label>
                                      {cpfCheckMessage && <p className="text-[10px] font-black text-rose-500/80 mt-2 uppercase tracking-widest">{cpfCheckMessage}</p>}
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                      <div className="md:col-span-3 relative group">
                                          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-transparent border-b border-neutral-800 py-3 text-white focus:outline-none focus:border-rose-500 transition-all font-bold placeholder:text-neutral-800 text-lg" placeholder="NOME COMPLETO" required disabled={isSubmitting || existingAttendeeFound} />
                                          <label className="absolute -top-4 left-0 text-[10px] font-black uppercase tracking-widest text-neutral-600">Convidado</label>
                                      </div>
                                      <div className="relative group">
                                          <input type="number" value={age} onChange={(e) => setAge(e.target.value)} className="w-full bg-transparent border-b border-neutral-800 py-3 text-white focus:outline-none focus:border-rose-500 transition-all font-bold placeholder:text-neutral-800 text-lg" placeholder="--" required disabled={isSubmitting || existingAttendeeFound} />
                                          <label className="absolute -top-4 left-0 text-[10px] font-black uppercase tracking-widest text-neutral-600">Idade</label>
                                      </div>
                                  </div>
                                  <div className="relative group">
                                      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-transparent border-b border-neutral-800 py-3 text-white focus:outline-none focus:border-rose-500 transition-all font-bold placeholder:text-neutral-800 text-lg" placeholder="EXEMPLO@EMAIL.COM" required disabled={isSubmitting || existingAttendeeFound} />
                                      <label className="absolute -top-4 left-0 text-[10px] font-black uppercase tracking-widest text-neutral-600">E-mail Exclusive</label>
                                  </div>
                                  {isAdminView && (
                                    <div className="relative group">
                                        <select value={selectedSupplierId} onChange={(e) => setSelectedSupplierId(e.target.value)} className="w-full bg-transparent border-b border-neutral-800 py-3 text-white focus:outline-none focus:border-rose-500 transition-all font-bold appearance-none cursor-pointer text-sm" required disabled={isSubmitting || existingAttendeeFound}>
                                            <option value="" className="bg-neutral-900">SELECIONE A PROMOTER</option>
                                            {suppliers.map(s => <option key={s.id} value={s.id} className="bg-neutral-900">{s.name}</option>)}
                                        </select>
                                        <label className="absolute -top-4 left-0 text-[10px] font-black uppercase tracking-widest text-neutral-600">Host Responsável</label>
                                    </div>
                                  )}
                              </div>
                              <button type="submit" disabled={isSubmitting || existingAttendeeFound || !photo} className="w-full bg-white text-black font-black uppercase tracking-[0.3em] text-[11px] py-6 rounded-2xl transition-all hover:scale-[1.02] shadow-2xl disabled:bg-neutral-800">
                                  {isSubmitting ? "Garantindo Vaga..." : "Confirmar Presença VIP"}
                              </button>
                          </form>
                      </div>
                  </div>
              </div>
          </div>
      );
  }

  return (
    <div className="w-full max-w-4xl mx-auto bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-gray-700">
        <div className="text-center mb-10"><h2 className="text-3xl font-bold text-white tracking-tight">{t('register.title')}</h2></div>
        <form onSubmit={handleRegisterSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-6">
                <input type="text" value={cpf} onChange={(e) => setCpf(formatCPF(e.target.value))} onBlur={handleCpfBlur} className="w-full bg-gray-900 border border-gray-700 rounded-xl py-3 px-4 text-white" placeholder={t('register.form.cpfLabel')} />
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl py-3 px-4 text-white" placeholder={t('register.form.nameLabel')} disabled={existingAttendeeFound} />
                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-xl">{isSubmitting ? "Enviando..." : t('register.form.button')}</button>
            </div>
            <div className="flex justify-center"><WebcamCapture onCapture={setPhoto} capturedImage={photo} disabled={isSubmitting} allowUpload={allowGuestUploads} /></div>
        </form>
    </div>
  );
};

export default RegisterView;
