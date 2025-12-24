import React, { useState, useEffect, useMemo } from 'react';
import { Attendee, Sector, Supplier, SubCompany, EventType } from '../../types.ts';
import WebcamCapture from '../WebcamCapture.tsx';
import { useTranslation } from '../../hooks/useTranslation.tsx';
import { UsersIcon, CheckCircleIcon, SpinnerIcon, NoSymbolIcon, FaceSmileIcon } from '../icons.tsx';
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

const RegisterView: React.FC<RegisterViewProps> = ({ onRegister, setError, sectors, suppliers = [], predefinedSector, eventName, supplierName, supplierInfo, currentEventId, allowPhotoChange = true, allowGuestUploads = false, eventType = 'CREDENTIALING' }) => {
  const { t } = useTranslation();
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
  const [blockedWarning, setBlockedWarning] = useState<string | null>(null);
  const [blockedInfo, setBlockedInfo] = useState<{ reason: string, eventName: string } | null>(null);
  
  const isVip = eventType === 'VIP_LIST';
  const isSupplierWithMultipleSectors = Array.isArray(predefinedSector);
  const isSupplierWithSingleSector = typeof predefinedSector === 'string';
  const isAdminView = !predefinedSector; // True if it's the main admin view, not a supplier link
  const hasSubCompanies = Array.isArray(supplierInfo?.data.subCompanies) && supplierInfo!.data.subCompanies!.length > 0;

  const selectedSupplier = useMemo(() => {
    if (!isAdminView || !selectedSupplierId) return null;
    return suppliers.find(s => s.id === selectedSupplierId);
  }, [isAdminView, selectedSupplierId, suppliers]);


  useEffect(() => {
    if (hasSubCompanies) {
      setSector('');
      setSubCompany(''); 
    } else {
      let initialSector = '';
      if (isSupplierWithSingleSector) {
        initialSector = predefinedSector as string;
      } else if (isSupplierWithMultipleSectors) {
        const availableSectors = sectors.filter(s => (predefinedSector as string[]).includes(s.id));
        initialSector = availableSectors.length > 0 ? availableSectors[0].id : '';
      } else if (isVip && sectors.length > 0) {
        initialSector = sectors[0].id;
      }
      setSector(initialSector);
    }
  }, [predefinedSector, isSupplierWithSingleSector, isSupplierWithMultipleSectors, sectors, hasSubCompanies, isVip]);

  useEffect(() => {
    if (subCompany) {
      let selectedSubCompanyConfig: SubCompany | undefined;
      if (hasSubCompanies) {
          selectedSubCompanyConfig = supplierInfo?.data.subCompanies?.find(sc => sc.name === subCompany);
      } 
      else if (isAdminView) {
          const supplierHasSubCompanies = selectedSupplier?.subCompanies && selectedSupplier.subCompanies.length > 0;
          if (supplierHasSubCompanies) {
            selectedSubCompanyConfig = selectedSupplier?.subCompanies?.find(sc => sc.name === subCompany);
          }
      }
      
      if (selectedSubCompanyConfig) {
        setSector(selectedSubCompanyConfig.sector);
      }
    }
  }, [subCompany, hasSubCompanies, supplierInfo, isAdminView, selectedSupplier]);
  
  useEffect(() => {
    if (isAdminView) {
      setSubCompany('');
      setSector(isVip && sectors.length > 0 ? sectors[0].id : '');
    }
  }, [selectedSupplierId, isAdminView, isVip, sectors]);


  const clearForm = () => {
    setName('');
    setCpf('');
    setEmail('');
    setPhoto(null);
    setCpfCheckMessage('');
    setExistingAttendeeFound(false);
    setIsPhotoLocked(false);
    setBlockedWarning(null);
    setBlockedInfo(null);
    if (hasSubCompanies) {
      setSubCompany('');
      setSector('');
    }
    else if (!predefinedSector) { // Admin View
      setSector(isVip && sectors.length > 0 ? sectors[0].id : '');
      setSubCompany('');
    } else if (isSupplierWithMultipleSectors) {
      const availableSectors = sectors.filter(s => (predefinedSector as string[]).includes(s.id));
      setSector(availableSectors.length > 0 ? availableSectors[0].id : '');
    }
  };

  const formatCPF = (value: string) => {
    return value
      .replace(/\D/g, '') 
      .slice(0, 11) 
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  };

  const handleCpfBlur = async () => {
    const rawCpf = cpf.replace(/\D/g, '');
    if (rawCpf.length !== 11) {
        setCpfCheckMessage('');
        return;
    }

    setIsCheckingCpf(true);
    setCpfCheckMessage(t('register.checkingCpf'));
    setPhoto(null);
    setName('');
    setExistingAttendeeFound(false);
    setIsPhotoLocked(false);
    setBlockedWarning(null);
    setBlockedInfo(null);

    try {
        const blockInfo = await api.checkBlockedStatus(rawCpf);
        if (blockInfo) {
           setBlockedInfo(blockInfo);
           if (isAdminView) {
               setBlockedWarning(`⚠️ ATENÇÃO: Este CPF consta como BLOQUEADO no evento "${blockInfo.eventName}". Motivo: ${blockInfo.reason || 'Não informado'}.`);
           }
        }

        const activeEventId = isAdminView ? currentEventId : supplierInfo?.data.eventId;
        
        const existingAttendee = await api.findAttendeeByCpf(rawCpf, activeEventId);
        
        if (existingAttendee) {
            setName(existingAttendee.name);
            setPhoto(existingAttendee.photo);
            if (existingAttendee.email) setEmail(existingAttendee.email);
            
            const isRegisteredInCurrentEvent = activeEventId && existingAttendee.eventId === activeEventId;

            if (isRegisteredInCurrentEvent) {
              setCpfCheckMessage(t('register.cpfAlreadyRegistered'));
              setExistingAttendeeFound(true);
              setIsPhotoLocked(true); 
            } else {
              setCpfCheckMessage(t('register.cpfFound'));
              setExistingAttendeeFound(false); 
              
              if (!allowPhotoChange) {
                 setIsPhotoLocked(true);
              }
            }
        } else {
            setCpfCheckMessage(t('register.cpfNotFound'));
        }
    } catch (error: any) {
        console.error("Error checking CPF:", error);
        let errorMessage = t('register.errors.cpfCheckError');
        setError(errorMessage);
        setCpfCheckMessage('');
    } finally {
        setIsCheckingCpf(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawCpf = cpf.replace(/\D/g, '');

    let finalSector = sector;
    if (isVip && !sector && sectors.length > 0) {
        finalSector = sectors[0].id;
    }

    if (!name || !rawCpf || !photo || (isVip && !email) || (!finalSector && !hasSubCompanies && !isAdminView && !isVip)) {
      setError(t('register.errors.allFields'));
      return;
    }
    if (rawCpf.length !== 11) {
      setError(t('register.errors.invalidCpf'));
      return;
    }
    if (isAdminView && !selectedSupplierId) {
        setError(isVip ? "Selecione a divulgadora responsável." : "Selecione um fornecedor para continuar.");
        return;
    }

    setIsSubmitting(true);
    setShowSuccess(false);
    try {
      const attendeeData: Omit<Attendee, 'id' | 'status' | 'eventId' | 'createdAt'> = { 
          name, 
          cpf: rawCpf, 
          email: isVip ? email : undefined,
          photo, 
          sectors: [finalSector],
          ...(subCompany && { subCompany })
      };

      if (!isAdminView && blockedInfo) {
          attendeeData.blockReason = `⚠️ Bloqueio Prévio [${blockedInfo.eventName}]: ${blockedInfo.reason}`;
      }

      await onRegister(attendeeData, isAdminView ? selectedSupplierId : undefined);
      clearForm();
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 4000);
    } catch (error: any) {
      console.error("Registration failed:", error);
      setError(error.message || "Falha ao registrar.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // -------------------------------------------------------------------------
  // VIP VIEW (GUEST MODE)
  // -------------------------------------------------------------------------
  if (isVip) {
    return (
      <div className="w-full max-w-5xl mx-auto px-4 py-8">
        <div className="bg-neutral-900/40 backdrop-blur-3xl p-8 md:p-12 rounded-[3rem] shadow-[0_25px_80px_rgba(0,0,0,0.4)] border border-neutral-800/50">
          <div className="text-center mb-12">
            <div className="w-24 h-24 mx-auto mb-8 rounded-[2rem] bg-gradient-to-br from-rose-500 to-amber-600 flex items-center justify-center shadow-2xl shadow-rose-500/20 transform -rotate-3">
              <FaceSmileIcon className="w-12 h-12 text-white" />
            </div>
            <h2 className="text-5xl font-black text-white tracking-tighter leading-none mb-6">
              Exclusive VIP List
            </h2>
            <div className="h-1 w-20 bg-rose-500 mx-auto rounded-full mb-6"></div>
            {eventName && <p className="text-rose-400 font-bold uppercase tracking-[0.4em] text-xs">{eventName}</p>}
            {supplierName && <p className="text-neutral-500 text-[10px] mt-4 font-black uppercase tracking-widest italic">Host: {supplierName}</p>}
          </div>

          <form onSubmit={handleRegisterSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            <div className="space-y-10">
              <div className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-3 ml-1 transition-colors group-focus-within:text-rose-400">Nome do Convidado</label>
                  <input
                    type="text" id="name" value={name} onChange={(e) => setName(e.target.value)}
                    className="w-full bg-neutral-950/50 border border-neutral-800/80 rounded-2xl py-4 px-6 text-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 transition-all placeholder:text-neutral-800 text-lg font-bold"
                    placeholder="Digite seu nome completo"
                    disabled={isSubmitting || isCheckingCpf || existingAttendeeFound}
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-3 ml-1">E-mail de Contato</label>
                  <input
                    type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-neutral-950/50 border border-neutral-800/80 rounded-2xl py-4 px-6 text-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 transition-all placeholder:text-neutral-800 text-lg font-bold"
                    placeholder="exemplo@email.com"
                    disabled={isSubmitting || isCheckingCpf || existingAttendeeFound}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="cpf" className="block text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-3 ml-1">Documento (CPF)</label>
                    <input
                      type="text" id="cpf" value={cpf} onChange={(e) => setCpf(formatCPF(e.target.value))}
                      onBlur={handleCpfBlur}
                      className="w-full bg-neutral-950/50 border border-neutral-800/80 rounded-2xl py-4 px-6 text-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 transition-all placeholder:text-neutral-800 text-lg font-bold"
                      placeholder="000.000.000-00"
                      disabled={isSubmitting || isCheckingCpf}
                    />
                  </div>
                  {isAdminView && (
                    <div>
                      <label htmlFor="supplier" className="block text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-3 ml-1">Divulgadora</label>
                      <select
                        id="supplier" value={selectedSupplierId} onChange={(e) => setSelectedSupplierId(e.target.value)}
                        className="w-full bg-neutral-950/50 border border-neutral-800/80 rounded-2xl py-4 px-6 text-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 transition-all"
                        disabled={isSubmitting || isCheckingCpf || existingAttendeeFound}
                        required
                      >
                        <option value="">Selecione...</option>
                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                {isAdminView && !selectedSupplier?.subCompanies?.length ? (
                    <div>
                        <label htmlFor="sub" className="block text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-3 ml-1">Grupo / Organização (Opcional)</label>
                        <input
                            type="text" id="sub" value={subCompany} onChange={(e) => setSubCompany(e.target.value)}
                            className="w-full bg-neutral-950/50 border border-neutral-800/80 rounded-2xl py-4 px-6 text-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 transition-all placeholder:text-neutral-800"
                            placeholder="Nome do grupo"
                            disabled={isSubmitting || isCheckingCpf || existingAttendeeFound}
                        />
                    </div>
                ) : (
                    (hasSubCompanies || (selectedSupplier?.subCompanies && selectedSupplier.subCompanies.length > 0)) && (
                        <div>
                            <label htmlFor="sub-sel" className="block text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-3 ml-1">Grupo / Empresa</label>
                            <select
                                id="sub-sel" value={subCompany} onChange={(e) => setSubCompany(e.target.value)}
                                className="w-full bg-neutral-950/50 border border-neutral-800/80 rounded-2xl py-4 px-6 text-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 transition-all"
                                disabled={isSubmitting || isCheckingCpf || existingAttendeeFound}
                                required
                            >
                                <option value="">Selecione o grupo...</option>
                                {(supplierInfo?.data.subCompanies || selectedSupplier?.subCompanies)?.map(sc => <option key={sc.name} value={sc.name}>{sc.name}</option>)}
                            </select>
                        </div>
                    )
                )}
              </div>

              {cpfCheckMessage && (
                  <div className={`p-4 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 ${existingAttendeeFound ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-green-500/10 text-green-500 border border-green-500/20'}`}>
                      {isCheckingCpf ? <SpinnerIcon className="w-4 h-4" /> : <CheckCircleIcon className="w-4 h-4" />}
                      {cpfCheckMessage}
                  </div>
              )}

              {blockedWarning && (
                  <div className="p-5 bg-red-950/30 border border-red-500/50 rounded-2xl text-red-200 text-[10px] font-bold uppercase tracking-wider shadow-2xl animate-pulse">
                      <NoSymbolIcon className="w-6 h-6 mb-2 text-red-500" />
                      {blockedWarning}
                  </div>
              )}

              <div className="pt-4">
                <button 
                  type="submit" 
                  className="group relative w-full overflow-hidden rounded-[2rem] p-px transition-all duration-500 hover:scale-[1.02] active:scale-95 disabled:grayscale"
                  disabled={!name || !cpf || !photo || !email || isSubmitting || isCheckingCpf || existingAttendeeFound}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-rose-600 via-amber-600 to-rose-600 animate-gradient-x"></div>
                  <div className="relative flex items-center justify-center gap-4 bg-neutral-950/90 rounded-[2rem] py-6 px-10 text-white font-black uppercase tracking-[0.2em] text-xs">
                    {isSubmitting ? (
                        <>
                            <SpinnerIcon className="w-5 h-5" />
                            RESERVANDO...
                        </>
                    ) : (
                        <>
                            <CheckCircleIcon className="w-5 h-5 text-rose-500"/>
                            SOLICITAR ACESSO VIP
                        </>
                    )}
                  </div>
                </button>
              </div>
            </div>

            <div className="flex flex-col items-center">
              <div className="relative group w-full max-w-sm">
                <div className="absolute -inset-2 rounded-[3.5rem] bg-gradient-to-tr from-rose-600 to-amber-400 opacity-20 blur-2xl group-hover:opacity-40 transition-opacity duration-700"></div>
                <div className="relative bg-neutral-900 rounded-[3rem] p-3 border border-neutral-800/50 overflow-hidden shadow-2xl">
                    <WebcamCapture 
                        onCapture={setPhoto} 
                        capturedImage={photo} 
                        disabled={isSubmitting || isCheckingCpf || isPhotoLocked} 
                        allowUpload={isAdminView || allowGuestUploads} 
                    />
                </div>
              </div>
              {isPhotoLocked && (
                <p className="text-[10px] font-black uppercase tracking-widest mt-10 text-neutral-500 text-center px-10 leading-relaxed max-w-xs">
                  {existingAttendeeFound ? "Sua identidade já está validada para este evento." : "Foto de segurança restaurada. Mudanças indisponíveis."}
                </p>
              )}
            </div>
          </form>
          
          {showSuccess && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-sm animate-in fade-in duration-500">
                <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-[3rem] p-10 text-center shadow-[0_50px_100px_rgba(0,0,0,0.8)]">
                    <div className="w-20 h-20 bg-rose-600 rounded-full mx-auto mb-8 flex items-center justify-center animate-bounce">
                        <CheckCircleIcon className="w-10 h-10 text-white" />
                    </div>
                    <h3 className="text-3xl font-black text-white mb-4 uppercase tracking-tighter">Confirmado!</h3>
                    <p className="text-neutral-400 text-sm leading-relaxed mb-8">Sua vaga na lista VIP foi reservada com sucesso. Prepare seu documento para a entrada.</p>
                    <button onClick={() => setShowSuccess(false)} className="w-full py-4 bg-white text-black font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-neutral-200 transition-all">Fechar</button>
                </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // COLLABORATOR VIEW (CREDENTIALING MODE)
  // -------------------------------------------------------------------------
  return (
    <div className="w-full max-w-4xl mx-auto space-y-10">
      <div className="bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-gray-700">
        <div className="text-center mb-6">
            <h2 className="text-3xl font-bold text-white flex items-center justify-center gap-3">
              <UsersIcon className="w-8 h-8"/>
              {t('register.title')}
            </h2>
            {eventName && <p className="text-lg font-medium text-gray-400 mt-1">{eventName}</p>}
            {supplierName && <p className="text-md font-medium text-gray-400">{t('supplierAdmin.supplier')} {supplierName}</p>}
        </div>

        <form onSubmit={handleRegisterSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <div className="space-y-6">
            <div>
              <label htmlFor="cpf" className="block text-sm font-medium text-gray-300 mb-1">{t('register.form.cpfLabel')}</label>
              <input
                type="text" id="cpf" value={cpf} onChange={(e) => setCpf(formatCPF(e.target.value))}
                onBlur={handleCpfBlur}
                className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder={t('register.form.cpfPlaceholder')}
                disabled={isSubmitting || isCheckingCpf}
              />
              {cpfCheckMessage && (
                  <p className={`text-sm mt-1 flex items-center gap-2 ${existingAttendeeFound ? 'text-yellow-400' : 'text-green-400'}`}>
                      {isCheckingCpf && <SpinnerIcon className="w-4 h-4" />}
                      {cpfCheckMessage}
                  </p>
              )}
               {blockedWarning && (
                  <div className="mt-2 p-3 bg-red-900/50 border border-red-500 rounded-md flex items-start gap-2 text-red-200 text-sm">
                      <NoSymbolIcon className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
                      <span>{blockedWarning}</span>
                  </div>
              )}
            </div>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">{t('register.form.nameLabel')}</label>
              <input
                type="text" id="name" value={name} onChange={(e) => setName(e.target.value)}
                className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder={t('register.form.namePlaceholder')}
                disabled={isSubmitting || isCheckingCpf || existingAttendeeFound}
              />
            </div>

            {isAdminView && (
              <div>
                <label htmlFor="supplier" className="block text-sm font-medium text-gray-300 mb-1">{t('register.form.supplierLabel')} <span className="text-red-500">*</span></label>
                <select
                  id="supplier"
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  disabled={isSubmitting || isCheckingCpf || existingAttendeeFound}
                  required
                >
                  <option value="">{t('register.form.supplierPlaceholder')}</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
            
            {/* Sub-companies / Sectors for Collaborators */}
            {(hasSubCompanies || (selectedSupplier?.subCompanies && selectedSupplier.subCompanies.length > 0)) ? (
                <div>
                    <label htmlFor="sub" className="block text-sm font-medium text-gray-300 mb-1">{t('register.form.subCompanyLabel')}</label>
                    <select
                        id="sub" value={subCompany} onChange={(e) => setSubCompany(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        disabled={isSubmitting || isCheckingCpf || existingAttendeeFound}
                        required
                    >
                        <option value="">{t('register.form.subCompanyPlaceholder')}</option>
                        {(supplierInfo?.data.subCompanies || selectedSupplier?.subCompanies)?.map(sc => <option key={sc.name} value={sc.name}>{sc.name}</option>)}
                    </select>
                </div>
            ) : (
                !isSupplierWithSingleSector && (
                    <div>
                        <label htmlFor="sector" className="block text-sm font-medium text-gray-300 mb-1">{t('register.form.sectorLabel')}</label>
                        <select
                            id="sector" value={sector} onChange={(e) => setSector(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            disabled={isSubmitting || isCheckingCpf || existingAttendeeFound}
                        >
                            <option value="" disabled>{t('register.form.sectorPlaceholder')}</option>
                            {sectors.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                    </div>
                )
            )}

            <div className="space-y-4">
                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 disabled:bg-gray-500" disabled={!name || !cpf || !photo || (!sector && !subCompany && !isAdminView) || isSubmitting || isCheckingCpf || existingAttendeeFound}>
                  {isSubmitting ? (
                    <>
                      <SpinnerIcon className="w-5 h-5" />
                      Registrando...
                    </>
                  ) : (
                    <>
                      <CheckCircleIcon className="w-5 h-5"/>
                      {t('register.form.button')}
                    </>
                  )}
                </button>
                 {showSuccess && (
                    <div className="text-center p-3 rounded-lg bg-green-500/20 text-green-300 border border-green-500 flex items-center justify-center gap-2">
                        <CheckCircleIcon className="w-5 h-5" />
                        <p className="text-sm font-medium">{t('register.successMessage')}</p>
                    </div>
                )}
            </div>
          </div>
          <div className="flex flex-col items-center">
              <WebcamCapture onCapture={setPhoto} capturedImage={photo} disabled={isSubmitting || isCheckingCpf || isPhotoLocked} allowUpload={isAdminView || allowGuestUploads} />
              {isPhotoLocked && (
                <p className="text-sm mt-2 text-yellow-400 text-center px-4">
                  {existingAttendeeFound ? t('register.photoLocked') : t('register.photoLockedPolicy')}
                </p>
              )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegisterView;