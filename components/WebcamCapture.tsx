
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { CameraIcon, RefreshIcon, ArrowUpTrayIcon } from './icons.tsx';
import { useTranslation } from '../hooks/useTranslation.tsx';

interface WebcamCaptureProps {
  onCapture: (imageDataUrl: string) => void;
  capturedImage: string | null;
  disabled?: boolean;
  allowUpload?: boolean;
}

const WebcamCapture: React.FC<WebcamCaptureProps> = ({ onCapture, capturedImage, disabled = false, allowUpload = false }) => {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isStreamActive, setIsStreamActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
    }
    setIsStreamActive(false);
  }, []);

  const startStream = useCallback(async () => {
    if (streamRef.current) {
        stopStream();
    }
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: {
            facingMode: 'user'
        }
      });
      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setIsStreamActive(true);
    } catch (err: any) {
      console.error("Error accessing webcam:", err);
      const baseMessage = "Não foi possível acessar a webcam.";
      const errorDetails = `(${err.name || 'Error'}: ${err.message || 'Verifique as permissões da câmera.'})`;
      setError(`${baseMessage} ${errorDetails}`);
    }
  }, [stopStream]);

  useEffect(() => {
    if (!capturedImage) {
        startStream();
    } else {
        stopStream();
    }
    
    return () => {
      stopStream();
    };
  }, [capturedImage, startStream, stopStream]);

  const handleCapture = () => {
    if (videoRef.current && streamRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');
        onCapture(dataUrl);
      }
    }
  };
  
  const handleRetake = () => {
      onCapture('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onCapture(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto flex flex-col items-center">
        <div className="relative w-full aspect-square bg-neutral-950 rounded-[2.5rem] overflow-hidden border-4 border-white/5 shadow-2xl">
            {error && <div className="absolute inset-0 flex items-center justify-center text-center text-red-400 p-8 text-xs font-bold uppercase">{error}</div>}
            {capturedImage ? (
                <img src={capturedImage} alt="Captured" className="w-full h-full object-cover animate-in fade-in zoom-in-95 duration-500" />
            ) : (
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" muted></video>
            )}
             {!isStreamActive && !capturedImage && !error &&
                <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-neutral-600 text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">{t('webcam.starting')}</p>
                </div>
            }
        </div>
        <div className="mt-8 w-full px-4 space-y-3">
            {capturedImage ? (
                <button
                    type="button"
                    onClick={handleRetake}
                    disabled={disabled}
                    className="w-full bg-neutral-800 hover:bg-neutral-700 text-white font-black uppercase tracking-[0.2em] text-[10px] py-5 rounded-2xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
                >
                    <RefreshIcon className="w-4 h-4"/>
                    {t('webcam.retakeButton')}
                </button>
            ) : (
                <>
                    <button
                        type="button"
                        onClick={handleCapture}
                        disabled={!isStreamActive || disabled}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-[0.2em] text-[10px] py-5 rounded-2xl shadow-xl shadow-indigo-500/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
                    >
                        <CameraIcon className="w-5 h-5" />
                        {t('webcam.captureButton')}
                    </button>
                    
                    {allowUpload && (
                        <div className="w-full">
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={handleFileChange}
                                disabled={disabled}
                            />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={disabled}
                                className="w-full bg-white/5 hover:bg-white/10 text-neutral-400 font-black uppercase tracking-[0.2em] text-[10px] py-4 rounded-2xl transition-all flex items-center justify-center gap-3 border border-white/5"
                            >
                                <ArrowUpTrayIcon className="w-4 h-4" />
                                {t('webcam.uploadButton')}
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    </div>
  );
};

export default WebcamCapture;
