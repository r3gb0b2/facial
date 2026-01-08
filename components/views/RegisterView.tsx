
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

  const selectedSupplierData = useMemo(() => {
    if (!isAdminView) return supplierInfo?.data;
    return suppliers.find(s => s.id === selectedSupplierId);
  }, [isAdminView, selectedSupplierId, suppliers, supplierInfo]);

  const hasSubCompanies = useMemo(() => {
    return Array.isArray(selectedSupplierData?.subCompanies) && selectedSupplierData!.subCompanies!.length > 0;
  }, [selectedSupplierData]);

  useEffect(() => {
    if (selectedSupplierData) {
        // Se mudou o fornecedor e ele não tem sub-empresas, limpa o campo
        if (!hasSubCompanies) setSubCompany('');
        
        // Auto-seleciona setor se houver apenas um no fornecedor
        if (selectedSupplierData.sectors?.length === 1) {
            setSector(selectedSupplierData.sectors[0]);
        }
    }
  }, [selectedSupplierData, hasSubCompanies]);

  const handleCpfBlur = async () => {
    const rawCpf = cpf.replace(/\D/g, '');
    if (rawCpf.length !== 11) return;

    setIsCheckingCpf(true);
    setCpfCheckMessage('Verificando...');
    try {
        const blockInfo = await api.checkBlockedStatus(rawCpf);
        if (blockInfo) setBlockedInfo(blockInfo);

        const activeEventId = isAdminView ? currentEventId : supplierInfo?.data.eventId;
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
    if (!name || !rawCpf || !photo) {
      setError('Preencha todos os campos e capture a foto.');
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
          sectors: [sector], subCompany 
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

  const formatCPF = (value: string) => value.replace(/\D/g, '').slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');

  const renderFormFields = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-2">Nome Completo</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-neutral-900 border border-white/10 rounded-xl py-4 px-5 text-white font-bold focus:border-indigo-500 transition-all" placeholder="Nome do colaborador" required disabled={isSubmitting || existingAttendeeFound} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-2">CPF</label>
          <input type="text" value={cpf} onChange={(e) => setCpf(formatCPF(e.target.value))} onBlur={handleCpfBlur} className="w-full bg-neutral-900 border border-white/10 rounded-xl py-4 px-5 text-white font-bold focus:border-indigo-500 transition-all" placeholder="000.000.000-00" required disabled={isSubmitting} />
          {cpfCheckMessage && <p className="text-[9px] font-black text-indigo-400 mt-2 uppercase">{cpfCheckMessage}</p>}
        </div>
        {isAdminView && (
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-2">Fornecedor</label>
            <select value={selectedSupplierId} onChange={(e) => setSelectedSupplierId(e.target.value)} className="w-full bg-neutral-900 border border-white/10 rounded-xl py-4 px-4 text-white font-bold focus:border-indigo-500 transition-all cursor-pointer appearance-none" required>
              <option value="">Selecionar...</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {hasSubCompanies && (
        <div className="animate-in slide-in-from-top-2 duration-300">
          <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-2">Empresa / Unidade</label>
          <select value={subCompany} onChange={(e) => setSubCompany(e.target.value)} className="w-full bg-neutral-900 border border-white/10 rounded-xl py-4 px-4 text-white font-bold focus:border-indigo-500 transition-all cursor-pointer appearance-none" required>
            <option value="">Selecionar Empresa...</option>
            {selectedSupplierData?.subCompanies?.map(sc => <option key={sc.name} value={sc.name}>{sc.name}</option>)}
          </select>
        </div>
      )}

      {!isVip && (
        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-2">Setor de Acesso</label>
          <select value={sector} onChange={(e) => setSector(e.target.value)} className="w-full bg-neutral-900 border border-white/10 rounded-xl py-4 px-4 text-white font-bold focus:border-indigo-500 transition-all appearance-none" required>
            <option value="">Selecionar Setor...</option>
            {sectors.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
      )}

      <button type="submit" disabled={isSubmitting || existingAttendeeFound || !photo} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-[0.2em] text-xs py-5 rounded-2xl shadow-xl transition-all active:scale-95 disabled:opacity-50">
        {isSubmitting ? 'Processando...' : 'Finalizar Cadastro'}
      </button>
    </div>
  );

  return (
    <div className="w-full max-w-5xl mx-auto px-4">
      <div className="bg-neutral-900/60 backdrop-blur-xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl">
        <div className="p-10 md:p-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            <div className="space-y-10">
              <div>
                <h2 className="text-4xl font-black text-white uppercase tracking-tighter mb-2">Novo Cadastro</h2>
                <p className="text-neutral-500 text-sm font-bold uppercase tracking-widest">{eventName || 'Evento'}</p>
              </div>
              {renderFormFields()}
            </div>
            <div className="flex flex-col items-center justify-center pt-10">
               <span className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.3em] mb-8">Bio-Identidade Facial</span>
               <div className="w-full max-w-sm aspect-square rounded-[3rem] overflow-hidden border-4 border-white/5 bg-black shadow-2xl">
                  <WebcamCapture onCapture={setPhoto} capturedImage={photo} disabled={isSubmitting || isPhotoLocked} allowUpload={isAdminView || allowGuestUploads} />
               </div>
            </div>
          </div>
        </div>
      </div>
      {showSuccess && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 bg-green-600 text-white px-10 py-5 rounded-3xl shadow-2xl font-black uppercase tracking-widest text-xs animate-in slide-in-from-top-10">
          Cadastro Realizado com Sucesso!
        </div>
      )}
    </div>
  );
};

export default RegisterView;
