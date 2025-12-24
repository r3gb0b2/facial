
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

  // FIX: Define isSupplierWithSingleSector to resolve "Cannot find name" error.
  // It checks if the predefined sector is a single string or an array with only one element.
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
    setCpfCheckMessage('Verificando...');
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
              setCpfCheckMessage('CPF já registrado neste evento.');
              setExistingAttendeeFound(true);
              setIsPhotoLocked(true); 
            } else {
              setCpfCheckMessage('Cadastro encontrado. Dados restaurados.');
              setExistingAttendeeFound(false); 
              if (!allowPhotoChange) setIsPhotoLocked(true);
            }
        } else {
            setCpfCheckMessage('CPF não cadastrado. Prossiga com o registro.');
        }
    } catch (error: any) {
        setError('Erro ao verificar CPF.');
        setCpfCheckMessage('');
    } finally {
        setIsCheckingCpf(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawCpf = cpf.replace(/\D/g, '');

    if (!name || !rawCpf || !photo || (isVip && !email)) {
      setError('Por favor, preencha todos os campos obrigatórios e capture sua foto.');
      return;
    }

    setIsSubmitting(true);
    try {
      const attendeeData: Omit<Attendee, 'id' | 'status' | 'eventId' | 'createdAt'> = { 
          name, 
          cpf: rawCpf, 
          email: isVip ? email : undefined,
          photo, 
          sectors: [sector],
          ...(subCompany && { subCompany })
      };

      if (!isAdminView && blockedInfo) {
          attendeeData.blockReason = `Bloqueio Prévio: ${blockedInfo.reason}`;
      }

      await onRegister(attendeeData, isAdminView ? selectedSupplierId : undefined);
      
      // Success flow
      setName(''); setCpf(''); setEmail(''); setPhoto(null);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 5000);
    } catch (error: any) {
      setError(error.message || "Falha ao registrar.");
    } finally {
      setError(null);
      setIsSubmitting(false);
    }
  };

  const formatCPF = (value: string) => {
    return value.replace(/\D/g, '').slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  };

  // =========================================================================
  // VIEW: VIP LIST (SOPHISTICATED)
  // =========================================================================
  if (isVip) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center py-12 px-4 bg-[#0a0a0a]">
        <div className="w-full max-w-5xl relative">
          {/* Decorative Elements */}
          <div className="absolute -top-24 -left-24 w-64 h-64 bg-rose-900/20 rounded-full blur-[100px]"></div>
          <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-amber-900/20 rounded-full blur-[100px]"></div>
          
          <div className="relative bg-neutral-900/60 backdrop-blur-2xl border border-white/5 rounded-[3rem] overflow-hidden shadow-[0_50px_100px_rgba(0,0,0,0.7)]">
            <div className="grid grid-cols-1 lg:grid-cols-12">
              
              {/* Left Column: Form */}
              <div className="lg:col-span-7 p-8 md:p-14">
                <header className="mb-12">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-[1px] bg-rose-500"></div>
                    <span className="text-[10px] font-black uppercase tracking-[0.5em] text-rose-500">Exclusividade VIP</span>
                  </div>
                  <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter mb-4 leading-none uppercase">
                    Solicitar <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-amber-200">Presença</span>
                  </h1>
                  <p className="text-neutral-500 text-sm font-medium tracking-wide">
                    {eventName} • {supplierName ? `Host: ${supplierName}` : 'Guest List'}
                  </p>
                </header>

                <form onSubmit={handleRegisterSubmit} className="space-y-8">
                  <div className="space-y-6">
                    <div className="relative group">
                      <input
                        type="text" value={name} onChange={(e) => setName(e.target.value)}
                        className="w-full bg-transparent border-b border-neutral-800 py-4 text-white focus:outline-none focus:border-rose-500 transition-all placeholder:text-neutral-700 text-lg font-bold"
                        placeholder="NOME COMPLETO"
                        disabled={isSubmitting || existingAttendeeFound}
                      />
                      <label className="absolute -top-4 left-0 text-[9px] font-black uppercase tracking-widest text-neutral-600 group-focus-within:text-rose-500 transition-colors">Nome do Convidado</label>
                    </div>

                    <div className="relative group">
                      <input
                        type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-transparent border-b border-neutral-800 py-4 text-white focus:outline-none focus:border-rose-500 transition-all placeholder:text-neutral-700 text-lg font-bold"
                        placeholder="E-MAIL DE CONTATO"
                        disabled={isSubmitting || existingAttendeeFound}
                      />
                      <label className="absolute -top-4 left-0 text-[9px] font-black uppercase tracking-widest text-neutral-600 group-focus-within:text-rose-500 transition-colors">E-mail</label>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="relative group">
                        <input
                          type="text" value={cpf} onChange={(e) => setCpf(formatCPF(e.target.value))}
                          onBlur={handleCpfBlur}
                          className="w-full bg-transparent border-b border-neutral-800 py-4 text-white focus:outline-none focus:border-rose-500 transition-all placeholder:text-neutral-700 text-lg font-bold"
                          placeholder="000.000.000-00"
                          disabled={isSubmitting}
                        />
                        <label className="absolute -top-4 left-0 text-[9px] font-black uppercase tracking-widest text-neutral-600 group-focus-within:text-rose-500 transition-colors">Documento (CPF)</label>
                      </div>

                      {isAdminView && (
                        <div className="relative group">
                           <select
                            value={selectedSupplierId} onChange={(e) => setSelectedSupplierId(e.target.value)}
                            className="w-full bg-transparent border-b border-neutral-800 py-4 text-white focus:outline-none focus:border-rose-500 transition-all font-bold appearance-none cursor-pointer"
                            disabled={isSubmitting || existingAttendeeFound}
                          >
                            <option value="" className="bg-neutral-900">SELECIONE A HOST</option>
                            {suppliers.map(s => <option key={s.id} value={s.id} className="bg-neutral-900">{s.name.toUpperCase()}</option>)}
                          </select>
                          <label className="absolute -top-4 left-0 text-[9px] font-black uppercase tracking-widest text-neutral-600 group-focus-within:text-rose-500 transition-colors">Divulgadora</label>
                        </div>
                      )}
                    </div>
                  </div>

                  {cpfCheckMessage && (
                    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2">
                      <div className={`w-1 h-1 rounded-full ${existingAttendeeFound ? 'bg-amber-500' : 'bg-rose-500'}`}></div>
                      <span className={`text-[10px] font-black uppercase tracking-widest ${existingAttendeeFound ? 'text-amber-500' : 'text-neutral-500'}`}>{cpfCheckMessage}</span>
                    </div>
                  )}

                  <div className="pt-8">
                    <button
                      type="submit"
                      disabled={isSubmitting || existingAttendeeFound || !photo}
                      className="group relative w-full h-16 bg-white text-black font-black uppercase tracking-[0.3em] text-xs rounded-2xl overflow-hidden transition-all hover:scale-[1.02] active:scale-95 disabled:bg-neutral-800 disabled:text-neutral-600 shadow-2xl"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-rose-500 to-amber-400 translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
                      <span className="relative z-10 group-hover:text-white transition-colors duration-300">
                        {isSubmitting ? 'PROCESSANDO...' : 'SOLICITAR ACESSO'}
                      </span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Right Column: Webcam Capture */}
              <div className="lg:col-span-5 bg-black/40 border-l border-white/5 flex flex-col items-center justify-center p-8 md:p-14">
                <div className="relative group w-full max-w-sm">
                  <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-rose-500 to-amber-400 opacity-20 blur-xl group-hover:opacity-40 transition-opacity duration-700"></div>
                  <div className="relative">
                    <div className="w-full aspect-square rounded-full overflow-hidden border-4 border-neutral-800 p-2 shadow-inner bg-neutral-900/50">
                       <WebcamCapture 
                        onCapture={setPhoto} 
                        capturedImage={photo} 
                        disabled={isSubmitting || isPhotoLocked} 
                        allowUpload={isAdminView || allowGuestUploads} 
                      />
                    </div>
                  </div>
                  {isPhotoLocked && (
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] mt-8 text-neutral-500 text-center leading-relaxed max-w-[200px] mx-auto">
                      Identidade já validada no sistema.
                    </p>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Success Modal */}
        {showSuccess && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/95 backdrop-blur-md animate-in fade-in duration-500">
             <div className="max-w-md w-full bg-neutral-900 border border-white/10 rounded-[3rem] p-12 text-center shadow-[0_50px_150px_rgba(0,0,0,1)]">
                <div className="w-20 h-20 bg-rose-600 rounded-full mx-auto mb-10 flex items-center justify-center animate-bounce shadow-lg shadow-rose-500/20">
                    <CheckCircleIcon className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-3xl font-black text-white mb-4 uppercase tracking-tighter">Confirmado</h3>
                <p className="text-neutral-500 text-sm leading-relaxed mb-10 font-medium tracking-wide">
                  Sua reserva na lista VIP foi processada. <br/>Apresente seu documento original na entrada.
                </p>
                <button onClick={() => setShowSuccess(false)} className="w-full py-5 bg-white text-black font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-neutral-200 transition-all active:scale-95 shadow-xl">Entendido</button>
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
