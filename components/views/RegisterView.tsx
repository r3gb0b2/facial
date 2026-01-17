
import React, { useState, useEffect, useMemo } from 'react';
import { Attendee, Sector, Supplier, SubCompany, EventType } from '../../types.ts';
import WebcamCapture from '../WebcamCapture.tsx';
import { useTranslation } from '../../hooks/useTranslation.tsx';
import { SpinnerIcon, CheckCircleIcon, ArrowPathIcon } from '../icons.tsx';
import * as api from '../../firebase/service.ts';

// Utilitário para Banco de Dados Local (IndexedDB) - Sobrevive a crashes e refresh
const dbName = "offline_register_db";
const storeName = "pending_photos";

const savePhotoLocal = async (blob: Blob) => {
    return new Promise((resolve) => {
        const request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(storeName);
        request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction(storeName, "readwrite");
            tx.objectStore(storeName).put(blob, "last_capture");
            tx.oncomplete = () => resolve(true);
        };
    });
};

const getPhotoLocal = async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
        const request = indexedDB.open(dbName, 1);
        request.onsuccess = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(storeName)) { resolve(null); return; }
            const tx = db.transaction(storeName, "readonly");
            const getReq = tx.objectStore(storeName).get("last_capture");
            getReq.onsuccess = () => resolve(getReq.result || null);
        };
        request.onerror = () => resolve(null);
    });
};

const clearLocalData = async () => {
    localStorage.removeItem('draft_name');
    localStorage.removeItem('draft_cpf');
    localStorage.removeItem('draft_sub');
    const request = indexedDB.open(dbName, 1);
    request.onsuccess = () => {
        const db = request.result;
        if (db.objectStoreNames.contains(storeName)) {
            db.transaction(storeName, "readwrite").objectStore(storeName).clear();
        }
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
  
  const [name, setName] = useState(localStorage.getItem('draft_name') || '');
  const [cpf, setCpf] = useState(localStorage.getItem('draft_cpf') || '');
  const [subCompany, setSubCompany] = useState(localStorage.getItem('draft_sub') || '');
  const [photo, setPhoto] = useState<string | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [persistentSuccessName, setPersistentSuccessName] = useState<string | null>(null);
  const [isRecovered, setIsRecovered] = useState(false);

  // RECUPERAÇÃO DE SESSÃO PÓS-CRASH
  useEffect(() => {
    // 1. Verifica se já teve sucesso registrado antes do crash
    const lastSuccess = localStorage.getItem('last_reg_success');
    if (lastSuccess) {
      setPersistentSuccessName(lastSuccess);
      setShowSuccess(true);
      return;
    }

    // 2. Tenta recuperar foto do banco local
    const recover = async () => {
        const blob = await getPhotoLocal();
        if (blob) {
            const url = URL.createObjectURL(blob);
            setPhoto(url);
            setIsRecovered(true);
        }
    };
    recover();
  }, []);

  // SALVA RASCUNHO ENQUANTO DIGITA
  useEffect(() => {
    localStorage.setItem('draft_name', name);
    localStorage.setItem('draft_cpf', cpf);
    localStorage.setItem('draft_sub', subCompany);
  }, [name, cpf, subCompany]);

  const isAdminView = !predefinedSector;
  const selectedSupplierData = useMemo(() => isAdminView ? null : supplierInfo?.data, [isAdminView, supplierInfo]);
  const hasSubCompanies = useMemo(() => selectedSupplierData && (selectedSupplierData.subCompanies?.length || 0) > 0, [selectedSupplierData]);

  const handleCapture = async (blobUrl: string) => {
      setPhoto(blobUrl);
      setIsRecovered(false);
      if (blobUrl) {
          try {
              const res = await fetch(blobUrl);
              const blob = await res.blob();
              await savePhotoLocal(blob);
          } catch (e) { console.error("Erro ao salvar foto localmente", e); }
      }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawCpf = cpf.replace(/\D/g, '');
    
    if (!name || !rawCpf || !photo) {
      setError('Por favor, capture a foto biométrica.');
      return;
    }

    setIsSubmitting(true);
    // Unmount visual agressivo para o Moto G53
    await new Promise(r => setTimeout(r, 500));

    try {
      const activeEventId = isAdminView ? props.currentEventId : supplierInfo?.data?.eventId;
      
      // Verifica se já não foi enviado (anti-duplicidade em crash)
      const existing = await api.findAttendeeByCpf(rawCpf, activeEventId);
      if (existing && existing.eventId === activeEventId) {
          // Se já existe, apenas finge sucesso
      } else {
          await onRegister({ 
              name, cpf: rawCpf, email: '', photo: photo, 
              sectors: selectedSupplierData?.sectors || [], subCompany 
          }, isAdminView ? undefined : supplierInfo?.data?.id);
      }
      
      // SALVA RECIBO ANTI-CRASH
      localStorage.setItem('last_reg_success', name);
      await clearLocalData();

      setPersistentSuccessName(name);
      setShowSuccess(true);
    } catch (error: any) {
      setIsSubmitting(false);
      setError(error.message || "Erro no envio.");
    }
  };

  const formatCPF = (v: string) => v.replace(/\D/g, '').slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');

  if (showSuccess) {
    return (
      <div className="w-full max-w-md mx-auto py-20 text-center animate-in zoom-in-95 duration-500 px-4">
        <div className="bg-neutral-900 border border-green-500/30 p-12 rounded-[3rem] shadow-2xl">
          <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_0_40px_rgba(34,197,94,0.3)]">
            <CheckCircleIcon className="w-14 h-14 text-white" />
          </div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Confirmado!</h2>
          <p className="text-green-500 font-bold uppercase tracking-widest text-[10px] mb-8">{persistentSuccessName}</p>
          <button onClick={() => { localStorage.removeItem('last_reg_success'); window.location.reload(); }} className="w-full bg-white text-black font-black uppercase tracking-widest text-xs py-5 rounded-2xl shadow-xl">Novo Cadastro</button>
        </div>
      </div>
    );
  }

  if (isSubmitting) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center p-10 z-[500]">
          <SpinnerIcon className="w-16 h-16 text-indigo-500 animate-spin mb-10" />
          <h2 className="text-xl font-black text-white uppercase tracking-[0.3em]">Sincronizando</h2>
          <p className="text-neutral-600 text-[10px] font-bold uppercase tracking-widest mt-6 text-center">Processando biometria... Não feche esta tela.</p>
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

                <button type="submit" disabled={!photo} className={`w-full font-black uppercase tracking-[0.2em] text-xs py-5 rounded-2xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 ${!photo ? 'bg-neutral-800 text-neutral-600 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}>
                  {isRecovered ? 'FINALIZAR ENVIO' : 'CONCLUIR CADASTRO'}
                </button>
              </form>
            </div>
            
            <div className="flex flex-col items-center justify-center pt-8">
               <span className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.4em] mb-8">Biometria Facial</span>
               <div className="w-full max-w-sm">
                  <WebcamCapture onCapture={handleCapture} capturedImage={photo} disabled={false} allowUpload={isAdminView} />
                  {isRecovered && (
                      <p className="mt-4 text-center text-green-500 font-bold text-[9px] uppercase tracking-widest animate-pulse">
                         Foto recuperada do sistema local
                      </p>
                  )}
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterView;
