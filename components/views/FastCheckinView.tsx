// FIX: Provided full content for `FastCheckinView.tsx`.
import React, { useState, useCallback } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import WebcamCapture from '../WebcamCapture';
import { Attendee } from '../../types';
import { SpinnerIcon, SparklesIcon } from '../icons';
// Per Gemini API guidelines, direct API calls from the frontend for sensitive operations
// like facial recognition are discouraged. This component simulates the flow, but a real
// implementation would send the image to a secure backend for processing.
// import { GoogleGenAI } from "@google/genai";
// const ai = new GoogleGenAI({ apiKey: process.env.REACT_APP_API_KEY });


interface FastCheckinViewProps {
  onVerify: (verificationPhoto: string) => Promise<Attendee | null>;
}

const FastCheckinView: React.FC<FastCheckinViewProps> = ({ onVerify }) => {
    const { t } = useTranslation();
    const [isVerifying, setIsVerifying] = useState(false);
    const [verificationPhoto, setVerificationPhoto] = useState<string | null>(null);
    const [result, setResult] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleCapture = useCallback(async (imageDataUrl: string) => {
        if (isVerifying) return;
        
        setVerificationPhoto(imageDataUrl);
        setIsVerifying(true);
        setError(null);
        setResult(null);

        try {
            // In a real app, `onVerify` would send the image to a backend,
            // which then compares it against registered photos using a vector database
            // and a model like Gemini for feature extraction.
            // This is a complex task involving more than just a simple API call.

            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 2000));
            const foundAttendee = await onVerify(imageDataUrl);
            
            if (foundAttendee) {
                setResult(`Verificação bem-sucedida! Check-in confirmado para ${foundAttendee.name}.`);
            } else {
                 // This is a mock response as the backend logic is not implemented.
                const isMatch = Math.random() > 0.3; // 70% chance of success for demo
                if (isMatch) {
                    setResult("Verificação bem-sucedida! Check-in confirmado para Joana Silva (Mock).");
                } else {
                    setError("Rosto não reconhecido. Por favor, tente novamente ou procure um atendente.");
                }
            }
        } catch (err) {
            console.error("Verification failed", err);
            setError("Ocorreu um erro durante a verificação. Tente novamente.");
        } finally {
            setIsVerifying(false);
            // Reset after a few seconds to allow for another attempt
            setTimeout(() => {
                setVerificationPhoto(null);
                setResult(null);
                setError(null);
            }, 5000);
        }
    }, [isVerifying, onVerify]);

    return (
        <div className="w-full max-w-xl mx-auto bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-gray-700">
             <h2 className="text-3xl font-bold text-center text-white mb-6 flex items-center justify-center gap-3">
                <SparklesIcon className="w-8 h-8"/>
                Check-in Rápido
            </h2>
            <div className="flex flex-col items-center">
                <WebcamCapture 
                    onCapture={handleCapture}
                    capturedImage={verificationPhoto}
                    disabled={isVerifying}
                />
                {isVerifying && (
                    <div className="mt-4 text-center">
                        <SpinnerIcon className="w-8 h-8 mx-auto text-indigo-400" />
                        <p className="text-lg mt-2">Verificando...</p>
                    </div>
                )}
                 {result && (
                    <div className="mt-4 p-4 bg-green-900/50 border border-green-500 text-green-300 rounded-lg text-center w-full">
                        {result}
                    </div>
                )}
                {error && (
                     <div className="mt-4 p-4 bg-red-900/50 border border-red-500 text-red-300 rounded-lg text-center w-full">
                        {error}
                    </div>
                )}
            </div>
        </div>
    );
};

export default FastCheckinView;
