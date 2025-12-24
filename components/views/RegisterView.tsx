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
        // Default sector for VIP events if not defined
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

    // For VIP, if sector isn't explicitly chosen, use first available
    let finalSector = sector;
    if (isVip && !sector && sectors.length > 0) {
        finalSector = sectors[0].id;
    }

    if (!name || !rawCpf || !photo || (!finalSector && !hasSubCompanies && !isAdminView)) {
      setError(t('register.errors.allFields'));
      return;
    }
    if (rawCpf.length !== 11) {
      setError(t('register.errors.invalidCpf'));
      return;
    }
    if (isAdminView && !selectedSupplierId) {
        setError(isVip ? "Selecione a divulgadora / responsável." : "Selecione um fornecedor para continuar.");
        return;
    }

    if ((hasSubCompanies || (selectedSupplier?.subCompanies && selectedSupplier.subCompanies.length > 0)) && !subCompany) {
      setError(t('register.errors.subCompanyRequired'));
      return;
    }

    setIsSubmitting(true);
    setShowSuccess(false);
    try {
      const attendeeData: Omit<Attendee, 'id' | 'status' | 'eventId' | 'createdAt'> = { 
          name, 
          cpf: rawCpf, 
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
  
  const renderSectorInput = () => {
    // Hidden in VIP List unless multiple manual sectors are strictly needed (we simplify for elegance)
    if (isVip) return null;

    const adminHasSubCompanies = isAdminView && selectedSupplier?.subCompanies && selectedSupplier.subCompanies.length > 0;
    
    if (hasSubCompanies || adminHasSubCompanies) return null;
    
    if (isSupplierWithSingleSector) {
      return null; 
    }

    let sectorOptions = sectors;
    if (isSupplierWithMultipleSectors) {
        sectorOptions = sectors.filter(s => (predefinedSector as string[]).includes(s.id));
    }

    return (
        <div>
          <label htmlFor="sector" className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
            Tipo de Acesso
          </label>
          <select
            id="sector" value={sector} onChange={(e) => setSector(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700/50 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-50 transition-all"
            disabled={isSubmitting || isCheckingCpf || existingAttendeeFound}
          >
            {isSupplierWithMultipleSectors ? null : <option value="" disabled>Selecione o setor</option>}
            {sectorOptions.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
    );
  };
  
  const renderSubCompanyInput = () => {
    if (hasSubCompanies) {
      return (
          <div>
            <label htmlFor="subCompany" className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                {isVip ? "Grupo / Organização" : "Empresa / Unidade"}
            </label>
            <select
              id="subCompany" value={subCompany} onChange={(e) => setSubCompany(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700/50 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-pink-500/30 disabled:opacity-50 transition-all"
              disabled={isSubmitting || isCheckingCpf || existingAttendeeFound}
              required
            >
              <option value="" disabled>{isVip ? "Selecione o grupo" : "Selecione a empresa"}</option>
              {supplierInfo?.data.subCompanies?.map(sc => 
                  <option key={sc.name} value={sc.name}>
                      {sc.name}
                  </option>
              )}
            </select>
          </div>
      );
    }

    if (isAdminView) {
      const adminHasSubCompanies = selectedSupplier?.subCompanies && selectedSupplier.subCompanies.length > 0;

      if (adminHasSubCompanies) {
        return (
          <div>
            <label htmlFor="subCompany-admin" className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                {isVip ? "Grupo / Organização" : "Empresa / Unidade"}
            </label>
            <select
              id="subCompany-admin" value={subCompany} onChange={(e) => setSubCompany(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700/50 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-pink-500/30 disabled:opacity-50 transition-all"
              disabled={isSubmitting || isCheckingCpf || existingAttendeeFound}
              required
            >
              <option value="">{isVip ? "Selecione o grupo" : "Selecione a empresa"}</option>
              {selectedSupplier?.subCompanies?.map(sc => 
                  <option key={sc.name} value={sc.name}>
                      {sc.name}
                  </option>
              )}
            </select>
          </div>
        );
      } else {
        return (
          <div>
            <label htmlFor="subCompany-admin-input" className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                {isVip ? "Grupo (Opcional)" : "Empresa (Opcional)"}
            </label>
            <input
              type="text"
              id="subCompany-admin-input"
              value={subCompany}
              onChange={(e) => setSubCompany(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700/50 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-pink-500/30 disabled:opacity-50 transition-all"
              placeholder={isVip ? "Nome do grupo ou empresa" : "Digite o nome da empresa"}
              disabled={isSubmitting || isCheckingCpf || existingAttendeeFound}
            />
          </div>
        );
      }
    }
    
    return null;
  };


  return (
    <div className="w-full max-w-4xl mx-auto space-y-10">
      <div className={`bg-gray-800/40 backdrop-blur-2xl p-10 rounded-[2rem] shadow-2xl border ${isVip ? 'border-pink-500/30 shadow-pink-500/10' : 'border-gray-700/50'}`}>
        <div className="text-center mb-10">
            <div className={`w-20 h-20 mx-auto mb-6 rounded-3xl flex items-center justify-center rotate-3 group-hover:rotate-0 transition-transform duration-500 ${isVip ? 'bg-gradient-to-br from-pink-500 to-rose-600 shadow-pink-500/20 shadow-2xl' : 'bg-indigo-600/20 text-indigo-500'}`}>
                {isVip ? <FaceSmileIcon className="w-10 h-10 text-white" /> : <UsersIcon className="w-10 h-10" />}
            </div>
            <h2 className="text-4xl font-black text-white tracking-tight leading-none mb-4">
              {isVip ? "Solicitar Convite VIP" : "Cadastro de Colaborador"}
            </h2>
            {eventName && <p className={`text-sm font-black uppercase tracking-[0.3em] ${isVip ? 'text-pink-400/80' : 'text-indigo-400/80'}`}>{eventName}</p>}
            {supplierName && <p className="text-gray-500 text-xs mt-3 font-bold uppercase tracking-widest italic">A convite de: {supplierName}</p>}
        </div>

        <form onSubmit={handleRegisterSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
          <div className="space-y-8">
            <div className="group">
              <label htmlFor="cpf" className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2 group-focus-within:text-pink-400 transition-colors">CPF do Convidado</label>
              <input
                type="text" id="cpf" value={cpf} onChange={(e) => setCpf(formatCPF(e.target.value))}
                onBlur={handleCpfBlur}
                className="w-full bg-gray-900 border border-gray-700/50 rounded-xl py-4 px-5 text-white focus:outline-none focus:ring-2 focus:ring-pink-500/20 transition-all placeholder:text-gray-800 text-lg font-medium"
                placeholder="000.000.000-00"
                disabled={isSubmitting || isCheckingCpf}
              />
              {cpfCheckMessage && (
                  <p className={`text-xs mt-2 font-bold uppercase tracking-widest flex items-center gap-2 ${existingAttendeeFound ? 'text-yellow-500' : 'text-green-500'}`}>
                      {isCheckingCpf && <SpinnerIcon className="w-3 h-3" />}
                      {cpfCheckMessage}
                  </p>
              )}
               {blockedWarning && (
                  <div className="mt-4 p-4 bg-red-950/50 border border-red-500/50 rounded-xl flex items-start gap-3 text-red-200 text-xs shadow-lg animate-in fade-in zoom-in duration-300">
                      <NoSymbolIcon className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
                      <span className="font-bold leading-relaxed">{blockedWarning}</span>
                  </div>
              )}
            </div>
            
            <div className="group">
              <label htmlFor="name" className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2 group-focus-within:text-pink-400 transition-colors">Nome Completo</label>
              <input
                type="text" id="name" value={name} onChange={(e) => setName(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700/50 rounded-xl py-4 px-5 text-white focus:outline-none focus:ring-2 focus:ring-pink-500/20 transition-all placeholder:text-gray-800 text-lg font-medium"
                placeholder="Digite seu nome"
                disabled={isSubmitting || isCheckingCpf || existingAttendeeFound}
              />
            </div>

            {isAdminView && (
              <div>
                <label htmlFor="supplier" className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                    {isVip ? "Divulgadora Responsável" : "Fornecedor"}
                </label>
                <select
                  id="supplier"
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700/50 rounded-xl py-4 px-5 text-white focus:outline-none focus:ring-2 focus:ring-pink-500/20 transition-all"
                  disabled={isSubmitting || isCheckingCpf || existingAttendeeFound}
                  required
                >
                  <option value="">{isVip ? "Selecione a divulgadora" : "Selecione o fornecedor"}</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
            
            {renderSubCompanyInput()}
            {renderSectorInput()}

            <div className="pt-4">
                <button 
                  type="submit" 
                  className={`w-full text-white font-black uppercase tracking-widest py-5 px-6 rounded-2xl transition-all duration-500 flex items-center justify-center gap-3 disabled:bg-gray-800 disabled:text-gray-600 shadow-xl ${isVip ? 'bg-gradient-to-r from-pink-600 to-rose-700 hover:shadow-pink-500/20 hover:scale-[1.02] active:scale-95' : 'bg-indigo-600 hover:bg-indigo-700'}`} 
                  disabled={!name || !cpf || !photo || (!sector && !subCompany && !isAdminView && !isVip) || isSubmitting || isCheckingCpf || existingAttendeeFound}
                >
                  {isSubmitting ? (
                    <>
                      <SpinnerIcon className="w-5 h-5" />
                      ENVIANDO...
                    </>
                  ) : (
                    <>
                      <CheckCircleIcon className="w-5 h-5"/>
                      {isVip ? "CONFIRMAR PRESENÇA" : "REGISTRAR"}
                    </>
                  )}
                </button>
                 {showSuccess && (
                    <div className="mt-6 text-center p-4 rounded-xl bg-green-500/10 text-green-500 border border-green-500/30 flex items-center justify-center gap-2 animate-in fade-in slide-in-from-top-4 duration-500 shadow-lg">
                        <CheckCircleIcon className="w-6 h-6" />
                        <p className="text-sm font-black uppercase tracking-widest">{isVip ? "VIP confirmada com sucesso!" : "Cadastrado com sucesso!"}</p>
                    </div>
                )}
            </div>
          </div>
          
          <div className="flex flex-col items-center">
              <div className="w-full relative group">
                  <div className={`absolute -inset-1 rounded-[2.5rem] bg-gradient-to-tr ${isVip ? 'from-pink-600 to-rose-400' : 'from-indigo-600 to-blue-400'} opacity-30 blur-xl group-hover:opacity-50 transition-opacity duration-500`}></div>
                  <div className="relative">
                      <WebcamCapture 
                        onCapture={setPhoto} 
                        capturedImage={photo} 
                        disabled={isSubmitting || isCheckingCpf || isPhotoLocked} 
                        allowUpload={isAdminView || allowGuestUploads} 
                      />
                  </div>
              </div>
              {isPhotoLocked && (
                <p className="text-[10px] font-black uppercase tracking-widest mt-6 text-yellow-500/80 text-center px-4 leading-relaxed">
                  {existingAttendeeFound ? "Sua foto já está protegida para este evento." : "Foto histórica restaurada. Mudanças desativadas."}
                </p>
              )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegisterView;