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
    if (!name || !rawCpf || !photo) {
      setError(t('register.errors.allFields'));
      return;
    }
    setIsSubmitting(true);
    try {
      await onRegister({ name, cpf: rawCpf, email: email.trim(), photo, sectors: [sector], subCompany }, isAdminView ? selectedSupplierId : undefined);
      setName(''); setCpf(''); setEmail(''); setPhoto(null); setSubCompany('');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 5000);
    } catch (error: any) {
      setError(error.message || "Falha ao registrar.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCPF = (value: string) => value.replace(/\D/g, '').slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');

  // --- VIP COMPACTO (ADMIN) ---
  if (isVip && isAdminView) {
      return (
          <div className="w-full max-w-6xl mx-auto bg-neutral-900/80 backdrop-blur-3xl rounded-[2.5rem] border border-white/5 overflow-hidden shadow-2xl relative">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-600 via-amber-400 to-rose-600"></div>
              <div className="p-8 md:p-12">
                  <header className="mb-10 flex items-center justify-between">
                      <div>
                          <span className="text-[10px] font-black uppercase tracking-[0.5em] text-rose-500 mb-1 block">Internal Access</span>
                          <h2 className="text-3xl font-black text-white tracking-tighter uppercase leading-none">Inclusão Manual <span className="text-neutral-500">VIP</span></h2>
                      </div>
                      <SparklesIcon className="w-8 h-8 text-neutral-800" />
                  </header>

                  <form onSubmit={handleRegisterSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                      <div className="lg:col-span-3 flex justify-center">
                          <div className="w-full max-w-[220px]">
                            <WebcamCapture onCapture={setPhoto} capturedImage={photo} disabled={isSubmitting || isPhotoLocked} allowUpload={allowGuestUploads} />
                            {isPhotoLocked && <p className="text-[8px] font-black uppercase tracking-widest text-center mt-3 text-neutral-600">Foto Travada</p>}
                          </div>
                      </div>

                      <div className="lg:col-span-9 grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
                          <div className="relative group">
                              <input type="text" value={cpf} onChange={(e) => setCpf(formatCPF(e.target.value))} onBlur={handleCpfBlur} className="w-full bg-transparent border-b border-neutral-800 py-3 text-white focus:outline-none focus:border-rose-500 transition-all font-bold placeholder:text-neutral-800 text-lg" placeholder="000.000.000-00" required disabled={isSubmitting} />
                              <label className="absolute -top-4 left-0 text-[10px] font-black uppercase tracking-widest text-neutral-600">Documento (CPF)</label>
                              {cpfCheckMessage && <p className="text-[9px] font-black text-rose-500/80 mt-1 uppercase tracking-widest">{cpfCheckMessage}</p>}
                          </div>
                          <div className="relative group">
                              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-transparent border-b border-neutral-800 py-3 text-white focus:outline-none focus:border-rose-500 transition-all font-bold placeholder:text-neutral-800 text-lg" placeholder="NOME DO CONVIDADO" required disabled={isSubmitting || existingAttendeeFound} />
                              <label className="absolute -top-4 left-0 text-[10px] font-black uppercase tracking-widest text-neutral-600">Perfil</label>
                          </div>
                          <div className="relative group">
                              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-transparent border-b border-neutral-800 py-3 text-white focus:outline-none focus:border-rose-500 transition-all font-bold placeholder:text-neutral-800" placeholder="E-MAIL DE CONTATO" required disabled={isSubmitting || existingAttendeeFound} />
                              <label className="absolute -top-4 left-0 text-[10px] font-black uppercase tracking-widest text-neutral-600">Contato</label>
                          </div>
                          <div className="relative group">
                              <select value={selectedSupplierId} onChange={(e) => setSelectedSupplierId(e.target.value)} className="w-full bg-transparent border-b border-neutral-800 py-3 text-white focus:outline-none focus:border-rose-500 transition-all font-bold appearance-none cursor-pointer" required disabled={isSubmitting || existingAttendeeFound}>
                                  <option value="" className="bg-neutral-900">SELECIONE A PROMOTER</option>
                                  {suppliers.map(s => <option key={s.id} value={s.id} className="bg-neutral-900">{s.name.toUpperCase()}</option>)}
                              </select>
                              <label className="absolute -top-4 left-0 text-[10px] font-black uppercase tracking-widest text-neutral-600">Responsável</label>
                          </div>
                          <div className="relative group">
                              <input type="text" value={subCompany} onChange={(e) => setSubCompany(e.target.value)} className="w-full bg-transparent border-b border-neutral-800 py-3 text-white focus:outline-none focus:border-rose-500 transition-all font-bold placeholder:text-neutral-800" placeholder="EX: CAMAROTE / MESA 10" disabled={isSubmitting || existingAttendeeFound} />
                              <label className="absolute -top-4 left-0 text-[10px] font-black uppercase tracking-widest text-neutral-600">Localização / Grupo</label>
                          </div>
                          <div className="flex items-end">
                              <button type="submit" disabled={isSubmitting || existingAttendeeFound || !photo} className="w-full bg-white text-black font-black uppercase tracking-[0.3em] text-[11px] py-4 rounded-xl transition-all hover:bg-neutral-200 active:scale-95 disabled:bg-neutral-800 disabled:text-neutral-600 shadow-2xl">
                                  {isSubmitting ? "Processando..." : "Confirmar Convidado"}
                              </button>
                          </div>
                      </div>
                  </form>
              </div>
              {showSuccess && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                    <div className="max-w-sm w-full bg-neutral-900 border border-white/10 rounded-[3rem] p-10 text-center shadow-2xl">
                        <CheckCircleIcon className="w-16 h-16 text-rose-600 mx-auto mb-6" />
                        <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Vaga Garantida</h3>
                        <p className="text-neutral-500 text-sm mt-2 mb-8">O convidado foi inserido na lista VIP com sucesso.</p>
                        <button onClick={() => setShowSuccess(false)} className="w-full py-4 bg-white text-black font-black uppercase tracking-widest text-[10px] rounded-2xl">OK</button>
                    </div>
                </div>
              )}
          </div>
      );
  }

  // --- MODO PÚBLICO OU CREDENCIAMENTO (MANTÉM ESTILO ANTERIOR) ---
  return (
    <div className="w-full max-w-4xl mx-auto bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-gray-700">
        <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-white tracking-tight">{t('register.title')}</h2>
            {eventName && <p className="text-lg font-medium text-gray-400 mt-1 uppercase tracking-widest">{eventName}</p>}
        </div>
        <form onSubmit={handleRegisterSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
            <div className="space-y-6">
                <div className="space-y-4">
                    <input type="text" value={cpf} onChange={(e) => setCpf(formatCPF(e.target.value))} onBlur={handleCpfBlur} className="w-full bg-gray-900 border border-gray-700 rounded-xl py-3 px-4 text-white font-bold" placeholder={t('register.form.cpfLabel')} />
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl py-3 px-4 text-white" placeholder={t('register.form.nameLabel')} disabled={existingAttendeeFound} />
                    {isVip && <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl py-3 px-4 text-white" placeholder={t('register.form.emailLabel')} disabled={existingAttendeeFound} />}
                </div>
                <button type="submit" disabled={isSubmitting || existingAttendeeFound || !photo} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl transition-all shadow-xl disabled:bg-gray-700">
                    {isSubmitting ? "Enviando..." : t('register.form.button')}
                </button>
            </div>
            <div className="flex justify-center">
                <WebcamCapture onCapture={setPhoto} capturedImage={photo} disabled={isSubmitting || isPhotoLocked} allowUpload={allowGuestUploads} />
            </div>
        </form>
    </div>
  );
};

export default RegisterView;