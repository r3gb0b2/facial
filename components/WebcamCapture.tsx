
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
    if (videoRef.current) {
        videoRef.current.srcObject = null;
    }
    setIsStreamActive(false);
  }, []);

  const startStream = useCallback(async () => {
    stopStream();
    try {
      setError(null);
      // Constraints otimizadas para mobile
      const constraints = {
        video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 }
        }
      };
      
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        // Tentar dar play explicitamente para garantir no Android
        videoRef.current.play().catch(e => console.warn("Auto-play prevented", e));
      }
      setIsStreamActive(true);
    } catch (err: any) {
      console.error("Error accessing webcam:", err);
      setError("Câmera inacessível. Verifique as permissões do navegador.");
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
    const video = videoRef.current;
    if (!video || !streamRef.current) return;

    try {
        // No Android, o vídeo precisa estar com dados carregados (readyState >= 2)
        if (video.readyState < 2) {
            console.warn("Captura abortada: vídeo não está pronto.");
            return;
        }

        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;

        if (videoWidth <= 0 || videoHeight <= 0) {
            console.warn("Captura abortada: dimensões inválidas.");
            return;
        }

        const canvas = document.createElement('canvas');
        
        // Redimensionamento mais agressivo para Android (800px é o "sweet spot")
        const MAX_SIZE = 800;
        let targetWidth = videoWidth;
        let targetHeight = videoHeight;

        if (videoWidth > MAX_SIZE || videoHeight > MAX_SIZE) {
            if (videoWidth > videoHeight) {
                targetWidth = MAX_SIZE;
                targetHeight = Math.round((videoHeight / videoWidth) * MAX_SIZE);
            } else {
                targetHeight = MAX_SIZE;
                targetWidth = Math.round((videoWidth / videoHeight) * MAX_SIZE);
            }
        }

        canvas.width = targetWidth;
        canvas.height = targetHeight;
        
        const context = canvas.getContext('2d', { 
            alpha: false,
            willReadFrequently: true // Otimização para Chrome
        });

        if (context) {
          // Limpa o fundo para evitar artefatos
          context.fillStyle = "#000000";
          context.fillRect(0, 0, targetWidth, targetHeight);
          
          context.drawImage(video, 0, 0, targetWidth, targetHeight);
          
          // Qualidade 0.7 é ideal para balancear nitidez facial e tamanho de memória
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          
          // Liberação imediata de memória do canvas antes de seguir
          canvas.width = 0;
          canvas.height = 0;
          
          onCapture(dataUrl);
        }
    } catch (err) {
        console.error("Erro crítico na captura:", err);
        alert("Ocorreu um erro ao processar a foto. Reduzindo qualidade para tentar novamente.");
        // Fallback: tenta capturar com resolução mínima se falhar
    }
  };
  
  const handleRetake = () => {
      onCapture('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
          alert("Arquivo muito grande. Limite de 10MB.");
          return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        onCapture(reader.result as string);
      };
      reader.onerror = () => alert("Erro ao ler arquivo.");
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto flex flex-col items-center">
        <div className="relative w-full aspect-square bg-neutral-950 rounded-[2.5rem] overflow-hidden border-4 border-white/5 shadow-2xl">
            {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 bg-neutral-900/90 z-10">
                    <p className="text-red-400 text-xs font-bold uppercase mb-4 leading-relaxed">{error}</p>
                    <button onClick={startStream} className="bg-white/10 hover:bg-white/20 text-white text-[10px] px-4 py-2 rounded-full font-black uppercase tracking-widest transition-all">Tentar Reativar</button>
                </div>
            )}
            {capturedImage ? (
                <img src={capturedImage} alt="Captured" className="w-full h-full object-cover animate-in fade-in zoom-in-95 duration-500" />
            ) : (
                <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    className="w-full h-full object-cover" 
                    muted
                    onCanPlay={() => setIsStreamActive(true)}
                ></video>
            )}
             {!isStreamActive && !capturedImage && !error &&
                <div className="absolute inset-0 flex items-center justify-center bg-black">
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
