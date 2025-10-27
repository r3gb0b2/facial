import React, { useState, useEffect } from 'react';
import { Attendee } from '../types';
import WebcamCapture from './WebcamCapture';
import { CheckCircleIcon, XMarkIcon, SparklesIcon, SpinnerIcon } from './icons';
// FIX: Removed .tsx extension from module import to fix module resolution error.
import { useTranslation } from '../hooks/useTranslation';
import { GoogleGenAI } from '@google/genai';

interface VerificationModalProps {
  attendee: Attendee;
  onClose: () => void;
  onConfirm: () => void;
}

// Helper to convert an image URL to a base64 string for the API
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

  // Reset state when a new attendee is selected
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

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        
        // Prepare registered photo
        const registeredPhotoData = await imageUrlToPartData(attendee.photo);
        const registeredPhotoPart = {
            inlineData: {
                data: registeredPhotoData.base64,
                mimeType: registeredPhotoData.mimeType,
            },
        };

        // Prepare captured photo
        const [header, capturedBase64] = verificationPhoto.split(',');
        const capturedMimeType = header.match(/:(.*?);/)?.[1] || 'image/png';
        const capturedPhotoPart = {
            inlineData: {
                data: capturedBase64,
                mimeType: capturedMimeType,
            },
        };
        
        const prompt = "Analyze the two images provided. Are they of the same person? Respond ONLY with the word 'MATCH' if they are the same person, or 'NO_MATCH' if they are different people. Do not add any other explanation, punctuation, or formatting.";

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: prompt }, registeredPhotoPart, capturedPhotoPart] },
        });
        
        const resultText = response.text.trim().toUpperCase();

        if (resultText.includes('MATCH')) {
            setVerificationResult('MATCH');
            setVerificationMessage('Verificação facial concluída com sucesso!');
        } else {
            setVerificationResult('NO_MATCH');
            setVerificationMessage('As fotos não parecem ser da mesma pessoa. Verificação manual necessária.');
        }

    } catch (error) {
        console.error("AI Verification Error:", error);
        setVerificationResult('ERROR');
        setVerificationMessage('Ocorreu um erro na verificação com IA. Tente novamente ou verifique manually.');
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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl border border-gray-700 flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-700 flex justify-between items-center flex-shrink-0">
          <h2 className="text-2xl font-bold text-white">{t('verificationModal.title')} <span className="text-indigo-400">{attendee.name}</span></h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="overflow-y-auto max-h-[80vh]">
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-300 mb-2">{t('verificationModal.registeredPhoto')}</h3>
                <img src={attendee.photo} alt="Registered" className="rounded-lg w-full aspect-square object-contain bg-black border-2 border-gray-600" />
                <p className="text-gray-400 mt-2 text-sm">{attendee.cpf}</p>
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-300 mb-2">{t('verificationModal.liveVerification')}</h3>
                <WebcamCapture onCapture={setVerificationPhoto} capturedImage={verificationPhoto} />
                {verificationPhoto && !verificationResult && (
                    <div className="mt-4 w-full">
                        <button
                            onClick={handleVerification}
                            disabled={isVerifying}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-300 flex items-center justify-center gap-2 disabled:bg-indigo-400 disabled:cursor-wait"
                        >
                            {isVerifying ? <SpinnerIcon className="w-5 h-5"/> : <SparklesIcon className="w-5 h-5"/>}
                            {isVerifying ? 'Verificando...' : 'Verificar com IA'}
                        </button>
                    </div>
                )}
                {verificationMessage && (
                    <div className={`mt-4 text-center p-3 rounded-lg border ${resultBoxClass} flex items-center justify-center gap-2`}>
                         {verificationResult === 'MATCH' && <CheckCircleIcon className="w-5 h-5" />}
                         {verificationResult === 'NO_MATCH' && <XMarkIcon className="w-5 h-5" />}
                         {verificationResult === 'ERROR' && <XMarkIcon className="w-5 h-5" />}
                         <p className="text-sm font-medium">{verificationMessage}</p>
                    </div>
                )}
              </div>
            </div>
        </div>
        <div className="p-6 bg-gray-900/50 rounded-b-2xl flex-shrink-0">
            <button
                onClick={onConfirm}
                disabled={!verificationPhoto || verificationResult !== 'MATCH' || isVerifying}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
                <CheckCircleIcon className="w-6 h-6"/>
                {t('verificationModal.confirmButton')}
            </button>
        </div>
      </div>
    </div>
  );
};

export default VerificationModal;