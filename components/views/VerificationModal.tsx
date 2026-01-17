
import React, { useState, useEffect } from 'react';
import { Attendee } from '../../types.ts';
import WebcamCapture from '../WebcamCapture.tsx';
import { CheckCircleIcon, XMarkIcon, SparklesIcon, SpinnerIcon } from '../icons.tsx';
import { useTranslation } from '../../hooks/useTranslation.tsx';
import { GoogleGenAI } from '@google/genai';

interface VerificationModalProps {
  attendee: Attendee;
  onClose: () => void;
  onConfirm: () => void;
}

const imageUrlToPartData = async (url: string): Promise<{ base64: string; mimeType: string; }> => {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const dataUrl = reader.result as string;
            const [header, base64] = dataUrl.split(',');
            const mimeType = header.match(/:(.*?);/)?.[1] || blob.type || 'image/png';
            resolve({ base64, mimeType });
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};


const VerificationModal: React.FC<VerificationModalProps> = ({ attendee, onClose, onConfirm }) => {
  const { t } = useTranslation();
  const [verificationPhoto, setVerificationPhoto] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<'MATCH' | 'NO_MATCH' | 'ERROR' | null>(null);
  const [verificationMessage, setVerificationMessage] = useState('');

  useEffect(() => {
    setVerificationPhoto(null);
    setIsVerifying(false);
    setVerificationResult(null);
    setVerificationMessage('');
  }, [attendee]);
  

  const handleVerification = async () => {
    if (!verificationPhoto) return;

    setIsVerifying(true);
    setVerificationResult(null);
    setVerificationMessage('Analisando...');

    if (!process.env.API_KEY) {
        setVerificationResult('ERROR');
        setVerificationMessage(t('errors.apiKeyNeeded'));
        setIsVerifying(false);
        return;
    }

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const registeredPhotoData = await imageUrlToPartData(attendee.photo);
        const registeredPhotoPart = {
            inlineData: {
                data: registeredPhotoData.base64,
                mimeType: registeredPhotoData.mimeType,
            },
        };

        const [header, capturedBase64] = verificationPhoto.split(',');
        const capturedMimeType = header.match(/:(.*?);/)?.[1] || 'image/png';
        const capturedPhotoPart = {
            inlineData: {
                data: capturedBase64,
                mimeType: capturedMimeType,
            },
        };
        
        const prompt = "Compare as duas imagens. São a mesma pessoa? Responda apenas MATCH ou NO_MATCH.";

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: { parts: [{ text: prompt }, registeredPhotoPart, capturedPhotoPart] },
        });
        
        const resultText = response.text.trim().toUpperCase();

        if (resultText.includes('MATCH')) {
            setVerificationResult('MATCH');
            setVerificationMessage('Validado!');
        } else {
            setVerificationResult('NO_MATCH');
            setVerificationMessage('Divergência detectada.');
        }

    } catch (error: any) {
        console.error(error);
        setVerificationResult('ERROR');
        setVerificationMessage('Erro na IA.');
    } finally {
        setIsVerifying(false);
    }
  };

  const resultBoxClass = {
    MATCH: 'bg-green-500/20 text-green-300 border-green-500',
    NO_MATCH: 'bg-yellow-500/20 text-yellow-300 border-yellow-500',
    ERROR: 'bg-red-500/20 text-red-300 border-red-500',
  }[verificationResult || ''] || '';
  
  return (
    <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[200] p-4" onClick={onClose}>
      <div className="bg-neutral-900 rounded-[2.5rem] w-full max-w-4xl border border-white/10 flex flex-col overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-white/5 flex justify-between items-center">
          <h2 className="text-xl font-black text-white uppercase tracking-tighter">{attendee.name}</h2>
          <button onClick={onClose} className="p-2 bg-white/5 rounded-full"><XMarkIcon className="w-6 h-6" /></button>
        </div>
        <div className="overflow-y-auto p-6 md:p-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Foto Original</span>
                <div className="rounded-[2rem] aspect-square overflow-hidden bg-black border-2 border-white/5">
                    <img src={attendee.photo} alt="Registered" className="w-full h-full object-cover" />
                </div>
              </div>
              <div className="space-y-4">
                <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Nova Captura</span>
                <WebcamCapture onCapture={setVerificationPhoto} capturedImage={verificationPhoto} allowUpload={false} />
                
                {verificationPhoto && !verificationResult && (
                   <button onClick={handleVerification} disabled={isVerifying} className="w-full bg-indigo-600 py-4 rounded-2xl text-white font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2">
                      {isVerifying ? <SpinnerIcon className="w-4 h-4 animate-spin"/> : <SparklesIcon className="w-4 h-4"/>}
                      {isVerifying ? 'Analisando...' : 'Verificar IA'}
                   </button>
                )}

                {verificationMessage && (
                  <div className={`p-4 rounded-xl border ${resultBoxClass} text-center font-black uppercase text-[10px] tracking-widest`}>
                    {verificationMessage}
                  </div>
                )}
              </div>
            </div>
        </div>
        <div className="p-6 bg-black/40">
            <button
                onClick={onConfirm}
                disabled={!verificationPhoto || verificationResult !== 'MATCH' || isVerifying}
                className="w-full bg-white text-black font-black uppercase py-5 rounded-3xl text-xs tracking-widest disabled:opacity-20 transition-all"
            >
                Confirmar Acesso
            </button>
        </div>
      </div>
    </div>
  );
};

export default VerificationModal;
