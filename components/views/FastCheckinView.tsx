import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Attendee, CheckinStatus, Sector, Supplier } from '../../types.ts';
import { useTranslation } from '../../hooks/useTranslation.tsx';
import * as api from '../../firebase/service.ts';
import { GoogleGenAI } from '@google/genai';
import { FaceSmileIcon, SpinnerIcon, CheckCircleIcon } from '../icons.tsx';
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
    // Cleanup on unmount
    return () => {
      stopScanningProcess();
    };
  }, [stopScanningProcess]);


  const handleStartScanning = async () => {
    if (isScanning) return;
    
    setFoundAttendee(null);
    setFeedbackMessage('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsScanning(true);
      setIsLoading(true);
      setFeedbackMessage(t('fastCheckin.analyzing'));

      const initialPendingAttendees = attendees.filter(a => a.status === CheckinStatus.PENDING);
      if (initialPendingAttendees.length === 0) {
          setFeedbackMessage(t('fastCheckin.noPending'));
          setIsLoading(false);
          // Don't stop scanning immediately, allow user to see the message
          setTimeout(stopScanningProcess, 3000);
          return;
      }
      
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
      let matchFound = false;

      intervalRef.current = setInterval(async () => {
        if (matchFound || !videoRef.current || !videoRef.current.videoWidth) return;

        // Refresh the list of pending attendees in every interval to avoid stale state
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
            const context = canvas.getContext('2d');
            if (!context) return;
    
            context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/png');
            const [, base64] = dataUrl.split(',');
            if (!base64) return;
            const capturedFramePart = { inlineData: { data: base64, mimeType: 'image/png' } };
    
            const prompt = `You are a security system. Your task is to compare faces. The first image is a live photo from a camera. The subsequent images are registered photos of individuals. Compare the live photo with each registered photo. If you find a clear match, respond ONLY with the text 'MATCH:' followed by the index number of the matching registered photo (e.g., 'MATCH: 2' if the live photo matches the second registered photo). The first registered photo is index 1. If there is no clear match, respond ONLY with 'NO_MATCH'.`;

            const BATCH_SIZE = 10;
            for (let i = 0; i < pendingAttendees.length; i += BATCH_SIZE) {
                if (matchFound) break;
    
                const batch = pendingAttendees.slice(i, i + BATCH_SIZE);
                
                // Asynchronously convert all images and associate them with the original attendee
                const batchPhotoResults = await Promise.all(batch.map(async (attendee) => {
                    const part = await imageUrlToPartData(attendee.photo);
                    return { attendee, part };
                }));

                // Filter out any attendees whose images failed to load
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
                    // Check if the index is valid for our validBatchData array
                    if (!isNaN(matchIndex) && matchIndex > 0 && matchIndex <= validBatchData.length) {
                        // The model's index is 1-based. Our array is 0-based.
                        const { attendee: found } = validBatchData[matchIndex - 1];
                        if (found) {
                            matchFound = true;
                            setFoundAttendee(found);
                            await onUpdateStatus(found.id, CheckinStatus.CHECKED_IN);
                            setFeedbackMessage(t('fastCheckin.checkinSuccess', { name: found.name }));
                            stopScanningProcess();
                            return; // Exit interval callback
                        }
                    }
                }
            }
        } catch (error) {
            console.error("Error during scanning interval:", error);
            setError(t('fastCheckin.aiError'));
            stopScanningProcess();
        }
      }, 4000); // Analyze every 4 seconds

    } catch (err) {
      setError(t('fastCheckin.cameraError'));
      console.error(err);
      setIsScanning(false);
      setIsLoading(false);
    }
  };

  const reset = () => {
    stopScanningProcess();
    setFoundAttendee(null);
    setFeedbackMessage('');
  };

  const renderOverlay = () => {
    if (!isScanning) return null;
    if (isLoading && !foundAttendee) {
      return (
        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-center p-4">
          <SpinnerIcon className="w-12 h-12 text-white mb-4" />
          <p className="text-white font-semibold text-lg">{feedbackMessage}</p>
        </div>
      );
    }
    return null;
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
                    // FIX: Filter out falsy values before joining to prevent extra commas, and resolve type error.
                    sectorLabel={(foundAttendee.sectors.map(id => sectorMap.get(id)?.label).filter(Boolean).join(', '))}
                    // FIX: Resolve potential 'unknown' type error by safely accessing properties.
                    sectorColor={sectorMap.get(foundAttendee.sectors[0])?.color}
                    // FIX: Resolve potential 'unknown' type error by safely accessing properties.
                    supplierName={foundAttendee.supplierId ? supplierMap.get(foundAttendee.supplierId)?.name : ''}
                 />
               </div>
            </div>
          ) : (
            <>
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              {renderOverlay()}
            </>
          )}
        </div>
        
        <div className="mt-6">
          {!isScanning ? (
            <button onClick={handleStartScanning} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-4 rounded-lg transition-colors">
              {t('fastCheckin.start')}
            </button>
          ) : (
             foundAttendee ? (
                <button onClick={reset} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-4 rounded-lg transition-colors">
                  {t('fastCheckin.checkNext')}
                </button>
             ) : (
                <button onClick={reset} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-4 rounded-lg transition-colors">
                  {t('fastCheckin.stop')}
                </button>
             )
          )}
        </div>
      </div>
    </div>
  );
};

export default FastCheckinView;