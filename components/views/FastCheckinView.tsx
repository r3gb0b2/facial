

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Attendee, CheckinStatus, Sector, Supplier } from '../../types.ts';
import { useTranslation } from '../../hooks/useTranslation.tsx';
import * as api from '../../firebase/service.ts';
import { GoogleGenAI } from '@google/genai';
import { FaceSmileIcon, SpinnerIcon, CheckCircleIcon, XMarkIcon } from '../icons.tsx';
import AttendeeCard from '../AttendeeCard.tsx';

interface FastCheckinViewProps {
  attendees: Attendee[];
  sectors: Sector[];
  suppliers: Supplier[];
  onUpdateStatus: (attendeeId: string, status: CheckinStatus) => Promise<void>;
  setError: (message: string) => void;
}

// Helper para converter URLs de imagem para o formato da API do Gemini
const imageUrlToPartData = async (url: string): Promise<{ inlineData: { data: string; mimeType: string; } } | null> => {
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const dataUrl = reader.result as string;
                const [header, base64] = dataUrl.split(',');
                if (!base64) {
                    // Handles cases where the data URL is malformed
                    resolve(null);
                    return;
                }
                const mimeType = header.match(/:(.*?);/)?.[1] || blob.type || 'image/png';
                resolve({ inlineData: { data: base64, mimeType } });
            };
            reader.onerror = () => resolve(null); // Resolve with null on read error
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error("Error converting image URL to part data:", error);
        return null;
    }
};

const FastCheckinView: React.FC<FastCheckinViewProps> = ({ attendees, sectors, suppliers, onUpdateStatus, setError }) => {
  const { t } = useTranslation();
  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [foundAttendee, setFoundAttendee] = useState<Attendee | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string>('');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const attendeesRef = useRef(attendees);

  useEffect(() => {
    attendeesRef.current = attendees;
  }, [attendees]);

  const sectorMap = useMemo(() => new Map(sectors.map(s => [s.id, s])), [sectors]);
  const supplierMap = useMemo(() => new Map(suppliers.map(s => [s.id, s])), [suppliers]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
        videoRef.current.srcObject = null;
    }
  }, []);
  
  const stopScanningProcess = useCallback(() => {
     if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    stopCamera();
    setIsScanning(false);
    setIsLoading(false);
  }, [stopCamera]);

  useEffect(() => {
    return () => stopScanningProcess();
  }, [stopScanningProcess]);
  
  const handleStartScanning = async () => {
    if (isScanning || isLoading) return;
    
    setFoundAttendee(null);
    setFeedbackMessage('');

    const initialPendingAttendees = attendeesRef.current.filter(a => a.status === CheckinStatus.PENDING);
    if (initialPendingAttendees.length === 0) {
        setFeedbackMessage(t('fastCheckin.noPending'));
        return;
    }
    
    // FIX: Use API_KEY from environment variables as per guidelines.
    if (!process.env.API_KEY) {
        setError(t('errors.apiKeyNeeded'));
        return;
    }

    setIsLoading(true);
    setFeedbackMessage(t('fastCheckin.analyzing'));
    let ai: GoogleGenAI;

    try {
        ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    } catch (e: any) {
        console.error("Falha ao inicializar o SDK da IA:", e);
        const details = e.message || 'Verifique o console para mais detalhes.';
        setError(`${t('ai.initializingError')}: ${details}`);
        setIsLoading(false);
        setFeedbackMessage('');
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) throw new Error("Video element not found.");
        
        video.srcObject = stream;
        
        await new Promise<void>((resolve, reject) => {
            video.onloadedmetadata = () => video.play().then(resolve).catch(reject);
            video.onerror = () => reject(new Error('Erro no elemento de vídeo.'));
        });

        setIsScanning(true);
        setIsLoading(false);
        
        let matchFound = false;

        intervalRef.current = setInterval(async () => {
            if (matchFound || !videoRef.current || videoRef.current.paused || videoRef.current.ended) return;

            const pendingAttendees = attendeesRef.current.filter(a => a.status === CheckinStatus.PENDING);
            if (pendingAttendees.length === 0) {
                setFeedbackMessage(t('fastCheckin.noPending'));
                stopScanningProcess();
                return;
            }

            try {
                const canvas = document.createElement('canvas');
                canvas.width = videoRef.current.videoWidth;
                canvas.height = videoRef.current.videoHeight;
                if (!canvas.width || !canvas.height) return;

                const context = canvas.getContext('2d');
                if (!context) return;
        
                context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/png');
                const [, base64] = dataUrl.split(',');
                if (!base64) return;
                const capturedFramePart = { inlineData: { data: base64, mimeType: 'image/png' } };
        
                const prompt = `You are a sophisticated facial recognition system. Your task is to identify a person. The first image is from a live camera feed. The following images are from a database of registered attendees. Carefully compare the face in the live feed with each registered attendee's photo. Account for minor variations in lighting, angle, and expression. If you are confident that the person in the live feed matches one of the registered attendees, respond ONLY with 'MATCH:' followed by the corresponding index number (starting from 1 for the first registered photo). For example, 'MATCH: 3'. If you cannot find a confident match, respond ONLY with 'NO_MATCH'.`;

                const BATCH_SIZE = 10;
                for (let i = 0; i < pendingAttendees.length; i += BATCH_SIZE) {
                    if (matchFound) break;
        
                    const batch = pendingAttendees.slice(i, i + BATCH_SIZE);
                    
                    const batchPhotoResults = await Promise.all(batch.map(async (attendee) => {
                        const part = await imageUrlToPartData(attendee.photo);
                        return { attendee, part };
                    }));

                    const validBatchData = batchPhotoResults.filter(result => result.part !== null);

                    if (validBatchData.length === 0) continue;

                    const parts: any[] = [
                        { text: prompt }, 
                        capturedFramePart, 
                        ...validBatchData.map(data => data.part!)
                    ];

                    const response = await ai.models.generateContent({
                        model: 'gemini-2.5-flash',
                        contents: { parts },
                    });

                    const resultText = response.text?.trim().toUpperCase() || '';
        
                    if (resultText.startsWith('MATCH:')) {
                        const matchIndex = parseInt(resultText.replace('MATCH:', '').trim(), 10);
                        if (!isNaN(matchIndex) && matchIndex > 0 && matchIndex <= validBatchData.length) {
                            const { attendee: found } = validBatchData[matchIndex - 1];
                            if (found) {
                                matchFound = true;
                                setFoundAttendee(found);
                                await onUpdateStatus(found.id, CheckinStatus.CHECKED_IN);
                                setFeedbackMessage(t('fastCheckin.checkinSuccess', { name: found.name }));
                                stopScanningProcess();
                                return;
                            }
                        }
                    }
                }
                
                if (!matchFound) {
                    setFeedbackMessage(t('fastCheckin.noMatch'));
                }

            } catch (error: any) {
                console.error("Error during scanning interval:", error);
                if (error.message?.includes("API key not valid")) {
                    setError(t('errors.apiKeyInvalid'));
                } else {
                    setError(`${t('fastCheckin.aiError')} (${error.message || 'Erro de API'})`);
                }
                stopScanningProcess();
            }
        }, 4000);

    } catch (err: any) {
        const baseMessage = t('fastCheckin.cameraError');
        const errorDetails = `(${err.name || 'Error'}: ${err.message || 'Detalhes indisponíveis'})`;
        setError(`${baseMessage} ${errorDetails}`);
        console.error("Error starting camera for fast check-in:", err);
        stopScanningProcess();
        setFeedbackMessage('');
    }
  };

  const reset = () => {
    stopScanningProcess();
    setFoundAttendee(null);
    setFeedbackMessage('');
  };
  
  const renderControls = () => {
    if (foundAttendee) {
        return (
            <button onClick={reset} className="mt-6 w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-4 rounded-lg transition-colors">
              {t('fastCheckin.checkNext')}
            </button>
        );
    }
    if (isScanning || isLoading) {
         return (
            <button onClick={reset} className="mt-6 w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-4 rounded-lg transition-colors">
              {t('fastCheckin.stop')}
            </button>
         );
    }
    return (
        <button 
            onClick={handleStartScanning}
            className="mt-6 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-4 rounded-lg transition-colors"
        >
          {t('fastCheckin.start')}
        </button>
    );
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-gray-700">
        <h2 className="text-3xl font-bold text-white mb-6 flex items-center justify-center gap-3">
          <FaceSmileIcon className="w-8 h-8"/>
          {t('fastCheckin.title')}
        </h2>
        
        <div className="relative w-full max-w-md mx-auto aspect-square bg-black rounded-lg overflow-hidden border-2 border-gray-600 shadow-lg">
          {foundAttendee ? (
            <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-gray-900">
               <div className="text-center mb-4">
                 <CheckCircleIcon className="w-12 h-12 text-green-400 mx-auto" />
                 <p className="text-lg font-bold text-green-300 mt-2">{feedbackMessage}</p>
               </div>
               <div className="w-full max-w-xs">
                 <AttendeeCard 
                    attendee={foundAttendee}
                    onSelect={() => {}}
                    sectorLabel={(foundAttendee.sectors.map(id => sectorMap.get(id)?.label).filter(Boolean).join(', '))}
                    sectorColor={sectorMap.get(foundAttendee.sectors[0])?.color}
                    supplierName={foundAttendee.supplierId ? supplierMap.get(foundAttendee.supplierId)?.name : ''}
                 />
               </div>
            </div>
          ) : (
            <>
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              {(isLoading || isScanning) && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-center p-4">
                  <SpinnerIcon className="w-12 h-12 text-white mb-4" />
                  <p className="text-white font-semibold text-lg">{feedbackMessage || t('fastCheckin.analyzing')}</p>
                </div>
              )}
               {feedbackMessage && !isLoading && !isScanning && !foundAttendee &&
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-center p-4">
                    <p className="text-white font-semibold text-lg">{feedbackMessage}</p>
                </div>
               }
            </>
          )}
        </div>
        
        {renderControls()}
        
      </div>
    </div>
  );
};

export default FastCheckinView;