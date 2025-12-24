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
    setCpfCheckMessage('Verificando documento...');
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
            if (existingAttendee.email) setEmail(existingAttendee.email);
            
            const isRegisteredInCurrentEvent = activeEventId && existingAttendee.eventId === activeEventId;

            if (isRegisteredInCurrentEvent) {
              setCpfCheckMessage('Seu cadastro já consta em nossa lista VIP.');
              setExistingAttendeeFound(true);
              setIsPhotoLocked(true); 
            } else {
              setCpfCheckMessage('Identidade reconhecida. Dados restaurados.');
              setExistingAttendeeFound(false); 
              if (!allowPhotoChange) setIsPhotoLocked(true);
            }
        } else {
            setCpfCheckMessage('Novo cadastro detectado. Seja bem-vindo.');
        }
    } catch (error: any) {
        setError('Erro na validação do documento.');
        setCpfCheckMessage('');
    } finally {
        setIsCheckingCpf(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawCpf = cpf.replace(/\D/g, '');

    // Validation
    if (!name || !rawCpf || !photo || (isVip && !email)) {
      setError('Por favor, preencha seu nome, e-mail, documento e capture sua foto.');
      return;
    }

    setIsSubmitting(true);
    try {
      const attendeeData: Omit<Attendee, 'id' | 'status' | 'eventId' | 'createdAt'> = { 
          name, 
          cpf: rawCpf, 
          email: email || '', 
          photo, 
          sectors: [sector],
          ...(subCompany && { subCompany })
      };

      if (!isAdminView && blockedInfo) {
          attendeeData.blockReason = `Bloqueio Prévio: ${blockedInfo.reason}`;
      }

      await onRegister(attendeeData, isAdminView ? selectedSupplierId : undefined);
      
      // Clear form
      setName(''); setCpf(''); setEmail(''); setPhoto(null);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 8000);
    } catch (error: any) {
      setError(error.message || "Falha ao registrar.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCPF = (value: string) => {
    return value.replace(/\D/g, '').slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  };

  // =========================================================================
  // VIEW: VIP LIST (PUBLIC SOPHISTICATED)
  // =========================================================================
  if (isVip) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center py-12 px-4 bg-[#050505]">
        <div className="w-full max-w-6xl relative">
          
          <div className="absolute -top-32 -left-32 w-80 h-80 bg-rose-900/10 rounded-full blur-[120px]"></div>
          <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-amber-900/10 rounded-full blur-[120px]"></div>
          
          <div className="relative bg-neutral-900/40 backdrop-blur-3xl border border-white/5 rounded-[4rem] overflow-hidden shadow-[0_80px_150px_rgba(0,0,0,0.8)]">
            <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[650px]">
              
              {/* Left Side: Sophisticated Form */}
              <div className="lg:col-span-7 p-10 md:p-16 flex flex-col justify-center">
                <header className="mb-14">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-[1px] bg-gradient-to-r from-rose-500 to-transparent"></div>
                    <span className="text-[10px] font-black uppercase tracking-[0.6em] text-rose-500">Privé & Unique List</span>
                  </div>
                  <h1 className="text-5xl md:text-6xl font-black text-white tracking-tighter mb-6 leading-[0.9] uppercase">
                    Solicitar <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 via-amber-200 to-rose-400">Presença VIP</span>
                  </h1>
                  <p className="text-neutral-500 text-sm font-medium tracking-widest uppercase">
                    {eventName} • {supplierName ? `Hosted by ${supplierName}` : 'Guest Registration'}
                  </p>
                </header>

                <form onSubmit={handleRegisterSubmit} className="space-y-10">
                  <div className="space-y-8">
                    {/* Input Group: Name */}
                    <div className="relative group">
                      <input
                        type="text" value={name} onChange={(e) => setName(e.target.value)}
                        className="w-full bg-transparent border-b border-neutral-800 py-5 text-white focus:outline-none focus:border-rose-500 transition-all placeholder:text-neutral-800 text-xl font-bold"
                        placeholder="SEU NOME COMPLETO"
                        required
                        disabled={isSubmitting || existingAttendeeFound}
                      />
                      <label className="absolute -top-4 left-0 text-[10px] font-black uppercase tracking-[0.3em] text-neutral-600 group-focus-within:text-rose-500 transition-colors">Nome Completo</label>
                    </div>

                    {/* Input Group: Email */}
                    <div className="relative group">
                      <input
                        type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-transparent border-b border-neutral-800 py-5 text-white focus:outline-none focus:border-rose-500 transition-all placeholder:text-neutral-800 text-xl font-bold"
                        placeholder="E-MAIL PARA CONTATO"
                        required
                        disabled={isSubmitting || existingAttendeeFound}
                      />
                      <label className="absolute -top-4 left-0 text-[10px] font-black uppercase tracking-[0.3em] text-neutral-600 group-focus-within:text-rose-500 transition-colors">Email de Confirmação</label>
                    </div>

                    {/* Input Group: CPF & Responsável */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                      <div className="relative group">
                        <input
                          type="text" value={cpf} onChange={(e) => setCpf(formatCPF(e.target.value))}
                          onBlur={handleCpfBlur}
                          className="w-full bg-transparent border-b border-neutral-800 py-5 text-white focus:outline-none focus:border-rose-500 transition-all placeholder:text-neutral-800 text-xl font-bold"
                          placeholder="000.000.000-00"
                          required
                          disabled={isSubmitting}
                        />
                        <label className="absolute -top-4 left-0 text-[10px] font-black uppercase tracking-[0.3em] text-neutral-600 group-focus-within:text-rose-500 transition-colors">Seu CPF</label>
                      </div>

                      {isAdminView ? (
                        <div className="relative group">
                           <select
                            value={selectedSupplierId} onChange={(e) => setSelectedSupplierId(e.target.value)}
                            className="w-full bg-transparent border-b border-neutral-800 py-5 text-white focus:outline-none focus:border-rose-500 transition-all font-bold appearance-none cursor-pointer text-sm tracking-widest"
                            required
                            disabled={isSubmitting || existingAttendeeFound}
                          >
                            <option value="" className="bg-neutral-900">DIVULGADORA / HOST</option>
                            {suppliers.map(s => <option key={s.id} value={s.id} className="bg-neutral-900">{s.name.toUpperCase()}</option>)}
                          </select>
                          <label className="absolute -top-4 left-0 text-[10px] font-black uppercase tracking-[0.3em] text-neutral-600 group-focus-within:text-rose-500 transition-colors">Responsável</label>
                        </div>
                      ) : (
                          <div className="relative group">
                            <input
                              type="text" readOnly value={supplierName?.toUpperCase()}
                              className="w-full bg-transparent border-b border-neutral-800 py-5 text-neutral-400 focus:outline-none font-bold text-sm tracking-widest"
                            />
                            <label className="absolute -top-4 left-0 text-[10px] font-black uppercase tracking-[0.3em] text-neutral-600">A convite de</label>
                          </div>
                      )}
                    </div>
                  </div>

                  {cpfCheckMessage && (
                    <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-4 duration-500">
                      <div className={`w-1.5 h-1.5 rounded-full ${existingAttendeeFound ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'}`}></div>
                      <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${existingAttendeeFound ? 'text-amber-500' : 'text-neutral-500'}`}>{cpfCheckMessage}</span>
                    </div>
                  )}

                  <div className="pt-10">
                    <button
                      type="submit"
                      disabled={isSubmitting || existingAttendeeFound || !photo}
                      className="group relative w-full h-20 bg-white text-black font-black uppercase tracking-[0.4em] text-[11px] rounded-3xl overflow-hidden transition-all hover:scale-[1.01] active:scale-95 disabled:bg-neutral-800 disabled:text-neutral-600 shadow-2xl"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-rose-500 via-amber-400 to-rose-500 translate-y-full group-hover:translate-y-0 transition-transform duration-700"></div>
                      <span className="relative z-10 group-hover:text-white transition-colors duration-500 flex items-center justify-center gap-3">
                        {isSubmitting ? (
                            <>
                                <SpinnerIcon className="w-5 h-5 animate-spin" />
                                ANALISANDO BIO-IDENTIDADE...
                            </>
                        ) : 'CONFIRMAR MINHA PRESENÇA VIP'}
                      </span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Right Side: Halo Webcam Capture */}
              <div className="lg:col-span-5 bg-black/60 border-l border-white/5 flex flex-col items-center justify-center p-12 md:p-16 relative">
                 <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(244,63,94,0.05)_0%,transparent_70%)]"></div>
                 
                 <div className="relative group w-full max-w-sm">
                  <div className="absolute -inset-1.5 rounded-full bg-gradient-to-tr from-rose-500 via-amber-500 to-rose-500 opacity-20 blur-2xl group-hover:opacity-50 transition-opacity duration-1000 animate-pulse"></div>
                  
                  <div className="relative">
                    <div className="w-full aspect-square rounded-full overflow-hidden border-[6px] border-neutral-900 p-2 shadow-[0_0_40px_rgba(0,0,0,0.5)] bg-neutral-950/80 backdrop-blur-xl">
                       <WebcamCapture 
                        onCapture={setPhoto} 
                        capturedImage={photo} 
                        disabled={isSubmitting || isPhotoLocked} 
                        allowUpload={isAdminView || allowGuestUploads} 
                      />
                    </div>
                  </div>

                  {!photo && (
                    <div className="absolute bottom-12 left-1/2 -translate-x-1/2 text-center pointer-events-none">
                        <span className="text-[9px] font-black uppercase tracking-[0.4em] text-rose-500/60 whitespace-nowrap">Selfie para Identificação</span>
                    </div>
                  )}

                  {isPhotoLocked && (
                    <p className="text-[9px] font-black uppercase tracking-[0.3em] mt-12 text-neutral-500 text-center leading-relaxed max-w-[240px] mx-auto opacity-60">
                      BIO-IDENTIDADE JÁ VALIDADA. <br/>ALTERAÇÃO INDISPONÍVEL.
                    </p>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Exclusive Success Modal */}
        {showSuccess && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/98 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-700">
             <div className="max-w-md w-full bg-neutral-900 border border-white/10 rounded-[4rem] p-16 text-center shadow-[0_80px_200px_rgba(0,0,0,1)] relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-500 via-amber-400 to-rose-500"></div>
                <div className="w-24 h-24 bg-gradient-to-br from-rose-600 to-amber-600 rounded-full mx-auto mb-12 flex items-center justify-center shadow-[0_0_50px_rgba(244,63,94,0.3)] animate-bounce">
                    <CheckCircleIcon className="w-12 h-12 text-white" />
                </div>
                <h3 className="text-4xl font-black text-white mb-6 uppercase tracking-tighter">Confirmação</h3>
                <p className="text-neutral-400 text-base leading-relaxed mb-12 font-medium tracking-wide">
                  Sua vaga na lista VIP foi reservada com sucesso. <br/>
                  <span className="text-rose-400/80 text-sm mt-4 block italic font-bold">Apresente seu documento original com foto na recepção do evento.</span>
                </p>
                <button onClick={() => setShowSuccess(false)} className="w-full py-6 bg-white text-black font-black uppercase tracking-[0.3em] text-[10px] rounded-[2rem] hover:bg-neutral-200 transition-all active:scale-95 shadow-2xl">Confirmar Leitura</button>
             </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW: COLLABORATOR (PROFESSIONAL / CREDENTIALING)
  // =========================================================================
  return (
    <div className="w-full max-w-4xl mx-auto space-y-10">
      <div className="bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-gray-700">
        <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600/20 text-indigo-400 mb-4">
                <UsersIcon className="w-8 h-8"/>
            </div>
            <h2 className="text-3xl font-bold text-white tracking-tight">Cadastro de Colaborador</h2>
            {eventName && <p className="text-lg font-medium text-gray-400 mt-1">{eventName}</p>}
            {supplierName && <p className="text-sm font-semibold text-gray-500 mt-2 uppercase tracking-widest">Equipe: {supplierName}</p>}
        </div>

        <form onSubmit={handleRegisterSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
          <div className="space-y-8">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Nome Completo</label>
                <input
                  type="text" value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                  placeholder="Ex: João Silva"
                  disabled={isSubmitting || existingAttendeeFound}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">CPF</label>
                <input
                  type="text" value={cpf} onChange={(e) => setCpf(formatCPF(e.target.value))}
                  onBlur={handleCpfBlur}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                  placeholder="000.000.000-00"
                  disabled={isSubmitting}
                />
                {cpfCheckMessage && <p className="text-[10px] font-bold text-indigo-400 mt-2 uppercase tracking-widest">{cpfCheckMessage}</p>}
              </div>

              {isAdminView && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Fornecedor / Empresa</label>
                  <select
                    value={selectedSupplierId} onChange={(e) => setSelectedSupplierId(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all cursor-pointer"
                    disabled={isSubmitting || existingAttendeeFound}
                  >
                    <option value="">Selecione um fornecedor</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}

              {!isSupplierWithSingleSector && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Setor de Atuação</label>
                  <select
                    value={sector} onChange={(e) => setSector(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                    disabled={isSubmitting || existingAttendeeFound}
                  >
                    <option value="" disabled>Selecione um setor</option>
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
                REGISTRAR COLABORADOR
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
            <span className="font-bold text-lg">Cadastro realizado com sucesso!</span>
        </div>
      )}
    </div>
  );
};

export default RegisterView;