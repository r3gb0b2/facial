
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
  eventType?: EventType;
}

const RegisterView: React.FC<RegisterViewProps> = (props) => {
  const { 
    onRegister, setError, sectors, suppliers = [], 
    predefinedSector, eventName, supplierName, 
    supplierInfo, currentEventId, allowPhotoChange = true, 
    eventType = 'CREDENTIALING' 
  } = props;

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
  const [blockedInfo, setBlockedInfo] = useState<{ reason: string, eventName: string } | null>(null);
  const [isLimitReached, setIsLimitReached] = useState(false);

  const isAdminView = !predefinedSector;

  const selectedSupplierData = useMemo(() => {
    if (!isAdminView) return supplierInfo?.data;
    return suppliers.find(s => s && s.id === selectedSupplierId);
  }, [isAdminView, selectedSupplierId, suppliers, supplierInfo]);

  const hasSubCompanies = useMemo(() => {
    return selectedSupplierData && Array.isArray(selectedSupplierData.subCompanies) && selectedSupplierData.subCompanies.length > 0;
  }, [selectedSupplierData]);

  useEffect(() => {
    const checkLimit = async () => {
        if (!isAdminView && supplierInfo && supplierInfo.data) {
            const count = await api.getRegistrationsCountForSupplier(supplierInfo.data.eventId, supplierInfo.data.id);
            if (count >= (supplierInfo.data.registrationLimit || 0)) {
                setIsLimitReached(true);
            } else {
                setIsLimitReached(false);
            }
        }
    };
    checkLimit();
  }, [isAdminView, supplierInfo]);

  useEffect(() => {
    if (selectedSupplierData) {
        if (!hasSubCompanies) {
            if (subCompany !== '') setSubCompany('');
            if (!isAdminView && Array.isArray(selectedSupplierData.sectors) && selectedSupplierData.sectors.length > 0) {
                const firstSector = selectedSupplierData.sectors[0];
                if (sector !== firstSector) setSector(firstSector);
            }
        } else if (subCompany && !isAdminView) {
            const sc = selectedSupplierData.subCompanies?.find(c => c && c.name === subCompany);
            if (sc && sector !== sc.sector) {
                setSector(sc.sector);
            }
        }
    }
  }, [selectedSupplierData, hasSubCompanies, subCompany, isAdminView, sector]);

  const handleCpfBlur = async () => {
    const rawCpf = cpf.replace(/\D/g, '');
    if (rawCpf.length !== 11) return;

    setIsCheckingCpf(true);
    setCpfCheckMessage('Verificando...');
    try {
        const blockInfo = await api.checkBlockedStatus(rawCpf);
        if (blockInfo) setBlockedInfo(blockInfo);

        const activeEventId = isAdminView ? currentEventId : supplierInfo?.data?.eventId;
        if (!activeEventId) {
            setCpfCheckMessage('Erro: Evento não identificado.');
            return;
        }

        const existingAttendee = await api.findAttendeeByCpf(rawCpf, activeEventId);
        
        if (existingAttendee) {
            setName(existingAttendee.name);
            setPhoto(existingAttendee.photo);
            if (existingAttendee.email) setEmail(existingAttendee.email);
            setExistingAttendeeFound(activeEventId === existingAttendee.eventId);
            setIsPhotoLocked(activeEventId === existingAttendee.eventId || !allowPhotoChange);
            setCpfCheckMessage(activeEventId === existingAttendee.eventId ? 'Já cadastrado.' : 'Dados recuperados.');
        } else {
            setCpfCheckMessage('Novo cadastro.');
        }
    } catch (error) {
        setError('Erro ao validar CPF.');
    } finally {
        setIsCheckingCpf(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawCpf = cpf.replace(/\D/g, '');
    
    if (isLimitReached) {
        setError("Limite de cadastros atingido.");
        return;
    }

    if (!name || !rawCpf || !photo) {
      setError('Complete os dados e a biometria.');
      return;
    }
    if (hasSubCompanies && !subCompany) {
      setError('A seleção da empresa/unidade é obrigatória.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onRegister({ 
          name, cpf: rawCpf, email: email || '', photo, 
          sectors: sector ? [sector] : [], subCompany 
      }, isAdminView ? selectedSupplierId : undefined);
      
      setName(''); setCpf(''); setEmail(''); setPhoto(null); setSubCompany('');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 5000);
    } catch (error: any) {
      setError(error.message || "Falha ao registrar.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCPF = (value: string) => {
      if (!value) return '';
      return value.replace(/\D/g, '').slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4">
      <div className="bg-neutral-900/60 backdrop-blur-xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl">
        <div className="p-8 md:p-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            <div className="space-y-8">
              <div>
                <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-1">Registro de Acesso</h2>
                <p className="text-neutral-500 text-[10px] font-black uppercase tracking-[0.2em]">{eventName || 'Evento Geral'}</p>
              </div>
              
              <form onSubmit={handleRegisterSubmit} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-600 mb-2">CPF do Colaborador</label>
                  <input type="text" value={cpf} onChange={(e) => setCpf(formatCPF(e.target.value))} onBlur={handleCpfBlur} className="w-full bg-black/40 border border-white/10 rounded-xl py-4 px-5 text-white font-bold focus:border-indigo-500 transition-all" placeholder="000.000.000-00" required disabled={isSubmitting || isLimitReached} />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-600 mb-2">Nome Completo</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl py-4 px-5 text-white font-bold focus:border-indigo-500 transition-all" placeholder="Nome impresso no crachá" required disabled={isSubmitting || existingAttendeeFound || isLimitReached} />
                </div>

                {hasSubCompanies && (
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-600 mb-2">Empresa / Grupo</label>
                    <select value={subCompany} onChange={(e) => setSubCompany(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl py-4 px-4 text-white font-bold focus:border-indigo-500 transition-all appearance-none" required disabled={isLimitReached}>
                      <option value="">Selecionar Empresa...</option>
                      {selectedSupplierData?.subCompanies?.map(sc => sc && <option key={sc.name} value={sc.name}>{sc.name}</option>)}
                    </select>
                  </div>
                )}

                <button 
                  type="submit" 
                  disabled={isSubmitting || existingAttendeeFound || !photo || isLimitReached} 
                  className={`w-full font-black uppercase tracking-[0.2em] text-xs py-5 rounded-2xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 ${(!photo || isLimitReached) ? 'bg-neutral-800 text-neutral-600 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}
                >
                  {isSubmitting ? <SpinnerIcon className="w-5 h-5" /> : (existingAttendeeFound ? 'CPF JÁ CADASTRADO' : 'CONCLUIR CREDENCIAMENTO')}
                </button>
              </form>
            </div>
            
            <div className="flex flex-col items-center justify-center pt-8">
               <span className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.4em] mb-8">Validação de Biometria</span>
               <div className="w-full max-w-sm">
                  <WebcamCapture onCapture={setPhoto} capturedImage={photo} disabled={isSubmitting || isPhotoLocked || isLimitReached} allowUpload={isAdminView} />
               </div>
            </div>
          </div>
        </div>
      </div>
      {showSuccess && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 bg-green-600 text-white px-10 py-5 rounded-3xl shadow-2xl font-black uppercase tracking-widest text-xs animate-in slide-in-from-top-10 z-[300]">
          Cadastro realizado com sucesso!
        </div>
      )}
    </div>
  );
};

export default RegisterView;
