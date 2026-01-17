
import React, { useState, useEffect, useMemo } from 'react';
import { Attendee, Sector, Supplier, SubCompany, EventType } from '../../types.ts';
import WebcamCapture from '../WebcamCapture.tsx';
import { useTranslation } from '../../hooks/useTranslation.tsx';
import { SpinnerIcon, CheckCircleIcon } from '../icons.tsx';
import * as api from '../../firebase/service.ts';

// Utilitário local para IndexedDB (Sobrevive a crashes)
const dbName = "app_offline_v2";
const storeName = "sync_queue";

const persistPhotoLocal = async (blob: Blob) => {
    return new Promise((resolve) => {
        const request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(storeName);
        request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction(storeName, "readwrite");
            tx.objectStore(storeName).put(blob, "last_valid_photo");
            tx.oncomplete = () => resolve(true);
        };
    });
};

const getPersistedPhoto = async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
        const request = indexedDB.open(dbName, 1);
        request.onsuccess = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(storeName)) { resolve(null); return; }
            const getReq = db.transaction(storeName, "readonly").objectStore(storeName).get("last_valid_photo");
            getReq.onsuccess = () => resolve(getReq.result || null);
        };
        request.onerror = () => resolve(null);
    });
};

const clearPersistedData = async () => {
    const request = indexedDB.open(dbName, 1);
    request.onsuccess = () => {
        const db = request.result;
        if (db.objectStoreNames.contains(storeName)) db.transaction(storeName, "readwrite").objectStore(storeName).clear();
    };
};

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
  const { onRegister, setError, sectors, eventName, supplierInfo, predefinedSector } = props;
  const { t } = useTranslation();
  
  const [name, setName] = useState(localStorage.getItem('temp_name') || '');
  const [cpf, setCpf] = useState(localStorage.getItem('temp_cpf') || '');
  const [subCompany, setSubCompany] = useState(localStorage.getItem('temp_sub') || '');
  const [photo, setPhoto] = useState<string | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [persistentName, setPersistentName] = useState('');

  // TENTA RECUPERAR FOTO SE O CHROME CRASHOU
  useEffect(() => {
    const lastSuccess = localStorage.getItem('success_receipt');
    if (lastSuccess) {
      setPersistentName(lastSuccess);
      setShowSuccess(true);
      return;
    }

    getPersistedPhoto().then(blob => {
        if (blob) setPhoto(URL.createObjectURL(blob));
    });
  }, []);

  // SALVA DADOS ENQUANTO DIGITA
  useEffect(() => {
    localStorage.setItem('temp_name', name);
    localStorage.setItem('temp_cpf', cpf);
    localStorage.setItem('temp_sub', subCompany);
  }, [name, cpf, subCompany]);

  const isAdminView = !predefinedSector;
  const selectedSupplierData = useMemo(() => isAdminView ? null : supplierInfo?.data, [isAdminView, supplierInfo]);
  const hasSubCompanies = useMemo(() => selectedSupplierData && (selectedSupplierData.subCompanies?.length || 0) > 0, [selectedSupplierData]);

  const handleCaptureComplete = async (blobUrl: string) => {
      setPhoto(blobUrl);
      if (blobUrl) {
          try {
              const res = await fetch(blobUrl);
              const blob = await res.blob();
              await persistPhotoLocal(blob);
          } catch (e) { console.error(e); }
      }
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawCpf = cpf.replace(/\D/g, '');
    
    if (!name || !rawCpf || !photo) {
      setError('A biometria facial é obrigatória.');
      return;
    }

    // 1. Inicia estado de envio e remove formulário da tela para liberar RAM
    setIsSubmitting(true);
    await new Promise(r => setTimeout(r, 600)); // Delay para o browser limpar o DOM

    try {
      // 2. Executa o upload e registro
      await onRegister({ 
          name, cpf: rawCpf, email: '', photo: photo, 
          sectors: selectedSupplierData?.sectors || [], subCompany 
      }, isAdminView ? undefined : supplierInfo?.data?.id);
      
      // 3. Salva recibo de sucesso no LocalStorage ANTES de qualquer coisa
      localStorage.setItem('success_receipt', name);
      
      // 4. Limpeza total
      await clearPersistedData();
      localStorage.removeItem('temp_name');
      localStorage.removeItem('temp_cpf');
      localStorage.removeItem('temp_sub');

      setPersistentName(name);
      setShowSuccess(true);
    } catch (error: any) {
      setIsSubmitting(false);
      setError(error.message || "Erro no envio. Verifique sua conexão.");
    }
  };

  const formatCPF = (v: string) => v.replace(/\D/g, '').slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');

  // VIEW DE SUCESSO
  if (showSuccess) {
    return (
      <div className="w-full max-w-md mx-auto py-20 text-center animate-in zoom-in-95 duration-500 px-4">
        <div className="bg-neutral-900 border border-green-500/30 p-12 rounded-[3rem] shadow-2xl">
          <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_0_40px_rgba(34,197,94,0.3)]">
            <CheckCircleIcon className="w-14 h-14 text-white" />
          </div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Concluido!</h2>
          <p className="text-green-500 font-bold uppercase tracking-widest text-[10px] mb-8">{persistentName}</p>
          <button onClick={() => { localStorage.removeItem('success_receipt'); window.location.reload(); }} className="w-full bg-white text-black font-black uppercase tracking-widest text-xs py-5 rounded-2xl shadow-xl active:scale-95 transition-all">Novo Cadastro</button>
        </div>
      </div>
    );
  }

  // VIEW DE ENVIANDO (Otimizada para economizar 100% de CPU/RAM no Moto G53)
  if (isSubmitting) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center p-10 z-[500]">
          <SpinnerIcon className="w-16 h-16 text-indigo-500 animate-spin mb-10" />
          <h2 className="text-xl font-black text-white uppercase tracking-[0.3em]">Sincronizando</h2>
          <p className="text-neutral-600 text-[10px] font-bold uppercase tracking-widest mt-6 text-center">Processando biometria facial.<br/>Por favor, mantenha o navegador aberto.</p>
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
              
              <form onSubmit={handleFinalSubmit} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-600 mb-2">CPF</label>
                  <input type="text" value={cpf} onChange={(e) => setCpf(formatCPF(e.target.value))} className="w-full bg-black/40 border border-white/10 rounded-xl py-4 px-5 text-white font-bold focus:border-indigo-500 transition-all" placeholder="000.000.000-00" required />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-600 mb-2">Nome</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl py-4 px-5 text-white font-bold focus:border-indigo-500 transition-all" placeholder="Nome completo" required />
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
                  disabled={!photo} 
                  className={`w-full font-black uppercase tracking-[0.2em] text-xs py-5 rounded-2xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 ${!photo ? 'bg-neutral-800 text-neutral-600 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}
                >
                  CONCLUIR CADASTRO
                </button>
              </form>
            </div>
            
            <div className="flex flex-col items-center justify-center pt-8">
               <span className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.4em] mb-8">Biometria Facial</span>
               <div className="w-full max-w-sm">
                  <WebcamCapture onCapture={handleCaptureComplete} capturedImage={photo} disabled={false} allowUpload={isAdminView} />
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterView;
