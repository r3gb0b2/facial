
import React, { useState, useEffect, useCallback } from 'react';
import { Attendee, Supplier } from '../../types.ts';
import WebcamCapture from '../WebcamCapture.tsx';
import { SpinnerIcon, CheckCircleIcon, CameraIcon, UserCircleIcon } from '../icons.tsx';
import * as api from '../../firebase/service.ts';

// CONFIGURAÇÃO DO BANCO LOCAL PARA SURVIVAL (Sobrevivência a crashes)
const DB_NAME = "AppResilienceDB";
const STORE_NAME = "registration_flow";

const initLocalDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 3);
        request.onupgradeneeded = (e: any) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

const saveTemporaryData = async (data: any) => {
    const db = await initLocalDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(data, "draft");
};

const getTemporaryData = async (): Promise<any> => {
    const db = await initLocalDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get("draft");
    return new Promise((resolve) => {
        req.onsuccess = () => resolve(req.result || null);
    });
};

const clearLocalData = async () => {
    const db = await initLocalDB();
    db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).clear();
};

type RegisterStep = 'INFO' | 'CAMERA' | 'UPLOADING' | 'DONE';

const RegisterView: React.FC<any> = ({ onRegister, eventName, supplierInfo }) => {
    const [step, setStep] = useState<RegisterStep>('INFO');
    const [name, setName] = useState('');
    const [cpf, setCpf] = useState('');
    const [subCompany, setSubCompany] = useState('');
    const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
    const [error, setError] = useState<string | null>(null);

    // MÁSCARA DE CPF E LIMITE
    const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value.replace(/\D/g, ''); // Remove tudo que não é número
        if (value.length > 11) value = value.slice(0, 11); // Limita a 11 dígitos
        
        // Aplica a máscara
        const masked = value
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d{1,2})/, '$1-$2')
            .replace(/(-\d{2})\d+?$/, '$1');
        
        setCpf(masked);
    };

    // RECUPERA DADOS SE O BROWSER CRASHOU
    useEffect(() => {
        getTemporaryData().then(data => {
            if (data) {
                if (data.name) setName(data.name);
                if (data.cpf) setCpf(data.cpf);
                if (data.subCompany) setSubCompany(data.subCompany);
                if (data.blob) setPhotoBlob(data.blob);
            }
        });
    }, []);

    // SALVA RASCUNHO AO ALTERAR
    useEffect(() => {
        if (name || cpf || photoBlob) {
            saveTemporaryData({ name, cpf, subCompany, blob: photoBlob });
        }
    }, [name, cpf, subCompany, photoBlob]);

    const startCamera = () => {
        if (!name || cpf.length < 14) {
            setError("Preencha o nome e o CPF corretamente.");
            return;
        }
        setError(null);
        setStep('CAMERA');
    };

    const handleCapture = async (dataUrl: string) => {
        try {
            const res = await fetch(dataUrl);
            const blob = await res.blob();
            setPhotoBlob(blob);
            setStep('INFO'); // Volta para a tela de revisão
        } catch (e) {
            setError("Erro ao processar imagem.");
            setStep('INFO');
        }
    };

    const finalizeRegistration = async () => {
        if (!photoBlob) return;
        
        setError(null);
        setStep('UPLOADING'); // MONTA A TELA DE CARREGAMENTO (Isolamento de RAM)
        
        // Pequena pausa para o Garbage Collector do Android agir
        await new Promise(r => setTimeout(r, 800));

        try {
            const cleanCpf = cpf.replace(/\D/g, '');
            
            // 1. Upload Binário (Moto G53 friendly)
            const photoUrl = await api.uploadBinaryPhoto(photoBlob, cleanCpf);
            
            // 2. Registro no Firestore
            const attendee = {
                name, cpf: cleanCpf, photo: photoUrl,
                sectors: supplierInfo?.data?.sectors || [],
                subCompany
            };
            
            await onRegister(attendee, supplierInfo?.data?.id);
            
            // 3. Limpeza total
            await clearLocalData();
            setStep('DONE');
        } catch (e: any) {
            console.error(e);
            setStep('INFO');
            setError("Falha na conexão. Tente enviar novamente.");
        }
    };

    if (step === 'DONE') {
        return (
            <div className="w-full max-w-md mx-auto py-20 text-center animate-in zoom-in-95 duration-500">
                <div className="bg-neutral-900 border border-green-500/30 p-12 rounded-[3.5rem] shadow-2xl">
                    <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_0_50px_rgba(34,197,94,0.3)]">
                        <CheckCircleIcon className="w-14 h-14 text-white" />
                    </div>
                    <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Sucesso!</h2>
                    <p className="text-neutral-500 text-xs font-bold uppercase tracking-widest mb-10">Cadastro realizado.</p>
                    <button onClick={() => window.location.reload()} className="w-full bg-white text-black font-black uppercase tracking-widest text-xs py-6 rounded-3xl shadow-xl active:scale-95 transition-all">Novo Cadastro</button>
                </div>
            </div>
        );
    }

    if (step === 'UPLOADING') {
        return (
            <div className="fixed inset-0 bg-black flex flex-col items-center justify-center p-10 z-[1000]">
                <SpinnerIcon className="w-20 h-20 text-indigo-500 animate-spin mb-10" />
                <h2 className="text-2xl font-black text-white uppercase tracking-[0.3em] animate-pulse">Sincronizando</h2>
                <p className="text-neutral-600 text-[10px] font-bold uppercase tracking-widest mt-6 text-center leading-relaxed">
                    Processando biometria facial.<br/>Isolando recursos do sistema...
                </p>
            </div>
        );
    }

    if (step === 'CAMERA') {
        return (
            <div className="fixed inset-0 bg-neutral-950 z-[500] p-6 flex flex-col items-center justify-center">
                <div className="w-full max-w-sm">
                    <h3 className="text-white font-black uppercase tracking-widest text-xs mb-8 text-center">Enquadre seu Rosto</h3>
                    <WebcamCapture onCapture={handleCapture} capturedImage={null} />
                    <button onClick={() => setStep('INFO')} className="mt-8 w-full text-neutral-600 font-bold uppercase text-[10px] tracking-widest py-4 border border-white/5 rounded-2xl">Cancelar e Voltar</button>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-3xl mx-auto px-4">
            <div className="bg-neutral-900/60 backdrop-blur-2xl border border-white/10 rounded-[3rem] p-8 md:p-14 shadow-2xl overflow-hidden relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-20"></div>
                
                <header className="mb-12 text-center">
                    <h1 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter leading-none">{eventName || 'Acesso'}</h1>
                    <p className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.4em] mt-3">Credenciamento Facial</p>
                </header>

                <div className="space-y-12">
                    {/* Visual de Preview da Foto */}
                    <div className="flex flex-col items-center">
                        <div onClick={startCamera} className={`w-32 h-32 rounded-full border-2 transition-all cursor-pointer overflow-hidden flex items-center justify-center group relative ${photoBlob ? 'border-green-500 shadow-[0_0_30px_rgba(34,197,94,0.2)]' : 'border-white/10 bg-black/40 hover:border-indigo-500'}`}>
                            {photoBlob ? (
                                <img src={URL.createObjectURL(photoBlob)} className="w-full h-full object-cover" />
                            ) : (
                                <CameraIcon className="w-8 h-8 text-neutral-700 group-hover:text-indigo-400 transition-colors" />
                            )}
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <span className="text-[8px] font-black text-white uppercase tracking-widest">{photoBlob ? 'Trocar' : 'Capturar'}</span>
                            </div>
                        </div>
                        <p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest mt-4">{photoBlob ? 'Identidade Bio-Métrica OK' : 'Toque para tirar a foto'}</p>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1">Documento CPF</label>
                            <input 
                                type="text" 
                                placeholder="000.000.000-00" 
                                value={cpf} 
                                onChange={handleCpfChange}
                                className="w-full bg-black/40 border border-white/5 rounded-2xl py-5 px-6 text-white text-xl font-black focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-neutral-800" 
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1">Nome Completo</label>
                            <input 
                                type="text" 
                                placeholder="Nome Sobrenome" 
                                value={name} 
                                onChange={e => setName(e.target.value.toUpperCase())}
                                className="w-full bg-black/40 border border-white/5 rounded-2xl py-5 px-6 text-white text-lg font-black focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-neutral-800" 
                            />
                        </div>

                        {supplierInfo?.data?.subCompanies?.length > 0 && (
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1">Empresa / Unidade</label>
                                <select 
                                    value={subCompany} 
                                    onChange={e => setSubCompany(e.target.value)} 
                                    className="w-full bg-black/40 border border-white/5 rounded-2xl py-5 px-6 text-white font-black focus:outline-none focus:border-indigo-500/50 transition-all appearance-none cursor-pointer"
                                >
                                    <option value="">Selecionar...</option>
                                    {supplierInfo.data.subCompanies.map((sc: any) => <option key={sc.name} value={sc.name}>{sc.name}</option>)}
                                </select>
                            </div>
                        )}
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-center">
                            <p className="text-red-500 font-bold text-xs uppercase tracking-widest leading-relaxed">{error}</p>
                        </div>
                    )}

                    {!photoBlob ? (
                        <button 
                            onClick={startCamera}
                            className="w-full bg-white text-black font-black uppercase tracking-widest text-xs py-6 rounded-[2rem] shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
                        >
                            <CameraIcon className="w-5 h-5" /> Iniciar Reconhecimento
                        </button>
                    ) : (
                        <button 
                            onClick={finalizeRegistration}
                            className="w-full bg-indigo-600 text-white font-black uppercase tracking-widest text-xs py-6 rounded-[2rem] shadow-[0_20px_40px_rgba(79,70,229,0.3)] hover:bg-indigo-500 active:scale-95 transition-all flex items-center justify-center gap-3"
                        >
                            <CheckCircleIcon className="w-5 h-5" /> Confirmar e Enviar
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RegisterView;
