
import React, { useState, useEffect, useCallback } from 'react';
import { Attendee, Sector, Supplier } from '../../types.ts';
import WebcamCapture from '../WebcamCapture.tsx';
import { SpinnerIcon, CheckCircleIcon } from '../icons.tsx';
import * as api from '../../firebase/service.ts';

// BANCO LOCAL PARA SEGURANÇA (IndexedDB)
const LOCAL_STORE = "facial_registration_v3";
const saveBlobLocal = async (blob: Blob) => {
    const request = indexedDB.open(LOCAL_STORE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("blobs");
    request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("blobs", "readwrite");
        tx.objectStore("blobs").put(blob, "pending_photo");
    };
};

const getBlobLocal = (): Promise<Blob | null> => {
    return new Promise((resolve) => {
        const request = indexedDB.open(LOCAL_STORE, 1);
        request.onsuccess = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains("blobs")) return resolve(null);
            const req = db.transaction("blobs", "readonly").objectStore("blobs").get("pending_photo");
            req.onsuccess = () => resolve(req.result || null);
        };
        request.onerror = () => resolve(null);
    });
};

const clearLocal = () => {
    const request = indexedDB.open(LOCAL_STORE, 1);
    request.onsuccess = () => {
        const db = request.result;
        if (db.objectStoreNames.contains("blobs")) db.transaction("blobs", "readwrite").objectStore("blobs").clear();
    };
};

type Step = 'FORM' | 'CAPTURE' | 'UPLOADING' | 'SUCCESS';

const RegisterView: React.FC<any> = ({ onRegister, eventName, supplierInfo }) => {
  const [step, setStep] = useState<Step>('FORM');
  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [subCompany, setSubCompany] = useState('');
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);

  // Recupera se crashou
  useEffect(() => {
    getBlobLocal().then(b => { if (b) setPhotoBlob(b); });
  }, []);

  const handleCapture = async (dataUrl: string) => {
    if (!dataUrl) { setPhotoBlob(null); return; }
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    setPhotoBlob(blob);
    await saveBlobLocal(blob);
    setStep('FORM');
  };

  const executeRegistration = async () => {
    if (!photoBlob || !name || !cpf) return;
    
    setError(null);
    setStep('UPLOADING'); // Aqui o React remove o formulário e a câmera do DOM AGRESSIVAMENTE
    
    // Espera o navegador limpar a memória (Garbage Collector)
    await new Promise(r => setTimeout(r, 1000));

    try {
      // 1. Upload Binário (Moto G53 amigável)
      const photoUrl = await api.uploadBinaryPhoto(photoBlob, cpf.replace(/\D/g, ''));
      
      // 2. Registro no Firestore
      const attendee = {
        name, cpf: cpf.replace(/\D/g, ''),
        photo: photoUrl,
        sectors: supplierInfo?.data?.sectors || [],
        subCompany
      };
      
      await onRegister(attendee, supplierInfo?.data?.id);
      
      // 3. Sucesso
      clearLocal();
      setStep('SUCCESS');
    } catch (e: any) {
      console.error(e);
      setStep('FORM');
      setError("Falha no envio. Tente novamente.");
    }
  };

  if (step === 'SUCCESS') {
    return (
      <div className="w-full max-w-md mx-auto py-20 text-center animate-in zoom-in-95 duration-500">
        <div className="bg-neutral-900 border border-green-500/30 p-12 rounded-[3rem] shadow-2xl">
          <CheckCircleIcon className="w-20 h-20 text-green-500 mx-auto mb-6" />
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-4">Confirmado!</h2>
          <button onClick={() => window.location.reload()} className="w-full bg-white text-black font-black uppercase text-xs py-5 rounded-2xl">Novo Cadastro</button>
        </div>
      </div>
    );
  }

  if (step === 'UPLOADING') {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center p-10 z-[1000]">
          <SpinnerIcon className="w-16 h-16 text-indigo-500 animate-spin mb-8" />
          <h2 className="text-xl font-black text-white uppercase tracking-widest animate-pulse">Sincronizando...</h2>
          <p className="text-neutral-600 text-[10px] font-bold uppercase tracking-widest mt-6 text-center">Liberando memória do dispositivo.<br/>Não feche o navegador.</p>
      </div>
    );
  }

  if (step === 'CAPTURE') {
      return (
          <div className="fixed inset-0 bg-neutral-950 z-[500] p-6 flex flex-col items-center justify-center">
              <h3 className="text-white font-black uppercase tracking-widest text-xs mb-8">Posicione seu Rosto</h3>
              <div className="w-full max-w-sm">
                <WebcamCapture onCapture={handleCapture} capturedImage={null} />
              </div>
              <button onClick={() => setStep('FORM')} className="mt-10 text-neutral-500 font-bold uppercase text-[10px] tracking-widest">Voltar ao Formulário</button>
          </div>
      );
  }

  return (
    <div className="w-full max-w-2xl mx-auto px-4">
      <div className="bg-neutral-900/80 border border-white/10 rounded-[2.5rem] overflow-hidden p-8 md:p-12">
        <header className="mb-10 text-center">
            <h1 className="text-3xl font-black text-white uppercase tracking-tighter">{eventName || 'Registro'}</h1>
            <p className="text-neutral-500 text-[10px] font-black uppercase tracking-widest mt-1">Biometria Facial Obrigatória</p>
        </header>

        <form onSubmit={(e) => { e.preventDefault(); executeRegistration(); }} className="space-y-6">
            <div className="flex flex-col items-center mb-10">
                <div className="w-32 h-32 rounded-full border-4 border-white/5 bg-black overflow-hidden mb-4 relative shadow-2xl">
                    {photoBlob ? (
                        <img src={URL.createObjectURL(photoBlob)} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <SpinnerIcon className="w-8 h-8 text-neutral-800" />
                        </div>
                    )}
                </div>
                <button type="button" onClick={() => setStep('CAPTURE')} className="bg-white text-black font-black uppercase tracking-widest text-[10px] py-3 px-8 rounded-full shadow-lg hover:scale-105 transition-all">
                    {photoBlob ? 'Refazer Foto' : 'Tirar Foto'}
                </button>
            </div>

            <div className="grid grid-cols-1 gap-5">
                <input type="text" placeholder="CPF (000.000.000-00)" value={cpf} onChange={e => setCpf(e.target.value)} className="bg-black/50 border border-white/10 rounded-xl py-4 px-6 text-white font-bold focus:border-indigo-500 outline-none" required />
                <input type="text" placeholder="Nome Completo" value={name} onChange={e => setName(e.target.value)} className="bg-black/50 border border-white/10 rounded-xl py-4 px-6 text-white font-bold focus:border-indigo-500 outline-none" required />
                {supplierInfo?.data?.subCompanies?.length > 0 && (
                    <select value={subCompany} onChange={e => setSubCompany(e.target.value)} className="bg-black/50 border border-white/10 rounded-xl py-4 px-6 text-white font-bold focus:border-indigo-500 outline-none" required>
                        <option value="">Selecionar Empresa...</option>
                        {supplierInfo.data.subCompanies.map((sc: any) => <option key={sc.name} value={sc.name}>{sc.name}</option>)}
                    </select>
                )}
            </div>

            {error && <p className="text-red-500 text-center font-bold text-xs uppercase tracking-widest">{error}</p>}

            <button type="submit" disabled={!photoBlob || !name || !cpf} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-800 disabled:text-neutral-600 text-white font-black uppercase tracking-widest py-5 rounded-2xl shadow-xl transition-all">
                Concluir Cadastro
            </button>
        </form>
      </div>
    </div>
  );
};

export default RegisterView;
