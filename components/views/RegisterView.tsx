
import React, { useState, useEffect, useMemo } from 'react';
import { Attendee, Sector, Supplier, SubCompany, EventType } from '../../types.ts';
import WebcamCapture from '../WebcamCapture.tsx';
import { useTranslation } from '../../hooks/useTranslation.tsx';
import { UsersIcon, CheckCircleIcon, SpinnerIcon, NoSymbolIcon, FaceSmileIcon, ArrowUpTrayIcon } from '../icons.tsx';
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
  const { 
    onRegister, setError, sectors, suppliers = [], 
    predefinedSector, eventName, supplierName, 
    supplierInfo, currentEventId, allowPhotoChange = true, 
    allowGuestUploads = false, eventType = 'CREDENTIALING' 
  } = props;

  const { t } = useTranslation();
  const isVip = eventType === 'VIP_LIST';

  // Form State
  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
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
  const [blockedWarning, setBlockedWarning] = useState<string | null>(null);
  const [blockedInfo, setBlockedInfo] = useState<{ reason: string, eventName: string } | null>(null);

  const isAdminView = !predefinedSector;
  const hasSubCompanies = Array.isArray(supplierInfo?.data.subCompanies) && supplierInfo!.data.subCompanies!.length > 0;

  const isSupplierWithSingleSector = useMemo(() => {
    if (isAdminView) return false;
    if (typeof predefinedSector === 'string') return !!predefinedSector;
    if (Array.isArray(predefinedSector)) return predefinedSector.length === 1;
    return false;
  }, [isAdminView, predefinedSector]);

  const selectedSupplier = useMemo(() => {
    if (!isAdminView || !selectedSupplierId) return null;
    return suppliers.find(s => s.id === selectedSupplierId);
  }, [isAdminView, selectedSupplierId, suppliers]);

  // Initial Logic for Sectors
  useEffect(() => {
    if (!hasSubCompanies) {
      let initialSector = '';
      if (typeof predefinedSector === 'string') {
        initialSector = predefinedSector;
      } else if (Array.isArray(predefinedSector)) {
        const available = sectors.filter(s => (predefinedSector as string[]).includes(s.id));
        initialSector = available.length > 0 ? available[0].id : '';
      } else if (isVip && sectors.length > 0) {
        initialSector = sectors[0].id;
      }
      setSector(initialSector);
    }
  }, [predefinedSector, sectors, hasSubCompanies, isVip]);

  // Handle CPF check
  const handleCpfBlur = async () => {
    const rawCpf = cpf.replace(/\D/g, '');
    if (rawCpf.length !== 11) {
        setCpfCheckMessage('');
        return;
    }

    setIsCheckingCpf(true);
    setCpfCheckMessage(isVip ? 'Autenticando bio-identidade...' : t('register.checkingCpf'));
    setPhoto(null);
    setName('');
    setExistingAttendeeFound(false);
    setIsPhotoLocked(false);
    setBlockedWarning(null);

    try {
        const blockInfo = await api.checkBlockedStatus(rawCpf);
        if (blockInfo) {
           setBlockedInfo(blockInfo);
           if (isAdminView) {
               setBlockedWarning(`⚠️ BLOQUEADO no evento "${blockInfo.eventName}": ${blockInfo.reason}`);
           }
        }

        const activeEventId = isAdminView ? currentEventId : supplierInfo?.data.eventId;
        const existingAttendee = await api.findAttendeeByCpf(rawCpf, activeEventId);
        
        if (existingAttendee) {
            setName(existingAttendee.name);
            setPhoto(existingAttendee.photo);
            
            const isRegisteredInCurrentEvent = activeEventId && existingAttendee.eventId === activeEventId;

            if (isRegisteredInCurrentEvent) {
              setCpfCheckMessage(isVip ? 'Convidado já consta na Lista VIP.' : t('register.cpfAlreadyRegistered'));
              setExistingAttendeeFound(true);
              setIsPhotoLocked(true); 
            } else {
              setCpfCheckMessage(isVip ? 'Identidade reconhecida. Dados recuperados.' : t('register.cpfFound'));
              setExistingAttendeeFound(false); 
              if (!allowPhotoChange) setIsPhotoLocked(true);
            }
        } else {
            setCpfCheckMessage(isVip ? 'Convidado novo detectado.' : t('register.cpfNotFound'));
        }
    } catch (error: any) {
        setError(t('register.errors.cpfCheckError'));
        setCpfCheckMessage('');
    } finally {
        setIsCheckingCpf(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawCpf = cpf.replace(/\D/g, '');

    // Validation
    if (!name || !rawCpf || !photo || (!isAdminView && !isSupplierWithSingleSector && !sector)) {
      setError(t('register.errors.allFields'));
      return;
    }

    setIsSubmitting(true);
    try {
      const attendeeData: Omit<Attendee, 'id' | 'status' | 'eventId' | 'createdAt'> = { 
          name, 
          cpf: rawCpf, 
          photo, 
          sectors: [sector],
          ...(subCompany && { subCompany })
      };

      if (!isAdminView && blockedInfo) {
          attendeeData.blockReason = `Bloqueio Prévio: ${blockedInfo.reason}`;
      }

      await onRegister(attendeeData, isAdminView ? selectedSupplierId : undefined);
      
      // Clear form
      setName(''); setCpf(''); setPhoto(null);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 5000);
    } catch (error: any) {
      setError(error.message || "Falha ao registrar.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCPF = (value: string) => {
    return value.replace(/\D/g, '').slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  };

  // VIZUALIZAÇÃO VIP: COMPACTA E ELEGANTE
  if (isVip) {
    return (
      <div className="w-full max-w-5xl mx-auto">
        <div className="bg-neutral-900 border border-white/10 rounded-[2.5rem] overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.8)] relative">
            {/* Background Decor */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-rose-600/10 blur-[100px] pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-500/10 blur-[100px] pointer-events-none"></div>

            <div className="grid grid-cols-1 md:grid-cols-12 items-center">
                
                {/* Left Side: Photo */}
                <div className="md:col-span-5 p-8 bg-black/40 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-white/5">
                    <div className="w-full max-w-[280px]">
                        <div className="mb-6 text-center">
                            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-rose-500 mb-1 block">Bio-Identidade</span>
                            <h3 className="text-white font-bold text-lg">Snapshot VIP</h3>
                        </div>
                        <WebcamCapture onCapture={setPhoto} capturedImage={photo} disabled={isSubmitting || isPhotoLocked} allowUpload={isAdminView || allowGuestUploads} />
                        {isPhotoLocked && (
                            <p className="text-[9px] font-black uppercase tracking-widest mt-4 text-neutral-500 text-center">Foto Validada e Bloqueada</p>
                        )}
                    </div>
                </div>

                {/* Right Side: Form */}
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
                                <input
                                    type="text" value={cpf} onChange={(e) => setCpf(formatCPF(e.target.value))}
                                    onBlur={handleCpfBlur}
                                    className="w-full bg-transparent border-b border-neutral-800 py-3 text-white focus:outline-none focus:border-rose-500 transition-all font-bold placeholder:text-neutral-800 text-lg"
                                    placeholder="000.000.000-00"
                                    required
                                    disabled={isSubmitting}
                                />
                                <label className="absolute -top-4 left-0 text-[10px] font-black uppercase tracking-widest text-neutral-600 group-focus-within:text-rose-500 transition-colors">Identidade (CPF)</label>
                                {cpfCheckMessage && <p className="text-[10px] font-black text-rose-500/80 mt-2 uppercase tracking-widest">{cpfCheckMessage}</p>}
                            </div>

                            <div className="relative group">
                                <input
                                    type="text" value={name} onChange={(e) => setName(e.target.value)}
                                    className="w-full bg-transparent border-b border-neutral-800 py-3 text-white focus:outline-none focus:border-rose-500 transition-all font-bold placeholder:text-neutral-800 text-lg"
                                    placeholder="NOME COMPLETO"
                                    required
                                    disabled={isSubmitting || existingAttendeeFound}
                                />
                                <label className="absolute -top-4 left-0 text-[10px] font-black uppercase tracking-widest text-neutral-600 group-focus-within:text-rose-500 transition-colors">Nome do Convidado</label>
                            </div>

                            {isAdminView && (
                                <div className="relative group">
                                    <select
                                        value={selectedSupplierId} onChange={(e) => setSelectedSupplierId(e.target.value)}
                                        className="w-full bg-transparent border-b border-neutral-800 py-3 text-white focus:outline-none focus:border-rose-500 transition-all font-bold appearance-none cursor-pointer text-sm"
                                        required
                                        disabled={isSubmitting || existingAttendeeFound}
                                    >
                                        <option value="" className="bg-neutral-900">Selecione a Divulgadora / Promoter</option>
                                        {suppliers.map(s => <option key={s.id} value={s.id} className="bg-neutral-900">{s.name}</option>)}
                                    </select>
                                    <label className="absolute -top-4 left-0 text-[10px] font-black uppercase tracking-widest text-neutral-600">Host Responsável</label>
                                </div>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting || existingAttendeeFound || !photo}
                            className="w-full bg-white text-black font-black uppercase tracking-[0.3em] text-[11px] py-6 rounded-2xl transition-all hover:scale-[1.02] active:scale-95 disabled:bg-neutral-800 disabled:text-neutral-600 shadow-2xl"
                        >
                            {isSubmitting ? (
                                <div className="flex items-center justify-center gap-3">
                                    <SpinnerIcon className="w-5 h-5 animate-spin" />
                                    <span>Processando Vaga...</span>
                                </div>
                            ) : "Confirmar Presença VIP"}
                        </button>
                    </form>
                </div>
            </div>
        </div>

        {showSuccess && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-500">
             <div className="max-w-sm w-full bg-neutral-900 border border-rose-500/30 rounded-[3rem] p-10 text-center shadow-2xl">
                <div className="w-20 h-20 bg-rose-600 rounded-full mx-auto mb-6 flex items-center justify-center shadow-lg shadow-rose-600/20">
                    <CheckCircleIcon className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-2xl font-black text-white mb-2 uppercase tracking-tighter">Bem-vindo à Lista</h3>
                <p className="text-neutral-400 text-sm leading-relaxed mb-8">Sua presença VIP foi confirmada com sucesso. Aproveite o evento.</p>
                <button onClick={() => setShowSuccess(false)} className="w-full py-4 bg-white text-black font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-neutral-200 transition-all">OK</button>
             </div>
          </div>
        )}
      </div>
    );
  }

  // MODO PADRÃO: CREDENCIAMENTO
  return (
    <div className="w-full max-w-4xl mx-auto space-y-10">
      <div className="bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-gray-700">
        <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600/20 text-indigo-400 mb-4">
                <UsersIcon className="w-8 h-8"/>
            </div>
            <h2 className="text-3xl font-bold text-white tracking-tight">{t('register.title')}</h2>
            {eventName && <p className="text-lg font-medium text-gray-400 mt-1">{eventName}</p>}
            {supplierName && <p className="text-sm font-semibold text-gray-500 mt-2 uppercase tracking-widest">Equipe: {supplierName}</p>}
        </div>

        <form onSubmit={handleRegisterSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
          <div className="space-y-8">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">{t('register.form.nameLabel')}</label>
                <input
                  type="text" value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                  placeholder={t('register.form.namePlaceholder')}
                  disabled={isSubmitting || existingAttendeeFound}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">{t('register.form.cpfLabel')}</label>
                <input
                  type="text" value={cpf} onChange={(e) => setCpf(formatCPF(e.target.value))}
                  onBlur={handleCpfBlur}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                  placeholder={t('register.form.cpfPlaceholder')}
                  disabled={isSubmitting}
                />
                {cpfCheckMessage && <p className="text-[10px] font-bold text-indigo-400 mt-2 uppercase tracking-widest">{cpfCheckMessage}</p>}
              </div>

              {isAdminView && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">{t('register.form.supplierLabel')}</label>
                  <select
                    value={selectedSupplierId} onChange={(e) => setSelectedSupplierId(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all cursor-pointer"
                    disabled={isSubmitting || existingAttendeeFound}
                  >
                    <option value="">{t('register.form.supplierPlaceholder')}</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}

              {!isSupplierWithSingleSector && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">{t('register.form.sectorLabel')}</label>
                  <select
                    value={sector} onChange={(e) => setSector(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                    disabled={isSubmitting || existingAttendeeFound}
                  >
                    <option value="" disabled>{t('register.form.sectorPlaceholder')}</option>
                    {sectors.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={isSubmitting || existingAttendeeFound || !photo}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-6 rounded-xl transition-all flex items-center justify-center gap-3 disabled:bg-gray-700 disabled:text-gray-500 shadow-xl"
              >
                {isSubmitting ? <SpinnerIcon className="w-5 h-5"/> : <CheckCircleIcon className="w-5 h-5"/>}
                {t('register.form.button')}
              </button>
            </div>
          </div>

          <div className="flex flex-col items-center">
            <div className="w-full max-w-sm border-2 border-gray-700 rounded-2xl p-4 bg-gray-900/50">
              <WebcamCapture onCapture={setPhoto} capturedImage={photo} disabled={isSubmitting || isPhotoLocked} allowUpload={isAdminView || allowGuestUploads} />
              {isPhotoLocked && (
                <div className="mt-4 flex items-center gap-2 justify-center text-yellow-500">
                    <NoSymbolIcon className="w-4 h-4"/>
                    <span className="text-[10px] font-bold uppercase tracking-widest">Foto não editável</span>
                </div>
              )}
            </div>
          </div>
        </form>
      </div>

      {showSuccess && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-8 py-4 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-top-10 flex items-center gap-4">
            <CheckCircleIcon className="w-8 h-8" />
            <span className="font-bold text-lg">{t('register.successMessage')}</span>
        </div>
      )}
    </div>
  );
};

export default RegisterView;
