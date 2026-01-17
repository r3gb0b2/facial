
import React, { useState, useEffect, useCallback } from 'react';
import { Attendee, Supplier } from '../../types.ts';
import WebcamCapture from '../WebcamCapture.tsx';
import { SpinnerIcon, CheckCircleIcon } from '../icons.tsx';
import * as api from '../../firebase/service.ts';

// SISTEMA DE ARQUIVOS LOCAL SEGURO
const DB_NAME = "RegistrationSafeStorage";
const STORE_NAME = "blobs";

const getDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 2);
        request.onupgradeneeded = (e: any) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

const saveBlob = async (blob: Blob) => {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(blob, "current_photo");
};

const getBlob = async (): Promise<Blob | null> => {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get("current_photo");
    return new Promise((resolve) => {
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
    });
};

const clearStorage = async () => {
    const db = await getDB();
    db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).clear();
};

type Step = 'FORM' | 'CAPTURE' | 'SYNC' | 'SUCCESS';

const RegisterView: React.FC<any> = ({ onRegister, eventName, supplierInfo }) => {
  const [step, setStep] = useState<Step>('FORM');
  const [name, setName] = useState(localStorage.getItem('reg_name') || '');
  const [cpf, setCpf] = useState(localStorage.getItem('reg_cpf') || '');
  const [subCompany, setSubCompany] = useState(localStorage.getItem('reg_sub') || '');
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Recuperação pós-crash
  useEffect(() => {
    getBlob().then(b => { if (b) setPhotoBlob(b); });
  }, []);

  // Rascunho automático
  useEffect(() => {
    localStorage.setItem('reg_name', name);
    localStorage.setItem('reg_cpf', cpf);
    localStorage.setItem('reg_sub', subCompany);
  }, [name, cpf, subCompany]);

  const handleCapture = async (dataUrl: string) => {
    if (!dataUrl) { setPhotoBlob(null); return; }
    try {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        setPhotoBlob(blob);
        await saveBlob(blob);
        setStep('FORM');
    } catch (e) {
        setError("Erro ao processar foto.");
    }
  };

  const handleFinish = async () => {
    if (!photoBlob || !name || !cpf) {
        setError("Preencha todos os campos e tire a foto.");
        return;
    }

    const cleanCpf = cpf.replace(/\D/g, '');
    if (cleanCpf.length !== 11) {
        setError("CPF inválido.");
        return;
    }

    setError(null);
    setStep('SYNC'); // Desmonta formulário e câmera IMEDIATAMENTE para liberar RAM

    try {
      // 1. Upload Binário direto para o Storage (Moto G53 amigável)
      const photoUrl = await api.uploadBinaryPhoto(photoBlob, cleanCpf);
      
      // 2. Registro no Banco de Dados
      const attendeeData = {
        name, 
        cpf: cleanCpf,
        photo: photoUrl,
        sectors: supplierInfo?.data?.sectors || [],
        subCompany: subCompany || ''
      };
      
      // supplierInfo?.data?.id contém o ID do fornecedor do link
      await onRegister(attendeeData, supplierInfo?.data?.id);
      
      // 3. Limpeza
      await clearStorage();
      localStorage.removeItem('reg_name');
      localStorage.removeItem('reg_cpf');
      localStorage.removeItem('reg_sub');
      setStep('SUCCESS');
    } catch (e: any) {
      console.error(e);
      setStep('FORM');
      setError("Falha na conexão. Tente novamente.");
    }
  };

  if (step === 'SUCCESS') {
    return (
      <div className="w-full max-w-md mx-auto py-20 text-center animate-in zoom-in-95 duration-500">
        <div className="bg-neutral-900 border border-green-500/30 p-12 rounded-[3rem] shadow-2xl">
          <CheckCircleIcon className="w-20 h-20 text-green-500 mx-auto mb-6" />
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-4">Cadastrado!</h2>
          <button onClick={() => window.location.reload()} className="w-full bg-white text-black font-black uppercase text-xs py-5 rounded-2xl">Novo Registro</button>
        </div>
      </div>
    );
  }

  if (step === 'SYNC') {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center p-10 z-[1000]">
          <SpinnerIcon className="w-16 h-16 text-indigo-500 animate-spin mb-8" />
          <h2 className="text-xl font-black text-white uppercase tracking-widest animate-pulse">Sincronizando...</h2>
          <p className="text-neutral-600 text-[10px] font-bold uppercase tracking-widest mt-6 text-center">Processando biometria facial.<br/>Por favor, aguarde.</p>
      </div>
    );
  }

  if (step === 'CAPTURE') {
      return (
          <div className="fixed inset-0 bg-neutral-950 z-[500] p-6 flex flex-col items-center justify-center">
              <div className="w-full max-w-sm">
                <WebcamCapture onCapture={handleCapture} capturedImage={null} />
              </div>
              <button onClick={() => setStep('FORM')} className="mt-10 text-neutral-500 font-bold uppercase text-[10px] tracking-widest underline">Voltar</button>
          </div>
      );
  }

  return (
    <div className="w-full max-w-2xl mx-auto px-4">
      <div className="bg-neutral-900/80 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-8 md:p-12 shadow-2xl">
        <header className="mb-10 text-center">
            <h1 className="text-3xl font-black text-white uppercase tracking-tighter">{eventName || 'Registro'}</h1>
            <p className="text-neutral-500 text-[10px] font-black uppercase tracking-widest mt-1">Biometria Obrigatória</p>
        </header>

        <form onSubmit={(e) => { e.preventDefault(); handleFinish(); }} className="space-y-6">
            <div className="flex flex-col items-center mb-10">
                <div className="w-36 h-36 rounded-full border-4 border-white/5 bg-black overflow-hidden mb-5 relative shadow-2xl flex items-center justify-center">
                    {photoBlob ? (
                        <img src={URL.createObjectURL(photoBlob)} className="w-full h-full object-cover" />
                    ) : (
                        <div className="text-neutral-800 uppercase font-black text-[8px] tracking-widest text-center px-4 leading-tight">Aguardando<br/>Foto</div>
                    )}
                </div>
                <button type="button" onClick={() => setStep('CAPTURE')} className="bg-white text-black font-black uppercase tracking-widest text-[10px] py-3 px-8 rounded-full shadow-lg active:scale-95 transition-all">
                    {photoBlob ? 'Trocar Foto' : 'Tirar Foto Agora'}
                </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
                <input type="text" placeholder="CPF (Apenas números)" value={cpf} onChange={e => setCpf(e.target.value)} className="bg-black/50 border border-white/10 rounded-xl py-4 px-6 text-white font-bold focus:border-indigo-500 outline-none" required />
                <input type="text" placeholder="Nome Completo" value={name} onChange={e => setName(e.target.value)} className="bg-black/50 border border-white/10 rounded-xl py-4 px-6 text-white font-bold focus:border-indigo-500 outline-none" required />
                
                {supplierInfo?.data?.subCompanies?.length > 0 && (
                    <select value={subCompany} onChange={e => setSubCompany(e.target.value)} className="bg-black/50 border border-white/10 rounded-xl py-4 px-6 text-white font-bold focus:border-indigo-500 outline-none" required>
                        <option value="">Empresa/Grupo...</option>
                        {supplierInfo.data.subCompanies.map((sc: any) => <option key={sc.name} value={sc.name}>{sc.name}</option>)}
                    </select>
                )}
            </div>

            {error && <p className="text-red-500 text-center font-bold text-[10px] uppercase tracking-widest bg-red-500/10 p-3 rounded-lg border border-red-500/20">{error}</p>}

            <button type="submit" disabled={!photoBlob || !name || !cpf} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-800 disabled:text-neutral-600 text-white font-black uppercase tracking-widest py-5 rounded-2xl shadow-xl transition-all active:scale-95">
                Confirmar Cadastro
            </button>
        </form>
      </div>
    </div>
  );
};

export default RegisterView;
