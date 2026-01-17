
import React, { useState, useEffect, useMemo } from 'react';
import { Attendee, Sector, Supplier, SubCompany, EventType } from '../../types.ts';
import WebcamCapture from '../WebcamCapture.tsx';
import { useTranslation } from '../../hooks/useTranslation.tsx';
import { SpinnerIcon, CheckCircleIcon } from '../icons.tsx';
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
  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [sector, setSector] = useState('');
  const [subCompany, setSubCompany] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [persistentSuccess, setPersistentSuccess] = useState<string | null>(null);

  // RECIBO DE SEGURANÇA: Verifica se já houve um sucesso recente antes do crash
  useEffect(() => {
    const lastSuccess = localStorage.getItem('last_reg_success');
    const lastTime = localStorage.getItem('last_reg_time');
    
    if (lastSuccess && lastTime) {
      const diff = Date.now() - parseInt(lastTime);
      if (diff < 300000) { // 5 minutos de validade do recibo
        setPersistentSuccess(lastSuccess);
        setShowSuccess(true);
      } else {
        localStorage.removeItem('last_reg_success');
        localStorage.removeItem('last_reg_time');
      }
    }
  }, []);

  const isAdminView = !predefinedSector;
  const selectedSupplierData = useMemo(() => isAdminView ? null : supplierInfo?.data, [isAdminView, supplierInfo]);
  const hasSubCompanies = useMemo(() => selectedSupplierData && (selectedSupplierData.subCompanies?.length || 0) > 0, [selectedSupplierData]);

  useEffect(() => {
    if (selectedSupplierData && !hasSubCompanies && selectedSupplierData.sectors?.length > 0) {
      setSector(selectedSupplierData.sectors[0]);
    }
  }, [selectedSupplierData, hasSubCompanies]);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawCpf = cpf.replace(/\D/g, '');
    
    if (!name || !rawCpf || !photo) {
      setError('Campos incompletos');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Envia o registro
      await onRegister({ 
          name, cpf: rawCpf, email: email || '', photo: photo, 
          sectors: sector ? [sector] : [], subCompany 
      });
      
      // 2. SALVA RECIBO IMEDIATAMENTE (Anti-Crash)
      localStorage.setItem('last_reg_success', name);
      localStorage.setItem('last_reg_time', Date.now().toString());

      // 3. Limpa estados locais e mostra sucesso
      if (photo.startsWith('blob:')) URL.revokeObjectURL(photo);
      
      setName(''); setCpf(''); setEmail(''); setPhoto(null);
      setPersistentSuccess(name);
      setShowSuccess(true);
      
      // 4. Limpa o recibo após 10 segundos se não crashar
      setTimeout(() => {
        localStorage.removeItem('last_reg_success');
        localStorage.removeItem('last_reg_time');
        setShowSuccess(false);
        setPersistentSuccess(null);
      }, 10000);

    } catch (error: any) {
      setError(error.message || "Erro no envio.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCPF = (v: string) => v.replace(/\D/g, '').slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');

  // VIEW DE SUCESSO PERSISTENTE
  if (showSuccess) {
    return (
      <div className="w-full max-w-md mx-auto py-20 text-center animate-in zoom-in-95 duration-500">
        <div className="bg-neutral-900 border border-green-500/30 p-12 rounded-[3rem] shadow-2xl">
          <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_0_40px_rgba(34,197,94,0.3)]">
            <CheckCircleIcon className="w-14 h-14 text-white" />
          </div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Enviado com Sucesso!</h2>
          <p className="text-green-500 font-bold uppercase tracking-widest text-[10px] mb-8">{persistentSuccess || 'Cadastro'}</p>
          <p className="text-neutral-500 text-xs leading-relaxed mb-10">Sua biometria foi sincronizada. Você já pode fechar esta página ou realizar um novo cadastro.</p>
          <button 
            onClick={() => {
              localStorage.removeItem('last_reg_success');
              setShowSuccess(false);
              setPersistentSuccess(null);
            }} 
            className="w-full bg-white text-black font-black uppercase tracking-widest text-xs py-5 rounded-2xl shadow-xl active:scale-95 transition-all"
          >
            Novo Cadastro
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-4">
      <div className="bg-neutral-900/60 backdrop-blur-xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl">
        <div className="p-8 md:p-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            <div className="space-y-8">
              <div>
                <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-1">Registro</h2>
                <p className="text-neutral-500 text-[10px] font-black uppercase tracking-[0.2em]">{eventName || 'Evento'}</p>
              </div>
              
              <form onSubmit={handleRegisterSubmit} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-600 mb-2">CPF</label>
                  <input type="text" value={cpf} onChange={(e) => setCpf(formatCPF(e.target.value))} className="w-full bg-black/40 border border-white/10 rounded-xl py-4 px-5 text-white font-bold focus:border-indigo-500 transition-all" placeholder="000.000.000-00" required disabled={isSubmitting} />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-600 mb-2">Nome</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl py-4 px-5 text-white font-bold focus:border-indigo-500 transition-all" placeholder="Nome completo" required disabled={isSubmitting} />
                </div>

                {hasSubCompanies && (
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-600 mb-2">Unidade/Empresa</label>
                    <select value={subCompany} onChange={(e) => setSubCompany(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl py-4 px-4 text-white font-bold focus:border-indigo-500 transition-all appearance-none" required>
                      <option value="">Selecionar...</option>
                      {selectedSupplierData?.subCompanies?.map(sc => sc && <option key={sc.name} value={sc.name}>{sc.name}</option>)}
                    </select>
                  </div>
                )}

                <button 
                  type="submit" 
                  disabled={isSubmitting || !photo} 
                  className={`w-full font-black uppercase tracking-[0.2em] text-xs py-5 rounded-2xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 ${!photo ? 'bg-neutral-800 text-neutral-600' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}
                >
                  {isSubmitting ? <SpinnerIcon className="w-5 h-5 animate-spin" /> : 'CONCLUIR CADASTRO'}
                </button>
              </form>
            </div>
            
            <div className="flex flex-col items-center justify-center pt-8">
               <span className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.4em] mb-8">Biometria Facial</span>
               <div className="w-full max-w-sm">
                  <WebcamCapture onCapture={setPhoto} capturedImage={photo} disabled={isSubmitting} allowUpload={isAdminView} />
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterView;
